"""첫 스키마: DESIGN.md 5절(origin/m0-setup 판) 표 전부 + 12.5절(server_seq, attempt_id 열쇠, 표별 PK).

Revision ID: 0001
Revises:
Create Date: 2026-11-16

- 계정별 구조(D43): users 와, users 로 가는 실제 FK(ON DELETE CASCADE)를 가진 모든 기록 표.
  고정 사용자 행은 넣지 않는다(계정은 AuthAdapter 가 만든다).
- SQLite와 Postgres 둘 다 도는 타입만 쓴다(String, Text, Integer, Float, Boolean).
- 시각: SQLite는 '+09:00' ISO 글자(VARCHAR(40)), Postgres는 TIMESTAMPTZ.
- JSON 칸(*_json)은 Text 에 JSON 글자로 저장한다.
- 이 파일은 서버 코드(z2h_server)를 가져다 쓰지 않는다. 코드가 바뀌어도 이 이력은 그대로여야 한다.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def T():
    """시각 칼럼 타입: SQLite는 글자, Postgres는 TIMESTAMPTZ."""
    return sa.String(40).with_variant(postgresql.TIMESTAMP(timezone=True), "postgresql")


def ID(length=64):
    return sa.String(length)


def user_col():
    return sa.Column("user_id", sa.String(36), nullable=False)


def user_fk(table):
    return sa.ForeignKeyConstraint(
        ["user_id"], ["users.user_id"], name=f"fk_{table}_user_id", ondelete="CASCADE"
    )


def pk(table, *cols):
    return sa.PrimaryKeyConstraint(*cols, name=f"pk_{table}")


def uq(table, *cols):
    return sa.UniqueConstraint(*cols, name=f"uq_{table}_{'_'.join(cols)}")


def common():
    """모든 학습 기록 표의 공통 칼럼(12.5절) + 서버 칸 last_client_id."""
    return [
        sa.Column("updated_at", T(), nullable=False),
        sa.Column("content_version", sa.String(64), nullable=True),
        sa.Column("server_seq", sa.Integer, nullable=False),
        sa.Column("last_client_id", sa.String(64), nullable=True),
    ]


def path_col():
    return sa.Column("path_id", sa.String(20), nullable=False)


# 학습 기록 표(동기화 대상). 내리기 때 이 순서의 반대로 지운다.
SYNC_TABLES = [
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
    "user_badge",
    "share_card",
]


def upgrade() -> None:
    # ---------- 계정 ----------
    op.create_table(
        "users",
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("path_id", sa.String(20), nullable=False, server_default="full"),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("created_at", T(), nullable=False),
        sa.Column("locale", sa.String(16), nullable=True),
        pk("users", "user_id"),
    )
    op.create_table(
        "auth_identity",
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        user_col(),
        sa.Column("created_at", T(), nullable=False),
        pk("auth_identity", "provider", "subject"),
        user_fk("auth_identity"),
    )
    op.create_index("ix_auth_identity_user", "auth_identity", ["user_id"])
    op.create_table(
        "sessions",
        sa.Column("session_id", sa.String(128), nullable=False),
        user_col(),
        sa.Column("created_at", T(), nullable=False),
        sa.Column("expires_at", T(), nullable=False),
        pk("sessions", "session_id"),
        user_fk("sessions"),
    )
    op.create_index("ix_sessions_user", "sessions", ["user_id"])

    # ---------- 학습 기록 ----------
    op.create_table(
        "step_progress",
        user_col(),
        sa.Column("step_id", ID(), nullable=False),
        path_col(),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("max_hint_level", sa.Integer, nullable=True),
        sa.Column("attempts", sa.Integer, nullable=True),
        sa.Column("started_at", T(), nullable=True),
        sa.Column("done_at", T(), nullable=True),
        sa.Column("active_seconds_auto", sa.Integer, nullable=True),
        sa.Column("active_seconds_user", sa.Integer, nullable=True),
        sa.Column("prediction", sa.Text, nullable=True),
        *common(),
        pk("step_progress", "user_id", "step_id"),
        user_fk("step_progress"),
    )

    op.create_table(
        "question_attempt",
        user_col(),
        sa.Column("question_id", ID(), nullable=False),
        sa.Column("attempt_id", ID(), nullable=False),
        sa.Column("attempt_no", sa.Integer, nullable=False),
        sa.Column("answer_text", sa.Text, nullable=True),
        sa.Column("choice_index", sa.Integer, nullable=True),
        sa.Column("is_dont_know", sa.Boolean, nullable=False),
        sa.Column("is_correct", sa.Boolean, nullable=True),
        sa.Column("raw_points", sa.Float, nullable=True),
        sa.Column("max_hint_level", sa.Integer, nullable=True),
        sa.Column("score_ratio", sa.Float, nullable=True),
        sa.Column("points_awarded", sa.Float, nullable=True),
        sa.Column("env_issue", sa.Boolean, nullable=False),
        sa.Column("context", sa.String(20), nullable=True),
        sa.Column("checkpoint_attempt_id", ID(), nullable=True),
        sa.Column("checkpoint_attempt_no", sa.Integer, nullable=True),
        sa.Column("at", T(), nullable=True),
        *common(),
        pk("question_attempt", "user_id", "question_id", "attempt_id"),
        user_fk("question_attempt"),
        uq("question_attempt", "user_id", "question_id", "attempt_no"),
    )

    op.create_table(
        "rebuild_attempt",
        user_col(),
        sa.Column("rebuild_id", ID(), nullable=False),
        sa.Column("attempt_id", ID(), nullable=False),
        sa.Column("attempt_no", sa.Integer, nullable=False),
        sa.Column("passed", sa.Boolean, nullable=True),
        sa.Column("max_hint_level", sa.Integer, nullable=True),
        sa.Column("at", T(), nullable=True),
        *common(),
        pk("rebuild_attempt", "user_id", "rebuild_id", "attempt_id"),
        user_fk("rebuild_attempt"),
        uq("rebuild_attempt", "user_id", "rebuild_id", "attempt_no"),
    )

    op.create_table(
        "mastery_state",
        user_col(),
        sa.Column("target_id", ID(), nullable=False),
        sa.Column("state", sa.String(20), nullable=True),
        sa.Column("steps_done_ratio", sa.Float, nullable=True),
        sa.Column("question_score_ratio", sa.Float, nullable=True),
        sa.Column("must_pass_ok", sa.Boolean, nullable=True),
        sa.Column("rebuild_ok", sa.Boolean, nullable=True),
        sa.Column("extra_checks_ok", sa.Boolean, nullable=True),
        sa.Column("mastered_at", T(), nullable=True),
        *common(),
        pk("mastery_state", "user_id", "target_id"),
        user_fk("mastery_state"),
    )

    op.create_table(
        "review_card",
        user_col(),
        sa.Column("card_id", ID(), nullable=False),
        sa.Column("source_id", ID(), nullable=True),
        sa.Column("kind", sa.String(20), nullable=True),
        sa.Column("interval_days", sa.Integer, nullable=True),
        sa.Column("due_at", sa.String(40), nullable=True),
        sa.Column("last_result", sa.String(20), nullable=True),
        sa.Column("history_json", sa.Text, nullable=True),
        *common(),
        pk("review_card", "user_id", "card_id"),
        user_fk("review_card"),
    )

    op.create_table(
        "grade_result",
        user_col(),
        sa.Column("check_id", ID(), nullable=False),
        sa.Column("passed", sa.Boolean, nullable=False),
        sa.Column("message_ko", sa.Text, nullable=True),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("at", T(), nullable=True),
        *common(),
        pk("grade_result", "user_id", "check_id"),
        user_fk("grade_result"),
    )

    op.create_table(
        "user_pref",
        user_col(),
        sa.Column("pref_key", ID(), nullable=False),
        sa.Column("value_json", sa.Text, nullable=True),
        *common(),
        pk("user_pref", "user_id", "pref_key"),
        user_fk("user_pref"),
    )

    op.create_table(
        "checkpoint_attempt",
        user_col(),
        sa.Column("checkpoint_id", ID(16), nullable=False),
        sa.Column("attempt_id", ID(), nullable=False),
        sa.Column("attempt_no", sa.Integer, nullable=False),
        path_col(),
        sa.Column("covers_json", sa.Text, nullable=True),
        sa.Column("score_ratio", sa.Float, nullable=True),
        sa.Column("passed", sa.Boolean, nullable=True),
        sa.Column("max_hint_level", sa.Integer, nullable=True),
        sa.Column("hand_task_self_check_json", sa.Text, nullable=True),
        sa.Column("started_at", T(), nullable=True),
        sa.Column("at", T(), nullable=True),
        *common(),
        pk("checkpoint_attempt", "user_id", "checkpoint_id", "attempt_id"),
        user_fk("checkpoint_attempt"),
        uq("checkpoint_attempt", "user_id", "checkpoint_id", "attempt_no"),
    )

    op.create_table(
        "diagnostic_result",
        user_col(),
        sa.Column("attempt_id", ID(), nullable=False),
        sa.Column("attempt_no", sa.Integer, nullable=False),
        sa.Column("answers_json", sa.Text, nullable=True),
        sa.Column("recommended_units_json", sa.Text, nullable=True),
        sa.Column("at", T(), nullable=True),
        *common(),
        pk("diagnostic_result", "user_id", "attempt_id"),
        user_fk("diagnostic_result"),
        uq("diagnostic_result", "user_id", "attempt_no"),
    )

    op.create_table(
        "taster_result",
        user_col(),
        sa.Column("attempt_no", sa.Integer, nullable=False, autoincrement=False),
        sa.Column("step_id", ID(), nullable=False),
        sa.Column("self_reported", sa.String(20), nullable=True),
        sa.Column("pasted_names_text", sa.Text, nullable=True),
        sa.Column("pasted_loss_start", sa.Float, nullable=True),
        sa.Column("pasted_loss_end", sa.Float, nullable=True),
        sa.Column("share_card_id", ID(), nullable=True),
        sa.Column("at", T(), nullable=True),
        *common(),
        pk("taster_result", "user_id", "attempt_no", "step_id"),
        user_fk("taster_result"),
    )

    op.create_table(
        "taste_result",
        user_col(),
        sa.Column("done_at", T(), nullable=True),
        sa.Column("loss_start", sa.Float, nullable=True),
        sa.Column("loss_end", sa.Float, nullable=True),
        sa.Column("names_json", sa.Text, nullable=True),
        sa.Column("source", sa.String(20), nullable=True),
        *common(),
        pk("taste_result", "user_id"),
        user_fk("taste_result"),
    )

    op.create_table(
        "help_note",
        user_col(),
        sa.Column("note_id", ID(), nullable=False),
        sa.Column("target_id", ID(), nullable=True),
        sa.Column("goal_ko", sa.Text, nullable=True),
        sa.Column("last_cell_code", sa.Text, nullable=True),
        sa.Column("error_last_line", sa.Text, nullable=True),
        sa.Column("env_json", sa.Text, nullable=True),
        sa.Column("hints_seen_json", sa.Text, nullable=True),
        sa.Column("created_at", T(), nullable=True),
        *common(),
        pk("help_note", "user_id", "note_id"),
        user_fk("help_note"),
    )

    op.create_table(
        "study_session",
        user_col(),
        sa.Column("session_id", ID(), nullable=False),
        sa.Column("target_id", ID(), nullable=True),
        sa.Column("started_at", T(), nullable=True),
        sa.Column("ended_at", T(), nullable=True),
        sa.Column("active_seconds", sa.Integer, nullable=True),
        sa.Column("source", sa.String(10), nullable=True),
        *common(),
        pk("study_session", "user_id", "session_id"),
        user_fk("study_session"),
    )

    # 배지 정의. 규칙은 badge_rules 설정에서 rule_json 으로 담는다(계산 코드는 아직 없음). 빈 표로 시작.
    op.create_table(
        "badge_def",
        sa.Column("badge_id", sa.String(64), nullable=False),
        sa.Column("name_ko", sa.String(200), nullable=True),
        sa.Column("rule_json", sa.Text, nullable=True),
        sa.Column("icon", sa.String(200), nullable=True),
        sa.Column("version", sa.Integer, nullable=True),
        pk("badge_def", "badge_id"),
    )

    op.create_table(
        "user_badge",
        user_col(),
        sa.Column("badge_id", ID(), nullable=False),
        sa.Column("earned_at", T(), nullable=True),
        sa.Column("evidence_json", sa.Text, nullable=True),
        *common(),
        pk("user_badge", "user_id", "badge_id"),
        user_fk("user_badge"),
    )

    # share_id 는 추측할 수 없는 임의 값. 공개 공유 주소는 공개 배포 승인 뒤라 visibility 기본 private.
    op.create_table(
        "share_card",
        sa.Column("share_id", sa.String(64), nullable=False),
        user_col(),
        sa.Column("kind", ID(32), nullable=True),
        sa.Column("payload_json", sa.Text, nullable=True),
        sa.Column("image_path", sa.String(500), nullable=True),
        sa.Column("visibility", sa.String(16), nullable=False),
        sa.Column("created_at", T(), nullable=True),
        sa.Column("revoked_at", T(), nullable=True),
        *common(),
        pk("share_card", "share_id"),
        user_fk("share_card"),
    )

    for table in SYNC_TABLES:
        op.create_index(f"ix_{table}_seq", table, ["user_id", "server_seq"])

    # ---------- 동기화 관리 ----------
    op.create_table(
        "sync_conflicts",
        sa.Column("conflict_id", sa.Integer, nullable=False, autoincrement=True),
        user_col(),
        sa.Column("table_name", sa.String(64), nullable=False),
        sa.Column("row_key", sa.Text, nullable=False),
        sa.Column("losing_json", sa.Text, nullable=False),
        sa.Column("at", T(), nullable=False),
        pk("sync_conflicts", "conflict_id"),
        user_fk("sync_conflicts"),
    )
    op.create_index("ix_sync_conflicts_user_at", "sync_conflicts", ["user_id", "at"])

    op.create_table(
        "applied_ops",
        sa.Column("op_id", sa.String(128), nullable=False),
        user_col(),
        sa.Column("client_id", sa.String(64), nullable=False),
        sa.Column("table_name", sa.String(64), nullable=False),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column("at", T(), nullable=False),
        pk("applied_ops", "op_id"),
        user_fk("applied_ops"),
    )

    counter = op.create_table(
        "sync_counter",
        sa.Column("name", sa.String(32), nullable=False),
        sa.Column("value", sa.Integer, nullable=False),
        pk("sync_counter", "name"),
    )
    op.bulk_insert(counter, [{"name": "server_seq", "value": 0}])


def downgrade() -> None:
    op.drop_table("sync_counter")
    op.drop_table("applied_ops")
    op.drop_index("ix_sync_conflicts_user_at", table_name="sync_conflicts")
    op.drop_table("sync_conflicts")
    for table in reversed(SYNC_TABLES):
        op.drop_index(f"ix_{table}_seq", table_name=table)
        op.drop_table(table)
    op.drop_table("badge_def")
    op.drop_index("ix_sessions_user", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index("ix_auth_identity_user", table_name="auth_identity")
    op.drop_table("auth_identity")
    op.drop_table("users")
