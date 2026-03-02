import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import TrackPlayer, {
  Capability,
  State,
  Event,
  usePlaybackState,
  useProgress,
  useTrackPlayerEvents,
  AppKilledPlaybackBehavior,
  RepeatMode,
} from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface Track {
  id: string;
  title: string;
  artist: string;
  cdn_url: string;
  cover_art?: string;
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
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

// Check if we're on web
const isWeb = Platform.OS === 'web';

// Setup Track Player - call once when app starts
let isSetup = false;

async function setupPlayer() {
  if (isSetup || isWeb) return;
  
  try {
    await TrackPlayer.setupPlayer({
      autoHandleInterruptions: true,
    });
    
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.Stop,
        Capability.SeekTo,
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

    await TrackPlayer.setRepeatMode(RepeatMode.Off);
    isSetup = true;
    console.log('Track Player setup complete');
  } catch (error) {
    console.error('Error setting up Track Player:', error);
  }
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [originalPlaylist, setOriginalPlaylist] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>({
    isPlaying: false,
    positionMillis: 0,
    durationMillis: 0,
    isLoaded: false,
  });

  const playlistRef = useRef(playlist);
  const currentIndexRef = useRef(currentIndex);

  // Web fallback using Audio element
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const webIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update refs
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Setup player on mount
  useEffect(() => {
    if (!isWeb) {
      setupPlayer();
    }
    loadFavorites();
    
    return () => {
      if (webIntervalRef.current) {
        clearInterval(webIntervalRef.current);
      }
    };
  }, []);

  // Use Track Player hooks for native platforms
  const playerState = isWeb ? null : usePlaybackState();
  const progress = isWeb ? { position: 0, duration: 0 } : useProgress();

  // Update playback status from Track Player
  useEffect(() => {
    if (!isWeb && playerState) {
      const isPlaying = playerState.state === State.Playing;
      setPlaybackStatus(prev => ({
        ...prev,
        isPlaying,
        positionMillis: progress.position * 1000,
        durationMillis: progress.duration * 1000,
        isLoaded: playerState.state !== State.None,
      }));
    }
  }, [playerState, progress]);

  // Listen for track ended event to auto-play next
  useTrackPlayerEvents([Event.PlaybackQueueEnded], async (event) => {
    if (event.type === Event.PlaybackQueueEnded) {
      // Auto-play next track
      const nextIdx = currentIndexRef.current + 1;
      if (nextIdx < playlistRef.current.length) {
        const nextTrack = playlistRef.current[nextIdx];
        await playTrackInternal(nextTrack, nextIdx);
      }
    }
  });

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

  const hasNext = currentIndex < playlist.length - 1;
  const hasPrevious = currentIndex > 0;

  // Web audio player setup
  const setupWebAudio = useCallback((track: Track) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    const audio = new Audio(track.cdn_url);
    audioRef.current = audio;
    
    audio.onloadedmetadata = () => {
      setPlaybackStatus(prev => ({
        ...prev,
        durationMillis: audio.duration * 1000,
        isLoaded: true,
      }));
    };
    
    audio.onended = () => {
      const nextIdx = currentIndexRef.current + 1;
      if (nextIdx < playlistRef.current.length) {
        const nextTrack = playlistRef.current[nextIdx];
        playTrackInternal(nextTrack, nextIdx);
      }
    };
    
    // Update progress for web
    if (webIntervalRef.current) {
      clearInterval(webIntervalRef.current);
    }
    webIntervalRef.current = setInterval(() => {
      if (audioRef.current) {
        setPlaybackStatus(prev => ({
          ...prev,
          positionMillis: audioRef.current!.currentTime * 1000,
          isPlaying: !audioRef.current!.paused,
        }));
      }
    }, 500);
    
    return audio;
  }, []);

  const playTrackInternal = async (track: Track, index: number) => {
    setIsLoading(true);
    setCurrentTrack(track);
    setCurrentIndex(index);
    setIsFavorite(favorites.has(track.id));

    try {
      if (isWeb) {
        // Web implementation
        const audio = setupWebAudio(track);
        await audio.play();
        setPlaybackStatus(prev => ({ ...prev, isPlaying: true }));
      } else {
        // Native implementation with Track Player
        await TrackPlayer.reset();
        await TrackPlayer.add({
          id: track.id,
          url: track.cdn_url,
          title: track.title,
          artist: track.artist,
          artwork: track.cover_art || undefined,
        });
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('Error playing track:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playTrack = async (track: Track, newPlaylist?: Track[]) => {
    if (newPlaylist && newPlaylist.length > 0) {
      setPlaylist(newPlaylist);
      setOriginalPlaylist(newPlaylist);
      playlistRef.current = newPlaylist;
      const index = newPlaylist.findIndex(t => t.id === track.id);
      await playTrackInternal(track, index >= 0 ? index : 0);
    } else {
      await playTrackInternal(track, 0);
    }
  };

  const pauseTrack = async () => {
    try {
      if (isWeb) {
        audioRef.current?.pause();
        setPlaybackStatus(prev => ({ ...prev, isPlaying: false }));
      } else {
        await TrackPlayer.pause();
      }
    } catch (error) {
      console.error('Error pausing:', error);
    }
  };

  const resumeTrack = async () => {
    try {
      if (isWeb) {
        await audioRef.current?.play();
        setPlaybackStatus(prev => ({ ...prev, isPlaying: true }));
      } else {
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('Error resuming:', error);
    }
  };

  const stopTrack = async () => {
    try {
      if (isWeb) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      } else {
        await TrackPlayer.stop();
        await TrackPlayer.reset();
      }
      setCurrentTrack(null);
      setPlaybackStatus({
        isPlaying: false,
        positionMillis: 0,
        durationMillis: 0,
        isLoaded: false,
      });
    } catch (error) {
      console.error('Error stopping:', error);
    }
  };

  const seekTo = async (positionMillis: number) => {
    try {
      if (isWeb) {
        if (audioRef.current) {
          audioRef.current.currentTime = positionMillis / 1000;
        }
      } else {
        await TrackPlayer.seekTo(positionMillis / 1000);
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
      await playTrackInternal(nextTrack, currentIndex + 1);
    }
  };

  const playPrevious = async () => {
    if (currentIndex > 0) {
      const prevTrack = playlist[currentIndex - 1];
      await playTrackInternal(prevTrack, currentIndex - 1);
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
    } else {
      // Shuffle playlist keeping current track first
      const currentTrackItem = playlist[currentIndex];
      const otherTracks = playlist.filter((_, i) => i !== currentIndex);
      
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
