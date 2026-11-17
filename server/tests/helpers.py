"""테스트에서 같이 쓰는 작은 도우미."""

from __future__ import annotations

import uuid

from starlette.testclient import TestClient

from z2h_server.app import create_app
from z2h_server.config import Settings

BASE_URL = "http://127.0.0.1:8787"
ORIGIN = "http://127.0.0.1:8787"
LOOPBACK_PEER = ("127.0.0.1", 50000)


def make_client(settings: Settings, **kwargs) -> TestClient:
    kwargs.setdefault("base_url", BASE_URL)
    kwargs.setdefault("client", LOOPBACK_PEER)
    return TestClient(create_app(settings), **kwargs)


def login_new_account(client: TestClient, name: str = "테스트 계정", **extra) -> str:
    """개발 로그인으로 계정을 만들고 그 계정 쿠키를 client 에 남긴다. user_id 를 돌려준다."""
    r = client.post("/api/dev-auth/accounts", json={"display_name": name, **extra})
    assert r.status_code == 200, r.text
    return r.json()["user"]["user_id"]


def new_user(adapter, name: str = "계정") -> str:
    user_id = str(uuid.uuid4())
    adapter.create_user(user_id, display_name=name)
    return user_id


def aid() -> str:
    """기기가 만드는 attempt_id·note_id 같은 UUID."""
    return str(uuid.uuid4())


def op(op_id, table, key, data, updated_at, **extra):
    """동기화 요청 한 줄을 만든다."""
    item = {"op_id": op_id, "table": table, "key": key, "data": data, "updated_at": updated_at}
    item.update(extra)
    return item


def t(hhmmss: str, day: str = "2026-11-20") -> str:
    """'20:01:00' 같은 짧은 시각을 +09:00 ISO 문자열로."""
    return f"{day}T{hhmmss}+09:00"
