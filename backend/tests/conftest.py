import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import Base, Recording
from main import app, get_db

# ---------------------------------------------------------------------------
# In-memory SQLite database for tests
# ---------------------------------------------------------------------------

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables before each test and drop them after."""
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture()
def db_session():
    """Provide a transactional database session for tests."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    """FastAPI test client wired to the in-memory test database."""
    from httpx import ASGITransport, AsyncClient

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    yield app
    app.dependency_overrides.clear()


@pytest.fixture()
def async_client(client):
    """Async httpx client for calling the FastAPI app."""
    from httpx import ASGITransport, AsyncClient
    import asyncio

    transport = ASGITransport(app=client)
    return AsyncClient(transport=transport, base_url="http://test")


# ---------------------------------------------------------------------------
# Mocks for external services
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def mock_transcribe():
    """Mock whisper transcription so tests never load the real model."""
    fake_result = {
        "text": "Hello this is a test transcription.",
        "segments": [
            {"start": 0.0, "end": 2.5, "text": "Hello this is a test transcription."}
        ],
        "language": "en",
        "duration": 2.5,
    }
    with patch("main.transcribe_audio", return_value=fake_result) as m:
        yield m


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
