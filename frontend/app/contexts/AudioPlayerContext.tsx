import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  usePlayerStore,
  initAudioEngine,
  playTrack,
  pauseTrack,
  resumeTrack,
  stopTrack,
  seekTo,
  playNext,
  playPrevious,
  shufflePlaylist,
  setCrossfadeEnabled,
  refreshLockScreen,
  getLockScreenReport,
  type Track,
  type PlaybackStatus,
} from '../utils/audioEngine';
import { logDiag } from '../utils/diagnosticsLog';

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

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const { currentTrack, playlist, currentIndex, isShuffled, playbackStatus, isLoading, crossfadeEnabled } =
    usePlayerStore();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // The audio engine lives outside React (utils/audioEngine): it is started once and keeps running
  // when Android closes this screen in the background, so nothing is torn down on unmount.
  useEffect(() => {
    initAudioEngine();
    logDiag('screen opened');
    return () => logDiag('screen closed by the system, music keeps playing');
  }, []);

  // Load favorites from storage
  useEffect(() => {
    AsyncStorage.getItem('favorites')
      .then((stored) => {
        if (stored) setFavorites(new Set(JSON.parse(stored)));
      })
      .catch((error) => console.error('Error loading favorites:', error));
  }, []);

  const saveFavorites = (newFavorites: Set<string>) => {
    setFavorites(newFavorites);
    AsyncStorage.setItem('favorites', JSON.stringify([...newFavorites])).catch((error) =>
      console.error('Error saving favorites:', error)
    );
  };

  const toggleFavorite = useCallback(() => {
    if (!currentTrack) return;
    const newFavorites = new Set(favorites);
    if (!newFavorites.delete(currentTrack.id)) {
      newFavorites.add(currentTrack.id);
    }
    saveFavorites(newFavorites);
  }, [currentTrack, favorites]);

  const removeFavorite = useCallback((trackId: string) => {
    const newFavorites = new Set(favorites);
    newFavorites.delete(trackId);
    saveFavorites(newFavorites);
  }, [favorites]);

  const isFavorite = !!currentTrack && favorites.has(currentTrack.id);
  const hasNext = currentIndex < playlist.length - 1;
  const hasPrevious = currentIndex > 0;

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
