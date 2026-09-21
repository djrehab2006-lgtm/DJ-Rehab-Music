// Release notes shown once per build in the "What's New" card on Home.
// Update this list whenever app.json versionCode is bumped for a release.
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface WhatsNewItem {
  icon: IoniconName;
  title: string;
  text: string;
}

export const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  {
    icon: 'folder-open',
    title: 'Fresh folders',
    text: 'October 2026 New Releases (16 tracks), September 2026 Releases (28 tracks) and the Rock x Hip-Hop collection (39 tracks).',
  },
  {
    icon: 'swap-horizontal',
    title: 'Crossfade',
    text: 'Tracks now blend into each other with a smooth 4-second fade. Toggle it in Profile.',
  },
  {
    icon: 'play-skip-forward',
    title: 'Pick up where you left off',
    text: 'The app remembers your last track and position, ready to resume when you come back.',
  },
  {
    icon: 'color-palette',
    title: 'New look',
    text: 'Redesigned home screen with colorful collection tiles and matching track cards.',
  },
];
