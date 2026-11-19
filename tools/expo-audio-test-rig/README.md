# Test rig for the expo-audio lock screen / Bluetooth patch

Runs the real, patched `AudioControlsService` against the real Media3 1.9.1 session code on the JVM
(Robolectric) and prints everything that is pushed to the platform media session. That is all the
lock screen and a Bluetooth car display can see. No Android SDK, Gradle or emulator needed.

It proves what the app SENDS. It cannot prove how a phone's lock screen or a car reacts.

Setup (about 5 minutes, Linux, root):

    apt-get install -y openjdk-17-jdk-headless maven unzip
    mkdir -p /tmp/h && cp -r . /tmp/h && cd /tmp/h
    curl -sL -o kotlinc.zip https://github.com/JetBrains/kotlin/releases/download/v2.2.0/kotlin-compiler-2.2.0.zip && unzip -q kotlinc.zip
    mvn -q -B dependency:copy-dependencies -DoutputDirectory=libs
    mvn -q -B dependency:copy -Dartifact=org.robolectric:android-all:14-robolectric-10818077 -DoutputDirectory=/tmp/h/android
    mkdir -p jars && cp libs/*.jar jars/ && for a in libs/*.aar; do n=$(basename $a .aar); unzip -q -o -j $a classes.jar -d jars/t && mv jars/t/classes.jar jars/$n.jar; done
    # R classes of media3-session, androidx.core and androidx.media: generate `public final class R`
    # with one nested class per resource type and an int constant per line of each AAR's R.txt,
    # compile with javac and add the result to jars/ (the service only needs the constants to exist).

Run (also the compile check for any change to the patch):

    ./svc.sh /app/frontend/node_modules/expo-audio/android/src/main/java/expo/modules/audio out_new

`svcstubs/` replaces the few expo-modules-core types the service uses. `ServiceTest` plays the app's
part: activate on deck A, manual skip, four crossfades between two decks, a button press through the
session. Expected at every crossfade: `STATE … activeQueueId=<new>` then `META title=<new>`, and no
`QUEUE` line (same traffic as a manual skip).
