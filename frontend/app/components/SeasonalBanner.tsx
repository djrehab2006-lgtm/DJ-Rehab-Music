import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Folder } from '../constants/musicData';

// Folder the Home banner opens. The banner is hidden if this folder does not exist.
export const SEASONAL_FOLDER_ID = 'christmas-house-party';

// Bright Christmas red, deepening towards the right-hand edge
const BANNER_GRADIENT: [string, string, string] = ['#FF2A2A', '#E20A1A', '#A8000F'];

// Decorative snowflakes scattered over the right-hand side, clear of the text
const SNOWFLAKES = [
  { right: -26, top: -30, size: 132, opacity: 0.13 },
  { right: 78, top: 12, size: 16, opacity: 0.5 },
  { right: 112, bottom: 14, size: 12, opacity: 0.4 },
  { right: 62, bottom: 6, size: 22, opacity: 0.24 },
  { right: 150, top: 8, size: 10, opacity: 0.38 },
];

interface SeasonalBannerProps {
  folder: Folder;
  trackCount: number;
  onPress: () => void;
}

export function SeasonalBanner({ folder, trackCount, onPress }: SeasonalBannerProps) {
  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`Open ${folder.name}, ${trackCount} tracks`}
      testID="seasonal-banner"
    >
      <LinearGradient
        colors={BANNER_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {SNOWFLAKES.map(({ size, opacity, ...position }, index) => (
          <Ionicons
            key={index}
            name="snow"
            size={size}
            color="#FFFFFF"
            style={[styles.snowflake, position, { opacity }]}
          />
        ))}
      </View>

      <View style={styles.textBlock}>
        <View style={styles.eyebrowPill}>
          <Ionicons name="gift" size={11} color="#FFFFFF" />
          <Text style={styles.eyebrow}>HOLIDAY SPECIAL</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{folder.name}</Text>
        <Text style={styles.subtitle}>{trackCount} tracks · Tap to open</Text>
      </View>

      <View style={styles.cta}>
        <Ionicons name="arrow-forward" size={20} color="#D80016" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 112,
    borderRadius: 22,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 28,
    backgroundColor: '#D80016',
  },
  snowflake: { position: 'absolute' },
  textBlock: { flex: 1, paddingRight: 12 },
  eyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#FFFFFF',
    marginLeft: 6,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    lineHeight: 25,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  cta: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
