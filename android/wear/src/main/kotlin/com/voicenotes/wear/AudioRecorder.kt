package com.voicenotes.wear

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

class AudioRecorder(private val context: Context) {

    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null

    /** Starts recording. Returns the output file path. */
    fun start(): File {
        val file = File(context.cacheDir, "note_${System.currentTimeMillis()}.m4a")
        outputFile = file

        val mr = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }

        mr.apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioSamplingRate(44100)
            setAudioEncodingBitRate(128_000)
            setOutputFile(file.absolutePath)
            prepare()
            start()
        }

        recorder = mr
        return file
    }

    /**
     * Stops recording and returns the recorded file.
     * Throws IllegalStateException if not recording.
     */
    fun stop(): File {
        val file = outputFile ?: error("AudioRecorder: no active recording")
        recorder?.apply {
            stop()
            release()
        }
        recorder = null
        outputFile = null
        return file
    }

    val isRecording: Boolean get() = recorder != null
}
