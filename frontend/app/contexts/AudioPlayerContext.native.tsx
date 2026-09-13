import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import TrackPlayer, {
  State,
  Capability,
  AppKilledPlaybackBehavior,
  Event,
  RepeatMode,
} from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  savePlaybackState,
  loadPlaybackState,
  clearPlaybackState,
  resolveTracks,
  SAVE_INTERVAL_MS,
} from '../utils/playbackStateStorage';

// Local track art used for lock screen / notification artwork
const TRACK_ARTWORK = require('../../assets/track-icon.png');

interface Track {
  id: string;
  title: string;
  artist: string;
  cdn_url: string;
  cover_art?: string | null;
  folder_id?: string;
}

const toRntpTrack = (t: Track) => ({
  id: t.id,
  url: t.cdn_url,
  title: t.title,
  artist: t.artist,
  artwork: t.cover_art || TRACK_ARTWORK,
});

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
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

let isPlayerSetup = false;

async function setupPlayer() {
  if (isPlayerSetup) return;

  let playerAlreadyInitialized = false;
  try {
    // Check if player is already initialized (e.g., from a previous session)
    await TrackPlayer.getActiveTrack();
    playerAlreadyInitialized = true;
  } catch {
    // Player not initialized, need full setup
  }

  try {
    if (!playerAlreadyInitialized) {
      await TrackPlayer.setupPlayer({
        autoHandleInterruptions: true,
      });
    }

    // ALWAYS update options to ensure lock screen controls are configured
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.Stop,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
    });

    // Don't repeat - when queue ends, it stops
    await TrackPlayer.setRepeatMode(RepeatMode.Off);

    isPlayerSetup = true;
    console.log('TrackPlayer setup complete');
  } catch (error) {
    console.error('Error setting up TrackPlayer:', error);
  }
}

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
  const [playerReady, setPlayerReady] = useState(false);

  const currentIndexRef = useRef(currentIndex);
  const playlistRef = useRef(playlist);
  const originalPlaylistRef = useRef(originalPlaylist);
  const currentTrackRef = useRef(currentTrack);
  const isShuffledRef = useRef(isShuffled);
  const lastSaveRef = useRef(0);
  const isRestoringRef = useRef(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const hasNext = currentIndex < playlist.length - 1;
  const hasPrevious = currentIndex > 0;

  // Persist "where the listener is" so the session can be resumed on next launch
  const persistState = useCallback((positionMillis: number, track = currentTrackRef.current) => {
    if (!track || isRestoringRef.current) return;
    lastSaveRef.current = Date.now();
    savePlaybackState({
      trackId: track.id,
      queueIds: playlistRef.current.map((t) => t.id),
      originalQueueIds: originalPlaylistRef.current.map((t) => t.id),
      isShuffled: isShuffledRef.current,
      positionMillis: Math.max(0, Math.floor(positionMillis)),
    });
  }, []);

  const applyQueueState = (tracks: Track[], original: Track[], shuffled: boolean, index: number) => {
    setPlaylist(tracks);
    playlistRef.current = tracks;
    const orig = original.length > 0 ? original : tracks;
    setOriginalPlaylist(orig);
    originalPlaylistRef.current = orig;
    setIsShuffled(shuffled);
    isShuffledRef.current = shuffled;
    setCurrentIndex(index);
    currentIndexRef.current = index;
    setCurrentTrack(tracks[index]);
    currentTrackRef.current = tracks[index];
  };

  // Restore the previous listening session: either sync with a still-running
  // native queue (app was swiped away while music kept playing) or rebuild the
  // last queue from storage, paused at the saved position.
  const restoreSession = async () => {
    isRestoringRef.current = true;
    try {
      const saved = await loadPlaybackState();
      const liveQueue = await TrackPlayer.getQueue();

      if (liveQueue.length > 0) {
        const tracks: Track[] = liveQueue.map((t) => ({
          id: String(t.id),
          title: t.title ?? '',
          artist: t.artist ?? '',
          cdn_url: String(t.url),
          cover_art: null,
        }));
        const activeIndex = (await TrackPlayer.getActiveTrackIndex()) ?? 0;
        const original = saved?.isShuffled ? resolveTracks(saved.originalQueueIds) : tracks;
        applyQueueState(tracks, original, saved?.isShuffled ?? false, activeIndex);
        return;
      }

      if (!saved) return;
      const tracks = resolveTracks(saved.queueIds);
      if (tracks.length === 0) return;

      const savedIndex = tracks.findIndex((t) => t.id === saved.trackId);
      const index = savedIndex >= 0 ? savedIndex : 0;
      const positionSec = savedIndex >= 0 ? saved.positionMillis / 1000 : 0;

      applyQueueState(tracks, resolveTracks(saved.originalQueueIds), saved.isShuffled, index);

      await TrackPlayer.add(tracks.map(toRntpTrack));
      await TrackPlayer.skip(index, positionSec);
      // Some players ignore the initial position until the item is prepared
      if (positionSec > 0) {
        await TrackPlayer.seekTo(positionSec);
      }
    } catch (error) {
      console.error('Error restoring playback session:', error);
    } finally {
      isRestoringRef.current = false;
    }
  };

  // Initialize player on mount
  useEffect(() => {
    const init = async () => {
      await setupPlayer();
      await restoreSession();
      setPlayerReady(true);
    };
    init();

    return () => {
      // Cleanup progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Start progress polling when player is ready
  useEffect(() => {
    if (!playerReady) return;

    // Poll progress every 500ms for smooth slider updates
    progressIntervalRef.current = setInterval(async () => {
      try {
        const state = await TrackPlayer.getPlaybackState();
        const progress = await TrackPlayer.getProgress();
        const positionMillis = Math.floor(progress.position * 1000);

        setPlaybackStatus({
          isPlaying: state.state === State.Playing,
          positionMillis,
          durationMillis: Math.floor(progress.duration * 1000),
          isLoaded: state.state !== State.None && state.state !== undefined,
        });

        // Periodically remember the position while playing
        if (state.state === State.Playing && Date.now() - lastSaveRef.current > SAVE_INTERVAL_MS) {
          persistState(positionMillis);
        }
      } catch {
        // Player might not be ready yet
      }
    }, 500);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [playerReady]);

  // Listen for track changes (auto-advance)
  useEffect(() => {
    if (!playerReady) return;

    const trackChangedListener = TrackPlayer.addEventListener(
      Event.PlaybackActiveTrackChanged,
      async (event) => {
        if (event.track) {
          // Find the track in our playlist
          const trackId = event.track.id;
          const idx = playlistRef.current.findIndex((t) => t.id === trackId);
          if (idx >= 0) {
            setCurrentTrack(playlistRef.current[idx]);
            currentTrackRef.current = playlistRef.current[idx];
            setCurrentIndex(idx);
            currentIndexRef.current = idx;
            setIsFavorite(favorites.has(trackId));
            // Remember the new track right away (auto-advance / skip)
            try {
              const progress = await TrackPlayer.getProgress();
              persistState(progress.position * 1000, playlistRef.current[idx]);
            } catch {
              persistState(0, playlistRef.current[idx]);
            }
          }
        } else {
          // No active track
          setPlaybackStatus((prev) => ({
            ...prev,
            isPlaying: false,
          }));
        }
      }
    );

    const stateChangedListener = TrackPlayer.addEventListener(
      Event.PlaybackState,
      async (event) => {
        const isPlaying = event.state === State.Playing;
        setPlaybackStatus((prev) => ({
          ...prev,
          isPlaying,
          isLoaded: event.state !== State.None,
        }));

        if (event.state === State.Ready || event.state === State.Playing) {
          setIsLoading(false);
        }

        // Save the exact position whenever playback pauses
        if (event.state === State.Paused) {
          try {
            const progress = await TrackPlayer.getProgress();
            persistState(progress.position * 1000);
          } catch {
            // ignore
          }
        }
      }
    );

    // When the queue finishes, next launch should start the last track from the top
    const queueEndedListener = TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
      persistState(0);
    });

    return () => {
      trackChangedListener.remove();
      stateChangedListener.remove();
      queueEndedListener.remove();
    };
  }, [playerReady, favorites, persistState]);

  // Load favorites from storage
  useEffect(() => {
    loadFavorites();
  }, []);

  // Save the exact position when the app goes to the background
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'background' && state !== 'inactive') return;
      try {
        const progress = await TrackPlayer.getProgress();
        persistState(progress.position * 1000);
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

  const playTrack = useCallback(async (track: Track, newPlaylist?: Track[]) => {
    try {
      setIsLoading(true);

      if (!isPlayerSetup) {
        await setupPlayer();
      }

      // Update playlist if provided
      let activePlaylist = playlistRef.current;
      if (newPlaylist && newPlaylist.length > 0) {
        setPlaylist(newPlaylist);
        setOriginalPlaylist(newPlaylist);
        playlistRef.current = newPlaylist;
        originalPlaylistRef.current = newPlaylist;
        setIsShuffled(false);
        isShuffledRef.current = false;
        activePlaylist = newPlaylist;
        const index = newPlaylist.findIndex((t) => t.id === track.id);
        setCurrentIndex(index >= 0 ? index : 0);
        currentIndexRef.current = index >= 0 ? index : 0;
      }

      setCurrentTrack(track);
      currentTrackRef.current = track;
      setIsFavorite(favorites.has(track.id));

      // Reset the queue and add all tracks
      await TrackPlayer.reset();

      await TrackPlayer.add(activePlaylist.map(toRntpTrack));

      // Skip to the selected track
      const trackIndex = activePlaylist.findIndex((t) => t.id === track.id);
      if (trackIndex > 0) {
        await TrackPlayer.skip(trackIndex);
      }

      await TrackPlayer.play();
      persistState(0, track);
      setIsLoading(false);
    } catch (error) {
      console.error('Error playing track:', error);
      setIsLoading(false);
    }
  }, [favorites, persistState]);

  const pauseTrack = useCallback(async () => {
    try {
      await TrackPlayer.pause();
    } catch (error) {
      console.error('Error pausing track:', error);
    }
  }, []);

  const resumeTrack = useCallback(async () => {
    try {
      await TrackPlayer.play();
    } catch (error) {
      console.error('Error resuming track:', error);
    }
  }, []);

  const stopTrack = useCallback(async () => {
    try {
      await TrackPlayer.reset();
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
    try {
      await TrackPlayer.seekTo(positionMillis / 1000); // Convert ms to seconds
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

  const playNext = useCallback(async () => {
    try {
      if (currentIndex < playlist.length - 1) {
        await TrackPlayer.skipToNext();
        // The track change listener will update currentTrack and currentIndex
      }
    } catch (error) {
      console.error('Error playing next:', error);
    }
  }, [currentIndex, playlist.length]);

  const playPrevious = useCallback(async () => {
    try {
      if (currentIndex > 0) {
        await TrackPlayer.skipToPrevious();
        // The track change listener will update currentTrack and currentIndex
      }
    } catch (error) {
      console.error('Error playing previous:', error);
    }
  }, [currentIndex]);

  const shufflePlaylist = useCallback(() => {
    if (isShuffled) {
      // Restore original order
      setPlaylist(originalPlaylist);
      playlistRef.current = originalPlaylist;
      if (currentTrack) {
        const newIndex = originalPlaylist.findIndex((t) => t.id === currentTrack.id);
        setCurrentIndex(newIndex >= 0 ? newIndex : 0);
        currentIndexRef.current = newIndex >= 0 ? newIndex : 0;
      }
      setIsShuffled(false);
      isShuffledRef.current = false;

      // Rebuild queue with original order (keeping current track playing)
      rebuildQueue(originalPlaylist, currentTrack);
    } else {
      // Shuffle playlist keeping current track first
      const currentTrackItem = playlist[currentIndex];
      const otherTracks = playlist.filter((_, i) => i !== currentIndex);

      // Fisher-Yates shuffle
      for (let i = otherTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
      }

      const shuffled = currentTrackItem
        ? [currentTrackItem, ...otherTracks]
        : otherTracks;
      setPlaylist(shuffled);
      playlistRef.current = shuffled;
      setCurrentIndex(0);
      currentIndexRef.current = 0;
      setIsShuffled(true);
      isShuffledRef.current = true;

      // Rebuild queue with shuffled order (keeping current track playing)
      rebuildQueue(shuffled, currentTrackItem || null);
    }
  }, [isShuffled, playlist, currentIndex, currentTrack, originalPlaylist]);

  const rebuildQueue = async (newPlaylist: Track[], keepPlaying: Track | null) => {
    try {
      // Get current progress
      const progress = await TrackPlayer.getProgress();
      const playbackState = await TrackPlayer.getPlaybackState();
      const wasPlaying = playbackState.state === State.Playing;

      // Reset and rebuild queue
      await TrackPlayer.reset();

      await TrackPlayer.add(newPlaylist.map(toRntpTrack));

      // Skip to the currently playing track
      if (keepPlaying) {
        const idx = newPlaylist.findIndex((t) => t.id === keepPlaying.id);
        if (idx > 0) {
          await TrackPlayer.skip(idx);
        }
        // Restore position
        await TrackPlayer.seekTo(progress.position);
      }

      // Resume playback if it was playing
      if (wasPlaying) {
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('Error rebuilding queue:', error);
    }
  };

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
