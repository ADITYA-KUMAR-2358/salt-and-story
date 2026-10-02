import pytest
from fastapi.testclient import TestClient

from app import eleven, llm, pdf
from app.main import app
from app.schemas import RecipeDraft

client = TestClient(app)
TRANSCRIPT = "Boil two cups of water. Add a pinch of salt. My aunt says the water should dance."


@pytest.fixture(autouse=True)
def mocks(monkeypatch):
    monkeypatch.setattr(
        llm,
        "structure_recipe",
        lambda t: RecipeDraft(
            title="Boiled water", steps=["Boil."], quote="the water should dance."
        ),
    )
    monkeypatch.setattr(eleven, "transcribe", lambda p: TRANSCRIPT)
    monkeypatch.setattr(eleven, "narrate", lambda t: b"ID3fake")


def test_health():
    assert client.get("/health").json() == {"status": "ok"}
    assert client.head("/health").status_code == 200


def test_transcript_flow_and_crud():
    r = client.post("/api/transcript", json={"transcript": TRANSCRIPT})
    rid = r.json()["id"]
    got = client.get(f"/api/recipes/{rid}").json()
    assert got["status"] == "ready" and got["title"] == "Boiled water"

    got["title"] = "Dancing water"
    assert client.put(f"/api/recipes/{rid}", json=got).json()["title"] == "Dancing water"
    assert client.post(f"/api/recipes/{rid}/restructure").json()["status"] == "structuring"
    assert client.delete(f"/api/recipes/{rid}").status_code == 204
    assert client.get(f"/api/recipes/{rid}").status_code == 404


def test_audio_upload_flow():
    r = client.post("/api/memos", files={"file": ("memo.m4a", b"audio-bytes")})
    assert r.status_code == 200
    got = client.get(f"/api/recipes/{r.json()['id']}").json()
    assert got["status"] == "ready" and got["transcript"] == TRANSCRIPT and got["has_audio"]


def test_rejects_bad_file_type():
    assert client.post("/api/memos", files={"file": ("x.exe", b"x")}).status_code == 415


def test_llm_failure_marks_failed_with_reason(monkeypatch):
    def boom(t):
        raise llm.LLMError("model offline")

    monkeypatch.setattr(llm, "structure_recipe", boom)
    unique = "A transcript nobody has structured before: fry onions slowly until golden."
    rid = client.post("/api/transcript", json={"transcript": unique}).json()["id"]
    got = client.get(f"/api/recipes/{rid}").json()
    assert got["status"] == "failed" and "model offline" in got["error"]


def test_manual_recipe_fallback():
    r = client.post("/api/recipes", json={"title": "By hand", "steps": ["Mix."]})
    assert r.json()["status"] == "ready"


def test_narration_is_cached():
    rid = client.post("/api/recipes", json={"title": "Tea", "steps": ["Steep."]}).json()["id"]
    url = client.post(f"/api/recipes/{rid}/narrate").json()["url"]
    assert client.get(url).content == b"ID3fake"


def test_export_import_roundtrip():
    client.post("/api/recipes", json={"title": "Backup me"})
    data = client.get("/api/export").json()
    assert client.post("/api/import", json=data).json()["imported"] == len(data)


def test_book_requires_ids():
    assert client.get("/api/book.pdf").status_code == 400


def test_book_html_renders_every_section():
    from app.models import Recipe

    r = Recipe(
        id=1,
        title="Chai",
        story="Morning ritual.",
        steps=["Boil"],
        quote="Boil it twice.",
        ingredients=[{"name": "tea", "quantity": "2 tsp", "note": None}],
        speaker_name="Nani",
    )
    html = pdf.render_html([r], title="Salt & Story", dedication="Aditya")
    for needle in (
        "Chai",
        "Morning ritual.",
        "Boil it twice.",
        "For Aditya",
        "Contents",
        "Recipes told by Nani",
    ):
        assert needle in html


def test_pdf_smoke():
    from app.models import Recipe

    try:
        data = pdf.render_pdf([Recipe(id=1, title="Chai", steps=["Boil"])])
    except (ImportError, OSError):
        pytest.skip("WeasyPrint native libraries not installed (runs in Docker)")
    assert data.startswith(b"%PDF")


def test_cover_told_by_line_can_be_edited_or_hidden():
    from app.models import Recipe

    r = Recipe(id=1, title="Chai", steps=["Boil"], speaker_name="Nani")
    assert "Recipes told by Nani" in pdf.render_html([r])
    assert "Recipes told by Nani and the whole Sharma family" in pdf.render_html(
        [r], told_by="Nani and the whole Sharma family"
    )
    assert "Recipes told by" not in pdf.render_html([r], told_by="")


def test_book_endpoint_passes_told_by(monkeypatch):
    seen = {}
    monkeypatch.setattr(pdf, "render_pdf", lambda recipes, **kw: seen.update(kw) or b"%PDF-")
    rid = client.post("/api/recipes", json={"title": "Tea", "steps": ["Steep."]}).json()["id"]
    client.get(f"/api/book.pdf?ids={rid}&by=Grandma%20Ruth")
    assert seen["told_by"] == "Grandma Ruth"
    client.get(f"/api/book.pdf?ids={rid}")
    assert seen["told_by"] is None
