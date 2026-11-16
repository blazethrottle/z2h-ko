"""마이그레이션 실행 도우미. 표는 이 경로(Alembic)로만 만들고 바꾼다."""

from __future__ import annotations

from pathlib import Path
from typing import TextIO

import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory

from .config import ALEMBIC_DIR, ALEMBIC_INI

VERSION_TABLE = "alembic_version"  # Alembic 기본 이름


def make_config(db_url: str, *, output_buffer: TextIO | None = None) -> Config:
    cfg = Config(str(ALEMBIC_INI), output_buffer=output_buffer)
    cfg.set_main_option("script_location", str(ALEMBIC_DIR))
    # configparser 가 '%' 를 특수 글자로 보므로 두 번 적는다
    cfg.set_main_option("sqlalchemy.url", db_url.replace("%", "%%"))
    return cfg


def _ensure_sqlite_dir(db_url: str) -> None:
    url = sa.engine.make_url(db_url)
    if url.get_backend_name() == "sqlite" and url.database and url.database != ":memory:":
        Path(url.database).parent.mkdir(parents=True, exist_ok=True)


def upgrade(db_url: str, revision: str = "head", *, sql: bool = False, output_buffer: TextIO | None = None) -> None:
    if not sql:
        _ensure_sqlite_dir(db_url)
    command.upgrade(make_config(db_url, output_buffer=output_buffer), revision, sql=sql)


def downgrade(db_url: str, revision: str = "base", *, sql: bool = False, output_buffer: TextIO | None = None) -> None:
    command.downgrade(make_config(db_url, output_buffer=output_buffer), revision, sql=sql)


def head_revision() -> str:
    script = ScriptDirectory(str(ALEMBIC_DIR))
    head = script.get_current_head()
    assert head is not None
    return head


def current_revision(target: str | sa.Engine | sa.Connection) -> str | None:
    """DB에 적힌 현재 스키마 버전(alembic_version). 표가 없으면 None."""
    if isinstance(target, sa.Connection):
        return MigrationContext.configure(target, opts={"version_table": VERSION_TABLE}).get_current_revision()
    engine = sa.create_engine(target, poolclass=sa.pool.NullPool) if isinstance(target, str) else target
    try:
        with engine.connect() as conn:
            return MigrationContext.configure(conn, opts={"version_table": VERSION_TABLE}).get_current_revision()
    finally:
        if isinstance(target, str):
            engine.dispose()
