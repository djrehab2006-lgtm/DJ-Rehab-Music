import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Bright gradient pairs cycled across folder, track and playlist cards
export const CARD_GRADIENTS: [string, string][] = [
  ['#FF7B7B', '#FF3B3B'], // red
  ['#FF8AC8', '#FF2D95'], // pink
  ['#FFE566', '#FFC300'], // yellow
  ['#7BE495', '#2ECC71'], // green
];

// Full-bleed gradient background for a card. Parent must set overflow: 'hidden'
// so the gradient follows the card's rounded corners.
export function CardGradient({ index }: { index: number }) {
  return (
    <LinearGradient
      colors={CARD_GRADIENTS[index % CARD_GRADIENTS.length]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
