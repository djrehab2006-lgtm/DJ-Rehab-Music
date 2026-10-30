import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestNotificationPermissionsAsync } from 'expo-audio';

const PROMPT_COUNT_KEY = 'lockscreen_permission_prompts';
const MAX_AUTO_PROMPTS = 2;

export type LockScreenPermissionStatus = 'granted' | 'denied' | 'blocked';

/** Android 13+ only shows the media notification (lock screen controls) once notifications are allowed. */
export const needsLockScreenPermission = Platform.OS === 'android' && Number(Platform.Version) >= 33;

export async function hasLockScreenPermission(): Promise<boolean> {
  if (!needsLockScreenPermission) return true;
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    return false;
  }
}

/** Triggers the system prompt (no-op when already granted). */
export async function requestLockScreenPermission(): Promise<LockScreenPermissionStatus> {
  if (!needsLockScreenPermission) return 'granted';
  try {
    const response = await requestNotificationPermissionsAsync();
    if (response.granted) return 'granted';
    return response.canAskAgain ? 'denied' : 'blocked';
  } catch {
    return 'denied';
  }
}

/**
 * Contextual ask: runs when the listener starts playback. Explains the benefit first,
 * then shows the system prompt. Asked at most MAX_AUTO_PROMPTS times; afterwards the
 * listener can still enable it from Profile → Lock screen controls.
 */
export async function promptLockScreenPermissionOnPlay(onGranted: () => void): Promise<void> {
  if (!needsLockScreenPermission) return;
  if (await hasLockScreenPermission()) return;

  const count = Number((await AsyncStorage.getItem(PROMPT_COUNT_KEY)) ?? '0');
  if (count >= MAX_AUTO_PROMPTS) return;
  await AsyncStorage.setItem(PROMPT_COUNT_KEY, String(count + 1));

  Alert.alert(
    'Control music from your lock screen',
    'Allow notifications so you can play, pause and skip tracks from the lock screen and notification shade without opening the app.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Allow',
        onPress: async () => {
          const status = await requestLockScreenPermission();
          if (status === 'granted') onGranted();
        },
      },
    ]
  );
}

export function openLockScreenSettings(): void {
  Linking.openSettings();
}
