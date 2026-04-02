# Voice Notes AI — Mobile PWA + Mission Control Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Voice Notes AI into a mobile-first PWA that runs on Samsung Watch Ultra and phone, and automatically extracts tasks from transcribed notes and saves them to Mission Control Panel (Supabase).

**Architecture:** After each transcription, Claude extracts pending task titles from the transcript and inserts them directly into Mission Control's Supabase `tasks` table using a service role key stored only in the backend. The frontend is redesigned as an adaptive PWA: a 2-button interface for watch (≤320px) and a 3-tab interface for mobile, while preserving the existing desktop layout.

**Tech Stack:** Python/FastAPI (backend), supabase-py 2.x (Supabase client), React 18/TypeScript (frontend), MediaRecorder API (audio capture), Web Speech API (voice query on watch), Tailwind CSS.

---

## File Map

### Backend — new / modified
| File | Action | Responsibility |
|---|---|---|
| `backend/database.py` | Modify | Add `tasks_count` column to `Recording` model |
| `backend/supabase_service.py` | **Create** | Supabase client + insert tasks into Mission Control |
| `backend/ai_service.py` | Modify | Add `extract_tasks()` function |
| `backend/main.py` | Modify | Add `tasks_count` to `RecordingOut`; wire extraction in `_transcribe_recording` |
| `backend/requirements.txt` | Modify | Add `supabase>=2.0.0` |
| `.env.example` | Modify | Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_USER_ID` |
| `backend/tests/conftest.py` | Modify | Add mocks for `extract_tasks` and `save_tasks_to_mission_control` |
| `backend/tests/test_tasks.py` | **Create** | Unit tests for new backend services |

### Frontend — new / modified
| File | Action | Responsibility |
|---|---|---|
| `frontend/src/types.ts` | Modify | Add `tasks_count: number` to `Recording` interface |
| `frontend/src/components/RecordingCard.tsx` | Modify | Show tasks_count badge |
| `frontend/public/manifest.json` | **Create** | PWA manifest for "Add to home screen" |
| `frontend/index.html` | Modify | Link manifest |
| `frontend/src/hooks/useAudioRecorder.ts` | **Create** | MediaRecorder wrapper — record audio → File |
| `frontend/src/components/WatchLayout.tsx` | **Create** | 2-button watch UI (record + voice query) |
| `frontend/src/components/MobileLayout.tsx` | **Create** | 3-tab mobile UI (Grabar / Notas / Chat) |
| `frontend/src/App.tsx` | Modify | Adaptive layout detection (watch / mobile / desktop) |

---

## Task 1: Add `tasks_count` to DB model

**Files:**
- Modify: `backend/database.py`

- [ ] **Step 1: Open `backend/database.py` and add the column**

Replace the `Recording` class with:

```python
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, Boolean
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./voice_notes.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Recording(Base):
    __tablename__ = "recordings"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, nullable=False)
    original_name = Column(String, nullable=False)
    duration = Column(Float, nullable=True)
    file_size = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    transcribed = Column(Boolean, default=False)
    transcription = Column(Text, nullable=True)
    transcription_json = Column(Text, nullable=True)  # JSON segments with timestamps
    language = Column(String, nullable=True)
    title = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    tasks_count = Column(Integer, default=0)


Base.metadata.create_all(bind=engine)
```

- [ ] **Step 2: Delete the existing SQLite database so it recreates with the new schema**

```bash
# From the backend/ directory
rm -f voice_notes.db
```

> SQLite does not support ADD COLUMN with DEFAULT via SQLAlchemy's `create_all`; recreating is the correct approach for development.

- [ ] **Step 3: Verify the column was added**

```bash
cd backend
python -c "from database import Recording; print([c.name for c in Recording.__table__.columns])"
```

Expected output:
```
['id', 'filename', 'original_name', 'duration', 'file_size', 'created_at', 'transcribed', 'transcription', 'transcription_json', 'language', 'title', 'summary', 'tasks_count']
```

- [ ] **Step 4: Commit**

```bash
git add backend/database.py
git commit -m "feat: add tasks_count column to Recording model"
```

---

## Task 2: Create `supabase_service.py` (TDD)

**Files:**
- Create: `backend/supabase_service.py`
- Create: `backend/tests/test_tasks.py`

- [ ] **Step 1: Write the failing tests first**

Create `backend/tests/test_tasks.py`:

```python
import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock


# ── save_tasks_to_mission_control ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_save_tasks_returns_count_when_configured():
    """Should insert each task and return the count of saved tasks."""
    mock_client = MagicMock()
    mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock()

    with patch("supabase_service._get_client", return_value=mock_client), \
         patch.dict("os.environ", {"SUPABASE_USER_ID": "test-user-uuid"}):
        import importlib
        import supabase_service
        importlib.reload(supabase_service)

        count = await supabase_service.save_tasks_to_mission_control(
            ["Buy milk", "Call dentist"]
        )
        assert count == 2


@pytest.mark.asyncio
async def test_save_tasks_returns_zero_when_not_configured():
    """Should return 0 and not raise when Supabase is not configured."""
    with patch("supabase_service._get_client", return_value=None), \
         patch.dict("os.environ", {}, clear=True):
        import importlib
        import supabase_service
        importlib.reload(supabase_service)

        count = await supabase_service.save_tasks_to_mission_control(["Task 1"])
        assert count == 0


@pytest.mark.asyncio
async def test_save_tasks_returns_zero_for_empty_list():
    """Should return 0 immediately for an empty list without calling Supabase."""
    with patch("supabase_service._get_client") as mock_get:
        import importlib
        import supabase_service
        importlib.reload(supabase_service)

        count = await supabase_service.save_tasks_to_mission_control([])
        mock_get.assert_not_called()
        assert count == 0


@pytest.mark.asyncio
async def test_save_tasks_partial_failure_counts_successes():
    """If one insert fails, the others should still save and be counted."""
    mock_client = MagicMock()
    call_count = 0

    def side_effect():
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            raise Exception("Supabase error on second task")
        return MagicMock()

    mock_client.table.return_value.insert.return_value.execute.side_effect = side_effect

    with patch("supabase_service._get_client", return_value=mock_client), \
         patch.dict("os.environ", {"SUPABASE_USER_ID": "test-user-uuid"}):
        import importlib
        import supabase_service
        importlib.reload(supabase_service)

        count = await supabase_service.save_tasks_to_mission_control(
            ["Task 1", "Task 2", "Task 3"]
        )
        assert count == 2  # Task 2 failed, Tasks 1 and 3 succeeded
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
python -m pytest tests/test_tasks.py -v
```

Expected: `ModuleNotFoundError: No module named 'supabase_service'`

- [ ] **Step 3: Create `backend/supabase_service.py`**

```python
import os
import asyncio

from dotenv import load_dotenv

load_dotenv()


def _get_client():
    """Build a synchronous Supabase client. Returns None if env vars are missing."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception as e:
        print(f"[Supabase] Failed to create client: {e}")
        return None


async def save_tasks_to_mission_control(task_titles: list[str]) -> int:
    """Insert tasks into Mission Control Supabase. Returns count of tasks saved.

    Never raises — errors are logged and the caller receives partial count.
    Returns 0 if Supabase is not configured or task_titles is empty.
    """
    if not task_titles:
        return 0

    user_id = os.getenv("SUPABASE_USER_ID")
    if not user_id:
        print("[Supabase] SUPABASE_USER_ID not set — skipping task save")
        return 0

    client = _get_client()
    if client is None:
        print("[Supabase] Not configured — skipping task save")
        return 0

    saved = 0
    for title in task_titles:
        row = {
            "user_id": user_id,
            "title": title,
            "status": "pending",
            "priority": "medium",
            "category": "General",
        }
        try:
            await asyncio.to_thread(
                lambda r=row: client.table("tasks").insert(r).execute()
            )
            saved += 1
        except Exception as e:
            print(f"[Supabase] Failed to save task '{title}': {e}")

    print(f"[Supabase] Saved {saved}/{len(task_titles)} tasks to Mission Control")
    return saved
```

- [ ] **Step 4: Add `supabase>=2.0.0` to requirements**

Edit `backend/requirements.txt`, add at the end:
```
supabase>=2.0.0
```

- [ ] **Step 5: Install the new dependency**

```bash
cd backend
pip install supabase>=2.0.0
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
cd backend
python -m pytest tests/test_tasks.py::test_save_tasks_returns_count_when_configured \
    tests/test_tasks.py::test_save_tasks_returns_zero_when_not_configured \
    tests/test_tasks.py::test_save_tasks_returns_zero_for_empty_list \
    tests/test_tasks.py::test_save_tasks_partial_failure_counts_successes \
    -v
```

Expected:
```
PASSED tests/test_tasks.py::test_save_tasks_returns_count_when_configured
PASSED tests/test_tasks.py::test_save_tasks_returns_zero_when_not_configured
PASSED tests/test_tasks.py::test_save_tasks_returns_zero_for_empty_list
PASSED tests/test_tasks.py::test_save_tasks_partial_failure_counts_successes
```

- [ ] **Step 7: Commit**

```bash
git add backend/supabase_service.py backend/requirements.txt backend/tests/test_tasks.py
git commit -m "feat: add supabase_service with save_tasks_to_mission_control"
```

---

## Task 3: Add `extract_tasks()` to `ai_service.py` (TDD)

**Files:**
- Modify: `backend/ai_service.py`
- Modify: `backend/tests/test_tasks.py`

- [ ] **Step 1: Append tests for `extract_tasks` to `test_tasks.py`**

Append to the end of `backend/tests/test_tasks.py`:

```python
# ── extract_tasks ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_extract_tasks_returns_list_of_strings():
    """Should parse Claude's JSON response into a list of task titles."""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='["Buy groceries", "Call the dentist"]')]

    with patch("ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        import importlib
        import ai_service
        importlib.reload(ai_service)

        result = await ai_service.extract_tasks(
            "I need to buy groceries and call the dentist tomorrow."
        )
        assert result == ["Buy groceries", "Call the dentist"]


@pytest.mark.asyncio
async def test_extract_tasks_empty_transcript_skips_claude():
    """Should return [] immediately without calling Claude for empty input."""
    with patch("ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock()
        import importlib
        import ai_service
        importlib.reload(ai_service)

        result = await ai_service.extract_tasks("")
        mock_client.messages.create.assert_not_called()
        assert result == []


@pytest.mark.asyncio
async def test_extract_tasks_returns_empty_list_when_no_tasks():
    """Should return [] when Claude finds no tasks in the transcript."""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='[]')]

    with patch("ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        import importlib
        import ai_service
        importlib.reload(ai_service)

        result = await ai_service.extract_tasks("The weather is nice today.")
        assert result == []


@pytest.mark.asyncio
async def test_extract_tasks_returns_empty_on_bad_json():
    """Should return [] gracefully when Claude returns non-JSON output."""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='I could not find any tasks.')]

    with patch("ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        import importlib
        import ai_service
        importlib.reload(ai_service)

        result = await ai_service.extract_tasks("Some transcript text.")
        assert result == []
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
cd backend
python -m pytest tests/test_tasks.py::test_extract_tasks_returns_list_of_strings \
    tests/test_tasks.py::test_extract_tasks_empty_transcript_skips_claude \
    -v
```

Expected: `AttributeError: module 'ai_service' has no attribute 'extract_tasks'`

- [ ] **Step 3: Add `extract_tasks()` to `backend/ai_service.py`**

Add this function at the end of `backend/ai_service.py` (after `generate_mindmap`):

```python
async def extract_tasks(transcript: str) -> list[str]:
    """Extract pending task titles from a transcript using Claude.

    Returns a list of task title strings.
    Returns [] if transcript is empty or no tasks are found.
    Never raises — parse errors return [].
    """
    if not transcript or not transcript.strip():
        return []

    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        system=(
            "You are a task extraction assistant. "
            "Extract all pending tasks, commitments, and action items from the transcript. "
            "Return ONLY a valid JSON array of short task title strings (max 120 chars each). "
            'Example: ["Send proposal to client", "Schedule follow-up meeting"]. '
            "Return [] if no tasks are found. No explanation, only JSON."
        ),
        messages=[{"role": "user", "content": transcript}],
    )

    text = response.content[0].text.strip()
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return [str(t) for t in result if t]
    except json.JSONDecodeError:
        print(f"[extract_tasks] Could not parse Claude response as JSON: {text[:100]}")
    return []
```

- [ ] **Step 4: Run all extract_tasks tests**

```bash
cd backend
python -m pytest tests/test_tasks.py -k "extract_tasks" -v
```

Expected:
```
PASSED tests/test_tasks.py::test_extract_tasks_returns_list_of_strings
PASSED tests/test_tasks.py::test_extract_tasks_empty_transcript_skips_claude
PASSED tests/test_tasks.py::test_extract_tasks_returns_empty_list_when_no_tasks
PASSED tests/test_tasks.py::test_extract_tasks_returns_empty_on_bad_json
```

- [ ] **Step 5: Run all backend tests to check nothing regressed**

```bash
cd backend
python -m pytest -v
```

Expected: all tests pass (existing 16 + 8 new = 24 total).

- [ ] **Step 6: Commit**

```bash
git add backend/ai_service.py backend/tests/test_tasks.py
git commit -m "feat: add extract_tasks function to ai_service"
```

---

## Task 4: Wire task extraction in `main.py`

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update the import block at the top of `main.py`**

Find the existing imports section:
```python
from ai_service import generate_summary, generate_mindmap, stream_answer
```

Replace with:
```python
from ai_service import generate_summary, generate_mindmap, stream_answer, extract_tasks
from supabase_service import save_tasks_to_mission_control
```

- [ ] **Step 2: Add `tasks_count` to the `RecordingOut` schema**

Find the `RecordingOut` class (around line 49):
```python
class RecordingOut(BaseModel):
    id: int
    filename: str
    original_name: str
    duration: Optional[float]
    file_size: int
    created_at: datetime
    transcribed: bool
    transcription: Optional[str]
    language: Optional[str]
    title: Optional[str]
    summary: Optional[str]

    class Config:
        from_attributes = True
```

Replace with:
```python
class RecordingOut(BaseModel):
    id: int
    filename: str
    original_name: str
    duration: Optional[float]
    file_size: int
    created_at: datetime
    transcribed: bool
    transcription: Optional[str]
    language: Optional[str]
    title: Optional[str]
    summary: Optional[str]
    tasks_count: int = 0

    class Config:
        from_attributes = True
```

- [ ] **Step 3: Update `_transcribe_recording` to call extraction after transcription**

Find the `_transcribe_recording` function. After the line `rec.transcribed = True` and before `db.commit()`, add the task extraction block:

Before:
```python
        rec.transcribed = True

        db.commit()
        print(f"[Transcription] Done for recording {recording_id}")
```

After:
```python
        rec.transcribed = True

        # Extract tasks and save to Mission Control
        task_titles = await extract_tasks(rec.transcription or "")
        if task_titles:
            tasks_saved = await save_tasks_to_mission_control(task_titles)
            rec.tasks_count = tasks_saved

        db.commit()
        print(f"[Transcription] Done for recording {recording_id}")
```

- [ ] **Step 4: Update `conftest.py` to mock the new services in existing API tests**

Open `backend/tests/conftest.py`. Find the `mock_ai_services` fixture (the `autouse=True` one) and replace it:

```python
@pytest.fixture(autouse=True)
def mock_ai_services():
    """Mock Anthropic / AI service calls and Supabase."""
    with patch("main.generate_summary", new_callable=AsyncMock, return_value="Test summary") as m_sum, \
         patch("main.generate_mindmap", new_callable=AsyncMock, return_value={"nodes": []}) as m_mind, \
         patch("main.stream_answer", new_callable=AsyncMock) as m_stream, \
         patch("main.extract_tasks", new_callable=AsyncMock, return_value=[]) as m_extract, \
         patch("main.save_tasks_to_mission_control", new_callable=AsyncMock, return_value=0) as m_save:
        yield {
            "summary": m_sum,
            "mindmap": m_mind,
            "stream": m_stream,
            "extract_tasks": m_extract,
            "save_tasks": m_save,
        }
```

- [ ] **Step 5: Run all backend tests**

```bash
cd backend
python -m pytest -v
```

Expected: all 24 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/conftest.py
git commit -m "feat: wire task extraction into transcription pipeline"
```

---

## Task 5: Update `.env.example` and `PROJECT.md`

**Files:**
- Modify: `.env.example`
- Modify: `PROJECT.md`

- [ ] **Step 1: Update `.env.example`**

Replace the contents of `.env.example` with:

```
# ── Anthropic ──────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=

# ── Whisper ────────────────────────────────────────────────────────────────
# Options: tiny, base, small, medium, large (larger = slower but more accurate)
WHISPER_MODEL=base

# ── Mission Control — Supabase (SECRETS — backend only, never in frontend) ─
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
# Your user_id from Mission Control's Supabase Auth.
# Get it from: Supabase Dashboard > Authentication > Users
SUPABASE_USER_ID=
```

- [ ] **Step 2: Update the Variables section in `PROJECT.md`**

Find the variables table in `PROJECT.md`:

```markdown
| Variable | Descripción | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | API key de Anthropic | (requerida) |
| `WHISPER_MODEL` | Modelo de Whisper: tiny, base, small, medium, large | `base` |
```

Replace with:

```markdown
| Variable | Tipo | Descripción | Default |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Secreta | API key de Anthropic | (requerida) |
| `WHISPER_MODEL` | Config | Modelo Whisper: tiny, base, small, medium, large | `base` |
| `SUPABASE_URL` | Config | URL del proyecto Supabase de Mission Control | (opcional) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secreta** | Service role key de Supabase — NUNCA en frontend | (opcional) |
| `SUPABASE_USER_ID` | Privada | UUID del usuario en Mission Control Auth | (opcional) |

> Las variables de Supabase son opcionales: si no están configuradas, las tareas no se guardan en Mission Control pero la app sigue funcionando.
```

- [ ] **Step 3: Commit**

```bash
git add .env.example PROJECT.md
git commit -m "docs: add Supabase env vars to .env.example and PROJECT.md"
```

---

## Task 6: Update `Recording` type and `RecordingCard` badge

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/components/RecordingCard.tsx`

- [ ] **Step 1: Add `tasks_count` to the `Recording` interface in `types.ts`**

Find the `Recording` interface:
```typescript
export interface Recording {
  id: number
  filename: string
  original_name: string
  duration: number | null
  file_size: number
  created_at: string
  transcribed: boolean
  transcription: string | null
  language: string | null
  title: string | null
  summary: string | null
}
```

Replace with:
```typescript
export interface Recording {
  id: number
  filename: string
  original_name: string
  duration: number | null
  file_size: number
  created_at: string
  transcribed: boolean
  transcription: string | null
  language: string | null
  title: string | null
  summary: string | null
  tasks_count: number
}
```

- [ ] **Step 2: Add the tasks badge to `RecordingCard.tsx`**

Find the block that renders the language badge (around line 67):
```tsx
          {recording.language && (
            <span className="inline-block text-[10px] bg-gray-800 text-gray-500 rounded px-1.5 py-0.5 mt-1 ml-1">
              {recording.language.toUpperCase()}
            </span>
          )}
```

Add the tasks badge right after it:
```tsx
          {recording.language && (
            <span className="inline-block text-[10px] bg-gray-800 text-gray-500 rounded px-1.5 py-0.5 mt-1 ml-1">
              {recording.language.toUpperCase()}
            </span>
          )}
          {recording.tasks_count > 0 && (
            <span className="inline-block text-[10px] bg-green-900/50 text-green-400 border border-green-800/50 rounded px-1.5 py-0.5 mt-1 ml-1">
              ✓ {recording.tasks_count} {recording.tasks_count === 1 ? 'tarea' : 'tareas'} → MC
            </span>
          )}
```

- [ ] **Step 3: Verify TypeScript compiles without errors**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/components/RecordingCard.tsx
git commit -m "feat: add tasks_count badge to RecordingCard"
```

---

## Task 7: Add PWA manifest

**Files:**
- Create: `frontend/public/manifest.json`
- Modify: `frontend/index.html`

- [ ] **Step 1: Create `frontend/public/manifest.json`**

```json
{
  "name": "Voice Notes AI",
  "short_name": "VoiceNotes",
  "description": "Graba notas de voz, transcribe y analiza con IA",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#6366f1",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Add manifest link to `frontend/index.html`**

Open `frontend/index.html`. Find the `<head>` section and add the manifest link and theme-color meta:

```html
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#6366f1" />
    <link rel="manifest" href="/manifest.json" />
    <title>Voice Notes AI</title>
  </head>
```

> Note: Icons (`icon-192.png`, `icon-512.png`) are optional for local development. Chrome will still show the install prompt with placeholder icons. Add real icons before production deploy.

- [ ] **Step 3: Commit**

```bash
git add frontend/public/manifest.json frontend/index.html
git commit -m "feat: add PWA manifest for home screen install"
```

---

## Task 8: Create `useAudioRecorder` hook

**Files:**
- Create: `frontend/src/hooks/useAudioRecorder.ts`

- [ ] **Step 1: Create `frontend/src/hooks/useAudioRecorder.ts`**

```typescript
import { useState, useRef, useCallback } from 'react'

interface AudioRecorderState {
  isRecording: boolean
  error: string | null
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    error: null,
  })
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = useCallback(async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.start()
      recorderRef.current = recorder
      setState({ isRecording: true, error: null })
    } catch {
      setState({ isRecording: false, error: 'No se pudo acceder al micrófono. Verifica los permisos.' })
    }
  }, [])

  const stop = useCallback((): Promise<File> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current
      if (!recorder) {
        reject(new Error('No hay grabación activa'))
        return
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File(
          [blob],
          `voice-note-${Date.now()}.webm`,
          { type: 'audio/webm' }
        )
        recorder.stream.getTracks().forEach((t) => t.stop())
        setState({ isRecording: false, error: null })
        resolve(file)
      }

      recorder.stop()
    })
  }, [])

  return { ...state, start, stop }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useAudioRecorder.ts
git commit -m "feat: add useAudioRecorder hook with MediaRecorder"
```

---

## Task 9: Create `WatchLayout` component

**Files:**
- Create: `frontend/src/components/WatchLayout.tsx`

- [ ] **Step 1: Create `frontend/src/components/WatchLayout.tsx`**

```tsx
import { useState, useCallback } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useVoiceInput } from '../hooks/useVoice'
import { useTTS } from '../hooks/useTTS'
import { api } from '../services/api'

type WatchState = 'idle' | 'recording' | 'uploading' | 'asking' | 'speaking' | 'error'

export default function WatchLayout() {
  const [watchState, setWatchState] = useState<WatchState>('idle')
  const [status, setStatus] = useState('')

  const { isRecording, start: startRecording, stop: stopRecording } = useAudioRecorder()
  const { start: startListening } = useVoiceInput()
  const { speak } = useTTS()

  const handleRecord = useCallback(async () => {
    if (watchState === 'recording') {
      setWatchState('uploading')
      setStatus('Subiendo...')
      try {
        const file = await stopRecording()
        await api.uploadRecording(file)
        setStatus('✓ Nota guardada')
      } catch {
        setStatus('Error al guardar')
        setWatchState('error')
        setTimeout(() => { setWatchState('idle'); setStatus('') }, 2500)
        return
      }
      setWatchState('idle')
      setTimeout(() => setStatus(''), 2000)
    } else if (watchState === 'idle') {
      await startRecording()
      setWatchState('recording')
      setStatus('Grabando...')
    }
  }, [watchState, startRecording, stopRecording])

  const handleAsk = useCallback(() => {
    if (watchState !== 'idle') return

    setWatchState('asking')
    setStatus('Escuchando...')

    startListening(async (question) => {
      setStatus('Pensando...')
      try {
        let fullResponse = ''
        for await (const chunk of api.streamChat(question, null)) {
          fullResponse += chunk
        }
        setWatchState('speaking')
        setStatus('...')
        speak(fullResponse)
        setTimeout(() => { setWatchState('idle'); setStatus('') }, 500)
      } catch {
        setStatus('Error')
        setTimeout(() => { setWatchState('idle'); setStatus('') }, 2500)
      }
    })
  }, [watchState, startListening, speak])

  const isRecordBusy = watchState === 'uploading' || watchState === 'asking' || watchState === 'speaking'
  const isAskBusy = watchState !== 'idle'

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 gap-5 p-4 select-none">
      <p className="text-gray-600 text-[10px] tracking-widest uppercase">Voice Notes AI</p>

      {status && (
        <p className="text-blue-400 text-xs text-center min-h-[16px]">{status}</p>
      )}

      {/* Record / Stop button */}
      <button
        onClick={handleRecord}
        disabled={isRecordBusy}
        aria-label={watchState === 'recording' ? 'Detener grabación' : 'Grabar nota'}
        className={[
          'w-24 h-24 rounded-full flex items-center justify-center text-4xl',
          'transition-all active:scale-95 disabled:opacity-40',
          watchState === 'recording'
            ? 'bg-red-600 shadow-lg shadow-red-500/40 animate-pulse'
            : 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-indigo-500/30',
        ].join(' ')}
      >
        {watchState === 'recording' ? '⏹' : watchState === 'uploading' ? '⏳' : '🎙️'}
      </button>

      {/* Voice query button */}
      <button
        onClick={handleAsk}
        disabled={isAskBusy}
        aria-label="Hacer pregunta por voz"
        className={[
          'w-14 h-14 rounded-full flex items-center justify-center text-2xl',
          'border transition-all active:scale-95 disabled:opacity-40',
          watchState === 'asking'
            ? 'bg-indigo-900/50 border-indigo-500 animate-pulse'
            : watchState === 'speaking'
            ? 'bg-green-900/50 border-green-500 animate-pulse'
            : 'bg-gray-800 border-gray-700',
        ].join(' ')}
      >
        {watchState === 'speaking' ? '🔊' : watchState === 'asking' ? '👂' : '🔊'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/WatchLayout.tsx
git commit -m "feat: add WatchLayout with record and voice query buttons"
```

---

## Task 10: Create `MobileLayout` component

**Files:**
- Create: `frontend/src/components/MobileLayout.tsx`

- [ ] **Step 1: Create `frontend/src/components/MobileLayout.tsx`**

```tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Recording, ChatMessage } from '../types'
import { api } from '../services/api'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useVoiceInput } from '../hooks/useVoice'
import { useTTS } from '../hooks/useTTS'

type MobileTab = 'record' | 'notes' | 'chat'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
  })
}

export default function MobileLayout() {
  const [activeTab, setActiveTab] = useState<MobileTab>('record')
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const { isRecording, error: recError, start: startRec, stop: stopRec } = useAudioRecorder()
  const { isListening, start: startListening } = useVoiceInput()
  const { speak } = useTTS()

  useEffect(() => {
    api.getRecordings().then(setRecordings).catch(() => {})
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const refreshRecordings = useCallback(() => {
    api.getRecordings().then(setRecordings).catch(() => {})
  }, [])

  // ── Tab: Record ─────────────────────────────────────────────────────────

  const handleRecord = useCallback(async () => {
    if (isRecording) {
      setUploadStatus('Subiendo...')
      try {
        const file = await stopRec()
        await api.uploadRecording(file, (pct) => setUploadProgress(pct))
        setUploadProgress(null)
        setUploadStatus('✓ Nota guardada')
        refreshRecordings()
        setTimeout(() => setUploadStatus(''), 2500)
      } catch {
        setUploadStatus('Error al subir la nota')
        setTimeout(() => setUploadStatus(''), 3000)
      }
    } else {
      setUploadStatus('')
      await startRec()
    }
  }, [isRecording, startRec, stopRec, refreshRecordings])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus('Subiendo...')
    try {
      await api.uploadRecording(file, (pct) => setUploadProgress(pct))
      setUploadProgress(null)
      setUploadStatus('✓ Nota guardada')
      refreshRecordings()
      setTimeout(() => setUploadStatus(''), 2500)
    } catch {
      setUploadStatus('Error al subir archivo')
      setTimeout(() => setUploadStatus(''), 3000)
    }
    e.target.value = ''
  }, [refreshRecordings])

  // ── Tab: Chat ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setIsStreaming(true)

    const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      let full = ''
      for await (const chunk of api.streamChat(text, null)) {
        full += chunk
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { ...assistantMsg, content: full }
          return next
        })
      }
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming])

  const handleVoiceChat = useCallback(() => {
    if (isListening || isStreaming) return
    startListening((text) => sendMessage(text))
  }, [isListening, isStreaming, startListening, sendMessage])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden">

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Tab: Grabar ── */}
        {activeTab === 'record' && (
          <div className="flex flex-col items-center justify-center min-h-full gap-6 p-6">
            <p className="text-gray-500 text-xs tracking-widest uppercase">Voice Notes AI</p>

            {/* Record button */}
            <button
              onClick={handleRecord}
              aria-label={isRecording ? 'Detener grabación' : 'Grabar nota'}
              className={[
                'w-28 h-28 rounded-full flex items-center justify-center text-5xl',
                'transition-all active:scale-95',
                isRecording
                  ? 'bg-red-600 shadow-xl shadow-red-500/40 animate-pulse'
                  : 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-xl shadow-indigo-500/30',
              ].join(' ')}
            >
              {isRecording ? '⏹' : '🎙️'}
            </button>

            <p className="text-gray-400 text-sm">
              {isRecording ? 'Toca para detener' : 'Toca para grabar'}
            </p>

            {uploadProgress !== null && (
              <div className="w-full max-w-xs bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {uploadStatus && (
              <p className={`text-sm ${uploadStatus.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {uploadStatus}
              </p>
            )}

            {recError && <p className="text-red-400 text-xs text-center">{recError}</p>}

            {/* File upload */}
            <div className="mt-2 w-full max-w-xs">
              <label className="flex flex-col items-center gap-2 border border-dashed border-gray-700 rounded-xl p-4 cursor-pointer text-gray-500 text-sm hover:border-gray-500 transition-colors">
                <span className="text-2xl">📎</span>
                <span>O sube un archivo de audio</span>
                <input
                  type="file"
                  accept=".m4a,.mp3,.wav,.ogg,.aac,.flac,.mp4,.webm"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* ── Tab: Notas ── */}
        {activeTab === 'notes' && (
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between py-2 px-1">
              <p className="text-gray-500 text-xs uppercase tracking-wider">
                {recordings.length} nota{recordings.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={refreshRecordings}
                className="text-gray-600 text-xs hover:text-gray-400"
              >
                ↻ Actualizar
              </button>
            </div>

            {recordings.length === 0 && (
              <p className="text-center text-gray-600 text-sm py-12">
                Sin notas aún.<br />Ve a Grabar para crear una.
              </p>
            )}

            {recordings.map((rec) => (
              <div
                key={rec.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-200 leading-tight line-clamp-2">
                    {rec.title || rec.original_name}
                  </p>
                  <span className="text-lg flex-shrink-0">
                    {rec.transcribed ? '🎙️' : '⏳'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-600">
                  {fmtDate(rec.created_at)}
                  {rec.language && ` · ${rec.language.toUpperCase()}`}
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {!rec.transcribed && (
                    <span className="text-[10px] bg-yellow-900/50 text-yellow-400 border border-yellow-800/50 rounded px-1.5 py-0.5">
                      Transcribiendo...
                    </span>
                  )}
                  {rec.tasks_count > 0 && (
                    <span className="text-[10px] bg-green-900/50 text-green-400 border border-green-800/50 rounded px-1.5 py-0.5">
                      ✓ {rec.tasks_count} {rec.tasks_count === 1 ? 'tarea' : 'tareas'} → MC
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Chat ── */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && (
                <p className="text-center text-gray-600 text-sm py-12">
                  Hazme una pregunta sobre tus notas.
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-900/40 border border-indigo-800/50 text-indigo-100 ml-6'
                      : 'bg-gray-800/60 border border-gray-700/50 text-gray-200 mr-6'
                  }`}
                >
                  {msg.content || (isStreaming && i === messages.length - 1 ? '...' : '')}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input bar */}
            <div className="p-3 border-t border-gray-800 flex gap-2 items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage(inputText)}
                placeholder="Escribe tu pregunta..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-4 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleVoiceChat}
                aria-label="Preguntar por voz"
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 transition-all ${
                  isListening
                    ? 'bg-red-600 animate-pulse'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                🎤
              </button>
              <button
                onClick={() => sendMessage(inputText)}
                disabled={!inputText.trim() || isStreaming}
                aria-label="Enviar"
                className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-lg flex-shrink-0 disabled:opacity-40 transition-all"
              >
                ➤
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <nav className="flex border-t border-gray-800 bg-gray-900 flex-shrink-0">
        {([
          { id: 'record', icon: '🎙️', label: 'Grabar' },
          { id: 'notes',  icon: '📋', label: 'Notas' },
          { id: 'chat',   icon: '💬', label: 'Chat' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors ${
              activeTab === tab.id
                ? 'text-indigo-400 border-t-2 border-indigo-500'
                : 'text-gray-600 border-t-2 border-transparent'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MobileLayout.tsx
git commit -m "feat: add MobileLayout with 3-tab interface for phone"
```

---

## Task 11: Update `App.tsx` with adaptive layout

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Read the current `App.tsx` to identify where to add the layout detection**

The file is at `frontend/src/App.tsx`. It exports a default `App` component. Add the adaptive layout at the top of the component function.

- [ ] **Step 2: Add imports at the top of `App.tsx`**

Find the existing imports block (first few lines of the file). Add:

```typescript
import WatchLayout from './components/WatchLayout'
import MobileLayout from './components/MobileLayout'
```

- [ ] **Step 3: Add layout detection state inside the `App` component function**

Find the beginning of the `App` function body (after `export default function App() {`). Add this block right at the top, before any existing state:

```typescript
  // Adaptive layout detection
  const [layout, setLayout] = useState<'watch' | 'mobile' | 'desktop'>(() => {
    if (window.innerWidth <= 320) return 'watch'
    if (window.innerWidth < 768) return 'mobile'
    return 'desktop'
  })

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth <= 320) setLayout('watch')
      else if (window.innerWidth < 768) setLayout('mobile')
      else setLayout('desktop')
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (layout === 'watch') return <WatchLayout />
  if (layout === 'mobile') return <MobileLayout />
```

> Place the `if (layout === 'watch')` and `if (layout === 'mobile')` returns **before** the main desktop return statement at the end of the function.

> Make sure `useState` and `useEffect` are imported from React if not already present.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Start the dev server and verify on mobile screen size**

```bash
# Terminal 1 — backend
cd backend && python main.py

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open `http://localhost:5173` in Chrome. Open DevTools → Toggle device toolbar → Select a mobile device (e.g., iPhone 12). Verify the 3-tab layout renders. Switch to a very small screen (320px) to verify the watch layout renders.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add adaptive layout detection for watch, mobile, and desktop"
```

---

## Task 12: Update `PROJECT.md` and verify full flow

**Files:**
- Modify: `PROJECT.md`

- [ ] **Step 1: Update the Status section in `PROJECT.md`**

Find the `## Status actual` section and replace with:

```markdown
## Status actual

- PWA mobile-first: adaptativo watch (≤320px) / móvil (<768px) / desktop
- Extracción automática de tareas después de cada transcripción (Claude Opus 4.6)
- Integración con Mission Control Panel: tareas se guardan en Supabase automáticamente
- Badge "✓ N tareas → MC" en cada nota procesada
- Transcripción local con faster-whisper (no depende de API externa)
- Chat streaming con Claude Opus 4.6 usando contexto de grabaciones
- Resúmenes ejecutivos con timestamps
- Mapas mentales generados con structured output
- Base de datos SQLite local
- Soporta múltiples formatos de audio: m4a, mp3, wav, ogg, aac, flac, mp4, webm
- Frontend con React + TypeScript + Tailwind

## Configurar integración con Mission Control

1. Obtén tu `user_id` de Mission Control:
   - Supabase Dashboard → Authentication → Users → copia el UUID de tu usuario
2. Copia `.env.example` a `.env` y completa:
   ```
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Supabase Dashboard → Settings → API → service_role
   SUPABASE_USER_ID=uuid-de-tu-usuario
   ```
3. Las tareas que extraiga Claude aparecerán en Mission Control con status=pending, priority=medium, category=General.
```

- [ ] **Step 2: Run the full backend test suite one final time**

```bash
cd backend
python -m pytest -v
```

Expected: all 24 tests pass, 0 failures.

- [ ] **Step 3: Final commit**

```bash
git add PROJECT.md
git commit -m "docs: update PROJECT.md with PWA and Mission Control setup instructions"
```

---

## Resumen de commits esperados

```
feat: add tasks_count column to Recording model
feat: add supabase_service with save_tasks_to_mission_control
feat: add extract_tasks function to ai_service
feat: wire task extraction into transcription pipeline
docs: add Supabase env vars to .env.example and PROJECT.md
feat: add tasks_count badge to RecordingCard
feat: add PWA manifest for home screen install
feat: add useAudioRecorder hook with MediaRecorder
feat: add WatchLayout with record and voice query buttons
feat: add MobileLayout with 3-tab interface for phone
feat: add adaptive layout detection for watch, mobile, and desktop
docs: update PROJECT.md with PWA and Mission Control setup instructions
```
