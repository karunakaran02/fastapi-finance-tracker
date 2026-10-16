import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SMTP_HOST"] = ""

from app.core.config import settings

settings.SMTP_HOST = ""
from app.core.dependencies import get_db
from app.database.session import Base
from app.main import app
from app.services.category import seed_default_categories

TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

import app.database.session as session_module
session_module.SessionLocal = TestingSessionLocal


from app.core.rate_limiter import login_rate_limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter_fixture():
    login_rate_limiter.reset()
    yield
    login_rate_limiter.reset()


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_default_categories(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    db = TestingSessionLocal(bind=connection)
    yield db
    db.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    register_payload = {
        "email": "primary_user@example.com",
        "password": "Password123!",
        "full_name": "Primary User",
    }
    resp = client.post("/api/v1/auth/register", json=register_payload)
    if resp.status_code == 201:
        token = resp.json()["access_token"]
    else:
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": "primary_user@example.com", "password": "Password123!"},
        )
        token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_user_headers(client):
    register_payload = {
        "email": "secondary_user@example.com",
        "password": "Password456!",
        "full_name": "Secondary User",
    }
    resp = client.post("/api/v1/auth/register", json=register_payload)
    if resp.status_code == 201:
        token = resp.json()["access_token"]
    else:
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": "secondary_user@example.com", "password": "Password456!"},
        )
        token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

