import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { HARDCODED_TRACKS, Track, TRACK_ICON } from '../constants/musicData';
import { shareTrack } from '../utils/shareTrack';

const PASTEL_COLORS = [
  '#FFB3BA', // pastel red
  '#FFD6E8', // pastel pink
  '#FDF3B3', // pastel yellow
  '#C8E6C9', // pastel green
];

export default function SearchScreen() {
  const { playTrack, currentTrack } = useAudioPlayer();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTracks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query === '') return [];
    return HARDCODED_TRACKS.filter(
      track =>
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleTrackPress = (track: Track) => {
    playTrack(track, filteredTracks);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#64748B" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tracks or artists..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {searchQuery.trim() === '' ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color="#64748B" />
            <Text style={styles.emptyText}>Search for music</Text>
            <Text style={styles.emptySubtext}>Find your favorite tracks and artists</Text>
          </View>
        ) : filteredTracks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="sad-outline" size={64} color="#64748B" />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>Try searching for something else</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.resultsCount}>
              {filteredTracks.length} {filteredTracks.length === 1 ? 'result' : 'results'}
            </Text>
            {filteredTracks.map((track, index) => {
              const isPlaying = currentTrack?.id === track.id;
              const pastelColor = PASTEL_COLORS[index % PASTEL_COLORS.length];
              return (
                <TouchableOpacity
                  key={track.id}
                  style={[styles.trackCard, { backgroundColor: pastelColor }, isPlaying && styles.trackCardPlaying]}
                  onPress={() => handleTrackPress(track)}
                  activeOpacity={0.7}
                >
                  <View style={styles.trackCover}>
                    <Image source={TRACK_ICON} style={styles.trackImage} />
                  </View>
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={2}>{track.title}</Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      shareTrack(track.title);
                    }}
                    style={styles.shareBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="share-social-outline" size={20} color="#334155" />
                  </TouchableOpacity>
                  <Ionicons
                    name={isPlaying ? 'pause-circle' : 'play-circle'}
                    size={32}
                    color="#334155"
                  />
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
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', marginHorizontal: 20, marginBottom: 16, borderRadius: 12, paddingHorizontal: 16, height: 48 },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 16 },
  scrollView: { flex: 1 },
  resultsCount: { paddingHorizontal: 20, paddingVertical: 12, fontSize: 14, color: '#94A3B8' },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 18, color: '#94A3B8', marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#64748B' },
  trackCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#1E293B', marginHorizontal: 16, marginVertical: 2, borderRadius: 10 },
  trackCardPlaying: { borderWidth: 2, borderColor: '#2E7BBF' },
  trackCover: { width: 36, height: 36, borderRadius: 6, backgroundColor: 'rgba(255, 255, 255, 0.5)', justifyContent: 'center', alignItems: 'center', marginRight: 10, overflow: 'hidden' },
  trackImage: { width: '100%', height: '100%', borderRadius: 8 },
  trackInfo: { flex: 1, marginRight: 12 },
  shareBtn: { padding: 6, marginRight: 4 },
  trackTitle: { color: '#0F172A', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  trackArtist: { color: '#475569', fontSize: 11 },
});
