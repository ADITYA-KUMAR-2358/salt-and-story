import logging
from datetime import datetime, timezone

from sqlalchemy import JSON, Column, inspect, text
from sqlmodel import Field, SQLModel, create_engine

from .config import get_settings

log = logging.getLogger("salt.db")

# Statuses: uploaded -> transcribing -> structuring -> ready | failed
STATUSES = ("uploaded", "transcribing", "structuring", "ready", "failed")
IN_PROGRESS = ("uploaded", "transcribing", "structuring")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    """A person who signed in with Google (or the single local account in dev mode)."""

    id: int | None = Field(default=None, primary_key=True)
    google_sub: str = Field(index=True, unique=True)
    email: str = ""
    name: str = ""
    picture: str = ""
    created_at: datetime = Field(default_factory=_now)
    last_login: datetime = Field(default_factory=_now)
    # Daily allowance of AI actions, counted in UTC days.
    usage_day: str = ""
    usage_count: int = 0
    # Salted hash of the network the account was created from (never the raw IP).
    signup_ip_hash: str = Field(default="", index=True)


class NetworkUsage(SQLModel, table=True):
    """AI requests per network per UTC day, to stop many accounts from one device."""

    id: int | None = Field(default=None, primary_key=True)
    ip_hash: str = Field(index=True)
    day: str = Field(index=True)
    count: int = 0


class Recipe(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime | None = Field(default_factory=_now)
    user_id: int | None = Field(default=None, index=True, foreign_key="user.id")
    status: str = "uploaded"
    error: str | None = None

    title: str = "Untitled recipe"
    story: str = ""
    servings: str | None = None
    prep_time: str | None = None
    cook_time: str | None = None
    ingredients: list = Field(default_factory=list, sa_column=Column(JSON))
    steps: list = Field(default_factory=list, sa_column=Column(JSON))
    tips: list = Field(default_factory=list, sa_column=Column(JSON))
    quote: str = ""
    transcript: str = ""
    audio_path: str | None = None
    speaker_name: str | None = None
    narration_path: str | None = None
    photo_path: str | None = None
    favorite: bool = False


# Columns added after a table first shipped. SQLite's create_all never alters an
# existing table, so older databases get these with a plain ALTER TABLE.
_ADDED_COLUMNS = {
    "recipe": {
        "photo_path": "VARCHAR",
        "updated_at": "DATETIME",
        "favorite": "BOOLEAN NOT NULL DEFAULT 0",
        "user_id": "INTEGER REFERENCES user(id)",
    },
    "user": {
        "signup_ip_hash": "VARCHAR NOT NULL DEFAULT ''",
    },
}

_engine = None


def _migrate(engine) -> None:
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in _ADDED_COLUMNS.items():
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, sql_type in columns.items():
                if name not in existing:
                    log.info("migrating: adding %s.%s", table, name)
                    conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN {name} {sql_type}'))


def get_engine():
    global _engine
    if _engine is None:
        s = get_settings()
        s.ensure_dirs()
        _engine = create_engine(s.db_url, connect_args={"check_same_thread": False})
        SQLModel.metadata.create_all(_engine)
        _migrate(_engine)
    return _engine


def reset_engine() -> None:
    """Used by tests to point at a fresh DATA_DIR."""
    global _engine
    _engine = None
