import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const [showContactModal, setShowContactModal] = useState(false);

  const handleShare = async () => {
    const appUrl = 'https://apps.apple.com/us/app/dj-rehab-music/id6752807769';
    try {
      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        await Linking.openURL(appUrl);
      } else {
        Alert.alert('Error', 'Unable to open App Store link');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open link');
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
});
