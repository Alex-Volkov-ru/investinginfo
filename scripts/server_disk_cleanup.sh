#!/bin/bash
# Еженедельная очистка диска на сервере BIGS

set -euo pipefail

PROJECT_DIR="/root/bigs"
LOG_FILE="/var/log/bigs-cleanup.log"
TELEGRAM_ENV="$PROJECT_DIR/.telegram-cleanup.env"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

disk_use() {
    df / | tail -1 | awk '{print $5}' | tr -d '%'
}

send_telegram() {
    local message="$1"
    if [ ! -f "$TELEGRAM_ENV" ]; then
        return 0
    fi
    # shellcheck disable=SC1090
    source "$TELEGRAM_ENV"
    if [ -z "${TELEGRAM_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
        return 0
    fi
    curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        --data-urlencode "text=${message}" \
        --data-urlencode "parse_mode=Markdown" >/dev/null || true
}

BEFORE=$(disk_use)
log "Cleanup started. Disk before: ${BEFORE}%"
df -h / | tee -a "$LOG_FILE"

if [ "$BEFORE" -gt 80 ]; then
    send_telegram "⚠️ *BIGS disk warning*
Disk usage: *${BEFORE}%*
Weekly cleanup started on server."
fi

docker image prune -f 2>&1 | tee -a "$LOG_FILE" || true

if [ "$BEFORE" -gt 85 ]; then
    log "Disk >85%, aggressive docker prune"
    docker image prune -af 2>&1 | tee -a "$LOG_FILE" || true
    docker builder prune -af 2>&1 | tee -a "$LOG_FILE" || true
fi

docker ps -a --format '{{.Names}}' | grep -E '^[0-9a-f]+_bigs-' | xargs -r docker rm -f 2>&1 | tee -a "$LOG_FILE" || true
find /var/lib/docker/containers -name '*-json.log' -size +5M -exec truncate -s 2M {} \; 2>/dev/null || true
docker volume prune -f 2>&1 | tee -a "$LOG_FILE" || true
journalctl --vacuum-size=50M 2>&1 | tee -a "$LOG_FILE" || true

AFTER=$(disk_use)
log "Cleanup finished. Disk after: ${AFTER}%"
df -h / | tee -a "$LOG_FILE"

if [ "$AFTER" -gt 80 ]; then
    send_telegram "⚠️ *BIGS disk still high*
Before: *${BEFORE}%*
After cleanup: *${AFTER}%*
Check server disk manually."
fi

log "Cleanup completed"
