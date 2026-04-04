package com.voicenotes.phone

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

private const val PREFS_NAME = "voice_notes_prefs"
private const val KEY_BACKEND_URL = "backend_url"
private const val DEFAULT_BACKEND_URL = "http://192.168.1.100:8000"

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    SettingsScreen(
                        loadUrl = {
                            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                                .getString(KEY_BACKEND_URL, DEFAULT_BACKEND_URL) ?: DEFAULT_BACKEND_URL
                        },
                        saveUrl = { url ->
                            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                                .edit().putString(KEY_BACKEND_URL, url).apply()
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun SettingsScreen(loadUrl: () -> String, saveUrl: (String) -> Unit) {
    var url by remember { mutableStateOf(loadUrl()) }
    var saved by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("🎙️ Voice Notes AI", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        Text(
            "Companion app para Samsung Watch Ultra.\nEl reloj enviará las notas aquí automáticamente.",
            style = MaterialTheme.typography.bodySmall
        )
        Spacer(Modifier.height(32.dp))

        OutlinedTextField(
            value = url,
            onValueChange = { url = it; saved = false },
            label = { Text("URL del backend") },
            placeholder = { Text("http://192.168.1.x:8000") },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = { saveUrl(url); saved = true },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (saved) "✓ Guardado" else "Guardar")
        }

        Spacer(Modifier.height(24.dp))
        Text(
            "Estado: Esperando notas del reloj...",
            style = MaterialTheme.typography.bodySmall
        )
    }
}
