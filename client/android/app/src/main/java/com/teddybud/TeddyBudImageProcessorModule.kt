package com.teddybud

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.ByteArrayOutputStream

class TeddyBudImageProcessorModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "TeddyBudImageProcessor"

  @ReactMethod
  fun compress(uriString: String, maxDimension: Int, quality: Int, promise: Promise) {
    try {
      val uri = Uri.parse(uriString)
      val resolver = reactApplicationContext.contentResolver
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      resolver.openInputStream(uri).use { stream ->
        requireNotNull(stream) { "The selected image could not be opened." }
        BitmapFactory.decodeStream(stream, null, bounds)
      }
      require(bounds.outWidth > 0 && bounds.outHeight > 0) { "This image format could not be decoded on this device." }
      val limit = maxDimension.coerceIn(640, 4096)
      var sample = 1
      while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= limit) sample *= 2
      val options = BitmapFactory.Options().apply { inSampleSize = sample.coerceAtLeast(1) }
      val bitmap = resolver.openInputStream(uri).use { stream ->
        requireNotNull(stream) { "The selected image could not be opened." }
        BitmapFactory.decodeStream(stream, null, options)
      } ?: throw IllegalArgumentException("This image format could not be decoded on this device.")
      val scale = minOf(1.0, limit.toDouble() / maxOf(bitmap.width, bitmap.height))
      val resized = if (scale < 1.0) Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt().coerceAtLeast(1), (bitmap.height * scale).toInt().coerceAtLeast(1), true) else bitmap
      val outputBitmap = Bitmap.createBitmap(resized.width, resized.height, Bitmap.Config.RGB_565)
      val canvas = android.graphics.Canvas(outputBitmap)
      canvas.drawColor(android.graphics.Color.WHITE)
      canvas.drawBitmap(resized, 0f, 0f, null)
      val output = ByteArrayOutputStream()
      outputBitmap.compress(Bitmap.CompressFormat.JPEG, quality.coerceIn(70, 92), output)
      outputBitmap.recycle()
      if (resized !== bitmap) resized.recycle()
      bitmap.recycle()
      val bytes = output.toByteArray()
      require(bytes.isNotEmpty() && bytes.size <= 8 * 1024 * 1024) { "The image could not be reduced to a supported size. Choose a smaller image." }
      promise.resolve(Base64.encodeToString(bytes, Base64.NO_WRAP))
    } catch (error: Exception) {
      promise.reject("IMAGE_PROCESSING_FAILED", error.message ?: "The selected image could not be prepared.", error)
    }
  }
}

class TeddyBudImageProcessorPackage : com.facebook.react.ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext) =
    listOf(TeddyBudImageProcessorModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<com.facebook.react.uimanager.ViewManager<*, *>> = emptyList()
}
