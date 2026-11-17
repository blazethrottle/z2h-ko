"""개발용 로그인 잠금(보안 검토 지적 반영).

비밀번호 없이 아무 계정으로나 세션을 만드는 경로이므로, 공용 문 검사와 따로 이 경로 안에서 직접 막는다.
1) 접속한 쪽이 127.0.0.1 이 아니면 거부(공용 문 검사를 꺼도)
2) 프록시·터널 머리말(CF-Connecting-IP, CF-Ray, X-Forwarded-For, X-Real-IP, Forwarded 등)이 있으면 거부
3) 허용 Host 에 터널 주소 같은 바깥 주소가 있거나 Z2H_DEV_AUTH=0 이면 개발용 로그인 자체를 끔(시작 로그 남김)
4) Host 가 127.0.0.1·localhost 가 아니면 거부
정상(이 컴퓨터 안에서 바로 온) 요청은 통과.
"""

from __future__ import annotations

import logging
from dataclasses import replace

import pytest
from starlette.requests import Request

from helpers import login_new_account, make_client
from z2h_server.auth import FORWARDING_HEADERS, LocalDevAuth, NoAuth, local_only
from z2h_server.config import load_settings

DEV_PATHS = [
    ("get", "/api/dev-auth/accounts", None),
    ("post", "/api/dev-auth/accounts", {"display_name": "몰래"}),
    ("post", "/api/dev-auth/login", {"user_id": "x"}),
    ("post", "/api/dev-auth/logout", None),
]


def _call(c, method, path, body, **kw):
    if body is not None:
        kw["json"] = body
    return getattr(c, method)(path, **kw)


def _fake_request(*, client=("127.0.0.1", 5000), host="127.0.0.1:8787", extra=()):
    headers = [(b"host", host.encode())] if host is not None else []
    headers += [(k.encode(), v.encode()) for k, v in extra]
    return Request({"type": "http", "headers": headers, "client": client})


# ---------- 정상 요청은 통과 ----------


def test_plain_loopback_request_passes(client):
    assert local_only(_fake_request())
    assert local_only(_fake_request(host="localhost:8787"))
    r = client.get("/api/dev-auth/accounts")
    assert r.status_code == 200 and r.json()["current_user_id"] == client.user_id
    assert client.get("/api/state", headers={"X-Z2H-User": client.user_id}).status_code == 200


# ---------- 1) 루프백 직접 검사 ----------


def test_non_loopback_peer_is_refused_even_if_gate_is_off(settings):
    """공용 문 검사(require_loopback_peer)를 꺼도 개발용 로그인 경로가 직접 막는다."""
    with make_client(replace(settings, require_loopback_peer=False), client=("192.168.0.20", 50000)) as c:
        for method, path, body in DEV_PATHS:
            r = _call(c, method, path, body)
            assert r.status_code == 404, path
            assert r.json()["error"] == "not_found"
    assert not local_only(_fake_request(client=("192.168.0.20", 5000)))
    assert not local_only(_fake_request(client=None))


def test_non_loopback_peer_cannot_use_header_or_cookie(settings):
    with make_client(settings) as near:
        uid = login_new_account(near)
        cookie = near.cookies.get(LocalDevAuth.COOKIE)
    with make_client(replace(settings, require_loopback_peer=False), client=("192.168.0.20", 50000)) as far:
        assert far.get("/api/state", headers={"X-Z2H-User": uid}).status_code == 401
        far.cookies.set(LocalDevAuth.COOKIE, cookie)
        assert far.get("/api/state").status_code == 401


# ---------- 2) 프록시·터널 머리말 ----------


@pytest.mark.parametrize(
    "header, value",
    [
        ("CF-Connecting-IP", "203.0.113.7"),
        ("CF-Ray", "8f1a2b3c4d5e6f70-ICN"),
        ("X-Forwarded-For", "203.0.113.7"),
        ("X-Real-IP", "203.0.113.7"),
        ("Forwarded", "for=203.0.113.7"),
        ("X-Forwarded-Host", "z2h.example"),
        ("X-Forwarded-Proto", "https"),
    ],
)
def test_forwarded_requests_cannot_use_dev_login(client, header, value):
    """터널 프로그램은 127.0.0.1 에서 접속하므로 접속 주소만 믿지 않는다."""
    assert header.lower() in FORWARDING_HEADERS
    h = {header: value}
    for method, path, body in DEV_PATHS:
        assert _call(client, method, path, body, headers=h).status_code == 404, (header, path)
    # 머리말 로그인도, 이미 받은 쿠키도 이 요청에서는 쓰지 못한다
    assert client.get("/api/state", headers={**h, "X-Z2H-User": client.user_id}).status_code == 401
    assert client.get("/api/state", headers=h).status_code == 401
    # 같은 쿠키라도 머리말 없는 이 컴퓨터 안 요청은 그대로 된다
    assert client.get("/api/state").status_code == 200


# ---------- 3) 터널 주소 설정·명시적 끄기 ----------


def test_tunnel_host_setting_turns_dev_login_off_with_start_log(settings, caplog):
    tunneled = replace(settings, extra_hosts=("z2h-test.trycloudflare.com",))
    assert tunneled.dev_auth_off_reason is not None
    with caplog.at_level(logging.WARNING, logger="z2h_server"):
        with make_client(tunneled) as c:
            assert isinstance(c.app.state.auth, NoAuth)
            for method, path, body in DEV_PATHS:
                assert _call(c, method, path, body).status_code == 404, path
            assert c.get("/api/state").status_code == 401
            assert c.get("/api/health").status_code == 200
    assert any("개발용 로그인 꺼짐" in rec.getMessage() for rec in caplog.records)


def test_local_names_in_extra_hosts_keep_dev_login_on(settings):
    assert replace(settings, extra_hosts=("localhost", "127.0.0.1")).dev_auth_off_reason is None


@pytest.mark.parametrize("value", ["0", "false", "off"])
def test_z2h_dev_auth_0_turns_it_off(value):
    s = load_settings(env={"Z2H_DEV_AUTH": value})
    assert s.dev_auth is False and "Z2H_DEV_AUTH" in s.dev_auth_off_reason
    assert load_settings(env={}).dev_auth_off_reason is None


def test_dev_auth_switch_off_at_runtime(settings, caplog):
    with caplog.at_level(logging.WARNING, logger="z2h_server"):
        with make_client(replace(settings, dev_auth=False)) as c:
            assert c.get("/api/dev-auth/accounts").status_code == 404
            assert c.post("/api/dev-auth/accounts", json={}).status_code == 404
    assert any("개발용 로그인 꺼짐" in rec.getMessage() for rec in caplog.records)


# ---------- 4) Host 검사(따로) ----------


@pytest.mark.parametrize("host", ["z2h-test.trycloudflare.com", "evil.example:8787", "192.168.0.10:8787", "", None])
def test_non_local_host_is_refused_by_dev_login_itself(host):
    """공용 문 검사가 터널 주소를 허용하게 바뀌어도, 개발용 로그인은 Host 를 따로 본다."""
    assert not local_only(_fake_request(host=host))


def test_non_local_host_cannot_resolve_user(client):
    auth = client.app.state.auth
    assert isinstance(auth, LocalDevAuth)
    hdr = [("x-z2h-user", client.user_id)]
    assert auth.current_user_id(_fake_request(extra=hdr)) == client.user_id
    assert auth.current_user_id(_fake_request(host="z2h-test.trycloudflare.com", extra=hdr)) is None
    assert auth.current_user_id(_fake_request(client=("192.168.0.20", 1), extra=hdr)) is None
    assert auth.current_user_id(_fake_request(extra=[*hdr, ("cf-connecting-ip", "203.0.113.7")])) is None
