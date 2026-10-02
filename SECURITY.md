# Security policy

Salt & Story stores family recipes, voice memos and photos, so security reports are taken seriously.

## Supported versions

Only the latest commit on `main` (and the deployment built from it) receives fixes.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub: open the repository's **Security** tab, then **Report a vulnerability** (GitHub private vulnerability reporting). If that option is not available, contact the maintainer, Aditya Kumar, through <https://github.com/ADITYA-KUMAR-2358> and ask for a private channel.

Please include:
- what you found and where (URL, endpoint or file),
- steps to reproduce, and what an attacker could do with it,
- any proof of concept, kept to the minimum needed.

What to expect (this is a small, volunteer-run project):
- an acknowledgement within 7 days,
- an assessment and a plan within 14 days,
- credit in the fix's release notes if you would like it.

Please give us a reasonable time to fix the problem before you disclose it, and do not access, change or delete other people's data while testing. Testing against your own local copy (`docker compose up`) is always welcome.

## In scope

- Getting at another account's recipes, photos, audio or narration.
- Bypassing Google sign-in, session checks or the per-account daily limits.
- Leaking API keys or secrets (ElevenLabs, Google, `SESSION_SECRET`).
- Injection (SQL, HTML/JS, prompt injection that leaks data or bypasses limits), upload-handling flaws, SSRF.
- Anything that lets someone run code on the server.

## Out of scope

- Denial of service and volumetric attacks against the free demo.
- Reports from automated scanners without a working impact.
- Missing best-practice headers that do not lead to a real attack.
- Third-party services (Google, ElevenLabs, Render): report those to the provider.

## How the project protects data

- Secrets live only in server environment variables; never in the repository or the browser bundle. CI scans every commit for secrets (Gitleaks) and the built app for anything key-shaped.
- Sign-in uses Google ID tokens verified on the server; sessions are signed and expire.
- Every recipe query is scoped to the signed-in account; other people's recipes return "not found".
- Uploaded photos are re-encoded (removing EXIF and GPS data) and stored under unguessable names.
- Strict Content Security Policy, CORS allow-list, non-root containers, and dependency audits and CodeQL analysis on every pull request.
- Accounts and all their data can be deleted by the user from the Account page.
