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
  playTrack: (track: Track, playlist?: Track[]) => Promise<void>;
  pauseTrack: () => Promise<void>;
  resumeTrack: () => Promise<void>;
  stopTrack: () => Promise<void>;
  seekTo: (positionMillis: number) => Promise<void>;
  toggleFavorite: () => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  hasNext: boolean;
  hasPrevious: boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
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

  const hasNext = currentIndex < playlist.length - 1;
  const hasPrevious = currentIndex > 0;

  // Load favorites from AsyncStorage on mount
  useEffect(() => {
    loadFavorites();
  }, []);

  // Configure audio mode on mount
  useEffect(() => {
    configureAudio();
    return () => {
      // Cleanup on unmount
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const loadFavorites = async () => {
    try {
      const favoritesJson = await AsyncStorage.getItem('favorite_tracks');
      if (favoritesJson) {
        const favoriteIds: string[] = JSON.parse(favoritesJson);
        setFavorites(new Set(favoriteIds));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const configureAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
    } catch (error) {
      console.error('Error configuring audio:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPlaybackStatus({
        isPlaying: status.isPlaying || false,
        positionMillis: status.positionMillis || 0,
        durationMillis: status.durationMillis || 0,
        isLoaded: true,
      });

      // Handle track end
      if (status.didJustFinish && !status.isLooping) {
        setPlaybackStatus(prev => ({ ...prev, isPlaying: false }));
      }
    }
  };

  const playTrack = async (track: Track, newPlaylist?: Track[]) => {
    // Prevent multiple simultaneous play requests
    if (isLoading) {
      console.log('Already loading a track, ignoring request');
      return;
    }

    try {
      setIsLoading(true);

      // Stop and unload previous track properly
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch (e) {
          console.log('Error stopping previous track:', e);
        }
        soundRef.current = null;
      }

      // Small delay to ensure previous track is fully stopped
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update playlist if provided
      if (newPlaylist && newPlaylist.length > 0) {
        setPlaylist(newPlaylist);
        const index = newPlaylist.findIndex(t => t.id === track.id);
        setCurrentIndex(index);
      } else if (playlist.length > 0) {
        // Update index in existing playlist
        const index = playlist.findIndex(t => t.id === track.id);
        setCurrentIndex(index >= 0 ? index : -1);
      }

      // Create and load new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.cdn_url },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setCurrentTrack(track);
      setIsFavorite(favorites.has(track.id));

    } catch (error) {
      console.error('Error playing track:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playNext = async () => {
    if (hasNext && playlist.length > 0) {
      const nextTrack = playlist[currentIndex + 1];
      await playTrack(nextTrack);
    }
  };

  const playPrevious = async () => {
    if (hasPrevious && playlist.length > 0) {
      const previousTrack = playlist[currentIndex - 1];
      await playTrack(previousTrack);
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

  const toggleFavorite = async () => {
    if (currentTrack) {
      const newFavorites = new Set(favorites);
      if (favorites.has(currentTrack.id)) {
        newFavorites.delete(currentTrack.id);
      } else {
        newFavorites.add(currentTrack.id);
      }
      setFavorites(newFavorites);
      setIsFavorite(!isFavorite);
      
      // Persist to AsyncStorage
      try {
        const favoriteIds = Array.from(newFavorites);
        await AsyncStorage.setItem('favorite_tracks', JSON.stringify(favoriteIds));
      } catch (error) {
        console.error('Error saving favorites:', error);
      }
    }
  };

  const value: AudioPlayerContextType = {
    currentTrack,
    playbackStatus,
    isLoading,
    isFavorite,
    playTrack,
    pauseTrack,
    resumeTrack,
    stopTrack,
    seekTo,
    toggleFavorite,
    playNext,
    playPrevious,
    hasNext,
    hasPrevious,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}
