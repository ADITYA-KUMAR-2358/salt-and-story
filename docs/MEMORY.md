# Project memory

Decisions and hard-won facts, newest first. Add to this when you learn something non-obvious. Never store secrets here.

## Decisions

- **2026-10-03: Favourites and list delete.** `favorite` column (migrated with `BOOLEAN NOT NULL DEFAULT 0`), `PATCH /api/recipes/{id}/favorite`, `?favorite=` filter; CORS now allows PATCH. Library filter lives in the URL (`?show=favourites`). Hearts are basil, not marigold: marigold fails 3:1 contrast on photos.
- **2026-10-03: Dockerised with Compose** (nginx web + api, same origin, only 8080 published). Carousel arrows removed (dots, tap, swipe and keyboard remain), per the owner.
- **2026-10-03: Legal pages added** (Privacy, Terms of use, Accessibility) in `src/content/legal.ts`. They state plainly that Google's free tier may use inputs to improve its products and may be human-reviewed; keep that true if the provider changes.
- **2026-10-03: `LLM_THINKING_LEVEL=minimal` by default on Google.** Passed as `extra_body.google.thinking_config.thinking_level` on the OpenAI-compatible endpoint. Cut a recipe from ~80-190s to ~15-35s with the same JSON quality and verbatim quotes. `reasoning_effort` and `thinkingLevel: LOW` are rejected for Gemma 4; `MINIMAL` works. The owner's AI Studio snippet (google-genai SDK) also offered a Google Search tool: deliberately not used, it would add facts the cook never said.
- **2026-10-03: Quota guards for the free key.** Identical transcripts reuse the last ready recipe (no model call); `Rewrite from transcript` bypasses that. Daily cap (`LLM_MAX_PER_DAY`), per-visitor limit (`SUBMIT_LIMIT` per 10 min), status check reuses the last real outcome and probes at most every 10 min.
- **2026-10-03: Hero is a FIFO deck.** Photos and quote cards are stacked; advancing sends the top one to the back, back pulls the last to the front. Hover fans the deck and tilts the top print; touch drags it. Scroll reveals are a "developing photograph" (sepia/soft to full colour), replacing a clip-path pop the owner disliked.
- **2026-10-03: Book layout is a spread per recipe** (opener page with photo, title, story, quote; then ingredients, method, tips) with a running header on continuation pages. Verified by rendering real PDFs in Docker and inspecting every page.
- **2026-10-03: Footer signature** "Built by Aditya Kumar" with a GitHub button to https://github.com/ADITYA-KUMAR-2358.
- **2026-10-02: Gemma 4 via the Gemini API free tier is the default recipe writer.** The owner does not want to run a model locally. The same Google AI Studio key serves open-weight Gemma models (`gemma-4-26b-a4b-it`, `gemma-4-31b-it`) through the OpenAI-compatible endpoint `https://generativelanguage.googleapis.com/v1beta/openai`. Gemini models must not be used (challenge requires open-weight). Local Ollama remains supported by changing three env vars.
- **2026-10-02: Palette changed to "sunny kitchen"** (sage, basil, marigold, butter) after the owner asked for soothing, comforting, joyful colours. The earlier blue-and-turmeric ceramic palette read as cold. Signature texture is gingham.
- **2026-10-02: Hero shows one story card at a time.** Stacked overlapping quote cards hid text (owner screenshot). Replaced with a tap-to-advance GSAP carousel pairing each quote with its dish photo.
- **2026-10-02: Primary user is the collector** (younger family member); secondary is the elder at the stove; judges third. Accessibility target is "older eyes and hands" beyond WCAG AA.
- **English only for v1**; strings centralised for Hindi later.
- **Stack** (fixed by the owner): FastAPI, React + Vite + TS + Tailwind, ElevenLabs, WeasyPrint, Render.
- **Name**: Salt & Story, tagline "Recipes, in the voices that made them.", repo `salt-and-story`.

## Facts learned

- Gemma 4 on the Gemini API returns its reasoning inline as `<thought>...</thought>` before the answer. It must be stripped before JSON parsing (`llm.strip_thoughts`), and also when feeding the answer back on a repair retry.
- Gemma 4 on the Gemini API accepts a system message and `response_format: json_object`.
- One structured recipe took ~78-92s on `gemma-4-26b-a4b-it` with default thinking; ~15-35s with `minimal`. `LLM_TIMEOUT=240` stays as a safety net.
- Gemma sometimes returns numbers (`"quantity": 1`) where strings are expected; schemas coerce them instead of spending a repair retry.
- A hover animation still running on the deck can overwrite a step's z-index; `step()` kills deck tweens first.
- `<fieldset>` defaults to `min-width: min-content` and caused sideways scroll at 320px; reset globally in `index.css`. Long unbroken strings (URLs in errors) also need `overflow-wrap: anywhere`.
- Vite 8 bundles with Rolldown, not esbuild; to load TS in a quick Node script use `node --experimental-strip-types`.
- The fontsource packages inline one tiny font as a `data:` URL: CSP needs `font-src 'self' data:` (only visible behind nginx/Render headers, not in `vite preview`).
- WeasyPrint on Windows with conda-forge Pango: the DLL folder must be on `PATH` as well as `WEASYPRINT_DLL_DIRECTORIES`, or gobject's own dependencies fail to load (error 0x7e).
- Hash links into lazy pages (`/guide#faq`) need an explicit instant scroll after render; the router's scroll reset runs first.
- Docker Desktop is available on the dev machine: build `backend/` and run it to test PDFs (`book.html`) for real.
- The Gemini API occasionally returns transient 500s, especially with two calls in flight. Calls are now serialised (one at a time) and 5xx retried with back-off.
- `Settings` fields read env vars at import time. Tests must set env vars in `conftest.py` before importing `app`; monkeypatching env later has no effect.
- Real env vars override `.env` (`load_dotenv(override=False)`), so Render and tests are unaffected by a local `.env`.
- WeasyPrint needs GTK/Pango native libs; they are absent on the Windows dev machine. The PDF smoke test skips there and runs in Docker. The API returns a readable 503.
- SQLite `create_all` never alters tables; new columns are added by `models._migrate`.
- A restart kills `BackgroundTasks` mid-flight; `recover_interrupted()` marks such rows failed at boot.
- The Bash tool on this Windows machine mis-parses heredocs containing apostrophes; write scripts to files instead.
- The project folder was not its own git repo (git found `C:/` and refused it). Run `git init` inside the project before committing.

## People and context

- Owner: Aditya Kumar, solo participant in the DEV Hacktoberfest Weekend Challenge (deadline Mon Oct 5, 2026, 06:59 UTC).
- Planning record: `conversation-salt-and-story.md`; master prompt: `master-build-prompt.md`; post template: `post-salt-and-story.md` (in the owner's Downloads).
