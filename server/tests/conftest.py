"""진도 서버 테스트 공통 준비물.

- 마이그레이션은 세션마다 한 번 돌려 둔 SQLite 파일을 테스트마다 복사해 쓴다(빠르게).
- 어댑터 공통 테스트 묶음은 `adapter` fixture 하나로 받는다. 나중에 PostgresAdapter가 생기면
  ADAPTER_BACKENDS 에 이름 하나와 만드는 함수 하나만 더하면 같은 묶음이 그대로 돈다.
- 고정 사용자는 없다. 테스트마다 계정을 만든다(user, other_user, client 는 로그인된 상태).
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest

from helpers import login_new_account, make_client, new_user
from z2h_server import migrate
from z2h_server.config import Settings, sqlite_url
from z2h_server.storage.sqlite import SqliteAdapter


@pytest.fixture(scope="session")
def template_db(tmp_path_factory) -> Path:
    """head 까지 올린 빈 DB 한 벌(세션 공용, 직접 쓰지 않고 복사해서 쓴다)."""
    path = tmp_path_factory.mktemp("template") / "z2h.sqlite3"
    migrate.upgrade(sqlite_url(path))
    return path


@pytest.fixture
def db_path(template_db, tmp_path) -> Path:
    """테스트 하나가 혼자 쓰는 DB 파일."""
    path = tmp_path / "z2h.sqlite3"
    shutil.copyfile(template_db, path)
    return path


def _make_sqlite(db_path: Path):
    return SqliteAdapter(db_path)


def _make_postgres(db_path: Path):  # pragma: no cover - 나중에 Postgres 컨테이너로 돌림
    pytest.skip("PostgresAdapter는 아직 없다(나중 단계)")


# 어댑터 공통 테스트 묶음이 도는 저장소 목록. 기본은 SQLite 하나.
ADAPTER_BACKENDS = {"sqlite": _make_sqlite}
if os.environ.get("Z2H_TEST_PG_URL"):  # pragma: no cover
    ADAPTER_BACKENDS["postgres"] = _make_postgres


@pytest.fixture(params=sorted(ADAPTER_BACKENDS))
def adapter(request, db_path):
    made = ADAPTER_BACKENDS[request.param](db_path)
    try:
        yield made
    finally:
        made.close()


@pytest.fixture
def user(adapter) -> str:
    return new_user(adapter, "계정 A")


@pytest.fixture
def other_user(adapter) -> str:
    return new_user(adapter, "계정 B")


@pytest.fixture
def settings(tmp_path, db_path) -> Settings:
    return Settings(db_url=sqlite_url(db_path), app_dist=tmp_path / "no-dist")


@pytest.fixture
def anon_client(settings):
    """로그인하지 않은 브라우저."""
    with make_client(settings) as c:
        yield c


@pytest.fixture
def client(settings):
    """개발 계정 하나로 로그인한 브라우저. c.user_id 에 계정 id."""
    with make_client(settings) as c:
        c.user_id = login_new_account(c)
        yield c
