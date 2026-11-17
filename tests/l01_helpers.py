"""1편 시험 도우미: 노트북 생성기(build_notebooks.py)를 불러오고, 정답 노트북 셀을 파이썬 안에서 차례로 돌린다.

- run_notebook_cells(): 셀 하나를 IPython 처럼 실행한다(print 출력을 모으고, 마지막 줄이 식이면 그 값을 보여 준다).
  채점 셀이 '바로 위 셀이 보인 것'을 읽을 수 있게 z2h_check.runs.record_cell() 로 기록을 넘긴다.
  진짜 IPython 커널 동작은 test_notebooks_l01.py(nbconvert)와 test_bundle.py(IPython 셸)가 따로 본다.
- learner_actions(): 학생 노트북에서 학생이 하는 순서(빈 셀 채우기, 앞 셀 고치기, 다시 실행)를 정본에서 만든다.
"""
import ast
import contextlib
import importlib.util
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NB_DIR = os.path.join(ROOT, "notebooks", "ep01-micrograd")


def load_builder():
    spec = importlib.util.spec_from_file_location("z2h_build_notebooks_l01", os.path.join(NB_DIR, "build_notebooks.py"))
    module = importlib.util.module_from_spec(spec)
    old = sys.dont_write_bytecode
    sys.dont_write_bytecode = True  # 노트북 폴더에 __pycache__ 를 남기지 않는다
    try:
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = old
    return module


B = load_builder()
CANON = B.load_canon()


def tags(cell):
    return cell["metadata"].get("tags", [])


def run_cell(source, ns):
    """셀 하나를 실행하고 (화면 글, 마지막 줄 값의 글, 오류)를 돌려준다. 마지막 줄이 식이면 IPython 처럼 그 값을 보여 준다."""
    out = io.StringIO()
    shown, error = None, None
    try:
        tree = ast.parse(source)
        last = tree.body[-1] if tree.body and isinstance(tree.body[-1], ast.Expr) else None
        body = ast.Module(body=tree.body[:-1] if last else tree.body, type_ignores=[])
        with contextlib.redirect_stdout(out):
            # 시험용: 저장소의 정답 노트북 셀(정본 코드)을 IPython 대신 실행한다
            exec(compile(body, "<셀>", "exec"), ns)
            if last is not None:
                value = eval(compile(ast.Expression(last.value), "<셀>", "eval"), ns)
                if value is not None:
                    shown = repr(value)
    except Exception as exc:  # 셀 오류는 화면에 보이는 것과 같이 기록만 한다
        error = exc
    return out.getvalue(), shown, error


def run_notebook_cells(cells, check, ns=None, record=None, on_check=None):
    """노트북 셀(dict 목록)을 차례로 돌린다. 'check' 셀은 check 함수로 채점만 하고, 나머지는 실행해 record 로 기록한다.

    on_check(셀 주인 id, 결과)를 채점 셀마다 부른다. 돌려주는 것: 이름 공간."""
    from z2h_check import runs
    record = record or runs.record_cell
    ns = {} if ns is None else ns
    ns.setdefault("check", check)
    for cell in cells:
        if cell["cell_type"] != "code":
            continue
        kinds = set(tags(cell))
        if kinds & {"z2h-bundle", "finish", "rebuild-start", "rebuild-resume"}:
            if "rebuild-start" in kinds or "rebuild-resume" in kinds:
                with contextlib.redirect_stdout(io.StringIO()):
                    exec(compile(cell["source"], "<재구성 셀>", "exec"), ns)
            continue
        if "check" in kinds:
            ok = check(tags(cell)[0], ns)
            if on_check:
                on_check(tags(cell)[0], ok)
            continue
        stdout, shown, error = run_cell(cell["source"], ns)
        record(cell["source"], stdout=stdout, shown=shown, error=error)
    return ns


def solution_cells(canon=None):
    nb = B.build_solution(canon or CANON)
    return [dict(c) for c in nb.cells]


def find_cell(cells, owner, kind):
    hits = [i for i, c in enumerate(cells) if tags(c)[:1] == [owner] and kind in tags(c)]
    assert len(hits) == 1, (owner, kind, hits)
    return hits[0]


def learner_actions(student_cells, canon=None):
    """학생 노트북에서 학생이 하는 일을 차례대로: ("run", 셀 번호) 또는 ("set", 셀 번호, 새 소스).

    본문: 단계마다 준비 코드 셀 → 앞 셀 고치기(정본 edits) → rerun_first 셀 다시 실행 → 빈 셀 채워 실행 → 채점 셀.
    재구성: 재구성 시작 → R1 빈 셀 → 확인 셀 → 채점 셀 → R1 셀에 R2 를 덧붙여 다시 실행 → … → R3 시작 → R3 빈 셀 → …"""
    canon = canon or CANON
    acts = []
    for i, c in enumerate(student_cells):
        if tags(c)[:1] == ["setup"] and c["cell_type"] == "code":
            acts.append(("run", i))
    for plan in B.plan_steps(canon):
        st = plan["step"]
        sid = st["step_id"]
        if st.get("prepared_code") and sid != B.DEVICE_STEP:
            acts.append(("run", find_cell(student_cells, sid, "prepared-code")))
        for target, lines in plan["edited"].items():
            acts.append(("set", find_cell(student_cells, target, "step-code"), "\n".join(lines)))
        for rid, _lines in plan["reruns"]:
            acts.append(("run", find_cell(student_cells, rid, "step-code")))
        if plan["own"]:
            at = find_cell(student_cells, sid, "step-code")
            acts += [("set", at, "\n".join(plan["own"])), ("run", at)]
        if st["kind"] == "code":
            acts.append(("run", find_cell(student_cells, sid, "check")))
    acts.append(("run", find_cell(student_cells, "rebuild", "rebuild-start")))
    for task in B.rebuild_tasks(canon):
        rid = task["rebuild_id"]
        flow = B.REBUILD_FLOW[rid]
        if flow == "lecture":
            acts.append(("run", find_cell(student_cells, rid, "rebuild-resume")))
        owner = B.rebuild_work_owner(canon, rid)
        work = find_cell(student_cells, owner, "rebuild-code")
        acts += [("set", work, B.rebuild_work_source(canon, rid)), ("run", work),
                 ("run", find_cell(student_cells, rid, "rebuild-check-code")),
                 ("run", find_cell(student_cells, rid, "check"))]
    acts.append(("run", find_cell(student_cells, B.LECTURE_ID, "finish")))
    return acts


def actions_json(student_cells, canon=None):
    return json.dumps(learner_actions(student_cells, canon), ensure_ascii=False)
