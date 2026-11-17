"""z2h_check.rebuild: 재구성 구역의 '재구성 시작'(빈 노트북처럼)과 'R3 시작'(본문 상태 되돌리기).

정본: R1 은 빈 노트북에서, R2 는 R1 셀에 덧붙여서, R3 은 '이 편의 노트북에서 … 실행된 상태로' 시작한다.
"""
import contextlib
import io

from z2h_check import graders, rebuild
from l01_helpers import CANON

R3 = next(t for t in CANON["rebuild_tasks"] if t["rebuild_id"] == "L01-R3")
R3_SPEC = next(r for r in graders.l01.ref()["rebuild"] if r["rebuild_id"] == "L01-R3")


def _quiet(fn, *args):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        fn(*args)
    return buf.getvalue()


def _lecture_ns():
    return {"check": "체크", "finish": "마무리", "In": [], "Out": {}, "_private": 1,
            "Value": "본문 Value", "MLP": "본문 MLP", "xs": [1], "ys": [2], "random": "모듈", "loss": "본문 손실", "n": "본문 n"}


def test_start_clears_names_but_keeps_tools_and_saves_lecture():
    ns = _lecture_ns()
    out = _quiet(rebuild.start, ns)
    assert {k for k in ns if not k.startswith("_")} == {"check", "finish", "In", "Out"}
    assert ns["_private"] == 1
    assert ns[rebuild.SAVED]["Value"] == "본문 Value"
    assert "7개" in out


def test_start_twice_keeps_the_first_saved_lecture():
    ns = _lecture_ns()
    _quiet(rebuild.start, ns)
    ns["Value"] = "R1 Value"
    _quiet(rebuild.start, ns)
    assert ns[rebuild.SAVED]["Value"] == "본문 Value" and "Value" not in ns


def test_resume_restores_lecture_and_drops_what_the_check_reads():
    ns = _lecture_ns()
    _quiet(rebuild.start, ns)
    ns["Value"] = "R1 Value"
    ns["o"] = "R1 확인 셀이 만든 값"
    out = _quiet(rebuild.resume, ns, "L01-R3")
    assert ns["Value"] == "본문 Value" and ns["MLP"] == "본문 MLP" and "o" not in ns
    assert R3_SPEC["reads"] and all(name not in ns for name in R3_SPEC["reads"])
    assert all(name in R3["check_code"] for name in R3_SPEC["reads"])
    assert "되돌렸" in out


def test_resume_without_saved_lecture_says_what_is_missing():
    ns = {"check": "체크", "loss": 1.0}
    out = _quiet(rebuild.resume, ns, "L01-R3")
    assert "loss" not in ns
    for name in R3_SPEC["needs"]:
        assert name in out
