# Rules for anyone (human or agent) working on Salt & Story

These are binding. If a request conflicts with one, say so before acting.

## Product truth

1. **Never invent food facts.** The model prompt, the code and the UI copy must not add ingredients, amounts, times or steps that were not said. Unknown is `null`, shown as blank.
2. **The quote is sacred.** `quote` is an exact substring of the transcript. Do not loosen `verify_quote`. Do not "improve" quote wording anywhere, including demo data.
3. **No fake success.** If transcription, the model, narration or the PDF engine fails, show a readable reason and a next step. Never return placeholder recipes.
4. **Open-weight only.** The recipe writer must be a Gemma (or other open-weight) model. Do not switch `LLM_MODEL` to a Gemini/GPT/Claude model; that breaks the challenge rules.
5. **Demo data is labelled fictional.** Sample speakers are invented; recipes are classics. Never present them as real people or testimonials. Never add invented users, metrics or reviews.

## Secrets

6. Secrets live only in backend environment variables: `.env` locally (gitignored, dockerignored) and Render env vars (`sync: false`) in production.
7. Never put a secret in: frontend code or `VITE_*` vars, `render.yaml` values, README/docs, tests, logs, error messages, commit messages, screenshots.
8. Before every commit: `git status` must not show `.env`; run the secret scan in CI (`ci.yml`). If a key leaks, rotate it first, then clean up.
9. Error messages may name an env var (`Check LLM_API_KEY`) but never print its value.

## Code

10. **Backend**: Python 3.12, FastAPI, Pydantic v2, SQLModel. Type everything. `ruff check .` and `pytest` must pass. External calls (ElevenLabs, LLM, network) are mocked in tests; tests set env vars in `conftest.py` so they never use real keys or quota.
11. Prompts live in `backend/app/prompts.py`. Change behaviour there, not with ad hoc string building.
12. Schema changes: add the field to `models.Recipe` **and** to `_ADDED_COLUMNS` so existing SQLite files migrate.
13. Long or blocking work goes in `pipeline.py` background tasks. Set the new status in the request handler before returning (prevents polling races).
14. **Frontend**: React + TypeScript strict, Tailwind v4, no `any`. `npm run build` (includes `tsc`) must pass.
15. All UI text goes in `src/strings.ts` or `src/content/*.ts`. No English literals in logic.
16. Icons: `@phosphor-icons/react` only. Custom illustrations live in `components/Brand.tsx` and follow its grammar (96 grid, 2.6 round stroke, currentColor + butter/marigold fills).
17. Images: use `<Img>` (skeleton + lazy + fallback). Add new photos as WebP at 640 and 1280 widths in `public/images/` and credit them in `CREDITS.md` and `pages/Credits.tsx`.
18. Motion: GSAP only for authored moments, always inside `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`. Animate transform, opacity, clip-path. No scroll listeners; use ScrollTrigger or IntersectionObserver.
19. Respect the design system in [DESIGN.md](DESIGN.md): tokens, the radius rule, one accent, no eyebrow labels, no em dashes in UI copy.

## Accessibility (non-negotiable)

20. Labels above inputs, never placeholder-as-label. Errors below the field or inline, with `role="alert"`.
21. Every interactive element reachable by keyboard with a visible focus ring; 44px minimum targets.
22. Contrast at least WCAG AA (body 4.5:1). Check both light and dark mode.
23. Dialogs use `<dialog>` (`ConfirmDialog`) or `role="dialog"` with focus management and Esc.
24. Reduced motion: no autoplay, no parallax, no animated entrances.

## Process

25. Keep `docs/TASKS.md` and `docs/MEMORY.md` current when you finish or learn something.
26. Small commits with clear messages. Never commit `data/`, `.env`, real family audio or photos.
27. Before saying "done": backend tests, frontend build, and the end-to-end checklist in TASKS.md.
