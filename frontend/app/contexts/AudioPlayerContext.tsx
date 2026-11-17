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
  CROSSFADE_SEC,
  CROSSFADE_START_SEC,
  CUE_AHEAD_SEC,
  MIN_CROSSFADE_SEC,
  FADE_END_GUARD_SEC,
  STATUS_INTERVAL_MS,
  fadeInGain,
  fadeOutGain,
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

// Status events arrive every STATUS_INTERVAL_MS to keep fades smooth; the UI only needs ~2 per second
const UI_STATUS_INTERVAL_MS = 450;

// An overlap between two decks: `from` is playing out the end of its track while `to` plays the next one
interface Crossfade {
  from: AudioPlaylist;
  to: AudioPlaylist;
  fromIndex: number;
  toIndex: number;
  /** Overlap length in seconds; null until the incoming deck is really playing. */
  length: number | null;
}

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

  // Two native playlists ("decks": ExoPlayer on Android, <audio> on web) hold the same queue so the
  // next track can start underneath the ending one. playerRef is always the deck that owns the
  // current track (UI + lock screen); idleRef is the other one, created the first time it is needed.
  const playerRef = useRef<AudioPlaylist | null>(null);
  const idleRef = useRef<AudioPlaylist | null>(null);
  const deckSubsRef = useRef<{ remove: () => void }[]>([]);
  const queueVersionRef = useRef(0); // bumped whenever the queue content/order changes
  const deckVersionRef = useRef(new Map<AudioPlaylist, number>()); // queue version loaded into each deck
  const cuedIndexRef = useRef<number | null>(null); // queue index the idle deck is parked on
  const skipFadeIndexRef = useRef<number | null>(null); // next track that could not be prepared
  const fadeRef = useRef<Crossfade | null>(null);
  const uiStatusRef = useRef({ at: 0, isPlaying: false, isLoaded: false, durationMillis: 0 });
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

  const crossfadeEnabledRef = useRef(true);

  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  const setDeckVolume = (deck: AudioPlaylist | null, volume: number) => {
    if (!deck) return;
    try {
      deck.volume = Math.min(1, Math.max(0, volume));
    } catch {
      // deck released
    }
  };

  // Silence a deck that must not be heard (finished fading out, or never got to fade in)
  const parkDeck = (deck: AudioPlaylist | null) => {
    if (!deck) return;
    try {
      deck.pause();
      deck.volume = 0;
    } catch {
      // deck released
    }
  };

  // End any overlap right now. If the incoming track is already audible it carries on alone at
  // full volume, otherwise the current deck simply keeps playing.
  const settleCrossfade = () => {
    const fade = fadeRef.current;
    if (!fade) return;
    fadeRef.current = null;
    cuedIndexRef.current = null;
    if (fade.length === null) {
      parkDeck(fade.to);
    } else {
      parkDeck(fade.from);
      setDeckVolume(fade.to, 1);
    }
  };

  const setCrossfadeEnabled = useCallback((enabled: boolean) => {
    setCrossfadeEnabledState(enabled);
    crossfadeEnabledRef.current = enabled;
    saveCrossfadeEnabled(enabled);
    if (!enabled) {
      settleCrossfade();
    }
  }, []);

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
      Crossfade: crossfadeEnabledRef.current ? (idleRef.current ? 'on (2 decks)' : 'on') : 'off',
      'Lock screen activations': info.attempts,
      'Last activation error': info.lastError ?? 'none',
      'Artwork URL': info.artworkUrl ?? artworkUrlRef.current ?? 'none',
    });
  }, []);

  // ---- Native playlist -------------------------------------------------------------

  // The UI only needs a couple of updates per second (and every play/pause/load change)
  const publishStatus = (next: PlaybackStatus) => {
    const last = uiStatusRef.current;
    const now = Date.now();
    if (
      now - last.at < UI_STATUS_INTERVAL_MS &&
      last.isPlaying === next.isPlaying &&
      last.isLoaded === next.isLoaded &&
      last.durationMillis === next.durationMillis
    ) {
      return;
    }
    uiStatusRef.current = {
      at: now,
      isPlaying: next.isPlaying,
      isLoaded: next.isLoaded,
      durationMillis: next.durationMillis,
    };
    setPlaybackStatus(next);
  };

  // Every fade step happens here, in response to a native status event from one of the decks
  const onStatus = (deck: AudioPlaylist, status: AudioPlaylistStatus) => {
    if (rebuildingRef.current) return;
    const fade = fadeRef.current;

    // Incoming deck still starting up: the overlap begins once it is really playing
    if (fade && deck === fade.to && fade.length === null) {
      const loadError = (status as any).error;
      if (loadError) {
        console.error('Next track failed to load:', loadError);
      }
      if (!(status.playing && status.currentIndex === fade.toIndex && status.currentTime > 0)) return;
      commitCrossfade(fade);
    }

    if (deck !== playerRef.current) {
      if (fade && deck === fade.from && fade.length !== null) {
        // Outgoing deck: fade out over what is left of its track, then stop it before it rolls over
        const remaining = status.duration - status.currentTime;
        if (
          !status.playing ||
          status.currentIndex !== fade.fromIndex ||
          remaining <= FADE_END_GUARD_SEC ||
          remaining > fade.length + 1
        ) {
          settleCrossfade();
        } else {
          setDeckVolume(deck, fadeOutGain(1 - remaining / fade.length));
        }
      } else if (status.playing) {
        // A parked deck must never be heard (e.g. resumed by the system after an interruption)
        parkDeck(deck);
      }
      return;
    }

    // ---- Current deck ----
    const player = deck;
    const positionMillis = Math.floor(status.currentTime * 1000);
    const durationMillis = Math.floor(status.duration * 1000);

    publishStatus({
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
    // eslint-disable-next-line react-hooks/purity -- native event handler, never runs during render
    if (status.playing && Date.now() - lastSaveRef.current > SAVE_INTERVAL_MS) {
      persistState(positionMillis);
    }

    if (fade && fadeRef.current === fade) {
      if (!status.playing) {
        // Paused from outside the app (lock screen, headset, phone call) in the middle of an overlap
        settleCrossfade();
      } else if (deck === fade.to && fade.length !== null) {
        setDeckVolume(deck, fadeInGain(status.currentTime / fade.length));
      }
    } else if (!fadeRef.current) {
      // Playing alone: always at full volume
      if (status.volume < 1) {
        setDeckVolume(deck, 1);
      }
      // Near the end of the track (and another one follows): get the other deck ready, then start it
      const index = currentIndexRef.current;
      if (
        crossfadeEnabledRef.current &&
        status.playing &&
        status.currentIndex === index &&
        index < queueRef.current.length - 1 &&
        skipFadeIndexRef.current !== index + 1 &&
        status.duration > 0
      ) {
        const remaining = status.duration - status.currentTime;
        if (remaining <= CROSSFADE_START_SEC) {
          startCrossfade(index + 1);
        } else if (remaining <= CUE_AHEAD_SEC) {
          cueIdleDeck(index + 1);
        }
      }
    }

    // Whole queue finished: next launch should start the last track from the top
    if (status.didJustFinish && status.trackCount > 0) {
      endedRef.current = true;
      settleCrossfade();
      persistState(0);
      setPlaybackStatus((prev) => ({ ...prev, isPlaying: false }));
    }
  };

  const onTrackChanged = (deck: AudioPlaylist) => {
    if (rebuildingRef.current) return;
    const fade = fadeRef.current;
    if (fade) {
      const liveIndex = deck.currentIndex;
      // Echo of parking the incoming deck on its track
      if (deck === fade.to && liveIndex === fade.toIndex) return;
      if (deck === fade.from && liveIndex === fade.fromIndex) return;
      // One of the two decks moved on by itself: the outgoing track ran out before the next one was
      // ready, or next/previous was pressed on the lock screen. Stop overlapping.
      if (fade.length === null && deck === fade.from) {
        logDiag('crossfade: next track was not ready in time, continued without overlap');
      }
      settleCrossfade();
    }
    if (deck !== playerRef.current) return; // the other deck being parked on its track

    // Read the live index: stale events from a queue rebuild then resolve correctly
    const index = deck.currentIndex;
    const track = queueRef.current[index];
    if (!track) return;

    // The deck moved to this track on its own: it plays alone, at full volume
    setDeckVolume(deck, 1);

    if (currentTrackRef.current?.id !== track.id) {
      setActiveTrack(index);
      updateLockScreen(track);
      persistState(0, track);
    }
  };

  const createDeck = (): AudioPlaylist => {
    const deck = createAudioPlaylist({ loop: 'none', updateInterval: STATUS_INTERVAL_MS });
    deckSubsRef.current.push(
      deck.addListener('playlistStatusUpdate', (status) => onStatus(deck, status)),
      deck.addListener('trackChanged', () => onTrackChanged(deck))
    );
    return deck;
  };

  const ensurePlayer = (): AudioPlaylist => {
    if (playerRef.current) return playerRef.current;
    const player = createDeck();
    logDiag(
      `playlist created (setActiveForLockScreen: ${typeof (player as any).setActiveForLockScreen}, updateLockScreenMetadata: ${typeof (player as any).updateLockScreenMetadata})`
    );
    playerRef.current = player;
    return player;
  };

  // The queue changed: the idle deck is rebuilt from it the next time it is needed
  const markQueueChanged = () => {
    queueVersionRef.current += 1;
    cuedIndexRef.current = null;
    skipFadeIndexRef.current = null;
  };

  // Replace a deck's whole native queue (stops whatever it is playing)
  const loadQueue = (deck: AudioPlaylist, tracks: Track[]) => {
    rebuildingRef.current = true;
    try {
      deck.clear();
      tracks.forEach((t) => deck.add(toSource(t)));
    } finally {
      rebuildingRef.current = false;
    }
    deckVersionRef.current.set(deck, queueVersionRef.current);
  };

  // ---- Crossfade (two decks overlapping) -------------------------------------------

  // Park the other deck, silent, on the upcoming track so it has buffered by the time it is needed
  const cueIdleDeck = (index: number) => {
    if (cuedIndexRef.current === index) return;
    try {
      let deck = idleRef.current;
      if (!deck) {
        deck = createDeck();
        idleRef.current = deck;
        logDiag('crossfade: second deck created');
      }
      deck.pause();
      setDeckVolume(deck, 0);
      if (deckVersionRef.current.get(deck) !== queueVersionRef.current) {
        loadQueue(deck, queueRef.current);
      }
      if (deck.currentIndex !== index) {
        deck.skipTo(index);
      } else {
        deck.seekTo(0).catch(() => {});
      }
      cuedIndexRef.current = index;
    } catch (error: any) {
      skipFadeIndexRef.current = index;
      logDiag(`crossfade: could not prepare the next track: ${error?.message ?? String(error)}`);
    }
  };

  // Start the next track, silent, on the other deck. Nothing is faded until it is really playing,
  // so if it never starts the current deck just moves on to the next track by itself.
  const startCrossfade = (nextIndex: number) => {
    const from = playerRef.current;
    if (!from || fadeRef.current) return;
    try {
      // Status events can be stale right after a manual skip: confirm with the live player first
      if (!from.playing || from.currentIndex !== currentIndexRef.current) return;
      const duration = from.duration;
      if (!(duration > 0) || duration - from.currentTime > CROSSFADE_START_SEC) return;
      cueIdleDeck(nextIndex);
      const to = idleRef.current;
      if (!to || cuedIndexRef.current !== nextIndex) return;
      to.volume = 0;
      to.play();
      fadeRef.current = { from, to, fromIndex: currentIndexRef.current, toIndex: nextIndex, length: null };
    } catch (error: any) {
      skipFadeIndexRef.current = nextIndex;
      logDiag(`crossfade: could not start the next track: ${error?.message ?? String(error)}`);
    }
  };

  // The incoming deck is really playing: it becomes the current deck and the two tracks overlap
  // for whatever is left of the outgoing one.
  const commitCrossfade = (fade: Crossfade) => {
    const track = queueRef.current[fade.toIndex];
    if (!track) {
      settleCrossfade();
      return;
    }
    let remaining = CROSSFADE_SEC;
    try {
      remaining = fade.from.duration - fade.from.currentTime;
    } catch {
      // deck released
    }
    if (remaining > CROSSFADE_START_SEC + 1) {
      // The outgoing track was seeked away from its end in the meantime: nothing to blend into
      settleCrossfade();
      return;
    }
    fade.length = Math.min(CROSSFADE_SEC, Math.max(MIN_CROSSFADE_SEC, remaining));
    playerRef.current = fade.to;
    idleRef.current = fade.from;
    cuedIndexRef.current = null;
    setIsLoading(false);
    setActiveTrack(fade.toIndex);
    // Moves the lock screen / Bluetooth controls over to the deck that is now current
    activateLockScreen(track);
    persistState(0, track);
    logDiag(
      `crossfade: mixing into "${track.title}" over ${fade.length.toFixed(1)}s (app ${AppState.currentState})`
    );
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
      markQueueChanged();
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
      fadeRef.current = null;
      deckSubsRef.current.forEach((sub) => sub.remove());
      deckSubsRef.current = [];
      const decks = [playerRef.current, idleRef.current];
      playerRef.current = null;
      idleRef.current = null;
      decks.forEach((deck) => {
        if (!deck) return;
        try {
          deck.clearLockScreenControls();
          deck.destroy();
          deck.release();
        } catch {
          // already released
        }
      });
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
      settleCrossfade();
      const player = ensurePlayer();

      let queue = queueRef.current;
      const needsRebuild =
        (newPlaylist && newPlaylist.length > 0 && (isShuffledRef.current || !sameQueue(newPlaylist, queue))) ||
        player.trackCount !== queue.length;

      if (newPlaylist && newPlaylist.length > 0 && needsRebuild) {
        queue = newPlaylist;
        const index = Math.max(0, queue.findIndex((t) => t.id === track.id));
        applyQueueState(queue, queue, false, index);
        markQueueChanged();
        loadQueue(player, queue);
      } else if (needsRebuild) {
        loadQueue(player, queue);
      }

      const index = Math.max(0, queue.findIndex((t) => t.id === track.id));
      setActiveTrack(index);

      // Manual selection always starts at full volume
      setDeckVolume(player, 1);
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
  }, [persistState, refreshLockScreen]);

  const pauseTrack = useCallback(async () => {
    settleCrossfade();
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
    try {
      settleCrossfade();
      rebuildingRef.current = true;
      try {
        [playerRef.current, idleRef.current].forEach((deck) => {
          if (!deck) return;
          deck.pause();
          deck.clearLockScreenControls();
          deck.clear();
        });
      } finally {
        rebuildingRef.current = false;
      }
      markQueueChanged();
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
  }, []);

  const seekTo = useCallback(async (positionMillis: number) => {
    settleCrossfade();
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
    settleCrossfade();
    const player = playerRef.current;
    const track = queueRef.current[index];
    if (!player || !track) return;
    setIsLoading(true);
    // Manual skips always start at full volume
    setDeckVolume(player, 1);
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
  }, [persistState]);

  const playPrevious = useCallback(async () => {
    if (currentIndexRef.current > 0) {
      skipTo(currentIndexRef.current - 1);
    }
  }, [persistState]);

  const shufflePlaylist = useCallback(() => {
    settleCrossfade();
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

    markQueueChanged();
    if (player) {
      try {
        reorderQueue(player, newQueue, current);
        deckVersionRef.current.set(player, queueVersionRef.current);
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
