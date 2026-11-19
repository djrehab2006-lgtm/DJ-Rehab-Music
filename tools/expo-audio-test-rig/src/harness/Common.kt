package harness

import android.media.MediaMetadata as FwkMetadata
import android.media.session.MediaSession as FwkSession
import android.media.session.PlaybackState as FwkState
import android.os.Looper
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import androidx.media3.session.MediaSession
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.audio.Metadata
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements

/** Records everything Media3 pushes to the platform media session: this is all the lock screen and Bluetooth can see. */
@Implements(FwkSession::class)
class RecordingSession {
  @Implementation
  fun setMetadata(m: FwkMetadata?) {
    log += "META  title=${m?.getString(FwkMetadata.METADATA_KEY_TITLE)} artist=${m?.getString(FwkMetadata.METADATA_KEY_ARTIST)} durMs=${m?.getLong(FwkMetadata.METADATA_KEY_DURATION)}"
  }

  @Implementation
  fun setPlaybackState(s: FwkState?) {
    log += "STATE state=${s?.state} posMs=${s?.position} activeQueueId=${s?.activeQueueItemId} speed=${s?.playbackSpeed}"
  }

  @Implementation
  fun setQueue(q: List<FwkSession.QueueItem>?) {
    log += "QUEUE size=${q?.size} titles=${q?.map { it.description.title }}"
  }

  @Implementation
  fun setActive(active: Boolean) {
    log += "ACTIVE $active"
  }

  @Implementation
  fun release() {
    log += "RELEASE"
  }

  companion object {
    @JvmField val log = mutableListOf<String>()
  }
}

class FakeDeck(val name: String, looper: Looper, items: List<MediaItem>) : SimpleBasePlayer(looper) {
  var index = 0
  var pwr = false
  var pbState = Player.STATE_READY
  var posMs = 0L
  var vol = 1f
  private val playlist = items.mapIndexed { i, item ->
    MediaItemData.Builder("$name-$i").setMediaItem(item).setDurationUs(200_000_000L).setIsSeekable(true).build()
  }

  override fun getState(): State = State.Builder()
    .setAvailableCommands(Player.Commands.Builder().addAllCommands().build())
    .setPlayWhenReady(pwr, Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
    .setPlaybackState(pbState)
    .setPlaylist(playlist)
    .setCurrentMediaItemIndex(index)
    .setContentPositionMs(posMs)
    .setVolume(vol)
    .build()

  override fun handleSetPlayWhenReady(playWhenReady: Boolean): ListenableFuture<*> {
    pwr = playWhenReady
    return Futures.immediateVoidFuture()
  }

  override fun handleSeek(mediaItemIndex: Int, positionMs: Long, seekCommand: Int): ListenableFuture<*> {
    if (mediaItemIndex != C.INDEX_UNSET) index = mediaItemIndex
    posMs = if (positionMs == C.TIME_UNSET) 0 else positionMs
    return Futures.immediateVoidFuture()
  }

  override fun handleSetVolume(volume: Float, volumeOperationType: Int): ListenableFuture<*> {
    vol = volume
    return Futures.immediateVoidFuture()
  }

  override fun handlePrepare(): ListenableFuture<*> = Futures.immediateVoidFuture()
  override fun handleStop(): ListenableFuture<*> = Futures.immediateVoidFuture()

  /** A change made by the player itself (the engine), not through the Player API. */
  fun change(block: FakeDeck.() -> Unit) {
    block()
    invalidateState()
  }
}

fun queueItems(count: Int): List<MediaItem> = (0 until count).map { i ->
  MediaItem.Builder()
    .setUri("https://example.com/$i.mp3")
    .setMediaMetadata(
      MediaMetadata.Builder().setTitle("Song $i").setArtist("DJ Rehab").setAlbumTitle("Folder").build()
    )
    .build()
}

fun md(i: Int) = Metadata("Song $i", "DJ Rehab", "Folder", null)

fun idle() = shadowOf(Looper.getMainLooper()).idle()

private var printed = 0

/** What the platform session currently holds, plus everything sent to it since the last call. */
fun dump(label: String, session: MediaSession): Triple<String?, Long?, Int?> {
  idle()
  val impl = MediaSession::class.java.getDeclaredMethod("getImpl").apply { isAccessible = true }.invoke(session)
  val stub = impl.javaClass.getDeclaredField("sessionLegacyStub").apply { isAccessible = true }.get(impl)
  val compat = stub.javaClass.getMethod("getSessionCompat").apply { isAccessible = true }.invoke(stub)
  val compatImpl = compat.javaClass.getDeclaredField("impl").apply { isAccessible = true }.get(compat)
  fun field(name: String): Any? {
    var c: Class<*>? = compatImpl.javaClass
    while (c != null) {
      try {
        return c.getDeclaredField(name).apply { isAccessible = true }.get(compatImpl)
      } catch (e: NoSuchFieldException) {
        c = c.superclass
      }
    }
    error("no field $name")
  }
  val metadata = field("metadata")
  val state = field("playbackState")
  val queue = field("queue") as List<*>?
  val title = metadata?.let { it.javaClass.getMethod("getString", String::class.java).apply { isAccessible = true }.invoke(it, FwkMetadata.METADATA_KEY_TITLE) as String? }
  val activeId = state?.let { it.javaClass.getMethod("getActiveQueueItemId").apply { isAccessible = true }.invoke(it) as Long }
  val st = state?.let { it.javaClass.getMethod("getState").apply { isAccessible = true }.invoke(it) as Int }
  val pos = state?.let { it.javaClass.getMethod("getPosition").apply { isAccessible = true }.invoke(it) as Long }
  println("== $label")
  println("   NOW: title=$title state=$st posMs=$pos activeQueueId=$activeId queue=${queue?.size}")
  val log = RecordingSession.log
  while (printed < log.size) {
    println("     -> ${log[printed++]}")
  }
  return Triple(title, activeId, st)
}
