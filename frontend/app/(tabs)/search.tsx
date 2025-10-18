import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Track {
  id: string;
  title: string;
  artist: string;
  cdn_url: string;
  duration: number;
  folder_id?: string;
  cover_art?: string;
}

export default function SearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTracks();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTracks([]);
    } else {
      const filtered = tracks.filter(
        track =>
          track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          track.artist.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTracks(filtered);
    }
  }, [searchQuery, tracks]);

  const loadTracks = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/tracks`);
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
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

      <ScrollView style={styles.scrollView}>
        {loading ? (
          <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />
        ) : searchQuery === '' ? (
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
            {filteredTracks.map((track) => (
              <TouchableOpacity
                key={track.id}
                style={styles.trackCard}
                onPress={() => router.push(`/player?trackId=${track.id}`)}
              >
                <View style={styles.trackCover}>
                  {track.cover_art ? (
                    <Image source={{ uri: track.cover_art }} style={styles.trackImage} />
                  ) : (
                    <Ionicons name="musical-note" size={24} color="#10B981" />
                  )}
                </View>
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {track.artist}
                  </Text>
                </View>
                <Text style={styles.trackDuration}>{formatDuration(track.duration)}</Text>
                <Ionicons name="play-circle" size={32} color="#10B981" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  resultsCount: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 14,
    color: '#94A3B8',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    color: '#94A3B8',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
  },
  trackCover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trackImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  trackInfo: {
    flex: 1,
    marginRight: 12,
  },
  trackTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  trackArtist: {
    color: '#94A3B8',
    fontSize: 14,
  },
  trackDuration: {
    color: '#64748B',
    fontSize: 14,
    marginRight: 12,
  },
});