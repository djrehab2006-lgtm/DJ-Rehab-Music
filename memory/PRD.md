# DJ Rehab Music — PRD

## Goal
Standalone Android music streaming app (Expo / React Native) for Google Play. No backend — all music hardcoded in `frontend/app/constants/musicData.ts`.

## Core Features (Done)
- Home screen (user mockup, June 2026): hero photo fading to near-black bg (#0B0B0F) with 'WELCOME TO' eyebrow + 'DJ Rehab Music'; 'Your Collections' header with count pill; 2-column square tile grid, each tile with one of 8 gradients (indigo→purple, orange→red, mint→green, rose→mauve, violet→purple, sage→forest, coral→orange, sky→blue), faded DJ REHAB logo watermark, white bold title, dark 'N TRACKS' pill; first tile has orange NEW badge. Drag-to-reorder folders removed (was never persisted).
- Track rows (folder/search/playlist views) & Library playlist cards share the SAME 8-gradient palette as folder tiles (`CARD_GRADIENTS` in `app/components/CardGradient.tsx`) with white bold 15px titles / 80% white subtitles / white icons; compact rows; folder tracks numbered. Track-row DJ Rehab icon REMOVED (June 2026) from folder/search/playlist/favorites rows; Blue Icon still used in mini player + lock screen
- Audio engine (June 2026, SDK 58): `expo-audio` `createAudioPlaylist` (ExoPlayer on Android, <audio> on web) in ONE unified `app/contexts/AudioPlayerContext.tsx`. Background playback + lock-screen/notification controls (play/pause/next/prev, artwork = assets/track-icon.png via expo-asset) through `setActiveForLockScreen`; config plugin `expo-audio` with `enableBackgroundPlayback: true`, mic/RECORD_AUDIO disabled. `react-native-track-player`, `expo-av`, patch-package, index.native.js, service.js, player.tsx, context/AudioContext.tsx all REMOVED.
- Local favorites & playlists (AsyncStorage + expo-file-system backup). Favorites: single source of truth is the audio context (`favoriteIds`/`removeFavorite`, AsyncStorage key `favorites`); Favorites tab reads from context (June 2026 fix — tab previously read a different key and was always empty)
- Resume Playback: last track, position, queue & shuffle state saved (AsyncStorage `last_playback_state`, via app/utils/playbackStateStorage.ts); restored PAUSED in mini-player on launch
- Local search over musicData
- Share button (native share sheet → Google Play URL)
- Target/compile SDK 36

- Crossfade (June 2026): fixed 4s fade-out of outgoing track (last 4s, only if a next track exists) → 4s fade-in of the next track on AUTOMATIC transitions; manual taps/skips start at full volume. Toggle in Profile → Playback (AsyncStorage `crossfade_enabled`, default ON). Volume via `playlist.volume`; 100ms fade ticks. Constants in `app/utils/crossfadeSettings.ts`. True overlapping crossfade NOT possible with a single playlist player.

- What's New pop-up: built then REMOVED at user request (June 2026). Files deleted (WhatsNewModal.tsx, whatsNew.ts). Do not re-add unless asked.

## Build Info
- `app.json` → `expo.android.versionCode`: **5003** (June 2026: lock-screen diagnostics report)
- Lock-screen controls on Android 13+ need the POST_NOTIFICATIONS runtime permission (expo-audio docs: required for media controls). Declared in app.json; `app/utils/lockScreenPermission.ts` asks contextually on first play (benefit alert → system prompt, max 2 auto-prompts), Profile → Playback → "Lock screen controls" row shows status with Enable / Open Settings fallback; `refreshLockScreen()` in context re-posts the notification after grant.
- `expo-build-properties` must NOT pin compileSdk/targetSdk/buildTools on SDK 58 (defaults: compileSdk 37, targetSdk 36, buildTools 37.0.0). Pinning 36 caused `checkReleaseAarMetadata` build failure (fixed June 2026).
- User builds locally with EAS on Mac. **Must download latest code from Emergent before building.**

## Backlog
- Yacht Rock x Hip-Hop Mashups folder removed (June 2026) — re-add when tracks are ready
- "November 2026 Releases" folder (id `november-2026-releases`, position 0 / top) created June 2026 — 18 tracks (ids `nov26-track-1..18`)
- "Halloween" folder (id `halloween`, position 0 / top, fixed orange gradient via new optional `Folder.gradient` field — fixed-gradient tiles do not consume a palette slot) created June 2026 — 44 tracks (ids `hal-track-1..44`; DJ Kelly Lynn tracks credited to "DJ Kelly Lynn")
- "October 2026 New Releases" folder (id `october-2026-new-releases`, position 0 / top, NEW badge) created June 2026 — 22 tracks (ids `oct26-track-1..23`; oct26-track-10 removed; 17-23 added from "October 2nd Update")
- "Rock x Hip-Hop" folder (id `rock-x-hiphop`, position 3, between Country X Hip-Hop and August Releases) created June 2026 — 39 tracks added (ids `rxh-track-1..39`)
- Move non-route files out of `app/` to silence expo-router warnings
- Optional: sleep timer, repeat modes
- Optional polish (from iteration_9 test): auto-skip / message when a track URL fails to load; shuffle tapped before any playback is a no-op
- ⚠️ expo-audio lock-screen controls + sustained background playback can only be verified on a real Android build (not web / Expo Go)


## Open issue (June 2026): Android lock-screen controls not appearing
- User reports: permission prompt shows, but no notification/lock-screen controls; car stereo shows "Track 1" (= no metadata => expo-audio lock-screen MediaSession apparently never established; only the basic session is active).
- Static review of expo-audio 58.0.10 native service found no obvious bug; Media3 confirms POST_NOTIFICATIONS is NOT required for media notifications.
- Added diagnostics: `app/utils/diagnosticsLog.ts` captures console.warn/error (expo-audio jsLogger messages) + app log lines; Profile → "Lock screen controls" row opens a report modal with Share. `activateLockScreen` logs attempts/errors and retries without artwork. Waiting for the user's report (versionCode 5003).
