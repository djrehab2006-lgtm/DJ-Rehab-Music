# DJ Rehab Music — PRD

## Goal
Standalone Android music streaming app (Expo / React Native) for Google Play. No backend — all music hardcoded in `frontend/app/constants/musicData.ts`.

## Core Features (Done)
- Home screen (user mockup, June 2026): hero photo fading to near-black bg (#0B0B0F) with 'WELCOME TO' eyebrow + 'DJ Rehab Music'; 'Your Collections' header with count pill; 2-column square tile grid, each tile with one of 8 gradients (indigo→purple, orange→red, mint→green, rose→mauve, violet→purple, sage→forest, coral→orange, sky→blue), faded DJ REHAB logo watermark, white bold title, dark 'N TRACKS' pill; first tile has orange NEW badge. Drag-to-reorder folders removed (was never persisted).
- Track rows (folder/search/playlist views) & Library playlist cards share the SAME 8-gradient palette as folder tiles (`CARD_GRADIENTS` in `app/components/CardGradient.tsx`) with white bold 15px titles / 80% white subtitles / white icons; compact rows; folder tracks numbered. Track-row DJ Rehab icon REMOVED (June 2026) from folder/search/playlist/favorites rows; Blue Icon still used in mini player + lock screen
- Background / lock-screen playback via patched `react-native-track-player` (Android); `expo-av` fallback on web
- Local favorites & playlists (AsyncStorage + expo-file-system backup)
- Resume Playback: last track, position, queue & shuffle state saved (AsyncStorage `last_playback_state`, via app/utils/playbackStateStorage.ts); restored PAUSED in mini-player on launch (native syncs with live TrackPlayer queue if still running)
- Local search over musicData
- Share button (native share sheet → Google Play URL)
- Target/compile SDK 36

- Crossfade (June 2026): fixed 4s fade-out of outgoing track (last 4s, only if a next track exists) → 4s fade-in of the next track on AUTOMATIC transitions; manual taps/skips start at full volume. Toggle in Profile → Playback (AsyncStorage `crossfade_enabled`, default ON). Native uses TrackPlayer.setVolume, web uses Sound.setVolumeAsync; 100ms fade ticks. Constants in `app/utils/crossfadeSettings.ts`. True overlapping crossfade NOT possible with single-player RNTP.

## Build Info
- `app.json` → `expo.android.versionCode`: **2000** (bumped June 2026)
- User builds locally with EAS on Mac. **Must download latest code from Emergent before building.**

## Backlog
- Yacht Rock x Hip-Hop Mashups folder removed (June 2026) — re-add when tracks are ready
- "Rock x Hip-Hop" folder (id `rock-x-hiphop`, position 3, between Country X Hip-Hop and August Releases) created June 2026 — 39 tracks added (ids `rxh-track-1..39`)
- Migrate web fallback from `expo-av` → `expo-audio`
- Move non-route files out of `app/` to silence expo-router warnings
- Optional: sleep timer, repeat modes
