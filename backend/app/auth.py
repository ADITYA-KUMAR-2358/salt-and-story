"""Accounts: Sign in with Google, signed sessions, and a daily allowance per account.

Flow: the browser gets a Google ID token (a JWT signed by Google) from Google
Identity Services and posts it here. We verify the signature, audience (our
client id) and issuer with google-auth, upsert the user, and return our own
signed session token. The browser sends it as `Authorization: Bearer <token>`.
No passwords are ever seen or stored.
"""

import hashlib
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from functools import cache
from pathlib import Path

from fastapi import HTTPException, Request
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlmodel import Session, func, select, update

from . import llm
from .config import get_settings
from .models import NetworkUsage, Recipe, User, get_engine

log = logging.getLogger("salt.auth")
settings = get_settings()

DEV_SUB = "dev-local"
_runtime_secret = secrets.token_urlsafe(48)  # used only when SESSION_SECRET is unset
_google_request = google_requests.Request()


class DailyLimitReached(llm.LLMError):
    """This account has used today's allowance of AI actions."""


# ---- the visitor's network ----------------------------------------------------


def client_ip(request: Request) -> str:
    """The visitor's IP, read from the header our trusted proxy sets (CLIENT_IP_HEADER).

    Never trust X-Forwarded-For blindly: clients can put anything in it.
    """
    if settings.client_ip_header:
        value = request.headers.get(settings.client_ip_header, "").split(",")[0].strip()
        if value:
            return value
    return request.client.host if request.client else "unknown"


def ip_hash(ip: str) -> str:
    """A salted hash, so raw IP addresses are never stored."""
    salt = settings.session_secret or _runtime_secret
    return hashlib.sha256(f"{salt}|{ip}".encode()).hexdigest()[:32]


# ---- throwaway email addresses -----------------------------------------------


@cache
def _disposable_domains() -> frozenset[str]:
    path = Path(__file__).parent / "data" / "disposable_email_domains.txt"
    lines = path.read_text(encoding="utf8").splitlines() if path.exists() else []
    return frozenset(x.strip().lower() for x in lines if x.strip() and not x.startswith("#"))


def is_disposable(email: str) -> bool:
    domain = email.rsplit("@", 1)[-1].lower()
    parts = domain.split(".")
    # match the domain and its parents (mail.tempmail.com -> tempmail.com)
    candidates = {".".join(parts[i:]) for i in range(len(parts) - 1)}
    blocked = _disposable_domains() | set(settings.blocked_email_domains)
    return bool(candidates & blocked)


def mode() -> str:
    explicit = settings.auth_mode.strip().lower()
    if explicit in ("google", "dev"):
        return explicit
    if settings.google_client_id:
        return "google"
    return "closed" if settings.is_production else "dev"


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret or _runtime_secret, salt="salt-session")


def issue_token(user_id: int) -> str:
    return _serializer().dumps({"uid": user_id})


def read_token(token: str) -> int | None:
    try:
        data = _serializer().loads(token, max_age=settings.session_days * 86400)
        return int(data["uid"])
    except (BadSignature, SignatureExpired, KeyError, TypeError, ValueError):
        return None


def verify_google_token(credential: str) -> dict:
    """Verify a Google ID token. Tests replace this function."""
    return id_token.verify_oauth2_token(credential, _google_request, settings.google_client_id)


def _today() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime())


def used_today(user: User) -> int:
    return user.usage_count if user.usage_day == _today() else 0


def _claim_orphans(db: Session, user: User) -> None:
    """The very first account adopts recipes made before accounts existed."""
    if db.exec(select(func.count()).select_from(User)).one() == 1:
        result = db.exec(update(Recipe).where(Recipe.user_id.is_(None)).values(user_id=user.id))
        if result.rowcount:
            log.info("first account adopted %d existing recipe(s)", result.rowcount)
        db.commit()


def upsert_user(sub: str, email: str, name: str, picture: str, network: str = "") -> User:
    with Session(get_engine()) as db:
        user = db.exec(select(User).where(User.google_sub == sub)).first()
        created = user is None
        if user is None:
            limit = settings.accounts_per_ip_per_day
            if network and limit > 0:
                since = datetime.now(timezone.utc) - timedelta(days=1)
                recent = db.exec(
                    select(func.count())
                    .select_from(User)
                    .where(User.signup_ip_hash == network, User.created_at >= since)
                ).one()
                if recent >= limit:
                    raise HTTPException(
                        429,
                        "Too many new accounts have been made from this network today. "
                        "Please try again tomorrow, or sign in with an account you already have.",
                    )
            user = User(google_sub=sub, signup_ip_hash=network)
        user.email, user.name, user.picture = email, name, picture
        user.last_login = datetime.now(timezone.utc)
        db.add(user)
        db.commit()
        db.refresh(user)
        if created:
            _claim_orphans(db, user)
            db.refresh(user)
        db.expunge(user)
        return user


def sign_in_with_google(credential: str, network: str = "") -> User:
    if mode() != "google":
        raise HTTPException(400, "Google sign-in is not enabled on this server.")
    try:
        claims = verify_google_token(credential)
    except ValueError as e:  # bad signature, wrong audience, expired, malformed
        log.info("rejected a Google token: %s", e)
        raise HTTPException(401, "Google could not confirm that sign-in. Please try again.") from e
    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(401, "That sign-in did not come from Google.")
    email = (claims.get("email") or "").lower()
    if not email or not claims.get("email_verified"):
        raise HTTPException(401, "Your Google account needs a verified email address.")
    if settings.allowed_emails and email not in settings.allowed_emails:
        raise HTTPException(403, "This Salt & Story is private. Ask its owner to add your email.")
    if is_disposable(email):
        raise HTTPException(
            403,
            "Temporary or throwaway email addresses cannot be used. "
            "Please sign in with your everyday Google account.",
        )
    return upsert_user(
        claims["sub"],
        email,
        claims.get("name") or email.split("@")[0],
        claims.get("picture") or "",
        network,
    )


def current_user(request: Request) -> User:
    """FastAPI dependency: the signed-in account, or 401."""
    m = mode()
    if m == "closed":
        raise HTTPException(
            503,
            "Sign-in is not set up on this server yet. Its owner needs to add GOOGLE_CLIENT_ID.",
        )
    if m == "dev":
        return upsert_user(DEV_SUB, "local@salt-and-story.invalid", "Local cook", "")
    header = request.headers.get("authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else ""
    uid = read_token(token) if token else None
    if uid is None:
        raise HTTPException(401, "Please sign in to continue.")
    with Session(get_engine()) as db:
        user = db.get(User, uid)
        if user is None:
            raise HTTPException(401, "Please sign in to continue.")
        db.expunge(user)
        return user


def check_allowance(user: User) -> None:
    """Refuse up front when today's allowance is already used (HTTP 429)."""
    limit = settings.user_daily_limit
    if limit > 0 and used_today(user) >= limit:
        raise HTTPException(
            429, f"You have used all {limit} of today's recipe actions. More tomorrow."
        )


def check_network(network: str) -> None:
    """Refuse when this network has used today's AI requests across all its accounts."""
    limit = settings.ip_daily_limit
    if not network or limit <= 0:
        return
    with Session(get_engine()) as db:
        row = db.exec(
            select(NetworkUsage).where(
                NetworkUsage.ip_hash == network, NetworkUsage.day == _today()
            )
        ).first()
        if row is not None and row.count >= limit:
            raise HTTPException(
                429,
                "This network has reached today's recipe limit for all its accounts. "
                "More tomorrow.",
            )


def count_network(network: str) -> None:
    if not network or settings.ip_daily_limit <= 0:
        return
    with Session(get_engine()) as db:
        today = _today()
        row = db.exec(
            select(NetworkUsage).where(NetworkUsage.ip_hash == network, NetworkUsage.day == today)
        ).first()
        if row is None:
            row = NetworkUsage(ip_hash=network, day=today, count=0)
        row.count += 1
        db.add(row)
        db.commit()


def spend(user_id: int | None) -> None:
    """Count one AI action. Called right before a paid model or speech call."""
    limit = settings.user_daily_limit
    if user_id is None or limit <= 0:
        return
    with Session(get_engine()) as db:
        user = db.get(User, user_id)
        if user is None:
            return
        today = _today()
        if user.usage_day != today:
            user.usage_day, user.usage_count = today, 0
        if user.usage_count >= limit:
            raise DailyLimitReached(
                f"You have used all {limit} of today's recipe actions. "
                "Try again tomorrow, or write the recipe by hand."
            )
        user.usage_count += 1
        db.add(user)
        db.commit()


def delete_account(user: User) -> int:
    """Remove the account and every recipe and file it owns. Returns recipes removed."""
    from pathlib import Path

    with Session(get_engine()) as db:
        recipes = db.exec(select(Recipe).where(Recipe.user_id == user.id)).all()
        for r in recipes:
            for p in (r.audio_path, r.narration_path, r.photo_path):
                if p:
                    Path(p).unlink(missing_ok=True)
            db.delete(r)
        u = db.get(User, user.id)
        if u is not None:
            db.delete(u)
        db.commit()
        return len(recipes)
