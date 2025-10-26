import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Linking, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const [showContactModal, setShowContactModal] = useState(false);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Ionicons name="musical-notes" size={48} color="#1E293B" />
            </View>
          </View>
          <Text style={styles.appName}>DJ REHAB MUSIC</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowContactModal(true)}>
            <Ionicons name="mail-outline" size={24} color="#10B981" />
            <Text style={styles.actionButtonText}>Contact</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={24} color="#10B981" />
            <Text style={styles.actionButtonText}>Share App</Text>
          </TouchableOpacity>
        </View>

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
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.featureText}>Background playback</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.featureText}>Organized collections</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.featureText}>Search functionality</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.featureText}>Admin management</Text>
          </View>
        </View>
      </ScrollView>

      {/* Contact Modal */}
      <Modal visible={showContactModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="mail" size={48} color="#10B981" style={styles.modalIcon} />
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
  logo: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FCD34D', justifyContent: 'center', alignItems: 'center' },
  appName: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  appVersion: { fontSize: 14, color: '#94A3B8' },
  infoSection: { marginBottom: 24 },
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
    backgroundColor: '#10B981',
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
