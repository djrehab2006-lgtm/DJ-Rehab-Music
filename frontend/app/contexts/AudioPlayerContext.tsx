import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import {
  createAudioPlaylist,
  setAudioModeAsync,
  type AudioPlaylist,
  type AudioPlaylistStatus,
  type AudioMetadata,
  type AudioLockScreenOptions,
} from 'expo-audio';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRACK_ICON } from '../constants/musicData';
import {
  savePlaybackState,
  loadPlaybackState,
  clearPlaybackState,
  resolveTracks,
  SAVE_INTERVAL_MS,
} from '../utils/playbackStateStorage';
import {
  CROSSFADE_MS,
  CROSSFADE_SEC,
  FADE_TICK_MS,
  loadCrossfadeEnabled,
  saveCrossfadeEnabled,
} from '../utils/crossfadeSettings';
import { promptLockScreenPermissionOnPlay } from '../utils/lockScreenPermission';
import { installConsoleCapture, logDiag, getDiagnosticsReport } from '../utils/diagnosticsLog';

installConsoleCapture();

interface Track {
  id: string;
  title: string;
  artist: string;
  cdn_url: string;
  cover_art?: string | null;
  folder_id?: string;
}

interface PlaybackStatus {
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  isLoaded: boolean;
}

interface AudioPlayerContextType {
  currentTrack: Track | null;
  playbackStatus: PlaybackStatus;
  isLoading: boolean;
  isFavorite: boolean;
  isShuffled: boolean;
  playTrack: (track: Track, playlist?: Track[]) => Promise<void>;
  pauseTrack: () => Promise<void>;
  resumeTrack: () => Promise<void>;
  stopTrack: () => Promise<void>;
  seekTo: (positionMillis: number) => Promise<void>;
  toggleFavorite: () => void;
  favoriteIds: string[];
  removeFavorite: (trackId: string) => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  shufflePlaylist: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  crossfadeEnabled: boolean;
  setCrossfadeEnabled: (enabled: boolean) => void;
  /** Re-posts the lock screen / notification controls for the current track (e.g. after permission granted). */
  refreshLockScreen: () => void;
  /** Text report for troubleshooting lock screen controls on a device. */
  getLockScreenReport: () => string;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

const LOCK_SCREEN_OPTIONS: AudioLockScreenOptions = {
  showNextTrack: true,
  showPreviousTrack: true,
  showSeekForward: false,
  showSeekBackward: false,
};

const toSource = (t: Track) => ({ uri: t.cdn_url, name: t.title });

const sameQueue = (a: Track[], b: Track[]) =>
  a.length === b.length && a.every((t, i) => t.id === b[i].id);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>({
    isPlaying: false,
    positionMillis: 0,
    durationMillis: 0,
    isLoaded: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [crossfadeEnabled, setCrossfadeEnabledState] = useState(true);

  // Single long-lived native playlist (ExoPlayer on Android, <audio> on web)
  const playerRef = useRef<AudioPlaylist | null>(null);
  const queueRef = useRef<Track[]>([]); // mirrors the native playlist order
  const originalPlaylistRef = useRef<Track[]>([]);
  const currentIndexRef = useRef(-1);
  const currentTrackRef = useRef<Track | null>(null);
  const isShuffledRef = useRef(false);
  const favoritesRef = useRef(favorites);
  const lastSaveRef = useRef(0);
  const isRestoringRef = useRef(false);
  const rebuildingRef = useRef(false); // suppress native events while the queue is rebuilt
  const endedRef = useRef(false); // whole queue finished
  const pendingSeekSecRef = useRef<number | null>(null); // restore position once loaded
  const artworkUrlRef = useRef<string | undefined>(undefined);
  const lockScreenInfoRef = useRef<{ attempts: number; lastError: string | null; artworkUrl: string | null }>({
    attempts: 0,
    lastError: null,
    artworkUrl: null,
  });

  // Crossfade (fade-out → fade-in) state
  const crossfadeEnabledRef = useRef(true);
  const fadeModeRef = useRef<'out' | 'in' | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  const setVolume = (volume: number) => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.volume = volume;
    } catch {
      // player released
    }
  };

  const cancelFade = useCallback((restoreVolume: boolean) => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    fadeModeRef.current = null;
    if (restoreVolume) {
      setVolume(1);
    }
  }, []);

  // Fade the outgoing track to silence over its last CROSSFADE_SEC seconds
  const startFadeOut = useCallback(() => {
    cancelFade(false);
    fadeModeRef.current = 'out';
    fadeIntervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) {
        cancelFade(false);
        return;
      }
      try {
        const remaining = player.duration - player.currentTime;
        if (remaining > CROSSFADE_SEC + 0.5) {
          // Listener seeked back out of the fade window
          cancelFade(true);
          return;
        }
        player.volume = Math.min(1, Math.max(0, remaining / CROSSFADE_SEC));
      } catch {
        // player not ready
      }
    }, FADE_TICK_MS);
  }, [cancelFade]);

  // Bring the incoming track up from silence over CROSSFADE_MS
  const startFadeIn = useCallback(() => {
    cancelFade(false);
    fadeModeRef.current = 'in';
    const startedAt = Date.now();
    setVolume(0);
    fadeIntervalRef.current = setInterval(() => {
      const volume = Math.min(1, (Date.now() - startedAt) / CROSSFADE_MS);
      setVolume(volume);
      if (volume >= 1) {
        cancelFade(false);
      }
    }, FADE_TICK_MS);
  }, [cancelFade]);

  const setCrossfadeEnabled = useCallback((enabled: boolean) => {
    setCrossfadeEnabledState(enabled);
    crossfadeEnabledRef.current = enabled;
    saveCrossfadeEnabled(enabled);
    if (!enabled) {
      cancelFade(true);
    }
  }, [cancelFade]);

  useEffect(() => {
    loadCrossfadeEnabled().then((enabled) => {
      setCrossfadeEnabledState(enabled);
      crossfadeEnabledRef.current = enabled;
    });
  }, []);

  const hasNext = currentIndex < playlist.length - 1;
  const hasPrevious = currentIndex > 0;

  // Persist "where the listener is" so the session can be resumed on next launch
  const persistState = useCallback((positionMillis: number, track = currentTrackRef.current) => {
    if (!track || isRestoringRef.current) return;
    lastSaveRef.current = Date.now();
    savePlaybackState({
      trackId: track.id,
      queueIds: queueRef.current.map((t) => t.id),
      originalQueueIds: originalPlaylistRef.current.map((t) => t.id),
      isShuffled: isShuffledRef.current,
      positionMillis: Math.max(0, Math.floor(positionMillis)),
    });
  }, []);

  const applyQueueState = (tracks: Track[], original: Track[], shuffled: boolean, index: number) => {
    setPlaylist(tracks);
    queueRef.current = tracks;
    originalPlaylistRef.current = original.length > 0 ? original : tracks;
    setIsShuffled(shuffled);
    isShuffledRef.current = shuffled;
    setCurrentIndex(index);
    currentIndexRef.current = index;
    setCurrentTrack(tracks[index] ?? null);
    currentTrackRef.current = tracks[index] ?? null;
  };

  const setActiveTrack = (index: number) => {
    const track = queueRef.current[index];
    if (!track) return;
    setCurrentIndex(index);
    currentIndexRef.current = index;
    setCurrentTrack(track);
    currentTrackRef.current = track;
    setIsFavorite(favoritesRef.current.has(track.id));
  };

  // ---- Lock screen / notification -------------------------------------------------

  const metadataFor = (track: Track): AudioMetadata => ({
    title: track.title,
    artist: track.artist,
    albumTitle: 'DJ Rehab Music',
    artworkUrl: track.cover_art || artworkUrlRef.current,
  });

  const activateLockScreen = (track: Track) => {
    const player = playerRef.current;
    if (!player) {
      logDiag('lockscreen: no player instance');
      return;
    }
    const metadata = metadataFor(track);
    try {
      player.setActiveForLockScreen(true, metadata, LOCK_SCREEN_OPTIONS);
      lockScreenInfoRef.current = {
        attempts: lockScreenInfoRef.current.attempts + 1,
        lastError: null,
        artworkUrl: metadata.artworkUrl ?? null,
      };
      logDiag(`lockscreen: activated for "${track.title}" (artwork: ${metadata.artworkUrl ? 'yes' : 'none'})`);
    } catch (error: any) {
      const message = error?.message ?? String(error);
      logDiag(`lockscreen: setActiveForLockScreen threw: ${message}`);
      lockScreenInfoRef.current = { ...lockScreenInfoRef.current, attempts: lockScreenInfoRef.current.attempts + 1, lastError: message };
      // Retry without artwork in case the artwork URL is what the native side rejected
      try {
        player.setActiveForLockScreen(true, { ...metadata, artworkUrl: undefined }, LOCK_SCREEN_OPTIONS);
        logDiag('lockscreen: activated without artwork');
      } catch (retryError: any) {
        logDiag(`lockscreen: retry without artwork threw: ${retryError?.message ?? String(retryError)}`);
      }
    }
  };

  const updateLockScreen = (track: Track) => {
    try {
      playerRef.current?.updateLockScreenMetadata(metadataFor(track));
    } catch {
      // not active
    }
  };

  const refreshLockScreen = useCallback(() => {
    const track = currentTrackRef.current;
    if (track) activateLockScreen(track);
  }, []);

  const getLockScreenReport = useCallback(() => {
    const player = playerRef.current;
    const info = lockScreenInfoRef.current;
    return getDiagnosticsReport({
      'Current track': currentTrackRef.current?.title ?? '(none)',
      'Queue length': queueRef.current.length,
      'Native tracks': player ? player.trackCount : 'no player',
      Playing: player ? player.playing : false,
      'Lock screen activations': info.attempts,
      'Last activation error': info.lastError ?? 'none',
      'Artwork URL': info.artworkUrl ?? artworkUrlRef.current ?? 'none',
    });
  }, []);

  // ---- Native playlist -------------------------------------------------------------

  const onStatus = useCallback((status: AudioPlaylistStatus) => {
    if (rebuildingRef.current) return;
    const player = playerRef.current;
    const positionMillis = Math.floor(status.currentTime * 1000);
    const durationMillis = Math.floor(status.duration * 1000);

    setPlaybackStatus({
      isPlaying: status.playing,
      positionMillis,
      durationMillis,
      isLoaded: status.isLoaded,
    });

    if (status.isLoaded || status.playing) {
      setIsLoading(false);
    }
    if (status.playing) {
      endedRef.current = false;
    }

    // Apply a restored position once the track is actually loaded
    if (pendingSeekSecRef.current !== null && status.isLoaded && player) {
      const target = pendingSeekSecRef.current;
      pendingSeekSecRef.current = null;
      if (Math.abs(status.currentTime - target) > 1) {
        player.seekTo(target).catch(() => {});
      }
    }

    const error = (status as any).error;
    if (error) {
      console.error('Playback error:', error);
      setIsLoading(false);
    }

    // Periodically remember the position while playing
    if (status.playing && Date.now() - lastSaveRef.current > SAVE_INTERVAL_MS) {
      persistState(positionMillis);
    }

    // Start fading out when the track enters its last few seconds (and another track follows)
    const hasNextTrack = currentIndexRef.current < queueRef.current.length - 1;
    if (
      crossfadeEnabledRef.current &&
      status.playing &&
      fadeModeRef.current === null &&
      hasNextTrack &&
      status.duration > 0 &&
      status.duration - status.currentTime <= CROSSFADE_SEC
    ) {
      startFadeOut();
    }

    // Whole queue finished: next launch should start the last track from the top
    if (status.didJustFinish && status.trackCount > 0) {
      endedRef.current = true;
      cancelFade(true);
      persistState(0);
      setPlaybackStatus((prev) => ({ ...prev, isPlaying: false }));
    }
  }, [persistState, startFadeOut, cancelFade]);

  const onTrackChanged = useCallback(() => {
    if (rebuildingRef.current) return;
    const player = playerRef.current;
    if (!player) return;
    // Read the live index: stale events from a queue rebuild then resolve correctly
    const index = player.currentIndex;
    const track = queueRef.current[index];
    if (!track) return;

    // Volume handling for the incoming track
    if (fadeModeRef.current === 'out' && crossfadeEnabledRef.current) {
      startFadeIn();
    } else {
      cancelFade(true);
    }

    if (currentTrackRef.current?.id !== track.id) {
      setActiveTrack(index);
      updateLockScreen(track);
      persistState(0, track);
    }
  }, [startFadeIn, cancelFade, persistState]);

  const statusSubRef = useRef<{ remove: () => void } | null>(null);
  const trackSubRef = useRef<{ remove: () => void } | null>(null);

  const ensurePlayer = (): AudioPlaylist => {
    if (playerRef.current) return playerRef.current;
    const player = createAudioPlaylist({ loop: 'none', updateInterval: 500 });
    logDiag(
      `playlist created (setActiveForLockScreen: ${typeof (player as any).setActiveForLockScreen}, updateLockScreenMetadata: ${typeof (player as any).updateLockScreenMetadata})`
    );
    statusSubRef.current = player.addListener('playlistStatusUpdate', onStatus);
    trackSubRef.current = player.addListener('trackChanged', onTrackChanged);
    playerRef.current = player;
    return player;
  };

  // Replace the whole native queue (stops whatever is playing)
  const loadQueue = (player: AudioPlaylist, tracks: Track[]) => {
    rebuildingRef.current = true;
    try {
      player.clear();
      tracks.forEach((t) => player.add(toSource(t)));
    } finally {
      rebuildingRef.current = false;
    }
  };

  // Reorder the native queue around the current track without interrupting playback
  const reorderQueue = (player: AudioPlaylist, newQueue: Track[], keepPlaying: Track | null) => {
    rebuildingRef.current = true;
    try {
      const target = keepPlaying ? newQueue.findIndex((t) => t.id === keepPlaying.id) : -1;
      if (target < 0) {
        player.clear();
        newQueue.forEach((t) => player.add(toSource(t)));
        return;
      }
      const keepIndex = player.currentIndex;
      for (let i = player.trackCount - 1; i >= 0; i--) {
        if (i !== keepIndex) player.remove(i);
      }
      // The current track is now alone at index 0
      for (let i = 0; i < target; i++) {
        player.insert(toSource(newQueue[i]), i);
      }
      for (let i = target + 1; i < newQueue.length; i++) {
        player.add(toSource(newQueue[i]));
      }
    } finally {
      rebuildingRef.current = false;
    }
  };

  // ---- Session restore -------------------------------------------------------------

  const restoreSession = async () => {
    isRestoringRef.current = true;
    try {
      const saved = await loadPlaybackState();
      if (!saved) return;
      const tracks = resolveTracks(saved.queueIds);
      if (tracks.length === 0) return;

      const savedIndex = tracks.findIndex((t) => t.id === saved.trackId);
      const index = savedIndex >= 0 ? savedIndex : 0;
      const positionSec = savedIndex >= 0 ? saved.positionMillis / 1000 : 0;

      applyQueueState(tracks, resolveTracks(saved.originalQueueIds), saved.isShuffled, index);
      setIsFavorite(favoritesRef.current.has(tracks[index].id));

      const player = ensurePlayer();
      loadQueue(player, tracks);
      player.skipTo(index);
      if (positionSec > 0) {
        pendingSeekSecRef.current = positionSec;
        await player.seekTo(positionSec);
      }
      setPlaybackStatus({
        isPlaying: false,
        positionMillis: Math.floor(positionSec * 1000),
        durationMillis: 0,
        isLoaded: false,
      });
    } catch (error) {
      console.error('Error restoring playback session:', error);
    } finally {
      isRestoringRef.current = false;
    }
  };

  // Configure the audio session, prepare lock screen artwork, then restore the last session
  useEffect(() => {
    const init = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
        logDiag('audio mode set (background + doNotMix)');
      } catch (error: any) {
        console.error('Error configuring audio session:', error);
        logDiag(`audio mode FAILED: ${error?.message ?? String(error)}`);
      }
      try {
        const asset = await Asset.fromModule(TRACK_ICON).downloadAsync();
        artworkUrlRef.current = asset.localUri ?? asset.uri;
        logDiag(`artwork resolved: ${artworkUrlRef.current}`);
      } catch (error: any) {
        logDiag(`artwork unavailable: ${error?.message ?? String(error)}`);
      }
      await restoreSession();
    };
    init();

    return () => {
      cancelFade(false);
      statusSubRef.current?.remove();
      trackSubRef.current?.remove();
      const player = playerRef.current;
      playerRef.current = null;
      if (player) {
        try {
          player.clearLockScreenControls();
          player.destroy();
          player.release();
        } catch {
          // already released
        }
      }
    };
  }, []);

  // Load favorites from storage
  useEffect(() => {
    loadFavorites();
  }, []);

  // Save the exact position when the app goes to the background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'background' && state !== 'inactive') return;
      const player = playerRef.current;
      if (!player) return;
      try {
        persistState(player.currentTime * 1000);
      } catch {
        // player not ready
      }
    });
    return () => sub.remove();
  }, [persistState]);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem('favorites');
      if (stored) {
        setFavorites(new Set(JSON.parse(stored)));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const saveFavorites = async (newFavorites: Set<string>) => {
    try {
      await AsyncStorage.setItem('favorites', JSON.stringify([...newFavorites]));
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  };

  // Check if current track is favorite
  useEffect(() => {
    if (currentTrack) {
      setIsFavorite(favorites.has(currentTrack.id));
    }
  }, [currentTrack, favorites]);

  // ---- Controls --------------------------------------------------------------------

  const playTrack = useCallback(async (track: Track, newPlaylist?: Track[]) => {
    try {
      setIsLoading(true);
      const player = ensurePlayer();

      let queue = queueRef.current;
      const needsRebuild =
        (newPlaylist && newPlaylist.length > 0 && (isShuffledRef.current || !sameQueue(newPlaylist, queue))) ||
        player.trackCount !== queue.length;

      if (newPlaylist && newPlaylist.length > 0 && needsRebuild) {
        queue = newPlaylist;
        const index = Math.max(0, queue.findIndex((t) => t.id === track.id));
        applyQueueState(queue, queue, false, index);
        loadQueue(player, queue);
      } else if (needsRebuild) {
        loadQueue(player, queue);
      }

      const index = Math.max(0, queue.findIndex((t) => t.id === track.id));
      setActiveTrack(index);

      // Manual selection always starts at full volume
      cancelFade(true);
      endedRef.current = false;
      pendingSeekSecRef.current = null;

      player.skipTo(index);
      activateLockScreen(queue[index]);
      player.play();
      persistState(0, queue[index]);
      // Android 13+: controls only appear once notifications are allowed — ask contextually on first play
      promptLockScreenPermissionOnPlay(refreshLockScreen);
    } catch (error) {
      console.error('Error playing track:', error);
      setIsLoading(false);
    }
  }, [persistState, cancelFade, refreshLockScreen]);

  const pauseTrack = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.pause();
      persistState(player.currentTime * 1000);
    } catch (error) {
      console.error('Error pausing track:', error);
    }
  }, [persistState]);

  const resumeTrack = useCallback(async () => {
    const player = playerRef.current;
    const track = currentTrackRef.current;
    if (!player || !track) return;
    try {
      if (endedRef.current) {
        // Queue already finished: restart the current track from the top
        endedRef.current = false;
        player.skipTo(Math.max(0, currentIndexRef.current));
      }
      activateLockScreen(track);
      player.play();
    } catch (error) {
      console.error('Error resuming track:', error);
    }
  }, []);

  const stopTrack = useCallback(async () => {
    const player = playerRef.current;
    try {
      cancelFade(true);
      if (player) {
        rebuildingRef.current = true;
        try {
          player.pause();
          player.clearLockScreenControls();
          player.clear();
        } finally {
          rebuildingRef.current = false;
        }
      }
      queueRef.current = [];
      setPlaylist([]);
      setCurrentIndex(-1);
      currentIndexRef.current = -1;
      setCurrentTrack(null);
      currentTrackRef.current = null;
      clearPlaybackState();
      setPlaybackStatus({
        isPlaying: false,
        positionMillis: 0,
        durationMillis: 0,
        isLoaded: false,
      });
    } catch (error) {
      console.error('Error stopping track:', error);
    }
  }, [cancelFade]);

  const seekTo = useCallback(async (positionMillis: number) => {
    const player = playerRef.current;
    if (!player) return;
    try {
      pendingSeekSecRef.current = null;
      await player.seekTo(positionMillis / 1000);
      setPlaybackStatus((prev) => ({ ...prev, positionMillis }));
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }, []);

  const toggleFavorite = useCallback(() => {
    if (!currentTrack) return;

    const newFavorites = new Set(favorites);
    if (newFavorites.has(currentTrack.id)) {
      newFavorites.delete(currentTrack.id);
      setIsFavorite(false);
    } else {
      newFavorites.add(currentTrack.id);
      setIsFavorite(true);
    }
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
  }, [currentTrack, favorites]);

  const removeFavorite = useCallback((trackId: string) => {
    const newFavorites = new Set(favorites);
    newFavorites.delete(trackId);
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
  }, [favorites]);

  const skipTo = (index: number) => {
    const player = playerRef.current;
    const track = queueRef.current[index];
    if (!player || !track) return;
    setIsLoading(true);
    cancelFade(true);
    endedRef.current = false;
    setActiveTrack(index);
    player.skipTo(index);
    updateLockScreen(track);
    player.play();
    persistState(0, track);
  };

  const playNext = useCallback(async () => {
    if (currentIndexRef.current < queueRef.current.length - 1) {
      skipTo(currentIndexRef.current + 1);
    }
  }, [persistState, cancelFade]);

  const playPrevious = useCallback(async () => {
    if (currentIndexRef.current > 0) {
      skipTo(currentIndexRef.current - 1);
    }
  }, [persistState, cancelFade]);

  const shufflePlaylist = useCallback(() => {
    const player = playerRef.current;
    const current = currentTrackRef.current;
    const queue = queueRef.current;

    let newQueue: Track[];
    let shuffled: boolean;
    if (isShuffledRef.current) {
      // Restore original order
      newQueue = originalPlaylistRef.current;
      shuffled = false;
    } else {
      // Shuffle keeping the current track first
      const others = queue.filter((t) => t.id !== current?.id);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      newQueue = current ? [current, ...others] : others;
      shuffled = true;
    }

    const newIndex = current ? Math.max(0, newQueue.findIndex((t) => t.id === current.id)) : 0;
    setPlaylist(newQueue);
    queueRef.current = newQueue;
    setIsShuffled(shuffled);
    isShuffledRef.current = shuffled;
    setCurrentIndex(newIndex);
    currentIndexRef.current = newIndex;

    if (player) {
      try {
        reorderQueue(player, newQueue, current);
      } catch (error) {
        console.error('Error reordering queue:', error);
      }
    }
    if (current) {
      persistState(player ? player.currentTime * 1000 : 0, current);
    }
  }, [persistState]);

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        playbackStatus,
        isLoading,
        isFavorite,
        isShuffled,
        playTrack,
        pauseTrack,
        resumeTrack,
        stopTrack,
        seekTo,
        toggleFavorite,
        favoriteIds: [...favorites],
        removeFavorite,
        playNext,
        playPrevious,
        shufflePlaylist,
        hasNext,
        hasPrevious,
        crossfadeEnabled,
        setCrossfadeEnabled,
        refreshLockScreen,
        getLockScreenReport,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}
