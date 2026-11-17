"""check()·finish()의 공통 동작: 출력, 기록, 예외 없음, 채점기 오류 구분, 서버 전송."""
import http.server
import json
import os
import random
import socket
import threading
import time

import pytest

import z2h_check
from z2h_check import check, decode_result_code, finish
from z2h_check import core


def closed_port_url():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return f"http://127.0.0.1:{port}/api/grade"


def good_f(x):
    return 3 * x ** 2 - 4 * x + 5


GOOD = {"f": good_f}           # L01-S02 확인 식 f(3.0) 이 정본 범위 안
BAD = {"f": lambda x: 0.0}     # 범위 밖
PASS_ID, OTHER_ID = "L01-S02", "L01-S07"  # 둘 다 정본 value_range + expr 칸


def test_pass_and_fail_lines(capsys):
    assert check(PASS_ID, GOOD) is True
    out = capsys.readouterr().out
    assert out.startswith("✓ 맞음: ") and f"[{PASS_ID}]" in out
    assert check(PASS_ID, BAD) is False
    out = capsys.readouterr().out
    assert out.startswith("✕ 다시: ") and "f(3.0)" in out


def test_latest_result_wins_and_attempts_counted():
    check(PASS_ID, BAD)
    check(PASS_ID, GOOD)
    rec = z2h_check.results()[PASS_ID]
    assert rec["status"] == "pass" and rec["attempts"] == 2
    assert rec["message_ko"]


def test_unknown_check_id_is_not_recorded(capsys):
    assert check("L01-S99", GOOD) is False
    out = capsys.readouterr().out
    assert "채점기 오류" in out and "L01-S99" in out
    assert z2h_check.results() == {}
    assert check(None) is False
    assert check(123, 4) is False
    assert check("L01-S01", GOOD) is False  # 읽기 단계는 채점 칸이 없다
    assert z2h_check.results() == {}


def test_check_id_case_is_forgiven():
    assert check(PASS_ID.lower(), GOOD) is True
    assert PASS_ID in z2h_check.results()


def test_wrong_call_shape_is_a_fail_not_an_exception(capsys):
    assert check(PASS_ID, GOOD, 1, 2, 3) is False
    assert check(PASS_ID, nss=GOOD) is False
    out = capsys.readouterr().out
    assert out.count("✕ 다시") == 2 and "globals()" in out


def test_grader_bug_is_reported_separately(monkeypatch, capsys):
    # 패키지 안 파일에서 난 오류처럼 보이는 함수로 채점 함수를 바꿔 끼운다.
    pkg = os.path.dirname(z2h_check.__file__)
    ns = {}
    exec(compile("def broken(ns=None):\n    return 1 / 0\n", os.path.join(pkg, "graders", "l01.py"), "exec"), ns)
    from z2h_check import graders
    monkeypatch.setitem(graders.l01.GRADERS, PASS_ID, ns["broken"])
    assert check(PASS_ID, GOOD) is False
    out = capsys.readouterr().out
    assert out.startswith("⚠ 채점기 오류")
    assert "ZeroDivisionError" in out
    assert z2h_check.results()[PASS_ID]["status"] == "error"


def test_student_exception_is_a_fail(capsys):
    def f(x):
        raise NameError("name '___' is not defined")
    assert check(PASS_ID, {"f": f}) is False
    out = capsys.readouterr().out
    assert out.startswith("✕ 다시") and "빈칸" in out
    assert z2h_check.results()[PASS_ID]["status"] == "fail"


def test_random_state_and_student_prints_are_untouched(capsys):
    random.seed(5)
    before = random.getstate()

    def loud_f(x):
        print("시끄러운 출력")
        random.random()
        return good_f(x)

    assert check(PASS_ID, {"f": loud_f}) is True
    assert random.getstate() == before
    out = capsys.readouterr().out
    assert "시끄러운 출력" not in out


def test_check_never_raises_even_if_printing_breaks(monkeypatch):
    def boom(*a, **k):
        raise OSError("출력 장치 없음")
    monkeypatch.setattr(core, "_emit", boom)
    assert check(PASS_ID, GOOD) is True
    assert finish("L01", send=False).startswith("Z2H1.")


def test_finish_table_counts_and_code(capsys):
    check(PASS_ID, GOOD)
    check(OTHER_ID, {"Value": lambda x: None})
    capsys.readouterr()
    code = finish("L01", send=False, at="2026-11-16T22:00:00+09:00")
    out = capsys.readouterr().out
    total = len(z2h_check.graders.lecture_checks("L01"))
    assert "통과 1" in out and "다시 1" in out and f"아직 안 함 {total - 2}" in out
    assert f"모두 {total}칸" in out
    assert "L01-R3" in out  # 아직 안 한 칸도 표에 나온다
    assert out.rstrip().endswith(code)
    got = decode_result_code(code)
    assert got == {"v": 1, "l": "L01", "p": [PASS_ID], "f": [OTHER_ID], "t": "2026-11-16T22:00:00+09:00"}


def test_finish_without_server_is_quiet_and_quick(capsys):
    check(PASS_ID, GOOD)
    capsys.readouterr()
    t0 = time.monotonic()
    code = finish("L01", server_url=closed_port_url())
    took = time.monotonic() - t0
    out = capsys.readouterr().out
    assert took < 3.0
    assert "서버에 닿지 못했습니다. 아래 결과코드를 앱에 붙여 넣으세요" in out
    assert out.index("서버에 닿지 못했습니다") < out.index(code)
    assert "Traceback" not in out


def test_finish_default_url_comes_from_env_and_unknown_lecture(capsys):
    code = finish("L01")  # conftest가 Z2H_SERVER_URL을 닫힌 포트로 돌려 둠
    assert code.startswith("Z2H1.")
    assert finish("L99") == ""
    assert "채점기 오류" in capsys.readouterr().out


def test_finish_refuses_non_local_server(capsys, monkeypatch):
    def no_network(*a, **k):
        raise AssertionError("밖으로 나가면 안 됨")
    monkeypatch.setattr(core, "_post_json", no_network)
    code = finish("L01", server_url="http://example.com/api/grade")
    out = capsys.readouterr().out
    assert code.startswith("Z2H1.") and "127.0.0.1" in out


def test_no_send_env(monkeypatch, capsys):
    monkeypatch.setenv("Z2H_NO_SEND", "1")
    monkeypatch.setattr(core, "_post_json", lambda *a, **k: (_ for _ in ()).throw(AssertionError("보내면 안 됨")))
    assert finish("L01").startswith("Z2H1.")
    assert "서버에 닿지" not in capsys.readouterr().out


class _Capture(http.server.BaseHTTPRequestHandler):
    seen = []

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        _Capture.seen.append({"path": self.path, "headers": dict(self.headers), "body": body})
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def log_message(self, *a):
        pass


def test_finish_posts_grade_body_to_local_server(capsys):
    _Capture.seen.clear()
    srv = http.server.HTTPServer(("127.0.0.1", 0), _Capture)
    th = threading.Thread(target=srv.serve_forever, daemon=True)
    th.start()
    try:
        check(PASS_ID, GOOD)
        check(OTHER_ID, {"Value": lambda x: None})
        check("L01-S11", {"d": None})  # 값을 잘못 만들었으면 다시
        url = f"http://127.0.0.1:{srv.server_address[1]}/api/grade"
        code = finish("L01", server_url=url, at="2026-11-16T22:30:00+09:00")
    finally:
        srv.shutdown()
        srv.server_close()
    out = capsys.readouterr().out
    assert "보냈습니다" in out and code in out
    assert len(_Capture.seen) == 1
    req = _Capture.seen[0]
    assert req["path"] == "/api/grade"
    assert req["headers"]["Content-Type"].startswith("application/json")
    assert req["headers"]["Origin"] == f"http://127.0.0.1:{srv.server_address[1]}"
    body = json.loads(req["body"].decode("utf-8"))
    assert list(body) == ["lecture_id", "results", "at"]
    assert body["lecture_id"] == "L01" and body["at"] == "2026-11-16T22:30:00+09:00"
    by_id = {r["check_id"]: r for r in body["results"]}
    assert set(by_id) == {PASS_ID, OTHER_ID, "L01-S11"}
    assert by_id[PASS_ID]["passed"] is True and by_id[OTHER_ID]["passed"] is False
    assert by_id[PASS_ID]["message_ko"].startswith("✓ 맞음: ")
    assert by_id[OTHER_ID]["message_ko"].startswith("✕ 다시: ")
    for r in body["results"]:
        assert list(r) == ["check_id", "passed", "message_ko"] and "[L01-" not in r["message_ko"]


def test_no_em_dash_in_package_sources_and_messages(capsys):
    pkg = os.path.dirname(z2h_check.__file__)
    for dirpath, _, files in os.walk(pkg):
        for name in files:
            if name.endswith((".py", ".json", ".md")):
                with open(os.path.join(dirpath, name), encoding="utf-8") as fh:
                    assert chr(0x2014) not in fh.read(), name
    check(PASS_ID, BAD)
    finish("L01", send=False)
    assert chr(0x2014) not in capsys.readouterr().out
