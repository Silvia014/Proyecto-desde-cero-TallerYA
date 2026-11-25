import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from api import main

PASSWORD = "A-testing-password-42"
PDF = b"%PDF-1.7\ntest content"


@pytest.fixture
def case(monkeypatch, tmp_path):
    clock = [1_800_000_000]
    postgres = os.getenv("TALLERYA_TEST_DATABASE_URL")
    if postgres:
        import psycopg
        with psycopg.connect(postgres) as connection:
            assert connection.info.dbname == "tallerya_test", "Use a dedicated tallerya_test database"
            connection.execute("TRUNCATE tallerya.outbox, tallerya.interests, tallerya.bookings, tallerya.workshops, tallerya.users, tallerya.events, tallerya.demo_seed RESTART IDENTITY")
        monkeypatch.setenv("TALLERYA_DATABASE_URL", postgres)
    else:
        monkeypatch.delenv("TALLERYA_DATABASE_URL", raising=False)
    monkeypatch.setenv("TALLERYA_DB", str(tmp_path / "test.sqlite3"))
    monkeypatch.setenv("TALLERYA_JWT_SECRET", "test-secret-" * 4)
    monkeypatch.setattr(main, "now", lambda: clock[0])
    return TestClient(main.app), clock


def account(client, name, role="student", notices=False, locale="es"):
    email = name + "@example.com"
    payload = {"email": email, "password": PASSWORD}
    result = client.post("/register", json=payload | {
        "name": name, "phone": "+576011234567", "locale": locale, "notices": notices, "privacy": True,
    })
    assert result.status_code == 201, result.text
    with main.db() as connection:
        connection.execute("UPDATE users SET role=? WHERE email=?", (role, email))
    result = client.post("/login", json=payload)
    assert result.status_code == 200, result.text
    return {"Authorization": "Bearer " + result.json()["token"]}, result.json()["user"]["id"]


def workshop(client, headers, starts, capacity=1, teacher=None):
    result = client.post("/admin/workshops", headers=headers, json={
        "es": "Cerámica", "en": "Ceramics", "starts": datetime.fromtimestamp(starts, timezone.utc).isoformat(),
        "minutes": 120, "price": 10000, "currency": "COP", "capacity": capacity, "published": True, "teacher": teacher,
    })
    assert result.status_code == 201, result.text
    return result.json()["id"]


def test_booking_concurrency_and_expiry(case):
    client, clock = case
    admin, _ = account(client, "owner", "owner")
    first, _ = account(client, "first")
    second, _ = account(client, "second", locale="en")
    course = workshop(client, admin, clock[0] + 4 * main.DAY)
    path = f"/workshops/{course}/book"
    assert client.post(path).status_code == 401
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda headers: client.post(path, headers=headers), [first, second]))
    assert sorted(r.status_code for r in results) == [201, 409]
    index = next(i for i, item in enumerate(results) if item.status_code == 201)
    booking_id = results[index].json()["id"]
    winner = [first, second][index]
    assert client.post(path, headers=winner).json()["detail"] == "existing_booking"
    with main.db() as connection:
        booking = main.booking_details(connection, booking_id)
        assert booking["deadline"] is None
        mail = connection.execute("SELECT subject,body FROM outbox").fetchone()
        assert mail["subject"] in ("Plaza apartada", "Place held")
        assert "WhatsApp" in mail["body"]
    clock[0] += 120
    sent = client.post(f"/admin/bookings/{booking_id}/payment-sent", headers=admin,
                       json={"payment_url": "https://example.com/checkout"})
    assert sent.json()["deadline"] == clock[0] + main.DAY
    clock[0] += main.DAY
    assert client.get(f"/workshops/{course}").json()["available"] == 1
    assert client.get("/me/bookings", headers=winner).json()[0]["status"] == "expired"


def test_cancellation_consent_and_settlement(case):
    client, clock = case
    admin, _ = account(client, "admin", "owner")
    student, _ = account(client, "student")
    listener, listener_id = account(client, "listener", notices=True, locale="en")
    silent, _ = account(client, "silent")
    starts = clock[0] + 4 * main.DAY
    course = workshop(client, admin, starts)
    for headers in [listener, silent]:
        assert client.post(f"/workshops/{course}/interest", headers=headers).status_code == 204
    booking = client.post(f"/workshops/{course}/book", headers=student).json()["id"]
    path = f"/admin/bookings/{booking}"
    assert client.post(path+"/payment-sent", headers=admin, json={"payment_url":"https://example.com/pay"}).status_code == 200
    assert client.post(path+"/paid", headers=admin).json()["status"] == "confirmed"
    clock[0] = starts - 2 * main.DAY
    assert client.post(f"/me/bookings/{booking}/cancel", headers=student).status_code == 200
    with main.db() as connection:
        alerts = connection.execute("SELECT recipient,locale FROM outbox WHERE kind='available'").fetchall()
        assert [(r["recipient"],r["locale"]) for r in alerts] == [(listener_id,"en")]
    assert client.post(path+"/refund", headers=admin,json={"amount":2000}).status_code == 200
    assert client.get(f"/admin/workshops/{course}/settlement", headers=admin).json() == [
        {"currency":"COP","count":1,"paid":10000,"refunded":2000,"tallerya":1600,"teacher":6400},
    ]
    clock[0] = starts - main.DAY + 1
    assert client.get(f"/workshops/{course}").status_code == 404
    assert client.post(f"/workshops/{course}/book", headers=silent).json()["detail"] == "booking_closed"


def test_permissions_certificates_and_telemetry(case):
    client, clock = case
    admin, _ = account(client, "admin", "owner")
    teacher, teacher_id = account(client, "teacher", "teacher")
    manager, _ = account(client, "manager", "manager")
    student, student_id = account(client, "student")
    other, _ = account(client, "other")
    assert client.post("/login", json={"email":"unknown@example.com","password":PASSWORD}).status_code == 401
    assert client.delete(f"/admin/users/{student_id}", headers=manager).status_code == 403
    assert client.put(f"/admin/users/{student_id}/password", headers=manager, json={"password":PASSWORD}).status_code == 403
    starts = clock[0]+2*main.DAY
    course = workshop(client, admin, starts, teacher=teacher_id)
    workshop(client, admin, starts)
    assert [item["id"] for item in client.get("/admin/workshops", headers=teacher).json()] == [course]
    booking = client.post(f"/workshops/{course}/book", headers=student).json()["id"]
    dest = f"/admin/bookings/{booking}"
    client.post(dest+"/payment-sent", headers=admin, json={"payment_url":"https://example.com/pay"})
    client.post(dest+"/paid", headers=admin)
    clock[0] = starts+7200
    assert client.post(f"/me/bookings/{booking}/cancel",headers=student).json()["detail"] == "cancellation_closed"
    assert client.put(dest+"/certificate", headers=admin|{"content-type":"application/pdf"},content=PDF).status_code == 204
    url = f"/me/bookings/{booking}/certificate"
    assert client.get(url,headers=other).status_code == 404
    assert client.get(url,headers=student).content == PDF
    assert client.post("/telemetry",json={"name":"booking_open","locale":"en","consent":False}).status_code == 422
    assert client.post("/telemetry",json={"name":"booking_open","locale":"en","consent":True}).status_code == 204
    assert client.get("/admin/telemetry",headers=student).status_code == 403
    assert client.get("/admin/telemetry",headers=admin).json()[0]["total"] == 1
    assert client.put(f"/admin/users/{student_id}/password", headers=admin, json={"password":"Replacement-password-123"}).status_code == 204
    assert client.get("/me",headers=student).status_code == 401


def test_owner_can_move_cancel_and_remove_an_unpaid_registration(case):
    client, clock = case
    admin, _ = account(client, "admin", "owner")
    teacher, _ = account(client, "teacher", "teacher")
    student, _ = account(client, "student")
    first = workshop(client, admin, clock[0] + main.DAY * 5)
    second = workshop(client, admin, clock[0] + main.DAY * 6)
    booking = client.post(f"/workshops/{first}/book", headers=student).json()["id"]
    path = f"/admin/bookings/{booking}"
    assert client.get("/admin/bookings", headers=teacher).status_code == 403
    assert client.put(path, headers=teacher, json={"workshop":second}).status_code == 403
    assert client.delete(path, headers=admin).status_code == 409
    assert client.put(path, headers=admin, json={"workshop":second}).status_code == 204
    assert client.get(f"/workshops/{first}").json()["available"] == 1
    assert client.get(f"/workshops/{second}").json()["available"] == 0
    assert client.post(path+"/cancel", headers=admin).status_code == 200
    assert client.delete(path, headers=admin).status_code == 204
    assert client.get("/admin/bookings", headers=admin).json() == []
    assert client.get("/me/bookings", headers=student).json() == []
    assert client.post(f"/admin/workshops/{second}/archive",headers=admin).status_code == 204
    assert client.get(f"/workshops/{second}").status_code == 404
