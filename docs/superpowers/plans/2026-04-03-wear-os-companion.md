# Wear OS Companion App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una app Wear OS para Samsung Watch Ultra que grabe audio y lo transfiera al teléfono via Data Layer API, donde una companion app Android lo sube automáticamente al backend de Voice Notes AI.

**Architecture:** Proyecto Android multi-módulo (`android/wear` + `android/phone`). El reloj usa `MediaRecorder` para grabar en formato M4A y `ChannelClient` (no `DataClient` — el audio puede pesar varios MB, y `DataItem` tiene límite de 100 KB) para enviar el archivo al teléfono. La companion app en el teléfono corre un `WearableListenerService` en background que recibe el audio y hace `multipart/form-data POST` al backend FastAPI local.

**Tech Stack:** Kotlin 1.9, Compose for Wear OS 1.3, Wearable Data Layer API 18.x, OkHttp 4.x, Android Gradle Plugin 8.x, minSdk 30 (Wear OS 3+), targetSdk 34

---

## Estructura de archivos

```
voice-notes-ai/
└── android/
    ├── settings.gradle.kts          # incluye :wear y :phone
    ├── build.gradle.kts             # versiones compartidas
    ├── gradle/libs.versions.toml    # version catalog
    ├── wear/
    │   ├── build.gradle.kts
    │   └── src/main/
    │       ├── AndroidManifest.xml
    │       └── kotlin/com/voicenotes/wear/
    │           ├── MainActivity.kt      # UI Compose for Wear OS
    │           ├── AudioRecorder.kt     # MediaRecorder wrapper
    │           └── WatchSender.kt       # ChannelClient — envía archivo al teléfono
    └── phone/
        ├── build.gradle.kts
        └── src/main/
            ├── AndroidManifest.xml
            └── kotlin/com/voicenotes/phone/
                ├── MainActivity.kt          # UI mínima: URL backend + status
                ├── AudioChannelService.kt   # WearableListenerService — recibe audio
                └── BackendUploader.kt       # OkHttp multipart POST al backend
```

---

## Task 1: Scaffold del proyecto Android multi-módulo

**Files:**
- Create: `android/settings.gradle.kts`
- Create: `android/build.gradle.kts`
- Create: `android/gradle/libs.versions.toml`
- Create: `android/wear/build.gradle.kts`
- Create: `android/phone/build.gradle.kts`

- [ ] **Step 1: Crear estructura de directorios**

```bash
cd voice-notes-ai
mkdir -p android/gradle
mkdir -p android/wear/src/main/kotlin/com/voicenotes/wear
mkdir -p android/wear/src/main/res/values
mkdir -p android/phone/src/main/kotlin/com/voicenotes/phone
mkdir -p android/phone/src/main/res/values
```

- [ ] **Step 2: Crear version catalog**

Crear `android/gradle/libs.versions.toml`:

```toml
[versions]
agp = "8.3.2"
kotlin = "1.9.23"
compose-wear = "1.3.1"
wear-compose-material = "1.3.1"
horologist = "0.6.9"
wearable = "18.1.0"
okhttp = "4.12.0"
coroutines = "1.8.0"
activity-compose = "1.9.0"
compose-bom = "2024.04.01"

[libraries]
# Wear OS
wear-compose-material = { group = "androidx.wear.compose", name = "compose-material", version.ref = "wear-compose-material" }
wear-compose-foundation = { group = "androidx.wear.compose", name = "compose-foundation", version.ref = "compose-wear" }
horologist-compose-layout = { group = "com.google.android.horologist", name = "horologist-compose-layout", version.ref = "horologist" }
# Data Layer
play-services-wearable = { group = "com.google.android.gms", name = "play-services-wearable", version.ref = "wearable" }
# Network
okhttp = { group = "com.squareup.okhttp3", name = "okhttp", version.ref = "okhttp" }
# Coroutines
kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }
kotlinx-coroutines-play-services = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-play-services", version.ref = "coroutines" }
# Phone UI
activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activity-compose" }
compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }
compose-material3 = { group = "androidx.compose.material3", name = "material3" }
compose-ui = { group = "androidx.compose.ui", name = "ui" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
```

- [ ] **Step 3: Crear `android/settings.gradle.kts`**

```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "VoiceNotesAndroid"
include(":wear")
include(":phone")
```

- [ ] **Step 4: Crear `android/build.gradle.kts` (root)**

```kotlin
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
}
```

- [ ] **Step 5: Crear `android/wear/build.gradle.kts`**

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.voicenotes.wear"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.voicenotes.wearos"
        minSdk = 30
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildFeatures { compose = true }
    composeOptions { kotlinCompilerExtensionVersion = "1.5.13" }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(libs.wear.compose.material)
    implementation(libs.wear.compose.foundation)
    implementation(libs.horologist.compose.layout)
    implementation(libs.play.services.wearable)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)
}
```

- [ ] **Step 6: Crear `android/phone/build.gradle.kts`**

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.voicenotes.phone"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.voicenotes.wearos"   // mismo applicationId que wear
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildFeatures { compose = true }
    composeOptions { kotlinCompilerExtensionVersion = "1.5.13" }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(libs.play.services.wearable)
    implementation(libs.okhttp)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)
    implementation(libs.activity.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.material3)
    implementation(libs.compose.ui)
}
```

- [ ] **Step 7: Verificar que Gradle sincroniza**

```bash
cd android
./gradlew tasks --all 2>&1 | head -20
# Expected: BUILD SUCCESSFUL
```

- [ ] **Step 8: Commit**

```bash
git add android/
git commit -m "chore: scaffold Android multi-module project (wear + phone)"
```

---

## Task 2: AndroidManifest y recursos base

**Files:**
- Create: `android/wear/src/main/AndroidManifest.xml`
- Create: `android/wear/src/main/res/values/strings.xml`
- Create: `android/phone/src/main/AndroidManifest.xml`
- Create: `android/phone/src/main/res/values/strings.xml`

- [ ] **Step 1: Crear `android/wear/src/main/AndroidManifest.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <uses-feature android:name="android.hardware.type.watch" />

    <application
        android:label="@string/app_name"
        android:theme="@android:style/Theme.DeviceDefault">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>
</manifest>
```

- [ ] **Step 2: Crear `android/wear/src/main/res/values/strings.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Voice Notes</string>
</resources>
```

- [ ] **Step 3: Crear `android/phone/src/main/AndroidManifest.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:label="@string/app_name"
        android:theme="@style/Theme.AppCompat">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".AudioChannelService"
            android:exported="true">
            <intent-filter>
                <action android:name="com.google.android.gms.wearable.CHANNEL_EVENT" />
            </intent-filter>
        </service>

    </application>
</manifest>
```

- [ ] **Step 4: Crear `android/phone/src/main/res/values/strings.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Voice Notes</string>
</resources>
```

- [ ] **Step 5: Commit**

```bash
git add android/wear/src/main/AndroidManifest.xml
git add android/wear/src/main/res/
git add android/phone/src/main/AndroidManifest.xml
git add android/phone/src/main/res/
git commit -m "chore: add manifests and resources for wear and phone modules"
```

---

## Task 3: AudioRecorder (módulo wear)

**Files:**
- Create: `android/wear/src/main/kotlin/com/voicenotes/wear/AudioRecorder.kt`

- [ ] **Step 1: Crear `AudioRecorder.kt`**

```kotlin
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
```

- [ ] **Step 2: Verificar que compila**

```bash
cd android
./gradlew :wear:compileDebugKotlin
# Expected: BUILD SUCCESSFUL
```

- [ ] **Step 3: Commit**

```bash
git add android/wear/src/main/kotlin/com/voicenotes/wear/AudioRecorder.kt
git commit -m "feat(wear): add AudioRecorder wrapper for MediaRecorder"
```

---

## Task 4: WatchSender — enviar audio via ChannelClient

**Files:**
- Create: `android/wear/src/main/kotlin/com/voicenotes/wear/WatchSender.kt`

- [ ] **Step 1: Crear `WatchSender.kt`**

```kotlin
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
```

- [ ] **Step 2: Verificar que compila**

```bash
cd android
./gradlew :wear:compileDebugKotlin
# Expected: BUILD SUCCESSFUL
```

- [ ] **Step 3: Commit**

```bash
git add android/wear/src/main/kotlin/com/voicenotes/wear/WatchSender.kt
git commit -m "feat(wear): add WatchSender using ChannelClient for audio transfer"
```

---

## Task 5: MainActivity del reloj (Compose for Wear OS)

**Files:**
- Create: `android/wear/src/main/kotlin/com/voicenotes/wear/MainActivity.kt`

- [ ] **Step 1: Crear `MainActivity.kt`**

```kotlin
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
                // Status text
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

                // Record button
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
```

- [ ] **Step 2: Verificar que compila**

```bash
cd android
./gradlew :wear:compileDebugKotlin
# Expected: BUILD SUCCESSFUL
```

- [ ] **Step 3: Commit**

```bash
git add android/wear/src/main/kotlin/com/voicenotes/wear/MainActivity.kt
git commit -m "feat(wear): add Compose for Wear OS UI with record/send flow"
```

---

## Task 6: BackendUploader (módulo phone)

**Files:**
- Create: `android/phone/src/main/kotlin/com/voicenotes/phone/BackendUploader.kt`

- [ ] **Step 1: Crear `BackendUploader.kt`**

```kotlin
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
```

- [ ] **Step 2: Verificar que compila**

```bash
cd android
./gradlew :phone:compileDebugKotlin
# Expected: BUILD SUCCESSFUL
```

- [ ] **Step 3: Commit**

```bash
git add android/phone/src/main/kotlin/com/voicenotes/phone/BackendUploader.kt
git commit -m "feat(phone): add BackendUploader with OkHttp multipart POST"
```

---

## Task 7: AudioChannelService — recibe audio del reloj

**Files:**
- Create: `android/phone/src/main/kotlin/com/voicenotes/phone/AudioChannelService.kt`

- [ ] **Step 1: Crear `AudioChannelService.kt`**

```kotlin
package com.voicenotes.phone

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.ChannelClient
import com.google.android.gms.wearable.WearableListenerService
import kotlinx.coroutines.*
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

// Extension to use kotlinx-coroutines-play-services await()
private suspend fun <T> com.google.android.gms.tasks.Task<T>.await(): T =
    kotlinx.coroutines.tasks.await(this)
```

- [ ] **Step 2: Verificar que compila**

```bash
cd android
./gradlew :phone:compileDebugKotlin
# Expected: BUILD SUCCESSFUL
```

- [ ] **Step 3: Commit**

```bash
git add android/phone/src/main/kotlin/com/voicenotes/phone/AudioChannelService.kt
git commit -m "feat(phone): add WearableListenerService to receive and upload audio"
```

---

## Task 8: MainActivity del teléfono (configuración del backend URL)

**Files:**
- Create: `android/phone/src/main/kotlin/com/voicenotes/phone/MainActivity.kt`

- [ ] **Step 1: Crear `MainActivity.kt`**

```kotlin
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
```

- [ ] **Step 2: Verificar que compila**

```bash
cd android
./gradlew :phone:compileDebugKotlin
# Expected: BUILD SUCCESSFUL
```

- [ ] **Step 3: Commit**

```bash
git add android/phone/src/main/kotlin/com/voicenotes/phone/MainActivity.kt
git commit -m "feat(phone): add settings UI for backend URL configuration"
```

---

## Task 9: Build final e instrucciones de instalación

**Files:**
- Create: `android/README.md`

- [ ] **Step 1: Build APKs de ambos módulos**

```bash
cd android
./gradlew :wear:assembleDebug :phone:assembleDebug
# Expected: BUILD SUCCESSFUL
# APKs generados en:
#   wear/build/outputs/apk/debug/wear-debug.apk
#   phone/build/outputs/apk/debug/phone-debug.apk
```

- [ ] **Step 2: Obtener IP local del PC**

```bash
# Windows
ipconfig | grep "IPv4"
# Ejemplo: 192.168.1.105
```

- [ ] **Step 3: Instalar companion app en el teléfono**

```bash
# Teléfono conectado por USB con USB debugging activado
adb -s <phone_serial> install phone/build/outputs/apk/debug/phone-debug.apk
```

- [ ] **Step 4: Instalar wear app en el reloj**

```bash
# Activar ADB en el reloj: Configuración → Sistema → Acerca del reloj → tap 7 veces en número de compilación
# Luego: Configuración → Opciones de desarrollador → Depuración ADB → IP y puerto
# El reloj muestra su IP, ej: 192.168.1.110:5555
adb connect 192.168.1.110:5555
adb -s 192.168.1.110:5555 install wear/build/outputs/apk/debug/wear-debug.apk
```

- [ ] **Step 5: Configurar URL del backend en el teléfono**

1. Abrir "Voice Notes" en el teléfono
2. Ingresar `http://192.168.1.105:8000` (IP de tu PC)
3. Tocar "Guardar"

- [ ] **Step 6: Verificar flujo completo**

1. Iniciar backend: `cd voice-notes-ai && iniciar.bat`
2. En el reloj: abrir "Voice Notes" → tocar 🎙 → hablar → tocar ⏹
3. El reloj muestra "¡Enviado!"
4. En `http://localhost:5173` (PWA) → tab Notas: la nota aparece transcribiendo
5. Tras ~30s la nota muestra la transcripción y el chat está disponible

- [ ] **Step 7: Crear `android/README.md`**

```markdown
# Voice Notes — Android (Wear OS + Phone)

## Requisitos
- Android Studio Hedgehog (2023.1.1) o superior
- JDK 17
- SDK: Android 14 (API 34) + Wear OS 3 (API 30)
- Dispositivos: Samsung Watch Ultra + cualquier Android con la companion app

## Build
```bash
./gradlew :wear:assembleDebug   # APK para el reloj
./gradlew :phone:assembleDebug  # APK para el teléfono
```

## Instalación

### Teléfono
```bash
adb install phone/build/outputs/apk/debug/phone-debug.apk
```

### Reloj (ADB over WiFi)
```bash
# 1. Activar depuración ADB en el reloj:
#    Configuración → Sistema → Acerca del reloj → tap Build number x7
#    Configuración → Opciones de desarrollador → Depuración ADB → IP y puerto
# 2. Conectar:
adb connect <WATCH_IP>:5555
adb -s <WATCH_IP>:5555 install wear/build/outputs/apk/debug/wear-debug.apk
```

## Configuración
1. Abrir "Voice Notes" en el teléfono
2. Ingresar la IP local de tu PC (ver con `ipconfig`)
3. Guardar

## Flujo
Reloj: 🎙 grabar → ⏹ detener → envía via Data Layer → Phone companion recibe → sube al backend → PWA muestra la nota transcrita
```

- [ ] **Step 8: Commit final**

```bash
git add android/README.md
git commit -m "docs: add Android build and install instructions"
```

---

## Notas técnicas

### Por qué ChannelClient y no DataClient
`DataItem` tiene un límite de **100 KB**. Una nota de voz de 30 segundos en M4A pesa ~500 KB. `ChannelClient` es el mecanismo correcto para transferir archivos grandes entre watch y phone.

### applicationId idéntico
Ambos módulos (`wear` y `phone`) usan el mismo `applicationId = "com.voicenotes.wearos"`. Esto es **obligatorio** para que el Data Layer API reconozca que son la misma app y permita la comunicación.

### Backend URL
El backend corre en `localhost:8000` en tu PC. El teléfono debe estar en la **misma red WiFi** que el PC. La IP de tu PC puede cambiar — si el reloj deja de enviar, verificar que la IP en la companion app esté actualizada.

### ADB en el reloj sin cable
El Samsung Watch Ultra soporta ADB over WiFi. No necesita cable USB. Ambos dispositivos deben estar en la misma red durante la instalación.
