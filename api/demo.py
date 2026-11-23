"""Opt-in fixtures for a local or isolated demo database."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from api.demo_catalog import EDITIONS
from api.main import DAY, db, now, passwords


def sample_certificate():
    content = b"BT /F1 24 Tf 72 680 Td (TallerYA - Demo certificate) Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
    ]
    result = bytearray(b"%PDF-1.4\n")
    offsets = []
    for index, obj in enumerate(objects, 1):
        offsets.append(len(result))
        result.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    table = len(result)
    result.extend(f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode())
    for offset in offsets:
        result.extend(f"{offset:010d} 00000 n \n".encode())
    result.extend(f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{table}\n%%EOF\n".encode())
    return bytes(result)


def seed_more_editions(connection):
    if connection.execute("SELECT 1 FROM demo_seed WHERE marker=2").fetchone():
        return
    bogota = ZoneInfo("America/Bogota")
    today = datetime.fromtimestamp(now(), bogota).date()
    teacher = connection.execute("SELECT id FROM users WHERE email='teacher@example.com'").fetchone()["id"]
    for es, en, days, hour, minutes, price, venue, _, _ in EDITIONS:
        starts = int(datetime.combine(today + timedelta(days=days), time(hour), bogota).timestamp())
        connection.execute("""
            INSERT INTO workshops(es,en,starts,minutes,price,currency,capacity,published,teacher,venue)
            VALUES(?,?,?,?,?,'COP',20,1,?,?)
        """, (es, en, starts, minutes, price * 100, teacher, venue))
    connection.execute("INSERT INTO demo_seed VALUES(2)")


def seed():
    with db() as connection:
        if connection.execute("SELECT 1 FROM demo_seed WHERE marker=1").fetchone():
            seed_more_editions(connection)
            return
        if connection.execute("SELECT 1 FROM users").fetchone():
            raise RuntimeError("Demo data requires a dedicated empty database")
        start = now()
        password = passwords.hash("Demo-TallerYA-5678")
        for email, name, role in [
            ("owner@example.com", "Demo Dueña", "owner"),
            ("student@example.com", "Demo Alumna", "student"),
            ("teacher@example.com", "Demo Profesor", "teacher"),
        ]:
            connection.execute("""
                INSERT INTO users(name,email,phone,password,locale,notices,privacy,accepted,role)
                VALUES(?,?,?,?,'es',0,'1',?,?)
            """, (name, email, "+576010000000", password, start, role))
        editions = [
            ("Cerámica a mano", "Ceramics by hand", 5, 180, 9800000, 12, "Casa Arcilla · Chapinero"),
            ("Fotografía urbana", "Street photography", 6, 120, 7900000, 10, "Estudio Luz · La Candelaria"),
            ("Encuadernación artesanal", "Hand bookbinding", 8, 150, 8900000, 8, "Casa Papel · Teusaquillo"),
            ("Cocina colombiana", "Colombian cooking", 10, 180, 12500000, 14, "Cocina Mesa · Usaquén"),
            ("Introducción a la cerámica", "Introduction to ceramics", -4, 120, 7500000, 12, "Casa Arcilla · Chapinero"),
        ]
        for es, en, day, minutes, price, capacity, venue in editions:
            connection.execute("""
                INSERT INTO workshops(es,en,starts,minutes,price,currency,capacity,published,teacher,venue)
                VALUES(?,?,?,?,?,'COP',?,1,3,?)
            """, (es, en, start + day * DAY, minutes, price, capacity, venue))
        connection.execute("""
            INSERT INTO bookings(workshop,"user",status,price,currency,paid,certificate)
            VALUES(5,2,'confirmed',7500000,'COP',7500000,?)
        """, (sample_certificate(),))
        connection.execute("""
            INSERT INTO bookings(workshop,"user",status,price,currency,paid)
            VALUES(1,2,'confirmed',9800000,'COP',9800000)
        """)
        connection.execute("INSERT INTO demo_seed VALUES(1)")
        seed_more_editions(connection)
