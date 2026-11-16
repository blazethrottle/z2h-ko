"""1편 노트북(notebooks/ep01-micrograd/) 검사: 생성본이 최신인지, 정본과 같은 순서인지, 실제로 끝까지 도는지.

실행 검사는 저장소 .venv 의 nbconvert 로 노트북을 실제로 돌린다(`python -m nbconvert --to notebook --execute`).
- 정답 노트북: 시드 여러 개(SEEDS). 시드는 시험용 사본의 첫 셀에만 넣고, 배포 노트북에는 넣지 않는다.
- 학생 노트북: 빈칸 그대로(--allow-errors), 그리고 빈 셀에 정답(끝난 모습)을 넣은 사본.
여러 실행을 동시에 돌려 모두 합쳐 수십 초 안에 끝난다. 임시 파일은 노트북 폴더 안 임시 폴더에 두고 끝나면 지운다.
"""
import base64
import concurrent.futures as cf
import contextlib
import importlib.util
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

import pytest

nbformat = pytest.importorskip("nbformat")
pytest.importorskip("nbconvert")

from z2h_check import decode_result_code  # noqa: E402
from z2h_check import graders  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NB_DIR = os.path.join(ROOT, "notebooks", "ep01-micrograd")
SEEDS = (0, 1, 2, 3, 4)
CLOSED_URL = "http://127.0.0.1:9/api/grade"  # 아무도 듣지 않는 주소(실제 진도 서버에 보내지 않음)
EM_DASH = chr(0x2014)


def _load_builder():
    spec = importlib.util.spec_from_file_location("z2h_build_notebooks_l01", os.path.join(NB_DIR, "build_notebooks.py"))
    module = importlib.util.module_from_spec(spec)
    old = sys.dont_write_bytecode
    sys.dont_write_bytecode = True  # 노트북 폴더에 __pycache__ 를 남기지 않는다
    try:
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = old
    return module


B = _load_builder()
CANON = B.load_canon()
STEP_IDS = [st["step_id"] for st in B.ordered_steps(CANON)]


def _read(path):
    return nbformat.read(path, as_version=4)


def _tags(cell):
    return cell.metadata.get("tags", [])


def _cells(nb, kind):
    return [c for c in nb.cells if kind in _tags(c)]


def _stream(cell):
    return "".join(o.get("text", "") for o in cell.get("outputs", []) if o.output_type == "stream")


def _shown(cell):
    """셀이 화면에 보인 글: print 출력 + 마지막 줄 값(text/plain)."""
    parts = [_stream(cell)]
    for out in cell.get("outputs", []):
        if out.output_type == "execute_result":
            parts.append(out.data.get("text/plain", ""))
    return "".join(parts).strip()


def _errors(cell):
    return [o for o in cell.get("outputs", []) if o.output_type == "error"]


# ---- 실행 (모듈에서 한 번, 동시에) -------------------------------------------------

def _probe_cell(seed):
    lines = ["import sys", "print('@@prefix', sys.prefix)"]
    if seed is not None:
        lines = ["import random", f"random.seed({seed})"] + lines
    return nbformat.v4.new_code_cell("\n".join(lines), id="test-probe")


def _execute(nb, workdir, name, seed=None, allow_errors=False):
    """노트북 사본 맨 앞에 확인 셀(시드, 커널 파이썬)을 넣고 nbconvert 로 실행한다."""
    nb = nbformat.from_dict(json.loads(nbformat.writes(nb)))
    nb.cells.insert(0, _probe_cell(seed))
    src = os.path.join(workdir, f"{name}.in.ipynb")
    nbformat.write(nb, src)
    env = dict(os.environ)
    for key, sub in (("JUPYTER_RUNTIME_DIR", "runtime"), ("MPLCONFIGDIR", "mpl"), ("JUPYTER_CONFIG_DIR", "config"),
                     ("JUPYTER_DATA_DIR", "data"), ("IPYTHONDIR", f"ipython-{name}")):
        env[key] = os.path.join(workdir, "env", sub)
        os.makedirs(env[key], exist_ok=True)
    env.update(JUPYTER_PLATFORM_DIRS="1", Z2H_SERVER_URL=CLOSED_URL, PYTHONDONTWRITEBYTECODE="1")
    env.pop("Z2H_NO_SEND", None)
    env.pop("Z2H_NO_TORCH", None)
    cmd = [sys.executable, "-m", "nbconvert", "--to", "notebook", "--execute", src,
           "--output-dir", workdir, "--output", f"{name}.out",
           "--ExecutePreprocessor.kernel_name=python3", "--ExecutePreprocessor.timeout=600"]
    if allow_errors:
        cmd.append("--allow-errors")
    started = time.perf_counter()
    proc = subprocess.run(cmd, env=env, cwd=workdir, capture_output=True, text=True, timeout=900)
    seconds = time.perf_counter() - started
    out = os.path.join(workdir, f"{name}.out.ipynb")
    executed = _read(out) if proc.returncode == 0 and os.path.exists(out) else None
    return {"nb": executed, "returncode": proc.returncode, "stderr": proc.stderr[-4000:], "seconds": seconds}


@pytest.fixture(scope="module")
def runs():
    pytest.importorskip("ipykernel")
    pytest.importorskip("torch")  # 정답 노트북 L01-S13e 셀이 import torch 를 한다("torch 있는 환경" 기준)
    workdir = tempfile.mkdtemp(prefix=".nbrun-", dir=NB_DIR)
    try:
        solution = _read(B.SOLUTION_FILE)
        student = _read(B.STUDENT_FILE)
        jobs = {("solution", s): (solution, f"solution-{s}", s, False) for s in SEEDS}
        jobs[("student-empty", None)] = (student, "student-empty", None, True)
        jobs[("student-injected", 0)] = (B.inject_answers(student), "student-injected", 0, False)
        with cf.ThreadPoolExecutor(max_workers=max(1, min(4, os.cpu_count() or 1))) as pool:
            futures = {key: pool.submit(_execute, nb, workdir, name, seed=seed, allow_errors=allow)
                       for key, (nb, name, seed, allow) in jobs.items()}
            results = {key: fut.result() for key, fut in futures.items()}
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    return results


def _ok_run(run):
    assert run["returncode"] == 0, "nbconvert 실행 실패:\n" + run["stderr"]
    nb = run["nb"]
    probe = _stream(nb.cells[0])
    assert f"@@prefix {sys.prefix}" in probe, f"커널이 저장소 .venv 파이썬이 아닙니다: {probe!r}"
    return nb


def _result_code(nb):
    (cell,) = _cells(nb, "finish")
    assert not _errors(cell)
    lines = [line.strip() for line in _stream(cell).strip().splitlines()]
    assert lines and lines[-1].startswith("Z2H1."), lines[-3:]
    return decode_result_code(lines[-1])


# ---- 생성본과 정본 --------------------------------------------------------------

def test_notebooks_are_up_to_date():
    for path, text in B.outputs().items():
        with open(path, encoding="utf-8") as fh:
            assert fh.read() == text, f"{os.path.basename(path)} 가 최신이 아닙니다. build_notebooks.py 를 다시 실행하세요."


@pytest.mark.parametrize("path", ["SOLUTION_FILE", "STUDENT_FILE"])
def test_step_order_matches_canon(path):
    nb = _read(getattr(B, path))
    assert [_tags(c)[0] for c in _cells(nb, "check")] == STEP_IDS
    assert [_tags(c)[0] for c in _cells(nb, "guide")] == STEP_IDS
    order = {sid: i for i, sid in enumerate(STEP_IDS)}
    seen = [order[_tags(c)[0]] for c in nb.cells if _tags(c) and _tags(c)[0] in order]
    assert seen == sorted(seen), "단계 셀이 정본 순서와 다르게 섞여 있습니다"
    assert len(_cells(nb, "finish")) == 1 and nb.cells[-1] is _cells(nb, "finish")[0]


def test_check_ids_are_registered_graders():
    registered = [cid for cid, _title in graders.lecture_checks("L01")]
    steps_in_registry = [cid for cid in registered if cid in STEP_IDS]
    assert steps_in_registry == STEP_IDS, "채점기 등록 목록과 정본 단계가 다릅니다"
    assert set(B.CHECK_CALLS) == set(STEP_IDS)


def test_prep_cell_is_bundle_copy():
    bundle = B.bundle_source()
    for path in (B.SOLUTION_FILE, B.STUDENT_FILE):
        nb = _read(path)
        prep = [c for c in nb.cells if "z2h-bundle" in _tags(c)]
        assert len(prep) == 1 and nb.cells.index(prep[0]) < nb.cells.index(_cells(nb, "check")[0])
        source = prep[0].source
        assert source.startswith(bundle), "준비 셀 안 z2h_check 묶음이 z2h_check/_bundle.py 와 다릅니다"
        assert source[len(bundle):] == B.PREP_TRAILER
        assert "\n___ = None" in B.PREP_TRAILER


@pytest.mark.parametrize("path", ["SOLUTION_FILE", "STUDENT_FILE"])
def test_saved_without_outputs(path):
    nb = _read(getattr(B, path))
    for cell in nb.cells:
        if cell.cell_type == "code":
            assert cell.outputs == [] and cell.execution_count is None, _tags(cell)


def test_no_em_dash_in_notebook_folder():
    for name in sorted(os.listdir(NB_DIR)):
        path = os.path.join(NB_DIR, name)
        if os.path.isfile(path) and name.endswith((".ipynb", ".py", ".md")):
            with open(path, encoding="utf-8") as fh:
                assert EM_DASH not in fh.read(), name


def test_solution_cells_are_canon_code():
    nb = _read(B.SOLUTION_FILE)
    plans = {p["step"]["step_id"]: p for p in B.plan_steps(CANON)}
    for cell in _cells(nb, "step-code"):
        sid = _tags(cell)[0]
        if "edited" in _tags(cell):
            body = cell.source.split("\n")[1:]  # 첫 줄은 설명 주석
            target = next(t for t in _tags(cell) if t.startswith("target-"))[len("target-"):]
            assert body == dict(plans[sid]["edited"])[target]
        else:
            assert cell.source == "\n".join(plans[sid]["own"])
    by_id = {st["step_id"]: st for st in CANON["steps"]}
    assert _cells(nb, "step-code")[0].source == by_id[STEP_IDS[0]]["code"]


def test_student_has_no_answer_code():
    nb = _read(B.STUDENT_FILE)
    kinds = {"prep", "step-code", "check", "finish"}
    for cell in nb.cells:
        if cell.cell_type == "code":
            assert kinds & set(_tags(cell)), _tags(cell)
    for cell in _cells(nb, "step-code"):
        assert cell.source == B.PLACEHOLDER
    prepared = {st["prepared_code"] for st in CANON["steps"] if st.get("prepared_code")}
    for cell in _cells(nb, "prep"):
        assert "z2h-bundle" in _tags(cell) or cell.source in prepared
    prose = "\n".join(str(st.get(k) or "") for st in CANON["steps"] for k in ("input_ko", "expected_ko", "title_ko"))
    prose += "\n" + "\n".join(f"{e['where_ko']}\n{e.get('anchor_line') or ''}" for st in CANON["steps"] for e in st["edits"])
    text = "\n".join(c.source for c in nb.cells if "prep" not in _tags(c))
    leaked = []
    for st in CANON["steps"]:
        for line in (st.get("code") or "").split("\n"):
            line = line.strip()
            if len(line) >= 12 and line in text and line not in prose:
                leaked.append((st["step_id"], line))
    assert not leaked, f"학생 노트북에 정답 줄이 있습니다: {leaked[:5]}"


def test_student_answers_cover_every_blank_cell():
    nb = _read(B.STUDENT_FILE)
    answers = B.student_answers(CANON)
    assert [_tags(c)[0] for c in _cells(nb, "step-code")] == list(answers)
    by_id = {st["step_id"]: st for st in CANON["steps"]}
    # 끝난 모습: S15b 셀은 S16 의 # 막기를 되돌린 정본 그대로, Value 클래스 셀은 모든 고침이 들어간 것
    assert answers["L01-S15b"] == by_id["L01-S15b"]["code"]
    assert answers["L01-S04"].split("\n")[-1] == by_id["L01-S04"]["code"].split("\n")[-1]


def test_check_cells_never_raise_in_process():
    """채점 셀만 떼어 내 가짜 check 로 돌려 본다: 이름이 없거나 값을 만들다 오류가 나도 예외 없이 '○ 아직'."""
    calls = []
    for sid in STEP_IDS:
        src = B.check_cell_source(sid)
        ns = {"check": lambda cid, *a, **k: calls.append(cid) or True}
        exec(compile(B.PREP_TRAILER, "<prep>", "exec"), ns)
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            exec(compile(src, f"<{sid}>", "exec"), ns)
        assert buf.getvalue().startswith("○ 아직") and f"[{sid}]" in buf.getvalue(), (sid, buf.getvalue())
    assert calls == []
    ns = {"check": lambda cid, *a, **k: calls.append((cid, a, k)) or True}
    exec(compile(B.PREP_TRAILER, "<prep>", "exec"), ns)
    ns["Out"] = {3: [], 5: 14.0003}
    exec(compile(B.check_cell_source("L01-S02"), "<S02>", "exec"), ns)
    assert calls[-1] == ("L01-S02", (14.0003,), {})

    def broken(_d):
        raise AttributeError("'Value' object has no attribute '_op'")
    ns.update(draw_dot=broken, d=object())
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        exec(compile(B.check_cell_source("L01-S06"), "<S06>", "exec"), ns)
    assert buf.getvalue().startswith("○ 아직: 채점에 넘길 값을 만들다 오류가 났어요(AttributeError")


# ---- 실제 실행 -----------------------------------------------------------------

def _expected_number(text):
    nums = re.findall(r"-?\d+\.\d+(?:e-?\d+)?|-?\d+", text)
    return float(nums[-1])


@pytest.mark.parametrize("seed", SEEDS)
def test_solution_notebook_runs_and_passes(runs, seed):
    nb = _ok_run(runs[("solution", seed)])
    for cell in nb.cells:
        assert not _errors(cell), (_tags(cell), _errors(cell))
    for cell in _cells(nb, "check"):
        sid = _tags(cell)[0]
        text = _stream(cell).strip()
        assert text.startswith("✓ 맞음") and text.endswith(f"[{sid}]") and "\n" not in text, (sid, text)
    code = _result_code(nb)
    assert code["l"] == "L01" and code["f"] == [] and code["p"] == STEP_IDS


def test_solution_outputs_match_canon_expected_check(runs):
    """정답 노트북의 단계 셀 출력이 정본 expected_check 와 맞는다(무작위 학습 손실 S15b 는 제외: 정본도 '대개')."""
    nb = _ok_run(runs[("solution", SEEDS[0])])
    own = {_tags(c)[0]: c for c in _cells(nb, "step-code") if "edited" not in _tags(c)}
    checked = 0
    for st in B.ordered_steps(CANON):
        exp, sid = st["expected_check"], st["step_id"]
        if exp["type"] == "output_match":
            assert _shown(own[sid]) == exp["value"], sid
            checked += 1
        elif exp["type"] == "value_range" and sid != "L01-S15b":
            assert exp["min"] <= _expected_number(_shown(own[sid])) <= exp["max"], (sid, _shown(own[sid]))
            checked += 1
    assert checked > 0


def test_student_notebook_blank_never_raises(runs):
    nb = _ok_run(runs[("student-empty", None)])
    for cell in _cells(nb, "check") + _cells(nb, "finish"):
        assert not _errors(cell), (_tags(cell), _errors(cell))
    for cell in _cells(nb, "check"):
        text = _stream(cell).strip()
        assert text.startswith(("✕ 다시", "○ 아직")), (_tags(cell), text)
        assert "✓ 맞음" not in text
    code = _result_code(nb)
    assert code["p"] == []


def test_student_notebook_with_answers_passes(runs):
    nb = _ok_run(runs[("student-injected", 0)])
    for cell in nb.cells:
        assert not _errors(cell), (_tags(cell), _errors(cell))
    for cell in _cells(nb, "check"):
        text = _stream(cell).strip()
        assert text.startswith("✓ 맞음"), (_tags(cell), text)
    code = _result_code(nb)
    assert code["f"] == [] and code["p"] == STEP_IDS


def test_result_code_matches_finish_table(runs):
    """결과코드 안 JSON 이 base64url 로 풀리고 통과 목록이 채점표의 ✓ 줄과 같다."""
    nb = _ok_run(runs[("solution", SEEDS[0])])
    (cell,) = _cells(nb, "finish")
    lines = _stream(cell).strip().splitlines()
    ticked = [line.split()[1] for line in lines if line.startswith("  ✓ ")]
    body = lines[-1].strip().split(".")[1]
    data = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    assert data["p"] == ticked == STEP_IDS
