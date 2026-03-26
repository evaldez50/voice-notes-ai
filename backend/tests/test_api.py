import io
import json

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from database import Recording


# ---------------------------------------------------------------------------
# Helper to create a fake audio file payload
# ---------------------------------------------------------------------------

def _fake_audio_file(filename: str = "note.wav", content: bytes = b"\x00" * 128):
    """Return a tuple suitable for httpx file upload."""
    return ("file", (filename, io.BytesIO(content), "audio/wav"))


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_health(async_client):
    resp = await async_client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


@pytest.mark.anyio
async def test_upload_recording(async_client, tmp_path):
    resp = await async_client.post(
        "/api/recordings/upload",
        files=[_fake_audio_file("my_note.wav")],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert data["id"] >= 1


@pytest.mark.anyio
async def test_upload_rejects_bad_extension(async_client):
    resp = await async_client.post(
        "/api/recordings/upload",
        files=[_fake_audio_file("evil.exe")],
    )
    assert resp.status_code == 400
    assert "Unsupported format" in resp.json()["detail"]


@pytest.mark.anyio
async def test_list_recordings_empty(async_client):
    resp = await async_client.get("/api/recordings")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.anyio
async def test_list_recordings_after_upload(async_client):
    # Upload one recording
    await async_client.post(
        "/api/recordings/upload",
        files=[_fake_audio_file("note1.mp3")],
    )
    resp = await async_client.get("/api/recordings")
    assert resp.status_code == 200
    recordings = resp.json()
    assert len(recordings) == 1
    assert recordings[0]["original_name"] == "note1.mp3"


@pytest.mark.anyio
async def test_get_single_recording(async_client):
    upload = await async_client.post(
        "/api/recordings/upload",
        files=[_fake_audio_file("single.wav")],
    )
    rec_id = upload.json()["id"]
    resp = await async_client.get(f"/api/recordings/{rec_id}")
    assert resp.status_code == 200
    assert resp.json()["original_name"] == "single.wav"


@pytest.mark.anyio
async def test_get_recording_not_found(async_client):
    resp = await async_client.get("/api/recordings/9999")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_delete_recording(async_client):
    upload = await async_client.post(
        "/api/recordings/upload",
        files=[_fake_audio_file("to_delete.ogg")],
    )
    rec_id = upload.json()["id"]

    # Delete it
    resp = await async_client.delete(f"/api/recordings/{rec_id}")
    assert resp.status_code == 200

    # Confirm it is gone
    resp = await async_client.get(f"/api/recordings/{rec_id}")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_delete_recording_not_found(async_client):
    resp = await async_client.delete("/api/recordings/9999")
    assert resp.status_code == 404
