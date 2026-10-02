import logging
import os
import secrets
import sys
import time
import uuid
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import or_
from sqlmodel import Session, select

from . import auth, eleven, llm, pdf
from .config import get_settings
from .models import IN_PROGRESS, Recipe, User, get_engine
from .photos import PhotoError, process_photo
from .pipeline import apply_draft, process_audio, structure_stored
from .schemas import (
    AuthConfigOut,
    FavoriteIn,
    GoogleSignIn,
    LLMStatus,
    ManualRecipeIn,
    MemoOut,
    RecipeOut,
    RecipeUpdate,
    SessionOut,
    StatusOut,
    TranscriptIn,
    UserOut,
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
    if not llm._is_local(settings.llm_base_url) and not settings.llm_api_key:
        log.warning("LLM_API_KEY is not set for a hosted model endpoint")
    if settings.is_production and any(o == "*" or "localhost" in o for o in settings.cors_origins):
        log.warning("CORS_ORIGINS contains '*' or localhost in production: set the real site URL")
    m = auth.mode()
    if m == "closed":
        log.error("AUTH: production without GOOGLE_CLIENT_ID; the API refuses all recipe requests")
    elif m == "dev" and settings.is_production:
        log.warning("AUTH_MODE=dev in production: anyone can use this server as one shared account")
    if m == "google" and not settings.session_secret:
        log.warning(
            "SESSION_SECRET is not set: everyone is signed out whenever the server restarts"
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    check_config()
    recover_interrupted()
    yield


app = FastAPI(
    title="Salt & Story API",
    version="1.2.0",
    lifespan=lifespan,
    # Interactive docs are handy locally but are attack surface in production.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in settings.cors_origins if o != "*"],  # never a wildcard
    allow_credentials=False,  # sessions travel in the Authorization header, not cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=600,
)
# Media is served by long random file names, so links cannot be guessed.
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
        log.info(
            "%s %s -> %s in %.0fms",
            request.method,
            request.url.path,
            response.status_code,
            (time.perf_counter() - start) * 1000,
        )
    return response


def _token() -> str:
    return secrets.token_urlsafe(18)


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
        narration_url=f"/media/narration/{Path(r.narration_path).name}"
        if r.narration_path
        else None,
        photo_url=f"/media/photos/{Path(r.photo_path).name}" if r.photo_path else None,
        favorite=bool(r.favorite),
    )


def user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        name=u.name,
        email=u.email,
        picture=u.picture,
        used_today=auth.used_today(u),
        daily_limit=settings.user_daily_limit,
    )


def _get(db: Session, recipe_id: int, user: User) -> Recipe:
    """A recipe owned by this account. Other people's recipes look like they do not exist."""
    r = db.get(Recipe, recipe_id)
    if r is None or r.user_id != user.id:
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
    if not settings.llm_api_key and not llm._is_local(settings.llm_base_url):
        return False  # a hosted model without a key cannot work
    now = time.monotonic()
    if llm.last_call["ok"] is not None and now - llm.last_call["at"] < PROBE_TTL:
        return bool(llm.last_call["ok"])
    if now - _llm_probe["at"] < PROBE_TTL:
        return _llm_probe["ok"]
    try:
        r = httpx.get(
            f"{settings.llm_base_url.rstrip('/')}/models",
            headers={"Authorization": f"Bearer {settings.llm_api_key}"},
            timeout=3,
        )
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


# --- accounts ----------------------------------------------------------------


@app.get("/api/auth/config", response_model=AuthConfigOut)
def auth_config() -> AuthConfigOut:
    # The Google client id is public by design (it is embedded in every sign-in page).
    m = auth.mode()
    return AuthConfigOut(
        mode=m,
        google_client_id=settings.google_client_id if m == "google" else "",
        daily_limit=settings.user_daily_limit,
    )


@app.post("/api/auth/google", response_model=SessionOut)
def sign_in_google(body: GoogleSignIn, request: Request) -> SessionOut:
    user = auth.sign_in_with_google(body.credential, auth.ip_hash(auth.client_ip(request)))
    return SessionOut(token=auth.issue_token(user.id), user=user_out(user))


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(auth.current_user)) -> UserOut:
    return user_out(user)


@app.delete("/api/auth/me", status_code=204)
def delete_me(user: User = Depends(auth.current_user)) -> Response:
    removed = auth.delete_account(user)
    log.info("account %s deleted with %d recipe(s)", user.id, removed)
    return Response(status_code=204)


# --- per-account burst limit on work that spends API quota --------------------

_hits: dict[str, deque] = {}
WINDOW = 600  # seconds


def spend_guard(user: User, request: Request) -> None:
    """Refuse once today's allowance is used (per account and per network), and allow at most
    SUBMIT_LIMIT quota-spending requests per account per 10 minutes. Counts the network."""
    auth.check_allowance(user)
    network = auth.ip_hash(auth.client_ip(request))
    auth.check_network(network)
    limit = settings.submit_limit
    if limit > 0:
        who = f"user:{user.id}"
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
    auth.count_network(network)  # always, even when the burst limit is off


# --- memos -------------------------------------------------------------------


@app.post("/api/memos", response_model=MemoOut)
async def upload_memo(
    request: Request,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    speaker_name: str | None = Form(None),
    user: User = Depends(auth.current_user),
) -> MemoOut:
    spend_guard(user, request)
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_AUDIO:
        raise HTTPException(
            415, f"Unsupported file type. Use one of: {', '.join(sorted(ALLOWED_AUDIO))}."
        )
    dest = settings.uploads_dir / f"{uuid.uuid4().hex}{ext}"
    await _read_limited(file, settings.max_upload_mb, dest)
    with Session(get_engine()) as db:
        r = Recipe(
            audio_path=str(dest),
            speaker_name=(speaker_name or "").strip() or None,
            title="New memo",
            user_id=user.id,
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        rid = r.id
    background.add_task(process_audio, rid)
    return MemoOut(id=rid, status="uploaded")


@app.post("/api/transcript", response_model=MemoOut)
def from_transcript(
    body: TranscriptIn,
    background: BackgroundTasks,
    request: Request,
    user: User = Depends(auth.current_user),
) -> MemoOut:
    _check_transcript(body.transcript)
    spend_guard(user, request)
    with Session(get_engine()) as db:
        r = Recipe(
            transcript=body.transcript.strip(),
            speaker_name=body.speaker_name,
            title="New memo",
            status="structuring",
            user_id=user.id,
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        rid = r.id
    background.add_task(structure_stored, rid)
    return MemoOut(id=rid, status="structuring")


# --- recipes -----------------------------------------------------------------


@app.post("/api/recipes", response_model=RecipeOut)
def create_manual(body: ManualRecipeIn, user: User = Depends(auth.current_user)) -> RecipeOut:
    """Fallback when no model is reachable, and how classics are added. Costs no quota."""
    _check_transcript(body.transcript)
    with Session(get_engine()) as db:
        r = Recipe(
            transcript=body.transcript,
            speaker_name=body.speaker_name,
            status="ready",
            user_id=user.id,
        )
        apply_draft(r, body)
        db.add(r)
        db.commit()
        db.refresh(r)
        return out(r)


@app.get("/api/recipes", response_model=list[RecipeOut])
def list_recipes(
    q: str = "", favorite: bool | None = None, user: User = Depends(auth.current_user)
) -> list[RecipeOut]:
    stmt = select(Recipe).where(Recipe.user_id == user.id).order_by(Recipe.created_at.desc())
    if favorite is not None:
        stmt = stmt.where(Recipe.favorite == favorite)
    if q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Recipe.title.ilike(like),
                Recipe.speaker_name.ilike(like),
                Recipe.quote.ilike(like),
                Recipe.story.ilike(like),
                Recipe.transcript.ilike(like),
            )
        )
    with Session(get_engine()) as db:
        return [out(r) for r in db.exec(stmt).all()]


@app.get("/api/recipes/{recipe_id}", response_model=RecipeOut)
def get_recipe(recipe_id: int, user: User = Depends(auth.current_user)) -> RecipeOut:
    with Session(get_engine()) as db:
        return out(_get(db, recipe_id, user))


@app.put("/api/recipes/{recipe_id}", response_model=RecipeOut)
def update_recipe(
    recipe_id: int, body: RecipeUpdate, user: User = Depends(auth.current_user)
) -> RecipeOut:
    with Session(get_engine()) as db:
        r = _get(db, recipe_id, user)
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
def delete_recipe(recipe_id: int, user: User = Depends(auth.current_user)) -> Response:
    with Session(get_engine()) as db:
        r = _get(db, recipe_id, user)
        for p in (r.audio_path, r.narration_path, r.photo_path):
            if p:
                Path(p).unlink(missing_ok=True)
        db.delete(r)
        db.commit()
    return Response(status_code=204)


@app.patch("/api/recipes/{recipe_id}/favorite", response_model=RecipeOut)
def set_favorite(
    recipe_id: int, body: FavoriteIn, user: User = Depends(auth.current_user)
) -> RecipeOut:
    """Mark or unmark a favourite. Touches nothing else (narration cache, status)."""
    with Session(get_engine()) as db:
        r = _get(db, recipe_id, user)
        r.favorite = body.favorite
        db.add(r)
        db.commit()
        db.refresh(r)
        return out(r)


@app.post("/api/recipes/{recipe_id}/restructure", response_model=MemoOut)
def restructure(
    recipe_id: int,
    background: BackgroundTasks,
    request: Request,
    user: User = Depends(auth.current_user),
) -> MemoOut:
    with Session(get_engine()) as db:
        r = _get(db, recipe_id, user)
        if r.status in IN_PROGRESS:
            raise HTTPException(409, "This recipe is already being written.")
        if not r.transcript and not r.audio_path:
            raise HTTPException(400, "This recipe has no transcript or audio to work from.")
    spend_guard(user, request)
    with Session(get_engine()) as db:
        r = _get(db, recipe_id, user)
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
async def upload_photo(
    recipe_id: int, file: UploadFile = File(...), user: User = Depends(auth.current_user)
) -> RecipeOut:
    with Session(get_engine()) as db:
        _get(db, recipe_id, user)
    data = await _read_limited(file, settings.max_photo_mb)
    try:
        jpeg = process_photo(data)
    except PhotoError as e:
        raise HTTPException(415, str(e)) from e
    # A fresh, unguessable name each time (also stops browsers showing a cached old photo).
    dest = settings.photos_dir / f"{_token()}.jpg"
    dest.write_bytes(jpeg)
    with Session(get_engine()) as db:
        r = _get(db, recipe_id, user)
        if r.photo_path:
            Path(r.photo_path).unlink(missing_ok=True)
        r.photo_path = str(dest)
        r.updated_at = datetime.now(timezone.utc)
        db.add(r)
        db.commit()
        db.refresh(r)
        return out(r)


@app.delete("/api/recipes/{recipe_id}/photo", response_model=RecipeOut)
def delete_photo(recipe_id: int, user: User = Depends(auth.current_user)) -> RecipeOut:
    with Session(get_engine()) as db:
        r = _get(db, recipe_id, user)
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
        items = [
            " ".join(x for x in (i.get("quantity"), i.get("name")) if x) for i in r.ingredients
        ]
        parts.append("You will need: " + ", ".join(items) + ".")
    parts += [f"Step {n}. {s}" for n, s in enumerate(r.steps or [], 1)]
    parts += r.tips or []
    return " ".join(parts)


@app.post("/api/recipes/{recipe_id}/narrate")
def narrate(recipe_id: int, request: Request, user: User = Depends(auth.current_user)) -> dict:
    with Session(get_engine()) as db:
        r = _get(db, recipe_id, user)
        cached = r.narration_path and Path(r.narration_path).exists()
        if not cached:  # cached audio costs nothing
            spend_guard(user, request)
            try:
                auth.spend(user.id)
                audio = eleven.narrate(_narration_text(r))
            except auth.DailyLimitReached as e:
                raise HTTPException(429, str(e)) from e
            except eleven.ElevenLabsError as e:
                raise HTTPException(502, str(e)) from e
            dest = settings.narration_dir / f"{_token()}.mp3"
            dest.write_bytes(audio)
            r.narration_path = str(dest)
            db.add(r)
            db.commit()
        return {"url": f"/media/narration/{Path(r.narration_path).name}"}


# --- PDFs --------------------------------------------------------------------


def _pdf_response(data: bytes, name: str) -> Response:
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{name}"'},
    )


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
            503,
            f"PDF export needs the Pango libraries on this computer. To fix it, {fix}. "
            "Or run the app with Docker (docker compose up), which includes them.",
        ) from e


@app.get("/api/recipes/{recipe_id}/pdf")
def recipe_pdf(recipe_id: int, user: User = Depends(auth.current_user)) -> Response:
    with Session(get_engine()) as db:
        r = _get(db, recipe_id, user)
        return _pdf_response(_render([r], title=r.title, single=True), f"recipe-{r.id}.pdf")


@app.get("/api/book.pdf")
def book_pdf(
    ids: str = "",
    title: str = "Salt & Story",
    dedication: str = "",
    by: str | None = None,
    user: User = Depends(auth.current_user),
) -> Response:
    try:
        wanted = list(dict.fromkeys(int(x) for x in ids.split(",") if x.strip()))
    except ValueError as e:
        raise HTTPException(400, "ids must be comma-separated numbers.") from e
    if not wanted:
        raise HTTPException(400, "Pick at least one recipe for the book.")
    with Session(get_engine()) as db:
        found = {
            r.id: r
            for r in db.exec(
                select(Recipe).where(Recipe.id.in_(wanted), Recipe.user_id == user.id)
            ).all()
        }
        ordered = [found[i] for i in wanted if i in found and found[i].status == "ready"]
        if not ordered:
            raise HTTPException(404, "None of those recipes are ready yet.")
        return _pdf_response(
            _render(
                ordered,
                title=title.strip()[:120] or "Salt & Story",
                dedication=dedication.strip()[:200],
                told_by=None if by is None else by.strip()[:200],
            ),
            "salt-and-story.pdf",
        )


# --- backup ------------------------------------------------------------------


@app.get("/api/export")
def export_all(user: User = Depends(auth.current_user)) -> list[RecipeOut]:
    return list_recipes(user=user)


@app.post("/api/import")
def import_all(items: list[RecipeOut], user: User = Depends(auth.current_user)) -> dict:
    if len(items) > MAX_IMPORT:
        raise HTTPException(413, f"Import at most {MAX_IMPORT} recipes at a time.")
    with Session(get_engine()) as db:
        for it in items:
            r = Recipe(
                status="ready",
                transcript=it.transcript,
                speaker_name=it.speaker_name,
                favorite=it.favorite,
                user_id=user.id,
            )
            apply_draft(r, it)
            db.add(r)
        db.commit()
    return {"imported": len(items)}
