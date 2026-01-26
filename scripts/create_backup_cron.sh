#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="/root/bigs"
LOG_FILE="/var/log/bigs-backup.log"
API_URL="http://localhost:8001"

cd "$PROJECT_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting backup creation..."

if [ ! -f "$PROJECT_DIR/.env" ]; then
    log "ERROR: .env file not found in $PROJECT_DIR"
    exit 1
fi

source "$PROJECT_DIR/.env"

if [ -z "$BACKUP_CRON_EMAIL" ] || [ -z "$BACKUP_CRON_PASSWORD" ]; then
    log "ERROR: BACKUP_CRON_EMAIL and BACKUP_CRON_PASSWORD must be set in .env"
    exit 1
fi

log "Getting authentication token..."

TOKEN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$BACKUP_CRON_EMAIL\", \"password\": \"$BACKUP_CRON_PASSWORD\"}")

if [ $? -ne 0 ]; then
    log "ERROR: Failed to connect to API"
    exit 1
fi

TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    log "ERROR: Failed to get token. Response: $TOKEN_RESPONSE"
    exit 1
fi

log "Token obtained, creating backup..."

BACKUP_RESPONSE=$(curl -s -X POST "$API_URL/backups/create" \
    -H "accept: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '')

if [ $? -ne 0 ]; then
    log "ERROR: Failed to create backup via API"
    exit 1
fi

if echo "$BACKUP_RESPONSE" | grep -q '"success":true'; then
    BACKUP_NAME=$(echo "$BACKUP_RESPONSE" | grep -o '"filename":"[^"]*' | cut -d'"' -f4)
    log "SUCCESS: Backup created: $BACKUP_NAME"
else
    log "ERROR: Backup creation failed. Response: $BACKUP_RESPONSE"
    exit 1
fi

log "Backup creation completed successfully"

