import AsyncStorage from '@react-native-async-storage/async-storage';

// Crossfade: the next track starts underneath the ending one and the two overlap for CROSSFADE_SEC.
export const CROSSFADE_SEC = 4;

// The incoming deck is started slightly early to cover its start-up latency
export const CROSSFADE_START_SEC = CROSSFADE_SEC + 0.3;

// How long before the end of a track the other deck is parked on the next track so it can buffer
export const CUE_AHEAD_SEC = 20;

// Shortest overlap (the incoming deck started late, or the listener seeked to the very end)
export const MIN_CROSSFADE_SEC = 0.5;

// The outgoing deck is stopped this close to its end, before it can roll over into the next track
export const FADE_END_GUARD_SEC = 0.25;

// Fades are driven by native status events, never by JS timers: Android suspends timers while the
// app is in the background / the screen is off, which used to leave the music stuck at silence.
export const STATUS_INTERVAL_MS = 100;

// Equal-power curves keep the overall loudness steady while two different tracks overlap
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const fadeInGain = (progress: number) => Math.sin((clamp01(progress) * Math.PI) / 2);
export const fadeOutGain = (progress: number) => Math.cos((clamp01(progress) * Math.PI) / 2);

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
