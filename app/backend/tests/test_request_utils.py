import pytest
from unittest.mock import MagicMock

from app.backend.core.request_utils import client_ip


def test_client_ip_from_forwarded():
    req = MagicMock()
    req.headers = {"X-Forwarded-For": "203.0.113.1, 10.0.0.1"}
    req.client = MagicMock(host="127.0.0.1")
    assert client_ip(req) == "203.0.113.1"


def test_client_ip_direct():
    req = MagicMock()
    req.headers = {}
    req.client = MagicMock(host="192.168.1.5")
    assert client_ip(req) == "192.168.1.5"
