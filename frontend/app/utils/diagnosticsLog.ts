import { Platform } from 'react-native';

const MAX_ENTRIES = 60;
const entries: string[] = [];
let captureInstalled = false;

const stamp = () => new Date().toISOString().substring(11, 19);

const push = (line: string) => {
  entries.push(`${stamp()} ${line}`);
  if (entries.length > MAX_ENTRIES) entries.shift();
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
  ];
  return lines.join('\n');
}
