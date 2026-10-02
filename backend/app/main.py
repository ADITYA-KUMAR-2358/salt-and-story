import logging
import os
import sys
import time
import uuid
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import or_
from sqlmodel import Session, select

from . import eleven, llm, pdf
from .config import get_settings
from .models import IN_PROGRESS, Recipe, get_engine
from .photos import PhotoError, process_photo
from .pipeline import apply_draft, process_audio, structure_stored
from .schemas import (
    FavoriteIn,
    LLMStatus,
    ManualRecipeIn,
    MemoOut,
    RecipeOut,
    RecipeUpdate,
    StatusOut,
    TranscriptIn,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("salt")

settings = get_settings()
settings.ensure_dirs()

ALLOWED_AUDIO = {".mp3", ".m4a", ".wav", ".webm", ".ogg"}
MAX_IMPORT = 500


def recover_interrupted() -> int:
    """A restart (common on Render's free tier) kills background work mid-flight.

    Anything still marked in progress at boot can never finish, so mark it failed
    with a reason the user can act on instead of leaving a spinner forever.
    """
    with Session(get_engine()) as db:
        stuck = db.exec(select(Recipe).where(Recipe.status.in_(IN_PROGRESS))).all()
        for r in stuck:
            r.status = "failed"
            r.error = "The server restarted while this memo was being processed. Try again."
            db.add(r)
        db.commit()
        if stuck:
            log.warning("marked %d interrupted memo(s) as failed", len(stuck))
        return len(stuck)


def check_config() -> None:
    """Log what is missing at boot. Names only: secret values are never logged."""
    if not settings.elevenlabs_api_key:
        log.warning("ELEVENLABS_API_KEY is not set: recording, upload and narration are off")
    if "localhost" not in settings.llm_base_url and not settings.llm_api_key:
        log.warning("LLM_API_KEY is not set for a hosted model endpoint")
    if settings.is_production and any(o == "*" or "localhost" in o for o in settings.cors_origins):
        log.warning("CORS_ORIGINS contains '*' or localhost in production: set the real site URL")


@asynccontextmanager
async def lifespan(_: FastAPI):
    check_config()
    recover_interrupted()
    yield


app = FastAPI(
    title="Salt & Story API",
    version="1.1.0",
    lifespan=lifespan,
    # Interactive docs are handy locally but are attack surface in production.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in settings.cors_origins if o != "*"],  # never a wildcard
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    allow_headers=["Content-Type"],
    max_age=600,
)
app.mount("/media/narration", StaticFiles(directory=settings.narration_dir), name="narration")
app.mount("/media/photos", StaticFiles(directory=settings.photos_dir), name="photos")


SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    # The web app lives on another origin and shows our photos.
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
}


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    for k, v in SECURITY_HEADERS.items():
        # PDFs are opened in the browser's viewer; a strict CSP would blank them.
        is_pdf = response.headers.get("content-type", "").startswith("application/pdf")
        if k == "Content-Security-Policy" and is_pdf:
            continue
        response.headers.setdefault(k, v)
    if request.url.path != "/health":  # keep-alive pings would drown the log
        log.info("%s %s -> %s in %.0fms", request.method, request.url.path,
                 response.status_code, (time.perf_counter() - start) * 1000)
    return response


def out(r: Recipe) -> RecipeOut:
    return RecipeOut(
        id=r.id,
        created_at=r.created_at,
        updated_at=r.updated_at,
        status=r.status,
        error=r.error,
        title=r.title or "Untitled recipe",
        story=r.story,
        servings=r.servings,
        prep_time=r.prep_time,
        cook_time=r.cook_time,
        ingredients=r.ingredients or [],
        steps=r.steps or [],
        tips=r.tips or [],
        quote=r.quote,
        speaker_name=r.speaker_name,
        transcript=r.transcript,
        has_audio=bool(r.audio_path),
        narration_url=f"/media/narration/{r.id}.mp3" if r.narration_path else None,
        photo_url=f"/media/photos/{Path(r.photo_path).name}" if r.photo_path else None,
        favorite=bool(r.favorite),
    )


def _get(db: Session, recipe_id: int) -> Recipe:
    r = db.get(Recipe, recipe_id)
    if r is None:
        raise HTTPException(404, "That recipe does not exist.")
    return r


def _check_transcript(text: str) -> None:
    if len(text) > settings.max_transcript_chars:
        limit = settings.max_transcript_chars
        raise HTTPException(413, f"That transcript is too long. Keep it under {limit} characters.")


async def _read_limited(file: UploadFile, limit_mb: int, dest: Path | None = None) -> bytes:
    """Read an upload in chunks and stop as soon as it passes the size limit."""
    limit = limit_mb * 1024 * 1024
    chunks: list[bytes] = []
    size = 0
    while chunk := await file.read(1024 * 1024):
        size += len(chunk)
        if size > limit:
            raise HTTPException(413, f"File is larger than {limit_mb} MB.")
        chunks.append(chunk)
    if size == 0:
        raise HTTPException(400, "The file is empty.")
    data = b"".join(chunks)
    if dest:
        dest.write_bytes(data)
    return data


# --- health and capabilities -------------------------------------------------

@app.api_route("/health", methods=["GET", "HEAD"])
def health() -> dict:
    # Deliberately touches nothing: no database, no ElevenLabs, no model.
    return {"status": "ok"}


_llm_probe: dict = {"at": -1e9, "ok": False}
PROBE_TTL = 600  # seconds


def llm_reachable() -> bool:
    """Is the recipe writer up? Prefer the outcome of the last real call; otherwise
    ask the provider at most once every 10 minutes (listing models costs no tokens)."""
    now = time.monotonic()
    if llm.last_call["ok"] is not None and now - llm.last_call["at"] < PROBE_TTL:
        return bool(llm.last_call["ok"])
    if now - _llm_probe["at"] < PROBE_TTL:
        return _llm_probe["ok"]
    try:
        r = httpx.get(f"{settings.llm_base_url.rstrip('/')}/models",
                      headers={"Authorization": f"Bearer {settings.llm_api_key}"}, timeout=3)
        ok = r.status_code < 500
    except httpx.HTTPError:
        ok = False
    _llm_probe.update(at=time.monotonic(), ok=ok)
    return ok


@app.get("/api/status", response_model=StatusOut)
def status() -> StatusOut:
    key = bool(settings.elevenlabs_api_key)
    return StatusOut(
        transcription=key,
        narration=key,
        llm=LLMStatus(model=settings.llm_model, reachable=llm_reachable()),
        max_upload_mb=settings.max_upload_mb,
        max_photo_mb=settings.max_photo_mb,
    )


# --- per-visitor limit on work that spends API quota ------------------------

_hits: dict[str, deque] = {}
WINDOW = 600  # seconds


def spend_guard(request: Request) -> None:
    """At most SUBMIT_LIMIT quota-spending requests per visitor per 10 minutes."""
    limit = settings.submit_limit
    if limit <= 0:
        return
    who = request.client.host if request.client else "unknown"
    now = time.monotonic()
    q = _hits.setdefault(who, deque())
    while q and now - q[0] > WINDOW:
        q.popleft()
    if len(q) >= limit:
        wait = int(WINDOW - (now - q[0])) // 60 + 1
        raise HTTPException(
            429, f"That is a lot of recipes at once. Try again in about {wait} minutes."
        )
    q.append(now)
    if len(_hits) > 5000:  # keep memory bounded on a long-running server
        for k in [k for k, v in _hits.items() if not v or now - v[-1] > WINDOW]:
            _hits.pop(k, None)


# --- memos -------------------------------------------------------------------

@app.post("/api/memos", response_model=MemoOut)
async def upload_memo(
    request: Request,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    speaker_name: str | None = Form(None),
) -> MemoOut:
    spend_guard(request)
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_AUDIO:
        raise HTTPException(
            415, f"Unsupported file type. Use one of: {', '.join(sorted(ALLOWED_AUDIO))}."
        )
    dest = settings.uploads_dir / f"{uuid.uuid4().hex}{ext}"
    await _read_limited(file, settings.max_upload_mb, dest)
    with Session(get_engine()) as db:
        r = Recipe(audio_path=str(dest), speaker_name=(speaker_name or "").strip() or None,
                   title="New memo")
        db.add(r)
        db.commit()
        db.refresh(r)
        rid = r.id
    background.add_task(process_audio, rid)
    return MemoOut(id=rid, status="uploaded")


@app.post("/api/transcript", response_model=MemoOut)
def from_transcript(body: TranscriptIn, background: BackgroundTasks, request: Request) -> MemoOut:
    _check_transcript(body.transcript)
    spend_guard(request)
    with Session(get_engine()) as db:
        r = Recipe(transcript=body.transcript.strip(), speaker_name=body.speaker_name,
                   title="New memo", status="structuring")
        db.add(r)
        db.commit()
        db.refresh(r)
        rid = r.id
    background.add_task(structure_stored, rid)
    return MemoOut(id=rid, status="structuring")


# --- recipes -----------------------------------------------------------------

@app.post("/api/recipes", response_model=RecipeOut)
def create_manual(body: ManualRecipeIn) -> RecipeOut:
    """Fallback when no model is reachable, and how classics are added."""
    _check_transcript(body.transcript)
    with Session(get_engine()) as db:
        r = Recipe(transcript=body.transcript, speaker_name=body.speaker_name, status="ready")
        apply_draft(r, body)
        db.add(r)
        db.commit()
        db.refresh(r)
        return out(r)


@app.get("/api/recipes", response_model=list[RecipeOut])
def list_recipes(q: str = "", favorite: bool | None = None) -> list[RecipeOut]:
    stmt = select(Recipe).order_by(Recipe.created_at.desc())
    if favorite is not None:
        stmt = stmt.where(Recipe.favorite == favorite)
    if q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Recipe.title.ilike(like), Recipe.speaker_name.ilike(like),
                              Recipe.quote.ilike(like), Recipe.story.ilike(like),
                              Recipe.transcript.ilike(like)))
    with Session(get_engine()) as db:
        return [out(r) for r in db.exec(stmt).all()]


@app.get("/api/recipes/{recipe_id}", response_model=RecipeOut)
def get_recipe(recipe_id: int) -> RecipeOut:
    with Session(get_engine()) as db:
        return out(_get(db, recipe_id))


@app.put("/api/recipes/{recipe_id}", response_model=RecipeOut)
def update_recipe(recipe_id: int, body: RecipeUpdate) -> RecipeOut:
    with Session(get_engine()) as db:
        r = _get(db, recipe_id)
        if r.status in IN_PROGRESS:
            raise HTTPException(409, "This recipe is still being written. Wait for it to finish.")
        apply_draft(r, body)
        r.speaker_name = (body.speaker_name or "").strip() or None
        if r.narration_path:  # text changed, cached audio is stale
            Path(r.narration_path).unlink(missing_ok=True)
            r.narration_path = None
        if r.status == "failed":
            r.status, r.error = "ready", None
        db.add(r)
        db.commit()
        db.refresh(r)
        return out(r)


@app.delete("/api/recipes/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: int) -> Response:
    with Session(get_engine()) as db:
        r = _get(db, recipe_id)
        for p in (r.audio_path, r.narration_path, r.photo_path):
            if p:
                Path(p).unlink(missing_ok=True)
        db.delete(r)
        db.commit()
    return Response(status_code=204)


@app.patch("/api/recipes/{recipe_id}/favorite", response_model=RecipeOut)
def set_favorite(recipe_id: int, body: FavoriteIn) -> RecipeOut:
    """Mark or unmark a favourite. Touches nothing else (narration cache, status)."""
    with Session(get_engine()) as db:
        r = _get(db, recipe_id)
        r.favorite = body.favorite
        db.add(r)
        db.commit()
        db.refresh(r)
        return out(r)


@app.post("/api/recipes/{recipe_id}/restructure", response_model=MemoOut)
def restructure(recipe_id: int, background: BackgroundTasks, request: Request) -> MemoOut:
    spend_guard(request)
    with Session(get_engine()) as db:
        r = _get(db, recipe_id)
        if r.status in IN_PROGRESS:
            raise HTTPException(409, "This recipe is already being written.")
        if not r.transcript and not r.audio_path:
            raise HTTPException(400, "This recipe has no transcript or audio to work from.")
        # Set the status before responding so a poll never sees the old "ready".
        task = structure_stored if r.transcript else process_audio
        r.status = "structuring" if r.transcript else "transcribing"
        r.error = None
        db.add(r)
        db.commit()
        new_status = r.status
    if task is structure_stored:
        background.add_task(structure_stored, recipe_id, False)  # a rewrite wants a fresh answer
    else:
        background.add_task(task, recipe_id)
    return MemoOut(id=recipe_id, status=new_status)


# --- photos ------------------------------------------------------------------

@app.post("/api/recipes/{recipe_id}/photo", response_model=RecipeOut)
async def upload_photo(recipe_id: int, file: UploadFile = File(...)) -> RecipeOut:
    with Session(get_engine()) as db:
        _get(db, recipe_id)
    data = await _read_limited(file, settings.max_photo_mb)
    try:
        jpeg = process_photo(data)
    except PhotoError as e:
        raise HTTPException(415, str(e)) from e
    # A fresh name each time so browsers never show a cached old photo.
    dest = settings.photos_dir / f"{recipe_id}-{uuid.uuid4().hex[:8]}.jpg"
    dest.write_bytes(jpeg)
    with Session(get_engine()) as db:
        r = _get(db, recipe_id)
        if r.photo_path:
            Path(r.photo_path).unlink(missing_ok=True)
        r.photo_path = str(dest)
        r.updated_at = datetime.now(timezone.utc)
        db.add(r)
        db.commit()
        db.refresh(r)
        return out(r)


@app.delete("/api/recipes/{recipe_id}/photo", response_model=RecipeOut)
def delete_photo(recipe_id: int) -> RecipeOut:
    with Session(get_engine()) as db:
        r = _get(db, recipe_id)
        if r.photo_path:
            Path(r.photo_path).unlink(missing_ok=True)
            r.photo_path = None
            db.add(r)
            db.commit()
            db.refresh(r)
        return out(r)


# --- narration ---------------------------------------------------------------

def _narration_text(r: Recipe) -> str:
    parts = [r.title + "."]
    if r.story:
        parts.append(r.story)
    if r.ingredients:
        items = [" ".join(x for x in (i.get("quantity"), i.get("name")) if x)
                 for i in r.ingredients]
        parts.append("You will need: " + ", ".join(items) + ".")
    parts += [f"Step {n}. {s}" for n, s in enumerate(r.steps or [], 1)]
    parts += r.tips or []
    return " ".join(parts)


@app.post("/api/recipes/{recipe_id}/narrate")
def narrate(recipe_id: int, request: Request) -> dict:
    with Session(get_engine()) as db:
        r = _get(db, recipe_id)
        dest = settings.narration_dir / f"{r.id}.mp3"
        if not (r.narration_path and dest.exists()):  # cached audio costs nothing
            spend_guard(request)
            try:
                dest.write_bytes(eleven.narrate(_narration_text(r)))
            except eleven.ElevenLabsError as e:
                raise HTTPException(502, str(e)) from e
            r.narration_path = str(dest)
            db.add(r)
            db.commit()
        return {"url": f"/media/narration/{r.id}.mp3"}


# --- PDFs --------------------------------------------------------------------

def _pdf_response(data: bytes, name: str) -> Response:
    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{name}"'})


PDF_FIX = {
    "nt": "run scripts/setup-pdf-windows.ps1 once, then restart the backend",
    "darwin": "run: brew install pango, then restart the backend",
}


def _render(recipes: list[Recipe], **kw) -> bytes:
    try:
        return pdf.render_pdf(recipes, **kw)
    except (ImportError, OSError) as e:
        log.error("PDF engine unavailable: %s", e)
        key = "darwin" if sys.platform == "darwin" else os.name
        fix = PDF_FIX.get(key, "install Pango (apt install libpango-1.0-0 libpangoft2-1.0-0)")
        raise HTTPException(
            503, f"PDF export needs the Pango libraries on this computer. To fix it, {fix}. "
                 "Or run the app with Docker (docker compose up), which includes them."
        ) from e


@app.get("/api/recipes/{recipe_id}/pdf")
def recipe_pdf(recipe_id: int) -> Response:
    with Session(get_engine()) as db:
        r = _get(db, recipe_id)
        return _pdf_response(_render([r], title=r.title, single=True), f"recipe-{r.id}.pdf")


@app.get("/api/book.pdf")
def book_pdf(ids: str = "", title: str = "Salt & Story", dedication: str = "") -> Response:
    try:
        wanted = list(dict.fromkeys(int(x) for x in ids.split(",") if x.strip()))
    except ValueError as e:
        raise HTTPException(400, "ids must be comma-separated numbers.") from e
    if not wanted:
        raise HTTPException(400, "Pick at least one recipe for the book.")
    with Session(get_engine()) as db:
        found = {r.id: r for r in db.exec(select(Recipe).where(Recipe.id.in_(wanted))).all()}
        ordered = [found[i] for i in wanted if i in found and found[i].status == "ready"]
        if not ordered:
            raise HTTPException(404, "None of those recipes are ready yet.")
        return _pdf_response(
            _render(ordered, title=title.strip()[:120] or "Salt & Story",
                    dedication=dedication.strip()[:200]),
            "salt-and-story.pdf",
        )


# --- backup ------------------------------------------------------------------

@app.get("/api/export")
def export_all() -> list[RecipeOut]:
    return list_recipes()


@app.post("/api/import")
def import_all(items: list[RecipeOut]) -> dict:
    if len(items) > MAX_IMPORT:
        raise HTTPException(413, f"Import at most {MAX_IMPORT} recipes at a time.")
    with Session(get_engine()) as db:
        for it in items:
            r = Recipe(status="ready", transcript=it.transcript, speaker_name=it.speaker_name,
                       favorite=it.favorite)
            apply_draft(r, it)
            db.add(r)
        db.commit()
    return {"imported": len(items)}
