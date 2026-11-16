"""스키마 검사: 모든 학습 기록 표에 user_id, DESIGN.md 5절 칼럼, 표준 SQL만."""

from __future__ import annotations

import io
import re
import tokenize
from pathlib import Path

import pytest
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.schema import CreateTable

from z2h_server import schema
from z2h_server.config import sqlite_url

SERVER_DIR = Path(__file__).resolve().parents[1]

# 사용자 기록이 아닌 표(사용자와 무관한 정의·버전·번호표)
NOT_USER_TABLES = {"badge_def", "alembic_version", "sync_counter"}

# 공통 칼럼(12.5절): 모든 학습 기록 표
COMMON = {"user_id", "updated_at", "content_version", "server_seq"}

# DESIGN.md 5절(origin/m0-setup 판) 주요 칼럼 + 12.5절 열쇠 칼럼
DESIGN_COLUMNS = {
    "users": {"user_id", "path_id", "display_name", "created_at", "locale"},
    "auth_identity": {"provider", "subject", "user_id", "created_at"},
    "sessions": {"session_id", "user_id", "created_at", "expires_at"},
    "step_progress": COMMON | {
        "path_id", "step_id", "status", "max_hint_level", "attempts", "started_at", "done_at",
        "active_seconds_auto", "active_seconds_user",
    },
    "question_attempt": COMMON | {
        "question_id", "attempt_id", "attempt_no", "answer_text", "choice_index", "is_dont_know",
        "is_correct", "raw_points", "max_hint_level", "score_ratio", "points_awarded", "env_issue",
        "context", "at", "checkpoint_attempt_no",
    },
    "rebuild_attempt": COMMON | {"rebuild_id", "attempt_id", "attempt_no", "passed", "max_hint_level", "at"},
    "mastery_state": COMMON | {
        "target_id", "state", "steps_done_ratio", "question_score_ratio", "must_pass_ok",
        "rebuild_ok", "extra_checks_ok", "mastered_at",
    },
    "review_card": COMMON | {
        "card_id", "source_id", "kind", "interval_days", "due_at", "last_result", "history_json",
    },
    "grade_result": COMMON | {"check_id", "passed", "message_ko", "source", "at"},
    "user_pref": COMMON | {"pref_key", "value_json"},
    "checkpoint_attempt": COMMON | {
        "path_id", "checkpoint_id", "attempt_id", "attempt_no", "covers_json", "score_ratio", "passed",
        "max_hint_level", "hand_task_self_check_json", "started_at", "at",
    },
    "diagnostic_result": COMMON | {"attempt_id", "attempt_no", "answers_json", "recommended_units_json", "at"},
    "taster_result": COMMON | {
        "attempt_no", "step_id", "self_reported", "pasted_names_text", "pasted_loss_start",
        "pasted_loss_end", "share_card_id", "at",
    },
    "help_note": COMMON | {
        "note_id", "target_id", "goal_ko", "last_cell_code", "error_last_line", "env_json",
        "hints_seen_json", "created_at",
    },
    "study_session": COMMON | {"session_id", "target_id", "started_at", "ended_at", "active_seconds", "source"},
    "badge_def": {"badge_id", "name_ko", "rule_json", "icon", "version"},
    "user_badge": COMMON | {"badge_id", "earned_at", "evidence_json"},
    "share_card": COMMON | {
        "share_id", "kind", "payload_json", "image_path", "visibility", "created_at", "revoked_at",
    },
    "sync_conflicts": {"conflict_id", "user_id", "table_name", "row_key", "losing_json", "at"},
    "applied_ops": {"op_id", "user_id", "client_id", "table_name", "outcome", "at"},
}

# 12.5절 표별 PK(taster_result 는 5절 m0-setup 판)
DESIGN_PRIMARY_KEYS = {
    "users": ["user_id"],
    "step_progress": ["user_id", "step_id"],
    "question_attempt": ["user_id", "question_id", "attempt_id"],
    "rebuild_attempt": ["user_id", "rebuild_id", "attempt_id"],
    "checkpoint_attempt": ["user_id", "checkpoint_id", "attempt_id"],
    "diagnostic_result": ["user_id", "attempt_id"],
    "study_session": ["user_id", "session_id"],
    "help_note": ["user_id", "note_id"],
    "mastery_state": ["user_id", "target_id"],
    "review_card": ["user_id", "card_id"],
    "taster_result": ["user_id", "attempt_no", "step_id"],
    "grade_result": ["user_id", "check_id"],
    "user_pref": ["user_id", "pref_key"],
    "user_badge": ["user_id", "badge_id"],
    "share_card": ["share_id"],
    "sync_conflicts": ["conflict_id"],
    "applied_ops": ["op_id"],
}


@pytest.fixture
def inspector(template_db):
    engine = sa.create_engine(sqlite_url(template_db))
    yield sa.inspect(engine)
    engine.dispose()


def test_every_learning_record_table_has_user_id(inspector):
    tables = set(inspector.get_table_names()) - NOT_USER_TABLES
    assert tables, "표가 하나도 없다"
    missing = []
    for name in sorted(tables):
        cols = {c["name"]: c for c in inspector.get_columns(name)}
        if "user_id" not in cols:
            missing.append(name)
        elif name != "users":
            assert cols["user_id"]["nullable"] is False, f"{name}.user_id 가 비어도 되면 안 됨"
    assert missing == [], f"user_id 없는 표: {missing}"


def test_every_user_id_is_a_real_foreign_key_with_cascade(inspector):
    """D43: 모든 기록 표의 user_id 는 users 로 가는 실제 FK, ON DELETE CASCADE(5절)."""
    for name in sorted(set(inspector.get_table_names()) - NOT_USER_TABLES - {"users"}):
        fks = [fk for fk in inspector.get_foreign_keys(name) if fk["constrained_columns"] == ["user_id"]]
        assert len(fks) == 1, f"{name}: user_id FK 없음"
        assert fks[0]["referred_table"] == "users" and fks[0]["referred_columns"] == ["user_id"]
        assert (fks[0].get("options") or {}).get("ondelete", "").upper() == "CASCADE", name


def test_design_columns_exist(inspector):
    for table, expected in DESIGN_COLUMNS.items():
        actual = {c["name"] for c in inspector.get_columns(table)}
        assert expected <= actual, f"{table} 에 없는 칼럼: {sorted(expected - actual)}"


def test_design_primary_keys(inspector):
    for table, expected in DESIGN_PRIMARY_KEYS.items():
        pk = inspector.get_pk_constraint(table)["constrained_columns"]
        assert pk == expected, f"{table} PK {pk} != {expected}"


def test_time_columns_are_text_on_sqlite_and_timestamptz_on_postgres():
    table = schema.metadata.tables["step_progress"]
    pg = str(CreateTable(table).compile(dialect=postgresql.dialect()))
    lite = str(CreateTable(table).compile(dialect=sqlite.dialect()))
    assert re.search(r"updated_at TIMESTAMP WITH TIME ZONE NOT NULL", pg)
    assert re.search(r"updated_at VARCHAR\(40\) NOT NULL", lite)


def test_every_table_compiles_for_postgres():
    for table in schema.metadata.sorted_tables:
        CreateTable(table).compile(dialect=postgresql.dialect())


BANNED_SQL = [
    r"INSERT\s+OR\s+REPLACE",
    r"INSERT\s+OR\s+IGNORE",
    r"REPLACE\s+INTO",
    r"ON\s+CONFLICT",
    r"on_conflict_do",
    r"sqlalchemy\.dialects\.sqlite",
    r"\bjson_extract\b",
]


def _without_comments(source: str) -> str:
    """# 주석만 뺀 코드(문자열은 남김. SQL 은 문자열 안에 있으므로)."""
    tokens = [t for t in tokenize.generate_tokens(io.StringIO(source).readline) if t.type != tokenize.COMMENT]
    return tokenize.untokenize(tokens)


def test_no_sqlite_only_sql_in_server_code():
    files = list((SERVER_DIR / "z2h_server").rglob("*.py")) + list((SERVER_DIR / "alembic").rglob("*.py"))
    assert files
    hits = []
    for path in files:
        text = _without_comments(path.read_text(encoding="utf-8"))
        for pattern in BANNED_SQL:
            if re.search(pattern, text, flags=re.IGNORECASE):
                hits.append(f"{path.relative_to(SERVER_DIR)}: {pattern}")
        if "PRAGMA" in text.upper() and path.name != "sqlite.py":
            hits.append(f"{path.relative_to(SERVER_DIR)}: PRAGMA 는 SqliteAdapter 안에만")
    assert hits == []


def test_no_create_all_in_server_code():
    """표는 마이그레이션으로만 만든다(서버 코드가 create_all 하지 않음)."""
    for path in (SERVER_DIR / "z2h_server").rglob("*.py"):
        assert "create_all(" not in path.read_text(encoding="utf-8"), path


UUID_LITERAL = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


def test_no_fixed_user_id_in_server_code():
    """D43: 서버 코드와 마이그레이션 어디에도 고정 user_id 를 박지 않는다."""
    files = list((SERVER_DIR / "z2h_server").rglob("*.py")) + list((SERVER_DIR / "alembic").rglob("*.py"))
    hits = [str(p.relative_to(SERVER_DIR)) for p in files if UUID_LITERAL.search(p.read_text(encoding="utf-8"))]
    assert hits == []
    assert "FIXED_USER_ID" not in "".join(p.read_text(encoding="utf-8") for p in files)


def test_step_counts_are_not_hardcoded():
    """단계 수(01편 26, 전체 169, 맛보기 8)는 콘텐츠에서 센다. 서버가 알 필요 없음."""
    text = "".join(p.read_text(encoding="utf-8") for p in (SERVER_DIR / "z2h_server").rglob("*.py"))
    for n in ("169", "단계 26", "26단계", "22단계"):
        assert n not in text
