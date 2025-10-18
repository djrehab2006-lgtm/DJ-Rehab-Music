import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Track {
  id: string;
  title: string;
  artist: string;
  cdn_url: string;
  duration: number;
  cover_art?: string;
}

export default function PlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const trackId = params.trackId as string;

  const [track, setTrack] = useState<Track | null>(null);
  const [sound, setSound] = useState<Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrack();
    setupAudio();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [trackId]);

  const setupAudio = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  };

  const loadTrack = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/api/tracks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const tracks = await response.json();
        const foundTrack = tracks.find((t: Track) => t.id === trackId);
        if (foundTrack) {
          setTrack(foundTrack);
          await loadAudio(foundTrack.cdn_url);
        }
      }
    } catch (error) {
      console.error('Error loading track:', error);
      Alert.alert('Error', 'Failed to load track');
    } finally {
      setLoading(false);
    }
  };

  const loadAudio = async (url: string) => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      
      setSound(newSound);
    } catch (error) {
      console.error('Error loading audio:', error);
      Alert.alert('Error', 'Failed to load audio file. Please check the CDN URL.');
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
      setIsPlaying(status.isPlaying);
    }
  };

  const handlePlayPause = async () => {
    if (!sound) return;

    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  const handleSeek = async (value: number) => {
    if (sound) {
      await sound.setPositionAsync(value * 1000);
    }
  };

  const handleSkipForward = async () => {
    if (sound) {
      const newPosition = Math.min(position + 10, duration);
      await sound.setPositionAsync(newPosition * 1000);
    }
  };

  const handleSkipBackward = async () => {
    if (sound) {
      const newPosition = Math.max(position - 10, 0);
      await sound.setPositionAsync(newPosition * 1000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A855F7" />
      </View>
    );
  }

  if (!track) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Track not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerLogo}>
          <Ionicons name="musical-notes" size={20} color="#1E293B" />
        </View>
        <Text style={styles.headerTitle}>DJ REHAB</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        {/* Album Art */}
        <View style={styles.albumArtContainer}>
          {track.cover_art ? (
            <Image source={{ uri: track.cover_art }} style={styles.albumArt} />
          ) : (
            <View style={styles.albumArtPlaceholder}>
              <Ionicons name="musical-note" size={80} color="#A855F7" />
            </View>
          )}
        </View>

        {/* Track Info */}
        <Text style={styles.trackTitle}>{track.title}</Text>
        <Text style={styles.trackArtist}>{track.artist}</Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration || 1}
            value={position}
            onSlidingComplete={handleSeek}
            minimumTrackTintColor="#A855F7"
            maximumTrackTintColor="#334155"
            thumbTintColor="#FFFFFF"
          />
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={handleSkipBackward}>
            <Ionicons name="play-back" size={32} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkipBackward}>
            <Ionicons name="play-skip-back" size={40} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={48}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkipForward}>
            <Ionicons name="play-skip-forward" size={40} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkipForward}>
            <Ionicons name="play-forward" size={32} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FCD34D',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  albumArtContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  albumArt: {
    width: 280,
    height: 280,
    borderRadius: 20,
  },
  albumArtPlaceholder: {
    width: 280,
    height: 280,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  trackArtist: {
    fontSize: 18,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 40,
  },
  progressContainer: {
    marginBottom: 40,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: '#64748B',
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#A855F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#A855F7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
