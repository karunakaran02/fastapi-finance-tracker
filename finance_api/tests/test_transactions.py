def get_default_category_id(client, headers, name: str) -> int:
    resp = client.get("/api/v1/categories", headers=headers)
    for cat in resp.json():
        if cat["name"] == name:
            return cat["id"]
    raise ValueError(f"Category {name} not found")

def test_create_income_transaction(client, auth_headers):
    salary_cat_id = get_default_category_id(client, auth_headers, "Salary")
    payload = {
        "category_id": salary_cat_id,
        "type": "income",
        "amount": "5200.00",
        "description": "Monthly Salary October",
        "transaction_date": "2026-10-01T09:00:00Z",
    }
    resp = client.post("/api/v1/transactions", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["amount"] == "5200.00"
    assert data["type"] == "income"
    assert data["category_name"] == "Salary"
    assert data["description"] == "Monthly Salary October"

def test_create_expense_transaction(client, auth_headers):
    food_cat_id = get_default_category_id(client, auth_headers, "Food")
    payload = {
        "category_id": food_cat_id,
        "type": "expense",
        "amount": "85.50",
        "description": "Grocery shopping at Trader Joe's",
        "transaction_date": "2026-10-02T14:30:00Z",
    }
    resp = client.post("/api/v1/transactions", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["amount"] == "85.50"
    assert data["type"] == "expense"
    assert data["category_name"] == "Food"

def test_category_type_mismatch_validation(client, auth_headers):
    food_cat_id = get_default_category_id(client, auth_headers, "Food")
    payload = {
        "category_id": food_cat_id,
        "type": "income",
        "amount": "100.00",
        "description": "Invalid income in expense category",
        "transaction_date": "2026-10-02T14:30:00Z",
    }
    resp = client.post("/api/v1/transactions", json=payload, headers=auth_headers)
    assert resp.status_code == 400
    assert "does not match transaction type" in resp.json()["detail"]

def test_create_transaction_invalid_category(client, auth_headers):
    payload = {
        "category_id": 999999,
        "type": "expense",
        "amount": "50.00",
        "description": "Invalid category",
        "transaction_date": "2026-10-02T14:30:00Z",
    }
    resp = client.post("/api/v1/transactions", json=payload, headers=auth_headers)
    assert resp.status_code == 404

def test_create_transaction_negative_amount(client, auth_headers):
    food_cat_id = get_default_category_id(client, auth_headers, "Food")
    payload = {
        "category_id": food_cat_id,
        "type": "expense",
        "amount": "-50.00",
        "description": "Negative amount",
        "transaction_date": "2026-10-02T14:30:00Z",
    }
    resp = client.post("/api/v1/transactions", json=payload, headers=auth_headers)
    assert resp.status_code == 422

def test_get_single_transaction(client, auth_headers):
    food_cat_id = get_default_category_id(client, auth_headers, "Food")
    create_resp = client.post(
        "/api/v1/transactions",
        json={
            "category_id": food_cat_id,
            "type": "expense",
            "amount": "45.00",
            "description": "Lunch meeting",
            "transaction_date": "2026-10-03T12:00:00Z",
        },
        headers=auth_headers,
    )
    tx_id = create_resp.json()["id"]

    resp = client.get(f"/api/v1/transactions/{tx_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == tx_id
    assert resp.json()["amount"] == "45.00"

def test_update_transaction(client, auth_headers):
    bills_cat_id = get_default_category_id(client, auth_headers, "Bills")
    create_resp = client.post(
        "/api/v1/transactions",
        json={
            "category_id": bills_cat_id,
            "type": "expense",
            "amount": "120.00",
            "description": "Internet bill",
            "transaction_date": "2026-10-04T10:00:00Z",
        },
        headers=auth_headers,
    )
    tx_id = create_resp.json()["id"]

    patch_resp = client.patch(
        f"/api/v1/transactions/{tx_id}",
        json={"amount": "135.50", "description": "High-speed Fiber Internet bill"},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["amount"] == "135.50"
    assert patch_resp.json()["description"] == "High-speed Fiber Internet bill"

def test_delete_transaction(client, auth_headers):
    transport_cat_id = get_default_category_id(client, auth_headers, "Transport")
    create_resp = client.post(
        "/api/v1/transactions",
        json={
            "category_id": transport_cat_id,
            "type": "expense",
            "amount": "15.00",
            "description": "Subway ticket",
            "transaction_date": "2026-10-05T08:00:00Z",
        },
        headers=auth_headers,
    )
    tx_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/v1/transactions/{tx_id}", headers=auth_headers)
    assert del_resp.status_code == 200

    get_resp = client.get(f"/api/v1/transactions/{tx_id}", headers=auth_headers)
    assert get_resp.status_code == 404

def test_transaction_search_and_filtering(client, auth_headers):
    food_cat_id = get_default_category_id(client, auth_headers, "Food")
    transport_cat_id = get_default_category_id(client, auth_headers, "Transport")

    client.post(
        "/api/v1/transactions",
        json={
            "category_id": food_cat_id,
            "type": "expense",
            "amount": "25.00",
            "description": "Sushi express dinner",
            "transaction_date": "2026-09-15T19:00:00Z",
        },
        headers=auth_headers,
    )
    client.post(
        "/api/v1/transactions",
        json={
            "category_id": transport_cat_id,
            "type": "expense",
            "amount": "55.00",
            "description": "Uber ride to airport",
            "transaction_date": "2026-09-20T07:00:00Z",
        },
        headers=auth_headers,
    )

    search_resp = client.get("/api/v1/transactions?search=sushi", headers=auth_headers)
    assert search_resp.status_code == 200
    assert any("Sushi" in t["description"] for t in search_resp.json()["items"])

    search_cat_resp = client.get("/api/v1/transactions?search=Transport", headers=auth_headers)
    assert search_cat_resp.status_code == 200
    assert any(t["category_name"] == "Transport" for t in search_cat_resp.json()["items"])

    search_amt_resp = client.get("/api/v1/transactions?search=55.00", headers=auth_headers)
    assert search_amt_resp.status_code == 200
    assert any("55.00" in str(t["amount"]) for t in search_amt_resp.json()["items"])

    cat_resp = client.get(f"/api/v1/transactions?category_id={transport_cat_id}", headers=auth_headers)
    assert cat_resp.status_code == 200
    for item in cat_resp.json()["items"]:
        assert item["category_id"] == transport_cat_id

    date_resp = client.get(
        "/api/v1/transactions?start_date=2026-09-01T00:00:00Z&end_date=2026-09-30T23:59:59Z",
        headers=auth_headers,
    )
    assert date_resp.status_code == 200
    assert date_resp.json()["total"] >= 2

    inverted_resp = client.get(
        "/api/v1/transactions?start_date=2026-09-30T23:59:59Z&end_date=2026-09-01T00:00:00Z",
        headers=auth_headers,
    )
    assert inverted_resp.status_code == 200
    assert inverted_resp.json()["total"] >= 2

    single_day_resp = client.get(
        "/api/v1/transactions?start_date=2026-09-20T00:00:00Z&end_date=2026-09-20T00:00:00Z",
        headers=auth_headers,
    )
    assert single_day_resp.status_code == 200
    assert any("Uber" in t["description"] for t in single_day_resp.json()["items"])

def test_transaction_pagination_and_sorting(client, auth_headers):
    food_cat_id = get_default_category_id(client, auth_headers, "Food")
    for i in range(1, 15):
        client.post(
            "/api/v1/transactions",
            json={
                "category_id": food_cat_id,
                "type": "expense",
                "amount": f"{10.0 + i:.2f}",
                "description": f"Test Pagination Expense #{i}",
                "transaction_date": f"2026-10-{i:02d}T10:00:00Z",
            },
            headers=auth_headers,
        )

    page1 = client.get("/api/v1/transactions?page=1&page_size=5&sort=amount_desc", headers=auth_headers).json()
    assert len(page1["items"]) == 5
    assert page1["page"] == 1
    assert page1["page_size"] == 5
    assert page1["total"] >= 14

    amounts = [float(item["amount"]) for item in page1["items"]]
    assert amounts == sorted(amounts, reverse=True)

def test_transaction_user_data_isolation(client, auth_headers, other_user_headers):
    salary_cat_id = get_default_category_id(client, auth_headers, "Salary")

    tx_resp = client.post(
        "/api/v1/transactions",
        json={
            "category_id": salary_cat_id,
            "type": "income",
            "amount": "9999.00",
            "description": "User A Top Secret Income",
            "transaction_date": "2026-10-01T10:00:00Z",
        },
        headers=auth_headers,
    )
    user_a_tx_id = tx_resp.json()["id"]

    get_resp = client.get(f"/api/v1/transactions/{user_a_tx_id}", headers=other_user_headers)
    assert get_resp.status_code == 404

    patch_resp = client.patch(
        f"/api/v1/transactions/{user_a_tx_id}",
        json={"amount": "1.00"},
        headers=other_user_headers,
    )
    assert patch_resp.status_code == 404

    del_resp = client.delete(f"/api/v1/transactions/{user_a_tx_id}", headers=other_user_headers)
    assert del_resp.status_code == 404

    user_b_list = client.get("/api/v1/transactions", headers=other_user_headers).json()
    assert not any(t["id"] == user_a_tx_id for t in user_b_list["items"])

def test_transaction_stream_book_integration(client, auth_headers):
    book_resp = client.post(
        "/api/v1/streams/books",
        json={
            "title": "Alpha Operations Book",
            "description": "Integration testing stream book",
            "color": "#10b981",
            "icon": "wallet",
        },
        headers=auth_headers,
    )
    assert book_resp.status_code == 201
    book_id = book_resp.json()["id"]

    salary_cat_id = get_default_category_id(client, auth_headers, "Salary")
    tx_resp = client.post(
        "/api/v1/transactions",
        json={
            "category_id": salary_cat_id,
            "book_id": book_id,
            "type": "income",
            "amount": "14500.00",
            "description": "Alpha Consulting Retainer",
            "transaction_date": "2026-10-15T10:00:00Z",
        },
        headers=auth_headers,
    )
    assert tx_resp.status_code == 201
    tx_data = tx_resp.json()
    assert tx_data["book_id"] == book_id
    assert tx_data["book_title"] == "Alpha Operations Book"
    tx_id = tx_data["id"]

    entries_resp = client.get(f"/api/v1/streams/books/{book_id}/entries", headers=auth_headers)
    assert entries_resp.status_code == 200
    entries_data = entries_resp.json()
    assert entries_data["total"] >= 1
    found_entry = next((e for e in entries_data["items"] if float(e["amount"]) == 14500.0), None)
    assert found_entry is not None
    assert found_entry["type"] == "IN"
    assert found_entry["remarks"] == "Alpha Consulting Retainer"

    patch_resp = client.patch(
        f"/api/v1/transactions/{tx_id}",
        json={"amount": "16000.00", "description": "Alpha Consulting Retainer Revised"},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200

    entries_after_patch = client.get(f"/api/v1/streams/books/{book_id}/entries", headers=auth_headers).json()
    updated_entry = next((e for e in entries_after_patch["items"] if e["id"] == found_entry["id"]), None)
    assert updated_entry is not None
    assert float(updated_entry["amount"]) == 16000.0
    assert updated_entry["remarks"] == "Alpha Consulting Retainer Revised"

    del_tx_resp = client.delete(f"/api/v1/transactions/{tx_id}", headers=auth_headers)
    assert del_tx_resp.status_code == 200

    entries_after_del = client.get(f"/api/v1/streams/books/{book_id}/entries", headers=auth_headers).json()
    assert not any(e["id"] == found_entry["id"] for e in entries_after_del["items"])
