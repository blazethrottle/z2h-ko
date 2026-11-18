"""HTTP API 모양: health, 개발 로그인, state(server_seq), sync, export, 정적 파일."""

from __future__ import annotations

from pathlib import Path

from helpers import ORIGIN, aid, login_new_account, make_client, op, t
from z2h_server.config import Settings, sqlite_url


def test_health_needs_no_account(anon_client):
    r = anon_client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body == {"ok": True, "server_time": body["server_time"], "schema_version": "0002"}
    assert body["server_time"].endswith("+09:00")


def test_learning_record_apis_need_an_account(anon_client):
    for method, path, body in [
        ("get", "/api/state", None),
        ("post", "/api/sync", {"client_id": "pc", "ops": []}),
        ("get", "/api/export", None),
        ("post", "/api/result-code", {"code": "Z2H1.a.00000000"}),
        ("post", "/api/grade", {"code": "Z2H1.a.00000000"}),
        ("get", "/api/me", None),
    ]:
        r = getattr(anon_client, method)(path, **({"json": body} if body is not None else {}))
        assert r.status_code == 401, path
        assert r.json()["error"] == "no_user"


# ---------- 로컬 개발 로그인 ----------


def test_dev_login_create_list_switch_logout(anon_client):
    c = anon_client
    assert c.get("/api/dev-auth/accounts").json() == {"accounts": [], "current_user_id": None}
    a = login_new_account(c, "엄마 계정")
    r = c.post("/api/dev-auth/accounts", json={"display_name": "아빠 계정", "path_id": "investor"})
    b = r.json()["user"]["user_id"]
    assert r.json()["user"]["path_id"] == "investor"
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie
    listed = c.get("/api/dev-auth/accounts").json()
    assert [x["user_id"] for x in listed["accounts"]] == [a, b]
    assert listed["current_user_id"] == b  # 마지막으로 만든 계정으로 로그인됨
    assert c.post("/api/dev-auth/login", json={"user_id": a}).status_code == 200
    assert c.get("/api/me").json()["user"]["user_id"] == a
    assert c.post("/api/dev-auth/login", json={"user_id": "00000000-0000-4000-8000-00000000dead"}).status_code == 404
    assert c.post("/api/dev-auth/logout").status_code == 200
    assert c.get("/api/me").status_code == 401


def test_me_can_change_path_id(client):
    assert client.get("/api/me").json()["user"]["path_id"] == "full"
    r = client.post("/api/me", json={"path_id": "office_worker"})
    assert r.status_code == 200 and r.json()["user"]["path_id"] == "office_worker"
    assert client.post("/api/me", json={"path_id": "ceo"}).status_code == 400
    assert client.get("/api/state").json()["user"]["path_id"] == "office_worker"
    assert client.post("/api/dev-auth/accounts", json={"path_id": "ceo"}).status_code == 400


def test_header_login_for_tools_like_local_jupyter(client):
    """브라우저 밖 도구(finish())는 X-Z2H-User 머리말로 계정을 고른다. 쿠키 없이."""
    client.cookies.clear()
    assert client.get("/api/state").status_code == 401
    r = client.get("/api/state", headers={"X-Z2H-User": client.user_id})
    assert r.status_code == 200 and r.json()["user"]["user_id"] == client.user_id
    assert client.get("/api/state", headers={"X-Z2H-User": "not-a-user"}).status_code == 401


def test_two_accounts_over_http_are_separate(anon_client):
    c = anon_client
    a = login_new_account(c, "A")
    c.post("/api/sync", json={"client_id": "pc", "ops": [op("a1", "step_progress", {"step_id": "L01-S01"}, {"status": "done"}, t("20:00:00"))]})
    login_new_account(c, "B")
    state_b = c.get("/api/state").json()
    assert state_b["tables"]["step_progress"] == []
    assert c.get("/api/export").json()["tables"]["step_progress"] == []
    c.post("/api/dev-auth/login", json={"user_id": a})
    assert [r["step_id"] for r in c.get("/api/state").json()["tables"]["step_progress"]] == ["L01-S01"]
    assert c.get("/api/export").json()["user_id"] == a


# ---------- sync / state ----------


def test_sync_response_shape_and_state_shape(client):
    attempt = aid()
    r = client.post(
        "/api/sync",
        headers={"Origin": ORIGIN},
        json={
            "client_id": "web-pc-1",
            "ops": [
                op("o1", "step_progress", {"step_id": "L01-S14b"}, {"status": "done", "done_at": t("20:30:00"),
                   "active_seconds_auto": 300, "active_seconds_user": 420}, t("20:30:00")),
                op("o2", "question_attempt", {"question_id": "L01-Q06", "attempt_id": attempt},
                   {"answer_text": "+=", "is_correct": True, "at": t("20:31:00")}, t("20:31:00")),
                op("o3", "nope", {}, {}, t("20:31:00")),
            ],
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"applied", "superseded", "rejected", "server_time"}
    assert body["applied"] == ["o1", "o2"] and body["superseded"] == []
    assert body["rejected"][0]["op_id"] == "o3" and body["rejected"][0]["reason_ko"]

    state = client.get("/api/state").json()
    assert set(state) == {"user", "since", "server_seq", "server_time", "schema_version", "tables"}
    assert state["since"] is None and isinstance(state["server_seq"], int)
    (row,) = state["tables"]["step_progress"]
    assert row["step_id"] == "L01-S14b" and row["status"] == "done"
    assert row["active_seconds_auto"] == 300 and row["active_seconds_user"] == 420
    assert isinstance(row["server_seq"], int)
    (qa,) = state["tables"]["question_attempt"]
    assert (qa["attempt_id"], qa["attempt_no"]) == (attempt, 1)

    later = client.get("/api/state", params={"since": state["server_seq"]}).json()
    assert later["since"] == state["server_seq"]
    assert all(rows == [] for rows in later["tables"].values())


def test_state_and_export_have_no_taste_result(client):
    """맛보기 기록은 taster_result 하나(0002 에서 taste_result 를 지움)."""
    state = client.get("/api/state").json()
    assert "taste_result" not in state["tables"] and "taster_result" in state["tables"]
    assert len(state["tables"]) == 14
    assert "taste_result" not in client.get("/api/export").json()["tables"]
    r = client.post("/api/sync", json={"client_id": "pc", "ops": [op("tr", "taste_result", {}, {"loss_end": 2.4}, t("20:00:00"))]})
    assert r.status_code == 200
    assert r.json()["rejected"] == [{"op_id": "tr", "reason_ko": "모르는 표입니다: taste_result"}]


def test_me_and_no_user_say_which_login_is_in_use(anon_client):
    """auth_provider 칸: 지금 요청을 맡은 로그인 수단(개발용 로그인이면 dev_local)."""
    r = anon_client.get("/api/me")
    assert r.status_code == 401
    assert r.json() == {
        "ok": False,
        "error": "no_user",
        "message_ko": "먼저 계정을 고르거나 만들어 주세요(/api/dev-auth/accounts).",
        "auth_provider": "dev_local",
    }
    uid = login_new_account(anon_client)
    body = anon_client.get("/api/me").json()
    assert body["ok"] is True and body["user"]["user_id"] == uid and body["auth_provider"] == "dev_local"


def test_state_since_must_be_server_seq(client):
    for bad in ("어제", "2026-11-20T20:00:00+09:00", "-1"):
        r = client.get("/api/state", params={"since": bad})
        assert r.status_code == 400, bad
        assert r.json()["error"] == "bad_since"


def test_late_old_record_from_other_device_reaches_via_since(client):
    first = client.get("/api/state").json()
    client.post("/api/sync", json={"client_id": "phone", "ops": [
        op("old", "step_progress", {"step_id": "L01-S03"}, {"status": "done"}, t("08:00:00", "2026-11-19"))]})
    later = client.get("/api/state", params={"since": first["server_seq"]}).json()
    assert [r["step_id"] for r in later["tables"]["step_progress"]] == ["L01-S03"]


def test_two_devices_conflict_over_http(client):
    key = {"step_id": "L01-S09b"}
    client.post("/api/sync", json={"client_id": "phone", "ops": [op("p", "step_progress", key, {"prediction": "폰 예측"}, t("20:00:00"))]})
    r = client.post("/api/sync", json={"client_id": "pc", "ops": [op("c", "step_progress", key, {"prediction": "pc 예측"}, t("20:10:00"))]})
    assert r.json()["applied"] == ["c"]
    assert client.get("/api/state").json()["tables"]["step_progress"][0]["prediction"] == "pc 예측"
    (conflict,) = client.get("/api/export").json()["tables"]["sync_conflicts"]
    assert conflict["table_name"] == "step_progress" and conflict["row_key"] == {"step_id": "L01-S09b"}
    assert conflict["losing"]["lost_server_values"] == {"prediction": "폰 예측"}


def test_sync_bad_top_level_shape_is_422_with_korean_message(client):
    r = client.post("/api/sync", json={"ops": []})
    assert r.status_code == 422
    assert r.json()["ok"] is False and r.json()["message_ko"]


def test_export_is_a_downloadable_backup(client):
    client.post("/api/sync", json={"client_id": "pc", "ops": [op("a", "user_pref", {"pref_key": "resume"}, {"value": [1, 2]}, t("20:00:00"))]})
    r = client.get("/api/export")
    assert r.status_code == 200
    assert "attachment" in r.headers["content-disposition"] and ".json" in r.headers["content-disposition"]
    body = r.json()
    assert body["format"] == "z2h-backup" and body["user_id"] == client.user_id
    assert body["tables"]["user_pref"][0]["value"] == [1, 2]
    assert "sessions" not in body["tables"]


def test_unknown_api_path_is_json_404(client):
    r = client.get("/api/nope")
    assert r.status_code == 404 and r.json()["ok"] is False


def test_docs_pages_are_off(client):
    # 자동 문서 화면은 바깥 CDN에서 파일을 받아 오므로 끈다
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404, path


# ---------- 정적 파일 ----------


def test_without_built_app_root_returns_guide_json(anon_client):
    r = anon_client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True and body["app_built"] is False
    assert "npm run build" in body["message_ko"]


def test_built_app_is_served_from_same_address(tmp_path, db_path):
    dist = tmp_path / "dist"
    (dist / "lectures" / "L01" / "S04").mkdir(parents=True)
    (dist / "index.html").write_text("<h1>랜딩</h1>", encoding="utf-8")
    (dist / "lectures" / "L01" / "S04" / "index.html").write_text("<h1>단계 4</h1>", encoding="utf-8")
    (dist / "404.html").write_text("<h1>없음</h1>", encoding="utf-8")
    settings = Settings(db_url=sqlite_url(db_path), app_dist=dist)
    with make_client(settings) as c:
        assert "랜딩" in c.get("/").text
        assert "단계 4" in c.get("/lectures/L01/S04/").text
        missing = c.get("/no/such/page/")
        assert missing.status_code == 404 and "없음" in missing.text
        assert c.get("/api/health").json()["ok"] is True
        assert c.get("/../server/data/z2h.sqlite3").status_code == 404  # 앱 폴더 밖 파일은 못 꺼냄


# ---------- API.md 와 코드 대조 ----------


def test_api_md_lists_every_sync_table_key_and_field():
    """앱 작업자가 읽는 API.md 의 표 목록이 코드와 같아야 한다."""
    from z2h_server import sync

    text = (Path(__file__).resolve().parents[1] / "API.md").read_text(encoding="utf-8")
    lines = {ln.split("|")[1].strip(): ln for ln in text.splitlines() if ln.startswith("| `")}
    for name, rule in sync.RULES.items():
        line = lines.get(f"`{name}`")
        assert line is not None, f"API.md 에 {name} 줄이 없음"
        key_cell, data_cell = line.split("|")[2], line.split("|")[3]
        for k in rule.key:
            assert f"`{k}`" in key_cell, f"{name} 열쇠 {k} 가 API.md 에 없음"
        if rule.numbered_by is not None:
            assert "`attempt_no`" in data_cell, f"{name}: 서버가 매기는 attempt_no 설명 없음"
        for fr in rule.fields.values():
            assert f"`{fr.api}`" in data_cell, f"{name}.{fr.api} 가 API.md 에 없음"


def test_api_md_lists_every_user_pref_key():
    """서버가 받는 user_pref 열쇠 꼴(schema.PREF_KEY_FORMS)이 API.md user_pref 줄의 열쇠 칸에 모두 있어야 한다."""
    from z2h_server import schema

    text = (Path(__file__).resolve().parents[1] / "API.md").read_text(encoding="utf-8")
    (line,) = [ln for ln in text.splitlines() if ln.startswith("| `user_pref` |")]
    key_cell = line.split("|")[2]
    for form in schema.PREF_KEY_FORMS:
        name = form.split(":", 1)[0]
        shown = f"`{name}`" if name == form else f"`{name}:"
        assert shown in key_cell, f"API.md user_pref 열쇠 칸에 {form} 이 없음"
