"""ElevenLabs speech-to-text and text-to-speech.

Endpoints follow the public API docs (verify before shipping):
  STT  POST /v1/speech-to-text               multipart: file, model_id
  TTS  POST /v1/text-to-speech/{voice_id}    json: text, model_id  -> audio/mpeg
"""

from pathlib import Path

import httpx

from .config import get_settings

BASE = "https://api.elevenlabs.io/v1"


class ElevenLabsError(RuntimeError):
    pass


def _key() -> str:
    key = get_settings().elevenlabs_api_key
    if not key:
        raise ElevenLabsError(
            "ELEVENLABS_API_KEY is not set. Paste a transcript instead, or add the key."
        )
    return key


def transcribe(path: Path) -> str:
    s = get_settings()
    try:
        with path.open("rb") as f:
            r = httpx.post(
                f"{BASE}/speech-to-text",
                headers={"xi-api-key": _key()},
                data={"model_id": s.elevenlabs_stt_model},
                files={"file": (path.name, f)},
                timeout=300,
            )
        r.raise_for_status()
        text = (r.json().get("text") or "").strip()
    except httpx.HTTPError as e:
        raise ElevenLabsError(f"Transcription failed: {e}") from e
    if not text:
        raise ElevenLabsError("The memo had no speech that could be transcribed.")
    return text


def narrate(text: str) -> bytes:
    s = get_settings()
    try:
        r = httpx.post(
            f"{BASE}/text-to-speech/{s.elevenlabs_voice_id}",
            headers={"xi-api-key": _key()},
            json={"text": text, "model_id": s.elevenlabs_tts_model},
            timeout=120,
        )
        r.raise_for_status()
        return r.content
    except httpx.HTTPError as e:
        raise ElevenLabsError(f"Narration failed: {e}") from e
