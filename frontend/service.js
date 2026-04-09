// Playback service for Android lock screen / notification controls
// Using require() for consistent module loading
const TrackPlayer = require('react-native-track-player').default;
const { Event } = require('react-native-track-player');

module.exports = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.log('Remote Play pressed');
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    console.log('Remote Pause pressed');
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    console.log('Remote Next pressed');
    TrackPlayer.skipToNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    console.log('Remote Previous pressed');
    TrackPlayer.skipToPrevious();
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    console.log('Remote Seek to', event.position);
    TrackPlayer.seekTo(event.position);
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    console.log('Remote Stop pressed');
    TrackPlayer.stop();
  });
};
