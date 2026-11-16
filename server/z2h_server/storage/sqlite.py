"""SqliteAdapter: 맥미니 프로토타입용. SQLite 파일 하나.

SQLite 에만 있는 설정(PRAGMA)은 이 파일의 연결 설정에만 둔다. 데이터 SQL 은 공통 SqlAdapter 의 표준 SQL.
"""

from __future__ import annotations

from pathlib import Path

import sqlalchemy as sa

from ..config import sqlite_url
from .sql import SqlAdapter


def _enable_foreign_keys(dbapi_conn, _record) -> None:
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


class SqliteAdapter(SqlAdapter):
    def __init__(self, path_or_url: Path | str):
        text = str(path_or_url)
        url = text if text.startswith("sqlite:") else sqlite_url(path_or_url)
        engine = sa.create_engine(url, connect_args={"check_same_thread": False, "timeout": 30})
        sa.event.listen(engine, "connect", _enable_foreign_keys)
        super().__init__(engine)
