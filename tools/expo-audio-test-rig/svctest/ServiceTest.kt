package harness

import android.os.Looper
import androidx.media3.common.Player
import androidx.media3.session.MediaSession
import expo.modules.audio.AudioLockScreenOptions
import expo.modules.audio.LockScreenPlayable
import expo.modules.audio.service.AudioControlsService
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Logger
import java.time.Duration
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

class FakePlayable(val deck: FakeDeck) : LockScreenPlayable {
  override var isActiveForLockScreen = false
  override var mediaSession: MediaSession =
    MediaSession.Builder(RuntimeEnvironment.getApplication(), deck).setId("basic-${deck.name}").build().also { it.release() }
  override val player: Player = deck
  override val isLive = false
  override val supportsNextTrack = true
  override val supportsPreviousTrack = true
  override fun requestPlay() = deck.play()
  override fun nextTrack() = deck.seekToNextMediaItem()
  override fun previousTrack() = deck.seekToPreviousMediaItem()
  override fun assignBasicMediaSession() = Unit
}

/** Drives the real AudioControlsService the way the app's audio engine does. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], manifest = Config.NONE, shadows = [RecordingSession::class])
class ServiceTest {
  private fun session(service: AudioControlsService): MediaSession =
    AudioControlsService::class.java.getDeclaredField("mediaSession").apply { isAccessible = true }.get(service) as MediaSession

  @Test
  fun crossfades() {
    val main = Looper.getMainLooper()
    val app = RuntimeEnvironment.getApplication()
    val items = queueItems(6)
    val a = FakeDeck("A", main, items)
    val b = FakeDeck("B", main, items)
    val pa = FakePlayable(a)
    val pb = FakePlayable(b)
    val options = AudioLockScreenOptions(showSeekForward = false, showSeekBackward = false, showNextTrack = true, showPreviousTrack = true)
    RecordingSession.log.clear()

    val service = Robolectric.buildService(AudioControlsService::class.java).create().get()
    service.appContext = AppContext(CoroutineScope(Dispatchers.Main), app, Logger())

    a.change { index = 0; pwr = true; posMs = 1000 }
    service.setPlayableOptions(pa, md(0), options)
    idle()
    assertEquals("Song 0", dump("activated on deck A, Song 0", session(service)).first)

    a.seekTo(1, 0)
    service.setPlayableMetadata(pa, md(1))
    assertEquals("Song 1", dump("manual skip to Song 1", session(service)).first)

    for ((n, step) in listOf(Triple(pb, b, 2), Triple(pa, a, 3), Triple(pb, b, 4), Triple(pa, a, 5)).withIndex()) {
      val (playable, deck, song) = step
      val other = if (deck === a) b else a
      deck.change { index = song; posMs = 200; pwr = true }
      service.setPlayableOptions(playable, md(song), options)
      idle()
      var r = dump("crossfade ${n + 1}: deck ${deck.name} takes over with Song $song", session(service))
      assertEquals("Song $song", r.first)
      assertEquals(song.toLong(), r.second)
      assertEquals(3, r.third)
      other.change { pwr = false; vol = 0f }
      shadowOf(main).idleFor(Duration.ofSeconds(5))
      r = dump("crossfade ${n + 1}: 5 seconds later, old deck parked", session(service))
      assertEquals("Song $song", r.first)
      assertEquals(song.toLong(), r.second)
      assertEquals(3, r.third)
    }

    // Previous pressed on the lock screen / car
    session(service).player.seekToPreviousMediaItem()
    idle()
    assertEquals(4, a.index)
    assertEquals(4L, dump("Previous pressed through the session", session(service)).second)
  }
}
