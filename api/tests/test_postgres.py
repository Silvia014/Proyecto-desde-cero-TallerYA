import os

import pytest

from api import main


@pytest.mark.skipif(not os.getenv("TALLERYA_TEST_DATABASE_URL"), reason="PostgreSQL test URL not configured")
def test_postgres_schema_stays_private():
    import psycopg
    with psycopg.connect(os.environ["TALLERYA_TEST_DATABASE_URL"]) as connection:
        assert connection.execute("SELECT to_regclass('public.bookings')").fetchone()[0] is None
        assert connection.execute("""
            SELECT relrowsecurity FROM pg_class
            WHERE oid = 'tallerya.bookings'::regclass
        """).fetchone()[0]
        assert connection.execute("""
            SELECT count(*) FROM pg_indexes
            WHERE schemaname='tallerya' AND indexname='one_place'
        """).fetchone()[0] == 1
