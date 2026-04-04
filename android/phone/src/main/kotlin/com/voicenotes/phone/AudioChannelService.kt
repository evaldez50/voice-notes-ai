package com.voicenotes.phone

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.ChannelClient
import com.google.android.gms.wearable.WearableListenerService
import kotlinx.coroutines.*
import kotlinx.coroutines.tasks.await
import java.io.File

private const val TAG = "AudioChannelService"
private const val CHANNEL_PATH = "/voice-note"
private const val PREFS_NAME = "voice_notes_prefs"
private const val KEY_BACKEND_URL = "backend_url"
private const val DEFAULT_BACKEND_URL = "http://192.168.1.100:8000"

class AudioChannelService : WearableListenerService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onChannelOpened(channel: ChannelClient.Channel) {
        if (channel.path != CHANNEL_PATH) return

        Log.d(TAG, "Channel opened: ${channel.path}")

        serviceScope.launch {
            val tempFile = File(cacheDir, "watch_note_${System.currentTimeMillis()}.m4a")
            try {
                receiveFile(channel, tempFile)
                Log.d(TAG, "Received ${tempFile.length()} bytes")
                uploadToBackend(tempFile)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to receive/upload audio", e)
            } finally {
                tempFile.delete()
            }
        }
    }

    private suspend fun receiveFile(channel: ChannelClient.Channel, dest: File) {
        val channelClient = com.google.android.gms.wearable.Wearable.getChannelClient(this)
        val inputStream = channelClient.getInputStream(channel).await()
        inputStream.use { input ->
            dest.outputStream().use { output ->
                input.copyTo(output)
            }
        }
    }

    private fun uploadToBackend(file: File) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val backendUrl = prefs.getString(KEY_BACKEND_URL, DEFAULT_BACKEND_URL) ?: DEFAULT_BACKEND_URL
        BackendUploader(backendUrl).upload(file)
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }
}

