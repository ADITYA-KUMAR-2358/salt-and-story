# Salt & Story: Product Requirements

> Recipes, in the voices that made them.

Status: v1.1, built for the DEV Hacktoberfest Weekend Challenge "Build for a Friend" (deadline Mon Oct 5, 2026, 06:59 UTC).
Read with: [ARCHITECTURE.md](ARCHITECTURE.md), [DESIGN.md](DESIGN.md), [RULES.md](RULES.md), [TASKS.md](TASKS.md), [MEMORY.md](MEMORY.md).

## 1. Problem

Most family recipes were never written down. They live in one person's head and come out as rambling, spoken instructions: "a fistful of this, cook till it looks right." When that person is gone, the recipe and the voice go with them. Writing recipes down by hand loses the voice; a voice memo alone is unusable at the stove.

## 2. Product

A web app that turns voice memos of a relative cooking into:

1. a clean, structured recipe (ingredients with amounts, ordered steps, tips),
2. that keeps the speaker's own words beside it (story, original phrases for vague amounts, one verbatim pull-quote),
3. and exports a printable cookbook PDF that looks like a gift.

Open-weight AI (Gemma) is at the core, as the challenge requires.

## 3. Users

| User | Situation | Job |
| --- | --- | --- |
| **Collector** (primary) | Younger family member, laptop or phone, often sitting with the elder or just after a call | Record or upload memos, check and edit recipes, assemble and print the book |
| **Elder and family** (secondary) | Older eyes and hands, at the stove | Read recipes, listen to narration, cook step by step |
| **Challenge judges** (tertiary) | Viewing the live demo and DEV write-up | Understand the idea within seconds, see it work |

Accessibility beyond WCAG AA: 17px base text, 44px+ tap targets, strong contrast, visible focus, reduced-motion support, cook mode readable at arm's length with the screen kept awake.

## 4. Scope (v1, shipped)

### Capture
- Record in the browser (MediaRecorder) with a live level meter, timer, 20 minute cap, listen-back before sending.
- Upload audio: mp3, m4a, wav, webm, ogg; size limit enforced client and server side.
- Paste a transcript (works with no ElevenLabs key). "Try a sample" loads a fictional sample.
- Write a recipe by hand (works with no model at all).
- Speaker name per memo.

### Processing
- ElevenLabs speech-to-text (`scribe_v1`).
- Gemma via any OpenAI-compatible endpoint structures the transcript into JSON.
- Status pipeline: `uploaded -> transcribing -> structuring -> ready | failed`, polled by the UI.
- Failures carry a human-readable reason and a next step (retry, paste, write by hand).

### Recipe
- Reading view: photo, title, cook, meta chips (serves, prep, cook), story, verbatim quote card, ingredient checklist, tappable numbered steps, tips, original transcript toggle.
- Editor: every field, add/remove/reorder steps and tips, unsaved-changes guard (in-app and tab close).
- Photo upload (JPEG/PNG/WebP, resized, EXIF and GPS stripped server side).
- Cook mode: full screen, one step at a time, big type, Wake Lock, arrow keys, ingredient drawer.
- Narration via ElevenLabs text-to-speech, cached on disk.
- Rewrite from transcript (re-run the model), delete (with confirm), single-recipe PDF.

### Book
- Choose recipes, select all, reorder (drag or arrows), title and dedication remembered locally.
- Live cover preview mirroring the PDF cover.
- PDF: A5, cover with gingham band, contents with page numbers, one page per recipe with photo, closing page.

### Library and data
- Search across title, cook, quote, story and transcript.
- Favourites: heart a recipe on its card or page; filter Your recipes to favourites; Select favourites when making the book.
- Delete from the list (with confirmation), as well as from the recipe page.
- Backup (JSON download) and restore, because free hosting has an ephemeral disk.
- Six classic American and European family recipes (fictional voices, real dishes, openly licensed photos) that can be added in one click, photo included.

### Pages
Landing (`/`), Recipes (`/recipes`), Recipe (`/recipes/:id`), Add a memo (`/add`), Make the book (`/book`), Guide (`/guide`), Photo credits (`/credits`), 404, route error page, offline banner, server wake-up banner.

## 5. Non-goals (v1)

- Accounts, sharing, multi-family workspaces.
- Hindi or other languages (UI strings are centralised to make this next).
- Editing audio, speaker diarisation, video.
- Paid infrastructure. Everything must run on free tiers.

## 6. Requirements that must never regress

1. **Never invent food facts.** If it was not said, it is not in the recipe; unclear values are `null`.
2. **The quote is verbatim.** `quote` must be an exact substring of the transcript; code enforces this.
3. **Vague amounts keep their words**: "a pinch" becomes `quantity: "1/4 tsp"`, `note: "a pinch"`.
4. **Every failure explains itself and offers a next step.** No silent fakes.
5. **Secrets never reach the browser, the repo, logs or error messages.**
6. **Works degraded**: no ElevenLabs key means paste only; no model means write by hand; no PDF engine means a readable error.

## 7. Success

- A stranger can run it locally in under ten minutes from the README.
- A memo becomes a reviewed recipe in under two minutes.
- The printed book is something a family would keep.
- Judges understand the product from the landing page's first screen and the interactive "what was said becomes what you cook" demo.

## 8. Next steps (post-challenge)

Hindi and Hinglish (auto-detect in STT, Devanagari PDF font), persistent storage (Render disk or Postgres), shared family libraries with login, photo of the handwritten original, more narration voices, scaling servings.
