"""taste_result 표를 지운다. 맛보기 기록은 taster_result 하나로 간다(얼큰이 결정).

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-17

- 근거: 앱(app/)은 taste_result 를 한 번도 읽거나 쓰지 않았다(PM 이 2026-11-17 에 app/ 전체를 grep 해 확인).
  맛보기 화면의 기록은 처음부터 taster_result(단계별 본인 확인과 붙여 넣은 값)에만 쌓였다.
- 그래서 올리기는 표를 그냥 지운다. 0001 상태 DB 에 taste_result 행이 있더라도(앱 밖에서 손으로 /api/sync 에
  보낸 것뿐일 수 있음) 그 행은 옮기지 않고 버린다. 다른 표의 기록은 건드리지 않는다.
- 내리기는 0001 과 같은 모양의 빈 taste_result 표(칼럼, PK, users FK ON DELETE CASCADE, ix_taste_result_seq)를 다시 만든다.
  버린 행은 되살리지 않는다.
- 0001 처럼 서버 코드(z2h_server)도, 0001 파일도 가져다 쓰지 않는다. 필요한 모양은 이 파일에 그대로 적었다.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

TABLE = "taste_result"


def T():
    """시각 칼럼 타입: SQLite는 글자, Postgres는 TIMESTAMPTZ(0001 과 같음)."""
    return sa.String(40).with_variant(postgresql.TIMESTAMP(timezone=True), "postgresql")


def upgrade() -> None:
    op.drop_index(f"ix_{TABLE}_seq", table_name=TABLE)
    op.drop_table(TABLE)


def downgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("done_at", T(), nullable=True),
        sa.Column("loss_start", sa.Float, nullable=True),
        sa.Column("loss_end", sa.Float, nullable=True),
        sa.Column("names_json", sa.Text, nullable=True),
        sa.Column("source", sa.String(20), nullable=True),
        sa.Column("updated_at", T(), nullable=False),
        sa.Column("content_version", sa.String(64), nullable=True),
        sa.Column("server_seq", sa.Integer, nullable=False),
        sa.Column("last_client_id", sa.String(64), nullable=True),
        sa.PrimaryKeyConstraint("user_id", name=f"pk_{TABLE}"),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], name=f"fk_{TABLE}_user_id", ondelete="CASCADE"),
    )
    op.create_index(f"ix_{TABLE}_seq", TABLE, ["user_id", "server_seq"])
