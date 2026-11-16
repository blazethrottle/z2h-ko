"""결과코드 `Z2H1.{base64url(JSON)}.{crc32 8자리}` 해독(DESIGN.md 12.7)과 /api/result-code, /api/grade."""

from __future__ import annotations

import base64
import json
import zlib

import pytest

from helpers import ORIGIN, t
from z2h_server import result_code as rc

GOLDEN_JSON = '{"v":1,"l":"L01","p":["L01-S04","L01-S11b"],"f":["L01-S12"],"t":"2026-11-20T21:00:00+09:00"}'
GOLDEN_CODE = (
    "Z2H1.eyJ2IjoxLCJsIjoiTDAxIiwicCI6WyJMMDEtUzA0IiwiTDAxLVMxMWIiXSwiZiI6WyJMMDEtUzEyIl0sInQi"
    "OiIyMDI2LTExLTIwVDIxOjAwOjAwKzA5OjAwIn0.e00a6ba9"
)


def build_by_hand(obj: dict) -> str:
    """규칙을 손으로 그대로 따라 만든 코드(서버 encode 와 별개로)."""
    payload = base64.urlsafe_b64encode(json.dumps(obj, separators=(",", ":")).encode()).rstrip(b"=").decode()
    crc = format(zlib.crc32(payload.encode("utf-8")) & 0xFFFFFFFF, "08x")
    return f"Z2H1.{payload}.{crc}"


def test_golden_vector_decodes():
    got = rc.decode(GOLDEN_CODE)
    assert got.version == 1
    assert got.lecture_id == "L01"
    assert got.passed == ["L01-S04", "L01-S11b"]
    assert got.failed == ["L01-S12"]
    assert got.t == "2026-11-20T21:00:00+09:00"


def test_golden_vector_matches_rule_by_hand():
    assert build_by_hand(json.loads(GOLDEN_JSON)) == GOLDEN_CODE


def test_encode_then_decode_round_trip():
    code = rc.encode("L01", passed=["L01-S01"], failed=[], t="2026-11-20T21:00:00+09:00")
    assert code.startswith("Z2H1.")
    payload, crc = code.split(".")[1:]
    assert "=" not in payload
    assert len(crc) == 8 and crc == crc.lower()
    assert rc.decode(code).passed == ["L01-S01"]


def test_pasted_code_with_spaces_newlines_and_quotes_is_accepted():
    messy = "  '" + GOLDEN_CODE[:40] + "\n" + GOLDEN_CODE[40:] + "'  \n"
    assert rc.decode(messy).lecture_id == "L01"


def test_one_wrong_letter_is_caught_by_crc():
    i = 20
    wrong = GOLDEN_CODE[:i] + ("A" if GOLDEN_CODE[i] != "A" else "B") + GOLDEN_CODE[i + 1 :]
    with pytest.raises(rc.ResultCodeError) as e:
        rc.decode(wrong)
    assert e.value.error == "bad_checksum"
    assert "다시 복사" in e.value.message_ko


def test_wrong_crc_digit_is_caught():
    wrong = GOLDEN_CODE[:-1] + ("0" if GOLDEN_CODE[-1] != "0" else "1")
    with pytest.raises(rc.ResultCodeError) as e:
        rc.decode(wrong)
    assert e.value.error == "bad_checksum"


def test_cut_off_code_is_caught():
    with pytest.raises(rc.ResultCodeError) as e:
        rc.decode(GOLDEN_CODE[:-12])
    assert e.value.error in {"bad_checksum", "bad_format"}


@pytest.mark.parametrize(
    "code, error",
    [
        ("", "empty"),
        ("   ", "empty"),
        ("hello", "bad_format"),
        ("Z2H2.abc.12345678", "bad_format"),
        ("Z2H1.abc", "bad_format"),
        ("Z2H1.ab+c.12345678", "bad_format"),
    ],
)
def test_bad_shapes(code, error):
    with pytest.raises(rc.ResultCodeError) as e:
        rc.decode(code)
    assert e.value.error == error
    assert e.value.message_ko


@pytest.mark.parametrize(
    "obj, error",
    [
        ({"v": 2, "l": "L01", "p": [], "f": [], "t": "2026-11-20T21:00:00+09:00"}, "bad_version"),
        ({"v": 1, "l": "X", "p": [], "f": [], "t": "2026-11-20T21:00:00+09:00"}, "bad_payload"),
        ({"v": 1, "l": "L01", "p": "L01-S01", "f": [], "t": "2026-11-20T21:00:00+09:00"}, "bad_payload"),
        ({"v": 1, "l": "L01", "p": [], "f": [], "t": "2026-11-20T21:00:00"}, "bad_payload"),
        ({"v": 1, "l": "L01", "p": ["L01-S01"], "f": ["L01-S01"], "t": "2026-11-20T21:00:00+09:00"}, "bad_payload"),
        ({"v": 1, "l": "L01", "p": [""], "f": [], "t": "2026-11-20T21:00:00+09:00"}, "bad_payload"),
    ],
)
def test_bad_contents_with_valid_crc(obj, error):
    with pytest.raises(rc.ResultCodeError) as e:
        rc.decode(build_by_hand(obj))
    assert e.value.error == error


# ---------- API ----------


def test_api_result_code_saves_grade_results(client):
    r = client.post("/api/result-code", json={"code": GOLDEN_CODE}, headers={"Origin": ORIGIN})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["lecture_id"] == "L01"
    assert body["passed"] == ["L01-S04", "L01-S11b"] and body["failed"] == ["L01-S12"]
    assert sorted(body["applied"]) == ["L01-S04", "L01-S11b", "L01-S12"]
    state = client.get("/api/state").json()
    rows = {r["check_id"]: r for r in state["tables"]["grade_result"]}
    assert rows["L01-S11b"]["passed"] is True
    assert rows["L01-S12"]["passed"] is False
    assert rows["L01-S12"]["source"] == "result_code"
    assert rows["L01-S12"]["at"] == "2026-11-20T21:00:00+09:00"


def test_api_result_code_pasted_twice_is_harmless(client):
    for _ in range(2):
        r = client.post("/api/result-code", json={"code": GOLDEN_CODE})
        assert r.status_code == 200
    state = client.get("/api/state").json()
    assert len(state["tables"]["grade_result"]) == 3
    assert client.get("/api/export").json()["tables"]["sync_conflicts"] == []


def test_api_result_code_older_code_does_not_overwrite_newer(client):
    newer = rc.encode("L01", passed=["L01-S12"], failed=[], t=t("22:00:00"))
    assert client.post("/api/result-code", json={"code": newer}).status_code == 200
    r = client.post("/api/result-code", json={"code": GOLDEN_CODE})  # 21:00, S12 실패
    assert r.status_code == 200
    assert "L01-S12" in r.json()["superseded"]
    rows = {x["check_id"]: x for x in client.get("/api/state").json()["tables"]["grade_result"]}
    assert rows["L01-S12"]["passed"] is True


def test_api_result_code_wrong_letter_gives_korean_guide(client):
    wrong = GOLDEN_CODE[:20] + ("A" if GOLDEN_CODE[20] != "A" else "B") + GOLDEN_CODE[21:]
    r = client.post("/api/result-code", json={"code": wrong})
    assert r.status_code == 400
    body = r.json()
    assert body["ok"] is False
    assert body["error"] == "bad_checksum"
    assert "결과코드" in body["message_ko"]
    assert client.get("/api/state").json()["tables"]["grade_result"] == []


def test_api_grade_accepts_result_code_from_notebook(client):
    client.cookies.clear()  # 로컬 Jupyter 는 쿠키 없이 X-Z2H-User 머리말로 계정을 고른다
    r = client.post("/api/grade", json={"code": GOLDEN_CODE}, headers={"X-Z2H-User": client.user_id})
    assert r.status_code == 200, r.text
    state = client.get("/api/state", headers={"X-Z2H-User": client.user_id}).json()
    rows = {x["check_id"]: x for x in state["tables"]["grade_result"]}
    assert rows["L01-S04"]["source"] == "notebook"


def test_api_grade_accepts_structured_results(client):
    body = {  # 12.7절 모양: {lecture_id, results, at}
        "lecture_id": "L01",
        "at": t("21:30:00"),
        "results": [
            {"check_id": "L01-S11b", "passed": True, "message_ko": "✓ 맞음"},
            {"check_id": "L01-S12", "passed": False, "message_ko": "✕ 다시: a.grad 가 1.0 입니다"},
        ],
    }
    r = client.post("/api/grade", json=body)
    assert r.status_code == 200, r.text
    assert sorted(r.json()["applied"]) == ["L01-S11b", "L01-S12"]
    rows = {x["check_id"]: x for x in client.get("/api/state").json()["tables"]["grade_result"]}
    assert rows["L01-S12"]["message_ko"].startswith("✕ 다시")
    assert rows["L01-S12"]["source"] == "notebook"


def test_api_grade_rejects_bad_structured_body(client):
    r = client.post("/api/grade", json={"lecture_id": "L01", "at": "어제", "results": []})
    assert r.status_code == 400
    assert r.json()["ok"] is False


def _finish_body():
    """z2h_check 의 finish() 가 보내는 본문 그대로(키 순서 포함, 12.7절)."""
    return (
        '{"lecture_id":"L01","results":['
        '{"check_id":"L01-S12","passed":true,"message_ko":"✓ 맞음: a.grad 가 2.0"},'
        '{"check_id":"L01-S13","passed":false,"message_ko":"✕ 다시: 손실이 줄지 않았어요"}],'
        '"at":"2026-11-16T22:30:00+09:00"}'
    ).encode("utf-8")


def test_api_grade_exact_request_from_notebook_finish(client):
    """finish(): Origin 은 서버 주소 그대로, 계정은 X-Z2H-User 머리말, 시각 키는 at."""
    client.cookies.clear()
    r = client.post(
        "/api/grade",
        content=_finish_body(),
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Origin": "http://127.0.0.1:8787",
            "X-Z2H-User": client.user_id,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["t"] == "2026-11-16T22:30:00+09:00"
    state = client.get("/api/state", headers={"X-Z2H-User": client.user_id}).json()
    rows = {x["check_id"]: x for x in state["tables"]["grade_result"]}
    assert rows["L01-S12"]["passed"] is True and rows["L01-S12"]["source"] == "notebook"
    assert rows["L01-S13"]["message_ko"].startswith("✕ 다시")
    assert rows["L01-S13"]["at"] == "2026-11-16T22:30:00+09:00"


def test_api_grade_without_account_is_401_so_finish_can_fall_back(client):
    client.cookies.clear()
    r = client.post(
        "/api/grade",
        content=_finish_body(),
        headers={"Content-Type": "application/json; charset=utf-8", "Origin": "http://127.0.0.1:8787"},
    )
    assert r.status_code == 401 and r.json()["error"] == "no_user"
