import os
import json
import uuid
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Optional, List

import aiofiles
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

load_dotenv()

from database import SessionLocal, Recording, Base, engine
from transcription import transcribe_audio
from ai_service import generate_summary, generate_mindmap, stream_answer

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".m4a", ".mp3", ".wav", ".ogg", ".aac", ".flac", ".mp4", ".webm"}

app = FastAPI(title="Voice Notes AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Pydantic schemas ────────────────────────────────────────────────────────

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


class ChatRequest(BaseModel):
    message: str
    recording_id: Optional[int] = None  # None = all recordings


# ── Background transcription ─────────────────────────────────────────────────

async def _transcribe_recording(recording_id: int):
    db = SessionLocal()
    try:
        rec = db.query(Recording).filter(Recording.id == recording_id).first()
        if not rec:
            return
        file_path = UPLOAD_DIR / rec.filename
        result = await asyncio.to_thread(transcribe_audio, str(file_path))

        rec.transcription = result["text"]
        rec.transcription_json = json.dumps(result["segments"])
        rec.duration = result["duration"]
        rec.language = result["language"]
        rec.transcribed = True

        # Auto-title from first 80 chars
        text = result["text"]
        rec.title = (text[:77] + "...") if len(text) > 80 else text

        db.commit()
        print(f"[Transcription] Done for recording {recording_id}")
    except Exception as e:
        print(f"[Transcription] Error for recording {recording_id}: {e}")
    finally:
        db.close()


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/recordings", response_model=List[RecordingOut])
def list_recordings(db: Session = Depends(get_db)):
    return db.query(Recording).order_by(Recording.created_at.desc()).all()


@app.get("/api/recordings/{recording_id}", response_model=RecordingOut)
def get_recording(recording_id: int, db: Session = Depends(get_db)):
    rec = db.query(Recording).filter(Recording.id == recording_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    return rec


@app.post("/api/recordings/upload")
async def upload_recording(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {suffix}. Supported: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    unique_name = f"{uuid.uuid4()}{suffix}"
    file_path = UPLOAD_DIR / unique_name

    content = await file.read()
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    rec = Recording(
        filename=unique_name,
        original_name=file.filename or unique_name,
        file_size=len(content),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    background_tasks.add_task(_transcribe_recording, rec.id)

    return {"id": rec.id, "message": "Subido. Transcribiendo en segundo plano..."}


@app.get("/api/recordings/{recording_id}/audio")
def get_audio(recording_id: int, db: Session = Depends(get_db)):
    rec = db.query(Recording).filter(Recording.id == recording_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    file_path = UPLOAD_DIR / rec.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file missing")
    return FileResponse(str(file_path), media_type="audio/mpeg")


@app.get("/api/recordings/{recording_id}/transcript")
def get_transcript(recording_id: int, db: Session = Depends(get_db)):
    rec = db.query(Recording).filter(Recording.id == recording_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    segments = json.loads(rec.transcription_json) if rec.transcription_json else []
    return {
        "text": rec.transcription,
        "segments": segments,
        "language": rec.language,
        "duration": rec.duration,
    }


@app.post("/api/recordings/{recording_id}/summary")
async def get_summary(recording_id: int, db: Session = Depends(get_db)):
    rec = db.query(Recording).filter(Recording.id == recording_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    if not rec.transcribed:
        raise HTTPException(status_code=400, detail="Recording not yet transcribed")

    if rec.summary:
        return {"summary": rec.summary}

    segments = json.loads(rec.transcription_json) if rec.transcription_json else []
    summary = await generate_summary(rec.transcription or "", segments)

    rec.summary = summary
    db.commit()

    return {"summary": summary}


@app.post("/api/recordings/{recording_id}/mindmap")
async def get_mindmap(recording_id: int, db: Session = Depends(get_db)):
    rec = db.query(Recording).filter(Recording.id == recording_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    if not rec.transcribed:
        raise HTTPException(status_code=400, detail="Recording not yet transcribed")

    segments = json.loads(rec.transcription_json) if rec.transcription_json else []
    mindmap = await generate_mindmap(rec.transcription or "", segments)
    return mindmap


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest, db: Session = Depends(get_db)):
    if request.recording_id:
        recs = db.query(Recording).filter(
            Recording.id == request.recording_id,
            Recording.transcribed == True,
        ).all()
    else:
        recs = db.query(Recording).filter(Recording.transcribed == True).all()

    if not recs:
        raise HTTPException(status_code=400, detail="No hay grabaciones transcritas disponibles.")

    context_list = []
    for r in recs:
        segs = json.loads(r.transcription_json) if r.transcription_json else []
        context_list.append({
            "id": r.id,
            "original_name": r.original_name,
            "title": r.title or r.original_name,
            "created_at": r.created_at.isoformat(),
            "transcription": r.transcription,
            "segments": segs,
            "duration": r.duration or 0,
        })

    async def sse_generator():
        try:
            async for chunk in stream_answer(request.message, context_list):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.delete("/api/recordings/{recording_id}")
def delete_recording(recording_id: int, db: Session = Depends(get_db)):
    rec = db.query(Recording).filter(Recording.id == recording_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")

    file_path = UPLOAD_DIR / rec.filename
    if file_path.exists():
        file_path.unlink()

    db.delete(rec)
    db.commit()
    return {"message": "Eliminado correctamente"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
