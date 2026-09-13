import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Gradient pairs (top → bottom) shared by folder tiles, track rows and playlist cards
export const CARD_GRADIENTS: [string, string][] = [
  ['#5C6BC0', '#7E3FA5'], // indigo → purple
  ['#E8834E', '#C43E2F'], // orange → red
  ['#5DBE8C', '#2E7D5B'], // mint → green
  ['#D98A9A', '#7A5560'], // rose → mauve
  ['#A25AC5', '#5B3A8E'], // violet → deep purple
  ['#8FA88E', '#3E5A4A'], // sage → forest
  ['#D9707A', '#C97C3C'], // coral → orange
  ['#7FA8D9', '#3E6DB5'], // sky → blue
];

// Full-bleed gradient background for a card. Parent must set overflow: 'hidden'
// so the gradient follows the card's rounded corners.
export function CardGradient({ index }: { index: number }) {
  return (
    <LinearGradient
      colors={CARD_GRADIENTS[index % CARD_GRADIENTS.length]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
