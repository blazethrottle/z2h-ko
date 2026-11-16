"""Alembic 실행 환경.

DB 주소 우선순위: (1) 호출한 쪽이 넘긴 연결 (2) sqlalchemy.url 옵션 (3) z2h_server/config.py 규칙
(Z2H_DB_URL, Z2H_DB_PATH, 기본 server/data/z2h.sqlite3).
버전 표는 Alembic 기본 alembic_version(PM 지시, 따로 만들지 않음).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import sqlalchemy as sa
from alembic import context

SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

VERSION_TABLE = "alembic_version"

config = context.config


def _db_url() -> str:
    url = config.get_main_option("sqlalchemy.url")
    if url:
        return url
    from z2h_server.config import DEFAULT_DB_PATH, sqlite_url

    if os.environ.get("Z2H_DB_URL"):
        return os.environ["Z2H_DB_URL"]
    path = Path(os.environ.get("Z2H_DB_PATH") or DEFAULT_DB_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    return sqlite_url(path)


def run_migrations_offline() -> None:
    """DB에 붙지 않고 SQL 글만 만든다(예: Postgres용 SQL 미리 보기)."""
    url = _db_url()
    context.configure(
        url=url,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table=VERSION_TABLE,
    )
    with context.begin_transaction():
        context.run_migrations()


def _run_with(connection) -> None:
    context.configure(
        connection=connection,
        version_table=VERSION_TABLE,
        render_as_batch=connection.dialect.name == "sqlite",
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        _run_with(connection)
        return
    engine = sa.create_engine(_db_url(), poolclass=sa.pool.NullPool)
    try:
        with engine.connect() as conn:
            _run_with(conn)
            conn.commit()
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
