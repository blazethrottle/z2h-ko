"""Alembic 실행 환경.

DB 주소 우선순위: (1) 호출한 쪽이 넘긴 연결 (2) sqlalchemy.url 옵션 (3) 서버 설정(z2h_server/config.py 의
load_settings().db_url. 환경변수 규칙도 그쪽 한 곳). 처음 만들 때의 준비(SQLite 폴더)는 저장 계층(prepare_location).
버전 표는 Alembic 기본 alembic_version(PM 지시, 따로 만들지 않음).
"""

from __future__ import annotations

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
    from z2h_server.config import load_settings
    from z2h_server.storage import prepare_location

    url = load_settings().db_url
    if not context.is_offline_mode():
        prepare_location(url)
    return url


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
