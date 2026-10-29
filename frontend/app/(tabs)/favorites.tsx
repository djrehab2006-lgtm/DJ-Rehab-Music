import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { HARDCODED_TRACKS } from '../constants/musicData';
import { shareTrack } from '../utils/shareTrack';

export default function FavoritesScreen() {
  const { playTrack, currentTrack, favoriteIds, removeFavorite } = useAudioPlayer();

  // Favorites live in the audio context (same list the mini-player heart writes to)
  const favoriteTracks = useMemo(
    () => HARDCODED_TRACKS.filter((track) => favoriteIds.includes(track.id)),
    [favoriteIds]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favorites</Text>
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
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      shareTrack(track.title);
                    }}
                    style={styles.shareBtn}
                  >
                    <Ionicons name="share-social-outline" size={20} color="#94A3B8" />
                  </TouchableOpacity>
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
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    backgroundColor: '#1E293B', 
    marginBottom: 4, 
    borderRadius: 10 
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
    width: 32, 
    height: 32, 
    borderRadius: 6, 
    backgroundColor: '#334155', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 10,
    overflow: 'hidden'
  },
  trackImage: { width: '100%', height: '100%', borderRadius: 6 },
  trackInfo: { flex: 1, marginRight: 12 },
  trackTitle: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  trackArtist: { fontSize: 11, color: '#94A3B8' },
  trackDuration: { color: '#64748B', fontSize: 13, marginRight: 12 },
  favoriteButton: { padding: 4 },
  shareBtn: { padding: 4, marginRight: 6 },
});
