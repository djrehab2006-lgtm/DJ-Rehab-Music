// Native entry point - register track player service BEFORE expo-router loads
// IMPORTANT: Using require() instead of import to prevent hoisting
// import statements get hoisted to the top, but require() runs in order
const TrackPlayer = require('react-native-track-player').default;

TrackPlayer.registerPlaybackService(() => require('./service'));

// Now load expo-router AFTER service is registered
require('expo-router/entry');
