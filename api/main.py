import os
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal

import jwt
from contextlib import asynccontextmanager
import pandas as pd
from fastapi import Body, Depends, FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from pydantic import AwareDatetime, BaseModel, EmailStr, Field, HttpUrl

@asynccontextmanager
async def lifespan(_):
    if os.getenv("TALLERYA_DEMO") == "1":
        from api.demo import seed
        seed()
    else:
        with db() as connection:
            if connection.execute("SELECT 1 FROM demo_seed").fetchone():
                raise RuntimeError("Use a separate database for production")
    yield


app = FastAPI(title="TallerYA", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}
passwords = PasswordHash.recommended()
dummy_password = passwords.hash("unused-placeholder-password")
bearer = HTTPBearer(auto_error=False)
privacy_version = "1"
DAY = 86400
ACTIVE = "'hold','payment','confirmed'"
schema = """
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
 phone TEXT NOT NULL, password TEXT NOT NULL, locale TEXT NOT NULL,
 notices INTEGER NOT NULL, privacy TEXT NOT NULL, accepted INTEGER NOT NULL,
 role TEXT NOT NULL DEFAULT 'student', version INTEGER NOT NULL DEFAULT 0,
 deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS one_owner ON users(role) WHERE role='owner';
CREATE TABLE IF NOT EXISTS workshops (
 id INTEGER PRIMARY KEY, es TEXT NOT NULL, en TEXT NOT NULL,
 starts INTEGER NOT NULL, minutes INTEGER NOT NULL, price INTEGER NOT NULL,
 currency TEXT NOT NULL, capacity INTEGER NOT NULL, published INTEGER NOT NULL,
 teacher INTEGER REFERENCES users(id), venue TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS bookings (
 id INTEGER PRIMARY KEY, workshop INTEGER NOT NULL REFERENCES workshops(id),
 user INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL,
 price INTEGER NOT NULL, currency TEXT NOT NULL, paid INTEGER NOT NULL DEFAULT 0,
 refund INTEGER NOT NULL DEFAULT 0, refunded INTEGER NOT NULL DEFAULT 0,
 deadline INTEGER, payment_url TEXT, sent INTEGER, certificate BLOB
);
CREATE UNIQUE INDEX IF NOT EXISTS one_place ON bookings(workshop,user)
 WHERE status IN ('hold','payment','confirmed');
CREATE TABLE IF NOT EXISTS interests (
 workshop INTEGER REFERENCES workshops(id), user INTEGER REFERENCES users(id),
 PRIMARY KEY(workshop,user)
);
CREATE TABLE IF NOT EXISTS outbox (
 id INTEGER PRIMARY KEY, dedupe TEXT UNIQUE NOT NULL, recipient INTEGER NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL, workshop INTEGER NOT NULL, locale TEXT NOT NULL,
 subject TEXT NOT NULL, body TEXT NOT NULL, sent INTEGER
);
CREATE TABLE IF NOT EXISTS demo_seed (marker INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, locale TEXT NOT NULL, happened INTEGER NOT NULL
);
"""


def now():
    return int(time.time())


@contextmanager
def db():
    if url := os.getenv("TALLERYA_DATABASE_URL"):
        from api.postgres import postgres_db
        with postgres_db(url) as connection:
            yield connection
        return
    connection = sqlite3.connect(os.getenv("TALLERYA_DB", "tallerya.sqlite3"), timeout=15)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA foreign_keys=ON")
        connection.executescript(schema)
        connection.execute("BEGIN IMMEDIATE")
        if "venue" not in {column[1] for column in connection.execute("PRAGMA table_info(workshops)")}:
            connection.execute("ALTER TABLE workshops ADD COLUMN venue TEXT NOT NULL DEFAULT ''")
        yield connection
        connection.commit()
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()


def find(connection, sql, args=()):
    row = connection.execute(sql, args).fetchone()
    if row is None:
        raise HTTPException(404, "not_found")
    return row


def conflict(condition, reason):
    if condition:
        raise HTTPException(409, reason)


def key():
    secret = os.getenv("TALLERYA_JWT_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(503, "jwt_not_configured")
    return secret


def current(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if credentials is None:
        raise HTTPException(401, "sign_in_required")
    try:
        claims = jwt.decode(credentials.credentials, key(), algorithms=["HS256"], audience="tallerya",
                            options={"require": ["sub", "exp", "v"]})
    except jwt.InvalidTokenError:
        raise HTTPException(401, "invalid_session") from None
    with db() as connection:
        user = connection.execute("SELECT * FROM users WHERE id=? AND deleted=0", (claims["sub"],)).fetchone()
    if user is None or user["version"] != claims["v"]:
        raise HTTPException(401, "invalid_session")
    return user


def staff(user=Depends(current)):
    if user["role"] not in ("owner", "manager"):
        raise HTTPException(403, "staff_only")
    return user


def owner(user=Depends(current)):
    if user["role"] != "owner":
        raise HTTPException(403, "owner_only")
    return user


class Login(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class Signup(Login):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(pattern=r"^\+?[0-9 ()-]{7,24}$")
    locale: Literal["es", "en"] = "es"
    notices: bool = False
    privacy: Literal[True]


class Workshop(BaseModel):
    es: str = Field(min_length=1, max_length=160)
    en: str = Field(min_length=1, max_length=160)
    starts: AwareDatetime
    minutes: int = Field(gt=0, le=14400)
    price: int = Field(gt=0)
    currency: Literal["COP", "USD", "EUR"] = "COP"
    capacity: int = Field(gt=0, le=10000)
    published: bool = False
    teacher: int | None = None
    venue: str = Field(default="", max_length=180)


class Sent(BaseModel):
    payment_url: HttpUrl


class Refund(BaseModel):
    amount: int = Field(gt=0)


class PasswordChange(BaseModel):
    password: str = Field(min_length=12, max_length=128)


class RoleChange(BaseModel):
    role: Literal["student", "teacher", "manager"]


class Event(BaseModel):
    name: Literal["catalog_view", "booking_open", "recordings_open", "learn_open"]
    locale: Literal["es", "en"]
    consent: Literal[True]


def public_user(user):
    return {field: user[field] for field in ("id", "name", "email", "phone", "locale", "notices", "role")}


@app.post("/register", status_code=201)
def register(request: Signup):
    hashed = passwords.hash(request.password)
    with db() as connection:
        email = request.email.lower()
        conflict(connection.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone(), "email_in_use")
        connection.execute(
            "INSERT INTO users(name,email,phone,password,locale,notices,privacy,accepted) VALUES(?,?,?,?,?,?,?,?)",
            (request.name, email, request.phone, hashed, request.locale, int(request.notices), privacy_version, now()),
        )
    return {"registered": True}


@app.post("/login")
def login(request: Login):
    with db() as connection:
        user = connection.execute("SELECT * FROM users WHERE email=? AND deleted=0", (request.email.lower(),)).fetchone()
    valid, _ = passwords.verify_and_update(request.password, user["password"] if user else dummy_password)
    if not user or not valid:
        raise HTTPException(401, "invalid_credentials")
    token = jwt.encode({"sub": str(user["id"]), "v": user["version"], "aud": "tallerya",
                        "exp": datetime.now(timezone.utc) + timedelta(hours=2)}, key(), algorithm="HS256")
    return {"token": token, "user": public_user(user)}


@app.get("/me")
def me(user=Depends(current)):
    return public_user(user)


class Preference(BaseModel):
    notices: bool


@app.put("/me/preferences")
def preferences(request: Preference, user=Depends(current)):
    with db() as connection:
        connection.execute("UPDATE users SET notices=? WHERE id=?", (int(request.notices), user["id"]))
    return request


def delete_user(connection, user_id):
    target = find(connection, "SELECT * FROM users WHERE id=? AND deleted=0", (user_id,))
    conflict(target["role"] == "owner", "owner_protected")
    connection.execute("DELETE FROM interests WHERE \"user\"=?", (user_id,))
    connection.execute("UPDATE bookings SET status='cancelled' WHERE \"user\"=? AND status IN ('hold','payment')", (user_id,))
    connection.execute("UPDATE bookings SET certificate=NULL WHERE \"user\"=?", (user_id,))
    connection.execute("UPDATE users SET deleted=1, email=?, name='', phone='', password='', notices=0, version=version+1 WHERE id=?",
                       (f"deleted-{user_id}@invalid.example", user_id))


@app.delete("/admin/users/{user_id}", status_code=204)
def remove_user(user_id: int, _=Depends(owner)):
    with db() as connection:
        delete_user(connection, user_id)
    return Response(status_code=204)


@app.put("/admin/users/{user_id}/password", status_code=204)
def change_password(user_id: int, request: PasswordChange, _=Depends(owner)):
    encoded = passwords.hash(request.password)
    with db() as connection:
        find(connection, "SELECT id FROM users WHERE id=? AND deleted=0", (user_id,))
        connection.execute("UPDATE users SET password=?,version=version+1 WHERE id=?", (encoded, user_id))
    return Response(status_code=204)


@app.put("/admin/users/{user_id}/role", status_code=204)
def change_role(user_id: int, request: RoleChange, _=Depends(owner)):
    with db() as connection:
        user = find(connection, "SELECT role FROM users WHERE id=? AND deleted=0", (user_id,))
        conflict(user["role"] == "owner", "owner_protected")
        connection.execute("UPDATE users SET role=?,version=version+1 WHERE id=?", (request.role, user_id))
    return Response(status_code=204)


@app.get("/admin/users")
def users(_=Depends(owner)):
    with db() as connection:
        return [public_user(row) for row in connection.execute("SELECT * FROM users WHERE deleted=0 ORDER BY id")]


def expire(connection, clock):
    connection.execute(
        """UPDATE bookings SET status='expired'
        WHERE (status='payment' AND deadline<=?) OR
        (status='hold' AND workshop IN (SELECT id FROM workshops WHERE starts<=?))""",
        (clock, clock + DAY - 1),
    )


def slots(connection, workshop):
    occupied = connection.execute(f"SELECT count(*) AS occupied FROM bookings WHERE workshop=? AND status IN ({ACTIVE})",
                                  (workshop["id"],)).fetchone()["occupied"]
    return workshop["capacity"] - occupied


def public_workshop(connection, row):
    return {**dict(row), "available": slots(connection, row)}


@app.get("/workshops")
def catalog():
    with db() as connection:
        clock = now()
        expire(connection, clock)
        return [public_workshop(connection, row) for row in connection.execute(
            "SELECT * FROM workshops WHERE published=1 AND starts>=? ORDER BY starts", (clock + DAY,)
        )]


@app.get("/workshops/{workshop_id}")
def workshop_detail(workshop_id: int):
    with db() as connection:
        clock = now()
        expire(connection, clock)
        return public_workshop(connection, find(connection,
            "SELECT * FROM workshops WHERE id=? AND published=1 AND starts>=?", (workshop_id, clock + DAY)))


def editor_values(connection, workshop):
    if workshop.teacher is not None:
        find(connection, "SELECT id FROM users WHERE id=? AND role='teacher' AND deleted=0", (workshop.teacher,))
    return (workshop.es, workshop.en, int(workshop.starts.timestamp()), workshop.minutes,
            workshop.price, workshop.currency, workshop.capacity, int(workshop.published), workshop.teacher, workshop.venue)


@app.post("/admin/workshops", status_code=201)
def create_workshop(workshop: Workshop, _=Depends(staff)):
    with db() as connection:
        result = connection.execute(
            "INSERT INTO workshops(es,en,starts,minutes,price,currency,capacity,published,teacher,venue) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id",
            editor_values(connection, workshop),
        )
        return {"id": result.fetchone()["id"]}


@app.put("/admin/workshops/{workshop_id}")
def update_workshop(workshop_id: int, workshop: Workshop, _=Depends(staff)):
    with db() as connection:
        expire(connection, now())
        previous = find(connection, "SELECT * FROM workshops WHERE id=?", (workshop_id,))
        conflict(previous["capacity"] - slots(connection, previous) > workshop.capacity, "capacity_below_bookings")
        has_active = previous["capacity"] != slots(connection, previous)
        conflict(has_active and previous["starts"] != int(workshop.starts.timestamp()), "active_bookings_prevent_reschedule")
        connection.execute(
            "UPDATE workshops SET es=?,en=?,starts=?,minutes=?,price=?,currency=?,capacity=?,published=?,teacher=?,venue=? WHERE id=?",
            (*editor_values(connection, workshop), workshop_id),
        )
    return {"id": workshop_id}


@app.get("/admin/workshops")
def agenda(user=Depends(current)):
    if user["role"] not in ("owner", "manager", "teacher"):
        raise HTTPException(403, "staff_only")
    with db() as connection:
        expire(connection, now())
        if user["role"] == "teacher":
            return [public_workshop(connection, row) for row in connection.execute(
                "SELECT * FROM workshops WHERE teacher=? ORDER BY starts", (user["id"],))]
        return [{**public_workshop(connection, row), "counts": {
            counts["status"]: counts["total"] for counts in connection.execute(
                "SELECT status,count(*) AS total FROM bookings WHERE workshop=? GROUP BY status", (row["id"],)
            )
        }} for row in connection.execute("SELECT * FROM workshops ORDER BY starts")]


def queue(connection, user, workshop_id, dedupe, kind, es, en):
    subject, body = en if user["locale"] == "en" else es
    connection.execute(
        "INSERT INTO outbox(dedupe,recipient,kind,workshop,locale,subject,body) VALUES(?,?,?,?,?,?,?) ON CONFLICT(dedupe) DO NOTHING",
        (dedupe, user["id"], kind, workshop_id, user["locale"], subject, body),
    )


@app.post("/workshops/{workshop_id}/book", status_code=201)
def book(workshop_id: int, user=Depends(current)):
    with db() as connection:
        clock = now()
        expire(connection, clock)
        workshop = find(connection, "SELECT * FROM workshops WHERE id=? AND published=1", (workshop_id,))
        conflict(workshop["starts"] - clock < DAY, "booking_closed")
        conflict(connection.execute(f"SELECT 1 FROM bookings WHERE workshop=? AND \"user\"=? AND status IN ({ACTIVE})",
                                    (workshop_id, user["id"])).fetchone(), "existing_booking")
        conflict(slots(connection, workshop) <= 0, "sold_out")
        booking = connection.execute("INSERT INTO bookings(workshop,\"user\",status,price,currency) VALUES(?,?,'hold',?,?) RETURNING id",
                                     (workshop_id, user["id"], workshop["price"], workshop["currency"])).fetchone()["id"]
        queue(connection, user, workshop_id, f"hold:{booking}", "hold",
              ("Plaza apartada", "Recibirás por WhatsApp un enlace o QR. Tendrás 24 horas desde el mensaje para pagar y confirmar."),
              ("Place held", "We will send a link or QR via WhatsApp. You have 24 hours from that message to pay and confirm."))
        return {"id": booking, "status": "hold"}


@app.post("/workshops/{workshop_id}/interest", status_code=204)
def interest(workshop_id: int, user=Depends(current)):
    with db() as connection:
        find(connection, "SELECT id FROM workshops WHERE id=? AND published=1 AND starts>=?", (workshop_id, now() + DAY))
        connection.execute("INSERT INTO interests(workshop,\"user\") VALUES(?,?) ON CONFLICT DO NOTHING", (workshop_id, user["id"]))
    return Response(status_code=204)


def booking_details(connection, booking_id):
    return find(connection, """SELECT b.*,w.starts,w.minutes,w.es,w.en FROM bookings b
                JOIN workshops w ON w.id=b.workshop WHERE b.id=?""", (booking_id,))


def booking_view(row):
    return {k: row[k] for k in row.keys() if k != "certificate"} | {"has_certificate": row["certificate"] is not None}


@app.get("/me/bookings")
def my_bookings(user=Depends(current)):
    with db() as connection:
        expire(connection, now())
        ids = connection.execute("SELECT id FROM bookings WHERE \"user\"=? ORDER BY id DESC", (user["id"],))
        return [booking_view(booking_details(connection, row["id"])) for row in ids]


@app.get("/admin/bookings")
def all_bookings(_=Depends(staff)):
    with db() as connection:
        expire(connection, now())
        ids = connection.execute("SELECT id,\"user\" FROM bookings ORDER BY id DESC")
        return [booking_view(booking_details(connection, row["id"])) | {
            "contact": dict(find(connection, "SELECT name,email,phone FROM users WHERE id=?", (row["user"],)))
        } for row in ids]


@app.post("/admin/bookings/{booking_id}/payment-sent")
def payment_sent(booking_id: int, request: Sent, _=Depends(staff)):
    with db() as connection:
        clock = now()
        booking = booking_details(connection, booking_id)
        conflict(booking["status"] != "hold", "invalid_state")
        conflict(booking["starts"] - clock < DAY, "insufficient_time_for_payment")
        deadline = clock + DAY
        connection.execute("UPDATE bookings SET status='payment',sent=?,deadline=?,payment_url=? WHERE id=?",
                           (clock, deadline, str(request.payment_url), booking_id))
    return {"deadline": deadline}


@app.post("/admin/bookings/{booking_id}/paid")
def paid(booking_id: int, _=Depends(staff)):
    with db() as connection:
        booking = booking_details(connection, booking_id)
        if booking["status"] == "confirmed":
            return {"status": "confirmed"}
        conflict(booking["status"] != "payment" or booking["deadline"] <= now(), "invalid_or_expired_payment")
        user = find(connection, "SELECT * FROM users WHERE id=? AND deleted=0", (booking["user"],))
        connection.execute("UPDATE bookings SET status='confirmed',paid=price WHERE id=?", (booking_id,))
        queue(connection, user, booking["workshop"], f"paid:{booking_id}", "paid",
              ("Reserva confirmada", "Registramos tu pago. Tu reserva está confirmada."),
              ("Booking confirmed", "We recorded your payment. Your booking is confirmed."))
    return {"status": "confirmed"}


@app.post("/me/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: int, user=Depends(current)):
    with db() as connection:
        clock = now()
        expire(connection, clock)
        booking = booking_details(connection, booking_id)
        if booking["user"] != user["id"]:
            raise HTTPException(404, "not_found")
        conflict(booking["starts"] - clock < 2 * DAY, "cancellation_closed")
        if booking["status"] == "cancelled":
            return {"status": "cancelled"}
        conflict(booking["status"] not in ("hold", "payment", "confirmed"), "invalid_state")
        workshop = find(connection, "SELECT * FROM workshops WHERE id=?", (booking["workshop"],))
        was_full = slots(connection, workshop) == 0
        connection.execute("UPDATE bookings SET status='cancelled',refund=? WHERE id=?", (int(bool(booking["paid"])), booking_id))
        if was_full and workshop["published"]:
            base = os.getenv("TALLERYA_PUBLIC_URL", "http://localhost:3000").rstrip("/")
            for recipient in connection.execute("""
                SELECT u.* FROM interests i JOIN users u ON i."user"=u.id
                WHERE i.workshop=? AND u.notices=1 AND u.deleted=0 AND u.id!=?
            """, (workshop["id"], user["id"])):
                queue(connection, recipient, workshop["id"], f"available:{booking_id}:{recipient['id']}", "available",
                      ("Hay una plaza disponible", f"Consulta disponibilidad en {base}/es?taller={workshop['id']}#taller-{workshop['id']}"),
                      ("A place is available", f"Check availability at {base}/en?taller={workshop['id']}#talleres"))
    return {"status": "cancelled"}


@app.post("/admin/bookings/{booking_id}/refund")
def refund(booking_id: int, request: Refund, _=Depends(staff)):
    with db() as connection:
        booking = booking_details(connection, booking_id)
        conflict(not booking["refund"] or request.amount > booking["paid"], "invalid_refund")
        conflict(request.amount < booking["refunded"], "refund_below_registered_amount")
        connection.execute("UPDATE bookings SET refunded=? WHERE id=?", (request.amount, booking_id))
    return {"refunded": request.amount}


@app.get("/admin/workshops/{workshop_id}/settlement")
def settlement(workshop_id: int, _=Depends(staff)):
    with db() as connection:
        find(connection, "SELECT id FROM workshops WHERE id=?", (workshop_id,))
        records = connection.execute(
            "SELECT currency,paid,refunded FROM bookings WHERE workshop=? AND paid>0", (workshop_id,)
        ).fetchall()
        rows = pd.DataFrame.from_records(records, columns=["currency", "paid", "refunded"])
    rows["split"] = (rows.paid - rows.refunded + 2) // 5
    totals = []
    for currency, group in rows.groupby("currency"):
        paid_total = int(group.paid.sum())
        refunded = int(group.refunded.sum())
        split = int(group.split.sum())
        totals.append({"currency": currency, "count": len(group), "paid": paid_total, "refunded": refunded,
                       "tallerya": split, "teacher": paid_total - refunded - split})
    return totals


@app.put("/admin/bookings/{booking_id}/certificate", status_code=204)
def upload_certificate(booking_id: int, payload: bytes = Body(media_type="application/pdf"),
                       _=Depends(staff)):
    if not payload.startswith(b"%PDF-") or len(payload) > 5_000_000:
        raise HTTPException(422, "invalid_pdf")
    with db() as connection:
        booking = booking_details(connection, booking_id)
        conflict(booking["status"] != "confirmed" or booking["starts"] + booking["minutes"] * 60 > now(), "certificate_not_available")
        connection.execute("UPDATE bookings SET certificate=? WHERE id=?", (payload, booking_id))
    return Response(status_code=204)


@app.get("/me/bookings/{booking_id}/certificate")
def certificate(booking_id: int, user=Depends(current)):
    with db() as connection:
        booking = booking_details(connection, booking_id)
        if booking["user"] != user["id"] or booking["status"] != "confirmed" or booking["certificate"] is None:
            raise HTTPException(404, "not_found")
        return Response(booking["certificate"], media_type="application/pdf",
                        headers={"Content-Disposition": "attachment; filename=certificado.pdf", "Cache-Control": "no-store"})


@app.post("/telemetry", status_code=204)
def track(event: Event):
    with db() as connection:
        connection.execute("INSERT INTO events(name,locale,happened) VALUES(?,?,?)", (event.name, event.locale, now()))
    return Response(status_code=204)


@app.get("/admin/telemetry")
def analytics(_=Depends(staff)):
    with db() as connection:
        return [dict(row) for row in connection.execute(
            "SELECT name,locale,count(*) AS total FROM events WHERE happened>=? GROUP BY name,locale",
            (now() - 30 * DAY,))]


@app.get("/admin/teachers")
def teachers(_=Depends(staff)):
    with db() as connection:
        return [dict(row) for row in connection.execute(
            "SELECT id,name FROM users WHERE role='teacher' AND deleted=0 ORDER BY name")]


@app.get("/admin/overview")
def overview(_=Depends(staff)):
    with db() as connection:
        expire(connection, now())
        popular = [dict(row) for row in connection.execute("""
            SELECT w.id,w.es,w.en,count(b.id) AS registrations,
                   sum(CASE WHEN b.status='confirmed' THEN 1 ELSE 0 END) AS confirmed
            FROM workshops w JOIN bookings b ON w.id=b.workshop
            GROUP BY w.id ORDER BY registrations DESC, confirmed DESC, w.id ASC LIMIT 8
        """)]
        earnings = [dict(row) for row in connection.execute("""
            SELECT currency,count(*) AS payments,sum(paid) AS paid,sum(refunded) AS refunded,
                   sum((paid-refunded+2)/5) AS tallerya,
                   sum(paid-refunded-(paid-refunded+2)/5) AS teacher
            FROM bookings WHERE paid>0 GROUP BY currency ORDER BY currency
        """)]
        return {"popular": popular, "earnings": earnings}
