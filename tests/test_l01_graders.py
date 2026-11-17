"""1편 채점 칸: 정본(L01.json)의 expected_check 와 재구성 check_code 그대로 채점하는지.

정답 노트북 셀을 파이썬 안에서 차례로 돌려(l01_helpers.run_notebook_cells) 모든 칸이 통과하는지,
빈 학생 노트북은 '○ 아직'/'✕ 다시'만 나오는지, 틀린 변형은 '✕ 다시'인지 본다. 기준값은 정본에서 읽는다.
"""
import contextlib
import io

import pytest

import z2h_check
from z2h_check import check, decode_result_code, finish, graders, runs
from l01_helpers import B, CANON, run_notebook_cells, solution_cells, tags

STEPS = {st["step_id"]: st for st in CANON["steps"]}
CODE_STEP_IDS = [st["step_id"] for st in B.ordered_steps(CANON) if st["kind"] == "code"]
REBUILD = {t["rebuild_id"]: t for t in CANON["rebuild_tasks"]}
ALL_IDS = CODE_STEP_IDS + list(REBUILD)


def _ids_of(kind):
    return [sid for sid in CODE_STEP_IDS if STEPS[sid]["expected_check"]["type"] == kind]


def _run(cells, ns=None):
    seen = {}
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        ns = run_notebook_cells(cells, check, ns=ns, on_check=lambda cid, ok: seen.setdefault(cid, []).append(ok))
    return ns, seen, buf.getvalue()


def _lines_of(out, cid):
    return [line for line in out.splitlines() if line.endswith(f"[{cid}]")]


@pytest.fixture(scope="module")
def solution_run():
    z2h_check.reset()
    runs.forget()
    ns, seen, out = _run(solution_cells())
    results = z2h_check.results()
    with contextlib.redirect_stdout(io.StringIO()) as buf:
        code = finish("L01", send=False, at="2026-11-17T20:00:00+09:00")
    z2h_check.reset()
    runs.forget()
    return {"ns": ns, "seen": seen, "out": out, "results": results, "code": code, "table": buf.getvalue()}


def _body_cells():
    cells = solution_cells()
    start = next(i for i, c in enumerate(cells) if "rebuild-start" in tags(c))
    return cells[:start]


@pytest.fixture(scope="module")
def body_ns():
    """정답 노트북 본문(재구성 구역 앞)까지 돈 이름 공간. 재구성 변형 시험에 쓴다."""
    ns, _seen, _out = _run(_body_cells())
    z2h_check.reset()
    return ns


def test_registered_checks_are_canon_code_steps_then_rebuild():
    assert [cid for cid, _ in graders.lecture_checks("L01")] == ALL_IDS
    titles = dict(graders.lecture_checks("L01"))
    for sid in CODE_STEP_IDS:
        assert titles[sid] == STEPS[sid]["title_ko"]
    for rid, task in REBUILD.items():
        assert titles[rid] == task["title_ko"]
    for st in CANON["steps"]:
        if st["kind"] != "code":
            assert graders.canonical_id(st["step_id"]) is None, st["step_id"]


def test_solution_passes_every_check(solution_run):
    seen, out, results = solution_run["seen"], solution_run["out"], solution_run["results"]
    assert list(seen) == ALL_IDS
    assert all(oks == [True] for oks in seen.values()), {k: v for k, v in seen.items() if v != [True]}
    for cid in ALL_IDS:
        (line,) = _lines_of(out, cid)
        manual = cid in _ids_of("manual")
        assert line.startswith("✓ 실행됨: " if manual else "✓ 맞음: "), line
        assert results[cid]["status"] == "pass"


def test_finish_after_solution_lists_all_passed(solution_run):
    got = decode_result_code(solution_run["code"])
    assert got == {"v": 1, "l": "L01", "p": ALL_IDS, "f": [], "t": "2026-11-17T20:00:00+09:00"}
    assert f"모두 {len(ALL_IDS)}칸" in solution_run["table"]


def test_blank_student_notebook_only_not_yet_or_again():
    z2h_check.reset()
    student = [dict(c) for c in B.build_student(CANON).cells]
    _ns, seen, out = _run(student)
    assert list(seen) == ALL_IDS
    assert all(oks == [False] for oks in seen.values())
    for cid in ALL_IDS:
        (line,) = _lines_of(out, cid)
        assert line.startswith(("○ 아직", "✕ 다시")), line
    assert all(rec["status"] != "pass" for rec in z2h_check.results().values())
    assert "⚠" not in out


# ---- 단계 칸: 기대 모양별 -------------------------------------------------------

def _record(stdout="", shown=None, error=None, source="x = 1"):
    runs.record_cell(source, stdout=stdout, shown=shown, error=error)


def test_output_match_reads_last_cell_with_number_tolerance(capsys):
    sid = _ids_of("output_match")[0]
    want = STEPS[sid]["expected_check"]["expected"]
    _record(stdout=f"{want}\n")
    assert check(sid, {}) is True
    _record(stdout="1" + want + "\n")  # 숫자 앞에 다른 숫자가 붙으면 같은 숫자가 아니다
    assert check(sid, {}) is False
    out = capsys.readouterr().out
    assert out.splitlines()[-1].startswith("✕ 다시") and want in out


def test_output_match_numbers_within_tolerance():
    tol = z2h_check.graders.l01.ref()["tolerance"]["number"]
    sid = next(s for s in _ids_of("output_match") if "\n" in STEPS[s]["expected_check"]["expected"])
    want = STEPS[sid]["expected_check"]["expected"]
    from z2h_check.graders import _util as U
    nudged = U.NUMBER.sub(lambda m: repr(float(m.group()) + tol / 10), want)
    _record(stdout=nudged + "\n")
    assert check(sid, {}) is True
    far = U.NUMBER.sub(lambda m: repr(float(m.group()) + tol * 100), want)
    _record(stdout=far + "\n")
    assert check(sid, {}) is False


def test_output_match_uses_shown_value_and_rejects_error_cell():
    sid = next(s for s in _ids_of("output_match") if STEPS[s]["expected_check"]["expected"].startswith("Value("))
    want = STEPS[sid]["expected_check"]["expected"]
    _record(shown=want)
    assert check(sid, {}) is True
    _record(error=AttributeError("'Value' object has no attribute '_prev'"))
    assert check(sid, {}) is False
    msg = z2h_check.results()[sid]["message_ko"]
    assert "AttributeError" in msg and "_prev" in msg


def test_blank_or_missing_last_cell_is_not_yet(capsys):
    sid = _ids_of("output_match")[0]
    _record(source="# 여기에 작성")
    assert check(sid, {}) is False
    assert capsys.readouterr().out.startswith("○ 아직")
    runs.forget()  # 셀 기록이 없고 IPython 도 아니면 출력으로 보는 칸은 채점할 수 없다
    assert check(sid, {}) is False
    assert capsys.readouterr().out.startswith("· 건너뜀")
    assert sid not in z2h_check.results() or z2h_check.results()[sid]["status"] == "skip"


def test_value_range_expr_reads_namespace():
    sid = next(s for s in _ids_of("value_range") if STEPS[s]["expected_check"].get("expr") == "f(3.0)")
    exp = STEPS[sid]["expected_check"]
    assert check(sid, {"f": lambda x: 3 * x ** 2 - 4 * x + 5}) is True
    assert check(sid, {"f": lambda x: exp["max"] + 1}) is False
    msg = z2h_check.results()[sid]["message_ko"]
    assert str(exp["min"]) in msg and str(exp["max"]) in msg


def test_value_range_missing_name_is_not_yet_but_inner_name_error_is_again(capsys):
    sid = next(s for s in _ids_of("value_range") if STEPS[s]["expected_check"].get("expr") == "f(3.0)")
    assert check(sid, {}) is False
    assert sid not in z2h_check.results()
    assert "○ 아직" in capsys.readouterr().out

    def f(x):
        return undefined_name * x  # noqa: F821  학생 함수 안의 오타

    assert check(sid, {"f": f}) is False
    assert z2h_check.results()[sid]["status"] == "fail"


def test_value_range_without_expr_reads_last_number():
    (sid,) = [s for s in _ids_of("value_range") if not STEPS[s]["expected_check"].get("expr")]
    exp = STEPS[sid]["expected_check"]
    _record(stdout=f"{exp['min']}\n")
    assert check(sid, {}) is True
    _record(stdout=f"{exp['min'] - 1}\n")
    assert check(sid, {}) is False
    _record(stdout="손실\n")
    assert check(sid, {}) is False


def test_manual_step_passes_only_after_a_real_cell():
    sid = _ids_of("manual")[0]
    _record(source="# 여기에 작성")
    assert check(sid, {}) is False
    assert sid not in z2h_check.results()
    _record(source="draw_dot(L)", shown="<graphviz.graphs.Digraph object>")
    assert check(sid, {}) is True
    assert "스스로 확인" in z2h_check.results()[sid]["message_ko"]
    _record(source="draw_dot(L)", error=NameError("name 'draw_dot' is not defined"))
    assert check(sid, {}) is False


def test_check_cells_do_not_become_the_last_cell():
    sid = _ids_of("output_match")[0]
    want = STEPS[sid]["expected_check"]["expected"]
    _record(stdout=want + "\n")
    assert check(sid, {}) is True
    assert check(sid, {}) is True  # 채점 셀을 두 번 눌러도 바로 위 '내 셀'을 본다


# ---- 재구성 칸 -------------------------------------------------------------------

def _variant(rid, old, new):
    src = B.rebuild_work_source(CANON, rid)
    assert old in src, (rid, old)
    return src.replace(old, new)  # 정본 정답에서 한 곳만 틀리게 바꾼 것


def _grade_rebuild(rid, source, base):
    ns = dict(base)
    with contextlib.redirect_stdout(io.StringIO()):
        exec(compile(source, f"<{rid}>", "exec"), ns)
    return check(rid, ns)


def test_rebuild_solutions_pass_and_bug_variants_fail(body_ns):
    blank = {"check": check}
    assert _grade_rebuild("L01-R1", B.rebuild_work_source(CANON, "L01-R1"), blank) is True
    assert _grade_rebuild("L01-R1", _variant("L01-R1", "grad +=", "grad ="), blank) is False
    assert _grade_rebuild("L01-R2", B.rebuild_work_source(CANON, "L01-R2"), blank) is True
    assert _grade_rebuild("L01-R2", _variant("L01-R2", "reversed(topo)", "topo"), blank) is False
    assert _grade_rebuild("L01-R2", _variant("L01-R2", "      other.grad += 1.0", "      other.grad = 1.0"), blank) is False
    lecture = {k: v for k, v in body_ns.items() if k != "loss"}
    assert _grade_rebuild("L01-R3", B.rebuild_work_source(CANON, "L01-R3"), lecture) is True
    no_zero = _variant("L01-R3", "  for p in n.parameters():\n    p.grad = 0.0\n", "")
    assert _grade_rebuild("L01-R3", no_zero, lecture) is False
    msg = z2h_check.results()["L01-R3"]["message_ko"]
    assert "False" in msg


def test_rebuild_missing_names_is_not_yet(capsys):
    for rid in REBUILD:
        assert check(rid, {"check": check}) is False
    assert not set(REBUILD) & set(z2h_check.results())
    assert capsys.readouterr().out.count("○ 아직") == len(REBUILD)


def test_rebuild_check_runs_canon_check_code_without_touching_names(body_ns):
    ns = {k: v for k, v in body_ns.items() if k != "loss"}
    with contextlib.redirect_stdout(io.StringIO()):
        exec(compile(B.rebuild_work_source(CANON, "L01-R3"), "<R3>", "exec"), ns)
    before = dict(ns)
    assert check("L01-R3", ns) is True
    assert set(ns) == set(before) and all(ns[k] is before[k] for k in ns)
    for rid, task in REBUILD.items():
        spec = next(r for r in graders.l01.ref()["rebuild"] if r["rebuild_id"] == rid)
        assert spec["check_code"] == task["check_code"]


# ---- 출력 대조: 이름이나 주소 속 숫자는 숫자로 치지 않는다 -----------------------------

def test_digits_inside_addresses_or_names_are_not_numbers():
    from z2h_check.graders import _util as U
    tol = z2h_check.graders.l01.ref()["tolerance"]["number"]
    # 그림 객체 출력의 메모리 주소(0x13d20f5b0) 안 '20' 을 기대 출력 20.0 으로 잡으면 안 된다
    assert U.output_has("15.0\n[<matplotlib.lines.Line2D object at 0x13d20f5b0>]", "20.0", tol) is False
    assert U.output_has("20.0\n[<matplotlib.lines.Line2D object at 0x13d20f5b0>]", "20.0", tol) is True
    # 이름 안 숫자(x1)는 글자 그대로 맞춘다
    assert U.output_has("x1 -1.4999999999999996\nw1 1.0", "x1 -1.5\nw1 1.0", tol) is True
    assert U.output_has("x2 -1.5\nw1 1.0", "x1 -1.5\nw1 1.0", tol) is False
    assert U.last_number("6.0054 <Value object at 0x10a7f3e20>") == 6.0054


# ---- 그림 단계(manual): 통과로 기록하되 '맞음'이 아니라 '실행됨'으로 보인다 ----------------

def test_manual_steps_say_ran_not_correct(capsys):
    manual, other = _ids_of("manual")[0], _ids_of("output_match")[0]
    _record(source="draw_dot(L)", shown="<graphviz.graphs.Digraph object>")
    assert check(manual, {}) is True
    _record(stdout=STEPS[other]["expected_check"]["expected"] + "\n")
    assert check(other, {}) is True
    manual_line, other_line = capsys.readouterr().out.splitlines()
    assert manual_line.startswith("✓ 실행됨: ") and "맞음" not in manual_line and "스스로 확인" in manual_line
    assert other_line.startswith("✓ 맞음: ")
    assert z2h_check.results()[manual]["status"] == "pass"  # 결과코드 p 에 들어간다
    with contextlib.redirect_stdout(io.StringIO()):
        code = finish("L01", send=False, at="2026-11-17T21:00:00+09:00")
    assert decode_result_code(code)["p"] == [cid for cid in ALL_IDS if cid in (manual, other)]  # 칸 순서(정본 순서)
