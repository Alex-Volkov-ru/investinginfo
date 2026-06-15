#!/bin/bash
# Устанавливает еженедельный cron для очистки диска (воскресенье 04:00)

set -euo pipefail

SCRIPT="/root/bigs/scripts/server_disk_cleanup.sh"
CRON_LINE="0 4 * * 0 $SCRIPT >> /var/log/bigs-cleanup.log 2>&1"

chmod +x "$SCRIPT"

TMP=$(mktemp)
crontab -l 2>/dev/null | grep -Fv "$SCRIPT" > "$TMP" || true
echo "$CRON_LINE" >> "$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "Installed weekly cleanup cron:"
crontab -l | grep "$SCRIPT"
