package com.voicenotes.phone

import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.util.concurrent.TimeUnit

private const val TAG = "BackendUploader"

class BackendUploader(private val backendUrl: String) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    /**
     * Uploads [file] to the backend as multipart/form-data.
     * Returns the response body string on success.
     * Throws IOException on network error or non-2xx response.
     */
    fun upload(file: File): String {
        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart(
                "file",
                file.name,
                file.asRequestBody("audio/mp4".toMediaType())
            )
            .build()

        val request = Request.Builder()
            .url("$backendUrl/api/recordings/upload")
            .post(requestBody)
            .build()

        Log.d(TAG, "Uploading ${file.name} to $backendUrl")

        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: ""

        if (!response.isSuccessful) {
            throw java.io.IOException("Upload failed: HTTP ${response.code} — $body")
        }

        Log.d(TAG, "Upload success: $body")
        return body
    }
}
