import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Update refs when values change
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  // Configure audio session for background playback on mount
  useEffect(() => {
    configureAudioSession();
  }, []);

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
        const index = newPlaylist.findIndex(t => t.id === track.id);
        setCurrentIndex(index >= 0 ? index : 0);
        currentIndexRef.current = index >= 0 ? index : 0;
      }

      // Configure audio for background playback
      await configureAudio();

      // Unload previous sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      setCurrentTrack(track);
      setIsFavorite(favorites.has(track.id));

      // Create and load new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.cdn_url },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
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

      // Auto-play next track when current track finishes
      if (status.didJustFinish && !status.isLooping && !isAutoPlayingRef.current) {
        isAutoPlayingRef.current = true;
        const nextIdx = currentIndexRef.current + 1;
        if (nextIdx < playlistRef.current.length) {
          const nextTrack = playlistRef.current[nextIdx];
          setCurrentIndex(nextIdx);
          currentIndexRef.current = nextIdx;
          playTrack(nextTrack).finally(() => {
            isAutoPlayingRef.current = false;
          });
        } else {
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
        await soundRef.current.pauseAsync();
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
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setCurrentTrack(null);
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
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
