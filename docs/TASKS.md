# Tasks

Status of the build, and the exact order to rebuild it from scratch. Tick boxes as you go.

## A. Build order from zero (what an agent should do)

1. [x] Read `PRD.md`, `RULES.md`, `ARCHITECTURE.md`, `DESIGN.md`.
2. [x] Backend core: `config.py`, `models.py` (+ migration), `schemas.py`, `prompts.py`, `llm.py`, `pipeline.py`.
3. [x] External clients: `eleven.py` (STT/TTS), `photos.py`, `pdf.py` + `templates/book.html` + `fonts/`.
4. [x] Routes in `main.py`, startup recovery, request logging, CORS from env.
5. [x] Tests with all externals mocked (`pytest`, `ruff`).
6. [x] Frontend shell: tokens in `index.css`, `router.tsx`, `Layout`, `strings.ts`, `api.ts`.
7. [x] Pages: Landing, Library, AddMemo, RecipePage (+ CookMode), BookPage, Guide, Credits, NotFound, RouteError.
8. [x] Assets: favicon/logo, icons, OG image, WebP photos + credits, spot illustrations.
9. [x] Motion with GSAP (reduced-motion safe).
10. [x] Deploy config: Dockerfile (non-root), `.dockerignore`, `render.yaml` (+ security headers), keep-alive and CI workflows.
11. [x] Docs: README, this folder.
12. [x] Full local verification: 49 backend tests, production build, 103/103 browser checks on 6 widths, Docker image (non-root, healthy), real book PDF inspected.
13. [x] Docker: `docker compose up --build` runs web (nginx) + api; 116/116 Playwright checks pass against it, including a real PDF and a full link crawl.
14. [x] PDF export without Docker on Windows (`scripts/setup-pdf-windows.ps1`), macOS (brew), Linux (apt).
15. [x] Footer sections and Privacy, Terms of use, Accessibility pages.
16. [x] Favourites (heart, filter, Select favourites in the book, kept in backups) and delete from Your recipes; 121/121 checks on Docker; SQLite migration verified on an existing volume.
17. [x] Accounts: Sign in with Google, per-account isolation, 5 AI recipes per account per day, account deletion; Python 3.14, Node 24, latest actions; Oxlint; CI with coverage gate, CodeQL, Dependabot, PR checks and Playwright against Docker; LICENSE, CODE_OF_CONDUCT, SECURITY.
18. [ ] Create the Google OAuth client and set GOOGLE_CLIENT_ID and SESSION_SECRET on Render.
19. [ ] Deploy to Render and run the production checklist (section D).

## B. Done (v1.1)

- [x] Record / upload / paste / write by hand, speaker names, sample transcripts
- [x] Gemma 4 via Gemini API free tier; throttle, one-at-a-time, 429 + 5xx retry, thought stripping, JSON repair
- [x] Verbatim quote enforcement, vague-amount notes, no invention
- [x] Status pipeline with polling, readable failures, retry, restart recovery
- [x] Recipe read view, editor with unsaved-changes guard, photo upload, narration, cook mode, rewrite, delete
- [x] Book builder with live cover preview, ordering, persisted title/dedication, PDF
- [x] Search, backup/restore, classics shelf with photos
- [x] Landing with hero story carousel, interactive demo, bento, archive band, classics, guide
- [x] Skeleton loaders (pages, lists, every image), lazy routes and images
- [x] 404, route error, offline, server waking states
- [x] Light and dark mode (follows the device, with a manual toggle), 17px base, 44px targets, keyboard and screen reader support
- [x] Quota guards: minimal thinking, transcript reuse, daily cap, per-visitor limit, throttle, 429/5xx retry
- [x] FIFO hero deck (tap, swipe, arrows, dots, hover fan, tilt), developing-photo reveals
- [x] Book as recipe spreads with running headers; verified in Docker
- [x] Footer signature and GitHub link

## C. Known limits / next

- [ ] Free Render disk is ephemeral: add a Render disk or move to Postgres + object storage for real use.
- [ ] Recipes take ~15-35s on the free tier with minimal thinking; streaming partial results would feel faster still.
- [ ] Hindi / Hinglish (STT language auto-detect, Devanagari PDF font, translated `strings.ts` + `content/`).
- [ ] Shared family library (auth), audio playback of the original memo, servings scaling.
- [ ] Local Windows PDF rendering needs GTK; Docker is the supported path.

## D. Release checklist (run before every deploy)

Backend
- [ ] `cd backend && ruff check . && pytest` green
- [ ] `docker build backend` succeeds and the container answers `/health` as non-root

Frontend
- [ ] `cd frontend && npm ci && npm run build` green
- [ ] No secrets in `dist/` (CI greps for key patterns)

Integrated (both running, see README)
- [ ] Every route renders at 390px and 1440px with no console errors or sideways scroll
- [ ] CORS: frontend origin allowed, unknown origin not allowed
- [ ] Add a classic, edit + save, unsaved guard, cook mode, photo upload, delete
- [ ] Paste a sample through real Gemma to `ready`
- [ ] Book builds (Docker / Render) and downloads
- [ ] Backup downloads and restores

Secrets
- [ ] `.env` not tracked (`git ls-files | grep .env` shows only `.env.example`)
- [ ] Render env vars set with `sync: false`; `CORS_ORIGINS` is the exact static-site URL
- [ ] Any key that was ever pasted into chat, a ticket or a commit has been rotated
