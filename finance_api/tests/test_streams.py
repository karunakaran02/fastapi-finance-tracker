from datetime import datetime, timezone

def test_create_stream_books_and_isolation(client, auth_headers):
    res_sundar = client.post(
        "/api/v1/streams/books",
        headers=auth_headers,
        json={"title": "Bills", "description": "Sundar operations", "color": "#10b981"},
    )
    assert res_sundar.status_code == 201
    sundar_book = res_sundar.json()
    assert sundar_book["title"] == "Bills"
    assert sundar_book["net_balance"] == "0.00"

    res_karun = client.post(
        "/api/v1/streams/books",
        headers=auth_headers,
        json={"title": "shopping", "description": "shopping records", "color": "#3b82f6"},
    )
    assert res_karun.status_code == 201
    karun_book = res_karun.json()
    assert karun_book["title"] == "shopping"
    assert karun_book["net_balance"] == "0.00"

    entry1 = client.post(
        f"/api/v1/streams/books/{sundar_book['id']}/entries",
        headers=auth_headers,
        json={
            "type": "IN",
            "amount": "400.00",
            "remarks": "Project consultation fee",
            "category": "Consulting",
            "entry_date": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert entry1.status_code == 201
    assert entry1.json()["amount"] == "400.00"

    entry2 = client.post(
        f"/api/v1/streams/books/{karun_book['id']}/entries",
        headers=auth_headers,
        json={
            "type": "IN",
            "amount": "200.00",
            "remarks": "Web service income",
            "category": "Development",
            "entry_date": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert entry2.status_code == 201
    assert entry2.json()["amount"] == "200.00"

    res_sundar_detail = client.get(
        f"/api/v1/streams/books/{sundar_book['id']}",
        headers=auth_headers,
    )
    assert res_sundar_detail.status_code == 200
    sundar_stat = res_sundar_detail.json()
    assert sundar_stat["total_income"] == "400.00"
    assert sundar_stat["total_expense"] == "0.00"
    assert sundar_stat["net_balance"] == "400.00"
    assert sundar_stat["entries_count"] == 1

    res_karun_detail = client.get(
        f"/api/v1/streams/books/{karun_book['id']}",
        headers=auth_headers,
    )
    assert res_karun_detail.status_code == 200
    karun_stat = res_karun_detail.json()
    assert karun_stat["total_income"] == "200.00"
    assert karun_stat["total_expense"] == "0.00"
    assert karun_stat["net_balance"] == "200.00"
    assert karun_stat["entries_count"] == 1

    sundar_entries = client.get(
        f"/api/v1/streams/books/{sundar_book['id']}/entries",
        headers=auth_headers,
    ).json()
    assert sundar_entries["total"] == 1
    assert sundar_entries["items"][0]["amount"] == "400.00"

    karun_entries = client.get(
        f"/api/v1/streams/books/{karun_book['id']}/entries",
        headers=auth_headers,
    ).json()
    assert karun_entries["total"] == 1
    assert karun_entries["items"][0]["amount"] == "200.00"

def test_stream_running_balance_and_export(client, auth_headers):
    res_book = client.post(
        "/api/v1/streams/books",
        headers=auth_headers,
        json={"title": "Agriculture", "description": "Farm ledger"},
    )
    book_id = res_book.json()["id"]

    client.post(
        f"/api/v1/streams/books/{book_id}/entries",
        headers=auth_headers,
        json={
            "type": "IN",
            "amount": "1000.00",
            "remarks": "Paddy harvest advance",
            "category": "Harvest",
            "entry_date": "2026-10-01T10:00:00Z",
        },
    )

    client.post(
        f"/api/v1/streams/books/{book_id}/entries",
        headers=auth_headers,
        json={
            "type": "OUT",
            "amount": "300.00",
            "remarks": "Fertilizer purchase",
            "category": "Supplies",
            "entry_date": "2026-10-05T10:00:00Z",
        },
    )

    client.post(
        f"/api/v1/streams/books/{book_id}/entries",
        headers=auth_headers,
        json={
            "type": "OUT",
            "amount": "150.00",
            "remarks": "Tractor diesel",
            "category": "Fuel",
            "entry_date": "2026-10-08T10:00:00Z",
        },
    )

    entries_resp = client.get(
        f"/api/v1/streams/books/{book_id}/entries",
        headers=auth_headers,
    )
    assert entries_resp.status_code == 200
    data = entries_resp.json()
    assert data["total"] == 3
    assert data["total_income"] == "1000.00"
    assert data["total_expense"] == "450.00"
    assert data["net_balance"] == "550.00"

    export_resp = client.get(
        f"/api/v1/streams/books/{book_id}/export",
        headers=auth_headers,
    )
    assert export_resp.status_code == 200
    assert "text/csv" in export_resp.headers["content-type"]
    assert "Agriculture" in export_resp.text
    assert "Fertilizer purchase" in export_resp.text

    export_pdf_resp = client.get(
        f"/api/v1/streams/books/{book_id}/export?format=pdf",
        headers=auth_headers,
    )
    assert export_pdf_resp.status_code == 200
    assert "application/pdf" in export_pdf_resp.headers["content-type"]
    assert export_pdf_resp.content.startswith(b"%PDF")

def test_update_and_delete_stream_book(client, auth_headers):
    res_book = client.post(
        "/api/v1/streams/books",
        headers=auth_headers,
        json={"title": "Draft Book"},
    )
    book_id = res_book.json()["id"]

    res_patch = client.patch(
        f"/api/v1/streams/books/{book_id}",
        headers=auth_headers,
        json={"title": "Renamed Book", "color": "#ef4444"},
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["title"] == "Renamed Book"
    assert res_patch.json()["color"] == "#ef4444"

    res_del = client.delete(
        f"/api/v1/streams/books/{book_id}",
        headers=auth_headers,
    )
    assert res_del.status_code == 200

    res_get = client.get(
        f"/api/v1/streams/books/{book_id}",
        headers=auth_headers,
    )
    assert res_get.status_code == 404
