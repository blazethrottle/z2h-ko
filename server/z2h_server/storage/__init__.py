"""저장 계층. 서버는 StorageAdapter 로만 기록을 읽고 쓴다."""

from __future__ import annotations

import sqlalchemy as sa

from .base import GradeOutcome, StorageAdapter, SyncResult

__all__ = ["GradeOutcome", "StorageAdapter", "SyncResult", "open_adapter"]


def open_adapter(db_url: str) -> StorageAdapter:
    backend = sa.engine.make_url(db_url).get_backend_name()
    if backend == "sqlite":
        from .sqlite import SqliteAdapter

        return SqliteAdapter(db_url)
    raise NotImplementedError(f"{backend} 어댑터는 아직 없습니다(PostgresAdapter 는 나중 단계)")
