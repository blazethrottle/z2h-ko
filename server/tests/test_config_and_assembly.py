"""공개 전환 대비: 로그인 수단 조립은 한 곳(auth.build_auth), 설정값은 한 곳(config.py), DB 는 저장 계층 뒤.

- 설정 조합마다 어떤 로그인 수단이 서는지
- API 코드가 로그인 수단의 구체 이름·provider 글자로 가르지 않음(AuthAdapter 의 속성·메서드로)
- 새 쿠키 설정의 기본값 = 지금 동작(Set-Cookie 머리말 글자까지)
- 설정값(쿠키 이름, 127.0.0.1, localhost, 8787, DB 파일 이름)이 config.py 밖 소스에 박혀 있지 않음
- sqlite 를 아는 코드는 저장 계층(storage/)과 설정(config.py)뿐
"""

from __future__ import annotations

import ast
import logging
import os
import re
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

import pytest

from helpers import login_new_account, make_client
from z2h_server import auth as auth_mod
from z2h_server.auth import (
    AUTH_PROVIDERS,
    AuthAdapter,
    ByHostAuth,
    EmailOtpAuth,
    GoogleAuth,
    LocalDevAuth,
    NoAuth,
    TailscaleAuth,
    build_auth,
)
from z2h_server.config import (
    ConfigRefused,
    CookieSettings,
    Settings,
    load_settings,
    sqlite_url,
)
from z2h_server.storage import DatabaseMissing, open_adapter, prepare_location

SERVER_DIR = Path(__file__).resolve().parents[1]
PKG = SERVER_DIR / "z2h_server"
SERVE = "macmini.example-tailnet.ts.net"


# ---------- 로그인 수단 조립: 설정 → 수단 ----------


@pytest.fixture
def storage(adapter):
    return adapter


def test_default_settings_build_local_dev_login(settings, storage):
    built = build_auth(settings, storage)
    assert type(built) is LocalDevAuth
    assert built.cookie == settings.session_cookie == CookieSettings()


@pytest.mark.parametrize(
    "change, local_type",
    [
        ({}, LocalDevAuth),
        ({"dev_auth": False}, NoAuth),
        ({"extra_hosts": ("z2h-test.trycloudflare.com",)}, NoAuth),
        ({"extra_hosts": ("localhost",)}, LocalDevAuth),
    ],
)
def test_combinations_without_tailscale(settings, storage, caplog, change, local_type):
    with caplog.at_level(logging.WARNING, logger="z2h_server"):
        built = build_auth(replace(settings, **change), storage)
    assert type(built) is local_type
    off_logged = any("개발용 로그인 꺼짐" in r.getMessage() for r in caplog.records)
    assert off_logged is (local_type is NoAuth)
    assert not any("Tailscale" in r.getMessage() for r in caplog.records)


@pytest.mark.parametrize(
    "change, local_type",
    [
        ({}, LocalDevAuth),
        ({"dev_auth": False}, NoAuth),
        ({"extra_hosts": ("z2h-test.trycloudflare.com",)}, NoAuth),
        ({"extra_hosts": (SERVE,)}, NoAuth),  # 같은 이름을 Z2H_EXTRA_HOSTS 에도 넣으면 잠금
    ],
)
def test_combinations_with_tailscale(settings, storage, caplog, change, local_type):
    with caplog.at_level(logging.WARNING, logger="z2h_server"):
        built = build_auth(replace(settings, tailscale_host=SERVE, **change), storage)
    assert type(built) is ByHostAuth
    assert type(built.local) is local_type
    assert list(built.routes) == [SERVE]
    route = built.routes[SERVE]
    assert type(route) is TailscaleAuth and route.serve_host == SERVE and route.storage is storage
    started = [r.getMessage() for r in caplog.records if "Tailscale 로그인 켜짐" in r.getMessage()]
    assert len(started) == 1 and SERVE not in started[0]  # Tailscale 시작 줄에 tailnet 이름을 쓰지 않음
    # (Z2H_EXTRA_HOSTS 에 넣은 이름은 기존대로 '개발용 로그인 꺼짐' 줄에 나온다. 그 칸에 넣은 값이기 때문)


def test_create_app_uses_build_auth(settings):
    for s in (settings, replace(settings, dev_auth=False), replace(settings, tailscale_host=SERVE)):
        with make_client(s) as c:
            expected = build_auth(s, c.app.state.storage)
            got = c.app.state.auth
            assert type(got) is type(expected)
            if isinstance(got, ByHostAuth):
                assert type(got.local) is type(expected.local) and list(got.routes) == list(expected.routes)


def test_injected_auth_still_wins(settings):
    """create_app(auth=...) 로 넣은 수단은 그대로 쓴다(테스트·나중의 다른 조립용)."""
    from z2h_server.app import create_app
    from starlette.testclient import TestClient

    mine = NoAuth()
    with TestClient(create_app(settings, auth=mine), base_url="http://127.0.0.1:8787", client=("127.0.0.1", 1)) as c:
        assert c.app.state.auth is mine


# ---------- 수단 이름표와 수단이 스스로 답하는 것 ----------


def test_provider_name_table():
    assert AUTH_PROVIDERS == {
        "none": NoAuth,
        "dev_local": LocalDevAuth,
        "tailscale": TailscaleAuth,
        "email_otp": EmailOtpAuth,
        "google": GoogleAuth,
    }
    for name, cls in AUTH_PROVIDERS.items():
        assert cls.provider == name and len(name) <= 32  # auth_identity.provider 칼럼 길이
    # 자리만 있는 두 수단은 여전히 만들 수 없다(공개 승인 항목)
    for cls in (EmailOtpAuth, GoogleAuth):
        with pytest.raises(NotImplementedError):
            cls()


def test_adapters_answer_401_text_and_dev_login_themselves(settings, storage):
    local = LocalDevAuth(storage)
    ts = TailscaleAuth(storage, SERVE)
    assert "/api/dev-auth/accounts" in local.no_user_message_ko
    assert NoAuth().no_user_message_ko == local.no_user_message_ko  # 개발용 로그인을 끈 때도 지금 글 그대로
    assert "이 Tailscale 계정은 아직 학습 계정에 이어져 있지 않습니다" in ts.no_user_message_ko
    assert AuthAdapter.no_user_message_ko  # 새 수단의 기본 글도 비어 있지 않음
    from starlette.requests import Request

    req = Request({"type": "http", "headers": [(b"host", b"127.0.0.1:8787")], "client": ("127.0.0.1", 1)})
    assert local.dev_login(req) is local
    assert ts.dev_login(req) is None and NoAuth().dev_login(req) is None
    far = Request({"type": "http", "headers": [(b"host", b"127.0.0.1:8787")], "client": ("192.168.0.20", 1)})
    assert local.dev_login(far) is None


def _names_in(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    return {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)} | {
        n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)
    }


def test_api_and_app_do_not_branch_on_concrete_login_adapters():
    """나중에 EmailOtpAuth·GoogleAuth 를 넣을 때 API 코드를 고치지 않아도 되게."""
    for name in ("api.py", "app.py"):
        path = PKG / name
        names = _names_in(path)
        strings = _string_constants(path)
        for concrete in ("TailscaleAuth", "NoAuth", "ByHostAuth", "EmailOtpAuth", "GoogleAuth", "NO_TAILSCALE_USER_KO"):
            assert concrete not in names, (name, concrete)
        assert "isinstance" not in names, name
        for provider in AUTH_PROVIDERS:
            assert provider not in strings, (name, provider)
    # 조립은 auth.build_auth 한 곳
    assert "build_auth" in _names_in(PKG / "app.py")
    assert "LocalDevAuth" not in _names_in(PKG / "app.py")


# ---------- 쿠키: 설정 한 곳, 기본값 = 지금 ----------


def test_cookie_defaults_are_todays_behavior():
    c = CookieSettings()
    assert (c.name, c.days, c.secure, c.samesite, c.path, c.domain) == ("z2h_dev_session", 30, False, "strict", "/", None)
    assert c.max_age_seconds == 2592000
    s = load_settings(env={})
    assert s.session_cookie == c


def test_set_cookie_header_is_unchanged_by_default(anon_client):
    r = anon_client.post("/api/dev-auth/accounts", json={})
    header = r.headers["set-cookie"]
    assert re.fullmatch(r"z2h_dev_session=[A-Za-z0-9_-]+; HttpOnly; Max-Age=2592000; Path=/; SameSite=strict", header), header
    r = anon_client.post("/api/dev-auth/logout")
    assert re.fullmatch(r'z2h_dev_session=""; expires=[^;]+; Max-Age=0; Path=/; SameSite=lax', r.headers["set-cookie"])


def test_cookie_settings_from_env_reach_the_header(settings):
    env = {"Z2H_COOKIE_SECURE": "1", "Z2H_COOKIE_SAMESITE": "lax", "Z2H_SESSION_DAYS": "7"}
    cookie = load_settings(env=env).session_cookie
    assert (cookie.secure, cookie.samesite, cookie.days) == (True, "lax", 7)
    with make_client(replace(settings, session_cookie=cookie)) as c:
        header = c.post("/api/dev-auth/accounts", json={}).headers["set-cookie"]
        assert "; Secure" in header and "SameSite=lax" in header and "Max-Age=604800" in header and "HttpOnly" in header
        assert "Secure" in c.post("/api/dev-auth/logout").headers["set-cookie"]
    # Domain·Path·이름도 설정 한 곳에서
    custom = CookieSettings(name="z2h_session", path="/api", domain="z2h.example")
    with make_client(replace(settings, session_cookie=custom)) as c:
        header = c.post("/api/dev-auth/accounts", json={}).headers["set-cookie"]
        assert header.startswith("z2h_session=") and "Domain=z2h.example" in header and "Path=/api" in header


@pytest.mark.parametrize(
    "env",
    [
        {"Z2H_COOKIE_SAMESITE": "none"},  # 다른 사이트에도 붙는 쿠키는 받지 않는다
        {"Z2H_COOKIE_SAMESITE": "loose"},
        {"Z2H_COOKIE_SECURE": "maybe"},
        {"Z2H_SESSION_DAYS": "0"},
        {"Z2H_SESSION_DAYS": "401"},
        {"Z2H_SESSION_DAYS": "abc"},
    ],
)
def test_bad_cookie_settings_refuse_to_start(env, tmp_path):
    with pytest.raises(ConfigRefused):
        load_settings(env=env)
    full = {**os.environ, **env, "Z2H_DB_PATH": str(tmp_path / "x.sqlite3")}
    proc = subprocess.run(
        [sys.executable, "-m", "z2h_server"], cwd=SERVER_DIR, env=full, capture_output=True, text=True, timeout=20
    )
    assert proc.returncode == 2 and "실행 거부" in proc.stderr
    assert not (tmp_path / "x.sqlite3").exists()


@pytest.mark.parametrize(
    "kw", [{"name": "bad name"}, {"name": ""}, {"path": "api"}, {"domain": "a;b"}, {"samesite": "None"}, {"days": 0}]
)
def test_bad_cookie_fields_are_refused(kw):
    with pytest.raises(ConfigRefused):
        CookieSettings(**kw)


def test_httponly_cannot_be_turned_off():
    """세션 토큰을 화면 스크립트가 읽지 못하게: HttpOnly 는 설정 칸이 없다(불변식)."""
    assert "httponly" not in CookieSettings.__dataclass_fields__
    assert CookieSettings().set_kwargs("v", )["httponly"] is True


# ---------- 주소·서버 실행 옵션도 설정에서 ----------


def test_addresses_come_from_settings():
    s = load_settings(env={"Z2H_PORT": "8899"})
    assert s.base_url == "http://127.0.0.1:8899"
    assert s.allowed_origins == frozenset({"http://127.0.0.1:8899", "http://localhost:8899"})
    opts = s.server_options()
    assert opts == {"host": "127.0.0.1", "port": 8899, "proxy_headers": False, "server_header": False, "log_level": "info"}


def test_bad_host_message_uses_the_configured_address(settings):
    with make_client(replace(settings, port=8899)) as c:
        r = c.get("/api/health", headers={"Host": "evil.example"})
        assert r.status_code == 400 and "http://127.0.0.1:8899" in r.json()["message_ko"]


def test_bind_and_proxy_header_invariants_cannot_be_configured():
    """공개 때도 서버는 127.0.0.1 에 붙고 앞에 프록시를 둔다. 이 둘은 설정으로 풀 수 없다."""
    fields = Settings.__dataclass_fields__
    assert "proxy_headers" not in fields
    with pytest.raises(ConfigRefused):
        Settings(host="0.0.0.0").server_options()


# ---------- 설정값이 config.py 밖 소스에 박혀 있지 않다 ----------


def _string_constants(path: Path) -> set[str]:
    """그 파일의 문자열 상수(문서 문자열 제외). f-string 의 글자 조각도 포함."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    docstrings = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            body = node.body
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
                docstrings.add(id(body[0].value))
    return {
        n.value
        for n in ast.walk(tree)
        if isinstance(n, ast.Constant) and isinstance(n.value, str) and id(n) not in docstrings
    }


def _int_constants(path: Path) -> set[int]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    return {n.value for n in ast.walk(tree) if isinstance(n, ast.Constant) and type(n.value) is int}


def _sources() -> list[Path]:
    files = [p for p in PKG.rglob("*.py") if p.name != "config.py"]
    return files + [SERVER_DIR / "alembic" / "env.py"]


@pytest.mark.parametrize("value", ["z2h_dev_session", "127.0.0.1", "localhost", "8787", "z2h.sqlite3", "strict"])
def test_config_values_live_only_in_config_py(value):
    hits = [str(p.relative_to(SERVER_DIR)) for p in _sources() if any(value in s for s in _string_constants(p))]
    assert hits == [], f"{value!r} 가 config.py 밖에 박혀 있음: {hits}"


def test_port_number_lives_only_in_config_py():
    hits = [str(p.relative_to(SERVER_DIR)) for p in _sources() if 8787 in _int_constants(p)]
    assert hits == []


# ---------- DB: sqlite 를 아는 것은 저장 계층과 설정뿐 ----------


def test_only_storage_and_config_know_sqlite():
    hits = []
    for path in PKG.rglob("*.py"):
        rel = path.relative_to(PKG)
        if rel.parts[0] == "storage" or rel.name == "config.py":
            continue
        text = path.read_text(encoding="utf-8")
        if any("sqlite" in s.lower() for s in _string_constants(path)) or "SqliteAdapter" in _names_in(path):
            hits.append(str(rel))
        if re.search(r"^\s*(from|import)\s+.*storage\.sqlite", text, flags=re.M):
            hits.append(f"{rel}: storage.sqlite 를 직접 가져옴")
    assert hits == []


def test_open_adapter_must_exist_does_not_create_a_file(tmp_path):
    db = tmp_path / "nope" / "x.sqlite3"
    with pytest.raises(DatabaseMissing):
        open_adapter(sqlite_url(db), must_exist=True)
    assert not db.exists() and not db.parent.exists()


def test_prepare_location_makes_the_sqlite_folder(tmp_path):
    db = tmp_path / "deep" / "dir" / "x.sqlite3"
    prepare_location(sqlite_url(db))
    assert db.parent.is_dir() and not db.exists()
    prepare_location("sqlite://")  # 메모리 DB 는 할 일 없음


def test_engine_options_come_from_settings(tmp_path, db_path):
    s = Settings(db_url=sqlite_url(db_path), app_dist=tmp_path, db_timeout_seconds=5)
    made = open_adapter(s.db_url, timeout_seconds=s.db_timeout_seconds)
    try:
        assert made.options["timeout_seconds"] == 5
        assert made.engine.hide_parameters is True  # 개인정보 불변식(설정 칸 없음)
    finally:
        made.close()
    assert Settings().db_timeout_seconds == 30  # 기본값 = 지금


def test_unknown_backend_names_the_one_place_to_add(tmp_path):
    with pytest.raises(NotImplementedError) as err:
        open_adapter("postgresql://offline/z2h")
    assert "PostgresAdapter" in str(err.value)


def test_alembic_env_uses_settings_for_db_url():
    text = (SERVER_DIR / "alembic" / "env.py").read_text(encoding="utf-8")
    assert "load_settings" in text and "Z2H_DB_PATH" not in _string_constants(SERVER_DIR / "alembic" / "env.py")


# ---------- 문서 ----------


def test_readme_has_public_switch_section():
    text = (SERVER_DIR / "README.md").read_text(encoding="utf-8")
    start = text.index("## 7. 공개 전환 시 바꿀 것")
    section = text[start:]
    for topic in (
        "로그인 수단",
        "auth_identity",
        "허용 Host",
        "Origin",
        "쿠키",
        "개발용 로그인",
        "Postgres",
        "server_seq",
        "프록시",
        "속도 제한",
        "개인정보",
        "백업",
        "127.0.0.1",
    ):
        assert topic in section, topic
    assert "| 무엇을 |" in section and "승인" in section
