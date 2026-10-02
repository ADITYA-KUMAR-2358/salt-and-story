"""Photos, capabilities, search, recovery, migrations and input limits."""

import io
import sqlite3

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlmodel import Session

from app import llm, main
from app.main import app
from app.models import Recipe, get_engine
from app.photos import PhotoError, process_photo
from app.schemas import RecipeDraft

client = TestClient(app)


def _png(w=40, h=30, color=(200, 120, 40)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, "PNG")
    return buf.getvalue()


def _me() -> int:
    """The single local account the tests run as (AUTH_MODE dev)."""
    return client.get("/api/auth/me").json()["id"]


def _recipe(**kw) -> int:
    body = {"title": "Test dish", "steps": ["Cook."], **kw}
    return client.post("/api/recipes", json=body).json()["id"]


# --- photos ---------------------------------------------------------------


def test_photo_is_converted_to_jpeg_and_resized():
    out = process_photo(_png(3000, 2000))
    img = Image.open(io.BytesIO(out))
    assert img.format == "JPEG" and max(img.size) == 1600


def test_photo_rejects_non_images():
    with pytest.raises(PhotoError):
        process_photo(b"definitely not an image")
    with pytest.raises(PhotoError):
        process_photo(b"")


def test_photo_upload_replace_and_delete():
    rid = _recipe()
    first = client.post(f"/api/recipes/{rid}/photo", files={"file": ("a.png", _png())}).json()
    assert first["photo_url"].startswith("/media/photos/")
    assert client.get(first["photo_url"]).headers["content-type"] == "image/jpeg"

    second = client.post(f"/api/recipes/{rid}/photo", files={"file": ("b.png", _png())}).json()
    assert second["photo_url"] != first["photo_url"]  # cache-busting name
    assert client.get(first["photo_url"]).status_code == 404  # old file removed

    cleared = client.delete(f"/api/recipes/{rid}/photo").json()
    assert cleared["photo_url"] is None


def test_photo_upload_rejects_garbage_and_missing_recipe():
    rid = _recipe()
    r = client.post(f"/api/recipes/{rid}/photo", files={"file": ("x.jpg", b"nope")})
    assert r.status_code == 415 and "photo" in r.json()["detail"]
    assert (
        client.post("/api/recipes/999999/photo", files={"file": ("a.png", _png())}).status_code
        == 404
    )


# --- capabilities ---------------------------------------------------------


def test_status_reports_capabilities(monkeypatch):
    monkeypatch.setattr(main, "llm_reachable", lambda: False)
    s = client.get("/api/status").json()
    assert s["transcription"] is True  # conftest sets a test key
    assert s["llm"] == {"model": main.settings.llm_model, "reachable": False}
    assert s["max_upload_mb"] > 0


# --- search ---------------------------------------------------------------


def test_search_matches_title_speaker_and_quote():
    _recipe(title="Zucchini fritters", speaker_name="Auntie Wren", quote="crisp as autumn")
    assert any(
        r["title"] == "Zucchini fritters" for r in client.get("/api/recipes?q=zucchini").json()
    )
    assert any(r["speaker_name"] == "Auntie Wren" for r in client.get("/api/recipes?q=wren").json())
    assert client.get("/api/recipes?q=crisp as autumn").json()
    assert client.get("/api/recipes?q=qqqnothingqqq").json() == []


# --- robustness -----------------------------------------------------------


def test_interrupted_jobs_are_marked_failed_on_boot():
    with Session(get_engine()) as db:
        r = Recipe(status="transcribing", title="Half done", user_id=_me())
        db.add(r)
        db.commit()
        db.refresh(r)
        rid = r.id
    assert main.recover_interrupted() >= 1
    got = client.get(f"/api/recipes/{rid}").json()
    assert got["status"] == "failed" and "restarted" in got["error"]


def test_restructure_sets_status_before_responding(monkeypatch):
    rid = client.post(
        "/api/recipes", json={"title": "x", "transcript": "Some words about soup here."}
    ).json()["id"]
    seen = {}

    def slow(t):
        seen["status"] = client.get(f"/api/recipes/{rid}").json()["status"]
        return RecipeDraft(title="Soup")

    monkeypatch.setattr(llm, "structure_recipe", slow)
    assert client.post(f"/api/recipes/{rid}/restructure").json()["status"] == "structuring"
    assert seen["status"] == "structuring"
    assert client.get(f"/api/recipes/{rid}").json()["title"] == "Soup"


def test_restructure_without_source_is_rejected():
    rid = _recipe()
    assert client.post(f"/api/recipes/{rid}/restructure").status_code == 400


def test_empty_audio_and_long_transcript_are_rejected():
    assert client.post("/api/memos", files={"file": ("m.mp3", b"")}).status_code == 400
    long = "word " * 5000
    assert client.post("/api/transcript", json={"transcript": long}).status_code == 413


def test_blank_title_and_empty_items_are_cleaned():
    assert client.post("/api/recipes", json={"title": "   "}).status_code == 422
    r = client.post(
        "/api/recipes",
        json={
            "title": " Tea ",
            "steps": ["Boil", "  ", ""],
            "ingredients": [{"name": "tea", "quantity": " "}, {"name": ""}],
        },
    ).json()
    assert r["title"] == "Tea" and r["steps"] == ["Boil"]
    assert r["ingredients"] == [{"name": "tea", "quantity": None, "note": None}]


def test_unexpected_errors_get_a_plain_message(monkeypatch):
    def boom(t):
        raise KeyError("internal detail")

    monkeypatch.setattr(llm, "structure_recipe", boom)
    rid = client.post(
        "/api/transcript", json={"transcript": "Boil water and add a pinch of salt."}
    ).json()["id"]
    err = client.get(f"/api/recipes/{rid}").json()["error"]
    assert "internal detail" not in err and "Try again" in err


def test_book_skips_unfinished_and_duplicate_ids(monkeypatch):
    from app import pdf

    captured = {}
    monkeypatch.setattr(
        pdf, "render_pdf", lambda recipes, **kw: captured.setdefault("r", recipes) and b"%PDF-"
    )
    a = _recipe(title="A")
    with Session(get_engine()) as db:
        b = Recipe(status="structuring", title="B", user_id=_me())
        db.add(b)
        db.commit()
        db.refresh(b)
        bid = b.id
    res = client.get(f"/api/book.pdf?ids={a},{a},{bid}")
    assert res.status_code == 200
    assert [r.title for r in captured["r"]] == ["A"]


def test_old_database_gets_new_columns(tmp_path, monkeypatch):
    from app import models

    db = tmp_path / "salt_and_story.db"
    con = sqlite3.connect(db)
    con.execute(
        "CREATE TABLE recipe (id INTEGER PRIMARY KEY, created_at DATETIME, status VARCHAR,"
        " error VARCHAR, title VARCHAR, story VARCHAR, servings VARCHAR, prep_time VARCHAR,"
        " cook_time VARCHAR, ingredients JSON, steps JSON, tips JSON, quote VARCHAR,"
        " transcript VARCHAR, audio_path VARCHAR, speaker_name VARCHAR, narration_path VARCHAR)"
    )
    con.commit()
    con.close()
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    saved = models._engine
    models.reset_engine()
    try:
        engine = models.get_engine()
        cols = {row[1] for row in engine.connect().exec_driver_sql("PRAGMA table_info(recipe)")}
        assert {"photo_path", "updated_at", "favorite"} <= cols
    finally:
        models._engine = saved


def test_security_headers_and_no_key_leak():
    r = client.get("/api/recipes")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    status = client.get("/api/status").text
    assert "test-key" not in status and main.settings.llm_api_key not in status


def test_cors_never_wildcard_and_rejects_unknown_origin():
    r = client.options(
        "/api/recipes",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert r.headers.get("access-control-allow-origin") is None
    ok = client.options(
        "/api/recipes",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_identical_transcript_reuses_result_without_a_model_call(monkeypatch):
    calls = []

    def fake(t):
        calls.append(t)
        return RecipeDraft(title="Cached soup", steps=["Simmer."], quote="")

    monkeypatch.setattr(llm, "structure_recipe", fake)
    text = "A unique soup transcript for the cache test, simmer it slowly please."
    a = client.post("/api/transcript", json={"transcript": text}).json()["id"]
    b = client.post("/api/transcript", json={"transcript": text}).json()["id"]
    assert len(calls) == 1
    assert client.get(f"/api/recipes/{b}").json()["title"] == "Cached soup"
    # but "Rewrite from transcript" always asks the model again
    client.post(f"/api/recipes/{a}/restructure")
    assert len(calls) == 2


def test_per_visitor_limit(monkeypatch):
    from types import SimpleNamespace

    main._hits.clear()
    real = main.settings
    monkeypatch.setattr(main, "settings", SimpleNamespace(**{**real.__dict__, "submit_limit": 2}))
    monkeypatch.setattr(llm, "structure_recipe", lambda t: RecipeDraft(title="x", steps=["y"]))
    body = {"transcript": "Limit test transcript number one, boil and stir it well."}
    assert client.post("/api/transcript", json=body).status_code == 200
    assert client.post("/api/transcript", json=body).status_code == 200
    r = client.post("/api/transcript", json=body)
    assert r.status_code == 429 and "Try again" in r.json()["detail"]
    main._hits.clear()


def test_daily_cap(monkeypatch):
    from types import SimpleNamespace

    monkeypatch.setattr(llm, "get_settings", lambda: SimpleNamespace(llm_max_per_day=1))
    llm._day.update(date="", count=0)
    llm._daily_cap()
    with pytest.raises(llm.QuotaError, match="today"):
        llm._daily_cap()
    llm._day.update(date="", count=0)


def test_status_prefers_last_real_call(monkeypatch):
    import time as _t

    monkeypatch.setattr(
        main.httpx, "get", lambda *a, **k: (_ for _ in ()).throw(AssertionError("probed"))
    )
    llm.last_call.update(ok=True, at=_t.monotonic())
    assert main.llm_reachable() is True
    llm.last_call.update(ok=None, at=0.0)


def test_favourite_toggle_filter_and_backup():
    rid = _recipe(title="Grandad's toffee")
    assert client.get(f"/api/recipes/{rid}").json()["favorite"] is False
    r = client.patch(f"/api/recipes/{rid}/favorite", json={"favorite": True})
    assert r.status_code == 200 and r.json()["favorite"] is True
    favs = client.get("/api/recipes?favorite=true").json()
    assert rid in [x["id"] for x in favs] and all(x["favorite"] for x in favs)
    assert rid not in [x["id"] for x in client.get("/api/recipes?favorite=false").json()]
    # editing the recipe keeps it a favourite
    body = client.get(f"/api/recipes/{rid}").json()
    body["title"] = "Grandad's best toffee"
    assert client.put(f"/api/recipes/{rid}", json=body).json()["favorite"] is True
    # backups carry favourites across
    exported = [x for x in client.get("/api/export").json() if x["id"] == rid]
    client.post("/api/import", json=exported)
    restored = [x for x in client.get("/api/recipes?q=best toffee").json() if x["id"] != rid]
    assert restored and restored[0]["favorite"] is True
    assert client.patch("/api/recipes/999999/favorite", json={"favorite": True}).status_code == 404


def test_delete_removes_recipe_and_its_files():
    rid = _recipe(title="To be deleted")
    photo = client.post(f"/api/recipes/{rid}/photo", files={"file": ("a.png", _png())}).json()[
        "photo_url"
    ]
    assert client.get(photo).status_code == 200
    assert client.delete(f"/api/recipes/{rid}").status_code == 204
    assert client.get(f"/api/recipes/{rid}").status_code == 404
    assert client.get(photo).status_code == 404
    assert client.delete(f"/api/recipes/{rid}").status_code == 404


def test_import_is_capped():
    big = [{"id": 1, "title": "x", "created_at": "2026-01-01T00:00:00Z", "status": "ready"}] * 501
    assert client.post("/api/import", json=big).status_code == 413


def test_narration_failure_is_explained(monkeypatch):
    from app import eleven

    def down(text):
        raise eleven.ElevenLabsError("Narration failed: service unavailable")

    monkeypatch.setattr(eleven, "narrate", down)
    rid = _recipe(title="Quiet soup")
    r = client.post(f"/api/recipes/{rid}/narrate")
    assert r.status_code == 502 and "Narration failed" in r.json()["detail"]


def test_missing_pdf_engine_names_the_fix(monkeypatch):
    from app import pdf

    def no_engine(*a, **k):
        raise OSError("cannot load library 'libgobject-2.0-0'")

    monkeypatch.setattr(pdf, "render_pdf", no_engine)
    rid = _recipe(title="Paper soup")
    r = client.get(f"/api/recipes/{rid}/pdf")
    assert r.status_code == 503 and "Pango" in r.json()["detail"]
    assert "libgobject" not in r.json()["detail"]  # no raw library errors for users


def test_book_rejects_bad_ids():
    assert client.get("/api/book.pdf?ids=1,abc").status_code == 400
    assert client.get("/api/book.pdf?ids=999998,999999").status_code == 404


def test_rewrite_refuses_while_still_writing():
    with Session(get_engine()) as db:
        r = Recipe(
            status="structuring", title="Busy", transcript="words words words", user_id=_me()
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        rid = r.id
    assert client.post(f"/api/recipes/{rid}/restructure").status_code == 409
    assert client.put(f"/api/recipes/{rid}", json={"title": "x"}).status_code == 409
