#!/bin/sh
set -e

WORKERS="${WEB_CONCURRENCY:-2}"

exec gunicorn app.backend.main:app \
  -k uvicorn.workers.UvicornWorker \
  -w "$WORKERS" \
  -b 0.0.0.0:8000 \
  --timeout 120 \
  --graceful-timeout 30 \
  --worker-tmp-dir /dev/shm \
  --access-logfile - \
  --error-logfile -
