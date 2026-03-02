import React from 'react';
import { View, Platform } from 'react-native';
import { Slot } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { MiniPlayer } from './components/MiniPlayer';
import TrackPlayer from 'react-native-track-player';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Register playback service for native platforms
if (Platform.OS !== 'web') {
  TrackPlayer.registerPlaybackService(() => require('../service'));
}

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen after a short delay
    setTimeout(() => {
      SplashScreen.hideAsync();
    }, 1000);
  }, []);

  return (
    <AudioPlayerProvider>
      <View style={{ flex: 1 }}>
        <Slot />
        <MiniPlayer />
      </View>
    </AudioPlayerProvider>
  );
}
