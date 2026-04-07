import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlaylists, createPlaylist, addTrackToPlaylist, Playlist } from '../utils/playlistStorage';

interface AddToPlaylistModalProps {
  visible: boolean;
  trackId: string;
  trackTitle: string;
  onClose: () => void;
}

export function AddToPlaylistModal({ visible, trackId, trackTitle, onClose }: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPlaylists();
      setShowCreate(false);
      setNewPlaylistName('');
    }
  }, [visible]);

  const loadPlaylists = async () => {
    const data = await getPlaylists();
    setPlaylists(data);
  };

  const handleAddToPlaylist = async (playlist: Playlist) => {
    setLoading(true);
    const added = await addTrackToPlaylist(playlist.id, trackId);
    setLoading(false);
    if (added) {
      Alert.alert('Added!', `"${trackTitle}" added to "${playlist.name}"`);
    } else {
      Alert.alert('Already exists', `This track is already in "${playlist.name}"`);
    }
    onClose();
  };

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }
    setLoading(true);
    const newPlaylist = await createPlaylist(newPlaylistName.trim());
    await addTrackToPlaylist(newPlaylist.id, trackId);
    setLoading(false);
    Alert.alert('Created!', `"${trackTitle}" added to new playlist "${newPlaylist.name}"`);
    onClose();
  };

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <TouchableOpacity
      style={styles.playlistItem}
      onPress={() => handleAddToPlaylist(item)}
      disabled={loading}
    >
      <View style={styles.playlistIcon}>
        <Ionicons name="list" size={22} color="#5BA3D9" />
      </View>
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.playlistCount}>{item.trackIds.length} tracks</Text>
      </View>
      <Ionicons name="add-circle-outline" size={24} color="#5BA3D9" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>Add to Playlist</Text>
            <Text style={styles.modalSubtitle} numberOfLines={1}>"{trackTitle}"</Text>

            {/* Create New Playlist */}
            {showCreate ? (
              <View style={styles.createContainer}>
                <TextInput
                  style={styles.createInput}
                  placeholder="Playlist name..."
                  placeholderTextColor="#64748B"
                  value={newPlaylistName}
                  onChangeText={setNewPlaylistName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreateAndAdd}
                />
                <View style={styles.createButtons}>
                  <TouchableOpacity
                    style={styles.createCancelBtn}
                    onPress={() => { setShowCreate(false); setNewPlaylistName(''); }}
                  >
                    <Text style={styles.createCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.createSaveBtn}
                    onPress={handleCreateAndAdd}
                    disabled={loading}
                  >
                    <Text style={styles.createSaveText}>Create & Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.newPlaylistBtn}
                onPress={() => setShowCreate(true)}
              >
                <Ionicons name="add-circle" size={24} color="#5BA3D9" />
                <Text style={styles.newPlaylistText}>New Playlist</Text>
              </TouchableOpacity>
            )}

            {/* Existing Playlists */}
            {playlists.length > 0 ? (
              <FlatList
                data={playlists}
                renderItem={renderPlaylistItem}
                keyExtractor={(item) => item.id}
                style={styles.playlistList}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No playlists yet</Text>
                <Text style={styles.emptySubtext}>Create one above to get started</Text>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 20,
  },
  newPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  newPlaylistText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5BA3D9',
  },
  createContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  createInput: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  createButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  createCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  createCancelText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 14,
  },
  createSaveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#5BA3D9',
    alignItems: 'center',
  },
  createSaveText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  playlistList: {
    maxHeight: 300,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  playlistIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playlistInfo: {
    flex: 1,
    marginRight: 12,
  },
  playlistName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  playlistCount: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#64748B',
  },
});
