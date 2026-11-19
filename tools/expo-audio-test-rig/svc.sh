#!/bin/bash
# usage: svc.sh <dir with expo-audio android sources (…/expo/modules/audio)> <outdir>
cd /tmp/h; S=$1; O=$2
CPC=$(ls jars/*.jar | tr '\n' ':')android/android-all-14-robolectric-10818077.jar
EXTRA=""; [ -f $S/service/DeckSwitchingPlayer.kt ] && EXTRA=$S/service/DeckSwitchingPlayer.kt
rm -rf $O
kotlinc/bin/kotlinc -nowarn -jvm-target 17 -cp "$CPC" -d $O svcstubs src/stubs src/harness/Common.kt svctest $S/service/AudioControlsService.kt $S/service/AudioMediaSessionCallback.kt $S/service/MetadataInjectingPlayer.kt $S/service/SeekInterval.kt $S/PlayRequestingPlayer.kt $EXTRA 2>&1 | grep -v "^warning" | head -30
[ -d $O/harness ] || exit 1
timeout 250 java -Drobolectric.conscryptMode=OFF -cp "$O:$CPC" org.junit.runner.JUnitCore harness.ServiceTest 2>&1 | grep -v "^WARNING\|^SLF4J\|^\s*at org.junit\|^\s*at org.robolectric\|^\s*at java.base\|^\s*at jdk"
