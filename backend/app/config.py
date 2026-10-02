"""Runtime configuration, read from environment variables only."""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Local development reads .env files; real environment variables always win,
# so Render (and tests) are unaffected.
_BACKEND = Path(__file__).resolve().parent.parent
for _env_file in (_BACKEND / ".env", _BACKEND.parent / ".env"):
    load_dotenv(_env_file, override=False)


def _list(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("DATA_DIR", "./data")))
    cors_origins: list[str] = field(
        default_factory=lambda: _list(os.getenv("CORS_ORIGINS", "http://localhost:5173"))
    )
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "25"))
    max_photo_mb: int = int(os.getenv("MAX_PHOTO_MB", "10"))
    max_transcript_chars: int = int(os.getenv("MAX_TRANSCRIPT_CHARS", "20000"))

    elevenlabs_api_key: str = os.getenv("ELEVENLABS_API_KEY", "")
    elevenlabs_stt_model: str = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v1")
    elevenlabs_tts_model: str = os.getenv("ELEVENLABS_TTS_MODEL", "eleven_multilingual_v2")
    elevenlabs_voice_id: str = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

    llm_base_url: str = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
    llm_model: str = os.getenv("LLM_MODEL", "gemma3:4b")
    llm_api_key: str = os.getenv("LLM_API_KEY", "ollama")
    llm_timeout: float = float(os.getenv("LLM_TIMEOUT", "240"))
    # Free tiers are rate limited: stay under this many calls a minute (0 = no limit),
    # and wait at most this many seconds when the provider asks us to slow down.
    llm_max_rpm: int = int(os.getenv("LLM_MAX_RPM", "10"))
    llm_max_wait: float = float(os.getenv("LLM_MAX_WAIT", "45"))
    # Gemma 4 on the Gemini API reasons before answering (~80s). "minimal" skips
    # most of that (~2-10s) with the same JSON. Empty string = provider default.
    llm_thinking_level: str = os.getenv("LLM_THINKING_LEVEL", "minimal")
    # Quota guards for a public demo on free tiers.
    llm_max_per_day: int = int(os.getenv("LLM_MAX_PER_DAY", "300"))
    submit_limit: int = int(os.getenv("SUBMIT_LIMIT", "8"))  # per visitor per 10 minutes

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def narration_dir(self) -> Path:
        return self.data_dir / "narration"

    @property
    def photos_dir(self) -> Path:
        return self.data_dir / "photos"

    @property
    def db_url(self) -> str:
        return f"sqlite:///{(self.data_dir / 'salt_and_story.db').as_posix()}"

    def ensure_dirs(self) -> None:
        for d in (self.data_dir, self.uploads_dir, self.narration_dir, self.photos_dir):
            d.mkdir(parents=True, exist_ok=True)


def get_settings() -> Settings:
    return Settings()
