"""Server-only PostgreSQL connection for the private Supabase schema."""
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row


class Connection:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, statement, arguments=()):
        # Application SQL uses qmark parameters and contains no literal question marks.
        return self.connection.execute(statement.replace("?", "%s"), arguments)


@contextmanager
def postgres_db(url):
    with psycopg.connect(url, connect_timeout=5, row_factory=dict_row) as connection:
        connection.execute("SET LOCAL search_path = tallerya, pg_catalog")
        # Match SQLite's BEGIN IMMEDIATE semantics across API and jobs workers.
        connection.execute("SELECT pg_advisory_xact_lock(741092801, 1)")
        yield Connection(connection)
