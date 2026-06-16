from __future__ import annotations

from fastapi import Request


def client_ip(request: Request) -> str:
    """Client IP with optional X-Forwarded-For from reverse proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"
