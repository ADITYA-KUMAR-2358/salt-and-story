# Deploying Salt & Story

Two ways to put Salt & Story online:

- **[Part A: Render](#part-a-render-step-by-step)**, step by step, on the free plan, using the `render.yaml` Blueprint in this repo.
- **[Part B: Anywhere else](#part-b-any-other-host)**: one server with Docker Compose, or the API and the website on separate hosts.

Whichever you choose, you need these values:

| Setting | Where to get it | What it does |
| --- | --- | --- |
| `LLM_API_KEY` (secret) | [Google AI Studio](https://aistudio.google.com/apikey) (free) | Lets Gemma write recipes |
| `ELEVENLABS_API_KEY` (secret) | [ElevenLabs](https://elevenlabs.io) dashboard | Transcription and narration (optional: without it, visitors can paste words instead) |
| `GOOGLE_CLIENT_ID` (public) | Google Cloud Console, see [Set up Sign in with Google](#set-up-sign-in-with-google) | Accounts. **Required in production**: without it the API refuses all recipe requests |
| `SESSION_SECRET` (secret) | Any long random string (Render can generate it) | Signs sessions so people stay signed in across restarts |
| `ALLOWED_EMAILS` (optional) | Your family's Google addresses, comma-separated | Makes your copy private to those people |

## Set up Sign in with Google

Do this once; it is free and takes about five minutes.

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) and create (or pick) a project.
2. If asked, configure the **OAuth consent screen**: app name "Salt & Story", your email as support and developer contact, audience **External**. The basic scopes (`openid`, `email`, `profile`) are enough; no verification is needed for them.
3. **Create credentials → OAuth client ID → Web application.**
4. Under **Authorized JavaScript origins**, add every address the website is served from, for example:
   - `http://localhost:8080` (Docker Compose)
   - `http://localhost:5173` (local development)
   - `https://salt-and-story-web.onrender.com` (your real website address)

   No redirect URIs are needed: the app uses Google's pop-up button.
5. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`) into `GOOGLE_CLIENT_ID`. It is public by design; it is not a secret.
6. Set `SESSION_SECRET` to a long random string, e.g. `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
7. Optional: set `ALLOWED_EMAILS=you@gmail.com,mum@gmail.com` so only your family can sign in.

Each account can have **5 recipes written or narrated per day** (`USER_DAILY_LIMIT`), so a shared link cannot drain your Gemma or ElevenLabs quota. Against spam from one device: sign-ins with throwaway email domains are refused (a bundled list of about 9,000 domains, plus `BLOCKED_EMAIL_DOMAINS`), and each network may create at most `ACCOUNTS_PER_IP_PER_DAY` (2) new accounts and make `IP_DAILY_LIMIT` (10) AI requests per day. IP addresses are only stored as salted hashes. The real visitor IP is read from `CLIENT_IP_HEADER`: `true-client-ip` on Render (set by Cloudflare, cannot be faked), `x-real-ip` behind the bundled nginx; never from a client-controlled `X-Forwarded-For`. The first account to sign in adopts any recipes made before accounts existed.

For local development without Google, `AUTH_MODE=dev` gives one built-in local account (never use it on a public server).

Secrets go only into the host's environment settings. Never into `render.yaml`, `docker-compose.yml`, the frontend, or git.

---

## Before you deploy (any host)

1. Run the checks locally:
   ```bash
   cd backend && ruff check . && pytest
   cd ../frontend && npm ci && npm run build
   ```
2. Make sure no secret is about to be committed:
   ```bash
   git status            # .env must NOT be listed
   git ls-files | grep -E '(^|/)\.env' | grep -v '\.env\.example'   # must print nothing
   ```
3. If a key was ever pasted into a chat, a ticket or a commit, **rotate it first** (create a new key, delete the old one).
4. Push the repo to GitHub (see the README for the commands).

---

## Part A: Render, step by step

You will create two services from one Blueprint:

| Service | Type | What it is | URL (if the name is free) |
| --- | --- | --- | --- |
| `salt-and-story-api` | Web Service, Docker, free | FastAPI backend with the PDF engine built in | `https://salt-and-story-api.onrender.com` |
| `salt-and-story-web` | Static Site, free | The React app | `https://salt-and-story-web.onrender.com` |

On Render the two services are on **different addresses**, so the backend must allow the website's address (CORS). Docker Compose avoids that by putting both behind one address; Render does not.

### A1. Create the services from the Blueprint

> Use **New → Blueprint**, not **New → Web Service**. Only a Blueprint reads `render.yaml`. A service created by hand looks for a `Dockerfile` at the repo root and fails with `open Dockerfile: no such file or directory` (see [A1b](#a1b-or-create-the-services-by-hand) to fix a service made by hand).

1. Sign in at [render.com](https://render.com) and connect your GitHub account.
2. **New → Blueprint**, pick the `salt-and-story` repository. Render reads `render.yaml` and shows both services.
3. It asks for the values marked `sync: false`:
   - `ELEVENLABS_API_KEY`: your ElevenLabs key.
   - `LLM_API_KEY`: your Google AI Studio key.
   - `CORS_ORIGINS`: `https://salt-and-story-web.onrender.com` (the website's address, exactly: `https://`, no trailing slash).
   - `GOOGLE_CLIENT_ID`: from [Set up Sign in with Google](#set-up-sign-in-with-google). Add the website's Render address to the client's **Authorized JavaScript origins**.
   - `SESSION_SECRET` is generated by Render automatically; `ALLOWED_EMAILS` is optional.
4. **Apply**. The API builds from `backend/Dockerfile` (a few minutes the first time); the website builds with `npm ci && npm run build`.

### A1b. Or create the services by hand

If you already made a service with **New → Web Service** (or prefer not to use a Blueprint), set these fields in the service's **Settings**, then **Manual Deploy → Deploy latest commit**.

**API: Web Service, Docker**

| Setting | Value |
| --- | --- |
| Language / Runtime | Docker |
| Root Directory | `backend` |
| Dockerfile Path | `./Dockerfile` (relative to the root directory) |
| Docker Build Context Directory | `.` |
| Health Check Path | `/health` |
| Instance type | Free |

Environment variables for the API:

| Key | Value |
| --- | --- |
| `LLM_API_KEY` | your Google AI Studio key (secret) |
| `ELEVENLABS_API_KEY` | your ElevenLabs key (secret) |
| `CORS_ORIGINS` | your website's address, e.g. `https://salt-and-story-web.onrender.com` |
| `GOOGLE_CLIENT_ID` | from [Set up Sign in with Google](#set-up-sign-in-with-google) |
| `SESSION_SECRET` | a long random string (secret) |
| `CLIENT_IP_HEADER` | `true-client-ip` (so the per-network limits see real visitors) |

Everything else has sensible defaults in the code and the Dockerfile (Gemma 4 on Google AI Studio, minimal thinking, quota guards, production mode, data in `/srv/data`). Override any of them from the README's table if you need to.

**Website: Static Site**

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Environment variable | `VITE_API_URL` = your API's address, e.g. `https://salt-and-story-api.onrender.com` (no trailing slash) |
| Redirects/Rewrites | Source `/*`, Destination `/index.html`, Action **Rewrite** |
| Headers (recommended) | copy the security headers from `render.yaml` (path `/*`), with your API address in the CSP |

### A2. Check the real addresses

Open each service in the Render dashboard and look at its URL.

- **If both match the table above**, you are done with this step.
- **If Render added a suffix** (for example `salt-and-story-api-x7k2.onrender.com` because the name was taken):
  1. In `render.yaml`, change `VITE_API_URL` to the real API address, and replace `https://salt-and-story-api.onrender.com` in the `Content-Security-Policy` header (it appears three times: `img-src`, `media-src`, `connect-src`).
  2. Commit and push; the website redeploys.
  3. On the API service, set `CORS_ORIGINS` to the real website address and save (the API restarts).

### A3. Check it works

1. API health: open `https://<api>/health` and expect `{"status":"ok"}`. The first visit after a while can take up to a minute (the free plan sleeps).
2. API capabilities: open `https://<api>/api/status` and expect `"transcription": true` and `"reachable": true` under `llm`.
3. Website: open `https://<web>`, then:
   - Add a classic from the home page, open it, and press **Start cooking**.
   - **Add a memo → Paste words → Try a sample → Make the recipe**. It should be ready in roughly 15 to 60 seconds.
   - **Make the book → Select all → Build the book**, then download the PDF. The PDF engine is part of the API's Docker image, so this works on Render.
4. In the browser's developer console there should be no red CORS errors.

### A4. Keep it awake for a demo (optional)

Free web services sleep after about 15 minutes without visits; the next visit wakes them in up to a minute (the website shows "Waking up the kitchen" meanwhile).

- **GitHub Actions (included)**: in your GitHub repo, go to **Settings → Secrets and variables → Actions → New repository secret**, name it `BACKEND_URL` and set the value to `https://<api>` (no trailing slash). The workflow `.github/workflows/keep-alive.yml` then pings `/health` every 5 minutes. GitHub may delay scheduled runs, and it pauses them after 60 days without commits.
- **External monitor (more reliable)**: a free [UptimeRobot](https://uptimerobot.com) or [cron-job.org](https://cron-job.org) check on `https://<api>/health` every 5 minutes.

One always-awake free service uses about 744 of Render's 750 free hours a month, so keep only the API awake. The static website never sleeps.

### A5. Know the free plan's limits

- **The disk is wiped** on every restart and redeploy: recipes, audio and photos disappear. Use **Back up recipes** on the Recipes page before redeploying, and **Restore a backup** afterwards. For real use, upgrade the API to a paid plan and uncomment the `disk:` block in `render.yaml` (mounted at `/srv/data`).
- **512 MB of memory** is enough for this app, including building a book.
- **Quota guards** protect your free Google key: `LLM_MAX_PER_DAY`, `SUBMIT_LIMIT` and `LLM_MAX_RPM` in `render.yaml`. Lower them if the link is shared widely.

### A6. Troubleshooting on Render

| You see | Likely cause | Fix |
| --- | --- | --- |
| Build fails: `open Dockerfile: no such file or directory` | Service was made with New → Web Service, so Render looks for `./Dockerfile` at the repo root | Set Root Directory `backend` and Dockerfile Path `./Dockerfile` (A1b), or recreate it with New → Blueprint |
| "Sign-in is not set up on this server yet" | `GOOGLE_CLIENT_ID` missing in production | Set it (see [Set up Sign in with Google](#set-up-sign-in-with-google)) |
| Google button says the origin is not allowed | The website address is not in the OAuth client's Authorized JavaScript origins | Add the exact address (scheme and port included) and wait a few minutes |
| Everyone is signed out after each deploy | `SESSION_SECRET` not set | Set it once (Render's Blueprint generates it) |
| Recipes fail with "LLM_API_KEY is not set on the server" | The key was not added to the API's environment | Add `LLM_API_KEY` in the API's Environment tab |
| "Cannot reach the server" on every page | `VITE_API_URL` points to the wrong address | Fix it in `render.yaml` (step A2) and redeploy the website |
| Red CORS errors in the console | `CORS_ORIGINS` is not exactly the website's address | Set it to `https://<web>` with no trailing slash |
| Photos or audio do not load, page otherwise fine | CSP header still has the old API address | Update the three CSP entries (step A2) |
| "Waking up the kitchen" for a minute | Free plan was asleep | Normal; add the keep-alive (A4) |
| "Transcription is not set up" | `ELEVENLABS_API_KEY` missing | Add it to the API's environment |
| Recipe "Needs attention", mentions the API key | `LLM_API_KEY` wrong or rotated | Update it on the API service |
| "free usage limit" or "today's limit" | Google quota or the app's own caps | Wait, or raise `LLM_MAX_PER_DAY` |
| Recipes vanished after a deploy | Free disk is ephemeral | Restore a backup; consider a paid disk |

To remove everything later: delete both services (and the Blueprint) in the Render dashboard, and the `BACKEND_URL` secret and keep-alive workflow on GitHub.

---

## Part B: Any other host

### B1. One server with Docker Compose (simplest)

Any Linux server with Docker (a small VPS is enough):

```bash
git clone https://github.com/ADITYA-KUMAR-2358/salt-and-story.git
cd salt-and-story
cp .env.example .env
nano .env                      # set LLM_API_KEY, ELEVENLABS_API_KEY, GOOGLE_CLIENT_ID, SESSION_SECRET
docker compose up -d --build   # serves on port 8080
```

- The website and API share one address (nginx proxies `/api`, `/media` and `/health`), so **no CORS setup** is needed.
- Data lives in the `salt-data` Docker volume and survives restarts and upgrades. Back it up with **Back up recipes**, or copy the volume.
- Put HTTPS in front with any reverse proxy. With [Caddy](https://caddyserver.com), a `Caddyfile` of two lines is enough:
  ```
  recipes.example.com {
      reverse_proxy localhost:8080
  }
  ```
- To update: `git pull && docker compose up -d --build`. Database changes are applied automatically at startup.

### B2. API and website on separate hosts

- **API**: any host that runs a Docker image (Render, Fly.io, Railway, Google Cloud Run, a VPS). Build from `backend/`, set the two secrets plus `APP_ENV=production` and `CORS_ORIGINS=https://<your-website>`, give it persistent storage at `/srv/data` if you want data to survive restarts, and point its health check at `/health`.
- **Website**: any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages with a 404 fallback). Build in `frontend/` with `VITE_API_URL=https://<your-api>` and `npm ci && npm run build`, publish `dist/`, and add a rewrite of every path to `/index.html` so refreshing a page does not 404. Copy the security headers from `frontend/nginx.conf`, putting your API address in `img-src`, `media-src` and `connect-src`.
- **The PDF engine** comes with the API's Docker image. If you run the API without Docker, install Pango on that machine (see the README).

### B3. Settings worth knowing

All settings are environment variables; the full list is in the README. The ones you are most likely to change in production:

| Variable | Default | Change it when |
| --- | --- | --- |
| `CORS_ORIGINS` | `http://localhost:5173` | The website and API are on different addresses |
| `LLM_MAX_PER_DAY` | `300` | You want a tighter or looser daily cap on your Google quota |
| `SUBMIT_LIMIT` | `8` per visitor per 10 minutes | The link is public and you see abuse |
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | Gemma 4 on Google AI Studio | You switch to Ollama or another open-weight host |
| `MAX_UPLOAD_MB`, `MAX_PHOTO_MB` | `25`, `10` | Your memos or photos are larger |
