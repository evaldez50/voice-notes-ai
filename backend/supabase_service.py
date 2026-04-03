import logging
import os
import asyncio

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()


_supabase_client = None


def _get_client():
    """Return cached Supabase client. Returns None if env vars are missing."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        _supabase_client = create_client(url, key)
        return _supabase_client
    except Exception as e:
        logger.error("[Supabase] Failed to create client: %s", e)
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
        logger.warning("[Supabase] SUPABASE_USER_ID not configured. Tasks will NOT be saved to Mission Control. Set SUPABASE_USER_ID env var to enable.")
        return 0

    client = _get_client()
    if client is None:
        logger.warning("[Supabase] Not configured — skipping task save")
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
            logger.error("[Supabase] Failed to save task '%s': %s", title, e)

    logger.info("[Supabase] Saved %d/%d tasks to Mission Control", saved, len(task_titles))
    return saved
