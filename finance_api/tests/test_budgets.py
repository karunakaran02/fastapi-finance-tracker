from decimal import Decimal


def get_category_id(client, headers, name: str) -> int:
    resp = client.get("/api/v1/categories", headers=headers)
    assert resp.status_code == 200
    for cat in resp.json():
        if cat["name"].lower() == name.lower():
            return cat["id"]
    return resp.json()[0]["id"]


def test_create_and_read_budget(client, auth_headers):
    food_id = get_category_id(client, auth_headers, "Food")

    payload = {
        "name": "Food & Dining Cap",
        "type": "expense",
        "category_id": food_id,
        "threshold_amount": "500.00",
        "period": "monthly",
        "is_active": True,
    }
    create_resp = client.post("/api/v1/budgets", json=payload, headers=auth_headers)
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["name"] == "Food & Dining Cap"
    assert Decimal(str(created["threshold_amount"])) == Decimal("500.00")
    assert created["percentage_used"] == 0.0
    assert created["status"] == "safe"
    assert created["is_exceeded"] is False
    budget_id = created["id"]

    tx_resp = client.post(
        "/api/v1/transactions",
        json={
            "category_id": food_id,
            "type": "expense",
            "amount": "450.00",
            "description": "Weekly grocery shopping",
            "transaction_date": "2026-10-10T12:00:00Z",
        },
        headers=auth_headers,
    )
    assert tx_resp.status_code == 201

    list_resp = client.get("/api/v1/budgets", headers=auth_headers)
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) >= 1
    budget_item = next(b for b in items if b["id"] == budget_id)
    assert Decimal(str(budget_item["current_amount"])) == Decimal("450.00")
    assert budget_item["percentage_used"] == 90.0
    assert budget_item["status"] == "warning"
    assert budget_item["is_exceeded"] is False

    tx2_resp = client.post(
        "/api/v1/transactions",
        json={
            "category_id": food_id,
            "type": "expense",
            "amount": "100.00",
            "description": "Restaurant dinner",
            "transaction_date": "2026-10-12T19:00:00Z",
        },
        headers=auth_headers,
    )
    assert tx2_resp.status_code == 201

    list_resp2 = client.get("/api/v1/budgets", headers=auth_headers)
    budget_item2 = next(b for b in list_resp2.json() if b["id"] == budget_id)
    assert Decimal(str(budget_item2["current_amount"])) == Decimal("550.00")
    assert budget_item2["percentage_used"] == 110.0
    assert budget_item2["status"] == "exceeded"
    assert budget_item2["is_exceeded"] is True
    assert Decimal(str(budget_item2["remaining_amount"])) == Decimal("0.00")


def test_budget_overview_analytics(client, auth_headers):
    overview_resp = client.get("/api/v1/budgets/overview", headers=auth_headers)
    assert overview_resp.status_code == 200
    data = overview_resp.json()
    assert "total_budgets" in data
    assert "active_budgets" in data
    assert "total_budgeted_expense" in data
    assert "total_spent_in_budgeted" in data
    assert "exceeded_budgets" in data
    assert "warning_budgets" in data
    assert "budgets" in data


def test_budget_update_and_delete(client, auth_headers):
    create_resp = client.post(
        "/api/v1/budgets",
        json={
            "name": "Temporary Limit",
            "type": "expense",
            "threshold_amount": "150.00",
            "period": "monthly",
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    budget_id = create_resp.json()["id"]

    update_resp = client.patch(
        f"/api/v1/budgets/{budget_id}",
        json={"threshold_amount": "300.00", "name": "Updated Limit"},
        headers=auth_headers,
    )
    assert update_resp.status_code == 200
    assert Decimal(str(update_resp.json()["threshold_amount"])) == Decimal("300.00")
    assert update_resp.json()["name"] == "Updated Limit"

    del_resp = client.delete(f"/api/v1/budgets/{budget_id}", headers=auth_headers)
    assert del_resp.status_code == 200

    list_resp = client.get("/api/v1/budgets", headers=auth_headers)
    assert not any(b["id"] == budget_id for b in list_resp.json())


def test_budget_user_data_isolation(client, auth_headers, other_user_headers):
    resp = client.post(
        "/api/v1/budgets",
        json={"name": "User 1 Budget", "type": "expense", "threshold_amount": "1000.00"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    u1_budget_id = resp.json()["id"]

    u2_list = client.get("/api/v1/budgets", headers=other_user_headers)
    assert u2_list.status_code == 200
    assert not any(b["id"] == u1_budget_id for b in u2_list.json())

    u2_update = client.patch(
        f"/api/v1/budgets/{u1_budget_id}",
        json={"threshold_amount": "2000.00"},
        headers=other_user_headers,
    )
    assert u2_update.status_code == 404


def test_test_alert_endpoint(client, auth_headers):
    b_resp = client.post(
        "/api/v1/budgets",
        json={"name": "Alert Test Budget", "type": "expense", "threshold_amount": "200.00"},
        headers=auth_headers,
    )
    assert b_resp.status_code == 201
    budget_id = b_resp.json()["id"]

    alert_resp = client.post(f"/api/v1/budgets/{budget_id}/test-alert", headers=auth_headers)
    assert alert_resp.status_code == 200
    assert "Test alert" in alert_resp.json()["message"]

    notif_resp = client.get("/api/v1/budgets/notifications", headers=auth_headers)
    assert notif_resp.status_code == 200
    notifications = notif_resp.json()
    assert len(notifications) >= 1
    assert any(n["budget_id"] == budget_id for n in notifications)
