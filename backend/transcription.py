import os
from pathlib import Path

_model = None


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        model_size = os.getenv("WHISPER_MODEL", "base")
        print(f"[Whisper] Loading model '{model_size}'... (first time only)")
        _model = WhisperModel(model_size, device="cpu", compute_type="int8")
        print("[Whisper] Model loaded.")
    return _model


def transcribe_audio(file_path: str) -> dict:
    """
    Transcribe audio file and return segments with timestamps.
    Returns:
        {
            "text": str,
            "segments": [{"start": float, "end": float, "text": str}],
            "language": str,
            "duration": float
        }
    """
    model = get_model()

    segments_iter, info = model.transcribe(
        file_path,
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    result_segments = []
    full_text_parts = []

    for segment in segments_iter:
        text = segment.text.strip()
        if not text:
            continue
        result_segments.append({
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": text,
        })
        full_text_parts.append(text)

    return {
        "text": " ".join(full_text_parts),
        "segments": result_segments,
        "language": info.language,
        "duration": round(info.duration, 2) if info.duration else 0.0,
    }


def format_segments_for_ai(segments: list) -> str:
    """Format segments with readable timestamps for Claude context."""
    lines = []
    for seg in segments:
        start = seg.get("start", 0)
        minutes = int(start // 60)
        seconds = int(start % 60)
        lines.append(f"[{minutes:02d}:{seconds:02d}] {seg.get('text', '').strip()}")
    return "\n".join(lines)
