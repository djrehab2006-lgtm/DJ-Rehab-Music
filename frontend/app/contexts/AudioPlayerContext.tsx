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

      // Handle track end - automatically play next track
      if (status.didJustFinish && !status.isLooping) {
        // Prevent multiple auto-play triggers
        if (isAutoPlayingRef.current) {
          return;
        }
        
        isAutoPlayingRef.current = true;
        setPlaybackStatus(prev => ({ ...prev, isPlaying: false }));
        
        // Check if there's a next track using refs
        const nextIndex = currentIndexRef.current + 1;
        if (nextIndex < playlistRef.current.length) {
          const nextTrack = playlistRef.current[nextIndex];
          setTimeout(() => {
            playTrack(nextTrack).finally(() => {
              isAutoPlayingRef.current = false;
            });
          }, 300);
        } else {
          isAutoPlayingRef.current = false;
        }
      }
    } else if (status.error) {
      // Handle playback errors
      console.error('Playback error:', status.error);
      
      // Try to recover by playing next track
      if (!isAutoPlayingRef.current) {
        isAutoPlayingRef.current = true;
        const nextIndex = currentIndexRef.current + 1;
        if (nextIndex < playlistRef.current.length) {
          const nextTrack = playlistRef.current[nextIndex];
          setTimeout(() => {
            playTrack(nextTrack).finally(() => {
              isAutoPlayingRef.current = false;
            });
          }, 500);
        } else {
          isAutoPlayingRef.current = false;
        }
      }
    }
  };

  const playTrack = async (track: Track, newPlaylist?: Track[], retryCount = 0) => {
    // Prevent multiple simultaneous play requests
    if (isLoading && retryCount === 0) {
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
        setOriginalPlaylist(newPlaylist); // Store original order
        setIsShuffled(false); // Reset shuffle state when new playlist loaded
        const index = newPlaylist.findIndex(t => t.id === track.id);
        setCurrentIndex(index);
      } else if (playlist.length > 0) {
        // Update index in existing playlist
        const index = playlist.findIndex(t => t.id === track.id);
        setCurrentIndex(index >= 0 ? index : -1);
      }

      // Create and load new sound with better error handling
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.cdn_url },
        { 
          shouldPlay: true,
          progressUpdateIntervalMillis: 1000,
          // Add buffer options for smoother playback
        },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setCurrentTrack(track);
      
      // Check if track is in favorites
      const isFav = favorites.has(track.id);
      setIsFavorite(isFav);
      
      setPlaybackStatus(prev => ({ ...prev, isPlaying: true, isLoaded: true }));
    } catch (error) {
      console.error('Error playing track:', error);
      
      // Retry logic - try up to 2 times
      if (retryCount < 2) {
        console.log(`Retrying playback (attempt ${retryCount + 1})...`);
        setTimeout(() => {
          playTrack(track, undefined, retryCount + 1);
        }, 1000);
      } else {
        // If retries fail, try to skip to next track
        console.log('Failed to play track after retries, skipping to next...');
        const nextIndex = currentIndexRef.current + 1;
        if (nextIndex < playlistRef.current.length) {
          const nextTrack = playlistRef.current[nextIndex];
          setTimeout(() => {
            playTrack(nextTrack);
          }, 500);
        }
      }
    } finally {
      if (retryCount === 0 || retryCount >= 2) {
        setIsLoading(false);
      }
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

  const shufflePlaylist = () => {
    if (playlist.length > 0) {
      if (isShuffled) {
        // Unshuffle - restore original order
        setPlaylist(originalPlaylist);
        setIsShuffled(false);
        // Update current index in original playlist
        if (currentTrack) {
          const newIndex = originalPlaylist.findIndex(t => t.id === currentTrack.id);
          setCurrentIndex(newIndex);
        }
      } else {
        // Shuffle - randomize order
        const shuffled = [...playlist];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setPlaylist(shuffled);
        setIsShuffled(true);
        // Update current index in shuffled playlist
        if (currentTrack) {
          const newIndex = shuffled.findIndex(t => t.id === currentTrack.id);
          setCurrentIndex(newIndex);
        }
      }
    }
  };

  const value: AudioPlayerContextType = {
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
