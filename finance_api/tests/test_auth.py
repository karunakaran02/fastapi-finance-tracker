
def test_register_user_success(client):
    payload = {
        "email": "newuser@example.com",
        "password": "StrongPassword123!",
        "full_name": "New User",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

def test_register_duplicate_email(client):
    payload = {
        "email": "duplicate@example.com",
        "password": "StrongPassword123!",
        "full_name": "Duplicate User",
    }
    response1 = client.post("/api/v1/auth/register", json=payload)
    assert response1.status_code == 201

    response2 = client.post("/api/v1/auth/register", json=payload)
    assert response2.status_code == 400
    assert "already exists" in response2.json()["detail"]

def test_register_short_password(client):
    payload = {
        "email": "shortpass@example.com",
        "password": "123",
        "full_name": "Short Pass",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422

def test_login_json_success(client):
    payload = {
        "email": "login_user@example.com",
        "password": "MySecretPassword123!",
        "full_name": "Login User",
    }
    client.post("/api/v1/auth/register", json=payload)

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "login_user@example.com", "password": "MySecretPassword123!"},
    )
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "access_token" in data
    assert "refresh_token" in data

def test_login_form_success(client):
    payload = {
        "email": "form_user@example.com",
        "password": "MySecretPassword123!",
        "full_name": "Form User",
    }
    client.post("/api/v1/auth/register", json=payload)

    login_resp = client.post(
        "/api/v1/auth/login/form",
        data={"username": "form_user@example.com", "password": "MySecretPassword123!"},
    )
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "access_token" in data
    assert "refresh_token" in data

def test_login_invalid_credentials(client):
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@example.com", "password": "WrongPassword!"},
    )
    assert login_resp.status_code == 401
    assert "No account found with this email. Please register first." in login_resp.json()["detail"]

def test_login_incorrect_password(client):
    payload = {
        "email": "pass_check@example.com",
        "password": "CorrectPassword123!",
        "full_name": "Pass Check",
    }
    client.post("/api/v1/auth/register", json=payload)
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "pass_check@example.com", "password": "WrongPassword123!"},
    )
    assert login_resp.status_code == 401
    assert "Incorrect password. Please try again." in login_resp.json()["detail"]

def test_refresh_token_success(client):
    payload = {
        "email": "refresh_user@example.com",
        "password": "MySecretPassword123!",
        "full_name": "Refresh User",
    }
    reg_resp = client.post("/api/v1/auth/register", json=payload)
    refresh_token = reg_resp.json()["refresh_token"]

    resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data

def test_refresh_token_invalid(client):
    resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid_jwt_token_string"},
    )
    assert resp.status_code == 401

def test_get_current_user_profile(client, auth_headers):
    resp = client.get("/api/v1/users/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "primary_user@example.com"
    assert data["full_name"] == "Primary User"
    assert data["is_active"] is True
    assert "password_hash" not in data

def test_unauthorized_request(client):
    resp = client.get("/api/v1/users/me")
    assert resp.status_code == 401

def test_logout(client, auth_headers):
    resp = client.post("/api/v1/auth/logout", headers=auth_headers)
    assert resp.status_code == 200
    assert "Successfully logged out" in resp.json()["message"]

def test_login_rate_limiting_exceeded(client):
    email = "ratelimit_target@example.com"
    for i in range(10):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "WrongPassword123!"},
        )
        assert resp.status_code == 401
        assert resp.headers.get("X-RateLimit-Limit") == "10"
        assert int(resp.headers.get("X-RateLimit-Remaining")) == 9 - i

    resp_11 = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword123!"},
    )
    assert resp_11.status_code == 429
    assert "Too many login attempts" in resp_11.json()["detail"]
    assert "10 hits per 2 hours" in resp_11.json()["detail"]
    assert "Retry-After" in resp_11.headers
    assert int(resp_11.headers["Retry-After"]) > 0

def test_login_rate_limiting_per_user_isolation(client):
    user_a = "user_blocked@example.com"
    user_b = "user_allowed@example.com"

    for _ in range(10):
        client.post(
            "/api/v1/auth/login",
            json={"email": user_a, "password": "WrongPassword!"},
        )

    blocked_resp = client.post(
        "/api/v1/auth/login",
        json={"email": user_a, "password": "WrongPassword!"},
    )
    assert blocked_resp.status_code == 429

    b_payload = {
        "email": user_b,
        "password": "Password123!",
        "full_name": "User B",
    }
    client.post("/api/v1/auth/register", json=b_payload)

    allowed_resp = client.post(
        "/api/v1/auth/login",
        json={"email": user_b, "password": "Password123!"},
    )
    assert allowed_resp.status_code == 200
    assert "access_token" in allowed_resp.json()

def test_login_rate_limiting_refreshes_after_window(client):
    from app.core.rate_limiter import login_rate_limiter
    import time

    email = "sliding_window_user@example.com"
    current_fake_time = time.time()

    for _ in range(10):
        login_rate_limiter.check_rate_limit(email, current_time=current_fake_time)

    allowed, _, retry_after = login_rate_limiter.check_rate_limit(email, current_time=current_fake_time)
    assert allowed is False
    assert retry_after > 0

    after_2_hours = current_fake_time + 7201
    allowed_later, remaining, _ = login_rate_limiter.check_rate_limit(email, current_time=after_2_hours)
    assert allowed_later is True
    assert remaining == 9

def test_register_invalid_email_format(client):
    payload = {
        "email": "invalid-email-format",
        "password": "StrongPassword123!",
        "full_name": "Invalid Email User",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code in (400, 422)

def test_send_verification_code_success(client):
    response = client.post(
        "/api/v1/auth/send-verification-code",
        json={"email": "verify_test@example.com"},
    )
    assert response.status_code == 200
    assert "Verification code sent" in response.json()["message"]

def test_send_verification_code_invalid_regex_email(client):
    invalid_emails = ["notanemail", "user@domain", "user@.com", "user@domain.c"]
    for bad_email in invalid_emails:
        resp = client.post(
            "/api/v1/auth/send-verification-code",
            json={"email": bad_email},
        )
        assert resp.status_code in (400, 422)

def test_send_verification_code_existing_email(client):
    init_payload = {
        "email": "pre_existing@example.com",
        "password": "StrongPassword123!",
        "full_name": "Pre Existing",
    }
    client.post("/api/v1/auth/register", json=init_payload)

    response = client.post(
        "/api/v1/auth/send-verification-code",
        json={"email": "pre_existing@example.com"},
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

def test_register_with_verification_code(client, db_session):
    from app.models.verification import EmailVerification

    email = "code_test_user@example.com"
    client.post("/api/v1/auth/send-verification-code", json={"email": email})

    rec = db_session.query(EmailVerification).filter(EmailVerification.email == email).first()
    assert rec is not None

    bad_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "full_name": "Code Test",
            "verification_code": "000000",
        },
    )
    assert bad_resp.status_code == 400
    assert "Invalid verification code" in bad_resp.json()["detail"]

    good_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "full_name": "Code Test",
            "verification_code": rec.code,
        },
    )
    assert good_resp.status_code == 201
    assert "access_token" in good_resp.json()
