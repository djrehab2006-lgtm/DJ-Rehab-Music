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
  FlatList,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { HARDCODED_FOLDERS, HARDCODED_TRACKS, Folder, Track, FOLDER_ICON, TRACK_ICON } from '../constants/musicData';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { shareTrack } from '../utils/shareTrack';

const PASTEL_COLORS = [
  '#FFB3BA', // pastel red
  '#FFD6E8', // pastel pink
  '#FDF3B3', // pastel yellow
  '#C8E6C9', // pastel green
];

export default function CollectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const folderId = params.id as string;
  const { playTrack, currentTrack, shufflePlaylist, isShuffled } = useAudioPlayer();

  const [folder, setFolder] = useState<Folder | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [addToPlaylistVisible, setAddToPlaylistVisible] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrollIndicatorVisible, setScrollIndicatorVisible] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    loadData();
  }, [folderId]);

  const loadData = async () => {
    try {
      // Load from hardcoded data
      const folderData = HARDCODED_FOLDERS.find(f => f.id === folderId);
      const tracksData = HARDCODED_TRACKS.filter(t => t.folder_id === folderId)
        .sort((a, b) => a.position - b.position);
      
      if (folderData) {
        setFolder(folderData);
        setTracks(tracksData);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins + ':' + secs.toString().padStart(2, '0');
  };

  const renderTrackItem = ({ item, index }: { item: Track; index: number }) => {
    const isPlaying = currentTrack?.id === item.id;
    const pastelColor = PASTEL_COLORS[index % PASTEL_COLORS.length];
    
    const handleTrackPress = () => {
      playTrack(item, tracks);
    };

    const handleAddToPlaylist = () => {
      setSelectedTrackForPlaylist(item);
      setAddToPlaylistVisible(true);
    };
    
    return (
      <View
        style={[
          styles.trackCard,
          { backgroundColor: pastelColor },
          isPlaying && styles.trackCardPlaying,
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.trackPressable}
          onPress={handleTrackPress}
          activeOpacity={0.7}
        >
          <View style={styles.trackCover}>
            <Image source={TRACK_ICON} style={styles.trackImage} />
          </View>
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {item.artist}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => shareTrack(item.title)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="share-social-outline" size={20} color="#334155" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addToPlaylistBtn}
          onPress={handleAddToPlaylist}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add-circle-outline" size={22} color="#334155" />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5BA3D9" />
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
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={shufflePlaylist} style={styles.shuffleButton}>
            <Ionicons name="shuffle" size={24} color={isShuffled ? "#2E7BBF" : "#5BA3D9"} />
          </TouchableOpacity>
        </View>
      </View>

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
        {/* Collection Header */}
        <View style={styles.collectionHeader}>
          <Image source={FOLDER_ICON} style={styles.collectionImage} />
          <Text style={styles.collectionName}>{folder.name}</Text>
          <Text style={styles.collectionCount}>{tracks.length} tracks</Text>
        </View>

        {/* Tracks List */}
        <View style={styles.tracksContainer}>
          {tracks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={64} color="#64748B" />
              <Text style={styles.emptyText}>No tracks in this collection</Text>
              <Text style={styles.emptySubtext}>No tracks available</Text>
            </View>
          ) : (
            <FlatList
              data={tracks}
              renderItem={renderTrackItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>

      {/* Add to Playlist Modal */}
      {selectedTrackForPlaylist && (
        <AddToPlaylistModal
          visible={addToPlaylistVisible}
          trackId={selectedTrackForPlaylist.id}
          trackTitle={selectedTrackForPlaylist.title}
          onClose={() => {
            setAddToPlaylistVisible(false);
            setSelectedTrackForPlaylist(null);
          }}
        />
      )}
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
  shuffleButton: {
    padding: 8,
  },
  headerButton: {
    padding: 4,
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
    paddingBottom: 120,
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
    backgroundColor: '#1E293B',
    marginVertical: 2,
    borderRadius: 10,
    paddingRight: 8,
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
    width: '70%',
  },
  trackActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  editButtonContainer: {
    width: 50,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonContainer: {
    width: 60,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
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
  addToPlaylistBtn: {
    padding: 8,
  },
  shareBtn: {
    padding: 8,
  },
  trackDuration: {
    color: '#64748B',
    fontSize: 14,
    marginRight: 12,
    minWidth: 40,
  },
  deleteButton: {
    padding: 8,
    marginRight: 4,
    zIndex: 100,
  },
  deleteButtonBackground: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#5BA3D9',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
