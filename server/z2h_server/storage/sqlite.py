"""SqliteAdapter: 맥미니 프로토타입용. SQLite 파일 하나.

SQLite 에만 있는 설정(PRAGMA, 파일·폴더 다루기)은 이 파일에만 둔다. 데이터 SQL 은 공통 SqlAdapter 의 표준 SQL.
엔진 옵션 값은 설정(config.py)에서 온다: 기다리는 시간(Settings.db_timeout_seconds), SQL 값 숨김(DB_HIDE_PARAMETERS, 불변식).
"""

from __future__ import annotations

from pathlib import Path

import sqlalchemy as sa

from ..config import DB_HIDE_PARAMETERS, DB_TIMEOUT_SECONDS, sqlite_url
from .sql import SqlAdapter


def _enable_foreign_keys(dbapi_conn, _record) -> None:
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


def _file_of(db_url: str) -> Path | None:
    """sqlite:///경로 의 파일 경로. 메모리 DB 면 None."""
    database = sa.engine.make_url(db_url).database
    if not database or database == ":memory:":
        return None
    return Path(database)


def sqlite_file_missing(db_url: str) -> bool:
    path = _file_of(db_url)
    return path is not None and not path.exists()


def prepare_sqlite_folder(db_url: str) -> None:
    path = _file_of(db_url)
    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)


class SqliteAdapter(SqlAdapter):
    def __init__(self, path_or_url: Path | str, *, timeout_seconds: float = DB_TIMEOUT_SECONDS):
        text = str(path_or_url)
        url = text if text.startswith("sqlite:") else sqlite_url(path_or_url)
        # check_same_thread: FastAPI 가 요청을 여러 스레드에서 처리하므로 끈다(쓰기는 SqlAdapter 잠금으로 줄 세움)
        self.options = {"timeout_seconds": timeout_seconds, "hide_parameters": DB_HIDE_PARAMETERS}
        engine = sa.create_engine(
            url,
            connect_args={"check_same_thread": False, "timeout": timeout_seconds},
            hide_parameters=DB_HIDE_PARAMETERS,  # DB 오류 글에 SQL 값(로그인 이름·학습 기록)을 싣지 않는다
        )
        sa.event.listen(engine, "connect", _enable_foreign_keys)
        super().__init__(engine)
