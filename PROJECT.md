# Voice Notes AI

App full-stack para grabar notas de voz, transcribirlas automáticamente con Whisper, y analizarlas con Claude. Incluye chat con contexto de las grabaciones, resúmenes ejecutivos, y generación de mapas mentales.


**Versión:** 0.3.0

## Stack tecnológico

### Backend
- **Python 3** con **FastAPI** 0.115
- **Anthropic SDK** 0.40 — Claude Opus 4.6 para chat, resúmenes y mindmaps
- **faster-whisper** 1.1 — transcripción de audio local (no API)
- **SQLAlchemy** 2.0 — ORM con SQLite
- **aiofiles** — escritura async de archivos
- **python-dotenv** — carga de variables de entorno
- **uvicorn** 0.32 — servidor ASGI

### Frontend
- **React** 18.3 con **TypeScript** 5.6
- **Vite** 5.4 — bundler y dev server
- **Tailwind CSS** 3.4 — estilos
- Web Speech API (SpeechSynthesis) para TTS

## Variables de entorno

| Variable | Descripción | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | API key de Anthropic | (requerida) |
| `WHISPER_MODEL` | Modelo de Whisper: tiny, base, small, medium, large | `base` |

Ver `.env.example` en la raíz del proyecto.

## Estructura de archivos

```
voice-notes-ai/
├── backend/
│   ├── main.py              # FastAPI app con todos los endpoints
│   ├── database.py          # SQLAlchemy models (SQLite)
│   ├── transcription.py     # Transcripción con faster-whisper
│   ├── ai_service.py        # Integración con Claude (chat, resúmenes, mindmaps)
│   ├── requirements.txt     # Dependencias Python
│   └── .env.example         # Template de variables (legacy, usar el de raíz)
├── frontend/
│   ├── src/
│   │   ├── main.tsx         # Entry point React
│   │   ├── App.tsx          # Componente raíz con vistas
│   │   ├── index.css        # Estilos base + Tailwind
│   │   ├── types.ts         # TypeScript types compartidos
│   │   ├── components/
│   │   │   ├── UploadArea.tsx        # Drag & drop para subir audio
│   │   │   ├── RecordingsList.tsx    # Lista de grabaciones
│   │   │   ├── RecordingCard.tsx     # Card individual de grabación
│   │   │   ├── AudioPlayer.tsx       # Reproductor de audio
│   │   │   ├── TranscriptViewer.tsx  # Visor de transcripción con timestamps
│   │   │   ├── ChatInterface.tsx     # Chat con Claude sobre las grabaciones
│   │   │   └── MindMap.tsx           # Visualización de mapa mental
│   │   ├── hooks/
│   │   │   ├── useVoice.ts           # Hook para grabación de voz
│   │   │   └── useTTS.ts            # Hook para text-to-speech
│   │   └── services/
│   │       └── api.ts               # Cliente HTTP para el backend
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── postcss.config.js
├── instalar.bat             # Script de instalación (Windows)
├── iniciar.bat              # Script para arrancar backend + frontend (Windows)
├── .env.example             # Template de variables de entorno
├── .gitignore               # Exclusiones de git
├── PROJECT.md               # Este archivo
└── CLAUDE.md                # Instrucciones para Claude Code
```

## Qué hace cada archivo

### Backend
- **main.py** — API REST con FastAPI:
  - `GET /api/health` — health check
  - `GET /api/recordings` — listar grabaciones
  - `GET /api/recordings/:id` — detalle de grabación
  - `POST /api/recordings/upload` — subir audio (transcripción en background)
  - `GET /api/recordings/:id/audio` — servir archivo de audio
  - `GET /api/recordings/:id/transcript` — transcripción con segmentos
  - `POST /api/recordings/:id/summary` — generar resumen con Claude
  - `POST /api/recordings/:id/mindmap` — generar mapa mental con Claude
  - `POST /api/chat/stream` — chat streaming con Claude usando contexto de grabaciones
  - `DELETE /api/recordings/:id` — eliminar grabación
- **database.py** — Modelo `Recording` con SQLAlchemy (SQLite). Campos: filename, transcription, segments JSON, language, duration, title, summary
- **transcription.py** — Transcripción local con faster-whisper. VAD filter, beam search, formato de timestamps `[MM:SS]` para Claude
- **ai_service.py** — Integración con Claude Opus 4.6:
  - `stream_answer()` — chat streaming con contexto de grabaciones
  - `generate_summary()` — resumen ejecutivo con puntos clave y timestamps
  - `generate_mindmap()` — mapa mental JSON con structured output

### Frontend
- **App.tsx** — Layout principal con lista de grabaciones, upload, y detalle con tabs
- **UploadArea.tsx** — Drag & drop para subir archivos de audio
- **RecordingsList.tsx / RecordingCard.tsx** — Lista y cards de grabaciones
- **AudioPlayer.tsx** — Reproductor de audio con controles
- **TranscriptViewer.tsx** — Transcripción con timestamps clickeables
- **ChatInterface.tsx** — Chat con Claude sobre las grabaciones (SSE streaming)
- **MindMap.tsx** — Visualización de mapa mental generado por Claude
- **useVoice.ts** — Hook para grabar audio desde el micrófono
- **useTTS.ts** — Hook para text-to-speech
- **api.ts** — Cliente API con fetch para todos los endpoints del backend

## Cómo correr el proyecto

### Opción 1: Scripts de Windows
```bash
# Instalar todo
instalar.bat

# Editar backend/.env con tu ANTHROPIC_API_KEY

# Iniciar backend + frontend
iniciar.bat
```

### Opción 2: Manual
```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp ../.env.example .env      # Editar con tu API key
python main.py               # http://localhost:8000

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

## Status actual

- Prototipo funcional con backend y frontend
- Transcripción local con faster-whisper (no depende de API externa)
- Chat streaming con Claude Opus 4.6 usando contexto de grabaciones
- Resúmenes ejecutivos con timestamps
- Mapas mentales generados con structured output
- Base de datos SQLite local
- Soporta múltiples formatos de audio: m4a, mp3, wav, ogg, aac, flac, mp4, webm
- Frontend con React + TypeScript + Tailwind


## Roadmap

### Sprint 1 — MVP Backend (Completado)
- FastAPI con endpoints de upload y transcripción
- Integración con faster-whisper para transcripción local
- Base de datos SQLite con SQLAlchemy

### Sprint 2 — Frontend React (Completado)
- UI con React + TypeScript + Tailwind
- Componentes: UploadArea, RecordingCard, AudioPlayer, TranscriptViewer
- Chat streaming con Claude usando SSE

### Sprint 3 — IA Avanzada (Completado)
- Resúmenes ejecutivos con Claude Opus 4.6
- Generación de mapas mentales con structured output
- Chat con contexto de múltiples grabaciones

### Sprint 4 — Grabación y TTS (Completado)
- Hook useVoice para grabación desde micrófono
- Text-to-speech con Web Speech API
- Soporte para múltiples formatos de audio


## Bugs conocidos

| Bug | Severidad | Status |
|---|---|---|
| La transcripción con faster-whisper falla si el audio tiene más de 30 minutos | Medio | Abierto |
| El streaming SSE se corta en algunos proxies corporativos | Medio | Abierto |
| La base de datos SQLite se bloquea con escrituras concurrentes (múltiples uploads simultáneos) | Alto | Abierto |
| El mapa mental no renderiza correctamente con más de 20 nodos | Bajo | Abierto |
| Los archivos .webm del navegador a veces no se transcriben correctamente | Medio | Abierto |


## Siguientes pasos recomendados

- [ ] **Migrar de SQLite a PostgreSQL** — Para soportar escrituras concurrentes y preparar para deploy en la nube
- [ ] **Agregar autenticación** — OAuth o API keys para uso multi-usuario
- [ ] **Deploy en la nube** — Dockerizar y deployar en Railway/Fly.io para acceso remoto
- [ ] **Búsqueda semántica** — Implementar vector search sobre las transcripciones para encontrar contenido específico
- [ ] **Exportar transcripciones** — PDF, TXT, y SRT (subtítulos) como formatos de exportación
- [ ] **Carpetas/tags para organizar** — Sistema de organización para grabaciones
- [ ] **Notificaciones de transcripción** — WebSocket para notificar cuando una transcripción larga termina


## Changelog

### v0.3.0 — 2026-03-15
- Agregado chat streaming con Claude Opus 4.6 y contexto de grabaciones
- Agregado generación de mapas mentales con structured output
- Agregado resúmenes ejecutivos con timestamps
- Mejora: soporte para múltiples formatos de audio

### v0.2.0 — 2026-02-28
- Agregado frontend con React + TypeScript + Tailwind
- Agregado reproductor de audio y visor de transcripciones
- Agregado drag & drop para subir archivos
- Agregado hook useVoice para grabar desde micrófono

### v0.1.0 — 2026-02-10
- MVP backend con FastAPI
- Transcripción local con faster-whisper
- Base de datos SQLite con SQLAlchemy

## Notas para Claude Code

- El backend usa Claude Opus 4.6 (`claude-opus-4-6`) — no cambiar sin consultar
- La transcripción es LOCAL con faster-whisper, no usa API de OpenAI
- La DB es SQLite (`voice_notes.db`) — se crea automáticamente
- Los archivos de audio se guardan en `backend/uploads/`
- El chat usa SSE (Server-Sent Events) para streaming
- CORS configurado para localhost:5173 y localhost:3000
- Nunca commitear .env ni la base de datos
