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


def test_pass_and_fail_lines(ref, capsys):
    assert check("L01-S12", ref.Value) is True
    out = capsys.readouterr().out
    assert out.startswith("✓ 맞음: ") and "[L01-S12]" in out
    assert check("L01-S12", 1.0) is False
    out = capsys.readouterr().out
    assert out.startswith("✕ 다시: ") and "+=" in out


def test_latest_result_wins_and_attempts_counted(ref):
    check("L01-S02", 3.0)
    check("L01-S02", 14.0003)
    rec = z2h_check.results()["L01-S02"]
    assert rec["status"] == "pass" and rec["attempts"] == 2
    assert rec["message_ko"]


def test_unknown_check_id_is_not_recorded(capsys):
    assert check("L01-S99", 1) is False
    out = capsys.readouterr().out
    assert "채점기 오류" in out and "L01-S99" in out
    assert z2h_check.results() == {}
    assert check(None) is False
    assert check(123, 4) is False


def test_check_id_case_is_forgiven(ref):
    assert check("l01-s12", ref.Value) is True
    assert "L01-S12" in z2h_check.results()


def test_wrong_call_shape_is_a_fail_not_an_exception(ref, capsys):
    assert check("L01-S12", ref.Value, 1, 2, 3) is False
    assert check("L01-S04", Valu=ref.Value) is False
    out = capsys.readouterr().out
    assert out.count("✕ 다시") == 2 and "check(" in out


def test_grader_bug_is_reported_separately(monkeypatch, capsys):
    # 패키지 안 파일에서 난 오류처럼 보이는 함수로 채점 함수를 바꿔 끼운다.
    pkg = os.path.dirname(z2h_check.__file__)
    ns = {}
    exec(compile("def broken(*a, **k):\n    return 1 / 0\n", os.path.join(pkg, "graders", "l01.py"), "exec"), ns)
    from z2h_check import graders
    monkeypatch.setitem(graders.l01.GRADERS, "L01-S02", ns["broken"])
    assert check("L01-S02", 14.0) is False
    out = capsys.readouterr().out
    assert out.startswith("⚠ 채점기 오류")
    assert "ZeroDivisionError" in out
    assert z2h_check.results()["L01-S02"]["status"] == "error"


def test_student_exception_is_a_fail(capsys):
    class Value:
        def __init__(self, *a, **k):
            raise NameError("name '___' is not defined")
    assert check("L01-S04", Value) is False
    out = capsys.readouterr().out
    assert out.startswith("✕ 다시") and "빈칸" in out
    assert z2h_check.results()["L01-S04"]["status"] == "fail"


def test_random_state_and_student_prints_are_untouched(ref, capsys):
    random.seed(5)
    before = random.getstate()

    class LoudNeuron(ref.Neuron):
        def __init__(self, nin):
            print("시끄러운 출력")
            super().__init__(nin)

    assert check("L01-S14", LoudNeuron) is True
    assert random.getstate() == before
    out = capsys.readouterr().out
    assert "시끄러운 출력" not in out


def test_check_never_raises_even_if_printing_breaks(ref, monkeypatch):
    def boom(*a, **k):
        raise OSError("출력 장치 없음")
    monkeypatch.setattr(core, "_emit", boom)
    assert check("L01-S12", ref.Value) is True
    assert finish("L01", send=False).startswith("Z2H1.")


def test_finish_table_counts_and_code(ref, capsys):
    check("L01-S12", ref.Value)
    check("L01-S02", 99.0)
    capsys.readouterr()
    code = finish("L01", send=False, at="2026-11-16T22:00:00+09:00")
    out = capsys.readouterr().out
    total = len(z2h_check.graders.lecture_checks("L01"))
    assert "통과 1" in out and "다시 1" in out and f"아직 안 함 {total - 2}" in out
    assert f"모두 {total}칸" in out
    assert "L01-R3" in out  # 아직 안 한 칸도 표에 나온다
    assert out.rstrip().endswith(code)
    got = decode_result_code(code)
    assert got == {"v": 1, "l": "L01", "p": ["L01-S12"], "f": ["L01-S02"], "t": "2026-11-16T22:00:00+09:00"}


def test_finish_without_server_is_quiet_and_quick(ref, capsys):
    check("L01-S12", ref.Value)
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


def test_finish_posts_grade_body_to_local_server(ref, capsys):
    _Capture.seen.clear()
    srv = http.server.HTTPServer(("127.0.0.1", 0), _Capture)
    th = threading.Thread(target=srv.serve_forever, daemon=True)
    th.start()
    try:
        check("L01-S12", ref.Value)
        check("L01-S02", 99.0)
        check("L01-S04", None)  # 빈칸이면 다시
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
    assert set(by_id) == {"L01-S12", "L01-S02", "L01-S04"}
    assert by_id["L01-S12"]["passed"] is True and by_id["L01-S02"]["passed"] is False
    assert by_id["L01-S12"]["message_ko"].startswith("✓ 맞음: ")
    assert by_id["L01-S02"]["message_ko"].startswith("✕ 다시: ")
    for r in body["results"]:
        assert list(r) == ["check_id", "passed", "message_ko"] and "[L01-" not in r["message_ko"]


def test_no_em_dash_in_package_sources_and_messages(ref, capsys):
    pkg = os.path.dirname(z2h_check.__file__)
    for dirpath, _, files in os.walk(pkg):
        for name in files:
            if name.endswith((".py", ".json", ".md")):
                with open(os.path.join(dirpath, name), encoding="utf-8") as fh:
                    assert chr(0x2014) not in fh.read(), name
    check("L01-S12", 1.0)
    finish("L01", send=False)
    assert chr(0x2014) not in capsys.readouterr().out
