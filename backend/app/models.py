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


class Recipe(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime | None = Field(default_factory=_now)
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


# Columns added after the first release. SQLite's create_all never alters an
# existing table, so older databases get these with a plain ALTER TABLE.
_ADDED_COLUMNS = {
    "photo_path": "VARCHAR",
    "updated_at": "DATETIME",
    "favorite": "BOOLEAN NOT NULL DEFAULT 0",
}

_engine = None


def _migrate(engine) -> None:
    existing = {c["name"] for c in inspect(engine).get_columns("recipe")}
    with engine.begin() as conn:
        for name, sql_type in _ADDED_COLUMNS.items():
            if name not in existing:
                log.info("migrating: adding recipe.%s", name)
                conn.execute(text(f"ALTER TABLE recipe ADD COLUMN {name} {sql_type}"))


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
