import pytest
import importlib
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock

import supabase_service


@pytest.mark.asyncio
async def test_save_tasks_returns_count_when_configured():
    """Should insert each task and return the count of saved tasks."""
    importlib.reload(supabase_service)
    mock_client = MagicMock()
    mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock()

    with patch("supabase_service._get_client", return_value=mock_client), \
         patch.dict("os.environ", {"SUPABASE_USER_ID": "test-user-uuid"}):
        count = await supabase_service.save_tasks_to_mission_control(
            ["Buy milk", "Call dentist"]
        )
        assert count == 2


@pytest.mark.asyncio
async def test_save_tasks_returns_zero_when_not_configured():
    """Should return 0 and not raise when Supabase is not configured."""
    importlib.reload(supabase_service)
    with patch("supabase_service._get_client", return_value=None), \
         patch.dict("os.environ", {}, clear=True):
        count = await supabase_service.save_tasks_to_mission_control(["Task 1"])
        assert count == 0


@pytest.mark.asyncio
async def test_save_tasks_returns_zero_for_empty_list():
    """Should return 0 immediately for an empty list without calling Supabase."""
    importlib.reload(supabase_service)
    with patch("supabase_service._get_client") as mock_get:
        count = await supabase_service.save_tasks_to_mission_control([])
        mock_get.assert_not_called()
        assert count == 0


@pytest.mark.asyncio
async def test_save_tasks_partial_failure_counts_successes():
    """If one insert fails, the others should still save and be counted."""
    importlib.reload(supabase_service)
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
        count = await supabase_service.save_tasks_to_mission_control(
            ["Task 1", "Task 2", "Task 3"]
        )
        assert count == 2  # Task 2 failed, Tasks 1 and 3 succeeded


# ── extract_tasks ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_extract_tasks_returns_list_of_strings():
    """Should parse Claude's JSON response into a list of task titles."""
    import importlib
    import ai_service
    importlib.reload(ai_service)

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='["Buy groceries", "Call the dentist"]')]

    with patch("ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        result = await ai_service.extract_tasks(
            "I need to buy groceries and call the dentist tomorrow."
        )
        assert result == ["Buy groceries", "Call the dentist"]


@pytest.mark.asyncio
async def test_extract_tasks_empty_transcript_skips_claude():
    """Should return [] immediately without calling Claude for empty input."""
    import importlib
    import ai_service
    importlib.reload(ai_service)

    with patch("ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock()
        result = await ai_service.extract_tasks("")
        mock_client.messages.create.assert_not_called()
        assert result == []


@pytest.mark.asyncio
async def test_extract_tasks_returns_empty_list_when_no_tasks():
    """Should return [] when Claude finds no tasks in the transcript."""
    import importlib
    import ai_service
    importlib.reload(ai_service)

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='[]')]

    with patch("ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        result = await ai_service.extract_tasks("The weather is nice today.")
        assert result == []


@pytest.mark.asyncio
async def test_extract_tasks_returns_empty_on_bad_json():
    """Should return [] gracefully when Claude returns non-JSON output."""
    import importlib
    import ai_service
    importlib.reload(ai_service)

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='I could not find any tasks.')]

    with patch("ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        result = await ai_service.extract_tasks("Some transcript text.")
        assert result == []
