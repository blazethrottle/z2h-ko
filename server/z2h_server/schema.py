"""서버 코드가 쓰는 표 정의(SQLAlchemy Core).

- 표를 실제로 만드는 것은 alembic/versions/ 의 마이그레이션뿐이다. 이 파일로 create_all 하지 않는다.
- tests/test_migrations.py 가 이 정의와 마이그레이션 결과가 같은지 대조한다.
- 칼럼 `info` 에는 동기화 검사 규칙(종류·허용값·범위·기본값·API 이름)을 적는다. sync.py 가 읽는다.
- 시각 칼럼은 SQLite에서 '+09:00' ISO 글자, Postgres에서 TIMESTAMPTZ(같은 마이그레이션에서 매핑).
- 근거: docs/DESIGN.md 5절(origin/m0-setup 판) + 12.5절(server_seq, attempt_id 열쇠, 표별 PK).
"""

from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.types import TypeDecorator

from .timeutil import parse_time, to_kst_iso


class KstTime(TypeDecorator):
    """+09:00 ISO 문자열로 주고받는 시각. Postgres에서는 TIMESTAMPTZ 로 저장."""

    impl = sa.String(40)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(postgresql.TIMESTAMP(timezone=True))
        return dialect.type_descriptor(sa.String(40))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return parse_time(value)
        return value

    def process_result_value(self, value, dialect):
        if isinstance(value, datetime):
            return to_kst_iso(value)
        return value


# 제약 이름 규칙. 마이그레이션 파일도 같은 이름을 직접 적는다.
NAMING = {
    "pk": "pk_%(table_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
}
metadata = sa.MetaData(naming_convention=NAMING)


# ---- 허용값 ----
STEP_STATUS = ("not_started", "in_progress", "done", "skipped_optional")
PATH_IDS = ("full", "office_worker", "investor")  # 학습자 길(data-spec v1.2 검수 규칙 12)
QUESTION_CONTEXT = ("step", "checkpoint", "bridge", "taste")  # 다리 카드 응답은 bridge
MASTERY_STATE = ("locked", "open", "in_progress", "almost", "mastered", "revisit")
CARD_KIND = ("concept", "predict", "hands_on")
CARD_RESULT = ("pass", "shaky", "miss")
GRADE_SOURCE = ("notebook", "result_code")
TASTER_SELF_REPORTED = ("similar", "different")  # "비슷해요 / 달라요"
SESSION_SOURCE = ("auto", "manual")
# 공개 공유 주소는 공개 배포 승인 뒤. 지금은 private 만 받는다.
SHARE_VISIBILITY = ("private",)
HINT_MAX = 5  # 1~4 힌트, 5 = HELP
# user_pref 키 꼴(12.5절). 검사 규칙일 뿐 DB 칸은 바뀌지 않는다. 값 모양은 sync.PREF_VALUE_RULES
PREF_KEY_FORMS = (
    "run_place",  # 실행 장소. 앱은 2026-11-18(Colab 고정)부터 쓰지 않지만 옛 값을 받는다
    "resume",  # 이어서 하기 위치
    r"practice_week:\d{4}-\d{2}-\d{2}",  # 주 단위로 고친 실습 시간
    r"legacy_progress:L\d{2}:[0-9A-Za-z][0-9A-Za-z.]*",  # 옛 판 진도 보관본(앱 src/lib/migrate, 옛 행 JSON 그대로)
    "course",  # 진단·건너뛰기·설정이 정한 코스와 바뀐 이력
    "course_intro_done",  # 입문 코스 마침
    "guided_mode",  # 안내형 길 켜기·끄기
    r"test_out:F-[PMB]\d+",  # 기초 단위 하나의 "이미 알아요" 시험 기록
)
PREF_KEY_PATTERN = "^(" + "|".join(PREF_KEY_FORMS) + ")$"


# ---- 칼럼 만들기 도우미 (info 에 검사 규칙) ----


def _user_id(**kw):
    return sa.Column(
        "user_id", sa.String(36), sa.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, **kw
    )


def _id(name, length=64, **kw):
    info = {"kind": "id", **kw.pop("info", {})}
    return sa.Column(name, sa.String(length), info=info, **kw)


def _int(name, *, min=None, max=None, default=None, **kw):
    return sa.Column(name, sa.Integer, info={"kind": "int", "min": min, "max": max, "default": default}, **kw)


def _float(name, *, min=None, max=None, **kw):
    return sa.Column(name, sa.Float, info={"kind": "float", "min": min, "max": max}, **kw)


def _bool(name, *, default=None, **kw):
    return sa.Column(name, sa.Boolean, info={"kind": "bool", "default": default}, **kw)


def _time(name, **kw):
    return sa.Column(name, KstTime(), info={"kind": "time"}, **kw)


def _text(name, **kw):
    return sa.Column(name, sa.Text, info={"kind": "text"}, **kw)


def _json(name, *, api=None, **kw):
    assert name.endswith("_json")
    return sa.Column(name, sa.Text, info={"kind": "json", "api": api}, **kw)


def _enum(name, values, length=20, *, default=None, **kw):
    return sa.Column(
        name, sa.String(length), info={"kind": "enum", "values": tuple(values), "default": default}, **kw
    )


def _str(name, length, **kw):
    return sa.Column(name, sa.String(length), info={"kind": "str", "max_len": length}, **kw)


def _path_id():
    return _enum("path_id", PATH_IDS, default="full", nullable=False)


def _attempt_id():
    """쌓이는 기록의 열쇠. 기기가 만든 UUID(12.5절)."""
    return _id("attempt_id", primary_key=True)


def _attempt_no(*group):
    """서버가 도착 순서로 매기는 번호. 기기가 보내도 무시한다."""
    return sa.Column("attempt_no", sa.Integer, nullable=False, info={"kind": "server_no", "group": group})


def _common(table: str):
    """모든 학습 기록 표의 공통 칼럼(12.5절) + 서버 칸 last_client_id + since 조회용 색인."""
    return [
        sa.Column("updated_at", KstTime(), nullable=False, info={"kind": "meta"}),
        _str("content_version", 64, nullable=True),
        sa.Column("server_seq", sa.Integer, nullable=False, info={"kind": "meta"}),
        sa.Column("last_client_id", sa.String(64), nullable=True, info={"kind": "meta"}),
        sa.Index(f"ix_{table}_seq", "user_id", "server_seq"),
    ]


# ---------------- 계정 ----------------

users = sa.Table(
    "users",
    metadata,
    sa.Column("user_id", sa.String(36), primary_key=True),
    sa.Column("path_id", sa.String(20), nullable=False, server_default="full"),
    sa.Column("display_name", sa.String(100), nullable=True),
    sa.Column("created_at", KstTime(), nullable=False),
    sa.Column("locale", sa.String(16), nullable=True),
)

# AuthAdapter 뒤. provider: dev_local(맥 개발용), tailscale(폰, subject = 소문자 로그인 이름), email_otp·google(공개 승인 뒤)
auth_identity = sa.Table(
    "auth_identity",
    metadata,
    sa.Column("provider", sa.String(32), primary_key=True),
    sa.Column("subject", sa.String(255), primary_key=True),
    _user_id(),
    sa.Column("created_at", KstTime(), nullable=False),
    sa.Index("ix_auth_identity_user", "user_id"),
)

# 로컬 개발 로그인 세션. session_id 칸에는 쿠키 값 자체가 아니라 그 SHA-256 을 담는다.
sessions = sa.Table(
    "sessions",
    metadata,
    sa.Column("session_id", sa.String(128), primary_key=True),
    _user_id(),
    sa.Column("created_at", KstTime(), nullable=False),
    sa.Column("expires_at", KstTime(), nullable=False),
    sa.Index("ix_sessions_user", "user_id"),
)


# ---------------- 학습 기록 ----------------

step_progress = sa.Table(
    "step_progress",
    metadata,
    _user_id(primary_key=True),
    _id("step_id", primary_key=True),
    _path_id(),
    _enum("status", STEP_STATUS, default="not_started", nullable=False),
    _int("max_hint_level", min=0, max=HINT_MAX, default=0, nullable=True),
    _int("attempts", min=0, default=0, nullable=True),
    _time("started_at", nullable=True),
    _time("done_at", nullable=True),
    _int("active_seconds_auto", min=0, default=0, nullable=True),
    _int("active_seconds_user", min=0, nullable=True),
    _text("prediction", nullable=True),
    *_common("step_progress"),
)

question_attempt = sa.Table(
    "question_attempt",
    metadata,
    _user_id(primary_key=True),
    _id("question_id", primary_key=True),
    _attempt_id(),
    _attempt_no("question_id"),
    _text("answer_text", nullable=True),
    _int("choice_index", min=0, nullable=True),
    _bool("is_dont_know", default=False, nullable=False),
    _bool("is_correct", nullable=True),
    _float("raw_points", nullable=True),
    _int("max_hint_level", min=0, max=HINT_MAX, nullable=True),
    _float("score_ratio", min=0, max=1, nullable=True),
    _float("points_awarded", nullable=True),
    _bool("env_issue", default=False, nullable=False),
    _enum("context", QUESTION_CONTEXT, nullable=True),
    # 누적 점검 시도와 잇는 칸. 번호는 서버가 매기므로 기기는 attempt_id 로 잇고, 서버가 번호를 채운다.
    _id("checkpoint_attempt_id", nullable=True),
    _int("checkpoint_attempt_no", min=1, nullable=True),
    _time("at", nullable=True),
    *_common("question_attempt"),
    sa.UniqueConstraint("user_id", "question_id", "attempt_no"),
)

rebuild_attempt = sa.Table(
    "rebuild_attempt",
    metadata,
    _user_id(primary_key=True),
    _id("rebuild_id", primary_key=True),
    _attempt_id(),
    _attempt_no("rebuild_id"),
    _bool("passed", nullable=True),
    _int("max_hint_level", min=0, max=HINT_MAX, nullable=True),
    _time("at", nullable=True),
    *_common("rebuild_attempt"),
    sa.UniqueConstraint("user_id", "rebuild_id", "attempt_no"),
)

mastery_state = sa.Table(
    "mastery_state",
    metadata,
    _user_id(primary_key=True),
    _id("target_id", primary_key=True),
    _enum("state", MASTERY_STATE, nullable=True),
    _float("steps_done_ratio", min=0, max=1, nullable=True),
    _float("question_score_ratio", min=0, max=1, nullable=True),
    _bool("must_pass_ok", nullable=True),
    _bool("rebuild_ok", nullable=True),
    _bool("extra_checks_ok", nullable=True),
    _time("mastered_at", nullable=True),
    *_common("mastery_state"),
)

review_card = sa.Table(
    "review_card",
    metadata,
    _user_id(primary_key=True),
    _id("card_id", primary_key=True),
    _id("source_id", nullable=True),
    _enum("kind", CARD_KIND, nullable=True),
    _int("interval_days", min=0, nullable=True),
    sa.Column("due_at", sa.String(40), nullable=True, info={"kind": "date_or_time"}),
    _enum("last_result", CARD_RESULT, nullable=True),
    _json("history_json", nullable=True),
    *_common("review_card"),
)

grade_result = sa.Table(
    "grade_result",
    metadata,
    _user_id(primary_key=True),
    _id("check_id", primary_key=True),
    _bool("passed", nullable=False),
    _text("message_ko", nullable=True),
    _enum("source", GRADE_SOURCE, nullable=False),
    _time("at", nullable=True),
    *_common("grade_result"),
)

user_pref = sa.Table(
    "user_pref",
    metadata,
    _user_id(primary_key=True),
    _id("pref_key", primary_key=True, info={"pattern": PREF_KEY_PATTERN}),
    _json("value_json", nullable=True),
    *_common("user_pref"),
)

checkpoint_attempt = sa.Table(
    "checkpoint_attempt",
    metadata,
    _user_id(primary_key=True),
    _id("checkpoint_id", 16, primary_key=True),
    _attempt_id(),
    _attempt_no("checkpoint_id"),
    _path_id(),
    _json("covers_json", nullable=True),
    _float("score_ratio", min=0, max=1, nullable=True),
    _bool("passed", nullable=True),
    # 12.5절: 이 칸은 data-spec 의 max_hint_level_allowed 와 같은 값. API 이름은 data-spec 이름.
    sa.Column(
        "max_hint_level",
        sa.Integer,
        nullable=True,
        info={"kind": "int", "min": 0, "max": HINT_MAX, "api": "max_hint_level_allowed"},
    ),
    _json("hand_task_self_check_json", nullable=True),
    _time("started_at", nullable=True),
    _time("at", nullable=True),
    *_common("checkpoint_attempt"),
    sa.UniqueConstraint("user_id", "checkpoint_id", "attempt_no"),
)

diagnostic_result = sa.Table(
    "diagnostic_result",
    metadata,
    _user_id(primary_key=True),
    _attempt_id(),
    _attempt_no(),
    _json("answers_json", nullable=True),
    _json("recommended_units_json", nullable=True),
    _time("at", nullable=True),
    *_common("diagnostic_result"),
    sa.UniqueConstraint("user_id", "attempt_no"),
)

# 맛보기 단계별 본인 확인 + 붙여넣은 값(검증 안 된 값). PK 는 5절(m0-setup 판) 그대로.
taster_result = sa.Table(
    "taster_result",
    metadata,
    _user_id(primary_key=True),
    _int("attempt_no", min=1, primary_key=True, autoincrement=False),
    _id("step_id", primary_key=True),
    _enum("self_reported", TASTER_SELF_REPORTED, nullable=True),
    _text("pasted_names_text", nullable=True),
    _float("pasted_loss_start", nullable=True),
    _float("pasted_loss_end", nullable=True),
    _id("share_card_id", nullable=True),
    _time("at", nullable=True),
    *_common("taster_result"),
)

# (예전 taste_result 표는 0002 마이그레이션에서 지웠다. 맛보기 기록은 위 taster_result 하나.)

help_note = sa.Table(
    "help_note",
    metadata,
    _user_id(primary_key=True),
    _id("note_id", primary_key=True),
    _id("target_id", nullable=True),
    _text("goal_ko", nullable=True),
    _text("last_cell_code", nullable=True),
    _text("error_last_line", nullable=True),
    _json("env_json", nullable=True),
    _json("hints_seen_json", nullable=True),
    _time("created_at", nullable=True),
    *_common("help_note"),
)

study_session = sa.Table(
    "study_session",
    metadata,
    _user_id(primary_key=True),
    _id("session_id", primary_key=True),
    _id("target_id", nullable=True),
    _time("started_at", nullable=True),
    _time("ended_at", nullable=True),
    _int("active_seconds", min=0, nullable=True),
    _enum("source", SESSION_SOURCE, 10, nullable=True),
    *_common("study_session"),
)

# 배지 정의. rule_json 은 badge_rules 설정에서 만든다(계산 코드는 아직 없음, D47).
badge_def = sa.Table(
    "badge_def",
    metadata,
    sa.Column("badge_id", sa.String(64), primary_key=True),
    sa.Column("name_ko", sa.String(200), nullable=True),
    sa.Column("rule_json", sa.Text, nullable=True),
    sa.Column("icon", sa.String(200), nullable=True),
    sa.Column("version", sa.Integer, nullable=True),
)

user_badge = sa.Table(
    "user_badge",
    metadata,
    _user_id(primary_key=True),
    _id("badge_id", primary_key=True),
    _time("earned_at", nullable=True),
    _json("evidence_json", nullable=True),
    *_common("user_badge"),
)

share_card = sa.Table(
    "share_card",
    metadata,
    sa.Column("share_id", sa.String(64), primary_key=True, info={"kind": "share_id"}),
    _user_id(),
    _id("kind", 32, nullable=True),
    _json("payload_json", nullable=True),
    _str("image_path", 500, nullable=True),
    _enum("visibility", SHARE_VISIBILITY, 16, default="private", nullable=False),
    _time("created_at", nullable=True),
    _time("revoked_at", nullable=True),
    *_common("share_card"),
)


# ---------------- 동기화 관리 ----------------

sync_conflicts = sa.Table(
    "sync_conflicts",
    metadata,
    sa.Column("conflict_id", sa.Integer, primary_key=True, autoincrement=True),
    _user_id(),
    sa.Column("table_name", sa.String(64), nullable=False),
    sa.Column("row_key", sa.Text, nullable=False),
    sa.Column("losing_json", sa.Text, nullable=False),
    sa.Column("at", KstTime(), nullable=False),
    sa.Index("ix_sync_conflicts_user_at", "user_id", "at"),
)

# 같은 op_id 를 두 번 반영하지 않기 위한 표(12.5절)
applied_ops = sa.Table(
    "applied_ops",
    metadata,
    sa.Column("op_id", sa.String(128), primary_key=True),
    _user_id(),
    sa.Column("client_id", sa.String(64), nullable=False),
    sa.Column("table_name", sa.String(64), nullable=False),
    sa.Column("outcome", sa.String(16), nullable=False),
    sa.Column("at", KstTime(), nullable=False),
)

# server_seq 를 내주는 번호표 한 줄(name='server_seq')
sync_counter = sa.Table(
    "sync_counter",
    metadata,
    sa.Column("name", sa.String(32), primary_key=True),
    sa.Column("value", sa.Integer, nullable=False),
)


# /api/sync 로 쓸 수 있는 표(사용자 학습 기록). 순서 = /api/state 응답 순서.
SYNC_TABLES = (
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
    "user_badge",
    "share_card",
)

# 쌓이는 기록: 열쇠에 기기가 만든 attempt_id·session_id·note_id 가 있어 열쇠가 다르면 둘 다 남는다.
ACCUMULATING_TABLES = (
    "question_attempt",
    "rebuild_attempt",
    "checkpoint_attempt",
    "diagnostic_result",
    "study_session",
    "help_note",
)
