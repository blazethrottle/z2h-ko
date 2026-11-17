"""저장 계층. 서버는 StorageAdapter 로만 기록을 읽고 쓴다.

DB 종류를 아는 곳은 이 폴더뿐이다(그 밖에서는 open_adapter(settings.db_url) 와 prepare_location 만 쓴다).
Postgres 로 옮길 때 바꿀 곳(README 4-1절):
1. 이 폴더에 PostgresAdapter(SqlAdapter 를 이어받고 엔진 설정만 다르게) 파일 하나
2. 아래 open_adapter·prepare_location 의 postgresql 갈래
3. requirements.txt 에 Postgres 드라이버 하나
4. 환경변수 Z2H_DB_URL=postgresql://...
표·마이그레이션(alembic/versions)은 처음부터 Postgres 에서도 도는 표준 SQL 로 썼다(오프라인 SQL 생성까지 테스트).
"""

from __future__ import annotations

import sqlalchemy as sa

from ..config import DB_TIMEOUT_SECONDS
from .base import GradeOutcome, StorageAdapter, SyncResult

__all__ = [
    "DatabaseMissing",
    "GradeOutcome",
    "StorageAdapter",
    "SyncResult",
    "open_adapter",
    "prepare_location",
]


class DatabaseMissing(RuntimeError):
    """must_exist=True 로 열었는데 DB 가 없을 때(새로 만들지 않는다)."""


def _backend(db_url: str) -> str:
    return sa.engine.make_url(db_url).get_backend_name()


def open_adapter(db_url: str, *, timeout_seconds: float = DB_TIMEOUT_SECONDS, must_exist: bool = False) -> StorageAdapter:
    """DB 주소 → 저장 어댑터. must_exist=True 면 없는 DB 를 만들지 않고 DatabaseMissing."""
    backend = _backend(db_url)
    if backend == "sqlite":
        from .sqlite import SqliteAdapter, sqlite_file_missing

        if must_exist and sqlite_file_missing(db_url):
            raise DatabaseMissing("DB 파일이 없습니다.")
        return SqliteAdapter(db_url, timeout_seconds=timeout_seconds)
    raise NotImplementedError(f"{backend} 어댑터는 아직 없습니다(PostgresAdapter 는 나중 단계, 이 파일에 갈래 하나를 더한다)")


def prepare_location(db_url: str) -> None:
    """DB 를 처음 만들기 전에 할 일(SQLite: 파일이 들어갈 폴더 만들기). 마이그레이션 직전에 부른다."""
    if _backend(db_url) == "sqlite":
        from .sqlite import prepare_sqlite_folder

        prepare_sqlite_folder(db_url)
