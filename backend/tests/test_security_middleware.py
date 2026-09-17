import importlib

from fastapi.testclient import TestClient


def test_cors_allows_configured_origin(monkeypatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://rams.example.com")
    monkeypatch.setenv("TRUSTED_HOSTS", "testserver")

    import app.core.config as config
    import app.main as main

    importlib.reload(config)
    importlib.reload(main)

    client = TestClient(main.app)
    response = client.options(
        "/health",
        headers={
            "Origin": "https://rams.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://rams.example.com"


def test_cors_rejects_unconfigured_origin(monkeypatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://rams.example.com")
    monkeypatch.setenv("TRUSTED_HOSTS", "testserver")

    import app.core.config as config
    import app.main as main

    importlib.reload(config)
    importlib.reload(main)

    client = TestClient(main.app)
    response = client.options(
        "/health",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_trusted_host_rejects_unknown_host(monkeypatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "http://testserver")
    monkeypatch.setenv("TRUSTED_HOSTS", "testserver")

    import app.core.config as config
    import app.main as main

    importlib.reload(config)
    importlib.reload(main)

    client = TestClient(main.app)
    response = client.get("/health", headers={"host": "attacker.example.com"})

    assert response.status_code == 400


def test_trusted_host_allows_configured_host(monkeypatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "http://testserver")
    monkeypatch.setenv("TRUSTED_HOSTS", "testserver")

    import app.core.config as config
    import app.main as main

    importlib.reload(config)
    importlib.reload(main)

    client = TestClient(main.app)
    response = client.get("/health", headers={"host": "testserver"})

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
