# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: **the collector**. A younger family member who records or uploads voice memos of an elder telling recipes, checks and edits the written-up recipe, and assembles the printable book. They use it on a laptop or phone, often while sitting with the elder or right after a call.

Secondary: **the elder and the rest of the family**. They read recipes, listen to narration, and cook from the printed or on-screen recipe at the stove.

## Product Purpose

Salt & Story turns spoken, rambling family recipes into clean written recipes while keeping the speaker's own words beside them, then exports a printable cookbook meant as a gift. Success is a family member holding a printed book that sounds like the person who taught them.

## Positioning

The speaker's voice is preserved, not rewritten: every recipe keeps a verbatim pull-quote checked against the transcript, vague amounts keep the original phrase ("a pinch") next to a measurement, and nothing is invented. Open-weight AI (Gemma via any OpenAI-compatible host) does the structuring, so the family's recipes are not handed to a closed model.

## Operating Context

- Built for the DEV Hacktoberfest Weekend Challenge "Build for a Friend" (deadline Mon Oct 5, 2026). Family first; challenge judges see it through the live demo and write-up.
- Inputs: in-browser recording, uploaded audio (mp3, m4a, wav, webm, ogg), or a pasted transcript.
- Outputs: editable recipe pages, ElevenLabs narration, single-recipe and full-book PDFs (A5, WeasyPrint).
- Deployed on Render free tier: the backend sleeps when idle and has an ephemeral disk, so cold starts and JSON export/import are part of the real experience.

## Capabilities and Constraints

- English only for now; UI strings live in `frontend/src/strings.ts` so Hindi can follow.
- Works without an ElevenLabs key (paste a transcript) and without a reachable model (write the recipe by hand). Failures must be explained, never faked.
- Stack: FastAPI + SQLite backend, React + Vite + TypeScript + Tailwind frontend.

## Brand Commitments

- Name: **Salt & Story**. Tagline: "Because Every Recipe Has A Story"
- Voice: warm, plain, family-kitchen. No marketing filler.
- The speaker's words are sacred: quotes are verbatim.

## Evidence on Hand

- Sample transcripts in `samples/`, all fictional and labelled as such (Indian, American and European family classics).
- Openly licensed food and archive photography in `frontend/public/images/`, credited in `frontend/public/images/CREDITS.md`.
- No real users, testimonials, metrics or press exist. Do not invent any.

## Product Principles

1. The speaker's voice comes first; the app is the frame around it.
2. Never invent food facts. When unsure, leave it blank and say so.
3. Every failure has a next step (retry, paste, or write by hand).
4. The book is the destination; every screen should move toward it.
5. Comfortable for older eyes and hands, including at the stove.

## Accessibility & Inclusion

Beyond WCAG AA: larger base text and tap targets (44px minimum), high contrast, visible focus, reduced-motion support, and a cook mode that is readable at arm's length with the screen kept awake.
