# Voice Notes AI — PWA Móvil + Integración Mission Control

**Fecha:** 2026-04-02
**Estado:** Aprobado
**Autor:** Erick Valdez

---

## 1. Objetivo

Transformar Voice Notes AI en una PWA mobile-first que funcione desde el Samsung Watch Ultra y el celular, y que automáticamente extraiga tareas de las notas de voz y las guarde en Mission Control Panel (Supabase) para revisión y gestión.

---

## 2. Alcance

### En scope
- Rediseño completo del frontend como PWA mobile-first (watch + celular)
- Extracción automática de tareas después de cada transcripción
- Inserción directa en Supabase de Mission Control vía service role key
- Interfaz de 3 tabs en celular: Grabar / Notas / Chat
- Interfaz mínima en watch: 2 botones (Grabar + Preguntar por voz)
- Consultas por voz (TTS response) para use en watch

### Fuera de scope
- Autenticación en Voice Notes AI
- Edición manual de transcripciones
- Exportación a PDF/DOCX
- Notificaciones push
- Cambios en Mission Control Panel

---

## 3. Arquitectura

```
[Watch / Celular]
     |  PWA (navegador)
     v
[Voice Notes AI — FastAPI]
     |  faster-whisper (local)
     |  Claude Opus 4.6
     |
     +-- SQLite (notas, transcripciones)
     |
     +-- Supabase Python Client
          |  service role key (SECRET)
          v
     [Mission Control — Supabase PostgreSQL]
          tabla: tasks
```

### Flujo principal

1. Usuario abre PWA desde watch o celular → graba o sube audio
2. Backend transcribe con faster-whisper (local, sin API externa)
3. Claude analiza la transcripción y extrae lista de títulos de tareas pendientes
4. Backend inserta cada tarea en Supabase con: `title`, `status=pending`, `priority=medium`, `category=General`, `user_id` (desde env var)
5. Se actualiza `recordings.tasks_count` con el número de tareas guardadas
6. Frontend muestra badge "✓ N tareas → Mission Control" en la nota

---

## 4. Cambios al Backend

### 4.1 Nuevo archivo: `backend/supabase_service.py`

Responsabilidad única: insertar tareas en Mission Control.

```python
# Interfaz pública
async def save_tasks_to_mission_control(task_titles: list[str]) -> int:
    """Inserta tareas en Supabase. Retorna el número de tareas guardadas."""
```

- Usa `supabase-py` con `SUPABASE_SERVICE_ROLE_KEY` (nunca expuesto al frontend)
- Si `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` no están configurados, loguea warning y retorna 0 sin fallar
- Cada tarea: `title`, `status="pending"`, `priority="medium"`, `category="General"`, `user_id=SUPABASE_USER_ID`
- Errores de Supabase se loguean pero no bloquean el flujo principal

### 4.2 Modificación: `backend/ai_service.py`

Nueva función:

```python
async def extract_tasks(transcript: str) -> list[str]:
    """Extrae tareas pendientes de una transcripción. Retorna lista de títulos."""
```

- Prompt a Claude: identificar compromisos, pendientes y tareas mencionadas en la nota
- Retorna lista vacía si no hay tareas (no falla)
- Usa structured output (JSON array de strings)
- Modelo: Claude Opus 4.6 (consistente con el resto del proyecto)

### 4.3 Modificación: `backend/database.py`

Agregar campo al modelo `Recording`:
```python
tasks_count: int = Column(Integer, default=0)
```

### 4.4 Modificación: `backend/main.py`

En la background task de transcripción, después de completar:
```python
# Después de transcribir:
task_titles = await extract_tasks(transcription_text)
if task_titles:
    count = await save_tasks_to_mission_control(task_titles)
    recording.tasks_count = count
```

La tarea de transcripción ya es async/background — la extracción de tareas se encadena ahí mismo.

### 4.5 Modificación: `backend/requirements.txt`

```
supabase>=2.0.0
```

### 4.6 Modificación: `.env.example`

```
# Anthropic
ANTHROPIC_API_KEY=

# Whisper
WHISPER_MODEL=base

# Mission Control — Supabase (SECRETOS — nunca en frontend)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_USER_ID=
```

**Clasificación de variables:**
| Variable | Tipo | Dónde va |
|---|---|---|
| `ANTHROPIC_API_KEY` | Secreta | Backend `.env` únicamente |
| `SUPABASE_URL` | Pública (proyecto) | Backend `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secreta** | Backend `.env` únicamente — NUNCA en frontend |
| `SUPABASE_USER_ID` | Privada | Backend `.env` |
| `WHISPER_MODEL` | Configuración | Backend `.env` |

---

## 5. Cambios al Frontend

### 5.1 PWA Manifest

Nuevo archivo `frontend/public/manifest.json`:
- `name`: "Voice Notes AI"
- `display`: "standalone"
- `start_url`: "/"
- `theme_color`: indigo (#6366f1)
- Íconos para pantalla de inicio

### 5.2 Rediseño mobile-first

El frontend se rediseña completamente con layout adaptativo:

**Celular (≥ 375px):**
- 3 tabs en barra inferior: Grabar / Notas / Chat
- Tab Grabar: botón grande central (tap para iniciar/detener grabación) + upload drag-and-drop
- Tab Notas: lista de notas con badge de tareas guardadas en Mission Control
- Tab Chat: chat completo con Claude (texto o voz), respuesta en texto

**Watch (viewport ≤ 320px — Samsung Watch Ultra Wear OS browser):**
- 2 botones grandes centrados: 🎙️ Grabar + 🔊 Preguntar
- Sin texto de navegación, solo iconos
- Detección: `window.screen.width <= 320` o `@media (max-width: 320px)`
- Botón Preguntar: tap → activa micrófono → transcribe pregunta → Claude responde → TTS automático

**Desktop (≥ 1024px):**
- Mantiene layout actual de sidebar + panel principal

### 5.3 Componentes nuevos / modificados

| Componente | Cambio |
|---|---|
| `App.tsx` | Layout adaptativo (watch / mobile / desktop) |
| `MobileLayout.tsx` | Nuevo — tabs móvil con 3 pantallas |
| `WatchLayout.tsx` | Nuevo — 2 botones para watch |
| `RecordingCard.tsx` | Agrega badge `tasks_count` |
| `api.ts` | Expone `tasks_count` del endpoint `/api/recordings` |

---

## 6. Seguridad

Aplicando estándares del proyecto:

- **`SUPABASE_SERVICE_ROLE_KEY` nunca sale del backend** — es el equivalente a una contraseña de admin de la DB. Si se expone en el frontend, cualquiera puede leer/escribir todos los datos de Mission Control.
- **`SUPABASE_USER_ID` en `.env`** — no hardcodeado en código
- **Validación de inputs**: el endpoint de upload ya valida extensiones; no se cambia
- **Errores de Supabase no se exponen al cliente** — se loguean en backend, el cliente solo ve `tasks_count: 0`
- **Sin autenticación en Voice Notes AI**: es una app local/personal — si se despliega en la nube en el futuro, agregar auth será un sprint separado
- **Rate limiting**: no se agrega en este sprint (pendiente deuda técnica)

---

## 7. Manejo de Errores

| Escenario | Comportamiento |
|---|---|
| Supabase no configurado | Log warning, `tasks_count = 0`, flujo continúa |
| Error al insertar tarea | Log error por tarea, las demás se guardan, `tasks_count` = las que sí se guardaron |
| Claude no detecta tareas | Lista vacía, `tasks_count = 0`, sin llamada a Supabase |
| Transcripción falla | Sin extracción de tareas (comportamiento actual) |

---

## 8. Testing

### Backend (pytest)
- Test unitario `extract_tasks()`: mock de Claude, verifica que retorna lista de strings
- Test unitario `save_tasks_to_mission_control()`: mock de Supabase client, verifica inserts
- Test integración: upload → transcripción → `tasks_count > 0` en la respuesta (con mocks)

### Frontend
- Tests manuales en dispositivos reales: Samsung Watch Ultra y celular Samsung
- Verificar PWA instalable desde Chrome móvil (manifest + HTTPS o localhost)

---

## 9. Archivos Creados / Modificados

```
voice-notes-ai/
├── backend/
│   ├── supabase_service.py      ← NUEVO
│   ├── ai_service.py            ← MODIFICADO (extract_tasks)
│   ├── database.py              ← MODIFICADO (tasks_count)
│   ├── main.py                  ← MODIFICADO (encadenar extracción)
│   └── requirements.txt         ← MODIFICADO (supabase)
├── frontend/
│   ├── public/
│   │   └── manifest.json        ← NUEVO
│   └── src/
│       ├── App.tsx              ← MODIFICADO (layout adaptativo)
│       ├── components/
│       │   ├── MobileLayout.tsx ← NUEVO
│       │   ├── WatchLayout.tsx  ← NUEVO
│       │   └── RecordingCard.tsx ← MODIFICADO (badge)
│       └── services/
│           └── api.ts           ← MODIFICADO (tasks_count)
├── .env.example                 ← MODIFICADO (vars Supabase)
└── PROJECT.md                   ← ACTUALIZAR al final
```

---

## 10. Dependencias Externas

- **Supabase project de Mission Control**: necesitas `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del proyecto existente
- **`user_id` de Erick en Mission Control**: obtenerlo desde Supabase Auth dashboard o ejecutando `SELECT id FROM auth.users LIMIT 1`
