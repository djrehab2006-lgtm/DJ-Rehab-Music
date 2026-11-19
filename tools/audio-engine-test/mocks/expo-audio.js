// Stand-in for expo-audio's Android side, as far as the lock screen is concerned.
//
// The one behaviour copied exactly from a real phone (lock screen report, build 5017, Samsung
// Android 16): the artwork address is turned into a java.net.URL BEFORE the native function runs,
// and a value it cannot parse makes the whole call fail, title included.

const JAVA_URL_PROTOCOLS = ['http', 'https', 'file', 'ftp', 'jar'];

function javaUrlError(spec) {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(spec);
  if (!match) return `no protocol: ${spec}`;
  if (!JAVA_URL_PROTOCOLS.includes(match[1].toLowerCase())) return `unknown protocol: ${match[1].toLowerCase()}`;
  return null;
}

const native = {
  decks: [],
  /** What the lock screen / car would show: the deck the media session is attached to and its details. */
  session: null,
  rejected: [], // calls the native side refused
  accepted: [], // calls that went through
  reset() {
    this.decks = [];
    this.session = null;
    this.rejected = [];
    this.accepted = [];
  },
};

function convertMetadata(fn, position, metadata) {
  const artwork = metadata?.artworkUrl;
  if (artwork === undefined || artwork === null) return;
  const problem = javaUrlError(String(artwork));
  if (!problem) return;
  const message =
    `Call to function 'AudioPlaylist.${fn}' has been rejected.\n` +
    `→ Caused by: The ${position} argument cannot be cast to type class expo.modules.audio.Metadata? ` +
    `(received class com.facebook.react.bridge.ReadableNativeMap)\n` +
    `→ Caused by: Cannot cast value for field 'artworkUrl' ('class java.net.URL?') in record 'class expo.modules.audio.Metadata?'.\n` +
    `→ Caused by: java.net.MalformedURLException: ${problem}`;
  native.rejected.push({ fn, title: metadata?.title, artwork });
  throw new Error(message);
}

class FakeDeck {
  constructor() {
    this.name = `deck${native.decks.length + 1}`;
    this.sources = [];
    this.currentIndex = 0;
    this.playing = false;
    this.currentTime = 0;
    this.duration = 200;
    this.volume = 1;
    this.isActiveForLockScreen = false;
    this.listeners = {};
    this.pending = [];
    native.decks.push(this);
  }

  get trackCount() {
    return this.sources.length;
  }

  addListener(event, callback) {
    (this.listeners[event] ??= new Set()).add(callback);
    return { remove: () => this.listeners[event].delete(callback) };
  }

  // Native events reach JS after the call that caused them has returned
  queue(event, payload) {
    this.pending.push([event, payload]);
  }

  flush() {
    const events = this.pending;
    this.pending = [];
    events.forEach(([event, payload]) => this.listeners[event]?.forEach((cb) => cb(payload)));
  }

  status(extra = {}) {
    return {
      playing: this.playing,
      isLoaded: true,
      isBuffering: false,
      trackCount: this.trackCount,
      currentTime: this.currentTime,
      duration: this.duration,
      currentIndex: this.currentIndex,
      volume: this.volume,
      didJustFinish: false,
      ...extra,
    };
  }

  /** Playback reached `seconds` of the current track. */
  tick(seconds) {
    this.currentTime = seconds;
    this.queue('playlistStatusUpdate', this.status());
    this.flush();
  }

  /** The native player moved to another track by itself (end of track, or Next on the lock screen / car). */
  moveTo(index) {
    const previousIndex = this.currentIndex;
    this.currentIndex = index;
    this.currentTime = 0;
    if (previousIndex !== index) this.queue('trackChanged', { previousIndex, currentIndex: index });
    this.flush();
  }

  clear() {
    this.sources = [];
    this.currentIndex = 0;
    this.currentTime = 0;
    this.playing = false;
  }
  add(source) {
    this.sources.push(source);
  }
  insert(source, index) {
    this.sources.splice(index, 0, source);
  }
  remove(index) {
    this.sources.splice(index, 1);
  }
  skipTo(index) {
    const previousIndex = this.currentIndex;
    this.currentIndex = index;
    this.currentTime = 0;
    if (previousIndex !== index) this.queue('trackChanged', { previousIndex, currentIndex: index });
  }
  play() {
    this.playing = true;
  }
  pause() {
    this.playing = false;
  }
  seekTo(seconds) {
    this.currentTime = seconds;
    return Promise.resolve();
  }
  destroy() {
    this.clearLockScreenControls();
  }
  release() {}

  setActiveForLockScreen(active, metadata, options) {
    convertMetadata('setActiveForLockScreen', '3rd', metadata);
    if (!active) {
      this.clearLockScreenControls();
      return;
    }
    native.decks.forEach((deck) => (deck.isActiveForLockScreen = deck === this));
    native.session = { deck: this, title: metadata?.title, artist: metadata?.artist, artwork: metadata?.artworkUrl };
    native.accepted.push({ fn: 'setActiveForLockScreen', deck: this.name, title: metadata?.title });
  }

  updateLockScreenMetadata(metadata) {
    convertMetadata('updateLockScreenMetadata', '2nd', metadata);
    if (process.env.REFUSE_UPDATES) {
      // Any other reason the native side may have to refuse an update
      native.rejected.push({ fn: 'updateLockScreenMetadata', title: metadata?.title, artwork: metadata?.artworkUrl });
      throw new Error("Call to function 'AudioPlaylist.updateLockScreenMetadata' has been rejected.");
    }
    if (!this.isActiveForLockScreen) return; // same as native: ignored without telling anyone
    native.session = { deck: this, title: metadata?.title, artist: metadata?.artist, artwork: metadata?.artworkUrl };
    native.accepted.push({ fn: 'updateLockScreenMetadata', deck: this.name, title: metadata?.title });
  }

  clearLockScreenControls() {
    if (!this.isActiveForLockScreen) return;
    this.isActiveForLockScreen = false;
    native.session = null;
  }
}

module.exports = {
  __native: native,
  createAudioPlaylist: () => new FakeDeck(),
  setAudioModeAsync: async () => {},
  requestNotificationPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
};
