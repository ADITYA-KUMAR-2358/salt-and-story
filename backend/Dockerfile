FROM python:3.12-slim

# WeasyPrint native libraries (Pango, HarfBuzz, Cairo) and a fallback font.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libcairo2 libgdk-pixbuf-2.0-0 \
      shared-mime-info fonts-dejavu-core curl \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DATA_DIR=/srv/data \
    APP_ENV=production

WORKDIR /srv
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY fonts ./fonts

# Run as an unprivileged user that owns only the data directory.
RUN useradd --create-home --uid 10001 salt \
    && mkdir -p /srv/data \
    && chown -R salt:salt /srv/data
USER salt

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD curl -fsS "http://127.0.0.1:${PORT:-8000}/health" || exit 1

# One worker: SQLite and the in-process LLM throttle assume a single process.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --proxy-headers --forwarded-allow-ips='*' --no-server-header"]
