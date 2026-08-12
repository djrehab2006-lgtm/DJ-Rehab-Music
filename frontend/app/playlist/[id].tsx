import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { HARDCODED_TRACKS, Track, TRACK_ICON } from '../constants/musicData';
import { getPlaylistById, removeTrackFromPlaylist, renamePlaylist, Playlist } from '../utils/playlistStorage';
import { shareTrack } from '../utils/shareTrack';

const PASTEL_COLORS = [
  '#FFB3BA', // pastel red
  '#FFD6E8', // pastel pink
  '#FDF3B3', // pastel yellow
  '#C8E6C9', // pastel green
];

export default function PlaylistDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const playlistId = params.id as string;
  const { playTrack, currentTrack, shufflePlaylist, isShuffled } = useAudioPlayer();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadPlaylist();
    }, [playlistId])
  );

  const loadPlaylist = async () => {
    try {
      const pl = await getPlaylistById(playlistId);
      if (pl) {
        setPlaylist(pl);
        // Resolve track IDs to actual track objects
        const resolvedTracks = pl.trackIds
          .map((id) => HARDCODED_TRACKS.find((t) => t.id === id))
          .filter((t): t is Track => t !== undefined);
        setTracks(resolvedTracks);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading playlist:', error);
      setLoading(false);
    }
  };

  const handleRemoveTrack = (track: Track) => {
    Alert.alert(
      'Remove Track',
      `Remove "${track.title}" from this playlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeTrackFromPlaylist(playlistId, track.id);
            await loadPlaylist();
          },
        },
      ]
    );
  };

  const handleRename = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    await renamePlaylist(playlistId, editName.trim());
    setEditModalVisible(false);
    await loadPlaylist();
  };

  const openEditModal = () => {
    setEditName(playlist?.name || '');
    setEditModalVisible(true);
  };

  const renderTrackItem = ({ item, index }: { item: Track; index: number }) => {
    const isPlaying = currentTrack?.id === item.id;
    const pastelColor = PASTEL_COLORS[index % PASTEL_COLORS.length];

    return (
      <View
        style={[
          styles.trackCard,
          { backgroundColor: pastelColor },
          isPlaying && styles.trackCardPlaying,
        ]}
      >
        <TouchableOpacity
          style={styles.trackPressable}
          onPress={() => playTrack(item, tracks)}
          activeOpacity={0.7}
        >
          <View style={styles.trackNumber}>
            <Text style={styles.trackNumberText}>{index + 1}</Text>
          </View>
          <View style={styles.trackCover}>
            <Image source={TRACK_ICON} style={styles.trackImage} />
          </View>
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => shareTrack(item.title)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="share-social-outline" size={20} color="#334155" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => handleRemoveTrack(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="remove-circle-outline" size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!playlist) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Playlist not found</Text>
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
        <Text style={styles.headerTitle} numberOfLines={1}>{playlist.name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={openEditModal} style={styles.headerBtn}>
            <Ionicons name="pencil" size={20} color="#5BA3D9" />
          </TouchableOpacity>
          <TouchableOpacity onPress={shufflePlaylist} style={styles.headerBtn}>
            <Ionicons name="shuffle" size={22} color={isShuffled ? "#2E7BBF" : "#5BA3D9"} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Playlist Info */}
      <View style={styles.playlistHeader}>
        <View style={styles.playlistIconLarge}>
          <Ionicons name="list" size={48} color="#5BA3D9" />
        </View>
        <Text style={styles.playlistName}>{playlist.name}</Text>
        <Text style={styles.playlistCount}>{tracks.length} tracks</Text>
      </View>

      {/* Tracks */}
      {tracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes-outline" size={64} color="#64748B" />
          <Text style={styles.emptyText}>No tracks in this playlist</Text>
          <Text style={styles.emptySubtext}>Browse collections and tap the + icon to add tracks</Text>
        </View>
      ) : (
        <FlatList
          data={tracks}
          renderItem={renderTrackItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.tracksContainer}
          showsVerticalScrollIndicator={true}
        />
      )}

      {/* Edit Name Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Rename Playlist</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Playlist name..."
              placeholderTextColor="#64748B"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRename}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={handleRename}
              >
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
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
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    padding: 8,
  },
  playlistHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  playlistIconLarge: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  playlistName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  playlistCount: {
    fontSize: 14,
    color: '#94A3B8',
  },
  tracksContainer: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginVertical: 2,
    borderRadius: 10,
    paddingRight: 12,
  },
  trackCardPlaying: {
    borderWidth: 2,
    borderColor: '#2E7BBF',
  },
  trackPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    flex: 1,
  },
  trackNumber: {
    width: 28,
    alignItems: 'center',
    marginRight: 10,
  },
  trackNumberText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  trackCover: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  trackImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  trackInfo: {
    flex: 1,
    marginRight: 8,
  },
  trackTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    lineHeight: 18,
  },
  trackArtist: {
    color: '#475569',
    fontSize: 11,
  },
  removeBtn: {
    padding: 8,
  },
  shareBtn: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
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
    textAlign: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#334155',
  },
  modalBtnSave: {
    backgroundColor: '#5BA3D9',
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
