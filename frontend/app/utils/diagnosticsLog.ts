import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_ENTRIES = 120;
const STORAGE_KEY = 'diagnostics_log';
const entries: string[] = [];
let previousEntries: string[] = [];
let previousLoaded: Promise<void> | null = null;
let saveQueued = false;
let captureInstalled = false;

// Month-day and time (UTC)
const stamp = () => new Date().toISOString().substring(5, 19).replace('T', ' ');

// The log is kept on the device so it survives the app being closed by the system: the report then
// shows what happened right before playback stopped. The previous run is read before it is overwritten.
const loadPrevious = (): Promise<void> => {
  if (!previousLoaded) {
    previousLoaded = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        previousEntries = raw ? JSON.parse(raw) : [];
      })
      .catch(() => {});
  }
  return previousLoaded;
};

const save = () => {
  if (saveQueued) return;
  saveQueued = true;
  loadPrevious()
    .then(() => {
      saveQueued = false;
      return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    })
    .catch(() => {});
};

const push = (line: string) => {
  entries.push(`${stamp()} ${line}`);
  if (entries.length > MAX_ENTRIES) entries.shift();
  save();
};

/** App-level diagnostic line (always kept). */
export function logDiag(message: string): void {
  push(`[app] ${message}`);
}

/**
 * Keeps the last console warnings/errors so native library messages (expo-audio logs its
 * service/lock-screen failures through console.warn/error) can be read from the Profile screen
 * in release builds where there is no debugger.
 */
export function installConsoleCapture(): void {
  if (captureInstalled) return;
  captureInstalled = true;
  const wrap = (level: 'warn' | 'error') => {
    const original = console[level];
    console[level] = (...args: unknown[]) => {
      try {
        const text = args
          .map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a)))
          .join(' ');
        push(`[${level}] ${text.substring(0, 400)}`);
      } catch {
        // ignore
      }
      original(...args);
    };
  };
  wrap('warn');
  wrap('error');
}

export function getDiagnosticsReport(extra: Record<string, string | number | boolean | null | undefined>): string {
  const constants = (Platform as any).constants ?? {};
  const device =
    Platform.OS === 'android'
      ? `Android ${constants.Release ?? '?'} (API ${Platform.Version}) · ${constants.Manufacturer ?? ''} ${constants.Model ?? ''}`.trim()
      : `${Platform.OS} ${Platform.Version}`;
  const lines = [
    `Device: ${device}`,
    ...Object.entries(extra).map(([k, v]) => `${k}: ${String(v)}`),
    '',
    '--- recent log ---',
    ...(entries.length > 0 ? entries : ['(nothing captured)']),
    '',
    '--- previous run (before the app was last closed) ---',
    ...(previousEntries.length > 0 ? previousEntries.slice(-60) : ['(none)']),
  ];
  return lines.join('\n');
}
