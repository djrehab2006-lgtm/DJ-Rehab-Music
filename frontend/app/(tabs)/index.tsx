import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageBackground, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { HERO_BACKGROUND } from '../constants/heroBackground';
import { HARDCODED_FOLDERS, HARDCODED_TRACKS, Folder, Track, FOLDER_ICON } from '../constants/musicData';

// Tile gradients (top → bottom), cycled in order across the collection grid
const TILE_GRADIENTS: [string, string][] = [
  ['#5C6BC0', '#7E3FA5'], // indigo → purple
  ['#E8834E', '#C43E2F'], // orange → red
  ['#5DBE8C', '#2E7D5B'], // mint → green
  ['#D98A9A', '#7A5560'], // rose → mauve
  ['#A25AC5', '#5B3A8E'], // violet → deep purple
  ['#8FA88E', '#3E5A4A'], // sage → forest
  ['#D9707A', '#C97C3C'], // coral → orange
  ['#7FA8D9', '#3E6DB5'], // sky → blue
];

const GRID_PADDING = 20;
const GRID_GAP = 16;

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const tileSize = (width - GRID_PADDING * 2 - GRID_GAP) / 2;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Use hardcoded data instead of API calls
      setFolders(HARDCODED_FOLDERS);
      setTracks(HARDCODED_TRACKS);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const getTrackCount = (folderId: string) => {
    return tracks.filter(track => track.folder_id === folderId).length;
  };

  const renderTile = (item: Folder, index: number) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.tile, { width: tileSize, height: tileSize }]}
      onPress={() => router.push('/collection/' + item.id)}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={TILE_GRADIENTS[index % TILE_GRADIENTS.length]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Image source={FOLDER_ICON} style={styles.tileWatermark} resizeMode="cover" />

      {index === 0 && (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      )}

      <View style={styles.tileContent}>
        <Text style={styles.tileTitle} numberOfLines={2}>{item.name}</Text>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{getTrackCount(item.id)} TRACKS</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5BA3D9" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <ImageBackground source={HERO_BACKGROUND} style={styles.heroContainer} imageStyle={styles.heroImage}>
          <LinearGradient
            colors={['rgba(11,11,15,0)', 'rgba(11,11,15,0.55)', '#0B0B0F']}
            locations={[0.35, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroEyebrow}>WELCOME TO</Text>
            <Text style={styles.heroTitle}>DJ Rehab Music</Text>
          </View>
        </ImageBackground>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Collections</Text>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{folders.length}</Text>
            </View>
          </View>

          {folders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={48} color="#64748B" />
              <Text style={styles.emptyText}>No collections yet</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {folders.map(renderTile)}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0F' },
  loadingContainer: { flex: 1, backgroundColor: '#0B0B0F', justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  heroContainer: { height: 400, width: '100%', justifyContent: 'flex-end', overflow: 'hidden' },
  heroImage: {
    resizeMode: 'cover',
    width: '100%',
    height: 460,
    position: 'absolute',
    top: 0,
  },
  heroTextBlock: { paddingHorizontal: 24, paddingBottom: 28 },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#B4B4BE',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  section: { paddingHorizontal: GRID_PADDING, paddingTop: 16, paddingBottom: 140 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginRight: 12 },
  sectionCount: {
    backgroundColor: '#2A2A30',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 40,
    alignItems: 'center',
  },
  sectionCountText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 18, color: '#94A3B8', marginTop: 16 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  tile: {
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#1E293B',
  },
  tileWatermark: {
    position: 'absolute',
    top: '-5%',
    left: '-8%',
    width: '116%',
    height: '110%',
    opacity: 0.28,
  },
  tileContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  tileTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 19,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  countPill: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#FFFFFF',
  },
  newBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#F5A623',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#FFFFFF',
  },
});
