import pytest

pytest.importorskip("httpx")


@pytest.fixture
def client():
    pytest.importorskip("tinkoff")
    from fastapi.testclient import TestClient
    from app.backend.app import create_app

    with TestClient(create_app()) as c:
        yield c
