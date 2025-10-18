import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_FOLDER_ICON } from '../constants/defaultFolderIcon';
import { useRouter } from 'expo-router';

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
  cdn_url: string;
  duration: number;
  folder_id?: string;
  cover_art?: string;
}

export default function AdminScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Data states
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        const response = await fetch(\`\${BACKEND_URL}/api/auth/verify\`, {
          headers: { 'Authorization': \`Bearer \${token}\` },
        });
        if (response.ok) {
          setIsLoggedIn(true);
          loadData();
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (error) {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }

    setLoginLoading(true);
    try {
      const response = await fetch(\`\${BACKEND_URL}/api/auth/login\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await response.json();
      await AsyncStorage.setItem('auth_token', data.access_token);
      setIsLoggedIn(true);
      loadData();
    } catch (error) {
      Alert.alert('Login Failed', 'Invalid username or password');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('auth_token');
    setIsLoggedIn(false);
    setFolders([]);
    setTracks([]);
  };

  const getAuthHeader = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    return {
      'Authorization': \`Bearer \${token}\`,
      'Content-Type': 'application/json',
    };
  };

  const loadData = async () => {
    try {
      const headers = await getAuthHeader();
      const [foldersRes, tracksRes] = await Promise.all([
        fetch(\`\${BACKEND_URL}/api/folders\`, { headers }),
        fetch(\`\${BACKEND_URL}/api/tracks\`, { headers }),
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

  const handleDeleteFolder = async (folderId: string) => {
    Alert.alert(
      'Delete Folder',
      'This will also delete all tracks in this folder. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const headers = await getAuthHeader();
              const response = await fetch(\`\${BACKEND_URL}/api/folders/\${folderId}\`, {
                method: 'DELETE',
                headers,
              });
              if (response.ok) {
                loadData();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete folder');
            }
          },
        },
      ]
    );
  };

  const handleDeleteTrack = async (trackId: string) => {
    Alert.alert(
      'Delete Track',
      'Are you sure you want to delete this track?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const headers = await getAuthHeader();
              const response = await fetch(\`\${BACKEND_URL}/api/tracks/\${trackId}\`, {
                method: 'DELETE',
                headers,
              });
              if (response.ok) {
                loadData();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete track');
            }
          },
        },
      ]
    );
  };

  const filteredTracks = tracks.filter(track =>
    track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Login Screen
  if (!isLoggedIn) {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      );
    }

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.loginContainer}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="musical-notes" size={48} color="#1E293B" />
              </View>
              <Text style={styles.loginTitle}>Admin Login</Text>
              <Text style={styles.loginSubtitle}>DJ Rehab Music Management</Text>
            </View>

            <View style={styles.loginForm}>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#64748B"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  editable={!loginLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#64748B"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loginLoading}
                />
              </View>

              <TouchableOpacity
                style={[styles.loginButton, loginLoading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Admin Management Screen
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSubtitle}>Manage Collections & Tracks</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#64748B" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tracks..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView style={styles.content}>
        {/* Albums Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collections</Text>
            <TouchableOpacity onPress={() => setShowAddFolder(true)}>
              <Ionicons name="add-circle-outline" size={28} color="#10B981" />
            </TouchableOpacity>
          </View>

          {folders.length === 0 ? (
            <Text style={styles.emptyText}>No collections yet. Add your first collection!</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumsScroll}>
              {folders.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  style={styles.albumCard}
                  onLongPress={() => {
                    Alert.alert(
                      folder.name,
                      'Choose an action',
                      [
                        { text: 'Edit', onPress: () => setEditingFolder(folder) },
                        { text: 'Delete', onPress: () => handleDeleteFolder(folder.id), style: 'destructive' },
                        { text: 'Cancel', style: 'cancel' },
                      ]
                    );
                  }}
                >
                  <View style={styles.albumCover}>
                    <Image source={{ uri: DEFAULT_FOLDER_ICON }} style={styles.albumImage} />
                  </View>
                  <Text style={styles.albumName} numberOfLines={1}>{folder.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Recent Tracks Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All Tracks</Text>
            <TouchableOpacity onPress={() => setShowAddTrack(true)}>
              <Ionicons name="add-circle-outline" size={28} color="#10B981" />
            </TouchableOpacity>
          </View>

          {filteredTracks.length === 0 ? (
            <Text style={styles.emptyText}>
              {searchQuery ? 'No tracks found' : 'No tracks yet. Add your first track!'}
            </Text>
          ) : (
            filteredTracks.map((track) => (
              <TouchableOpacity
                key={track.id}
                style={styles.trackCard}
                onPress={() => router.push(\`/player?trackId=\${track.id}\`)}
                onLongPress={() => {
                  Alert.alert(
                    track.title,
                    'Choose an action',
                    [
                      { text: 'Edit', onPress: () => setEditingTrack(track) },
                      { text: 'Delete', onPress: () => handleDeleteTrack(track.id), style: 'destructive' },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                }}
              >
                <View style={styles.trackCover}>
                  {track.cover_art ? (
                    <Image source={{ uri: track.cover_art }} style={styles.trackImage} />
                  ) : (
                    <Ionicons name="musical-note" size={24} color="#10B981" />
                  )}
                </View>
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                </View>
                <Text style={styles.trackDuration}>{formatDuration(track.duration)}</Text>
                <Ionicons name="play-circle" size={32} color="#10B981" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Folder Modal */}
      <FolderModal
        visible={showAddFolder || !!editingFolder}
        folder={editingFolder}
        onClose={() => {
          setShowAddFolder(false);
          setEditingFolder(null);
        }}
        onSuccess={loadData}
      />

      {/* Add/Edit Track Modal */}
      <TrackModal
        visible={showAddTrack || !!editingTrack}
        track={editingTrack}
        folders={folders}
        onClose={() => {
          setShowAddTrack(false);
          setEditingTrack(null);
        }}
        onSuccess={loadData}
      />
    </SafeAreaView>
  );
}

// Folder Modal Component
function FolderModal({ visible, folder, onClose, onSuccess }: any) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (folder) {
      setName(folder.name);
    } else {
      setName('');
    }
  }, [folder]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const headers = {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json',
      };

      const url = folder
        ? \`\${BACKEND_URL}/api/folders/\${folder.id}\`
        : \`\${BACKEND_URL}/api/folders\`;
      
      const response = await fetch(url, {
        method: folder ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        throw new Error('Failed to save folder');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{folder ? 'Edit Collection' : 'New Collection'}</Text>
          
          <TextInput
            style={styles.modalInput}
            placeholder="Collection name"
            placeholderTextColor="#64748B"
            value={name}
            onChangeText={setName}
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
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Track Modal Component
function TrackModal({ visible, track, folders, onClose, onSuccess }: any) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [cdnUrl, setCdnUrl] = useState('');
  const [duration, setDuration] = useState('');
  const [folderId, setFolderId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (track) {
      setTitle(track.title);
      setArtist(track.artist);
      setCdnUrl(track.cdn_url);
      setDuration(track.duration.toString());
      setFolderId(track.folder_id || '');
    } else {
      setTitle('');
      setArtist('');
      setCdnUrl('');
      setDuration('');
      setFolderId('');
    }
  }, [track]);

  const handleSave = async () => {
    if (!title.trim() || !artist.trim() || !cdnUrl.trim()) {
      Alert.alert('Error', 'Please fill in title, artist, and CDN URL');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const headers = {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json',
      };

      const url = track
        ? \`\${BACKEND_URL}/api/tracks/\${track.id}\`
        : \`\${BACKEND_URL}/api/tracks\`;
      
      const body = {
        title,
        artist,
        cdn_url: cdnUrl,
        duration: parseInt(duration) || 0,
        folder_id: folderId || null,
      };

      const response = await fetch(url, {
        method: track ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
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
            <Text style={styles.modalTitle}>{track ? 'Edit Track' : 'New Track'}</Text>
            
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

            <View style={styles.folderSelector}>
              <Text style={styles.folderSelectorLabel}>Collection (optional):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.folderOption, !folderId && styles.folderOptionSelected]}
                  onPress={() => setFolderId('')}
                >
                  <Text style={[styles.folderOptionText, !folderId && styles.folderOptionTextSelected]}>
                    None
                  </Text>
                </TouchableOpacity>
                {folders.map((folder: Folder) => (
                  <TouchableOpacity
                    key={folder.id}
                    style={[styles.folderOption, folderId === folder.id && styles.folderOptionSelected]}
                    onPress={() => setFolderId(folder.id)}
                  >
                    <Text style={[styles.folderOptionText, folderId === folder.id && styles.folderOptionTextSelected]}>
                      {folder.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

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
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return \`\${mins}:\${secs.toString().padStart(2, '0')}\`;
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
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FCD34D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  loginForm: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    color: '#FFFFFF',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#10B981',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: '#FFFFFF',
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  albumsScroll: {
    paddingLeft: 20,
  },
  albumCard: {
    marginRight: 16,
    width: 140,
  },
  albumCover: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  albumImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  albumName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginBottom: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
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
  folderSelector: {
    marginBottom: 16,
  },
  folderSelectorLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 8,
  },
  folderOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  folderOptionSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  folderOptionText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  folderOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
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
    backgroundColor: '#10B981',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
