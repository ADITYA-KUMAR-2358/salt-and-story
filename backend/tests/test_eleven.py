"""ElevenLabs client: every path, with the network mocked (no credits used)."""

from dataclasses import replace

import httpx
import pytest

from app import eleven


class _Resp:
    def __init__(self, status=200, payload=None, content=b""):
        self.status_code, self._p, self.content = status, payload or {}, content

    def json(self):
        return self._p

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "boom", request=httpx.Request("POST", "https://x"), response=None
            )


@pytest.fixture
def audio(tmp_path):
    f = tmp_path / "memo.mp3"
    f.write_bytes(b"fake audio")
    return f


def test_transcribe_returns_text(monkeypatch, audio):
    sent = {}

    def fake_post(url, headers, data, files, timeout):
        sent.update(url=url, key=headers["xi-api-key"], model=data["model_id"])
        return _Resp(payload={"text": "  Boil the water.  "})

    monkeypatch.setattr(eleven.httpx, "post", fake_post)
    assert eleven.transcribe(audio) == "Boil the water."
    assert sent["url"].endswith("/speech-to-text") and sent["model"] == "scribe_v1"


def test_transcribe_explains_empty_audio(monkeypatch, audio):
    monkeypatch.setattr(eleven.httpx, "post", lambda *a, **k: _Resp(payload={"text": ""}))
    with pytest.raises(eleven.ElevenLabsError, match="no speech"):
        eleven.transcribe(audio)


def test_transcribe_explains_http_errors(monkeypatch, audio):
    monkeypatch.setattr(eleven.httpx, "post", lambda *a, **k: _Resp(status=500))
    with pytest.raises(eleven.ElevenLabsError, match="Transcription failed"):
        eleven.transcribe(audio)


def test_missing_key_is_explained(monkeypatch, audio):
    no_key = replace(eleven.get_settings(), elevenlabs_api_key="")
    monkeypatch.setattr(eleven, "get_settings", lambda: no_key)
    with pytest.raises(eleven.ElevenLabsError, match="ELEVENLABS_API_KEY is not set"):
        eleven.transcribe(audio)


def test_narrate_returns_audio(monkeypatch):
    monkeypatch.setattr(eleven.httpx, "post", lambda *a, **k: _Resp(content=b"ID3mp3"))
    assert eleven.narrate("Step one. Boil.") == b"ID3mp3"


def test_narrate_explains_errors(monkeypatch):
    def down(*a, **k):
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(eleven.httpx, "post", down)
    with pytest.raises(eleven.ElevenLabsError, match="Narration failed"):
        eleven.narrate("hello")
