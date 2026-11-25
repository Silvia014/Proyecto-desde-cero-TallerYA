"""Run periodically to expire holds and deliver queued transactional mail."""
import logging
import os
import sys
import time
import smtplib
from email.message import EmailMessage

from api.main import DAY, db, expire, now


def run():
    with db() as connection:
        clock = now()
        expire(connection, clock)
        connection.execute("DELETE FROM events WHERE happened<?", (clock - 90 * DAY,))
    host = os.getenv("TALLERYA_SMTP_HOST")
    if not host:
        return
    sender = os.getenv("TALLERYA_SMTP_FROM") or os.environ["TALLERYA_SMTP_USER"]
    with smtplib.SMTP_SSL(host, int(os.getenv("TALLERYA_SMTP_PORT", "465")), timeout=10) as smtp:
        smtp.login(os.environ["TALLERYA_SMTP_USER"], os.environ["TALLERYA_SMTP_PASSWORD"])
        while True:
            with db() as connection:
                row = connection.execute("""
                    SELECT o.*,u.email,u.notices,u.deleted,w.starts,w.published
                    FROM outbox o JOIN users u ON o.recipient=u.id JOIN workshops w ON o.workshop=w.id
                    WHERE o.sent IS NULL ORDER BY o.id LIMIT 1
                """).fetchone()
                if row is None:
                    return
                allowed = not row["deleted"] and (row["kind"] != "available" or
                          (row["notices"] and row["published"] and row["starts"] >= now() + DAY))
                if allowed and row["kind"] in ("hold", "paid"):
                    expected = ("hold", "payment") if row["kind"] == "hold" else ("confirmed",)
                    booking = connection.execute("SELECT status FROM bookings WHERE id=?",
                                                 (int(row["dedupe"].split(":")[1]),)).fetchone()
                    allowed = booking is not None and booking["status"] in expected
                if allowed:
                    message = EmailMessage()
                    message["From"] = sender
                    message["To"] = row["email"]
                    message["Subject"] = row["subject"]
                    message["Message-ID"] = f"<tallerya-{row['id']}@{sender.rsplit('@',1)[-1]}>"
                    message.set_content(row["body"])
                    smtp.send_message(message)
                connection.execute("UPDATE outbox SET sent=? WHERE id=?", (now(), row["id"]))


if __name__ == "__main__":
    if "--loop" not in sys.argv:
        run()
    else:
        while True:
            try:
                run()
            except Exception:
                logging.exception("TallerYA background job failed")
            time.sleep(60)
