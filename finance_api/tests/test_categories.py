def test_list_default_categories(client, auth_headers):
    resp = client.get("/api/v1/categories", headers=auth_headers)
    assert resp.status_code == 200
    categories = resp.json()
    assert len(categories) >= 14

    cat_names = [c["name"] for c in categories]
    assert "Food" in cat_names
    assert "Transport" in cat_names
    assert "Salary" in cat_names
    assert "Freelance" in cat_names

def test_filter_categories_by_type(client, auth_headers):
    resp = client.get("/api/v1/categories?type=expense", headers=auth_headers)
    assert resp.status_code == 200
    for c in resp.json():
        assert c["type"] == "expense"

    resp_inc = client.get("/api/v1/categories?type=income", headers=auth_headers)
    assert resp_inc.status_code == 200
    for c in resp_inc.json():
        assert c["type"] == "income"

def test_create_custom_category(client, auth_headers):
    payload = {"name": "Gym & Fitness", "type": "expense"}
    resp = client.post("/api/v1/categories", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Gym & Fitness"
    assert data["type"] == "expense"
    assert data["is_system"] is False
    assert data["user_id"] is not None

def test_update_custom_category(client, auth_headers):
    create_resp = client.post(
        "/api/v1/categories",
        json={"name": "Gaming", "type": "expense"},
        headers=auth_headers,
    )
    cat_id = create_resp.json()["id"]

    patch_resp = client.patch(
        f"/api/v1/categories/{cat_id}",
        json={"name": "Video Games & Streaming"},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Video Games & Streaming"

def test_prevent_modifying_system_category(client, auth_headers):
    resp = client.get("/api/v1/categories", headers=auth_headers)
    food_cat = next(c for c in resp.json() if c["name"] == "Food")

    patch_resp = client.patch(
        f"/api/v1/categories/{food_cat['id']}",
        json={"name": "Fine Dining"},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 403
    assert "Default system categories cannot be modified" in patch_resp.json()["detail"]

def test_prevent_deleting_system_category(client, auth_headers):
    resp = client.get("/api/v1/categories", headers=auth_headers)
    food_cat = next(c for c in resp.json() if c["name"] == "Food")

    del_resp = client.delete(f"/api/v1/categories/{food_cat['id']}", headers=auth_headers)
    assert del_resp.status_code == 403
    assert "Default system categories cannot be deleted" in del_resp.json()["detail"]

def test_delete_custom_category(client, auth_headers):
    create_resp = client.post(
        "/api/v1/categories",
        json={"name": "Temporary Hobby", "type": "expense"},
        headers=auth_headers,
    )
    cat_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert del_resp.status_code == 200
    assert "successfully deleted" in del_resp.json()["message"]

def test_category_user_isolation(client, auth_headers, other_user_headers):
    create_resp = client.post(
        "/api/v1/categories",
        json={"name": "User A Private Category", "type": "expense"},
        headers=auth_headers,
    )
    cat_id = create_resp.json()["id"]

    user_b_categories = client.get("/api/v1/categories", headers=other_user_headers).json()
    assert not any(c["id"] == cat_id for c in user_b_categories)

    patch_resp = client.patch(
        f"/api/v1/categories/{cat_id}",
        json={"name": "Hacked Category"},
        headers=other_user_headers,
    )
    assert patch_resp.status_code == 404

    del_resp = client.delete(f"/api/v1/categories/{cat_id}", headers=other_user_headers)
    assert del_resp.status_code == 404
