import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageBackground, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HERO_BACKGROUND } from '../constants/heroBackground';
import { HARDCODED_FOLDERS, HARDCODED_TRACKS, Folder, Track, FOLDER_ICON } from '../constants/musicData';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollIndicatorVisible, setScrollIndicatorVisible] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    loadData();
  }, []);

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

  const handleDragEnd = async ({ data }: { data: Folder[] }) => {
    // Haptic feedback on drag complete
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Update local state - no backend to save to
    setFolders(data);
  };

  const renderFolderItem = ({ item, drag, isActive }: RenderItemParams<Folder>) => {
    return (
      <ScaleDecorator>
        <TouchableOpacity 
          style={[styles.listCard, isActive && styles.listCardDragging]}
          onPress={() => router.push('/collection/' + item.id)}
          disabled={isActive}
        >
          <Image source={FOLDER_ICON} style={styles.listImage} />
          <View style={styles.listTextContainer}>
            <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.listCount}>{getTrackCount(item.id)} tracks</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748B" />
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F5A623" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView} 
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          onScroll={() => {
            setScrollIndicatorVisible(true);
          }}
          onScrollBeginDrag={() => setScrollIndicatorVisible(true)}
          onScrollEndDrag={() => {
            setTimeout(() => setScrollIndicatorVisible(false), 1000);
          }}
          scrollEventThrottle={16}
        >
          <ImageBackground source={HERO_BACKGROUND} style={styles.heroContainer} imageStyle={styles.heroImage}>
            <View style={styles.heroOverlay}>
              <Text style={styles.heroSubtitle}>Welcome to the show</Text>
            </View>
          </ImageBackground>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Collections</Text>
            </View>
            
            {folders.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="folder-open-outline" size={48} color="#64748B" />
                <Text style={styles.emptyText}>No collections yet</Text>
                <Text style={styles.emptySubtext}>Ask admin to add some music</Text>
              </View>
            ) : (
              <DraggableFlatList
                data={folders}
                renderItem={renderFolderItem}
                keyExtractor={(item) => item.id}
                onDragEnd={handleDragEnd}
                scrollEnabled={false}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  heroContainer: { height: 280, width: '100%', justifyContent: 'flex-end' },
  heroImage: { 
    resizeMode: 'cover',
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: -50,
  },
  heroOverlay: { backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: 24, marginTop: 80 },
  heroTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8, textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  heroSubtitle: { fontSize: 16, color: '#F1F5F9', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  section: { paddingLeft: 20, paddingRight: 32, paddingVertical: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 18, color: '#94A3B8', marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#64748B' },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
  },
  listCardDragging: {
    backgroundColor: '#334155',
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  listImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#334155',
    marginRight: 12,
  },
  listTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  listName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  listCount: {
    fontSize: 13,
    color: '#64748B',
  },
  dragHandleList: {
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#334155',
  },
  modalButtonSave: {
    backgroundColor: '#F5A623',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
