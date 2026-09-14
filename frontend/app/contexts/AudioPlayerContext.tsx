import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  savePlaybackState,
  loadPlaybackState,
  clearPlaybackState,
  resolveTracks,
  SAVE_INTERVAL_MS,
} from '../utils/playbackStateStorage';
import {
  CROSSFADE_MS,
  FADE_TICK_MS,
  loadCrossfadeEnabled,
  saveCrossfadeEnabled,
} from '../utils/crossfadeSettings';

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
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  shufflePlaylist: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  crossfadeEnabled: boolean;
  setCrossfadeEnabled: (enabled: boolean) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [originalPlaylist, setOriginalPlaylist] = useState<Track[]>([]);
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

  const soundRef = useRef<Sound | null>(null);
  const isAutoPlayingRef = useRef(false);
  const currentIndexRef = useRef(currentIndex);
  const playlistRef = useRef(playlist);
  const originalPlaylistRef = useRef(originalPlaylist);
  const currentTrackRef = useRef(currentTrack);
  const isShuffledRef = useRef(isShuffled);
  const lastSaveRef = useRef(0);

  // Crossfade (fade-out → fade-in) state
  const [crossfadeEnabled, setCrossfadeEnabledState] = useState(true);
  const crossfadeEnabledRef = useRef(true);
  const fadeModeRef = useRef<'out' | 'in' | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingFadeInRef = useRef(false);

  const cancelFade = (restoreVolume: boolean) => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    fadeModeRef.current = null;
    if (restoreVolume && soundRef.current) {
      soundRef.current.setVolumeAsync(1).catch(() => {});
    }
  };

  // Fade the outgoing track to silence over its last CROSSFADE_MS
  const startFadeOut = () => {
    cancelFade(false);
    fadeModeRef.current = 'out';
    fadeIntervalRef.current = setInterval(async () => {
      const sound = soundRef.current;
      if (!sound) {
        cancelFade(false);
        return;
      }
      try {
        const status = await sound.getStatusAsync();
        if (!status.isLoaded || !status.durationMillis) return;
        const remaining = status.durationMillis - status.positionMillis;
        if (remaining > CROSSFADE_MS + 500) {
          // Listener seeked back out of the fade window
          cancelFade(true);
          return;
        }
        await sound.setVolumeAsync(Math.min(1, Math.max(0, remaining / CROSSFADE_MS)));
      } catch {
        // sound unloaded
      }
    }, FADE_TICK_MS);
  };

  // Bring the incoming track up from silence over CROSSFADE_MS
  const startFadeIn = () => {
    cancelFade(false);
    fadeModeRef.current = 'in';
    const startedAt = Date.now();
    fadeIntervalRef.current = setInterval(async () => {
      const volume = Math.min(1, (Date.now() - startedAt) / CROSSFADE_MS);
      try {
        await soundRef.current?.setVolumeAsync(volume);
      } catch {
        // sound unloaded
      }
      if (volume >= 1) {
        cancelFade(false);
      }
    }, FADE_TICK_MS);
  };

  const setCrossfadeEnabled = (enabled: boolean) => {
    setCrossfadeEnabledState(enabled);
    crossfadeEnabledRef.current = enabled;
    saveCrossfadeEnabled(enabled);
    if (!enabled) {
      cancelFade(true);
    }
  };

  useEffect(() => {
    loadCrossfadeEnabled().then((enabled) => {
      setCrossfadeEnabledState(enabled);
      crossfadeEnabledRef.current = enabled;
    });
  }, []);

  // Update refs when values change
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    originalPlaylistRef.current = originalPlaylist;
  }, [originalPlaylist]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    isShuffledRef.current = isShuffled;
  }, [isShuffled]);

  // Persist "where the listener is" so the session can be resumed on next launch
  const persistState = (positionMillis: number, track = currentTrackRef.current) => {
    if (!track) return;
    lastSaveRef.current = Date.now();
    savePlaybackState({
      trackId: track.id,
      queueIds: playlistRef.current.map((t) => t.id),
      originalQueueIds: originalPlaylistRef.current.map((t) => t.id),
      isShuffled: isShuffledRef.current,
      positionMillis: Math.max(0, Math.floor(positionMillis)),
    });
  };

  // Configure audio session for background playback on mount, then restore
  // the last session (paused at the saved position) if there is one.
  useEffect(() => {
    const init = async () => {
      await configureAudioSession();
      await restoreSession();
    };
    init();
  }, []);

  const restoreSession = async () => {
    try {
      const saved = await loadPlaybackState();
      if (!saved) return;
      const tracks = resolveTracks(saved.queueIds);
      if (tracks.length === 0) return;

      const savedIndex = tracks.findIndex((t) => t.id === saved.trackId);
      const index = savedIndex >= 0 ? savedIndex : 0;
      const positionMillis = savedIndex >= 0 ? saved.positionMillis : 0;
      const track = tracks[index];
      const original = resolveTracks(saved.originalQueueIds);

      setPlaylist(tracks);
      playlistRef.current = tracks;
      setOriginalPlaylist(original.length > 0 ? original : tracks);
      originalPlaylistRef.current = original.length > 0 ? original : tracks;
      setIsShuffled(saved.isShuffled);
      isShuffledRef.current = saved.isShuffled;
      setCurrentIndex(index);
      currentIndexRef.current = index;
      setCurrentTrack(track);
      currentTrackRef.current = track;

      const { sound } = await Audio.Sound.createAsync(
        { uri: track.cdn_url },
        { shouldPlay: false, positionMillis },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
    } catch (error) {
      console.error('Error restoring playback session:', error);
    }
  };

  const configureAudioSession = async () => {
    try {
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
        interruptionModeIOS: 0,
        interruptionModeAndroid: 1,
      });
      console.log('Audio session configured for background playback');
    } catch (error) {
      console.error('Error configuring audio session:', error);
    }
  };

  const hasNext = currentIndex < playlist.length - 1;
  const hasPrevious = currentIndex > 0;

  // Load favorites from storage
  useEffect(() => {
    loadFavorites();
  }, []);

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

  const configureAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 0,
        interruptionModeAndroid: 1,
      });
    } catch (error) {
      console.error('Error configuring audio:', error);
    }
  };

  const playTrack = async (track: Track, newPlaylist?: Track[]) => {
    try {
      setIsLoading(true);

      // Update playlist if provided
      if (newPlaylist && newPlaylist.length > 0) {
        setPlaylist(newPlaylist);
        setOriginalPlaylist(newPlaylist);
        playlistRef.current = newPlaylist;
        originalPlaylistRef.current = newPlaylist;
        setIsShuffled(false);
        isShuffledRef.current = false;
        const index = newPlaylist.findIndex(t => t.id === track.id);
        setCurrentIndex(index >= 0 ? index : 0);
        currentIndexRef.current = index >= 0 ? index : 0;
      }

      // Configure audio for background playback
      await configureAudio();

      // Fade in only when arriving via an automatic crossfade transition
      const fadeIn = pendingFadeInRef.current;
      pendingFadeInRef.current = false;
      cancelFade(false);

      // Unload previous sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      setCurrentTrack(track);
      currentTrackRef.current = track;
      setIsFavorite(favorites.has(track.id));

      // Create and load new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.cdn_url },
        { shouldPlay: true, volume: fadeIn ? 0 : 1 },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      if (fadeIn) {
        startFadeIn();
      }
      persistState(0, track);
      setIsLoading(false);
    } catch (error) {
      console.error('Error playing track:', error);
      setIsLoading(false);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPlaybackStatus({
        isPlaying: status.isPlaying,
        positionMillis: status.positionMillis || 0,
        durationMillis: status.durationMillis || 0,
        isLoaded: true,
      });

      // Periodically remember the position while playing
      if (status.isPlaying && Date.now() - lastSaveRef.current > SAVE_INTERVAL_MS) {
        persistState(status.positionMillis || 0);
      }

      // Start fading out when the track enters its last few seconds (and another track follows)
      const hasNextTrack = currentIndexRef.current < playlistRef.current.length - 1;
      if (
        crossfadeEnabledRef.current &&
        status.isPlaying &&
        fadeModeRef.current === null &&
        hasNextTrack &&
        status.durationMillis &&
        status.durationMillis - status.positionMillis <= CROSSFADE_MS
      ) {
        startFadeOut();
      }

      // Auto-play next track when current track finishes
      if (status.didJustFinish && !status.isLooping && !isAutoPlayingRef.current) {
        isAutoPlayingRef.current = true;
        const nextIdx = currentIndexRef.current + 1;
        if (nextIdx < playlistRef.current.length) {
          const nextTrack = playlistRef.current[nextIdx];
          // Carry the crossfade into the next track
          pendingFadeInRef.current = fadeModeRef.current === 'out' && crossfadeEnabledRef.current;
          cancelFade(false);
          setCurrentIndex(nextIdx);
          currentIndexRef.current = nextIdx;
          playTrack(nextTrack).finally(() => {
            isAutoPlayingRef.current = false;
          });
        } else {
          // Queue finished: next launch starts this track from the top
          cancelFade(false);
          persistState(0);
          isAutoPlayingRef.current = false;
        }
      }
    } else {
      setPlaybackStatus(prev => ({
        ...prev,
        isLoaded: false,
      }));
    }
  };

  const pauseTrack = async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.pauseAsync();
        if (status.isLoaded) {
          persistState(status.positionMillis);
        }
      }
    } catch (error) {
      console.error('Error pausing track:', error);
    }
  };

  const resumeTrack = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error resuming track:', error);
    }
  };

  const stopTrack = async () => {
    try {
      cancelFade(false);
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
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
  };

  const seekTo = async (positionMillis: number) => {
    try {
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(positionMillis);
      }
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  const toggleFavorite = () => {
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
  };

  const playNext = async () => {
    if (currentIndex < playlist.length - 1) {
      const nextTrack = playlist[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      currentIndexRef.current = currentIndex + 1;
      await playTrack(nextTrack);
    }
  };

  const playPrevious = async () => {
    if (currentIndex > 0) {
      const prevTrack = playlist[currentIndex - 1];
      setCurrentIndex(currentIndex - 1);
      currentIndexRef.current = currentIndex - 1;
      await playTrack(prevTrack);
    }
  };

  const shufflePlaylist = () => {
    if (isShuffled) {
      // Restore original order
      setPlaylist(originalPlaylist);
      playlistRef.current = originalPlaylist;
      if (currentTrack) {
        const newIndex = originalPlaylist.findIndex(t => t.id === currentTrack.id);
        setCurrentIndex(newIndex >= 0 ? newIndex : 0);
        currentIndexRef.current = newIndex >= 0 ? newIndex : 0;
      }
      setIsShuffled(false);
      isShuffledRef.current = false;
    } else {
      // Shuffle playlist keeping current track first
      const currentTrackItem = playlist[currentIndex];
      const otherTracks = playlist.filter((_, i) => i !== currentIndex);

      // Fisher-Yates shuffle
      for (let i = otherTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
      }

      const shuffled = currentTrackItem ? [currentTrackItem, ...otherTracks] : otherTracks;
      setPlaylist(shuffled);
      playlistRef.current = shuffled;
      setCurrentIndex(0);
      currentIndexRef.current = 0;
      setIsShuffled(true);
      isShuffledRef.current = true;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelFade(false);
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

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
        playNext,
        playPrevious,
        shufflePlaylist,
        hasNext,
        hasPrevious,
        crossfadeEnabled,
        setCrossfadeEnabled,
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
