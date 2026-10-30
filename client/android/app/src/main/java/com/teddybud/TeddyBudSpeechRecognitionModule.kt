package com.teddybud

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.ReactPackage
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.modules.core.DeviceEventManagerModule

class TeddyBudSpeechRecognitionModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), RecognitionListener {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var recognizer: SpeechRecognizer? = null

  override fun getName() = "TeddyBudSpeechRecognition"

  @ReactMethod
  fun start(locale: String, promise: Promise) {
    mainHandler.post {
      try {
        if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
          promise.reject("SPEECH_UNAVAILABLE", "No speech recognition service is available on this device.")
          return@post
        }
        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(reactContext).also {
          it.setRecognitionListener(this)
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, locale)
          putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        recognizer?.startListening(intent)
        promise.resolve(true)
      } catch (error: Exception) {
        recognizer?.destroy()
        recognizer = null
        promise.reject("SPEECH_START_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    mainHandler.post {
      try { recognizer?.stopListening(); promise.resolve(true) }
      catch (error: Exception) { promise.reject("SPEECH_STOP_FAILED", error.message, error) }
    }
  }

  @ReactMethod
  fun cancel(promise: Promise) {
    mainHandler.post {
      try { recognizer?.cancel(); recognizer?.destroy(); recognizer = null; promise.resolve(true) }
      catch (error: Exception) { promise.reject("SPEECH_CANCEL_FAILED", error.message, error) }
    }
  }

  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}

  private fun emit(name: String, value: WritableMap? = null) {
    if (reactContext.hasActiveCatalystInstance()) {
      reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(name, value ?: Arguments.createMap())
    }
  }

  private fun emitResults(name: String, results: Bundle?) {
    val values = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
    val payload = Arguments.createMap()
    payload.putArray("value", Arguments.fromList(values?.toList() ?: emptyList<String>()))
    emit(name, payload)
  }

  override fun onReadyForSpeech(params: Bundle?) {}
  override fun onBeginningOfSpeech() {}
  override fun onRmsChanged(rmsdB: Float) {}
  override fun onBufferReceived(buffer: ByteArray?) {}
  override fun onEndOfSpeech() { emit("speechEnd") }
  override fun onError(error: Int) {
    val payload = Arguments.createMap()
    payload.putString("message", "Speech recognition ended (error $error). Please try again.")
    emit("speechError", payload)
    emit("speechEnd")
    recognizer?.destroy()
    recognizer = null
  }
  override fun onResults(results: Bundle?) {
    emitResults("speechResults", results)
    emit("speechEnd")
    recognizer?.destroy()
    recognizer = null
  }
  override fun onPartialResults(partialResults: Bundle?) { emitResults("speechPartialResults", partialResults) }
  override fun onEvent(eventType: Int, params: Bundle?) {}

  override fun invalidate() {
    mainHandler.post { recognizer?.cancel(); recognizer?.destroy(); recognizer = null }
    super.invalidate()
  }
}

class TeddyBudSpeechRecognitionPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext) =
    listOf(TeddyBudSpeechRecognitionModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
