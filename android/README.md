# Voice Notes — Android (Wear OS + Phone)

## Requisitos

- Android Studio Hedgehog (2023.1.1) o superior
- JDK 17
- SDK: Android 14 (API 34) + Wear OS 3 (API 30)
- Dispositivos: Samsung Watch Ultra + cualquier Android

## Obtener gradle-wrapper.jar

El binario `gradle/wrapper/gradle-wrapper.jar` no está en el repo. Hay tres formas de obtenerlo:

1. **Android Studio** — abre la carpeta `android/` como proyecto, Android Studio lo descarga automáticamente
2. **Gradle local** — si tienes Gradle instalado: `gradle wrapper --gradle-version 8.6`
3. **Copiar** de cualquier otro proyecto Android existente en tu máquina

## Build

```bash
./gradlew :wear:assembleDebug   # APK para el reloj
./gradlew :phone:assembleDebug  # APK para el teléfono
```

APKs generados en:
- `wear/build/outputs/apk/debug/wear-debug.apk`
- `phone/build/outputs/apk/debug/phone-debug.apk`

## Instalación

### Companion app en el teléfono

```bash
# Teléfono conectado por USB con USB debugging activado
adb install phone/build/outputs/apk/debug/phone-debug.apk
```

### App en el Samsung Watch Ultra (ADB over WiFi)

```bash
# 1. Activar modo desarrollador en el reloj:
#    Configuración → Sistema → Acerca del reloj → tap 7 veces en "Número de compilación"
# 2. Activar ADB:
#    Configuración → Opciones de desarrollador → Depuración ADB → activar → "IP y puerto"
# 3. Conectar desde la PC (el reloj muestra su IP):
adb connect <WATCH_IP>:5555
adb -s <WATCH_IP>:5555 install wear/build/outputs/apk/debug/wear-debug.apk
```

## Configuración inicial

1. Abrir "Voice Notes" en el teléfono
2. Ingresar la URL del backend: `http://<IP-DE-TU-PC>:8000`
   - Obtener la IP con: `ipconfig` (Windows) → buscar "Dirección IPv4"
3. Tocar **Guardar**

> El teléfono y el PC deben estar en la misma red WiFi.

## Flujo de uso

```
Reloj: 🎙 Toca para grabar
         ↓ habla tu nota
       ⏹ Toca para detener
         ↓ "Enviando..."
         ↓ "¡Enviado!"

Teléfono: AudioChannelService recibe el audio → lo sube al backend

Backend: transcribe con faster-whisper → extrae tareas con Claude

PWA (http://localhost:5173):
  Tab Notas → la nueva nota aparece → transcripción disponible en ~30s
  Tab Chat → pregunta sobre la nota
```

## Arquitectura técnica

| Componente | Tecnología | Rol |
|---|---|---|
| Wear app | Compose for Wear OS | UI en el reloj, graba audio |
| WatchSender | ChannelClient (Data Layer) | Transfiere archivo al teléfono |
| AudioChannelService | WearableListenerService | Recibe audio en background |
| BackendUploader | OkHttp | POST multipart al backend |
| Phone UI | Jetpack Compose Material3 | Configura URL del backend |

> **¿Por qué ChannelClient y no DataClient?**
> `DataItem` tiene límite de 100 KB. Una nota de 30s en M4A pesa ~500 KB.
> `ChannelClient` es el mecanismo correcto para archivos grandes.
