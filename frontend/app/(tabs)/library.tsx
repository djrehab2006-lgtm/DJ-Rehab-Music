import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  cdn_url: string;
  cover_art?: string;
}

export default function LibraryScreen() {
  const router = useRouter();
  const { playTrack, currentTrack } = useAudioPlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      const response = await fetch(BACKEND_URL + '/api/tracks');
      if (response.ok) {
        const data = await response.json();
        setTracks(data);
      }
    } catch (error) {
      console.error('Error loading tracks:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins + ':' + secs.toString().padStart(2, '0');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        <Text style={styles.headerSubtitle}>{tracks.length} tracks</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {tracks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="musical-notes-outline" size={64} color="#64748B" />
            <Text style={styles.emptyText}>No tracks yet</Text>
            <Text style={styles.emptySubtext}>Ask admin to add some music</Text>
          </View>
        ) : (
          tracks.map((track, index) => {
            const isPlaying = currentTrack?.id === track.id;
            return (
              <TouchableOpacity 
                key={track.id} 
                style={[styles.trackCard, isPlaying && styles.trackCardPlaying]} 
                onPress={() => playTrack(track, tracks)}
              >
                <View style={styles.trackNumber}>
                  <Text style={styles.trackNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.trackCover}>
                  {track.cover_art ? (
                    <Image source={{ uri: track.cover_art }} style={styles.trackImage} />
                  ) : (
                    <Ionicons name="musical-note" size={20} color="#10B981" />
                  )}
                </View>
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                </View>
                <Text style={styles.trackDuration}>{formatDuration(track.duration)}</Text>
                <Ionicons name="play-circle" size={28} color={isPlaying ? "#10B981" : "#64748B"} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#94A3B8' },
  scrollView: { flex: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 18, color: '#94A3B8', marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#64748B' },
  trackCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#1E293B', marginHorizontal: 16, marginVertical: 4, borderRadius: 12 },
  trackCardPlaying: { backgroundColor: '#334155', borderWidth: 1, borderColor: '#10B981' },
  trackNumber: { width: 32, alignItems: 'center', marginRight: 12 },
  trackNumberText: { color: '#64748B', fontSize: 16, fontWeight: '600' },
  trackCover: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  trackImage: { width: '100%', height: '100%', borderRadius: 8 },
  trackInfo: { flex: 1, marginRight: 12 },
  trackTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  trackArtist: { color: '#94A3B8', fontSize: 14 },
  trackDuration: { color: '#64748B', fontSize: 14, marginRight: 12, minWidth: 40 },
});
