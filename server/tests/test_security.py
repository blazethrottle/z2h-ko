"""요청 검사: Host, 접속한 쪽 주소, 쓰기 요청 Origin, 본문 1MB 제한."""

from __future__ import annotations

import pytest

from helpers import ORIGIN, login_new_account, make_client, op, t

SYNC_BODY = {"client_id": "pc", "ops": [op("a", "user_pref", {"pref_key": "run_place"}, {"value": "colab"}, t("20:00:00"))]}


@pytest.mark.parametrize(
    "host",
    ["127.0.0.1", "127.0.0.1:8787", "localhost", "localhost:8787", "LOCALHOST:8787", "localhost:4321"],
)
def test_allowed_hosts(client, host):
    r = client.get("/api/health", headers={"Host": host})
    assert r.status_code == 200, host


@pytest.mark.parametrize(
    "host",
    [
        "evil.example",
        "evil.example:8787",
        "127.0.0.1.evil.example",
        "localhost.evil.example:8787",
        "192.168.0.10:8787",
        "0.0.0.0:8787",
        "[::1]:8787",
        "127.0.0.1:notaport",
        "",
    ],
)
def test_other_hosts_are_refused(client, host):
    r = client.get("/api/health", headers={"Host": host})
    assert r.status_code == 400, host
    assert r.json()["error"] == "bad_host"


def test_host_check_also_guards_static_files(client):
    assert client.get("/", headers={"Host": "evil.example"}).status_code == 400


def test_write_without_origin_is_allowed_for_local_tools(client):
    # 로컬 Jupyter의 finish() 같은 브라우저 밖 프로그램은 Origin을 보내지 않는다
    assert client.post("/api/sync", json=SYNC_BODY).status_code == 200


@pytest.mark.parametrize("origin", [ORIGIN, "http://localhost:8787", "http://127.0.0.1:8787/"])
def test_write_with_own_origin_is_allowed(client, origin):
    assert client.post("/api/sync", json=SYNC_BODY, headers={"Origin": origin}).status_code == 200


@pytest.mark.parametrize(
    "origin",
    ["http://evil.example", "null", "http://127.0.0.1:9999", "https://127.0.0.1:8787", "http://localhost:4321"],
)
def test_write_with_foreign_origin_is_refused(client, origin):
    """다른 Origin 의 쓰기는 거부(로그인 쿠키가 있어도)."""
    r = client.post("/api/sync", json=SYNC_BODY, headers={"Origin": origin})
    assert r.status_code == 403
    assert r.json()["error"] == "bad_origin"
    assert client.get("/api/state").json()["tables"]["user_pref"] == []


def test_cross_site_fetch_metadata_is_refused(client):
    r = client.post("/api/sync", json=SYNC_BODY, headers={"Sec-Fetch-Site": "cross-site"})
    assert r.status_code == 403


def test_extra_origin_can_be_allowed_by_setting(settings):
    from dataclasses import replace

    with make_client(replace(settings, extra_origins=("http://localhost:4321",))) as c:
        login_new_account(c)
        r = c.post("/api/sync", json=SYNC_BODY, headers={"Origin": "http://localhost:4321"})
        assert r.status_code == 200


def test_read_with_foreign_origin_is_not_a_write(client):
    # 읽기는 막지 않지만 CORS 머리말을 주지 않으므로 다른 사이트 스크립트는 응답을 읽지 못한다
    r = client.get("/api/health", headers={"Origin": "http://evil.example"})
    assert r.status_code == 200
    assert "access-control-allow-origin" not in {k.lower() for k in r.headers}


def test_body_over_1mb_is_refused(client):
    big = {"client_id": "pc", "ops": [op("a", "help_note", {"note_id": "n1"},
                                          {"last_cell_code": "x" * (1024 * 1024)}, t("20:00:00"))]}
    r = client.post("/api/sync", json=big)
    assert r.status_code == 413
    assert r.json()["error"] == "too_large"


def test_body_over_1mb_without_content_length_is_refused(client):
    def chunks():
        for _ in range(20):
            yield b"x" * (64 * 1024)

    r = client.post("/api/sync", content=chunks(), headers={"Content-Type": "application/json"})
    assert r.status_code == 413


def test_body_just_under_1mb_is_accepted(client):
    note = {"last_cell_code": "x" * (1024 * 1024 - 400)}
    body = {"client_id": "pc", "ops": [op("a", "help_note", {"note_id": "n1"}, note, t("20:00:00"))]}
    r = client.post("/api/sync", json=body)
    assert r.status_code == 200, r.text[:200]  # 1MB 문은 통과
    # 칸 하나의 글 길이 제한(20만 자)은 따로 있어 이 줄은 거절된다
    (rej,) = r.json()["rejected"]
    assert "너무 깁니다" in rej["reason_ko"]


def test_non_loopback_peer_is_refused(settings):
    with make_client(settings, client=("192.168.0.20", 50000)) as c:
        r = c.get("/api/health")
        assert r.status_code == 403
        assert r.json()["error"] == "not_loopback"


def test_dev_login_from_foreign_origin_is_refused(anon_client):
    """다른 사이트가 몰래 개발 계정을 만들거나 바꾸지 못한다."""
    r = anon_client.post("/api/dev-auth/accounts", json={}, headers={"Origin": "http://evil.example"})
    assert r.status_code == 403
    assert anon_client.get("/api/dev-auth/accounts").json()["accounts"] == []


def test_foreign_host_write_is_refused(client):
    r = client.post("/api/sync", json=SYNC_BODY, headers={"Host": "evil.example:8787"})
    assert r.status_code == 400
    assert client.get("/api/state").json()["tables"]["user_pref"] == []

