import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { TRACK_ICON } from '../constants/musicData';
import { albumName } from '../utils/audioEngine';
import { shareTrack } from '../utils/shareTrack';
import { AddToPlaylistModal } from './AddToPlaylistModal';

const formatTime = (millis: number): string => {
  const totalSeconds = Math.max(0, Math.floor(millis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

interface NowPlayingProps {
  visible: boolean;
  onClose: () => void;
}

/** Full-screen player opened by tapping the mini player. */
export function NowPlaying({ visible, onClose }: NowPlayingProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    currentTrack,
    playbackStatus,
    isLoading,
    isFavorite,
    isShuffled,
    pauseTrack,
    resumeTrack,
    seekTo,
    toggleFavorite,
    playNext,
    playPrevious,
    shufflePlaylist,
    hasNext,
    hasPrevious,
  } = useAudioPlayer();

  const [slideValue, setSlideValue] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [playlistPickerVisible, setPlaylistPickerVisible] = useState(false);
  const [artworkSize, setArtworkSize] = useState(0);

  useEffect(() => {
    if (!isSeeking) {
      setSlideValue(playbackStatus.positionMillis);
    }
  }, [playbackStatus.positionMillis, isSeeking]);

  useEffect(() => {
    if (!visible) {
      setMenuVisible(false);
      setPlaylistPickerVisible(false);
    }
  }, [visible]);

  if (!currentTrack) {
    return null;
  }

  const album = albumName(currentTrack);
  const duration = playbackStatus.durationMillis;

  const handleGoToAlbum = () => {
    setMenuVisible(false);
    onClose();
    router.push(`/collection/${currentTrack.folder_id}`);
  };

  const handleAddToPlaylist = () => {
    setMenuVisible(false);
    setPlaylistPickerVisible(true);
  };

  const handleShare = () => {
    setMenuVisible(false);
    shareTrack(currentTrack.title);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={menuVisible ? () => setMenuVisible(false) : onClose}
      statusBarTranslucent
    >
      <View
        style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
        testID="now-playing-screen"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton} testID="now-playing-close">
            <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>PLAYING FROM</Text>
            <Text style={styles.headerAlbum} numberOfLines={1} testID="now-playing-header-album">
              {album}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            style={styles.headerButton}
            testID="now-playing-menu-button"
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Artwork */}
        <View
          style={styles.artworkArea}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setArtworkSize(Math.max(0, Math.min(width, height - 32, 360)));
          }}
        >
          <Image
            source={currentTrack.cover_art ? { uri: currentTrack.cover_art } : TRACK_ICON}
            style={[styles.artwork, { width: artworkSize, height: artworkSize }]}
            resizeMode="cover"
          />
        </View>

        {/* Track details */}
        <View style={styles.detailsRow}>
          <View style={styles.details}>
            <Text style={styles.title} numberOfLines={2} testID="now-playing-title">
              {currentTrack.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1} testID="now-playing-artist">
              {currentTrack.artist}
            </Text>
            <Text style={styles.album} numberOfLines={1} testID="now-playing-album">
              {album}
            </Text>
          </View>
          <TouchableOpacity onPress={toggleFavorite} style={styles.iconButton} testID="now-playing-favorite">
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={28}
              color={isFavorite ? '#EF4444' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>

        {/* Timeline */}
        <View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration || 1}
            value={slideValue}
            onValueChange={setSlideValue}
            onSlidingStart={() => setIsSeeking(true)}
            onSlidingComplete={async (value) => {
              await seekTo(value);
              setIsSeeking(false);
            }}
            minimumTrackTintColor="#5BA3D9"
            maximumTrackTintColor="#334155"
            thumbTintColor="#5BA3D9"
            testID="now-playing-slider"
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeText} testID="now-playing-position">
              {formatTime(isSeeking ? slideValue : playbackStatus.positionMillis)}
            </Text>
            <Text style={styles.timeText} testID="now-playing-duration">
              {duration > 0 ? formatTime(duration) : '--:--'}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={shufflePlaylist} style={styles.iconButton} testID="now-playing-shuffle">
            <Ionicons name="shuffle" size={26} color={isShuffled ? '#5BA3D9' : '#94A3B8'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={playPrevious}
            disabled={!hasPrevious}
            style={styles.iconButton}
            testID="now-playing-previous"
          >
            <Ionicons name="play-skip-back" size={34} color={hasPrevious ? '#FFFFFF' : '#475569'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={playbackStatus.isPlaying ? pauseTrack : resumeTrack}
            disabled={isLoading}
            style={styles.playButton}
            testID="now-playing-play-pause"
          >
            <Ionicons
              name={isLoading ? 'hourglass-outline' : playbackStatus.isPlaying ? 'pause' : 'play'}
              size={36}
              color="#0F172A"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={playNext}
            disabled={!hasNext}
            style={styles.iconButton}
            testID="now-playing-next"
          >
            <Ionicons name="play-skip-forward" size={34} color={hasNext ? '#FFFFFF' : '#475569'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.iconButton} testID="now-playing-share">
            <Ionicons name="share-social-outline" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Three-dots menu */}
        {menuVisible && (
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)} testID="now-playing-menu-backdrop">
            <Pressable style={[styles.menuSheet, { paddingBottom: insets.bottom + 16 }]} testID="now-playing-menu">
              <Text style={styles.menuTitle} numberOfLines={1}>
                {currentTrack.title}
              </Text>
              {!!currentTrack.folder_id && (
                <TouchableOpacity style={styles.menuItem} onPress={handleGoToAlbum} testID="now-playing-menu-album">
                  <Ionicons name="albums-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.menuItemText}>Go to album</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.menuItem} onPress={handleAddToPlaylist} testID="now-playing-menu-playlist">
                <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" />
                <Text style={styles.menuItemText}>Add to playlist</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleShare} testID="now-playing-menu-share">
                <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
                <Text style={styles.menuItemText}>Share</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        )}

        <AddToPlaylistModal
          visible={playlistPickerVisible}
          trackId={currentTrack.id}
          trackTitle={currentTrack.title}
          onClose={() => setPlaylistPickerVisible(false)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  headerAlbum: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  artworkArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  artwork: {
    borderRadius: 16,
    backgroundColor: '#1E293B',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  details: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  artist: {
    color: '#5BA3D9',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  album: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 2,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#5BA3D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 24,
  },
  menuTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    gap: 16,
  },
  menuItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
