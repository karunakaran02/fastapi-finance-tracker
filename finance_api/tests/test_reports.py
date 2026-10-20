from decimal import Decimal

def get_category_id(client, headers, name: str) -> int:
    resp = client.get("/api/v1/categories", headers=headers)
    for cat in resp.json():
        if cat["name"] == name:
            return cat["id"]
    raise ValueError(f"Category {name} not found")

def test_dashboard_analytics_calculations(client, auth_headers):
    salary_cat_id = get_category_id(client, auth_headers, "Salary")
    food_cat_id = get_category_id(client, auth_headers, "Food")
    bills_cat_id = get_category_id(client, auth_headers, "Bills")
    transport_cat_id = get_category_id(client, auth_headers, "Transport")

    client.post(
        "/api/v1/transactions",
        json={
            "category_id": salary_cat_id,
            "type": "income",
            "amount": "5200.00",
            "description": "Primary Salary",
            "transaction_date": "2026-10-01T10:00:00Z",
        },
        headers=auth_headers,
    )

    client.post(
        "/api/v1/transactions",
        json={
            "category_id": food_cat_id,
            "type": "expense",
            "amount": "1200.00",
            "description": "Monthly Groceries & Dining",
            "transaction_date": "2026-10-02T12:00:00Z",
        },
        headers=auth_headers,
    )
    client.post(
        "/api/v1/transactions",
        json={
            "category_id": bills_cat_id,
            "type": "expense",
            "amount": "1000.00",
            "description": "Rent and Utilities",
            "transaction_date": "2026-10-03T14:00:00Z",
        },
        headers=auth_headers,
    )
    client.post(
        "/api/v1/transactions",
        json={
            "category_id": transport_cat_id,
            "type": "expense",
            "amount": "900.00",
            "description": "Car Lease and Fuel",
            "transaction_date": "2026-10-04T16:00:00Z",
        },
        headers=auth_headers,
    )

    resp = client.get("/api/v1/reports/dashboard", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert Decimal(data["total_income"]) >= Decimal("5200.00")
    assert Decimal(data["total_expenses"]) >= Decimal("3100.00")
    assert Decimal(data["net_balance"]) == Decimal(data["total_income"]) - Decimal(data["total_expenses"])

    assert len(data["spending_by_category"]) > 0
    cat_names = [c["category_name"] for c in data["spending_by_category"]]
    assert "Food" in cat_names
    assert "Bills" in cat_names
    assert "Transport" in cat_names

    assert len(data["recent_transactions"]) <= 5
    assert len(data["recent_transactions"]) > 0

def test_monthly_trends_report(client, auth_headers):
    resp = client.get("/api/v1/reports/monthly?months=6", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "months" in data
    assert len(data["months"]) == 6
    assert "summary_income" in data
    assert "summary_expenses" in data
    assert "summary_net" in data
    assert "average_savings_rate" in data

    for m in data["months"]:
        assert "month" in m
        assert "month_name" in m
        assert "income" in m
        assert "expenses" in m
        assert "net_savings" in m
        assert "savings_rate" in m

def test_categories_distribution_report(client, auth_headers):
    resp = client.get("/api/v1/reports/categories?type=expense", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "categories" in data
    assert "total_amount" in data
    if len(data["categories"]) > 0:
        total_pct = sum(c["percentage"] for c in data["categories"])
        assert 99.0 <= total_pct <= 101.0

def test_reports_user_isolation(client, other_user_headers):
    resp = client.get("/api/v1/reports/dashboard", headers=other_user_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert Decimal(data["total_income"]) == Decimal("0.00")
    assert Decimal(data["total_expenses"]) == Decimal("0.00")
    assert Decimal(data["net_balance"]) == Decimal("0.00")
    assert data["savings_rate"] == 0.0
    assert len(data["spending_by_category"]) == 0
    assert len(data["recent_transactions"]) == 0
