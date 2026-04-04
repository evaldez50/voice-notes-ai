package com.voicenotes.wear

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.ChannelClient
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.tasks.await
import java.io.File

private const val TAG = "WatchSender"
private const val CHANNEL_PATH = "/voice-note"

class WatchSender(private val context: Context) {

    private val channelClient: ChannelClient by lazy {
        Wearable.getChannelClient(context)
    }

    /**
     * Sends [file] to the first connected phone node.
     * Suspends until the transfer completes or throws on error.
     */
    suspend fun sendAudio(file: File) {
        val nodes = Wearable.getNodeClient(context).connectedNodes.await()
        val phoneNode = nodes.firstOrNull { it.isNearby }
            ?: nodes.firstOrNull()
            ?: error("No connected phone node found")

        Log.d(TAG, "Sending ${file.name} (${file.length()} bytes) to node ${phoneNode.displayName}")

        val channel = channelClient.openChannel(phoneNode.id, CHANNEL_PATH).await()
        try {
            val outputStream = channelClient.getOutputStream(channel).await()
            outputStream.use { out ->
                file.inputStream().use { input ->
                    input.copyTo(out)
                }
            }
            Log.d(TAG, "Transfer complete")
        } finally {
            channelClient.close(channel).await()
        }
    }
}
