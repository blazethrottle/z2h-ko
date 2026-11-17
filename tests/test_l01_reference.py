"""기준값 파일 z2h_check/reference/l01.json: 정본(inputs/pedagogy/content/L01.json)에서 자동으로 만든 것과 같은지.

숫자·문구를 이 시험에 적지 않고 정본에서 읽어 비교한다.
"""
import json
import os
import re
import subprocess
import sys

from z2h_check import refgen
from l01_helpers import CANON, ROOT

REF_FILE = os.path.join(ROOT, "z2h_check", "reference", "l01.json")


def _ref():
    with open(REF_FILE, encoding="utf-8") as fh:
        return json.load(fh)


def test_reference_file_is_generated_from_canon():
    with open(REF_FILE, encoding="utf-8") as fh:
        assert fh.read() == refgen.render(refgen.build(CANON)), "python -m z2h_check.refgen --write 로 다시 만드세요"


def test_refgen_check_command():
    proc = subprocess.run([sys.executable, "-m", "z2h_check.refgen", "--check"], cwd=ROOT,
                          capture_output=True, text=True, timeout=120)
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_steps_are_canon_code_steps_with_their_expected_check():
    ref = _ref()
    code_steps = [st for st in sorted(CANON["steps"], key=lambda s: s["order"]) if st["kind"] == "code"]
    assert [s["step_id"] for s in ref["steps"]] == [st["step_id"] for st in code_steps]
    for spec, st in zip(ref["steps"], code_steps):
        assert spec["title_ko"] == st["title_ko"]
        assert spec["expected_check"] == st["expected_check"]
        expr = st["expected_check"].get("expr")
        assert ("reads" in spec) is bool(expr)
        for name in spec.get("reads", []):  # 확인 식이 읽는 이름은 식 안에 있다
            assert re.search(r"\b" + re.escape(name) + r"\b", expr), (st["step_id"], name)
    assert ref["canon"]["version"] == CANON["_meta"]["version"]
    assert ref["mastery_rule"] == CANON["mastery_rule"]


def test_tolerance_is_the_canon_rule():
    text = " ".join(CANON["_meta"]["code_conventions"])
    (tol,) = set(re.findall(r"허용오차 ([0-9.eE-]+)", text))
    assert _ref()["tolerance"]["number"] == float(tol)


def test_rebuild_specs_follow_canon_check_code_and_pass_ko():
    ref = _ref()
    tasks = CANON["rebuild_tasks"]
    assert [r["rebuild_id"] for r in ref["rebuild"]] == [t["rebuild_id"] for t in tasks]
    for spec, task in zip(ref["rebuild"], tasks):
        assert spec["title_ko"] == task["title_ko"]
        assert spec["check_code"] == task["check_code"]
        assert spec["max_hint_level_for_pass"] == task["max_hint_level_for_pass"]
        rule = spec["pass"]
        shown = re.findall(r"`([^`]+)`", task["pass_ko"])
        if rule["rule"] == "ends_with":
            # 정본 통과 기준이 '확인 셀의 끝이 `X`이면 통과' 인 조각: 끝 글자만 본다
            assert re.search(r"끝이 `" + re.escape(rule["text"]) + r"`이면 통과", task["pass_ko"]), task["pass_ko"]
            assert task["check"]["expected"].split()[-1] == rule["text"]
        else:
            assert rule == {"rule": "output_match", "expected": task["check"]["expected"]}
            for piece in shown:  # 통과 기준 글에 나온 출력은 모두 기대 출력에 있다
                assert piece in task["check"]["expected"], (task["rebuild_id"], piece)


def test_rebuild_reads_are_free_names_of_check_code():
    by_id = {t["rebuild_id"]: t for t in CANON["rebuild_tasks"]}
    for spec in _ref()["rebuild"]:
        code = by_id[spec["rebuild_id"]]["check_code"]
        for name in spec["reads"]:
            assert re.search(r"\b" + re.escape(name) + r"\b", code), (spec["rebuild_id"], name)
            assert not re.search(r"\b" + re.escape(name) + r"\s*=[^=]", code), (spec["rebuild_id"], name)
        solution = by_id[spec["rebuild_id"]]["solution_code"]
        for name in spec["needs"]:
            assert re.search(r"\b" + re.escape(name) + r"\b", solution), (spec["rebuild_id"], name)


def test_old_rules_are_gone():
    """옛 정본에만 있던 R3 다시 실행 규칙(max_reruns, steps_per_run)과 손실 0.1 기준은 새 정본에 없다."""
    text = json.dumps(_ref(), ensure_ascii=False)
    for word in ("max_reruns", "steps_per_run", "last_loss_max"):
        assert word not in text
    r3 = next(t for t in CANON["rebuild_tasks"] if t["rebuild_id"] == "L01-R3")
    assert "max_reruns" not in r3["check"] and "steps_per_run" not in r3["check"]


def test_no_null_and_no_em_dash():
    text = open(REF_FILE, encoding="utf-8").read()
    assert "null" not in text
    assert chr(0x2014) not in text
