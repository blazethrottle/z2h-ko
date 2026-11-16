"""폰 로그인 A안(TailscaleAuth): Tailscale serve 를 거친 요청만, 맥미니에서 이어 둔 계정으로.

serve 경유로 인정하는 조건(모두 충족)
  (a) 접속한 쪽이 127.0.0.1  (b) Host 가 Z2H_TAILSCALE_HOST 와 같음(포트 무시, 대소문자 무시)
  (c) Tailscale-User-Login 머리말이 정확히 1개이고 비어 있지 않음(Q 인코딩 값은 거부)
Host 가 serve 이름인 요청은 TailscaleAuth 만, Host 가 로컬인 요청은 개발용 로그인만 본다.
설정이 없으면 Tailscale 머리말은 어디서도 보지 않는다.
값은 모두 예시(someone@example.com, macmini.example-tailnet.ts.net)만 쓴다.
"""

from __future__ import annotations

import json
import logging
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import replace
from pathlib import Path

import pytest
import sqlalchemy as sa
from starlette.requests import Request

from helpers import ORIGIN, login_new_account, make_client, new_user, op, t
from z2h_server import migrate
from z2h_server.auth import (
    ByHostAuth,
    LinkError,
    LocalDevAuth,
    NoAuth,
    TailscaleAuth,
    link_tailscale,
    list_tailscale,
    local_only,
    normalize_tailscale_login,
    unlink_tailscale,
)
from z2h_server.config import Settings, TailscaleHostRefused, load_settings, sqlite_url
from z2h_server.storage.sqlite import SqliteAdapter

SERVER_DIR = Path(__file__).resolve().parents[1]

SERVE = "macmini.example-tailnet.ts.net"
SERVE_ORIGIN = f"https://{SERVE}"
LOGIN = "someone@example.com"
OTHER_LOGIN = "other@example.com"
NO_USER_TS_KO = "이 Tailscale 계정은 아직 학습 계정에 이어져 있지 않습니다"


def ts(login: str | None = LOGIN, **extra: str) -> dict[str, str]:
    """serve 를 거쳐 폰에서 온 요청의 머리말."""
    h = {"Host": SERVE, **extra}
    if login is not None:
        h["Tailscale-User-Login"] = login
    return h


def fake(*, client=("127.0.0.1", 5000), hosts=(SERVE,), headers=()) -> Request:
    raw = [(b"host", h.encode("latin-1")) for h in hosts]
    raw += [(k.lower().encode("latin-1"), v.encode("latin-1")) for k, v in headers]
    return Request({"type": "http", "headers": raw, "client": client})


def sync_body(op_id: str, step: str, when: str = "20:00:00") -> dict:
    return {"client_id": "phone", "ops": [op(op_id, "step_progress", {"step_id": step}, {"status": "done"}, t(when))]}


def steps(state: dict) -> list[str]:
    return [r["step_id"] for r in state["tables"]["step_progress"]]


@pytest.fixture
def ts_settings(settings) -> Settings:
    return replace(settings, tailscale_host=SERVE)


@pytest.fixture
def ts_client(ts_settings):
    """serve 설정을 켠 서버. 맥에서 개발 계정 A 를 만들고(쿠키), 그 계정에 LOGIN 을 이어 둔다."""
    with make_client(ts_settings) as c:
        c.user_id = login_new_account(c, "맥 계정")
        link_tailscale(c.app.state.storage, LOGIN, c.user_id)
        yield c


# ---------- 설정: Z2H_TAILSCALE_HOST ----------


def test_setting_is_normalized_and_adds_host_and_https_origin():
    s = load_settings(env={"Z2H_TAILSCALE_HOST": "MacMini.Example-Tailnet.TS.NET"})
    assert s.tailscale_host == SERVE
    assert SERVE in s.allowed_hostnames
    assert SERVE_ORIGIN in s.allowed_origins
    assert f"http://{SERVE}" not in s.allowed_origins  # https 만
    assert s.extra_hosts == () and s.extra_origins == ()  # Z2H_EXTRA_* 를 따로 안 써도 됨
    assert s.dev_auth_off_reason is None  # 이 이름은 개발용 로그인 잠금의 예외


def test_no_setting_means_nothing_changes():
    s = load_settings(env={})
    assert s.tailscale_host is None
    assert s.allowed_hostnames == frozenset({"127.0.0.1", "localhost"})
    assert s.allowed_origins == frozenset({"http://127.0.0.1:8787", "http://localhost:8787"})
    assert load_settings(env={"Z2H_TAILSCALE_HOST": ""}).tailscale_host is None  # 빈 값 = 설정 없음
    assert Settings().tailscale_host is None


BAD_HOSTS = [
    " ",
    f" {SERVE}",
    f"{SERVE} ",
    f"{SERVE}\n",
    f"{SERVE}:443",
    f"{SERVE}:8443",
    f"https://{SERVE}",
    f"http://{SERVE}",
    f"{SERVE}/",
    f"{SERVE},other.example-tailnet.ts.net",
    f"{SERVE}.",
    f"*.example-tailnet.ts.net",
    f"{SERVE}.evil.example",
    "example-tailnet.ts.net",  # 기기 이름 없음
    "ts.net",
    "a.b.example-tailnet.ts.net",  # 이름 칸이 너무 많음
    "macmini..ts.net",
    "-macmini.example-tailnet.ts.net",
    "macmini-.example-tailnet.ts.net",
    "mac_mini.example-tailnet.ts.net",
    "macmini.example-tailnet.ts.net.ts.net.example",
    "macmini.example-tailnet.ts.com",
    "localhost",
    "127.0.0.1",
    "100.101.102.103",
    "[fd7a:115c:a1e0::1]",
    "macmіni.example-tailnet.ts.net",  # 키릴 i
    "Kelvin.example-tailnet.ts.net",  # 켈빈 기호(소문자로 바꾸면 k 가 되는 글자)
]


@pytest.mark.parametrize("value", BAD_HOSTS)
def test_bad_setting_is_refused(value, settings):
    with pytest.raises(TailscaleHostRefused):
        load_settings(env={"Z2H_TAILSCALE_HOST": value})
    with pytest.raises(TailscaleHostRefused):
        replace(settings, tailscale_host=value)


def test_bad_setting_refuses_to_start_python_m(tmp_path):
    env = dict(os.environ)
    env.update({"Z2H_DB_PATH": str(tmp_path / "x.sqlite3"), "Z2H_TAILSCALE_HOST": f"https://{SERVE}"})
    proc = subprocess.run(
        [sys.executable, "-m", "z2h_server"], cwd=SERVER_DIR, env=env, capture_output=True, text=True, timeout=20
    )
    assert proc.returncode == 2, proc.stderr
    assert "Z2H_TAILSCALE_HOST" in proc.stderr
    assert not (tmp_path / "x.sqlite3").exists()  # DB 도 만들지 않고 멈춘다


# ---------- 설정이 없을 때: Tailscale 머리말은 어디서도 보지 않는다 ----------


def test_without_setting_tailscale_header_is_ignored(settings):
    with make_client(settings) as c:
        uid = login_new_account(c)
        link_tailscale(c.app.state.storage, LOGIN, uid)
        assert type(c.app.state.auth) is LocalDevAuth  # 지금과 같은 조립
        assert c.get("/api/state").json()["user"]["user_id"] == uid  # 쿠키로(지금과 같음)
        # 머리말은 신원으로 쓰지 않는다. 오히려 serve 가 붙이는 머리말이라 전달된 요청 표시로 보고 개발용 로그인도 거부
        r = c.get("/api/state", headers={"Tailscale-User-Login": LOGIN})
        assert r.status_code == 401 and r.json()["error"] == "no_user"
        assert r.json()["auth_provider"] == "dev_local"
        c.cookies.clear()
        assert c.get("/api/state", headers={"Tailscale-User-Login": LOGIN}).status_code == 401
        # serve 이름은 허용 주소가 아니다
        r = c.get("/api/state", headers=ts())
        assert r.status_code == 400 and r.json()["error"] == "bad_host"


def test_old_extra_hosts_way_keeps_everything_locked(settings):
    """Z2H_EXTRA_HOSTS 로 serve 이름을 넣는 옛 방법은 지금처럼 로그인 수단이 없다(모두 401)."""
    with make_client(replace(settings, extra_hosts=(SERVE,))) as c:
        assert isinstance(c.app.state.auth, NoAuth)
        link_tailscale(c.app.state.storage, LOGIN, new_user(c.app.state.storage))
        r = c.get("/api/state", headers=ts())
        assert r.status_code == 401 and r.json()["auth_provider"] == "none"


# ---------- serve 경유 + 이어진 로그인 ----------


def test_linked_login_reads_and_writes_only_its_own_account(ts_client):
    c = ts_client
    a = c.user_id
    b = login_new_account(c, "다른 계정")  # 쿠키는 이제 B
    c.post("/api/sync", json=sync_body("b1", "L01-S09"))
    link_tailscale(c.app.state.storage, OTHER_LOGIN, b)
    c.cookies.clear()

    r = c.post("/api/sync", headers=ts(Origin=SERVE_ORIGIN), json=sync_body("phone-a1", "L01-S01"))
    assert r.status_code == 200 and r.json()["applied"] == ["phone-a1"]
    state = c.get("/api/state", headers=ts()).json()
    assert state["user"]["user_id"] == a and steps(state) == ["L01-S01"]
    assert c.get("/api/export", headers=ts()).json()["user_id"] == a

    other = c.get("/api/state", headers=ts(OTHER_LOGIN)).json()
    assert other["user"]["user_id"] == b and steps(other) == ["L01-S09"]

    # 맥에서 같은 계정 A 를 열면 폰이 쓴 진도가 보인다(이어 보기)
    assert steps(c.get("/api/state", headers={"X-Z2H-User": a}).json()) == ["L01-S01"]
    assert steps(c.get("/api/state", headers={"X-Z2H-User": b}).json()) == ["L01-S09"]


def test_me_reports_auth_provider_without_echoing_login(ts_client):
    c = ts_client
    r = c.get("/api/me", headers=ts())
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True and body["user"]["user_id"] == c.user_id
    assert body["auth_provider"] == "tailscale"
    assert LOGIN not in r.text
    local = c.get("/api/me").json()  # 맥, 쿠키
    assert local["user"]["user_id"] == c.user_id and local["auth_provider"] == "dev_local"
    # 폰에서 계정 칸 바꾸기도 그 계정에
    assert c.post("/api/me", headers=ts(Origin=SERVE_ORIGIN), json={"path_id": "investor"}).status_code == 200
    assert c.get("/api/me").json()["user"]["path_id"] == "investor"


def test_login_name_case_does_not_matter(ts_client):
    c = ts_client
    for value in ("SomeOne@Example.COM", "SOMEONE@EXAMPLE.COM"):
        r = c.get("/api/me", headers=ts(value))
        assert r.status_code == 200 and r.json()["user"]["user_id"] == c.user_id, value
    # 이을 때도 소문자로 맞춘다
    b = new_user(c.app.state.storage, "B")
    assert link_tailscale(c.app.state.storage, "Other@Example.COM", b) == OTHER_LOGIN
    assert c.get("/api/me", headers=ts(OTHER_LOGIN)).json()["user"]["user_id"] == b
    with pytest.raises(LinkError):
        link_tailscale(c.app.state.storage, "OTHER@example.com", new_user(c.app.state.storage, "C"))


def test_serve_host_with_port_or_upper_case_is_the_same_name(ts_client):
    c = ts_client
    for host in (f"{SERVE}:443", SERVE.upper(), f"{SERVE.upper()}:8443"):
        r = c.get("/api/me", headers={"Host": host, "Tailscale-User-Login": LOGIN})
        assert r.status_code == 200 and r.json()["auth_provider"] == "tailscale", host


@pytest.mark.parametrize("host", [f"{SERVE}.evil.example", f"evil.{SERVE}", f"{SERVE}:notaport", f"{SERVE}."])
def test_lookalike_hosts_are_refused(ts_client, host):
    r = ts_client.get("/api/me", headers={"Host": host, "Tailscale-User-Login": LOGIN})
    assert r.status_code == 400 and r.json()["error"] == "bad_host"


# ---------- 이어지지 않은 로그인, 틀린 머리말 ----------


def test_unlinked_login_is_401_with_korean_guide_and_no_signup(ts_client):
    c = ts_client
    storage = c.app.state.storage
    with storage.engine.connect() as conn:
        before = conn.execute(sa.text("SELECT COUNT(*) FROM users")).scalar_one()
    for method, path, body in [
        ("get", "/api/me", None),
        ("get", "/api/state", None),
        ("get", "/api/export", None),
        ("post", "/api/sync", sync_body("x", "L01-S01")),
    ]:
        kw = {"json": body} if body is not None else {}
        r = getattr(c, method)(path, headers=ts(OTHER_LOGIN, Origin=SERVE_ORIGIN), **kw)
        assert r.status_code == 401, path
        got = r.json()
        assert got["ok"] is False and got["error"] == "no_user"
        assert got["auth_provider"] == "tailscale"
        assert NO_USER_TS_KO in got["message_ko"] and "맥미니" in got["message_ko"]
        assert OTHER_LOGIN not in r.text
    with storage.engine.connect() as conn:
        assert conn.execute(sa.text("SELECT COUNT(*) FROM users")).scalar_one() == before  # 자동 가입 없음


BAD_LOGIN_HEADERS = {
    "missing(태그된 기기)": [],
    "duplicate_same": [("Tailscale-User-Login", LOGIN), ("Tailscale-User-Login", LOGIN)],
    "duplicate_other": [("Tailscale-User-Login", LOGIN), ("Tailscale-User-Login", OTHER_LOGIN)],
    "empty": [("Tailscale-User-Login", "")],
    "blank": [("Tailscale-User-Login", "   ")],
    "q_encoded": [("Tailscale-User-Login", "=?utf-8?q?someone=40example.com?=")],
    "q_encoded_upper": [("Tailscale-User-Login", "=?UTF-8?Q?someone@example.com?=")],
    "comma_list": [("Tailscale-User-Login", f"{LOGIN},{OTHER_LOGIN}")],
    "comma_space_list": [("Tailscale-User-Login", f"{LOGIN}, {OTHER_LOGIN}")],
    "inner_space": [("Tailscale-User-Login", "someone @example.com")],
    "too_long": [("Tailscale-User-Login", "a" * 250 + "@example.com")],
    "underscore_name": [("Tailscale_User_Login", LOGIN)],
    "name_only": [("Tailscale-User-Name", "Someone")],
}


@pytest.mark.parametrize("extra", list(BAD_LOGIN_HEADERS.values()), ids=list(BAD_LOGIN_HEADERS))
def test_bad_login_headers_are_401(ts_client, extra):
    r = ts_client.get("/api/me", headers=[("Host", SERVE), *extra])
    assert r.status_code == 401
    assert r.json()["error"] == "no_user" and r.json()["auth_provider"] == "tailscale"
    assert LOGIN not in r.text


@pytest.mark.parametrize(
    "value",
    ["", " ", "=?utf-8?q?x?=", "a b@example.com", f"{LOGIN},{OTHER_LOGIN}", "a" * 256, "someoné@example.com", "x\ty"],
)
def test_bad_login_values_are_not_names(value):
    assert normalize_tailscale_login(value) is None


def test_good_login_values_are_lowercased():
    assert normalize_tailscale_login("SomeOne@Example.COM") == LOGIN
    assert normalize_tailscale_login("someone@github") == "someone@github"


# ---------- serve 이름 Host 에서는 개발용 로그인이 없다 ----------


DEV_PATHS = [
    ("get", "/api/dev-auth/accounts", None),
    ("post", "/api/dev-auth/accounts", {"display_name": "몰래"}),
    ("post", "/api/dev-auth/login", {"user_id": "x"}),
    ("post", "/api/dev-auth/logout", None),
]


def test_serve_host_never_uses_dev_login(ts_client):
    c = ts_client
    a = c.user_id
    b = login_new_account(c, "B")  # 이 브라우저에는 B 의 개발 쿠키가 있다
    for login in (None, LOGIN):
        for method, path, body in DEV_PATHS:
            kw = {"json": body} if body is not None else {}
            r = getattr(c, method)(path, headers=ts(login, Origin=SERVE_ORIGIN), **kw)
            assert r.status_code == 404 and r.json()["error"] == "not_found", (login, path)
    # 개발 쿠키·X-Z2H-User 는 serve 이름 Host 에서 믿지 않는다
    assert c.get("/api/state", headers=ts(None)).status_code == 401
    assert c.get("/api/state", headers=ts(None, **{"X-Z2H-User": b})).status_code == 401
    # Tailscale 로그인이 있으면 그 계정만(머리말로 다른 계정을 고를 수 없음)
    r = c.get("/api/state", headers=ts(**{"X-Z2H-User": b}))
    assert r.status_code == 200 and r.json()["user"]["user_id"] == a
    with c.app.state.storage.engine.connect() as conn:
        users = conn.execute(sa.text("SELECT COUNT(*) FROM users")).scalar_one()
    assert users == 2  # dev-auth 로 몰래 계정을 만들지 못함


def test_local_host_with_tailscale_header_is_not_trusted(ts_client):
    """Host 가 로컬이면 Tailscale 머리말을 믿지 않는다. 그런 요청은 개발용 로그인도 쓰지 못한다(전달된 요청 표시로 본다)."""
    c = ts_client
    auth = c.app.state.auth
    assert isinstance(auth.tailscale, TailscaleAuth)
    for host in ("127.0.0.1:8787", "localhost:8787", "127.0.0.1"):
        assert auth.tailscale.current_user_id(fake(hosts=(host,), headers=[("Tailscale-User-Login", LOGIN)])) is None
    for name in ("Tailscale-User-Login", "Tailscale-User-Name", "Tailscale-User-Profile-Pic"):
        hdr = {name: LOGIN}
        assert not local_only(fake(hosts=("127.0.0.1:8787",), headers=list(hdr.items())))
        # 쿠키가 있어도, 머리말 로그인이 있어도 이 요청은 누구도 아니다
        r = c.get("/api/state", headers=hdr)
        assert r.status_code == 401 and r.json()["auth_provider"] == "dev_local", name
        assert c.get("/api/state", headers={**hdr, "X-Z2H-User": c.user_id}).status_code == 401
        assert c.get("/api/dev-auth/accounts", headers=hdr).status_code == 404
    c.cookies.clear()
    assert c.get("/api/state", headers={"Tailscale-User-Login": LOGIN}).status_code == 401


def test_local_dev_login_keeps_working_with_setting_on(ts_client):
    c = ts_client
    auth = c.app.state.auth
    assert isinstance(auth, ByHostAuth) and isinstance(auth.local, LocalDevAuth)
    assert c.get("/api/dev-auth/accounts").json()["current_user_id"] == c.user_id
    assert c.get("/api/state").status_code == 200
    assert c.get("/api/state", headers={"Host": "localhost:8787"}).status_code == 200
    b = login_new_account(c, "맥 두 번째")
    assert c.get("/api/me").json()["user"]["user_id"] == b
    assert c.post("/api/dev-auth/login", json={"user_id": c.user_id}, headers={"Origin": ORIGIN}).status_code == 200
    c.cookies.clear()
    assert c.get("/api/state", headers={"X-Z2H-User": c.user_id}).status_code == 200


def test_one_request_never_spans_both(ts_client):
    """Host 가 둘이면(로컬 프로그램만 만들 수 있음) Tailscale 쪽으로 보내고 거기서 거부한다."""
    c = ts_client
    auth = c.app.state.auth
    two = [("Tailscale-User-Login", LOGIN), ("X-Z2H-User", c.user_id)]
    for hosts in (("127.0.0.1:8787", SERVE), (SERVE, "127.0.0.1:8787")):
        req = fake(hosts=hosts, headers=two)
        assert auth.for_request(req) is auth.tailscale
        assert auth.current_user_id(req) is None
    assert auth.for_request(fake(hosts=("127.0.0.1:8787",))) is auth.local
    assert auth.for_request(fake(hosts=(SERVE,))) is auth.tailscale
    assert auth.for_request(fake(hosts=())) is auth.local


def test_non_loopback_peer_is_refused(ts_settings):
    with make_client(ts_settings) as near:
        link_tailscale(near.app.state.storage, LOGIN, new_user(near.app.state.storage))
    far_peer = ("100.101.102.103", 50000)
    with make_client(ts_settings, client=far_peer) as far:
        assert far.get("/api/me", headers=ts()).json()["error"] == "not_loopback"
    # 공용 문 검사를 꺼도 TailscaleAuth 가 직접 막는다
    with make_client(replace(ts_settings, require_loopback_peer=False), client=far_peer) as far:
        r = far.get("/api/me", headers=ts())
        assert r.status_code == 401 and r.json()["auth_provider"] == "tailscale"
        tsa = far.app.state.auth.tailscale
        good = [("Tailscale-User-Login", LOGIN)]
        assert tsa.current_user_id(fake(headers=good)) is not None
        assert tsa.current_user_id(fake(client=far_peer, headers=good)) is None
        assert tsa.current_user_id(fake(client=None, headers=good)) is None


# ---------- Host·Origin 검사는 serve 경유 요청에도 그대로 ----------


@pytest.mark.parametrize(
    "origin", ["https://evil.example", f"http://{SERVE}", f"https://{SERVE}:8443", "null", "http://localhost:4321"]
)
def test_foreign_origin_write_is_refused_on_serve_host(ts_client, origin):
    c = ts_client
    r = c.post("/api/sync", headers=ts(Origin=origin), json=sync_body("evil", "L01-S01"))
    assert r.status_code == 403 and r.json()["error"] == "bad_origin"
    assert steps(c.get("/api/state", headers=ts()).json()) == []


def test_cross_site_fetch_metadata_is_refused_on_serve_host(ts_client):
    r = ts_client.post("/api/sync", headers=ts(**{"Sec-Fetch-Site": "cross-site"}), json=sync_body("x", "L01-S01"))
    assert r.status_code == 403


def test_own_https_origin_write_is_allowed(ts_client):
    r = ts_client.post("/api/sync", headers=ts(Origin=f"{SERVE_ORIGIN}/"), json=sync_body("ok", "L01-S02"))
    assert r.status_code == 200 and r.json()["applied"] == ["ok"]


# ---------- 기존 잠금과 함께 ----------


def test_dev_auth_off_keeps_tailscale_on(ts_settings, caplog):
    with caplog.at_level(logging.WARNING, logger="z2h_server"):
        with make_client(replace(ts_settings, dev_auth=False)) as c:
            uid = new_user(c.app.state.storage)
            link_tailscale(c.app.state.storage, LOGIN, uid)
            assert isinstance(c.app.state.auth.local, NoAuth)
            assert c.get("/api/dev-auth/accounts").status_code == 404
            r = c.get("/api/state", headers={"X-Z2H-User": uid})
            assert r.status_code == 401 and r.json()["auth_provider"] == "none"
            assert c.get("/api/me", headers=ts()).json()["user"]["user_id"] == uid
    messages = [rec.getMessage() for rec in caplog.records]
    assert any("개발용 로그인 꺼짐" in m for m in messages)
    assert any("Tailscale 로그인 켜짐" in m for m in messages)


@pytest.mark.parametrize("extra", [("z2h-test.trycloudflare.com",), (SERVE,)])
def test_outside_name_in_extra_hosts_still_turns_dev_login_off(ts_settings, extra):
    """잠금은 그대로: Z2H_EXTRA_HOSTS 에 바깥 이름이 있으면 개발용 로그인이 꺼진다(serve 이름을 거기 넣어도)."""
    s = replace(ts_settings, extra_hosts=extra)
    assert s.dev_auth_off_reason is not None
    with make_client(s) as c:
        uid = new_user(c.app.state.storage)
        link_tailscale(c.app.state.storage, LOGIN, uid)
        assert isinstance(c.app.state.auth.local, NoAuth)
        assert c.get("/api/dev-auth/accounts").status_code == 404
        assert c.get("/api/me", headers=ts()).json()["user"]["user_id"] == uid


# ---------- 잇기·끊기·목록 (저장 계층 + auth 함수) ----------


def test_identity_methods_on_adapter(adapter, user, other_user):
    assert adapter.find_identity("tailscale", LOGIN) is None
    adapter.add_identity(user, "tailscale", LOGIN)
    assert adapter.find_identity("tailscale", LOGIN) == user
    assert adapter.find_identity("dev_local", LOGIN) is None
    with pytest.raises(ValueError):
        adapter.add_identity(other_user, "tailscale", LOGIN)  # 한 이름은 한 계정
    listed = adapter.list_identities("tailscale")
    assert [(x["subject"], x["user_id"]) for x in listed] == [(LOGIN, user)]
    assert listed[0]["display_name"] == "계정 A" and listed[0]["created_at"].endswith("+09:00")
    assert adapter.remove_identity("tailscale", LOGIN) is True
    assert adapter.remove_identity("tailscale", LOGIN) is False
    assert adapter.list_identities("tailscale") == []


def test_link_unlink_list_rules(adapter, user, other_user):
    assert link_tailscale(adapter, LOGIN, user) == LOGIN
    for target in (user, other_user):
        with pytest.raises(LinkError) as err:
            link_tailscale(adapter, LOGIN, target)  # 다시 이으면 오류(먼저 unlink)
        assert "unlink-tailscale" in str(err.value) and LOGIN not in str(err.value)
    with pytest.raises(LinkError) as err:
        link_tailscale(adapter, OTHER_LOGIN, "00000000-0000-4000-8000-00000000dead")
    assert "계정" in str(err.value)
    for bad in ("", "=?utf-8?q?x?=", "a b", "a,b"):
        with pytest.raises(LinkError):
            link_tailscale(adapter, bad, user)
    link_tailscale(adapter, OTHER_LOGIN, user)  # 한 계정에 이름 여러 개는 된다
    assert [x["subject"] for x in list_tailscale(adapter)] == [LOGIN, OTHER_LOGIN]
    assert unlink_tailscale(adapter, "SomeOne@Example.com") == LOGIN
    with pytest.raises(LinkError):
        unlink_tailscale(adapter, LOGIN)
    link_tailscale(adapter, LOGIN, other_user)  # 끊은 뒤에는 다른 계정에 이을 수 있다
    assert adapter.find_identity("tailscale", LOGIN) == other_user


def test_deleting_user_removes_link(adapter, user):
    link_tailscale(adapter, LOGIN, user)
    with adapter.engine.begin() as conn:
        conn.execute(sa.text("DELETE FROM users WHERE user_id = :u"), {"u": user})
    assert adapter.find_identity("tailscale", LOGIN) is None


# ---------- 서버 로그에 로그인 이름이 남지 않는다 ----------


def test_server_log_never_contains_login_name(ts_settings, caplog, capsys):
    caplog.set_level(logging.DEBUG)
    with make_client(ts_settings, raise_server_exceptions=False) as c:
        link_tailscale(c.app.state.storage, LOGIN, login_new_account(c))
        _requests_that_carry_login_names(c)
    out = capsys.readouterr()
    assert any(rec.exc_info for rec in caplog.records)  # 오류 기록은 남았다
    logged = caplog.text + "".join(
        logging.Formatter().formatException(rec.exc_info) for rec in caplog.records if rec.exc_info
    )
    assert "auth_identity" in logged  # 오류 내용(SQL 문)은 남되
    for name in (LOGIN, OTHER_LOGIN, "someone=40example.com"):
        assert name not in logged  # SQL 에 넣은 값(로그인 이름)은 숨긴다
        assert name not in out.out and name not in out.err


def _requests_that_carry_login_names(c):
    c.get("/api/me", headers=ts())
    c.get("/api/me", headers=ts(OTHER_LOGIN))
    c.get("/api/me", headers=[("Host", SERVE), ("Tailscale-User-Login", LOGIN), ("Tailscale-User-Login", OTHER_LOGIN)])
    c.get("/api/me", headers=ts("=?utf-8?q?someone=40example.com?="))
    c.get("/api/me", headers={"Tailscale-User-Login": LOGIN})
    c.post("/api/sync", headers=ts(Origin="https://evil.example"), json=sync_body("e", "L01-S01"))
    # DB 오류가 나도(500) 오류 기록에 로그인 이름이 들어가지 않는다(SQL 값 숨김)
    with c.app.state.storage.engine.begin() as conn:
        conn.execute(sa.text("ALTER TABLE auth_identity RENAME TO auth_identity_gone"))
    r = c.get("/api/me", headers=ts())
    assert r.status_code == 500 and r.json()["error"] == "server_error"
    assert LOGIN not in r.text


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _get(port: int, path: str, headers: dict[str, str]) -> tuple[int, dict]:
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=2) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def test_real_server_with_setting_answers_and_logs_no_login(tmp_path):
    """실제 서버(uvicorn)를 켜서 serve 처럼 Host·머리말을 붙여 본다. 접속 기록에도 로그인 이름이 없다."""
    db = tmp_path / "real.sqlite3"
    migrate.upgrade(sqlite_url(db))
    storage = SqliteAdapter(db)
    uid = new_user(storage, "폰 계정")
    link_tailscale(storage, LOGIN, uid)
    storage.close()

    port = _free_port()
    env = dict(os.environ)
    env.update({"Z2H_DB_PATH": str(db), "Z2H_APP_DIST": str(tmp_path / "none"), "Z2H_TAILSCALE_HOST": SERVE})
    proc = subprocess.Popen(
        [sys.executable, "-m", "z2h_server", "--port", str(port)],
        cwd=SERVER_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        deadline = time.time() + 20
        while time.time() < deadline:
            try:
                _get(port, "/api/health", {})
                break
            except OSError:
                if proc.poll() is not None:
                    break
                time.sleep(0.2)
        status, body = _get(port, "/api/me", {"Host": SERVE, "Tailscale-User-Login": LOGIN})
        assert status == 200 and body["user"]["user_id"] == uid and body["auth_provider"] == "tailscale"
        status, body = _get(port, "/api/me", {"Host": SERVE, "Tailscale-User-Login": OTHER_LOGIN})
        assert status == 401 and body["auth_provider"] == "tailscale"
        status, body = _get(port, "/api/me", {"Tailscale-User-Login": LOGIN})
        assert status == 401 and body["auth_provider"] == "dev_local"
    finally:
        proc.terminate()
        try:
            out, err = proc.communicate(timeout=10)
        except subprocess.TimeoutExpired:  # pragma: no cover
            proc.kill()
            out, err = proc.communicate()
    logs = out + err
    assert "GET /api/me" in logs  # 접속 기록은 켜져 있다
    assert "Tailscale 로그인 켜짐" in logs
    assert LOGIN not in logs and OTHER_LOGIN not in logs
    assert SERVE not in logs  # tailnet 이름도 로그에 쓰지 않는다
