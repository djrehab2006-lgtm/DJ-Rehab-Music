// Runs the app's real audio engine (frontend/app/utils/audioEngine.ts) against a stand-in for the
// native player that refuses bad artwork addresses the way a real Android phone does, and checks
// what would be on the lock screen / car display after every kind of track change.
import {
  initAudioEngine,
  playTrack,
  playNext,
  playPrevious,
  setCrossfadeEnabled,
  usePlayerStore,
  getLockScreenReport,
} from '../../frontend/app/utils/audioEngine';
import { HARDCODED_TRACKS } from '../../frontend/app/constants/musicData';

const { __native: native } = require('./mocks/expo-audio.js');
const { __mode: assetMode } = require('./mocks/expo-asset.js');

assetMode.release = process.env.BUILD !== 'dev';

let failures = 0;
const check = (what: string, actual: unknown, expected: unknown) => {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}\n        lock screen shows: ${JSON.stringify(actual)}${ok ? '' : `   expected: ${JSON.stringify(expected)}`}`);
};
const shown = () => native.session?.title ?? null;
const current = () => usePlayerStore.getState().currentTrack?.title ?? null;
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  native.decks.forEach((deck: any) => deck.flush());
};

async function main() {
  const folder = HARDCODED_TRACKS[0].folder_id;
  const queue = HARDCODED_TRACKS.filter((t) => t.folder_id === folder).slice(0, 10);
  console.log(`build: ${assetMode.release ? 'RELEASE (bundled image = resource name)' : 'DEVELOPMENT (bundled image = file://)'}, queue of ${queue.length}\n`);

  await initAudioEngine();

  await playTrack(queue[0], queue);
  await settle();
  check('1. start playing the first song', shown(), queue[0].title);

  await playNext();
  await settle();
  check('2. Next pressed in the app', shown(), queue[1].title);

  // Next on the lock screen / car / headset: the native player moves, then tells the app
  native.session.deck.moveTo(2);
  await settle();
  check('3. Next pressed on the lock screen or car', shown(), queue[2].title);
  check('   (app screen)', current(), queue[2].title);

  await playPrevious();
  await settle();
  check('4. Previous pressed in the app', shown(), queue[1].title);

  await playTrack(queue[4], queue);
  await settle();
  check('5. another song of the same list tapped', shown(), queue[4].title);

  // Automatic change with crossfade: the other deck starts under the end of the song and takes over
  const outgoing = native.session.deck;
  outgoing.tick(100);
  outgoing.tick(185); // 15 s left: other deck is prepared
  outgoing.tick(196); // 4 s left: other deck starts, silent
  const incoming = native.decks.find((deck: any) => deck !== outgoing && deck.playing);
  check('   (crossfade started on a second deck)', !!incoming, true);
  incoming?.tick(0.2); // really playing: becomes the current deck
  await settle();
  check('6. automatic change, crossfade ON', shown(), queue[5].title);
  check('   (controls moved to the deck that is playing)', native.session?.deck === incoming, true);
  outgoing.tick(199.9); // old deck reaches its end and is parked
  await settle();

  await playNext();
  await settle();
  check('7. Next pressed after a crossfade', shown(), queue[6].title);

  // Automatic change without crossfade: the same deck rolls into the next song
  setCrossfadeEnabled(false);
  const deck = native.session.deck;
  deck.tick(100);
  deck.tick(198);
  deck.moveTo(7);
  await settle();
  check('8. automatic change, crossfade OFF', shown(), queue[7].title);
  check('   (app screen)', current(), queue[7].title);

  console.log(`\nnative calls refused: ${native.rejected.length}` + (native.rejected[0] ? `  (e.g. ${native.rejected[0].fn} with artwork "${native.rejected[0].artwork}")` : ''));
  console.log(`artwork on the lock screen: ${native.session?.artwork ?? 'none'}`);
  console.log('\n--- report header as shown in Profile → Lock screen controls ---');
  console.log(getLockScreenReport().split('\n--- recent log ---')[0].trim());
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
