import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { HARDCODED_TRACKS, Track } from '../constants/musicData';

export default function FavoritesScreen() {
  const { playTrack, currentTrack } = useAudioPlayer();
  const [favoriteTracks, setFavoriteTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      // Get favorite track IDs from AsyncStorage (local device storage)
      const favoritesJson = await AsyncStorage.getItem('favorite_tracks');
      const favoriteIds: string[] = favoritesJson ? JSON.parse(favoritesJson) : [];

      if (favoriteIds.length === 0) {
        setFavoriteTracks([]);
        setLoading(false);
        return;
      }

      // Filter hardcoded tracks to only favorited ones
      const favorites = HARDCODED_TRACKS.filter(track => favoriteIds.includes(track.id));
      setFavoriteTracks(favorites);
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (trackId: string) => {
    try {
      const favoritesJson = await AsyncStorage.getItem('favorite_tracks');
      const favoriteIds: string[] = favoritesJson ? JSON.parse(favoritesJson) : [];
      const updatedIds = favoriteIds.filter(id => id !== trackId);
      await AsyncStorage.setItem('favorite_tracks', JSON.stringify(updatedIds));
      
      // Update local state
      setFavoriteTracks(prev => prev.filter(track => track.id !== trackId));
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Favorites</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5BA3D9" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favorites</Text>
        <TouchableOpacity onPress={loadFavorites}>
          <Ionicons name="refresh" size={24} color="#5BA3D9" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.statsContainer}>
          <Ionicons name="heart" size={32} color="#EF4444" />
          <Text style={styles.statsText}>{favoriteTracks.length} favorite tracks</Text>
        </View>

        {favoriteTracks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={64} color="#64748B" />
            <Text style={styles.emptyText}>No favorite tracks yet</Text>
            <Text style={styles.emptySubtext}>Tap the heart icon on any track to add it here</Text>
          </View>
        ) : (
          <View style={styles.tracksContainer}>
            {favoriteTracks.map((track, index) => {
              const isPlaying = currentTrack?.id === track.id;
              return (
                <TouchableOpacity 
                  key={track.id} 
                  style={[styles.trackCard, isPlaying && styles.trackCardPlaying]} 
                  onPress={() => playTrack(track, favoriteTracks)}
                >
                  <View style={styles.trackNumber}>
                    <Text style={styles.trackNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.trackCover}>
                    {track.cover_art ? (
                      <Image source={{ uri: track.cover_art }} style={styles.trackImage} />
                    ) : (
                      <Ionicons name="musical-note" size={20} color="#5BA3D9" />
                    )}
                  </View>
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      removeFavorite(track.id);
                    }}
                    style={styles.favoriteButton}
                  >
                    <Ionicons name="heart" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  scrollView: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  statsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#94A3B8', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#64748B', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  tracksContainer: { paddingHorizontal: 16, paddingBottom: 120 },
  trackCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    backgroundColor: '#1E293B', 
    marginBottom: 8, 
    borderRadius: 12 
  },
  trackCardPlaying: { backgroundColor: '#334155', borderWidth: 1, borderColor: '#5BA3D9' },
  trackNumber: { 
    width: 32, 
    height: 32, 
    borderRadius: 6, 
    backgroundColor: '#334155', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  trackNumberText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  trackCover: { 
    width: 48, 
    height: 48, 
    borderRadius: 8, 
    backgroundColor: '#334155', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  trackImage: { width: '100%', height: '100%', borderRadius: 8 },
  trackInfo: { flex: 1, marginRight: 12 },
  trackTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  trackArtist: { fontSize: 13, color: '#94A3B8' },
  trackDuration: { color: '#64748B', fontSize: 13, marginRight: 12 },
  favoriteButton: { padding: 4 },
});
