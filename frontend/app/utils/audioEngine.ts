import { AppState, Platform, type AppStateStatus } from 'react-native';
import { create } from 'zustand';
import {
  createAudioPlaylist,
  setAudioModeAsync,
  type AudioPlaylist,
  type AudioPlaylistStatus,
  type AudioMetadata,
  type AudioLockScreenOptions,
} from 'expo-audio';
import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import { TRACK_ICON, HARDCODED_FOLDERS } from '../constants/musicData';
import {
  savePlaybackState,
  loadPlaybackState,
  clearPlaybackState,
  resolveTracks,
  SAVE_INTERVAL_MS,
} from './playbackStateStorage';
import {
  CROSSFADE_SEC,
  CROSSFADE_START_SEC,
  CUE_AHEAD_SEC,
  MIN_CROSSFADE_SEC,
  FADE_END_GUARD_SEC,
  STATUS_INTERVAL_MS,
  fadeInGain,
  fadeOutGain,
  loadCrossfadeEnabled,
  saveCrossfadeEnabled,
} from './crossfadeSettings';
import { promptLockScreenPermissionOnPlay } from './lockScreenPermission';
import { installConsoleCapture, logDiag, getDiagnosticsReport } from './diagnosticsLog';

// The whole audio engine lives at module scope, NOT inside a React component.
//
// With the screen off Android may destroy the app's screen (Activity) while the music keeps the
// process alive. React Native then unmounts the component tree but keeps this JS runtime and the
// native players running. When the engine was owned by a provider component, that unmount ran its
// cleanup and destroyed the players in the middle of a song. Nothing in here depends on React
// being mounted: the UI only reads `usePlayerStore` and calls the exported controls.

installConsoleCapture();

export interface Track {
  id: string;
  title: string;
  artist: string;
  cdn_url: string;
  cover_art?: string | null;
  folder_id?: string;
}

export interface PlaybackStatus {
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  isLoaded: boolean;
}

interface PlayerState {
  currentTrack: Track | null;
  playlist: Track[]; // mirrors the native playlist order
  currentIndex: number;
  isShuffled: boolean;
  playbackStatus: PlaybackStatus;
  isLoading: boolean;
  crossfadeEnabled: boolean;
}

export const usePlayerStore = create<PlayerState>(() => ({
  currentTrack: null,
  playlist: [],
  currentIndex: -1,
  isShuffled: false,
  playbackStatus: { isPlaying: false, positionMillis: 0, durationMillis: 0, isLoaded: false },
  isLoading: false,
  crossfadeEnabled: true,
}));
const { getState, setState } = usePlayerStore;

const LOCK_SCREEN_OPTIONS: AudioLockScreenOptions = {
  showNextTrack: true,
  showPreviousTrack: true,
  showSeekForward: false,
  showSeekBackward: false,
};

// Status events arrive every STATUS_INTERVAL_MS to keep fades smooth; the UI only needs ~2 per second
const UI_STATUS_INTERVAL_MS = 450;

// Automatic restarts after a playback error, in a row, before waiting for the listener to press Play.
// Each failed attempt takes the native player a few seconds, so this rides out a short loss of signal.
const MAX_RESTARTS = 20;

// Native error codes (ExoPlayer) that mean the song itself cannot be played (missing or damaged
// file), as opposed to a lost connection. These songs are skipped instead of retried.
const BROKEN_SONG_CODES = [2003, 2004, 2005, 2006, 2008, 3001, 3002, 3003, 3004, 4001, 4002, 4003, 4004, 4005];

// Broken songs skipped in a row before waiting for the listener (protects against the whole
// music server being down)
const MAX_BROKEN_SKIPS = 5;

/** The folder a track belongs to, shown as its album. */
export const albumName = (t: Track) =>
  HARDCODED_FOLDERS.find((f) => f.id === t.folder_id)?.name ?? 'DJ Rehab Music';

// `artist` and `albumTitle` are read by the patched Android player (patches/expo-audio+*.patch) so
// every item of the native queue carries its own details for Bluetooth / car displays.
const toSource = (t: Track) => ({
  uri: t.cdn_url,
  name: t.title,
  artist: t.artist,
  albumTitle: albumName(t),
});

const sameQueue = (a: Track[], b: Track[]) =>
  a.length === b.length && a.every((t, i) => t.id === b[i].id);

// An overlap between two decks: `from` is playing out the end of its track while `to` plays the next one
interface Crossfade {
  from: AudioPlaylist;
  to: AudioPlaylist;
  fromIndex: number;
  toIndex: number;
  /** Overlap length in seconds; null until the incoming deck is really playing. */
  length: number | null;
}

// Two native playlists ("decks": ExoPlayer on Android, <audio> on web) hold the same queue so the
// next track can start underneath the ending one. `player` is always the deck that owns the current
// track (UI + lock screen); `idle` is the other one, created the first time it is needed.
let player: AudioPlaylist | null = null;
let idle: AudioPlaylist | null = null;
const deckSubs = new Map<AudioPlaylist, { remove: () => void }[]>();
const deckVersion = new Map<AudioPlaylist, number>(); // queue version loaded into each deck
const deadDecks = new Set<AudioPlaylist>(); // decks whose native player stopped with an error
let queueVersion = 0; // bumped whenever the queue content/order changes
let cuedIndex: number | null = null; // queue index the idle deck is parked on
let skipFadeIndex: number | null = null; // next track that could not be prepared for an overlap
let fade: Crossfade | null = null;
let uiStatus = { at: 0, isPlaying: false, isLoaded: false, durationMillis: 0 };
let originalPlaylist: Track[] = [];
let lastSave = 0;
let isRestoring = false;
let rebuilding = false; // suppress native events while the queue is rebuilt
let ended = false; // whole queue finished
let pendingSeekSec: number | null = null; // position to apply once the track is loaded
let artworkUrl: string | undefined;
let lockScreenDeck: AudioPlaylist | null = null; // deck Android's media session / foreground service is attached to
let lockScreenInfo: { attempts: number; updates: number; lastError: string | null } = {
  attempts: 0,
  updates: 0,
  lastError: null,
};
let wantsToPlay = false; // the listener's intent, used to decide whether to restart after an error
let restarts = 0; // automatic restarts in a row without the music moving forward
let restartedAtSec = 0;
let brokenSkips = 0; // broken songs skipped in a row
let totalRestarts = 0;
const skippedSongs: string[] = []; // titles of the broken songs skipped since the app started
let initPromise: Promise<void> | null = null;

const setLoading = (isLoading: boolean) => {
  if (getState().isLoading !== isLoading) setState({ isLoading });
};

const markNotPlaying = () => {
  uiStatus = { ...uiStatus, isPlaying: false };
  setState((s) => ({ isLoading: false, playbackStatus: { ...s.playbackStatus, isPlaying: false } }));
};

const setDeckVolume = (deck: AudioPlaylist | null, volume: number) => {
  if (!deck) return;
  try {
    deck.volume = Math.min(1, Math.max(0, volume));
  } catch {
    // deck released
  }
};

// Silence a deck that must not be heard (finished fading out, or never got to fade in)
const parkDeck = (deck: AudioPlaylist | null) => {
  if (!deck) return;
  try {
    deck.pause();
    deck.volume = 0;
  } catch {
    // deck released
  }
};

// End any overlap right now. If the incoming track is already audible it carries on alone at
// full volume, otherwise the current deck simply keeps playing.
const settleCrossfade = () => {
  const active = fade;
  if (!active) return;
  fade = null;
  cuedIndex = null;
  if (active.length === null) {
    parkDeck(active.to);
  } else {
    parkDeck(active.from);
    setDeckVolume(active.to, 1);
  }
};

export const setCrossfadeEnabled = (enabled: boolean) => {
  setState({ crossfadeEnabled: enabled });
  saveCrossfadeEnabled(enabled);
  if (!enabled) {
    settleCrossfade();
  }
};

// Persist "where the listener is" so the session can be resumed on next launch
const persistState = (positionMillis: number, track = getState().currentTrack) => {
  if (!track || isRestoring) return;
  lastSave = Date.now();
  const { playlist, isShuffled } = getState();
  savePlaybackState({
    trackId: track.id,
    queueIds: playlist.map((t) => t.id),
    originalQueueIds: originalPlaylist.map((t) => t.id),
    isShuffled,
    positionMillis: Math.max(0, Math.floor(positionMillis)),
  });
};

const applyQueueState = (tracks: Track[], original: Track[], shuffled: boolean, index: number) => {
  originalPlaylist = original.length > 0 ? original : tracks;
  setState({
    playlist: tracks,
    isShuffled: shuffled,
    currentIndex: index,
    currentTrack: tracks[index] ?? null,
  });
};

const setActiveTrack = (index: number) => {
  const track = getState().playlist[index];
  if (!track) return;
  skipFadeIndex = null;
  restarts = 0;
  setState({ currentIndex: index, currentTrack: track });
};

// ---- Lock screen / notification -------------------------------------------------

// Android turns the artwork address into a URL before it does anything else, and refuses the whole
// call (title and artist included) when it cannot. In an installed build (APK/AAB) a bundled image
// resolves to a resource name such as "assets_trackicon", not an address, so it is left out.
const usableArtwork = (url?: string | null) => (url && /^(https?|file):\/\//i.test(url) ? url : undefined);

const metadataFor = (track: Track): AudioMetadata => ({
  title: track.title,
  artist: track.artist,
  albumTitle: albumName(track),
  artworkUrl: usableArtwork(track.cover_art) ?? usableArtwork(artworkUrl),
});

// Attaches Android's media session (lock screen, notification, Bluetooth) to the current deck.
// This is also what runs the foreground service that lets music play with the screen off.
const activateLockScreen = (track: Track) => {
  if (!player) {
    logDiag('lockscreen: no player instance');
    return;
  }
  const metadata = metadataFor(track);
  try {
    player.setActiveForLockScreen(true, metadata, LOCK_SCREEN_OPTIONS);
    lockScreenDeck = player;
    lockScreenInfo = { ...lockScreenInfo, attempts: lockScreenInfo.attempts + 1, lastError: null };
    logDiag(`lockscreen: activated for "${track.title}" (artwork: ${metadata.artworkUrl ? 'yes' : 'none'})`);
  } catch (error: any) {
    const message = error?.message ?? String(error);
    logDiag(`lockscreen: setActiveForLockScreen threw: ${message}`);
    lockScreenInfo = { ...lockScreenInfo, attempts: lockScreenInfo.attempts + 1, lastError: message };
    // Retry without artwork in case the artwork URL is what the native side rejected
    try {
      player.setActiveForLockScreen(true, { ...metadata, artworkUrl: undefined }, LOCK_SCREEN_OPTIONS);
      lockScreenDeck = player;
      logDiag('lockscreen: activated without artwork');
    } catch (retryError: any) {
      logDiag(`lockscreen: retry without artwork threw: ${retryError?.message ?? String(retryError)}`);
    }
  }
};

// Every way of starting playback goes through here: a deck that plays without the media session
// has no foreground service, and Android stops it a few minutes after the screen turns off.
const showOnLockScreen = (track: Track) => {
  if (lockScreenDeck !== player) {
    activateLockScreen(track);
    return;
  }
  try {
    player?.updateLockScreenMetadata(metadataFor(track));
    lockScreenInfo = { ...lockScreenInfo, updates: lockScreenInfo.updates + 1 };
  } catch (error: any) {
    // The new title did not reach the lock screen: attach the controls again, which sends it too
    const message = error?.message ?? String(error);
    logDiag(`lockscreen: update for "${track.title}" was refused: ${message}`);
    activateLockScreen(track);
    lockScreenInfo = { ...lockScreenInfo, lastError: message };
  }
};

/** Re-posts the lock screen / notification controls for the current track (e.g. after permission granted). */
export const refreshLockScreen = () => {
  const track = getState().currentTrack;
  if (track) activateLockScreen(track);
};

/** Text report for troubleshooting playback and lock screen controls on a device. */
export const getLockScreenReport = () => {
  const { currentTrack, playlist, crossfadeEnabled } = getState();
  return getDiagnosticsReport({
    Build: `${Constants.expoConfig?.version ?? '?'} (${Constants.expoConfig?.android?.versionCode ?? '?'})`,
    'Current track': currentTrack?.title ?? '(none)',
    'Queue length': playlist.length,
    'Native tracks': player ? player.trackCount : 'no player',
    Playing: player ? player.playing : false,
    Crossfade: crossfadeEnabled ? (idle ? 'on (2 decks)' : 'on') : 'off',
    'Lock screen activations': lockScreenInfo.attempts,
    'Lock screen title updates': lockScreenInfo.updates,
    'Last lock screen error': lockScreenInfo.lastError ?? 'none',
    'Lock screen artwork': usableArtwork(artworkUrl) ?? `none (bundled image is "${artworkUrl ?? 'missing'}", not an address)`,
    'Playback restarts': totalRestarts,
    'Songs skipped': skippedSongs.length > 0 ? skippedSongs.join(' | ') : 'none',
  });
};

// ---- Decks -----------------------------------------------------------------------

const createDeck = (): AudioPlaylist => {
  const deck = createAudioPlaylist({ loop: 'none', updateInterval: STATUS_INTERVAL_MS });
  deckSubs.set(deck, [
    deck.addListener('playlistStatusUpdate', (status) => onStatus(deck, status)),
    deck.addListener('trackChanged', () => onTrackChanged(deck)),
  ]);
  return deck;
};

const disposeDeck = (deck: AudioPlaylist) => {
  deckSubs.get(deck)?.forEach((sub) => sub.remove());
  deckSubs.delete(deck);
  deckVersion.delete(deck);
  deadDecks.delete(deck);
  // A deck that still carries the media session also carries Android's foreground service:
  // releasing it would drop that service, so its native player is left alone.
  if (deck === lockScreenDeck) return;
  try {
    deck.destroy();
    deck.release();
  } catch {
    // already released
  }
};

const ensurePlayer = (): AudioPlaylist => {
  if (player) return player;
  player = createDeck();
  logDiag(
    `playlist created (setActiveForLockScreen: ${typeof (player as any).setActiveForLockScreen}, updateLockScreenMetadata: ${typeof (player as any).updateLockScreenMetadata})`
  );
  return player;
};

// The queue changed: the idle deck is rebuilt from it the next time it is needed
const markQueueChanged = () => {
  queueVersion += 1;
  cuedIndex = null;
  skipFadeIndex = null;
};

// Replace a deck's whole native queue (stops whatever it is playing)
const loadQueue = (deck: AudioPlaylist, tracks: Track[]) => {
  rebuilding = true;
  try {
    deck.clear();
    tracks.forEach((t) => deck.add(toSource(t)));
  } finally {
    rebuilding = false;
  }
  deckVersion.set(deck, queueVersion);
};

// ---- Recovery from playback errors -----------------------------------------------

// expo-audio never restarts a native player that stopped with an error (lost connection, bad
// stream), so the other deck (a new one if needed) takes over. The broken deck is only thrown
// away later, once the media session has moved off it.
const replaceDeadPlayer = (): AudioPlaylist => {
  const broken = player;
  if (idle && deadDecks.has(idle)) {
    disposeDeck(idle);
    idle = null;
  }
  const target = idle ?? createDeck();
  parkDeck(broken);
  player = target;
  idle = broken;
  cuedIndex = null;
  return target;
};

// Carry on with the current track, at the given position, on the other deck
const restartOnOtherDeck = (positionSec: number) => {
  const { currentTrack: track, currentIndex: index, playlist } = getState();
  if (!track) return;
  settleCrossfade();
  const deck = replaceDeadPlayer();
  if (deckVersion.get(deck) !== queueVersion) {
    loadQueue(deck, playlist);
  }
  if (deck.currentIndex !== index) {
    deck.skipTo(index);
  }
  pendingSeekSec = positionSec > 1 ? positionSec : null;
  deck.seekTo(Math.max(0, positionSec)).catch(() => {});
  setDeckVolume(deck, 1);
  ended = false;
  restartedAtSec = positionSec;
  setLoading(true);
  activateLockScreen(track);
  if (wantsToPlay) {
    deck.play();
  }
};

// The current song cannot be played at all: move on to the next one
const skipBrokenTrack = () => {
  const { currentIndex, playlist, currentTrack } = getState();
  const nextIndex = currentIndex + 1;
  if (currentTrack && !skippedSongs.includes(currentTrack.title)) {
    skippedSongs.push(currentTrack.title);
  }
  if (nextIndex >= playlist.length || brokenSkips >= MAX_BROKEN_SKIPS) {
    logDiag(
      nextIndex >= playlist.length
        ? 'the last song could not be played, stopped'
        : 'several songs in a row could not be played, waiting for Play'
    );
    wantsToPlay = false;
    markNotPlaying();
    return;
  }
  brokenSkips += 1;
  logDiag(`skipped "${currentTrack?.title ?? '?'}", moving to the next song`);
  try {
    setActiveTrack(nextIndex);
    restartOnOtherDeck(0);
    persistState(0, playlist[nextIndex]);
  } catch (skipError: any) {
    logDiag(`skip failed: ${skipError?.message ?? String(skipError)}`);
    markNotPlaying();
  }
};

const onDeckError = (deck: AudioPlaylist, positionSec: number, error: any) => {
  if (deadDecks.has(deck)) return;
  deadDecks.add(deck);
  const reason = `${error?.message ?? 'unknown error'} (code ${error?.code ?? '?'})`;

  if (deck !== player) {
    logDiag(`crossfade: the other deck failed: ${reason}`);
    const active = fade;
    const isOutgoing = !!active && deck === active.from && active.length !== null;
    if (!isOutgoing) {
      // The next track could not be loaded for the overlap: the current deck rolls into it by itself
      skipFadeIndex = getState().currentIndex + 1;
      cuedIndex = null;
    }
    if (active && (deck === active.from || deck === active.to)) {
      settleCrossfade();
    }
    return;
  }

  const resumeAt = pendingSeekSec ?? positionSec;
  logDiag(`playback error at ${Math.floor(resumeAt)}s of "${getState().currentTrack?.title ?? '?'}": ${reason}`);
  if (!wantsToPlay) {
    markNotPlaying();
    return;
  }
  if (BROKEN_SONG_CODES.includes(error?.code)) {
    skipBrokenTrack();
    return;
  }
  if (restarts >= MAX_RESTARTS) {
    logDiag('playback could not be restarted, waiting for Play');
    wantsToPlay = false;
    markNotPlaying();
    return;
  }
  restarts += 1;
  totalRestarts += 1;
  logDiag(`restarting playback (attempt ${restarts})`);
  try {
    restartOnOtherDeck(resumeAt);
  } catch (restartError: any) {
    logDiag(`restart failed: ${restartError?.message ?? String(restartError)}`);
    markNotPlaying();
  }
};

// ---- Native status events --------------------------------------------------------

// The UI only needs a couple of updates per second (and every play/pause/load change)
const publishStatus = (next: PlaybackStatus) => {
  const now = Date.now();
  if (
    now - uiStatus.at < UI_STATUS_INTERVAL_MS &&
    uiStatus.isPlaying === next.isPlaying &&
    uiStatus.isLoaded === next.isLoaded &&
    uiStatus.durationMillis === next.durationMillis
  ) {
    return;
  }
  uiStatus = {
    at: now,
    isPlaying: next.isPlaying,
    isLoaded: next.isLoaded,
    durationMillis: next.durationMillis,
  };
  setState({ playbackStatus: next });
};

// Everything that happens while a track plays (fade steps, moving to the next track, recovery) is
// driven from here, by native status events. JS timers are never used: Android suspends them while
// the app is in the background, native events keep arriving.
function onStatus(deck: AudioPlaylist, status: AudioPlaylistStatus) {
  if (rebuilding) return;

  const error = (status as any).error;
  if (error) {
    onDeckError(deck, status.currentTime, error);
    return;
  }
  // Android only: the native player was stopped without an error (a Stop command from a car
  // stereo, a headset or the system). It cannot simply be resumed, so Play restarts it on the other deck.
  if (
    Platform.OS === 'android' &&
    !status.playing &&
    !status.isLoaded &&
    !status.isBuffering &&
    status.trackCount > 0 &&
    !deadDecks.has(deck)
  ) {
    deadDecks.add(deck);
    if (fade && (deck === fade.from || deck === fade.to)) {
      settleCrossfade();
    }
    if (deck === player) {
      logDiag(`playback was stopped from outside the app at ${Math.floor(status.currentTime)}s`);
      wantsToPlay = false;
      markNotPlaying();
    } else {
      cuedIndex = null;
    }
    return;
  }
  // Restarted from outside the app (Play on the lock screen prepares the native player again)
  if (status.playing && !status.isBuffering && deadDecks.has(deck)) {
    deadDecks.delete(deck);
  }

  const active = fade;

  // Incoming deck still starting up: the overlap begins once it is really playing
  if (active && deck === active.to && active.length === null) {
    if (!(status.playing && status.currentIndex === active.toIndex && status.currentTime > 0)) return;
    commitCrossfade(active);
  }

  if (deck !== player) {
    if (active && deck === active.from && active.length !== null) {
      // Outgoing deck: fade out over what is left of its track, then stop it before it rolls over
      const remaining = status.duration - status.currentTime;
      if (
        !status.playing ||
        status.currentIndex !== active.fromIndex ||
        remaining <= FADE_END_GUARD_SEC ||
        remaining > active.length + 1
      ) {
        settleCrossfade();
      } else {
        setDeckVolume(deck, fadeOutGain(1 - remaining / active.length));
      }
    } else if (status.playing) {
      // A parked deck must never be heard (e.g. resumed by the system after an interruption)
      parkDeck(deck);
    }
    return;
  }

  // ---- Current deck ----
  const positionMillis = Math.floor(status.currentTime * 1000);
  const durationMillis = Math.floor(status.duration * 1000);

  publishStatus({
    isPlaying: status.playing,
    positionMillis,
    durationMillis,
    isLoaded: status.isLoaded,
  });

  if (status.isLoaded || status.playing) {
    setLoading(false);
  }
  if (status.playing) {
    ended = false;
    wantsToPlay = true;
    if (restarts > 0 && status.currentTime > restartedAtSec + 5) {
      restarts = 0;
    }
    if (brokenSkips > 0 && status.currentTime > 5) {
      brokenSkips = 0;
    }
  } else if (status.isLoaded && !status.isBuffering && status.currentTime > 0.5) {
    // Really paused, from inside or outside the app (lock screen, headset, phone call)
    wantsToPlay = false;
  }

  // Apply a restored position once the track is actually loaded
  if (pendingSeekSec !== null && status.isLoaded) {
    const target = pendingSeekSec;
    pendingSeekSec = null;
    if (Math.abs(status.currentTime - target) > 1) {
      deck.seekTo(target).catch(() => {});
    }
  }

  // Periodically remember the position while playing
  if (status.playing && Date.now() - lastSave > SAVE_INTERVAL_MS) {
    persistState(positionMillis);
  }

  if (active && fade === active) {
    if (!status.playing) {
      // Paused from outside the app (lock screen, headset, phone call) in the middle of an overlap
      settleCrossfade();
    } else if (deck === active.to && active.length !== null) {
      setDeckVolume(deck, fadeInGain(status.currentTime / active.length));
    }
  } else if (!fade) {
    // Playing alone: always at full volume
    if (status.volume < 1) {
      setDeckVolume(deck, 1);
    }
    // Near the end of the track (and another one follows): get the other deck ready, then start it
    const { currentIndex: index, playlist, crossfadeEnabled } = getState();
    if (
      crossfadeEnabled &&
      status.playing &&
      status.currentIndex === index &&
      index < playlist.length - 1 &&
      skipFadeIndex !== index + 1 &&
      status.duration > 0
    ) {
      const remaining = status.duration - status.currentTime;
      if (remaining <= CROSSFADE_START_SEC) {
        startCrossfade(index + 1);
      } else if (remaining <= CUE_AHEAD_SEC) {
        cueIdleDeck(index + 1);
      }
    }
  }

  // Whole queue finished: next launch should start the last track from the top
  if (status.didJustFinish && status.trackCount > 0) {
    ended = true;
    wantsToPlay = false;
    settleCrossfade();
    persistState(0);
    markNotPlaying();
  }
}

function onTrackChanged(deck: AudioPlaylist) {
  if (rebuilding) return;
  const active = fade;
  if (active) {
    const liveIndex = deck.currentIndex;
    // Echo of parking the incoming deck on its track
    if (deck === active.to && liveIndex === active.toIndex) return;
    if (deck === active.from && liveIndex === active.fromIndex) return;
    // One of the two decks moved on by itself: the outgoing track ran out before the next one was
    // ready, or next/previous was pressed on the lock screen. Stop overlapping.
    if (active.length === null && deck === active.from) {
      logDiag('crossfade: next track was not ready in time, continued without overlap');
    }
    settleCrossfade();
  }
  if (deck !== player) return; // the other deck being parked on its track

  // Read the live index: stale events from a queue rebuild then resolve correctly
  const index = deck.currentIndex;
  const track = getState().playlist[index];
  if (!track) return;

  // The deck moved to this track on its own: it plays alone, at full volume
  setDeckVolume(deck, 1);

  if (getState().currentTrack?.id !== track.id) {
    setActiveTrack(index);
    showOnLockScreen(track);
    persistState(0, track);
  }
}

// ---- Crossfade (two decks overlapping) -------------------------------------------

// Park the other deck, silent, on the upcoming track so it has buffered by the time it is needed
const cueIdleDeck = (index: number) => {
  if (cuedIndex === index) return;
  try {
    if (idle && deadDecks.has(idle)) {
      disposeDeck(idle);
      idle = null;
    }
    let deck = idle;
    if (!deck) {
      deck = createDeck();
      idle = deck;
      logDiag('crossfade: second deck created');
    }
    deck.pause();
    setDeckVolume(deck, 0);
    if (deckVersion.get(deck) !== queueVersion) {
      loadQueue(deck, getState().playlist);
    }
    if (deck.currentIndex !== index) {
      deck.skipTo(index);
    } else {
      deck.seekTo(0).catch(() => {});
    }
    cuedIndex = index;
  } catch (error: any) {
    skipFadeIndex = index;
    logDiag(`crossfade: could not prepare the next track: ${error?.message ?? String(error)}`);
  }
};

// Start the next track, silent, on the other deck. Nothing is faded until it is really playing,
// so if it never starts the current deck just moves on to the next track by itself.
const startCrossfade = (nextIndex: number) => {
  const from = player;
  if (!from || fade) return;
  try {
    const currentIndex = getState().currentIndex;
    // Status events can be stale right after a manual skip: confirm with the live player first
    if (!from.playing || from.currentIndex !== currentIndex) return;
    const duration = from.duration;
    if (!(duration > 0) || duration - from.currentTime > CROSSFADE_START_SEC) return;
    cueIdleDeck(nextIndex);
    const to = idle;
    if (!to || cuedIndex !== nextIndex) return;
    to.volume = 0;
    to.play();
    fade = { from, to, fromIndex: currentIndex, toIndex: nextIndex, length: null };
  } catch (error: any) {
    skipFadeIndex = nextIndex;
    logDiag(`crossfade: could not start the next track: ${error?.message ?? String(error)}`);
  }
};

// The incoming deck is really playing: it becomes the current deck and the two tracks overlap
// for whatever is left of the outgoing one.
const commitCrossfade = (active: Crossfade) => {
  const track = getState().playlist[active.toIndex];
  if (!track) {
    settleCrossfade();
    return;
  }
  let remaining = CROSSFADE_SEC;
  try {
    remaining = active.from.duration - active.from.currentTime;
  } catch {
    // deck released
  }
  if (remaining > CROSSFADE_START_SEC + 1) {
    // The outgoing track was seeked away from its end in the meantime: nothing to blend into
    settleCrossfade();
    return;
  }
  active.length = Math.min(CROSSFADE_SEC, Math.max(MIN_CROSSFADE_SEC, remaining));
  player = active.to;
  idle = active.from;
  cuedIndex = null;
  setLoading(false);
  setActiveTrack(active.toIndex);
  // Moves the lock screen / Bluetooth controls over to the deck that is now current
  activateLockScreen(track);
  persistState(0, track);
  logDiag(
    `crossfade: mixing into "${track.title}" over ${active.length.toFixed(1)}s (app ${AppState.currentState})`
  );
};

// Reorder the native queue around the current track without interrupting playback
const reorderQueue = (deck: AudioPlaylist, newQueue: Track[], keepPlaying: Track | null) => {
  rebuilding = true;
  try {
    const target = keepPlaying ? newQueue.findIndex((t) => t.id === keepPlaying.id) : -1;
    if (target < 0) {
      deck.clear();
      newQueue.forEach((t) => deck.add(toSource(t)));
      return;
    }
    const keepIndex = deck.currentIndex;
    for (let i = deck.trackCount - 1; i >= 0; i--) {
      if (i !== keepIndex) deck.remove(i);
    }
    // The current track is now alone at index 0
    for (let i = 0; i < target; i++) {
      deck.insert(toSource(newQueue[i]), i);
    }
    for (let i = target + 1; i < newQueue.length; i++) {
      deck.add(toSource(newQueue[i]));
    }
  } finally {
    rebuilding = false;
  }
};

// ---- Start-up --------------------------------------------------------------------

const restoreSession = async () => {
  isRestoring = true;
  try {
    const saved = await loadPlaybackState();
    if (!saved) return;
    const tracks = resolveTracks(saved.queueIds);
    if (tracks.length === 0) return;

    const savedIndex = tracks.findIndex((t) => t.id === saved.trackId);
    const index = savedIndex >= 0 ? savedIndex : 0;
    const positionSec = savedIndex >= 0 ? saved.positionMillis / 1000 : 0;

    applyQueueState(tracks, resolveTracks(saved.originalQueueIds), saved.isShuffled, index);

    const deck = ensurePlayer();
    markQueueChanged();
    loadQueue(deck, tracks);
    deck.skipTo(index);
    if (positionSec > 0) {
      pendingSeekSec = positionSec;
      await deck.seekTo(positionSec);
    }
    setState({
      playbackStatus: {
        isPlaying: false,
        positionMillis: Math.floor(positionSec * 1000),
        durationMillis: 0,
        isLoaded: false,
      },
    });
  } catch (error) {
    console.error('Error restoring playback session:', error);
  } finally {
    isRestoring = false;
  }
};

const onAppStateChange = (state: AppStateStatus) => {
  logDiag(`app ${state}`);
  if (state !== 'background' && state !== 'inactive') return;
  // Save the exact position when the app goes to the background
  if (!player) return;
  try {
    persistState(player.currentTime * 1000);
  } catch {
    // player not ready
  }
};

// Configure the audio session, prepare lock screen artwork, then restore the last session
const init = async () => {
  AppState.addEventListener('change', onAppStateChange);
  loadCrossfadeEnabled().then((enabled) => setState({ crossfadeEnabled: enabled }));
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
    logDiag('audio mode set (background + doNotMix)');
  } catch (error: any) {
    console.error('Error configuring audio session:', error);
    logDiag(`audio mode FAILED: ${error?.message ?? String(error)}`);
  }
  try {
    const asset = await Asset.fromModule(TRACK_ICON).downloadAsync();
    artworkUrl = asset.localUri ?? asset.uri;
    logDiag(`artwork resolved: ${artworkUrl}${usableArtwork(artworkUrl) ? '' : ' (not an address: lock screen shows no artwork)'}`);
  } catch (error: any) {
    logDiag(`artwork unavailable: ${error?.message ?? String(error)}`);
  }
  await restoreSession();
};

/** Starts the engine once per app process; later calls (the UI mounting again) do nothing. */
export const initAudioEngine = (): Promise<void> => {
  if (!initPromise) {
    initPromise = init();
  }
  return initPromise;
};

// ---- Controls --------------------------------------------------------------------

export const playTrack = async (track: Track, newPlaylist?: Track[]) => {
  try {
    setLoading(true);
    settleCrossfade();
    wantsToPlay = true;
    restarts = 0;
    brokenSkips = 0;
    if (player && deadDecks.has(player)) {
      replaceDeadPlayer();
    }
    const deck = ensurePlayer();
    let rebuilt = false;

    let queue = getState().playlist;
    const needsRebuild =
      (newPlaylist && newPlaylist.length > 0 && (getState().isShuffled || !sameQueue(newPlaylist, queue))) ||
      deck.trackCount !== queue.length ||
      deckVersion.get(deck) !== queueVersion;

    if (newPlaylist && newPlaylist.length > 0 && needsRebuild) {
      queue = newPlaylist;
      const index = Math.max(0, queue.findIndex((t) => t.id === track.id));
      applyQueueState(queue, queue, false, index);
      markQueueChanged();
      loadQueue(deck, queue);
      rebuilt = true;
    } else if (needsRebuild) {
      loadQueue(deck, queue);
      rebuilt = true;
    }

    const index = Math.max(0, queue.findIndex((t) => t.id === track.id));
    setActiveTrack(index);

    // Manual selection always starts at full volume
    setDeckVolume(deck, 1);
    ended = false;
    pendingSeekSec = null;

    deck.skipTo(index);
    // The media session is only rebuilt when the queue itself changed; rebuilding it on every tap
    // makes the lock screen and car display drop out for a moment.
    if (rebuilt) {
      activateLockScreen(queue[index]);
    } else {
      showOnLockScreen(queue[index]);
    }
    deck.play();
    persistState(0, queue[index]);
    // Android 13+: controls only appear once notifications are allowed — ask contextually on first play
    promptLockScreenPermissionOnPlay(refreshLockScreen);
  } catch (error) {
    console.error('Error playing track:', error);
    setLoading(false);
  }
};

export const pauseTrack = async () => {
  settleCrossfade();
  wantsToPlay = false;
  if (!player) return;
  try {
    player.pause();
    persistState(player.currentTime * 1000);
  } catch (error) {
    console.error('Error pausing track:', error);
  }
};

export const resumeTrack = async () => {
  const { currentTrack: track, currentIndex, playbackStatus } = getState();
  if (!player || !track) return;
  try {
    wantsToPlay = true;
    restarts = 0;
    if (deadDecks.has(player)) {
      restartOnOtherDeck(ended ? 0 : playbackStatus.positionMillis / 1000);
      return;
    }
    if (ended) {
      // Queue already finished: restart the current track from the top
      ended = false;
      player.skipTo(Math.max(0, currentIndex));
    }
    showOnLockScreen(track);
    player.play();
  } catch (error) {
    console.error('Error resuming track:', error);
  }
};

export const stopTrack = async () => {
  try {
    settleCrossfade();
    wantsToPlay = false;
    rebuilding = true;
    try {
      [player, idle].forEach((deck) => {
        if (!deck) return;
        deck.pause();
        deck.clearLockScreenControls();
        deck.clear();
      });
    } finally {
      rebuilding = false;
    }
    lockScreenDeck = null;
    markQueueChanged();
    setState({
      playlist: [],
      currentIndex: -1,
      currentTrack: null,
      playbackStatus: { isPlaying: false, positionMillis: 0, durationMillis: 0, isLoaded: false },
    });
    clearPlaybackState();
  } catch (error) {
    console.error('Error stopping track:', error);
  }
};

export const seekTo = async (positionMillis: number) => {
  settleCrossfade();
  if (!player) return;
  try {
    pendingSeekSec = null;
    await player.seekTo(positionMillis / 1000);
    setState((s) => ({ playbackStatus: { ...s.playbackStatus, positionMillis } }));
  } catch (error) {
    console.error('Error seeking:', error);
  }
};

const skipTo = (index: number) => {
  settleCrossfade();
  const track = getState().playlist[index];
  if (!player || !track) return;
  try {
    setLoading(true);
    wantsToPlay = true;
    ended = false;
    brokenSkips = 0;
    setActiveTrack(index);
    if (deadDecks.has(player)) {
      restartOnOtherDeck(0);
    } else {
      // Manual skips always start at full volume
      setDeckVolume(player, 1);
      pendingSeekSec = null;
      player.skipTo(index);
      showOnLockScreen(track);
      player.play();
    }
    persistState(0, track);
  } catch (error) {
    console.error('Error skipping track:', error);
    setLoading(false);
  }
};

export const playNext = async () => {
  const { currentIndex, playlist } = getState();
  if (currentIndex < playlist.length - 1) {
    skipTo(currentIndex + 1);
  }
};

export const playPrevious = async () => {
  const { currentIndex } = getState();
  if (currentIndex > 0) {
    skipTo(currentIndex - 1);
  }
};

export const shufflePlaylist = () => {
  settleCrossfade();
  const { currentTrack: current, playlist: queue, isShuffled } = getState();

  let newQueue: Track[];
  let shuffled: boolean;
  if (isShuffled) {
    // Restore original order
    newQueue = originalPlaylist;
    shuffled = false;
  } else {
    // Shuffle keeping the current track first
    const others = queue.filter((t) => t.id !== current?.id);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    newQueue = current ? [current, ...others] : others;
    shuffled = true;
  }

  const newIndex = current ? Math.max(0, newQueue.findIndex((t) => t.id === current.id)) : 0;
  setState({ playlist: newQueue, isShuffled: shuffled, currentIndex: newIndex });

  markQueueChanged();
  if (player) {
    try {
      reorderQueue(player, newQueue, current);
      deckVersion.set(player, queueVersion);
    } catch (error) {
      console.error('Error reordering queue:', error);
    }
  }
  if (current) {
    persistState(player ? player.currentTime * 1000 : 0, current);
  }
};

if (__DEV__) {
  // Development only: lets the recovery path be exercised without a real network failure
  (globalThis as any).__audioEngineDebug = {
    failCurrentDeck: (code = 0) => {
      if (player) {
        deadDecks.delete(player);
        onDeckError(player, player.currentTime, { message: 'simulated failure', code });
      }
    },
    report: getLockScreenReport,
  };
}
