"""Structure a spoken-recipe transcript with an open-weight model (Gemma).

Works with any OpenAI-compatible endpoint: the Gemini API free tier (which
serves Gemma), local Ollama, OpenRouter and similar. Free tiers are rate limited,
so calls are throttled client-side and 429s are waited out politely.
"""

import json
import logging
import re
import threading
import time
from collections import deque

import httpx
from pydantic import ValidationError

from .config import get_settings
from .prompts import RETRY_SUFFIX, SYSTEM_PROMPT
from .schemas import RecipeDraft

log = logging.getLogger("salt.llm")
MAX_RETRIES = 2  # extra attempts when the model returns invalid JSON
RATE_RETRIES = 2  # extra attempts when the provider says "slow down"


class LLMError(RuntimeError):
    """Raised when the model is unreachable or never returns valid JSON."""


class QuotaError(LLMError):
    """The provider free quota is used up for now."""


QUOTA_MESSAGE = (
    "The recipe writer has hit its free usage limit for the moment. "
    "Wait a minute, then press Try again. Your memo is saved."
)

# --- client-side throttle ---------------------------------------------------

_lock = threading.Lock()
_one_at_a_time = threading.Lock()
_recent: deque[float] = deque()
_day = {"date": "", "count": 0}
# Last real outcome, so the status page rarely needs to ask the provider.
last_call = {"ok": None, "at": 0.0}
RETRYABLE = {429, 500, 502, 503, 504}


def _daily_cap() -> None:
    """Stop before the free daily quota is gone (LLM_MAX_PER_DAY, 0 disables)."""
    cap = get_settings().llm_max_per_day
    if cap <= 0:
        return
    today = time.strftime("%Y-%m-%d", time.gmtime())
    with _lock:
        if _day["date"] != today:
            _day.update(date=today, count=0)
        if _day["count"] >= cap:
            raise QuotaError(
                "The recipe writer has reached today's limit for this demo. "
                "Try again tomorrow, or write the recipe by hand. Your memo is saved."
            )
        _day["count"] += 1


def _throttle() -> None:
    """Keep under LLM_MAX_RPM calls per rolling minute (0 disables)."""
    rpm = get_settings().llm_max_rpm
    if rpm <= 0:
        return
    with _lock:
        now = time.monotonic()
        while _recent and now - _recent[0] > 60:
            _recent.popleft()
        if len(_recent) >= rpm:
            wait = 60 - (now - _recent[0]) + 0.1
            log.info("throttling LLM call for %.1fs to stay under %s/min", wait, rpm)
            time.sleep(wait)
        _recent.append(time.monotonic())


def _retry_after(r: httpx.Response) -> float:
    """Seconds to wait, from Retry-After or the RetryInfo detail Google sends."""
    header = r.headers.get("retry-after")
    if header:
        try:
            return float(header)
        except ValueError:
            pass
    try:
        payload = r.json()
        err = payload[0]["error"] if isinstance(payload, list) else payload["error"]
        for d in err.get("details", []):
            if "retryDelay" in d:
                return float(str(d["retryDelay"]).rstrip("s"))
    except (ValueError, KeyError, IndexError, TypeError):
        pass
    return 10.0


def _post(url: str, headers: dict, body: dict, timeout: float) -> httpx.Response:
    """POST with throttling, one call at a time, and polite retries.

    429 (quota) waits for the delay the provider asks for. 5xx errors are
    usually momentary on hosted APIs, so they back off and retry too.
    """
    max_wait = get_settings().llm_max_wait
    for attempt in range(RATE_RETRIES + 1):
        _daily_cap()
        _throttle()
        with _one_at_a_time:  # free tiers dislike parallel calls
            r = httpx.post(url, headers=headers, json=body, timeout=timeout)
        if r.status_code not in RETRYABLE:
            return r
        wait = _retry_after(r) if r.status_code == 429 else 4.0 * (attempt + 1) ** 2
        if attempt == RATE_RETRIES or wait > max_wait:
            if r.status_code == 429:
                raise QuotaError(QUOTA_MESSAGE)
            raise LLMError(
                f"The recipe writer service had a problem (error {r.status_code}). "
                "This is usually brief. Try again in a minute."
            )
        log.warning("LLM %s, retrying in %.0fs (attempt %s)", r.status_code, wait, attempt + 1)
        time.sleep(wait)
    raise LLMError("The recipe writer did not respond.")  # pragma: no cover


def _chat(messages: list[dict]) -> str:
    """One call to an OpenAI-compatible endpoint. Tests replace this.

    JSON mode is requested first; some providers reject that parameter, so a
    400/422 retries once without it (the parser copes with plain text).
    """
    s = get_settings()
    body: dict = {"model": s.llm_model, "messages": messages, "temperature": 0.2,
                  "response_format": {"type": "json_object"}}
    if s.llm_thinking_level and "generativelanguage.googleapis.com" in s.llm_base_url:
        # Google-specific passthrough on its OpenAI-compatible endpoint.
        tc = {"thinking_config": {"thinking_level": s.llm_thinking_level}}
        body["extra_body"] = {"google": tc}
    url = f"{s.llm_base_url.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {s.llm_api_key}"}
    try:
        r = _post(url, headers, body, s.llm_timeout)
        if r.status_code in (400, 422):
            # Some providers or models reject JSON mode or the thinking setting.
            body.pop("response_format", None)
            body.pop("extra_body", None)
            r = _post(url, headers, body, s.llm_timeout)
        if r.status_code in (401, 403):
            raise LLMError("The recipe writer rejected the API key. Check LLM_API_KEY.")
        if r.status_code == 404:
            raise LLMError(f"The model '{s.llm_model}' was not found. Check LLM_MODEL.")
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"]
        if not content or not strip_thoughts(content):
            raise LLMError("The recipe writer returned an empty answer. Try again.")
        last_call.update(ok=True, at=time.monotonic())
        return content
    except QuotaError:
        raise  # the service is fine, we are just out of quota
    except LLMError:
        last_call.update(ok=False, at=time.monotonic())
        raise
    except httpx.TimeoutException as e:
        raise LLMError(
            "The recipe writer took too long to answer. Try again, or use a faster model."
        ) from e
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
        raise LLMError(
            f"Could not reach the recipe writer at {s.llm_base_url}. "
            "Check LLM_BASE_URL, or write the recipe by hand."
        ) from e


_THOUGHT = re.compile(r"<(thought|think|thinking)>.*?</\1>", re.DOTALL | re.IGNORECASE)
_OPEN_THOUGHT = re.compile(r"<(thought|think|thinking)>.*", re.DOTALL | re.IGNORECASE)


def strip_thoughts(text: str) -> str:
    """Reasoning models (Gemma 4 included) may prefix the answer with a thought block."""
    text = _THOUGHT.sub("", text)
    return _OPEN_THOUGHT.sub("", text).strip()  # unclosed block: no answer yet


def _extract_json(text: str) -> dict:
    text = strip_thoughts(text)
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise
        return json.loads(text[start : end + 1])


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def verify_quote(quote: str, transcript: str) -> str:
    """Return a quote that is an exact substring of the transcript.

    If the model's quote is not, fall back to the closest transcript sentence.
    """
    if quote and quote in transcript:
        return quote
    sentences = [x.strip() for x in re.split(r"(?<=[.!?])\s+", transcript) if x.strip()]
    if not sentences:
        return ""
    q = set(_norm(quote).lower().split())
    if not q:
        return sentences[0]

    def score(sentence: str) -> float:
        words = set(sentence.lower().split())
        return len(q & words) / (len(q | words) or 1)

    return max(sentences, key=score)


def structure_recipe(transcript: str) -> RecipeDraft:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f'Transcript: "{transcript}"'},
    ]
    last_error = ""
    for attempt in range(MAX_RETRIES + 1):
        raw = _chat(messages)
        try:
            draft = RecipeDraft.model_validate(_extract_json(raw))
            draft.quote = verify_quote(draft.quote, transcript)
            return draft
        except (json.JSONDecodeError, ValidationError) as e:
            last_error = str(e)
            log.warning("LLM output invalid (attempt %s): %s", attempt + 1, last_error[:200])
            messages += [
                {"role": "assistant", "content": strip_thoughts(raw)},
                {"role": "user", "content": RETRY_SUFFIX.format(error=last_error[:500])},
            ]
    raise LLMError(f"The model did not return a valid recipe after retries: {last_error[:200]}")
