# Contributing to Salt & Story

Thanks for helping families keep their recipes.

## Before you start

Read [docs/RULES.md](docs/RULES.md). The two rules that matter most: the app **never invents food facts**, and **the speaker's quote is always verbatim**.

## Set up

```bash
# Backend (Python 3.13+; a virtual environment keeps it separate from other projects)
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

# Frontend (Node 24, see .nvmrc)
cd ../frontend && npm ci

# Browser tests
cd ../e2e && npm ci && npx playwright install chromium
```

Or run everything with `docker compose up --build` (set `AUTH_MODE=dev` in `.env` to skip Google sign-in locally).

## The checks every pull request must pass

`ci.yml` runs all of these; run them locally first:

| Area | Command |
| --- | --- |
| Backend lint and format | `ruff check . && ruff format --check .` |
| Backend tests, coverage >= 90%, no deprecations | `pytest -W error::DeprecationWarning --cov=app` |
| Backend dependency audit | `pip-audit -r requirements.txt` |
| Frontend lint (zero warnings) | `npm run lint` |
| Frontend types and build | `npm run typecheck && npm run build` |
| Browser tests against Docker | `docker compose up -d --build --wait`, then in `e2e/`: `WEB=http://localhost:8080 API=http://localhost:8080 npm test` |

Also run on every pull request: CodeQL security analysis, Gitleaks secret scan, dependency review, and a check that the PR title follows [Conventional Commits](https://www.conventionalcommits.org) (`feat(book): add a dedication page`).

## Pull requests

- One change per pull request, with a conventional title.
- Fill in the template: what, why, how you checked it, screenshots for UI.
- Never commit `.env`, keys, `data/`, or real family recordings.
