package com.voicenotes.wear

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.*
import kotlinx.coroutines.launch
import java.io.File

class MainActivity : ComponentActivity() {

    private lateinit var audioRecorder: AudioRecorder
    private lateinit var watchSender: WatchSender

    private val requestPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* handled via recomposition */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        audioRecorder = AudioRecorder(this)
        watchSender = WatchSender(this)

        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermission.launch(Manifest.permission.RECORD_AUDIO)
        }

        setContent {
            WatchApp(audioRecorder, watchSender)
        }
    }
}

sealed class WatchUiState {
    object Idle : WatchUiState()
    object Recording : WatchUiState()
    object Sending : WatchUiState()
    data class Done(val message: String) : WatchUiState()
    data class Error(val message: String) : WatchUiState()
}

@Composable
fun WatchApp(recorder: AudioRecorder, sender: WatchSender) {
    val scope = rememberCoroutineScope()
    var state by remember { mutableStateOf<WatchUiState>(WatchUiState.Idle) }
    var recordedFile by remember { mutableStateOf<File?>(null) }

    MaterialTheme {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                val statusText = when (state) {
                    is WatchUiState.Idle -> "Listo"
                    is WatchUiState.Recording -> "Grabando..."
                    is WatchUiState.Sending -> "Enviando..."
                    is WatchUiState.Done -> (state as WatchUiState.Done).message
                    is WatchUiState.Error -> (state as WatchUiState.Error).message
                }
                Text(
                    text = statusText,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                    color = when (state) {
                        is WatchUiState.Error -> Color(0xFFFF6B6B)
                        is WatchUiState.Done -> Color(0xFF6BFF9E)
                        else -> Color.White
                    }
                )

                Button(
                    onClick = {
                        when (state) {
                            is WatchUiState.Idle -> {
                                try {
                                    recordedFile = recorder.start()
                                    state = WatchUiState.Recording
                                } catch (e: Exception) {
                                    state = WatchUiState.Error("Mic: ${e.message}")
                                }
                            }
                            is WatchUiState.Recording -> {
                                val file = try {
                                    recorder.stop()
                                } catch (e: Exception) {
                                    state = WatchUiState.Error("Stop: ${e.message}")
                                    return@Button
                                }
                                state = WatchUiState.Sending
                                scope.launch {
                                    try {
                                        sender.sendAudio(file)
                                        file.delete()
                                        state = WatchUiState.Done("¡Enviado!")
                                    } catch (e: Exception) {
                                        state = WatchUiState.Error("Error: ${e.message}")
                                    }
                                    kotlinx.coroutines.delay(3000)
                                    state = WatchUiState.Idle
                                }
                            }
                            else -> { /* busy */ }
                        }
                    },
                    enabled = state is WatchUiState.Idle || state is WatchUiState.Recording,
                    colors = ButtonDefaults.buttonColors(
                        backgroundColor = when (state) {
                            is WatchUiState.Recording -> Color(0xFFCC0000)
                            else -> Color(0xFF6366F1)
                        }
                    ),
                    modifier = Modifier.size(64.dp)
                ) {
                    Text(
                        text = when (state) {
                            is WatchUiState.Recording -> "⏹"
                            is WatchUiState.Sending -> "⏳"
                            else -> "🎙"
                        },
                        fontSize = 24.sp
                    )
                }

                Text(
                    text = when (state) {
                        is WatchUiState.Idle -> "Toca para grabar"
                        is WatchUiState.Recording -> "Toca para detener"
                        is WatchUiState.Sending -> "Transfiriendo..."
                        else -> ""
                    },
                    fontSize = 10.sp,
                    color = Color.Gray,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
