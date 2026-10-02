"""Accounts: Google sign-in, sessions, isolation between accounts, daily allowance."""

import io
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlmodel import Session, select

from app import auth, llm, main
from app.main import app
from app.models import Recipe, User, get_engine
from app.schemas import RecipeDraft

client = TestClient(app)


def _with(**overrides):
    """A copy of the real settings with some fields changed (keeps computed properties)."""
    return replace(auth.settings, **overrides)


@pytest.fixture
def google(monkeypatch):
    """Switch the app to Google sign-in with a fake verifier (no network)."""

    def install(**overrides):
        params = {
            "auth_mode": "google",
            "google_client_id": "test-client",
            "allowed_emails": [],
            "user_daily_limit": 0,
            "submit_limit": 0,
            **overrides,
        }
        s = _with(**params)
        monkeypatch.setattr(auth, "settings", s)
        monkeypatch.setattr(main, "settings", s)

    install()

    def fake_verify(credential):
        if credential.startswith("bad"):
            raise ValueError("Token used too late")
        who = credential.split(":")[1]
        return {
            "iss": "https://accounts.google.com",
            "sub": f"sub-{who}",
            "email": f"{who}@example.com",
            "email_verified": True,
            "name": who.title(),
            "picture": "",
        }

    monkeypatch.setattr(auth, "verify_google_token", fake_verify)
    return install


def sign_in(who: str) -> dict:
    r = client.post("/api/auth/google", json={"credential": f"good-credential-0123456789:{who}"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_config_reports_mode_and_public_client_id(google):
    c = client.get("/api/auth/config").json()
    assert c["mode"] == "google" and c["google_client_id"] == "test-client"


def test_requests_without_a_session_are_refused(google):
    assert client.get("/api/recipes").status_code == 401
    assert (
        client.get("/api/recipes", headers={"Authorization": "Bearer forged.token"}).status_code
        == 401
    )
    assert client.get("/api/auth/me").status_code == 401


def test_bad_or_unverified_google_tokens_are_rejected(google, monkeypatch):
    assert (
        client.post("/api/auth/google", json={"credential": "bad-credential-xxxxxxxxx"}).status_code
        == 401
    )
    monkeypatch.setattr(
        auth,
        "verify_google_token",
        lambda c: {
            "iss": "https://evil.example",
            "sub": "x",
            "email": "x@example.com",
            "email_verified": True,
        },
    )
    assert (
        client.post(
            "/api/auth/google", json={"credential": "good-credential-0123456789:x"}
        ).status_code
        == 401
    )
    monkeypatch.setattr(
        auth,
        "verify_google_token",
        lambda c: {
            "iss": "accounts.google.com",
            "sub": "x",
            "email": "x@example.com",
            "email_verified": False,
        },
    )
    assert (
        client.post(
            "/api/auth/google", json={"credential": "good-credential-0123456789:x"}
        ).status_code
        == 401
    )


def test_allow_list_blocks_strangers(google):
    google(allowed_emails=["nani@example.com"])
    assert (
        client.post(
            "/api/auth/google", json={"credential": "good-credential-0123456789:stranger"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/auth/google", json={"credential": "good-credential-0123456789:nani"}
        ).status_code
        == 200
    )


def test_accounts_are_isolated(google):
    alice, bob = sign_in("alice"), sign_in("bob")
    rid = client.post(
        "/api/recipes", json={"title": "Alice's secret soup", "steps": ["Stir."]}, headers=alice
    ).json()["id"]
    assert client.get(f"/api/recipes/{rid}", headers=alice).status_code == 200
    # Bob cannot see, change, favourite, delete, narrate, print or export it
    assert client.get(f"/api/recipes/{rid}", headers=bob).status_code == 404
    body = {"title": "hijacked", "steps": []}
    assert client.put(f"/api/recipes/{rid}", json=body, headers=bob).status_code == 404
    assert (
        client.patch(
            f"/api/recipes/{rid}/favorite", json={"favorite": True}, headers=bob
        ).status_code
        == 404
    )
    assert client.delete(f"/api/recipes/{rid}", headers=bob).status_code == 404
    assert client.get(f"/api/book.pdf?ids={rid}", headers=bob).status_code == 404
    assert all(r["id"] != rid for r in client.get("/api/recipes", headers=bob).json())
    assert all(r["id"] != rid for r in client.get("/api/export", headers=bob).json())
    assert client.get(f"/api/recipes/{rid}", headers=alice).json()["title"] == "Alice's secret soup"


def test_daily_allowance_counts_only_real_model_calls(google, monkeypatch):
    google(user_daily_limit=2)
    calls = []
    monkeypatch.setattr(
        llm,
        "structure_recipe",
        lambda t: calls.append(t) or RecipeDraft(title="Soup", steps=["Boil."]),
    )
    me = sign_in("carol")
    first = client.post(
        "/api/transcript",
        headers=me,
        json={"transcript": "Carol's soup: boil the water and add the leeks slowly."},
    )
    assert first.status_code == 200
    # Same transcript again: reused for free, not counted
    client.post(
        "/api/transcript",
        headers=me,
        json={"transcript": "Carol's soup: boil the water and add the leeks slowly."},
    )
    assert len(calls) == 1
    assert client.get("/api/auth/me", headers=me).json()["used_today"] == 1
    client.post(
        "/api/transcript",
        headers=me,
        json={"transcript": "A second, different soup for Carol to boil."},
    )
    assert client.get("/api/auth/me", headers=me).json()["used_today"] == 2
    # Allowance used: refused up front with a friendly 429
    r = client.post(
        "/api/transcript",
        headers=me,
        json={"transcript": "A third soup, which should not be written."},
    )
    assert r.status_code == 429 and "today" in r.json()["detail"]
    # Writing by hand still works, it costs nothing
    assert (
        client.post(
            "/api/recipes", json={"title": "By hand", "steps": ["Mix."]}, headers=me
        ).status_code
        == 200
    )


def test_spend_refuses_past_the_limit_even_after_a_race(google):
    google(user_daily_limit=1)
    me = sign_in("dave")
    uid = client.get("/api/auth/me", headers=me).json()["id"]
    auth.spend(uid)
    with pytest.raises(auth.DailyLimitReached):
        auth.spend(uid)


def test_delete_account_removes_everything(google):
    me = sign_in("erin")
    rid = client.post(
        "/api/recipes", json={"title": "Erin's bread", "steps": ["Knead."]}, headers=me
    ).json()["id"]
    buf = io.BytesIO()
    Image.new("RGB", (20, 20), (1, 2, 3)).save(buf, "PNG")
    photo = client.post(
        f"/api/recipes/{rid}/photo", files={"file": ("p.png", buf.getvalue())}, headers=me
    ).json()["photo_url"]
    assert client.get(photo).status_code == 200
    assert client.delete("/api/auth/me", headers=me).status_code == 204
    assert client.get(photo).status_code == 404
    assert client.get("/api/auth/me", headers=me).status_code == 401
    with Session(get_engine()) as db:
        assert db.get(Recipe, rid) is None


def test_production_without_google_fails_closed(monkeypatch):
    monkeypatch.setattr(
        auth, "settings", _with(app_env="production", auth_mode="", google_client_id="")
    )
    assert auth.mode() == "closed"
    r = client.get("/api/recipes")
    assert r.status_code == 503 and "GOOGLE_CLIENT_ID" in r.json()["detail"]


def test_first_account_adopts_recipes_made_before_accounts(monkeypatch, tmp_path):
    from app import models

    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    saved = models._engine
    models.reset_engine()
    try:
        with Session(models.get_engine()) as db:
            db.add(Recipe(title="Made before accounts", status="ready"))
            db.commit()
        first = auth.upsert_user("sub-first", "first@example.com", "First", "")
        auth.upsert_user("sub-second", "second@example.com", "Second", "")
        with Session(models.get_engine()) as db:
            old = db.exec(select(Recipe).where(Recipe.title == "Made before accounts")).one()
            assert old.user_id == first.id
            assert len(db.exec(select(User)).all()) == 2
    finally:
        models._engine = saved


def test_sessions_are_signed_and_expire(monkeypatch):
    token = auth.issue_token(42)
    assert auth.read_token(token) == 42
    assert auth.read_token(token[:-2] + "xx") is None
    monkeypatch.setattr(auth, "settings", _with(session_days=-1))
    assert auth.read_token(token) is None


def test_media_names_are_unguessable(google):
    me = sign_in("frank")
    rid = client.post(
        "/api/recipes", json={"title": "Frank's pie", "steps": ["Bake."]}, headers=me
    ).json()["id"]
    buf = io.BytesIO()
    Image.new("RGB", (20, 20), (9, 9, 9)).save(buf, "PNG")
    url = client.post(
        f"/api/recipes/{rid}/photo", files={"file": ("p.png", buf.getvalue())}, headers=me
    ).json()["photo_url"]
    name = url.rsplit("/", 1)[1]
    assert str(rid) not in name.split(".")[0][:4] and len(name) >= 24


def test_throwaway_email_domains_are_refused(google, monkeypatch):
    def temp_mail(credential):
        return {
            "iss": "accounts.google.com",
            "sub": "sub-temp",
            "email": "someone@mailinator.com",
            "email_verified": True,
            "name": "Temp",
        }

    monkeypatch.setattr(auth, "verify_google_token", temp_mail)
    r = client.post("/api/auth/google", json={"credential": "good-credential-0123456789:temp"})
    assert r.status_code == 403 and "Temporary" in r.json()["detail"]
    assert auth.is_disposable("x@mail.yopmail.com")  # subdomains of listed domains too
    assert not auth.is_disposable("nani@gmail.com")


def test_extra_blocked_domains_from_settings(google):
    google(blocked_email_domains=["spammy.example"])
    assert auth.is_disposable("a@spammy.example")


def test_accounts_per_network_are_limited(google):
    google(accounts_per_ip_per_day=2, client_ip_header="x-test-ip")
    net = {"X-Test-IP": "198.51.100.1"}  # one household network, used only by this test

    def go(who, headers=net):
        return client.post(
            "/api/auth/google",
            headers=headers,
            json={"credential": f"good-credential-0123456789:{who}"},
        )

    assert go("net1").status_code == 200
    assert go("net2").status_code == 200
    r = go("net3")
    assert r.status_code == 429 and "network" in r.json()["detail"]
    assert go("net1").status_code == 200  # existing accounts can still sign in
    assert go("net4", {"X-Test-IP": "198.51.100.2"}).status_code == 200  # other networks unaffected


def test_network_daily_limit_spans_accounts(google, monkeypatch):
    google(ip_daily_limit=2, client_ip_header="x-test-ip")
    monkeypatch.setattr(llm, "structure_recipe", lambda t: RecipeDraft(title="x", steps=["y"]))
    net = {"X-Test-IP": "198.51.100.77"}
    a = {**sign_in("ipa"), **net}
    b = {**sign_in("ipb"), **net}
    ok = client.post(
        "/api/transcript", headers=a, json={"transcript": "Network soup one, boil it for a while."}
    )
    ok2 = client.post(
        "/api/transcript", headers=b, json={"transcript": "Network soup two, boil it for a while."}
    )
    assert ok.status_code == 200 and ok2.status_code == 200
    r = client.post(
        "/api/transcript", headers=b, json={"transcript": "Network soup three, too many now."}
    )
    assert r.status_code == 429 and "network" in r.json()["detail"]
    # a different network is unaffected
    other = {**sign_in("ipc"), "X-Test-IP": "198.51.100.78"}
    assert (
        client.post(
            "/api/transcript", headers=other, json={"transcript": "Elsewhere soup, boil it."}
        ).status_code
        == 200
    )


def test_client_ip_comes_only_from_the_trusted_header(google, monkeypatch):
    from starlette.requests import Request

    def req(headers):
        scope = {
            "type": "http",
            "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
            "client": ("10.0.0.9", 1234),
        }
        return Request(scope)

    # no header configured: spoofed X-Forwarded-For is ignored
    assert auth.client_ip(req({"X-Forwarded-For": "1.2.3.4"})) == "10.0.0.9"
    google(client_ip_header="true-client-ip")
    assert auth.client_ip(req({"True-Client-IP": "203.0.113.7"})) == "203.0.113.7"
    assert auth.client_ip(req({})) == "10.0.0.9"
    # stored only as a salted hash
    h = auth.ip_hash("203.0.113.7")
    assert "203" not in h and len(h) == 32
