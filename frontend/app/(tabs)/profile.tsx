import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Linking, Alert, Share, Switch, AppState, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import {
  needsLockScreenPermission,
  hasLockScreenPermission,
  requestLockScreenPermission,
  openLockScreenSettings,
} from '../utils/lockScreenPermission';

export default function ProfileScreen() {
  const [showContactModal, setShowContactModal] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [report, setReport] = useState('');
  const [lockScreenAllowed, setLockScreenAllowed] = useState(true);
  const { crossfadeEnabled, setCrossfadeEnabled, refreshLockScreen, getLockScreenReport } = useAudioPlayer();

  const openDiagnostics = () => {
    setReport(
      `Notifications allowed: ${lockScreenAllowed ? 'yes' : 'no'}\n${getLockScreenReport()}`
    );
    setShowDiagnostics(true);
  };

  const shareReport = async () => {
    try {
      await Share.share({ message: report, title: 'DJ Rehab Music – lock screen report' });
    } catch {
      // user dismissed
    }
  };

  const checkLockScreenPermission = useCallback(() => {
    hasLockScreenPermission().then(setLockScreenAllowed);
  }, []);

  // Re-check when the tab is opened and when returning from system settings
  useFocusEffect(checkLockScreenPermission);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkLockScreenPermission();
    });
    return () => sub.remove();
  }, [checkLockScreenPermission]);

  const handleEnableLockScreen = async () => {
    const status = await requestLockScreenPermission();
    if (status === 'granted') {
      setLockScreenAllowed(true);
      refreshLockScreen();
      return;
    }
    if (status === 'blocked') {
      Alert.alert(
        'Notifications are turned off',
        'To show play, pause and skip controls on your lock screen, allow notifications for DJ Rehab Music in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: openLockScreenSettings },
        ]
      );
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: "I'm listening to the DJ Rehab Music App, now available in the Google Play store.",
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  const handleEmailPress = () => {
    Linking.openURL('mailto:djrehab2006@gmail.com');
  };

  const handleTikTokPress = () => {
    Linking.openURL('https://www.tiktok.com/@thedjrehab');
  };

  const handleInstagramPress = () => {
    Linking.openURL('https://www.instagram.com/djrehabevents/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* TikTok Button */}
        <TouchableOpacity style={styles.socialButton} onPress={handleTikTokPress}>
          <View style={styles.tiktokIconContainer}>
            <Ionicons name="logo-tiktok" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.socialTextContainer}>
            <Text style={styles.socialTitle}>Follow on TikTok</Text>
            <Text style={styles.socialHandle}>@thedjrehab</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#5BA3D9" />
        </TouchableOpacity>

        {/* Instagram Button */}
        <TouchableOpacity style={styles.socialButton} onPress={handleInstagramPress}>
          <View style={styles.instagramIconContainer}>
            <Ionicons name="logo-instagram" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.socialTextContainer}>
            <Text style={styles.socialTitle}>Follow on Instagram</Text>
            <Text style={styles.socialHandle}>@djrehabevents</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#5BA3D9" />
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowContactModal(true)}>
            <Ionicons name="mail-outline" size={24} color="#5BA3D9" />
            <Text style={styles.actionButtonText}>Contact</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={24} color="#5BA3D9" />
            <Text style={styles.actionButtonText}>Share App</Text>
          </TouchableOpacity>
        </View>

        {/* Playback Settings */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Playback</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="swap-horizontal" size={22} color="#5BA3D9" />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Crossfade</Text>
              <Text style={styles.settingSubtitle}>Smooth 4-second fade between tracks</Text>
            </View>
            <Switch
              value={crossfadeEnabled}
              onValueChange={setCrossfadeEnabled}
              trackColor={{ false: '#334155', true: '#5BA3D9' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#334155"
            />
          </View>
          {needsLockScreenPermission && (
            <TouchableOpacity style={styles.settingRow} onPress={openDiagnostics} activeOpacity={0.8}>
              <View style={styles.settingIcon}>
                <Ionicons name="phone-portrait-outline" size={22} color="#5BA3D9" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Lock screen controls</Text>
                <Text style={styles.settingSubtitle}>
                  {lockScreenAllowed
                    ? 'Tap for a troubleshooting report'
                    : 'Allow notifications to show player controls'}
                </Text>
              </View>
              {lockScreenAllowed ? (
                <Ionicons name="chevron-forward" size={22} color="#64748B" />
              ) : (
                <TouchableOpacity
                  style={styles.enableButton}
                  onPress={handleEnableLockScreen}
                  testID="enable-lock-screen-button"
                >
                  <Text style={styles.enableButtonText}>Enable</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Modal visible={showDiagnostics} animationType="slide" transparent onRequestClose={() => setShowDiagnostics(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.reportModal]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Lock screen report</Text>
                <TouchableOpacity onPress={() => setShowDiagnostics(false)}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.reportScroll}>
                <Text style={styles.reportText} selectable>
                  {report}
                </Text>
              </ScrollView>
              <TouchableOpacity style={styles.shareReportButton} onPress={shareReport}>
                <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                <Text style={styles.shareReportText}>Share report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.infoText}>
            Stream your favorite tracks from DJ Rehab's curated collections.
            Enjoy high-quality music streaming from CDN links.
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#5BA3D9" />
            <Text style={styles.featureText}>Background playback</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#5BA3D9" />
            <Text style={styles.featureText}>Organized collections</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#5BA3D9" />
            <Text style={styles.featureText}>Search functionality</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#5BA3D9" />
            <Text style={styles.featureText}>Shuffle & continuous play</Text>
          </View>
        </View>
      </ScrollView>

      {/* Contact Modal */}
      <Modal visible={showContactModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="mail" size={48} color="#5BA3D9" style={styles.modalIcon} />
            <Text style={styles.modalTitle}>Booking Inquiries</Text>
            <Text style={styles.modalText}>For booking inquiries, email:</Text>
            <TouchableOpacity onPress={handleEmailPress} style={styles.emailButton}>
              <Text style={styles.emailText}>djrehab2006@gmail.com</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowContactModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF' },
  content: { flex: 1, padding: 20 },
  card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24 },
  logoContainer: { marginBottom: 16 },
  logo: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#5BA3D9', justifyContent: 'center', alignItems: 'center' },
  appName: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  appVersion: { fontSize: 14, color: '#94A3B8' },
  tiktokIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  instagramIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E1306C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#5BA3D9',
  },
  socialTextContainer: {
    flex: 1,
  },
  socialTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  socialHandle: {
    fontSize: 14,
    color: '#5BA3D9',
  },
  infoSection: { marginBottom: 24 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  enableButton: {
    backgroundColor: '#5BA3D9',
    borderRadius: 20,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  enableButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(91, 163, 217, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: { flex: 1, marginRight: 12 },
  settingTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  settingSubtitle: { fontSize: 12, color: '#94A3B8' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 12 },
  infoText: { fontSize: 14, color: '#94A3B8', lineHeight: 22 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureText: { fontSize: 14, color: '#94A3B8', marginLeft: 12 },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  modalIcon: {
    marginBottom: 16,
  },
  reportModal: { alignItems: 'stretch', padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  reportScroll: { flexGrow: 0, marginBottom: 16 },
  reportText: { color: '#CBD5E1', fontSize: 12, lineHeight: 18, fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }) },
  shareReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5BA3D9',
    borderRadius: 12,
    minHeight: 48,
  },
  shareReportText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 16,
    textAlign: 'center',
  },
  emailButton: {
    backgroundColor: '#5BA3D9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
