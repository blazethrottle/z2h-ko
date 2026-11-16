"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

규칙: SQLite와 Postgres 둘 다 도는 타입만. 시각은 String(40).with_variant(TIMESTAMPTZ, "postgresql").
서버 코드(z2h_server)를 가져다 쓰지 않는다. upgrade/downgrade 둘 다 쓴다.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
${imports if imports else ""}

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
