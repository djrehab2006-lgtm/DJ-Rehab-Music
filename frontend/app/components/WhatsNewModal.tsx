import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { CARD_GRADIENTS } from './CardGradient';
import { WHATS_NEW_ITEMS } from '../constants/whatsNew';

const SEEN_KEY = 'whats_new_seen_build';

// Identifies the installed build; changes with every Play Store update
const CURRENT_BUILD = String(
  Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.version ?? 'dev'
);
const APP_VERSION = Constants.expoConfig?.version ?? '';

export function WhatsNewModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (seen !== CURRENT_BUILD) setVisible(true);
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(SEEN_KEY, CURRENT_BUILD).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient
            colors={CARD_GRADIENTS[0]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.badge}>
              <Text style={styles.badgeText}>NEW</Text>
            </View>
            <Text style={styles.title}>{"What's New"}</Text>
            {APP_VERSION ? <Text style={styles.version}>Version {APP_VERSION}</Text> : null}
          </LinearGradient>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {WHATS_NEW_ITEMS.map((item) => (
              <View key={item.title} style={styles.item}>
                <View style={styles.itemIcon}>
                  <Ionicons name={item.icon} size={20} color="#5BA3D9" />
                </View>
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemBody}>{item.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.button} onPress={dismiss} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{"Let's Go"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#15151C',
    borderRadius: 24,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5A623',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  version: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: 20,
    gap: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(91, 163, 217, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  itemBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#A0A0AB',
  },
  button: {
    margin: 20,
    marginTop: 4,
    backgroundColor: '#5BA3D9',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
