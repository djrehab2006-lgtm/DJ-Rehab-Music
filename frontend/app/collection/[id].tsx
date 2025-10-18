import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_FOLDER_ICON } from '../constants/defaultFolderIcon';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Folder {
  id: string;
  name: string;
  cover_image?: string;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  cdn_url: string;
  cover_art?: string;
}

export default function CollectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const folderId = params.id as string;

  const [folder, setFolder] = useState<Folder | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAddTrack, setShowAddTrack] = useState(false);

  useEffect(() => {
    checkAuth();
    loadData();
  }, [folderId]);

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

  const loadData = async () => {
    try {
      const [folderRes, tracksRes] = await Promise.all([
        fetch(BACKEND_URL + '/api/folders'),
        fetch(BACKEND_URL + '/api/tracks?folder_id=' + folderId),
      ]);

      if (folderRes.ok) {
        const folders = await folderRes.json();
        const foundFolder = folders.find((f: Folder) => f.id === folderId);
        setFolder(foundFolder || null);
      }

      if (tracksRes.ok) {
        const tracksData = await tracksRes.json();
        setTracks(tracksData);
      }
    } catch (error) {
      console.error('Error loading collection:', error);
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

  if (!folder) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Collection not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{folder.name}</Text>
        {isLoggedIn ? (
          <TouchableOpacity onPress={() => setShowAddTrack(true)}>
            <Ionicons name="add-circle" size={28} color="#10B981" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Collection Header */}
        <View style={styles.collectionHeader}>
          <Image source={{ uri: DEFAULT_FOLDER_ICON }} style={styles.collectionImage} />
          <Text style={styles.collectionName}>{folder.name}</Text>
          <Text style={styles.collectionCount}>{tracks.length} tracks</Text>
        </View>

        {/* Tracks List */}
        <View style={styles.tracksContainer}>
          {tracks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={64} color="#64748B" />
              <Text style={styles.emptyText}>No tracks in this collection</Text>
              {isLoggedIn ? (
                <Text style={styles.emptySubtext}>Tap + to add tracks</Text>
              ) : (
                <Text style={styles.emptySubtext}>Ask admin to add some tracks</Text>
              )}
            </View>
          ) : (
            tracks.map((track, index) => (
              <TouchableOpacity
                key={track.id}
                style={styles.trackCard}
                onPress={() => router.push('/player?trackId=' + track.id)}
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
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {track.artist}
                  </Text>
                </View>
                <Text style={styles.trackDuration}>{formatDuration(track.duration)}</Text>
                <Ionicons name="play-circle" size={28} color="#10B981" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Track Modal */}
      <AddTrackModal
        visible={showAddTrack}
        folderId={folderId}
        folderName={folder.name}
        onClose={() => setShowAddTrack(false)}
        onSuccess={loadData}
      />
    </SafeAreaView>
  );
}

// Add Track Modal Component
function AddTrackModal({ visible, folderId, folderName, onClose, onSuccess }: any) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [cdnUrl, setCdnUrl] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !artist.trim() || !cdnUrl.trim()) {
      Alert.alert('Error', 'Please fill in title, artist, and CDN URL');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const headers = {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      };

      const url = BACKEND_URL + '/api/tracks';
      
      const body = {
        title,
        artist,
        cdn_url: cdnUrl,
        duration: parseInt(duration) || 0,
        folder_id: folderId,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setTitle('');
        setArtist('');
        setCdnUrl('');
        setDuration('');
        onSuccess();
        onClose();
      } else {
        throw new Error('Failed to save track');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save track');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <ScrollView contentContainerStyle={styles.modalScrollContent}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Track to {folderName}</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Track title"
              placeholderTextColor="#64748B"
              value={title}
              onChangeText={setTitle}
              editable={!loading}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Artist name"
              placeholderTextColor="#64748B"
              value={artist}
              onChangeText={setArtist}
              editable={!loading}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="CDN URL (streaming link)"
              placeholderTextColor="#64748B"
              value={cdnUrl}
              onChangeText={setCdnUrl}
              editable={!loading}
              autoCapitalize="none"
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Duration (seconds)"
              placeholderTextColor="#64748B"
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              editable={!loading}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Add Track</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  collectionHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  collectionImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
    marginBottom: 20,
  },
  collectionName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  collectionCount: {
    fontSize: 14,
    color: '#94A3B8',
  },
  tracksContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
    marginVertical: 4,
    borderRadius: 12,
  },
  trackNumber: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  trackNumberText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  trackCover: {
    width: 48,
    height: 48,
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
    minWidth: 40,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#94A3B8',
  },
});
