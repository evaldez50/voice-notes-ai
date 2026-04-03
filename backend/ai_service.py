import os
import json
import anthropic
from typing import AsyncGenerator
from transcription import format_segments_for_ai

client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """Eres un asistente de IA experto en analizar grabaciones de voz y reuniones. \
Tienes acceso a transcripciones con marcas de tiempo en el formato [MM:SS].

REGLAS IMPORTANTES:
1. Cuando respondas preguntas sobre momentos específicos, SIEMPRE cita la marca de tiempo exacta.
   Ejemplo: "A los [02:45], Juan mencionó que los resultados fueron positivos."
2. Si te preguntan en qué momento ocurrió algo, busca en la transcripción y da el tiempo exacto.
3. Responde siempre en el mismo idioma de la pregunta.
4. Sé preciso y conciso, citando textualmente cuando sea relevante.
5. Si no encuentras información sobre algo, dilo claramente."""


def _build_context(recordings: list) -> str:
    """Build formatted context from recordings for Claude."""
    parts = []
    for i, rec in enumerate(recordings, 1):
        segments = rec.get("segments", [])
        title = rec.get("title") or rec.get("original_name", f"Grabación {i}")
        created_at = rec.get("created_at", "")
        duration = rec.get("duration", 0)
        mins = int(duration // 60)
        secs = int(duration % 60)

        if segments:
            body = format_segments_for_ai(segments)
        else:
            body = rec.get("transcription", "(sin transcripción)")

        parts.append(
            f"=== GRABACIÓN {i}: {title} ===\n"
            f"Fecha: {created_at}\n"
            f"Duración: {mins}:{secs:02d}\n\n"
            f"{body}"
        )

    return "\n\n".join(parts)


async def stream_answer(question: str, recordings: list) -> AsyncGenerator[str, None]:
    """Stream an answer from Claude using recording transcripts as context."""
    context = _build_context(recordings)

    async with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Aquí están las transcripciones de las grabaciones:\n\n"
                    f"{context}\n\n"
                    f"---\n\n"
                    f"Pregunta: {question}"
                ),
            }
        ],
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def generate_summary(transcription: str, segments: list) -> str:
    """Generate an executive summary of a recording."""
    formatted = format_segments_for_ai(segments) if segments else transcription

    async with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": (
                    "Genera un resumen ejecutivo conciso de esta grabación/reunión.\n"
                    "Incluye:\n"
                    "- **Tema principal**\n"
                    "- **Puntos clave discutidos** (con marcas de tiempo)\n"
                    "- **Decisiones tomadas**\n"
                    "- **Acciones a seguir** (si las hay)\n\n"
                    f"Transcripción:\n{formatted}"
                ),
            }
        ],
    ) as stream:
        return await stream.get_final_text()


async def generate_mindmap(transcription: str, segments: list) -> dict:
    """Generate a mind map JSON structure from a recording."""
    formatted = format_segments_for_ai(segments) if segments else transcription

    MINDMAP_SCHEMA = {
        "type": "json_schema",
        "json_schema": {
            "name": "mindmap",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "children": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "children": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "label": {"type": "string"},
                                            "children": {"type": "array", "items": {}}
                                        },
                                        "required": ["label", "children"],
                                        "additionalProperties": False
                                    }
                                }
                            },
                            "required": ["label", "children"],
                            "additionalProperties": False
                        }
                    }
                },
                "required": ["title", "children"],
                "additionalProperties": False
            }
        }
    }

    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2048,
        output_config={"format": MINDMAP_SCHEMA},
        messages=[
            {
                "role": "user",
                "content": (
                    "Analiza esta transcripción y genera un mapa mental estructurado.\n"
                    "Máximo 6 ramas principales, máximo 4 sub-ramas por rama.\n"
                    "El título debe ser el tema central de la grabación.\n\n"
                    f"Transcripción:\n{formatted}"
                ),
            }
        ],
    )

    try:
        return json.loads(response.content[0].text)
    except (json.JSONDecodeError, IndexError, AttributeError):
        return {
            "title": "Transcripción",
            "children": [{"label": "Contenido principal", "children": []}],
        }


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
