// Native entry point - register track player service before expo-router loads
import TrackPlayer from 'react-native-track-player';

TrackPlayer.registerPlaybackService(() => require('./service'));

// Then load expo-router
import 'expo-router/entry';
