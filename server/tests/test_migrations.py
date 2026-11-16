"""Alembic 마이그레이션: 올리기 → 내리기 → 올리기 왕복, 고정 사용자, Postgres용 SQL 생성."""

from __future__ import annotations

import io

import sqlalchemy as sa
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext

from z2h_server import migrate, schema
from z2h_server.config import sqlite_url

ALL_TABLES = {
    "users",
    "auth_identity",
    "sessions",
    "step_progress",
    "question_attempt",
    "rebuild_attempt",
    "mastery_state",
    "review_card",
    "grade_result",
    "user_pref",
    "checkpoint_attempt",
    "diagnostic_result",
    "taster_result",
    "taste_result",
    "help_note",
    "study_session",
    "badge_def",
    "user_badge",
    "share_card",
    "sync_conflicts",
    "applied_ops",
    "sync_counter",
}


def _tables(url: str) -> set[str]:
    engine = sa.create_engine(url)
    try:
        return set(sa.inspect(engine).get_table_names())
    finally:
        engine.dispose()


def test_upgrade_creates_every_design_table(tmp_path):
    url = sqlite_url(tmp_path / "a.sqlite3")
    migrate.upgrade(url)
    names = _tables(url)
    assert ALL_TABLES <= names
    # 버전 표는 Alembic 기본 alembic_version(따로 만들지 않음)
    assert "alembic_version" in names
    assert "schema_migrations" not in names


def test_round_trip_up_down_up(tmp_path):
    url = sqlite_url(tmp_path / "b.sqlite3")
    migrate.upgrade(url)
    assert migrate.current_revision(url) == migrate.head_revision()

    migrate.downgrade(url, "base")
    left = _tables(url) - {"alembic_version"}
    assert left == set(), f"내리기 뒤 남은 표: {left}"
    assert migrate.current_revision(url) is None

    migrate.upgrade(url)
    assert ALL_TABLES <= _tables(url)
    assert migrate.current_revision(url) == migrate.head_revision()


def test_migration_inserts_no_fixed_user_and_seeds_server_seq(tmp_path):
    """계정별 구조(D43): 고정 사용자 행이 없고, server_seq 번호표는 0에서 시작."""
    url = sqlite_url(tmp_path / "c.sqlite3")
    migrate.upgrade(url)
    engine = sa.create_engine(url)
    with engine.connect() as conn:
        users = conn.execute(sa.text("SELECT COUNT(*) FROM users")).scalar_one()
        counter = conn.execute(sa.text("SELECT name, value FROM sync_counter")).all()
    engine.dispose()
    assert users == 0
    assert [tuple(r) for r in counter] == [("server_seq", 0)]


def test_badge_def_starts_empty(tmp_path):
    url = sqlite_url(tmp_path / "d.sqlite3")
    migrate.upgrade(url)
    engine = sa.create_engine(url)
    with engine.connect() as conn:
        count = conn.execute(sa.text("SELECT COUNT(*) FROM badge_def")).scalar_one()
    engine.dispose()
    assert count == 0


def test_code_table_definitions_match_migration(template_db):
    """서버 코드의 표 정의(schema.py)와 마이그레이션이 만든 표가 같아야 한다."""
    engine = sa.create_engine(sqlite_url(template_db))
    with engine.connect() as conn:
        ctx = MigrationContext.configure(
            conn,
            opts={"compare_type": False, "version_table": migrate.VERSION_TABLE},
        )
        diff = compare_metadata(ctx, schema.metadata)
    engine.dispose()
    assert diff == []


def test_postgres_sql_can_be_generated_offline():
    """Postgres에 붙지 않고 같은 마이그레이션의 SQL을 만들어 본다(실제 Postgres 실행은 나중)."""
    buf = io.StringIO()
    migrate.upgrade("postgresql://offline/z2h", sql=True, output_buffer=buf)
    up_sql = buf.getvalue()
    assert "CREATE TABLE step_progress" in up_sql
    assert "TIMESTAMP WITH TIME ZONE" in up_sql
    assert "CREATE TABLE alembic_version" in up_sql
    assert "ON DELETE CASCADE" in up_sql
    assert "INSERT INTO users" not in up_sql
    for banned in ("INSERT OR REPLACE", "INSERT OR IGNORE", "PRAGMA", "AUTOINCREMENT"):
        assert banned not in up_sql.upper()

    buf = io.StringIO()
    migrate.downgrade("postgresql://offline/z2h", f"{migrate.head_revision()}:base", sql=True, output_buffer=buf)
    down_sql = buf.getvalue()
    assert "DROP TABLE step_progress" in down_sql
    assert "DROP TABLE users" in down_sql
