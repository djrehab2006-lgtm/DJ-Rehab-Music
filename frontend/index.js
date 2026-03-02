import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import { Platform } from 'react-native';
import App from './App';

// Register the playback service for native platforms
if (Platform.OS !== 'web') {
  TrackPlayer.registerPlaybackService(() => require('./service'));
}

registerRootComponent(App);
