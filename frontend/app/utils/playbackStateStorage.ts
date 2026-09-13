import AsyncStorage from '@react-native-async-storage/async-storage';
import { HARDCODED_TRACKS, Track } from '../constants/musicData';

export interface SavedPlaybackState {
  trackId: string;
  queueIds: string[];
  originalQueueIds: string[];
  isShuffled: boolean;
  positionMillis: number;
  savedAt: number;
}

const KEY = 'last_playback_state';

// Minimum gap between periodic writes while a track is playing
export const SAVE_INTERVAL_MS = 5000;

export async function savePlaybackState(state: Omit<SavedPlaybackState, 'savedAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch (error) {
    console.error('Error saving playback state:', error);
  }
}

export async function loadPlaybackState(): Promise<SavedPlaybackState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.trackId !== 'string' || !Array.isArray(parsed.queueIds)) {
      return null;
    }
    return parsed as SavedPlaybackState;
  } catch (error) {
    console.error('Error loading playback state:', error);
    return null;
  }
}

export async function clearPlaybackState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (error) {
    console.error('Error clearing playback state:', error);
  }
}

// Resolve stored track IDs back to full track objects. Tracks that no longer
// exist in the library (removed in an update) are silently dropped.
export function resolveTracks(ids: string[]): Track[] {
  const byId = new Map(HARDCODED_TRACKS.map((t) => [t.id, t]));
  return ids.map((id) => byId.get(id)).filter((t): t is Track => !!t);
}
