// Native entry point for Android
// CRITICAL: All require() calls - no import statements - to prevent hoisting
const TrackPlayer = require('react-native-track-player').default;
const { Event } = require('react-native-track-player');

// Register playback service with inline handler
// This ensures the service function is directly available, no module resolution issues
TrackPlayer.registerPlaybackService(() => {
  return async function () {
    TrackPlayer.addEventListener(Event.RemotePlay, () => {
      TrackPlayer.play();
    });

    TrackPlayer.addEventListener(Event.RemotePause, () => {
      TrackPlayer.pause();
    });

    TrackPlayer.addEventListener(Event.RemoteNext, () => {
      TrackPlayer.skipToNext();
    });

    TrackPlayer.addEventListener(Event.RemotePrevious, () => {
      TrackPlayer.skipToPrevious();
    });

    TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
      TrackPlayer.seekTo(event.position);
    });

    TrackPlayer.addEventListener(Event.RemoteStop, () => {
      TrackPlayer.stop();
    });
  };
});

// Load expo-router AFTER service is registered
require('expo-router/entry');
