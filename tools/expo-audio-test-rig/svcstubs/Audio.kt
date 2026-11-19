package expo.modules.audio

import androidx.media3.common.Player
import androidx.media3.session.MediaSession

class AudioLockScreenOptions(
  val showSeekForward: Boolean,
  val showSeekBackward: Boolean,
  val showNextTrack: Boolean = false,
  val showPreviousTrack: Boolean = false,
  val isLiveStream: Boolean? = null,
  val seekForwardIntervalSeconds: Double = 10.0,
  val seekBackwardIntervalSeconds: Double = 10.0
)

interface LockScreenPlayable {
  var isActiveForLockScreen: Boolean
  var mediaSession: MediaSession
  val player: Player
  val isLive: Boolean
  val supportsNextTrack: Boolean
  val supportsPreviousTrack: Boolean
  fun requestPlay()
  fun nextTrack()
  fun previousTrack()
  fun assignBasicMediaSession()
}

fun getPlaybackServiceErrorMessage(message: String) = message
