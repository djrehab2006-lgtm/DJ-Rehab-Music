import AsyncStorage from '@react-native-async-storage/async-storage';

// Fixed crossfade length: outgoing track fades out over the last 4s,
// incoming track fades in over its first 4s.
export const CROSSFADE_MS = 4000;
export const CROSSFADE_SEC = CROSSFADE_MS / 1000;

// How often fade volume is updated
export const FADE_TICK_MS = 100;

const KEY = 'crossfade_enabled';

// Defaults to ON for new installs
export async function loadCrossfadeEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function saveCrossfadeEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error saving crossfade setting:', error);
  }
}
