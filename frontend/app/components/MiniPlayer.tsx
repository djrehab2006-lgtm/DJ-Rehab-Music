import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';

export function MiniPlayer() {
  const {
    currentTrack,
    playbackStatus,
    isLoading,
    isFavorite,
    pauseTrack,
    resumeTrack,
    seekTo,
    toggleFavorite,
    playNext,
    playPrevious,
    hasNext,
    hasPrevious,
  } = useAudioPlayer();

  const [slideValue, setSlideValue] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const slideAnimation = useState(new Animated.Value(0))[0];

  // Show/hide animation
  useEffect(() => {
    Animated.timing(slideAnimation, {
      toValue: currentTrack ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [currentTrack]);

  // Update slider value when playback position changes
  useEffect(() => {
    if (!isSeeking && playbackStatus.durationMillis > 0) {
      setSlideValue(playbackStatus.positionMillis);
    }
  }, [playbackStatus.positionMillis, isSeeking]);

  if (!currentTrack) {
    return null;
  }

  const formatTime = (millis: number): string => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    if (playbackStatus.isPlaying) {
      await pauseTrack();
    } else {
      await resumeTrack();
    }
  };

  const handleSlidingStart = () => {
    setIsSeeking(true);
  };

  const handleSlidingComplete = async (value: number) => {
    setIsSeeking(false);
    await seekTo(value);
  };

  const translateY = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={playbackStatus.durationMillis || 1}
          value={slideValue}
          onValueChange={setSlideValue}
          onSlidingStart={handleSlidingStart}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor="#10B981"
          maximumTrackTintColor="#334155"
          thumbTintColor="#10B981"
        />
      </View>

      {/* Player Content */}
      <View style={styles.content}>
        {/* Track Info */}
        <View style={styles.trackInfo}>
          <View style={styles.trackIcon}>
            <Ionicons name="musical-note" size={20} color="#10B981" />
          </View>
          <View style={styles.trackDetails}>
            <Text style={styles.trackTitle} numberOfLines={2}>
              {currentTrack.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Favorite Button */}
          <TouchableOpacity onPress={toggleFavorite} style={styles.controlButton}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? '#EF4444' : '#FFFFFF'}
            />
          </TouchableOpacity>

          {/* Previous Button */}
          <TouchableOpacity 
            onPress={playPrevious} 
            disabled={!hasPrevious}
            style={styles.controlButton}
          >
            <Ionicons
              name="play-back"
              size={28}
              color={hasPrevious ? '#FFFFFF' : '#475569'}
            />
          </TouchableOpacity>

          {/* Play/Pause Button */}
          <TouchableOpacity
            onPress={handlePlayPause}
            disabled={isLoading}
            style={styles.playButton}
          >
            {isLoading ? (
              <Ionicons name="hourglass-outline" size={36} color="#10B981" />
            ) : (
              <Ionicons
                name={playbackStatus.isPlaying ? 'pause-circle' : 'play-circle'}
                size={44}
                color="#10B981"
              />
            )}
          </TouchableOpacity>

          {/* Next Button */}
          <TouchableOpacity 
            onPress={playNext} 
            disabled={!hasNext}
            style={styles.controlButton}
          >
            <Ionicons
              name="play-forward"
              size={28}
              color={hasNext ? '#FFFFFF' : '#475569'}
            />
          </TouchableOpacity>

          {/* Time Display */}
          <Text style={styles.timeText}>
            {formatTime(playbackStatus.positionMillis)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 88 : 65,
    left: 0,
    right: 0,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#334155',
  },
  slider: {
    width: '100%',
    height: 4,
    marginTop: -2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  trackInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  trackIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trackDetails: {
    flex: 1,
  },
  trackTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  trackArtist: {
    color: '#94A3B8',
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  controlButton: {
    padding: 4,
  },
  playButton: {
    padding: 4,
  },
});
