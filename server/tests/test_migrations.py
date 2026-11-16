"""Alembic 마이그레이션: 올리기 → 내리기 → 올리기 왕복, 고정 사용자, Postgres용 SQL 생성.

0002: taste_result 표를 지운다(앱이 쓴 적 없음. 맛보기 기록은 taster_result 하나).
"""

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


# ---------- 0002: taste_result 지우기 ----------


def _shape(url: str) -> dict[str, dict]:
    """표마다 칼럼(이름·타입·빈 값 허용)·PK·FK·색인. 두 DB 의 모양을 비교할 때 쓴다."""
    engine = sa.create_engine(url)
    try:
        insp = sa.inspect(engine)
        out = {}
        for name in sorted(insp.get_table_names()):
            if name == "alembic_version":
                continue
            out[name] = {
                "columns": [(c["name"], str(c["type"]), c["nullable"]) for c in insp.get_columns(name)],
                "pk": insp.get_pk_constraint(name),
                "fks": sorted(
                    (fk["name"], tuple(fk["constrained_columns"]), fk["referred_table"], str(fk.get("options")))
                    for fk in insp.get_foreign_keys(name)
                ),
                "indexes": sorted((i["name"], tuple(i["column_names"]), bool(i["unique"])) for i in insp.get_indexes(name)),
            }
        return out
    finally:
        engine.dispose()


def test_head_is_0002_without_taste_result(tmp_path):
    url = sqlite_url(tmp_path / "h.sqlite3")
    migrate.upgrade(url)
    assert migrate.head_revision() == "0002"
    assert migrate.current_revision(url) == "0002"
    names = _tables(url)
    assert "taste_result" not in names and "taster_result" in names
    assert "taste_result" not in schema.metadata.tables
    assert "taste_result" not in schema.SYNC_TABLES


def test_0002_round_trip_restores_0001_shape(tmp_path):
    only_0001 = sqlite_url(tmp_path / "only1.sqlite3")
    migrate.upgrade(only_0001, "0001")
    assert "taste_result" in _tables(only_0001)

    url = sqlite_url(tmp_path / "rt.sqlite3")
    migrate.upgrade(url)
    migrate.downgrade(url, "0001")
    assert migrate.current_revision(url) == "0001"
    assert _shape(url) == _shape(only_0001)  # 내리면 0001 과 같은 모양(빈 taste_result 포함)

    migrate.upgrade(url)
    assert migrate.current_revision(url) == "0002"
    assert "taste_result" not in _tables(url)
    assert ALL_TABLES <= _tables(url)


def test_0002_upgrades_a_0001_db_that_has_taste_result_rows(tmp_path):
    """0001 상태 DB 에 taste_result 행이 있어도 오류 없이 올라가고, 그 행은 버려진다. 다른 기록은 그대로."""
    url = sqlite_url(tmp_path / "old.sqlite3")
    migrate.upgrade(url, "0001")
    engine = sa.create_engine(url)
    try:
        with engine.begin() as conn:
            conn.execute(sa.text(
                "INSERT INTO users (user_id, path_id, display_name, created_at, locale) "
                "VALUES ('u-1', 'full', '옛 계정', '2026-11-16T10:00:00+09:00', 'ko-KR')"
            ))
            conn.execute(sa.text(
                "INSERT INTO taste_result (user_id, done_at, loss_start, loss_end, names_json, source, "
                "updated_at, content_version, server_seq, last_client_id) "
                "VALUES ('u-1', '2026-11-16T10:05:00+09:00', 3.84, 2.47, '[\"mira\"]', 'colab', "
                "'2026-11-16T10:05:00+09:00', NULL, 1, 'pc')"
            ))
            conn.execute(sa.text(
                "INSERT INTO taster_result (user_id, attempt_no, step_id, self_reported, at, "
                "updated_at, content_version, server_seq, last_client_id) "
                "VALUES ('u-1', 1, 'T-S05', 'similar', '2026-11-16T10:04:00+09:00', "
                "'2026-11-16T10:04:00+09:00', NULL, 2, 'pc')"
            ))
            conn.execute(sa.text("UPDATE sync_counter SET value = 2 WHERE name = 'server_seq'"))
    finally:
        engine.dispose()

    migrate.upgrade(url)  # 오류 없이
    assert migrate.current_revision(url) == "0002"
    assert "taste_result" not in _tables(url)
    engine = sa.create_engine(url)
    try:
        with engine.connect() as conn:
            assert conn.execute(sa.text("SELECT user_id FROM users")).scalars().all() == ["u-1"]
            kept = conn.execute(sa.text("SELECT step_id, self_reported FROM taster_result")).all()
            assert [tuple(r) for r in kept] == [("T-S05", "similar")]
            assert conn.execute(sa.text("SELECT value FROM sync_counter")).scalar_one() == 2
    finally:
        engine.dispose()


def test_0002_postgres_sql_drops_and_restores_taste_result():
    buf = io.StringIO()
    migrate.upgrade("postgresql://offline/z2h", "0001:0002", sql=True, output_buffer=buf)
    up_sql = buf.getvalue()
    assert "DROP TABLE taste_result" in up_sql
    assert "CREATE TABLE" not in up_sql

    buf = io.StringIO()
    migrate.downgrade("postgresql://offline/z2h", "0002:0001", sql=True, output_buffer=buf)
    down_sql = buf.getvalue()
    assert "CREATE TABLE taste_result" in down_sql
    assert "TIMESTAMP WITH TIME ZONE" in down_sql and "ON DELETE CASCADE" in down_sql
    assert "CREATE INDEX ix_taste_result_seq" in down_sql
