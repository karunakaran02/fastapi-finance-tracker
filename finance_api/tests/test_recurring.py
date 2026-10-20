from datetime import datetime, timedelta, timezone
from decimal import Decimal

def get_category_id(client, headers, name: str, cat_type: str = "expense") -> int:
    resp = client.get("/api/v1/categories", headers=headers)
    assert resp.status_code == 200
    for cat in resp.json():
        if cat["type"] == cat_type and name.lower() in cat["name"].lower():
            return cat["id"]
    for cat in resp.json():
        if cat["type"] == cat_type:
            return cat["id"]
    return resp.json()[0]["id"]

def test_create_and_read_recurring(client, auth_headers):
    cat_id = get_category_id(client, auth_headers, "Entertainment")
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()

    payload = {
        "name": "Netflix Premium",
        "type": "expense",
        "amount": "19.99",
        "frequency": "monthly",
        "next_due_date": future_date,
        "category_id": cat_id,
        "auto_log": False,
        "notes": "4K Family Plan",
    }
    resp = client.post("/api/v1/recurring", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Netflix Premium"
    assert Decimal(str(data["amount"])) == Decimal("19.99")
    assert data["frequency"] == "monthly"
    assert data["status"] == "active"
    assert data["days_until_due"] in [4, 5, 6]
    item_id = data["id"]

    list_resp = client.get("/api/v1/recurring", headers=auth_headers)
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert any(i["id"] == item_id for i in items)

def test_update_and_delete_recurring(client, auth_headers):
    future_date = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    payload = {
        "name": "Cloud Storage",
        "type": "expense",
        "amount": "9.99",
        "frequency": "monthly",
        "next_due_date": future_date,
    }
    create_resp = client.post("/api/v1/recurring", json=payload, headers=auth_headers)
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]

    update_payload = {
        "amount": "12.99",
        "status": "paused",
        "notes": "Upgraded to 2TB",
    }
    up_resp = client.put(f"/api/v1/recurring/{item_id}", json=update_payload, headers=auth_headers)
    assert up_resp.status_code == 200
    up_data = up_resp.json()
    assert Decimal(str(up_data["amount"])) == Decimal("12.99")
    assert up_data["status"] == "paused"
    assert up_data["notes"] == "Upgraded to 2TB"

    del_resp = client.delete(f"/api/v1/recurring/{item_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    get_resp = client.get(f"/api/v1/recurring/{item_id}", headers=auth_headers)
    assert get_resp.status_code == 404

def test_cash_runway_forecast(client, auth_headers):
    cat_id = get_category_id(client, auth_headers, "Salary", cat_type="income")

    tx_resp = client.post(
        "/api/v1/transactions",
        json={
            "category_id": cat_id,
            "type": "income",
            "amount": "5000.00",
            "description": "Base salary deposit",
            "transaction_date": datetime.now(timezone.utc).isoformat(),
        },
        headers=auth_headers,
    )
    future_rent = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    rec_resp = client.post(
        "/api/v1/recurring",
        json={
            "name": "Apartment Rent",
            "type": "expense",
            "amount": "1200.00",
            "frequency": "monthly",
            "next_due_date": future_rent,
        },
        headers=auth_headers,
    )
    assert rec_resp.status_code == 201

    forecast_resp = client.get("/api/v1/recurring/forecast?days=30", headers=auth_headers)
    assert forecast_resp.status_code == 200
    forecast = forecast_resp.json()

    assert forecast["days_forecasted"] == 30
    assert Decimal(str(forecast["current_liquid_balance"])) >= Decimal("5000.00")
    assert Decimal(str(forecast["monthly_recurring_burn"])) >= Decimal("1200.00")
    assert len(forecast["daily_timeline"]) == 30
    assert len(forecast["upcoming_milestones"]) >= 1
    assert forecast["upcoming_7_days_count"] >= 1
    assert Decimal(str(forecast["upcoming_7_days_total"])) >= Decimal("1200.00")

def test_recurring_suggestions(client, auth_headers):
    cat_id = get_category_id(client, auth_headers, "Entertainment")
    t1 = datetime.now(timezone.utc) - timedelta(days=62)
    t2 = datetime.now(timezone.utc) - timedelta(days=32)
    t3 = datetime.now(timezone.utc) - timedelta(days=2)

    for dt in [t1, t2, t3]:
        client.post(
            "/api/v1/transactions",
            json={
                "category_id": cat_id,
                "type": "expense",
                "amount": "14.99",
                "description": "Spotify Premium Individual",
                "transaction_date": dt.isoformat(),
            },
            headers=auth_headers,
        )

    sug_resp = client.get("/api/v1/recurring/suggestions", headers=auth_headers)
    assert sug_resp.status_code == 200
    suggestions = sug_resp.json()

    assert any("spotify" in s["name"].lower() for s in suggestions)
    match = next(s for s in suggestions if "spotify" in s["name"].lower())
    assert Decimal(str(match["detected_amount"])) == Decimal("14.99")
    assert match["frequency"] == "monthly"
    assert match["occurrences_count"] >= 2
