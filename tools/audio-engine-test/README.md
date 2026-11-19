# Audio engine lock screen test

Runs the app's real audio engine (`frontend/app/utils/audioEngine.ts`) in Node against stand-ins for
the native modules, and checks what the lock screen / car display would show after every kind of
track change (Next in the app, Next on the lock screen, tapping a song, automatic change with and
without crossfade).

    ./run.sh                    # installed build (APK/AAB): bundled image = resource name
    BUILD=dev ./run.sh          # development: bundled image = file:// address
    REFUSE_UPDATES=1 ./run.sh   # every title update refused: engine must re-attach the controls

Needs network once (esbuild is fetched with npx). Exit code 0 = all checks passed.

Why it exists: build 5017's lock screen report from a phone showed Android refusing every lock
screen call because the artwork address was `assets_trackicon` (what expo-asset returns for a
bundled image in an installed build) instead of a URL. `mocks/expo-audio.js` refuses such values
the same way, with the same error text, so the failure can be reproduced without a phone.
`mocks/expo-asset.js` holds the two behaviours of expo-asset.

It proves what the app ASKS the native side to show. What the native side then sends to Android is
covered by `/app/tools/expo-audio-test-rig`. Neither can prove what a phone or a car displays.
