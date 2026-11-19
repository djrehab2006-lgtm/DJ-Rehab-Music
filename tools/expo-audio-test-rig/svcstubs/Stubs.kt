package expo.modules.kotlin

import android.content.Context
import kotlinx.coroutines.CoroutineScope

class Logger {
  fun warn(message: String) { println("     JSLOG warn: $message") }
  fun error(message: String, cause: Throwable? = null) { println("     JSLOG error: $message $cause") }
}

class AppContext(val mainQueue: CoroutineScope, val reactContext: Context?, val jsLogger: Logger?)
