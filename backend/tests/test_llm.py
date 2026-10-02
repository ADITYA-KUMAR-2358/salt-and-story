import json

import pytest

from app import llm

TRANSCRIPT = "Take one cup of rice. Wash it well. My nani said never stir the rice, let it rest."
GOOD = {
    "title": "Rice",
    "story": "Nani's rice.",
    "ingredients": [{"name": "rice", "quantity": "1 cup", "note": None}],
    "steps": ["Wash the rice."],
    "tips": ["Never stir."],
    "quote": "never stir the rice, let it rest.",
}


def test_valid_json_parses(monkeypatch):
    monkeypatch.setattr(llm, "_chat", lambda m: json.dumps(GOOD))
    d = llm.structure_recipe(TRANSCRIPT)
    assert d.title == "Rice" and d.ingredients[0].quantity == "1 cup"


def test_fenced_json_is_accepted(monkeypatch):
    monkeypatch.setattr(llm, "_chat", lambda m: "```json\n" + json.dumps(GOOD) + "\n```")
    assert llm.structure_recipe(TRANSCRIPT).title == "Rice"


def test_retries_then_succeeds(monkeypatch):
    replies = iter(["not json", json.dumps({"story": "no title"}), json.dumps(GOOD)])
    calls = []

    def fake(messages):
        calls.append(messages)
        return next(replies)

    monkeypatch.setattr(llm, "_chat", fake)
    assert llm.structure_recipe(TRANSCRIPT).title == "Rice"
    assert len(calls) == 3
    assert "Error" in calls[-1][-1]["content"]  # the validation error was appended


def test_gives_up_after_two_retries(monkeypatch):
    n = {"c": 0}

    def fake(messages):
        n["c"] += 1
        return "nope"

    monkeypatch.setattr(llm, "_chat", fake)
    with pytest.raises(llm.LLMError):
        llm.structure_recipe(TRANSCRIPT)
    assert n["c"] == 3


def test_exact_quote_is_kept():
    assert llm.verify_quote("Wash it well.", TRANSCRIPT) == "Wash it well."


def test_invented_quote_is_replaced_with_real_sentence():
    q = llm.verify_quote("my grandmother told me never to stir rice", TRANSCRIPT)
    assert q in TRANSCRIPT
    assert "never stir" in q


def test_structure_fixes_bad_quote(monkeypatch):
    bad = {**GOOD, "quote": "stirring ruins rice"}
    monkeypatch.setattr(llm, "_chat", lambda m: json.dumps(bad))
    assert llm.structure_recipe(TRANSCRIPT).quote in TRANSCRIPT


class _Resp:
    def __init__(self, status, payload=None):
        self.status_code, self._p, self.headers = status, payload, {}

    def json(self):
        return self._p

    def raise_for_status(self):
        if self.status_code >= 400:
            import httpx
            raise httpx.HTTPStatusError("x", request=None, response=None)


def test_chat_retries_without_json_mode_when_provider_rejects_it(monkeypatch):
    sent = []

    def fake_post(url, headers, json, timeout):
        sent.append(dict(json))
        if "response_format" in json:
            return _Resp(400)
        return _Resp(200, {"choices": [{"message": {"content": '{"title":"x"}'}}]})

    monkeypatch.setattr(llm.httpx, "post", fake_post)
    assert llm._chat([{"role": "user", "content": "hi"}]) == '{"title":"x"}'
    assert "response_format" in sent[0] and "response_format" not in sent[1]


def test_chat_explains_bad_key_and_unknown_model(monkeypatch):
    monkeypatch.setattr(llm.httpx, "post", lambda *a, **k: _Resp(401))
    with pytest.raises(llm.LLMError, match="LLM_API_KEY"):
        llm._chat([])
    monkeypatch.setattr(llm.httpx, "post", lambda *a, **k: _Resp(404))
    with pytest.raises(llm.LLMError, match="LLM_MODEL"):
        llm._chat([])


def test_chat_explains_unreachable_server(monkeypatch):
    import httpx

    def down(*a, **k):
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(llm.httpx, "post", down)
    with pytest.raises(llm.LLMError, match="LLM_BASE_URL"):
        llm._chat([])


def test_thought_blocks_are_stripped_before_parsing(monkeypatch):
    raw = '<thought>Plan: output {"title": "wrong"} maybe</thought>' + json.dumps(GOOD)
    monkeypatch.setattr(llm, "_chat", lambda m: raw)
    assert llm.structure_recipe(TRANSCRIPT).title == "Rice"
    assert llm.strip_thoughts("<think>unfinished") == ""


class _RateResp(_Resp):
    def __init__(self, status, payload=None, headers=None):
        super().__init__(status, payload)
        self.headers = headers or {}


def test_rate_limit_waits_then_succeeds(monkeypatch):
    calls, slept = [], []
    ok = {"choices": [{"message": {"content": '{"title":"x"}'}}]}

    def fake_post(url, headers, json, timeout):
        calls.append(1)
        return _RateResp(429, {"error": {"details": [{"retryDelay": "3s"}]}}) if len(calls) == 1 else _RateResp(200, ok)

    monkeypatch.setattr(llm.httpx, "post", fake_post)
    monkeypatch.setattr(llm.time, "sleep", lambda s: slept.append(s))
    assert llm._chat([]) == '{"title":"x"}'
    assert slept == [3.0]


def test_rate_limit_exhausted_raises_quota_error(monkeypatch):
    monkeypatch.setattr(llm.httpx, "post", lambda *a, **k: _RateResp(429, {}, {"retry-after": "1"}))
    monkeypatch.setattr(llm.time, "sleep", lambda s: None)
    with pytest.raises(llm.QuotaError, match="free usage limit"):
        llm._chat([])


def test_long_retry_delay_fails_fast_instead_of_hanging(monkeypatch):
    monkeypatch.setattr(llm.httpx, "post", lambda *a, **k: _RateResp(429, {}, {"retry-after": "3600"}))
    slept = []
    monkeypatch.setattr(llm.time, "sleep", lambda s: slept.append(s))
    with pytest.raises(llm.QuotaError):
        llm._chat([])
    assert slept == []


def test_throttle_spaces_calls(monkeypatch):
    from types import SimpleNamespace

    monkeypatch.setattr(llm, "get_settings", lambda: SimpleNamespace(llm_max_rpm=2))
    llm._recent.clear()
    slept = []
    monkeypatch.setattr(llm.time, "sleep", lambda s: slept.append(s))
    for _ in range(3):
        llm._throttle()
    assert len(slept) == 1 and 0 < slept[0] <= 60.1
    llm._recent.clear()


def test_server_errors_retry_then_explain(monkeypatch):
    calls, slept = [], []
    ok = {"choices": [{"message": {"content": '{"title":"x"}'}}]}

    def flaky(url, headers, json, timeout):
        calls.append(1)
        return _RateResp(500) if len(calls) == 1 else _RateResp(200, ok)

    monkeypatch.setattr(llm.httpx, "post", flaky)
    monkeypatch.setattr(llm.time, "sleep", lambda s: slept.append(s))
    assert llm._chat([]) == '{"title":"x"}' and slept == [4.0]

    monkeypatch.setattr(llm.httpx, "post", lambda *a, **k: _RateResp(500))
    with pytest.raises(llm.LLMError, match="error 500"):
        llm._chat([])


def test_thinking_level_sent_only_to_google(monkeypatch):
    from types import SimpleNamespace

    sent = []
    ok = {"choices": [{"message": {"content": '{"title":"x"}'}}]}

    def fake_post(url, headers, json, timeout):
        sent.append(json)
        return _RateResp(200, ok)

    monkeypatch.setattr(llm.httpx, "post", fake_post)
    base = dict(llm_model="gemma", llm_api_key="k", llm_timeout=5, llm_max_rpm=0,
                llm_max_wait=1, llm_thinking_level="minimal", llm_max_per_day=0)
    monkeypatch.setattr(llm, "get_settings", lambda: SimpleNamespace(
        **base, llm_base_url="https://generativelanguage.googleapis.com/v1beta/openai"))
    llm._chat([])
    assert sent[-1]["extra_body"]["google"]["thinking_config"]["thinking_level"] == "minimal"
    monkeypatch.setattr(llm, "get_settings", lambda: SimpleNamespace(
        **base, llm_base_url="http://localhost:11434/v1"))
    llm._chat([])
    assert "extra_body" not in sent[-1]


def test_rejected_options_are_dropped_on_retry(monkeypatch):
    from types import SimpleNamespace

    sent = []
    ok = {"choices": [{"message": {"content": '{"title":"x"}'}}]}

    def fake_post(url, headers, json, timeout):
        sent.append(dict(json))
        return _RateResp(400) if len(sent) == 1 else _RateResp(200, ok)

    monkeypatch.setattr(llm.httpx, "post", fake_post)
    monkeypatch.setattr(llm, "get_settings", lambda: SimpleNamespace(
        llm_model="gemma", llm_api_key="k", llm_timeout=5, llm_max_rpm=0, llm_max_wait=1,
        llm_max_per_day=0, llm_thinking_level="minimal", llm_base_url="https://generativelanguage.googleapis.com/v1beta/openai"))
    llm._chat([])
    assert "extra_body" in sent[0] and "extra_body" not in sent[1] and "response_format" not in sent[1]


def test_numeric_amounts_are_accepted_without_a_retry(monkeypatch):
    calls = []
    payload = {**GOOD, "servings": 4, "ingredients": [{"name": "eggs", "quantity": 3, "note": None}]}

    def fake(messages):
        calls.append(1)
        return json.dumps(payload)

    monkeypatch.setattr(llm, "_chat", fake)
    d = llm.structure_recipe(TRANSCRIPT)
    assert d.ingredients[0].quantity == "3" and d.servings == "4" and len(calls) == 1
