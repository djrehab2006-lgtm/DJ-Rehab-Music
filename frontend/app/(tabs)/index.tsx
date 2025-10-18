import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageBackground, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_FOLDER_ICON } from '../constants/defaultFolderIcon';
import { HERO_BACKGROUND } from '../constants/heroBackground';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Folder {
  id: string;
  name: string;
}

interface Track {
  id: string;
  folder_id?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        const url = BACKEND_URL + '/api/auth/verify';
        const response = await fetch(url, {
          headers: { 'Authorization': 'Bearer ' + token },
        });
        if (response.ok) {
          setIsLoggedIn(true);
        }
      }
    } catch (error) {
      console.log('Auth check failed');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [foldersRes, tracksRes] = await Promise.all([
        fetch(BACKEND_URL + '/api/folders').catch(() => ({ ok: false })),
        fetch(BACKEND_URL + '/api/tracks').catch(() => ({ ok: false })),
      ]);

      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        setFolders(foldersData);
      }

      if (tracksRes.ok) {
        const tracksData = await tracksRes.json();
        setTracks(tracksData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrackCount = (folderId: string) => {
    return tracks.filter(track => track.folder_id === folderId).length;
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
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <ImageBackground source={{ uri: HERO_BACKGROUND }} style={styles.heroContainer} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>DJ REHAB MUSIC</Text>
            <Text style={styles.heroSubtitle}>Stream Your Favorite Tracks</Text>
          </View>
        </ImageBackground>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collections</Text>
            {isLoggedIn && (
              <TouchableOpacity onPress={() => setShowAddFolder(true)}>
                <Ionicons name="add-circle" size={32} color="#10B981" />
              </TouchableOpacity>
            )}
          </View>
          
          {folders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={48} color="#64748B" />
              <Text style={styles.emptyText}>No collections yet</Text>
              <Text style={styles.emptySubtext}>Ask admin to add some music</Text>
            </View>
          ) : (
            <View style={styles.collectionsGrid}>
              {folders.map((folder) => (
                <TouchableOpacity 
                  key={folder.id} 
                  style={styles.collectionCard}
                  onPress={() => router.push('/collection/' + folder.id)}
                >
                  <Image source={{ uri: DEFAULT_FOLDER_ICON }} style={styles.collectionImage} />
                  <View style={styles.collectionInfo}>
                    <Text style={styles.collectionName} numberOfLines={1}>{folder.name}</Text>
                    <Text style={styles.collectionCount}>{getTrackCount(folder.id)} tracks</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  heroContainer: { height: 240, width: '100%', justifyContent: 'flex-end' },
  heroImage: { resizeMode: 'cover' },
  heroOverlay: { backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: 24 },
  heroTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8, textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  heroSubtitle: { fontSize: 16, color: '#F1F5F9', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  section: { paddingHorizontal: 20, paddingVertical: 24 },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 18, color: '#94A3B8', marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#64748B' },
  collectionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 },
  collectionCard: { width: '47%', marginHorizontal: '1.5%', marginBottom: 20, backgroundColor: '#1E293B', borderRadius: 12, overflow: 'hidden' },
  collectionImage: { width: '100%', height: 160, backgroundColor: '#334155' },
  collectionInfo: { padding: 12 },
  collectionName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  collectionCount: { fontSize: 13, color: '#94A3B8' },
});
