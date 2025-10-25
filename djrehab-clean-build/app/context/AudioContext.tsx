import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Track {
  id: string;
  title: string;
  artist: string;
  cdn_url: string;
  duration: number;
  cover_art?: string;
}

interface AudioContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  isFavorite: boolean;
  playTrack: (track: Track) => Promise<void>;
  pauseTrack: () => Promise<void>;
  resumeTrack: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  toggleFavorite: () => Promise<void>;
  favorites: string[];
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const soundRef = useRef<Sound | null>(null);

  useEffect(() => {
    setupAudio();
    loadFavorites();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const setupAudio = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  };

  const loadFavorites = async () => {
    try {
      const saved = await AsyncStorage.getItem('favorites');
      if (saved) {
        setFavorites(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  const saveFavorites = async (newFavorites: string[]) => {
    try {
      await AsyncStorage.setItem('favorites', JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const playTrack = async (track: Track) => {
    try {
      // Stop and unload previous track
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Load and play new track
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.cdn_url },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setCurrentTrack(track);
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to play track:', error);
    }
  };

  const pauseTrack = async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    }
  };

  const resumeTrack = async () => {
    if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  const seekTo = async (newPosition: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(newPosition * 1000);
    }
  };

  const toggleFavorite = async () => {
    if (!currentTrack) return;

    const isFav = favorites.includes(currentTrack.id);
    let newFavorites: string[];

    if (isFav) {
      newFavorites = favorites.filter(id => id !== currentTrack.id);
    } else {
      newFavorites = [...favorites, currentTrack.id];
    }

    await saveFavorites(newFavorites);
  };

  const isFavorite = currentTrack ? favorites.includes(currentTrack.id) : false;

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        isPlaying,
        position,
        duration,
        isFavorite,
        playTrack,
        pauseTrack,
        resumeTrack,
        seekTo,
        toggleFavorite,
        favorites,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
}
