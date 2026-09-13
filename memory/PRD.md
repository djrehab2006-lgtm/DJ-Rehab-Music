# DJ Rehab Music — PRD

## Goal
Standalone Android music streaming app (Expo / React Native) for Google Play. No backend — all music hardcoded in `frontend/app/constants/musicData.ts`.

## Core Features (Done)
- Custom UI: all folder, track, search-result & playlist cards cycle bright red/pink/yellow/green from `app/constants/cardColors.ts` (CARD_COLORS); compact rows; custom Blue Icon track art
- Background / lock-screen playback via patched `react-native-track-player` (Android); `expo-av` fallback on web
- Local favorites & playlists (AsyncStorage + expo-file-system backup)
- Resume Playback: last track, position, queue & shuffle state saved (AsyncStorage `last_playback_state`, via app/utils/playbackStateStorage.ts); restored PAUSED in mini-player on launch (native syncs with live TrackPlayer queue if still running)
- Local search over musicData
- Share button (native share sheet → Google Play URL)
- Target/compile SDK 36

## Build Info
- `app.json` → `expo.android.versionCode`: **2000** (bumped June 2026)
- User builds locally with EAS on Mac. **Must download latest code from Emergent before building.**

## Backlog
- Yacht Rock x Hip-Hop Mashups folder removed (June 2026) — re-add when tracks are ready
- Migrate web fallback from `expo-av` → `expo-audio`
- Move non-route files out of `app/` to silence expo-router warnings
- Optional: sleep timer, repeat modes
