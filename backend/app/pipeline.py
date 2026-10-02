"""Background processing: audio -> transcript -> structured recipe."""

import logging
from datetime import datetime, timezone
from pathlib import Path

from sqlmodel import Session, select

from . import auth, eleven, llm
from .models import Recipe, get_engine
from .schemas import RecipeDraft

log = logging.getLogger("salt.pipeline")


def apply_draft(recipe: Recipe, draft: RecipeDraft) -> None:
    recipe.updated_at = datetime.now(timezone.utc)
    recipe.title = draft.title
    recipe.story = draft.story
    recipe.servings = draft.servings
    recipe.prep_time = draft.prep_time
    recipe.cook_time = draft.cook_time
    recipe.ingredients = [i.model_dump() for i in draft.ingredients]
    recipe.steps = draft.steps
    recipe.tips = draft.tips
    recipe.quote = draft.quote


def _set(recipe_id: int, **fields) -> None:
    with Session(get_engine()) as db:
        r = db.get(Recipe, recipe_id)
        if r is None:
            return
        for k, v in fields.items():
            setattr(r, k, v)
        db.add(r)
        db.commit()


def _reason(e: Exception, fallback: str) -> str:
    """Known failures carry a message written for people; anything else gets a plain one."""
    if isinstance(e, (llm.LLMError, eleven.ElevenLabsError)):
        return str(e)
    return fallback


def _cached_draft(recipe_id: int, owner: int | None, transcript: str) -> RecipeDraft | None:
    """A finished recipe of the same account with the exact same transcript: reuse it.

    Pressing "Try a sample" again then costs no quota. Only the owner's own recipes
    are reused, so nobody's edits can leak into another account.
    """
    with Session(get_engine()) as db:
        hit = db.exec(
            select(Recipe)
            .where(
                Recipe.transcript == transcript,
                Recipe.status == "ready",
                Recipe.user_id == owner,
                Recipe.id != recipe_id,
            )
            .order_by(Recipe.id.desc())
        ).first()
        if hit is None or not hit.steps:
            return None
        return RecipeDraft(
            title=hit.title,
            story=hit.story,
            servings=hit.servings,
            prep_time=hit.prep_time,
            cook_time=hit.cook_time,
            ingredients=hit.ingredients or [],
            steps=hit.steps or [],
            tips=hit.tips or [],
            quote=hit.quote,
        )


def structure_stored(recipe_id: int, use_cache: bool = True, charged: bool = False) -> None:
    """Run the LLM on the transcript already stored for this recipe.

    use_cache=False forces a fresh answer (the "Rewrite from transcript" button).
    charged=True means this memo's daily action was already counted (audio memos).
    """
    try:
        with Session(get_engine()) as db:
            r = db.get(Recipe, recipe_id)
            if r is None:  # deleted while queued
                return
            transcript, owner = r.transcript, r.user_id
        if not transcript.strip():
            raise llm.LLMError("There is no transcript to write a recipe from.")
        _set(recipe_id, status="structuring", error=None)
        draft = _cached_draft(recipe_id, owner, transcript) if use_cache else None
        if draft is not None:
            log.info("recipe %s reused an identical transcript, no model call", recipe_id)
        else:
            if not charged:
                auth.spend(owner)  # counts against the account's daily allowance
            draft = llm.structure_recipe(transcript)
        with Session(get_engine()) as db:
            r = db.get(Recipe, recipe_id)
            if r is None:
                return
            apply_draft(r, draft)
            if r.narration_path:
                Path(r.narration_path).unlink(missing_ok=True)
            r.status, r.error, r.narration_path = "ready", None, None
            db.add(r)
            db.commit()
    except Exception as e:  # readable reason, retry stays possible
        log.exception("structuring failed for %s", recipe_id)
        _set(
            recipe_id,
            status="failed",
            error=_reason(e, "Something went wrong while writing the recipe. Try again."),
        )


def process_audio(recipe_id: int) -> None:
    try:
        with Session(get_engine()) as db:
            r = db.get(Recipe, recipe_id)
            if r is None or not r.audio_path:
                return
            path, owner = Path(r.audio_path), r.user_id
        auth.spend(owner)  # one action covers transcription and writing
        _set(recipe_id, status="transcribing", error=None)
        transcript = eleven.transcribe(path)
        _set(recipe_id, transcript=transcript)
    except Exception as e:
        log.exception("transcription failed for %s", recipe_id)
        _set(
            recipe_id,
            status="failed",
            error=_reason(e, "Something went wrong while transcribing. Try again."),
        )
        return
    structure_stored(recipe_id, charged=True)
