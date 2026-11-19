#!/bin/bash
# Bundles the real audio engine with the stand-in native modules and runs the lock screen checks.
#   ./run.sh          release build behaviour (what a phone gets from an APK/AAB)
#   BUILD=dev ./run.sh   development behaviour (Expo Go / dev server)
#   REFUSE_UPDATES=1 ./run.sh   every title update is refused: the engine must fall back to re-attaching the controls
set -e
cd "$(dirname "$0")"
OUT=$(mktemp -d)
npx --yes esbuild@0.25.10 test.ts --bundle --platform=node --format=cjs --log-level=error \
  --alias:react-native=./mocks/react-native.js \
  --alias:expo-audio=./mocks/expo-audio.js \
  --alias:expo-asset=./mocks/expo-asset.js \
  --alias:expo-constants=./mocks/expo-constants.js \
  --alias:@react-native-async-storage/async-storage=./mocks/async-storage.js \
  --loader:.png=file --loader:.jpg=file --define:__DEV__=false \
  --outfile="$OUT/test.cjs"
node "$OUT/test.cjs"
