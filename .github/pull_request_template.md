## What and why

<!-- One or two sentences. Link the issue if there is one. -->

## How I checked it

- [ ] `cd backend && ruff check . && ruff format --check . && pytest`
- [ ] `cd frontend && npm run lint && npm run typecheck && npm run build`
- [ ] Tried it in the browser (phone width too, if it touches the UI)
- [ ] `docker compose up --build` still works (if it touches Docker, deps or config)

## Checklist

- [ ] No secrets, `.env` files or real family audio in the diff
- [ ] Follows [docs/RULES.md](../docs/RULES.md) (never invent food facts, quotes stay verbatim)
- [ ] UI text lives in `strings.ts` / `content/`
- [ ] Docs updated if behaviour or setup changed (`README.md`, `docs/`)

## Screenshots

<!-- Before / after for UI changes. -->
