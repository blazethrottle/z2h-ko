"""맛보기 노트북(notebooks/taster/) 검사: 생성본이 최신인지, 정본과 같은 순서·코드인지, 실제로 끝까지 돌고 출력이 정본과 같은지.

실행 검사는 저장소 .venv 의 nbconvert 로 노트북을 실제로 돌린다(`python -m nbconvert --to notebook --execute`).
- 배포본 그대로: names.txt 를 pytest 임시 폴더에 미리 받아 두고 그 폴더에서 실행한다
  (맥에 wget 이 없어도 T-S03 정본 셀이 미리 받은 파일을 읽는다. wget 이 있으면 같은 파일을 한 번 더 받는다).
- wget 없는 로컬: PATH 에서 wget 을 빼고, 미리 받은 파일 없이 --allow-errors 로 실행한다.
  T-S03 정본 셀만 FileNotFoundError 가 나고, 바로 아래 대체 셀(alt-local)이 파일을 받아 나머지 출력은 정본과 같아야 한다.
names.txt 는 저장소에 넣지 않는다(pytest 임시 폴더에만 받고 끝나면 지운다). 네트워크가 없으면 실행 검사만 skip 한다.

맥 실행 기록(notebooks/taster/mac_run.json) 다시 쓰기:
    Z2H_TASTER_RECORD=1 .venv/bin/python -m pytest tests/test_notebooks_taster.py -q -s
실측 숫자(손실, 실행 시간, 단계별 일치)는 -s 를 붙이면 화면에 보인다.
"""
import concurrent.futures as cf
import datetime as dt
import importlib.util
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import time
import urllib.request

import pytest

nbformat = pytest.importorskip("nbformat")
pytest.importorskip("nbconvert")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NB_DIR = os.path.join(ROOT, "notebooks", "taster")
MAC_RUN_FILE = os.path.join(NB_DIR, "mac_run.json")
TEACHER_OUTPUTS_FILE = os.path.join(ROOT, "inputs", "pedagogy", "content", "taster_outputs.json")
EM_DASH = chr(0x2014)
KST = dt.timezone(dt.timedelta(hours=9))

# MILESTONES P2 기준: T-S06 첫 손실 3.7~4.0, 마지막 손실 2.6 이하
LOSS_FIRST_RANGE = (3.7, 4.0)
LOSS_LAST_MAX = 2.6
# 숫자 끝자리 차이 허용 폭(T-S06 은 소수 셋째 자리로 반올림해 보여 준다)
NUMBER_TOLERANCE = 0.002


def _load_builder():
    spec = importlib.util.spec_from_file_location("z2h_build_notebook_taster", os.path.join(NB_DIR, "build_notebook.py"))
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
STEPS = B.ordered_steps(CANON)
BY_ID = {st["step_id"]: st for st in STEPS}
STEP_IDS = [st["step_id"] for st in STEPS]
CODE_STEPS = [st["step_id"] for st in STEPS if st.get("code")]
ALT_STEPS = [st["step_id"] for st in STEPS if st.get("code_alt_local")]
OUTPUT_STEPS = [st["step_id"] for st in STEPS if st.get("expected_output_example") is not None]
LOSS_STEP = "T-S06"


def _names_url():
    for st in STEPS:
        for code in (st.get("code_alt_local") or "", st.get("code") or ""):
            hit = re.search(r"https://\S+?/names\.txt", code)
            if hit:
                return hit.group(0)
    raise AssertionError("정본 코드에서 names.txt 주소를 찾지 못했습니다")


NAMES_URL = _names_url()


def _read(path):
    return nbformat.read(path, as_version=4)


def _tags(cell):
    return cell.metadata.get("tags", [])


def _cells(nb, kind):
    return [c for c in nb.cells if kind in _tags(c)]


def _cell_of(nb, step_id, kind):
    found = [c for c in nb.cells if _tags(c)[:1] == [step_id] and kind in _tags(c)]
    assert len(found) == 1, (step_id, kind, len(found))
    return found[0]


def _stream(cell, name="stdout"):
    return "".join(o.get("text", "") for o in cell.get("outputs", [])
                   if o.output_type == "stream" and o.get("name") == name)


def _errors(cell):
    return [o for o in cell.get("outputs", []) if o.output_type == "error"]


# ---- 출력 비교 ------------------------------------------------------------------

_NUM = re.compile(r"-?\d+(?:\.\d+)?")


def compare(actual, expected):
    """('exact' | 'close' | 'diff', 설명). close = 줄 수·글자는 같고 숫자만 허용 폭 안에서 다름."""
    if actual == expected:
        return "exact", ""
    a_lines, e_lines = actual.splitlines(), expected.splitlines()
    if len(a_lines) == len(e_lines) and all(_NUM.sub("#", a) == _NUM.sub("#", e) for a, e in zip(a_lines, e_lines)):
        pairs = [(float(x), float(y)) for a, e in zip(a_lines, e_lines)
                 for x, y in zip(_NUM.findall(a), _NUM.findall(e))]
        worst = max(abs(x - y) for x, y in pairs)
        if worst <= NUMBER_TOLERANCE:
            return "close", f"숫자 끝자리만 다름(가장 큰 차이 {worst:.4f}, 허용 {NUMBER_TOLERANCE})"
        return "diff", f"숫자가 허용 폭보다 크게 다름(가장 큰 차이 {worst:.4f})"
    for i, (a, e) in enumerate(zip(a_lines, e_lines), 1):
        if a != e:
            return "diff", f"{i}번째 줄: 실제 {a!r}, 정본 {e!r}"
    return "diff", f"줄 수가 다름: 실제 {len(a_lines)}줄, 정본 {len(e_lines)}줄"


def _without_wget_noise(text):
    """wget 이 없는 맥에서 `!wget` 이 남기는 셸 안내 줄(wget 이 들어 있는 줄)을 뺀 글과 뺀 줄."""
    kept, dropped = [], []
    for line in text.splitlines(keepends=True):
        (dropped if "wget" in line else kept).append(line)
    return "".join(kept), [line.rstrip("\n") for line in dropped]


def _losses(text):
    rows = [line.split() for line in text.strip().splitlines()]
    return [(int(step), float(loss)) for step, loss in rows]


# ---- 실행 (모듈에서 한 번, 두 가지를 동시에) ---------------------------------------

def _probe_cell():
    return nbformat.v4.new_code_cell("\n".join([
        "import sys, platform, importlib.metadata as _md",
        "print('@@prefix', sys.prefix)",
        "print('@@python', platform.python_version())",
        "print('@@torch', _md.version('torch'))",
    ]), id="test-probe")


def _path_without_wget():
    keep = [d for d in os.environ.get("PATH", "").split(os.pathsep)
            if d and not os.access(os.path.join(d, "wget"), os.X_OK)]
    return os.pathsep.join(keep)


def _execute(nb, workdir, name, allow_errors=False, path=None):
    """노트북 사본 맨 앞에 확인 셀(커널 파이썬, torch 버전)을 넣고 workdir 에서 nbconvert 로 실행한다."""
    nb = nbformat.from_dict(json.loads(nbformat.writes(nb)))
    nb.cells.insert(0, _probe_cell())
    src = os.path.join(workdir, f"{name}.in.ipynb")
    nbformat.write(nb, src)
    env = dict(os.environ)
    for key, sub in (("JUPYTER_RUNTIME_DIR", "runtime"), ("MPLCONFIGDIR", "mpl"), ("JUPYTER_CONFIG_DIR", "config"),
                     ("JUPYTER_DATA_DIR", "data"), ("IPYTHONDIR", "ipython")):
        env[key] = os.path.join(workdir, "env", sub)
        os.makedirs(env[key], exist_ok=True)
    env.update(JUPYTER_PLATFORM_DIRS="1", PYTHONDONTWRITEBYTECODE="1")
    if path is not None:
        env["PATH"] = path
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
def names_file(tmp_path_factory):
    """names.txt 를 pytest 임시 폴더에 한 번 받아 둔다. 못 받으면(네트워크 없음) 실행 검사만 skip."""
    folder = tmp_path_factory.mktemp("taster-names")
    target = folder / "names.txt"
    try:
        with urllib.request.urlopen(NAMES_URL, timeout=30) as resp:
            target.write_bytes(resp.read())
    except Exception as exc:  # 네트워크 없음, DNS 실패 등
        reason = f"names.txt 를 내려받지 못해 실행 검사를 건너뜁니다({type(exc).__name__}: {exc}). 주소: {NAMES_URL}"
        print(reason)
        pytest.skip(reason)
    yield target
    shutil.rmtree(folder, ignore_errors=True)


@pytest.fixture(scope="module")
def runs(names_file, tmp_path_factory):
    pytest.importorskip("ipykernel")
    pytest.importorskip("torch")
    nb = _read(B.NOTEBOOK_FILE)
    as_is = tmp_path_factory.mktemp("taster-as-is")
    no_wget = tmp_path_factory.mktemp("taster-no-wget")
    shutil.copy(names_file, as_is / "names.txt")
    try:
        with cf.ThreadPoolExecutor(max_workers=2) as pool:
            fut_as_is = pool.submit(_execute, nb, str(as_is), "as-is")
            fut_no_wget = pool.submit(_execute, nb, str(no_wget), "no-wget", True, _path_without_wget())
            results = {"as-is": fut_as_is.result(), "no-wget": fut_no_wget.result()}
    finally:
        shutil.rmtree(as_is, ignore_errors=True)  # 받은 names.txt 도 함께 지운다
        shutil.rmtree(no_wget, ignore_errors=True)
    return results


def _ok_run(run):
    assert run["returncode"] == 0, "nbconvert 실행 실패:\n" + run["stderr"]
    nb = run["nb"]
    probe = _stream(nb.cells[0])
    assert f"@@prefix {sys.prefix}" in probe, f"커널이 저장소 .venv 파이썬이 아닙니다: {probe!r}"
    return nb


def _probe_value(nb, key):
    for line in _stream(nb.cells[0]).splitlines():
        if line.startswith(f"@@{key} "):
            return line.split(" ", 1)[1]
    return None


def _step_output(nb, sid):
    """정본 셀(step-code)의 print 출력. T-S03 은 wget 이 없을 때의 셸 안내 줄을 뺀다(뺀 줄도 돌려줌)."""
    text = _stream(_cell_of(nb, sid, "step-code"))
    if sid in ALT_STEPS:
        return _without_wget_noise(text)
    return text, []


def _seconds(cell):
    meta = cell.metadata.get("execution") or {}
    start, end = meta.get("iopub.execute_input"), meta.get("shell.execute_reply")
    if not (start and end):
        return None
    return (dt.datetime.fromisoformat(end) - dt.datetime.fromisoformat(start)).total_seconds()


def _timing(nb):
    by_step = {}
    for cell in nb.cells[1:]:
        if cell.cell_type == "code" and _seconds(cell) is not None:
            key = _tags(cell)[0] + ("-alt-local" if "alt-local" in _tags(cell) else "")
            by_step[key] = round(_seconds(cell), 3)
    code = [c for c in nb.cells[1:] if c.cell_type == "code"]
    first = (code[0].metadata.get("execution") or {}).get("iopub.execute_input")
    last = (code[-1].metadata.get("execution") or {}).get("shell.execute_reply")
    span = (dt.datetime.fromisoformat(last) - dt.datetime.fromisoformat(first)).total_seconds() if first and last else None
    return {"cells_span": round(span, 3) if span is not None else None, "by_cell": by_step}


# ---- 생성본과 정본 --------------------------------------------------------------

def test_build_check_says_up_to_date():
    proc = subprocess.run([sys.executable, os.path.join(NB_DIR, "build_notebook.py"), "--check"],
                          capture_output=True, text=True, env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"))
    assert proc.returncode == 0, proc.stdout + proc.stderr
    for path, text in B.outputs().items():
        with open(path, encoding="utf-8") as fh:
            assert fh.read() == text, f"{os.path.basename(path)} 가 최신이 아닙니다"


def test_step_order_and_ids_match_canon():
    nb = _read(B.NOTEBOOK_FILE)
    assert _tags(nb.cells[0]) == ["intro"] and nb.cells[0].cell_type == "markdown"
    assert [_tags(c)[0] for c in _cells(nb, "guide")] == STEP_IDS
    assert [_tags(c)[0] for c in _cells(nb, "step-code")] == CODE_STEPS
    assert [_tags(c)[0] for c in _cells(nb, "alt-local")] == ALT_STEPS
    order = {sid: i for i, sid in enumerate(STEP_IDS)}
    seen = [order[_tags(c)[0]] for c in nb.cells[1:]]
    assert seen == sorted(seen), "단계 셀이 정본 순서와 다르게 섞여 있습니다"
    for cell in nb.cells[1:]:
        assert len(_tags(cell)) == 2 and _tags(cell)[1] in {"guide", "step-code", "alt-local-guide", "alt-local"}, _tags(cell)
    for sid in ALT_STEPS:  # 대체 셀은 그 단계 정본 셀 바로 아래(안내 마크다운 하나를 사이에 둠)
        i = nb.cells.index(_cell_of(nb, sid, "step-code"))
        assert [_tags(c) for c in nb.cells[i + 1:i + 3]] == [[sid, "alt-local-guide"], [sid, "alt-local"]]
    last = nb.cells[-1]
    assert last.cell_type == "markdown" and _tags(last) == [STEP_IDS[-1], "guide"]


def test_code_cells_are_canon_code():
    nb = _read(B.NOTEBOOK_FILE)
    for cell in _cells(nb, "step-code"):
        assert cell.source == BY_ID[_tags(cell)[0]]["code"], _tags(cell)
    for cell in _cells(nb, "alt-local"):
        assert cell.source == BY_ID[_tags(cell)[0]]["code_alt_local"], _tags(cell)
    code_cells = [c for c in nb.cells if c.cell_type == "code"]
    assert len(code_cells) == len(CODE_STEPS) + len(ALT_STEPS)


def test_no_grading_cells():
    nb = _read(B.NOTEBOOK_FILE)
    code = "\n".join(c.source for c in nb.cells if c.cell_type == "code")
    for word in ("z2h_check", "check(", "finish(", "result_code"):
        assert word not in code, word


def test_guides_use_canon_text():
    nb = _read(B.NOTEBOOK_FILE)
    for cell in _cells(nb, "guide"):
        st = BY_ID[_tags(cell)[0]]
        for key in ("title_ko", "input_ko", "expected_ko", "aha_ko", "meaning_ko"):
            if st.get(key):
                assert st[key] in cell.source, (st["step_id"], key)
        for note in st.get("code_line_notes_ko") or []:
            assert note in cell.source, (st["step_id"], note)
    for cell in _cells(nb, "alt-local-guide"):
        st = BY_ID[_tags(cell)[0]]
        assert "Colab이 아닌 곳에서는 이 셀을 대신 실행" in cell.source
        for note in st["code_alt_local_line_notes_ko"]:
            assert note in cell.source


def test_intro_and_ending():
    nb = _read(B.NOTEBOOK_FILE)
    intro = nb.cells[0].source
    assert intro.startswith(f"# {CANON['lecture']['title_ko']}\n")
    assert B.SOURCE_LINE in intro and "makemore" in intro and "MIT" in intro and "https://github.com/karpathy/makemore" in intro
    assert B.UNOFFICIAL_LINE in intro
    ending = nb.cells[-1].source
    assert BY_ID[STEP_IDS[-1]]["summary_ko"] in ending
    assert B.SHARE_LINE in ending


def test_saved_without_outputs():
    nb = _read(B.NOTEBOOK_FILE)
    for cell in nb.cells:
        if cell.cell_type == "code":
            assert cell.outputs == [] and cell.execution_count is None, _tags(cell)


def test_no_em_dash():
    paths = [os.path.abspath(__file__)]
    for name in sorted(os.listdir(NB_DIR)):
        if name.endswith((".ipynb", ".py", ".md", ".json")):
            paths.append(os.path.join(NB_DIR, name))
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            assert EM_DASH not in fh.read(), os.path.relpath(path, ROOT)


def test_no_data_files_in_notebook_folder():
    for _dirpath, _dirs, files in os.walk(NB_DIR):
        for name in files:
            assert not name.startswith("names.txt"), "names.txt 는 저장소에 넣지 않습니다(실행 때 내려받음)"


def test_teacher_outputs_match_canon_examples():
    """앱의 '미리 계산한 결과 보기'가 쓰는 교사 출력 파일과 정본 출력 예가 같은 값이다."""
    with open(TEACHER_OUTPUTS_FILE, encoding="utf-8") as fh:
        teacher = json.load(fh)
    for sid in OUTPUT_STEPS:
        assert teacher[sid] == BY_ID[sid]["expected_output_example"], sid


# ---- 실제 실행 -----------------------------------------------------------------

def test_notebook_runs_without_errors(runs):
    nb = _ok_run(runs["as-is"])
    for cell in nb.cells:
        assert not _errors(cell), (_tags(cell), _errors(cell))
    for cell in nb.cells[1:]:
        if cell.cell_type == "code":
            assert _stream(cell, "stderr") == "", (_tags(cell), _stream(cell, "stderr"))
    print(f"\n[맛보기] 배포본 그대로 실행: 오류 0, nbconvert 전체 {runs['as-is']['seconds']:.2f}초, "
          f"셀 실행 {_timing(nb)['cells_span']}초, torch {_probe_value(nb, 'torch')}")


def test_outputs_match_canon_by_step(runs):
    nb = _ok_run(runs["as-is"])
    report, bad = [], []
    for sid in OUTPUT_STEPS:
        actual, dropped = _step_output(nb, sid)
        kind, why = compare(actual, BY_ID[sid]["expected_output_example"])
        report.append(f"{sid} {kind}" + (f" ({why})" if why else "") + (f" [셸 안내 줄 뺌: {dropped}]" if dropped else ""))
        if kind == "diff":
            bad.append(f"{sid}: {why}")
    for sid in ALT_STEPS:
        kind, why = compare(_stream(_cell_of(nb, sid, "alt-local")), BY_ID[sid]["expected_output_example"])
        report.append(f"{sid} 대체 셀 {kind}" + (f" ({why})" if why else ""))
        if kind == "diff":
            bad.append(f"{sid} 대체 셀: {why}")
    print("\n[맛보기] 단계별 출력 대 정본 출력 예: " + " / ".join(report))
    assert not bad, "정본 출력 예와 다른 단계: " + "; ".join(bad)


def test_loss_range(runs):
    nb = _ok_run(runs["as-is"])
    losses = _losses(_stream(_cell_of(nb, LOSS_STEP, "step-code")))
    first, last = losses[0][1], losses[-1][1]
    print(f"\n[맛보기] {LOSS_STEP} 손실: 처음 {first} (step {losses[0][0]}), 끝 {last} (step {losses[-1][0]}), {len(losses)}줄")
    assert LOSS_FIRST_RANGE[0] <= first <= LOSS_FIRST_RANGE[1], first
    assert last <= LOSS_LAST_MAX, last
    assert all(b <= a for (_, a), (_, b) in zip(losses, losses[1:])), "손실이 중간에 커졌습니다"


def test_local_without_wget_uses_alt_cell(runs):
    """wget 이 없는 로컬 Jupyter: T-S03 정본 셀만 FileNotFoundError, 대체 셀로 받은 뒤 나머지는 정본과 같다."""
    nb = _ok_run(runs["no-wget"])
    errors = [(_tags(c), e.ename) for c in nb.cells for e in _errors(c)]
    assert errors == [([sid, "step-code"], "FileNotFoundError") for sid in ALT_STEPS], errors
    later = []
    for sid in OUTPUT_STEPS:
        text = _stream(_cell_of(nb, sid, "alt-local" if sid in ALT_STEPS else "step-code"))
        kind, why = compare(text, BY_ID[sid]["expected_output_example"])
        later.append((sid, kind, why))
    print(f"\n[맛보기] wget 없는 로컬: {runs['no-wget']['seconds']:.2f}초, 오류 {errors}, "
          + " / ".join(f"{sid} {kind}" for sid, kind, _ in later))
    assert all(kind != "diff" for _, kind, _ in later), later


def _record(runs):
    nb = _ok_run(runs["as-is"])
    local = _ok_run(runs["no-wget"])
    outputs, match, dropped_all = {}, {}, {}
    for sid in OUTPUT_STEPS:
        text, dropped = _step_output(nb, sid)
        outputs[sid] = text
        match[sid] = compare(text, BY_ID[sid]["expected_output_example"])[0]
        if dropped:
            dropped_all[sid] = dropped
    with open(TEACHER_OUTPUTS_FILE, encoding="utf-8") as fh:
        teacher = json.load(fh)
    losses = _losses(outputs[LOSS_STEP])
    import nbconvert
    import ipykernel
    data = {
        "about_ko": ("맛보기 노트북(notebooks/taster/taster.ipynb)을 맥 저장소 .venv 에서 nbconvert 로 실제 실행해 나온 값입니다. "
                     "손으로 쓰지 않습니다. 다시 쓰는 명령: "
                     "Z2H_TASTER_RECORD=1 .venv/bin/python -m pytest tests/test_notebooks_taster.py -q -s"),
        "recorded_kst": dt.datetime.now(KST).replace(microsecond=0).isoformat(),
        "how_ko": ("names.txt 를 pytest 임시 폴더에 미리 받아 두고 그 폴더에서 배포본(실행 출력 없는 사본, 맨 앞에 커널 확인 셀 1개)을 "
                   "그대로 실행. names.txt 는 실행 뒤 지움"),
        "environment": {
            "kernel_python": _probe_value(nb, "python"),
            "torch": _probe_value(nb, "torch"),
            "nbconvert": nbconvert.__version__,
            "ipykernel": ipykernel.__version__,
            "platform": platform.platform(),
            "wget_on_path": shutil.which("wget") is not None,
        },
        "seconds": {"nbconvert_total": round(runs["as-is"]["seconds"], 2), **_timing(nb)},
        "outputs": outputs,
        "alt_local_outputs": {sid: _stream(_cell_of(nb, sid, "alt-local")) for sid in ALT_STEPS},
        "shell_lines_dropped": dropped_all,
        "match_canon_expected_output_example": match,
        "match_teacher_outputs_json": {sid: compare(outputs[sid], teacher[sid])[0] for sid in OUTPUT_STEPS},
        "loss": {"first": losses[0][1], "last": losses[-1][1], "first_step": losses[0][0], "last_step": losses[-1][0]},
        "local_without_wget": {
            "nbconvert_total": round(runs["no-wget"]["seconds"], 2),
            "errors": [{"step": _tags(c)[0], "cell": _tags(c)[1], "ename": e.ename} for c in local.cells for e in _errors(c)],
            "alt_local_outputs": {sid: _stream(_cell_of(local, sid, "alt-local")) for sid in ALT_STEPS},
        },
    }
    with open(MAC_RUN_FILE, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(f"\n[맛보기] 맥 실행 기록을 썼습니다: {os.path.relpath(MAC_RUN_FILE, ROOT)}")


def test_mac_run_record_matches_this_run(runs):
    """mac_run.json 이 실제 실행에서 나온 값과 같다(지어낸 값 금지). Z2H_TASTER_RECORD=1 이면 이번 실행으로 다시 쓴다."""
    if os.environ.get("Z2H_TASTER_RECORD") == "1":
        _record(runs)
    assert os.path.exists(MAC_RUN_FILE), ("mac_run.json 이 없습니다. "
                                          "Z2H_TASTER_RECORD=1 .venv/bin/python -m pytest tests/test_notebooks_taster.py -q 로 만드세요")
    with open(MAC_RUN_FILE, encoding="utf-8") as fh:
        saved = json.load(fh)
    nb = _ok_run(runs["as-is"])
    assert list(saved["outputs"]) == OUTPUT_STEPS
    for sid in OUTPUT_STEPS:
        kind, why = compare(_step_output(nb, sid)[0], saved["outputs"][sid])
        assert kind != "diff", f"mac_run.json 의 {sid} 가 이번 실행과 다릅니다({why}). 다시 기록하세요"
        assert saved["match_canon_expected_output_example"][sid] in ("exact", "close")
    assert saved["environment"]["torch"] and saved["seconds"]["nbconvert_total"] > 0
    first, last = saved["loss"]["first"], saved["loss"]["last"]
    assert LOSS_FIRST_RANGE[0] <= first <= LOSS_FIRST_RANGE[1] and last <= LOSS_LAST_MAX
