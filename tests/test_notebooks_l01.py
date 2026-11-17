"""1편 노트북(notebooks/ep01-micrograd/) 검사: 생성본이 최신인지, 정본과 같은 순서인지, 실제로 끝까지 도는지.

실행 검사는 저장소 .venv 의 진짜 Jupyter 커널로 돌린다(모두 동시에, 임시 폴더에서).
- 정답 노트북: `python -m nbconvert --to notebook --execute`, 시드 여러 개(SEEDS). 시드는 시험용 사본 첫 셀에만 넣는다.
- 학생 노트북 빈칸 그대로: nbconvert `--allow-errors`. 채점 셀(check, finish)에는 예외가 없고 "✕ 다시"/"○ 아직"만.
- 학생 노트북 정답 넣기: 학생처럼(l01_learner_run.py) 빈 셀을 채우고, 정본 edits 대로 앞 셀을 그 자리에서 고치고,
  rerun_first 셀을 다시 실행한다. 모든 채점 셀이 통과(그림 단계는 "✓ 실행됨", 나머지는 "✓ 맞음").
"""
import concurrent.futures as cf
import json
import os
import re
import subprocess
import sys
import time

import pytest

nbformat = pytest.importorskip("nbformat")
pytest.importorskip("nbconvert")

from z2h_check import decode_result_code, graders  # noqa: E402
from l01_helpers import B, CANON, NB_DIR, learner_actions, tags  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SEEDS = (0, 1, 2)
CLOSED_URL = "http://127.0.0.1:9/api/grade"  # 아무도 듣지 않는 주소(실제 진도 서버에 보내지 않음)
EM_DASH = chr(0x2014)
STEPS = B.ordered_steps(CANON)
STEP_IDS = [st["step_id"] for st in STEPS]
CODE_STEP_IDS = [st["step_id"] for st in STEPS if st["kind"] == "code"]
REBUILD_IDS = [t["rebuild_id"] for t in CANON["rebuild_tasks"]]
ALL_IDS = CODE_STEP_IDS + REBUILD_IDS
# 통과했을 때의 화면 앞머리: 그림 단계(정본 manual)는 "✓ 실행됨", 나머지는 "✓ 맞음"
PASS_MARK = {cid: "✓ 맞음: " for cid in ALL_IDS}
PASS_MARK.update({st["step_id"]: "✓ 실행됨: " for st in STEPS if st["kind"] == "code" and st["expected_check"]["type"] == "manual"})


def _read(path):
    return nbformat.read(path, as_version=4)


def _cells(nb, kind, owner=None):
    return [c for c in nb.cells if kind in tags(c) and (owner is None or tags(c)[0] == owner)]


def _stream(cell):
    return "".join(o.get("text", "") for o in cell.get("outputs", []) if o.output_type == "stream")


def _errors(cell):
    return [o for o in cell.get("outputs", []) if o.output_type == "error"]


# ---- 실행 (모듈에서 한 번, 동시에) -------------------------------------------------

def _probe_cell(seed):
    lines = ["import sys", "print('@@prefix', sys.prefix)"]
    if seed is not None:
        lines = ["import random", f"random.seed({seed})"] + lines
    return nbformat.v4.new_code_cell("\n".join(lines), id="test-probe", metadata={"tags": ["test-probe"]})


def _env(workdir, name):
    env = dict(os.environ)
    for key, sub in (("JUPYTER_RUNTIME_DIR", "runtime"), ("MPLCONFIGDIR", "mpl"), ("JUPYTER_CONFIG_DIR", "config"),
                     ("JUPYTER_DATA_DIR", "data"), ("IPYTHONDIR", f"ipython-{name}")):
        env[key] = os.path.join(workdir, "env", sub)
        os.makedirs(env[key], exist_ok=True)
    env.update(JUPYTER_PLATFORM_DIRS="1", Z2H_SERVER_URL=CLOSED_URL, PYTHONDONTWRITEBYTECODE="1")
    env.pop("Z2H_NO_SEND", None)
    return env


def _with_probe(nb, seed):
    nb = nbformat.from_dict(json.loads(nbformat.writes(nb)))
    nb.cells.insert(0, _probe_cell(seed))
    return nb


def _nbconvert(nb, workdir, name, seed=None, allow_errors=False):
    src = os.path.join(workdir, f"{name}.in.ipynb")
    nbformat.write(_with_probe(nb, seed), src)
    cmd = [sys.executable, "-m", "nbconvert", "--to", "notebook", "--execute", src,
           "--output-dir", workdir, "--output", f"{name}.out",
           "--ExecutePreprocessor.kernel_name=python3", "--ExecutePreprocessor.timeout=600"]
    if allow_errors:
        cmd.append("--allow-errors")
    return _timed(cmd, workdir, name, os.path.join(workdir, f"{name}.out.ipynb"))


def _learner(nb, workdir, name):
    nb = _with_probe(nb, None)
    acts = [["run", 0]] + [list(a) for a in learner_actions([dict(c) for c in nb.cells])]
    src, act_file = os.path.join(workdir, f"{name}.in.ipynb"), os.path.join(workdir, f"{name}.actions.json")
    nbformat.write(nb, src)
    with open(act_file, "w", encoding="utf-8") as fh:
        json.dump(acts, fh, ensure_ascii=False)
    out = os.path.join(workdir, f"{name}.out.ipynb")
    cmd = [sys.executable, os.path.join(HERE, "l01_learner_run.py"), src, act_file, out, workdir]
    run = _timed(cmd, workdir, name, out)
    run["actions"] = acts
    return run


def _timed(cmd, workdir, name, out):
    started = time.perf_counter()
    proc = subprocess.run(cmd, env=_env(workdir, name), cwd=workdir, capture_output=True, text=True, timeout=900)
    seconds = time.perf_counter() - started
    executed = _read(out) if os.path.exists(out) else None
    return {"nb": executed, "returncode": proc.returncode, "stderr": proc.stderr[-4000:], "seconds": seconds}


@pytest.fixture(scope="module")
def runs(tmp_path_factory):
    pytest.importorskip("ipykernel")
    pytest.importorskip("nbclient")
    pytest.importorskip("torch")  # 정본 S02 환경 확인 셀과 S40 이 import torch 를 한다
    workdir = str(tmp_path_factory.mktemp("nbrun"))
    solution, student = _read(B.SOLUTION_FILE), _read(B.STUDENT_FILE)
    jobs = {("solution", s): (_nbconvert, (solution, workdir, f"solution-{s}", s, False)) for s in SEEDS}
    jobs[("student-empty", None)] = (_nbconvert, (student, workdir, "student-empty", None, True))
    jobs[("student-learner", None)] = (_learner, (student, workdir, "student-learner"))
    with cf.ThreadPoolExecutor(max_workers=max(1, min(5, os.cpu_count() or 1))) as pool:
        futures = {key: pool.submit(fn, *args) for key, (fn, args) in jobs.items()}
        results = {key: fut.result() for key, fut in futures.items()}
    times = {f"{k[0]}{'' if k[1] is None else '-' + str(k[1])}": round(v["seconds"], 1) for k, v in results.items()}
    print("\n노트북 실행 시간(초):", json.dumps(times, ensure_ascii=False))
    return results


def _ok_run(run):
    assert run["returncode"] == 0, "실행 실패:\n" + run["stderr"]
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
    assert [tags(c)[0] for c in _cells(nb, "guide")] == STEP_IDS
    for c, st in zip(_cells(nb, "guide"), STEPS):
        assert c.source.startswith(f"## {st['step_id']} {st['title_ko']}\n")
    assert [tags(c)[0] for c in _cells(nb, "check")] == ALL_IDS
    assert [cid for cid, _ in graders.lecture_checks("L01")] == ALL_IDS
    order = {sid: i for i, sid in enumerate(STEP_IDS + ["rebuild"] + REBUILD_IDS)}
    seen = [order[tags(c)[0]] for c in nb.cells if tags(c) and tags(c)[0] in order]
    assert seen == sorted(seen), "단계 셀이 정본 순서와 다르게 섞여 있습니다"
    assert len(_cells(nb, "finish")) == 1 and nb.cells[-1] is _cells(nb, "finish")[0]
    for cell in _cells(nb, "check"):
        assert cell.source == f'check("{tags(cell)[0]}", globals())'


@pytest.mark.parametrize("path", ["SOLUTION_FILE", "STUDENT_FILE"])
def test_setup_cells_device_then_bundle(path):
    """설계서 3-0: 편 맨 앞 준비 코드에 기기 고르기(cuda, mps, cpu) 셀. 정본 S02 준비 코드 그대로."""
    nb = _read(getattr(B, path))
    code = [c for c in nb.cells if c.cell_type == "code"]
    device = next(st for st in STEPS if st["step_id"] == B.DEVICE_STEP)
    assert code[0].source == device["prepared_code"] and "device" in tags(code[0])
    assert "cuda" in code[0].source and "mps" in code[0].source and "cpu" in code[0].source
    assert "z2h-bundle" in tags(code[1])
    assert code[1].source == B.bundle_source(), "준비 셀 안 z2h_check 묶음이 z2h_check/_bundle.py 와 다릅니다"
    for st in STEPS:
        if st.get("prepared_code") and st["step_id"] != B.DEVICE_STEP:
            (cell,) = _cells(nb, "prepared-code", st["step_id"])
            assert cell.source == st["prepared_code"]
    learner_code = [c.source for c in code if "z2h-bundle" not in tags(c)]
    assert not any("pip install" in src for src in learner_code)  # 설치 줄은 코드 셀에 두지 않는다
    hints = [h["text_ko"] for h in CANON["hints"] if "pip install" in h["text_ko"]]
    for cell in nb.cells:
        if cell.cell_type == "markdown" and "pip install" in cell.source:  # 정본 힌트 글 그대로, 'Colab만' 표시와 함께
            assert any(h in cell.source and "Colab만" in h for h in hints), tags(cell)


@pytest.mark.parametrize("path", ["SOLUTION_FILE", "STUDENT_FILE"])
def test_saved_clean(path):
    nb = _read(getattr(B, path))
    for cell in nb.cells:
        if cell.cell_type == "code":
            assert cell.outputs == [] and cell.execution_count is None, tags(cell)
    with open(getattr(B, path), encoding="utf-8") as fh:
        raw = fh.read()
    assert os.path.expanduser("~") not in raw and "/Users/" not in raw
    assert EM_DASH not in raw


def test_no_em_dash_in_notebook_folder():
    for name in sorted(os.listdir(NB_DIR)):
        path = os.path.join(NB_DIR, name)
        if os.path.isfile(path) and name.endswith((".ipynb", ".py", ".md")):
            with open(path, encoding="utf-8") as fh:
                assert EM_DASH not in fh.read(), name


def test_video_links_are_nocookie_embeds_with_start():
    nb = _read(B.STUDENT_FILE)
    vid = CANON["lecture"]["youtube_video_id"]
    for cell, st in zip(_cells(nb, "guide"), STEPS):
        links = re.findall(r"\((https://[^)]+)\)", cell.source)
        embeds = [u for u in links if "youtube" in u]
        assert len(embeds) == len(st["video_segments"]) >= 1, st["step_id"]
        for url, seg in zip(embeds, st["video_segments"]):
            assert url.startswith(f"https://www.youtube-nocookie.com/embed/{vid}?start={seg['start_s']}&"), url
            assert "autoplay" not in url and "cc_lang_pref=ko" in url


def test_solution_cells_are_canon_code():
    nb = _read(B.SOLUTION_FILE)
    plans = {p["step"]["step_id"]: p for p in B.plan_steps(CANON)}
    for cell in _cells(nb, "step-code"):
        assert cell.source == "\n".join(plans[tags(cell)[0]]["own"])
    for cell in _cells(nb, "rerun"):
        sid = tags(cell)[0]
        rid = next(t for t in tags(cell) if t.startswith("of-"))[3:]
        first, *body = cell.source.split("\n")
        assert first.startswith("# ") and body == dict(plans[sid]["reruns"])[rid]
        assert ("edited" in tags(cell)) is (rid in plans[sid]["edited"])
    for sid, plan in plans.items():  # 다시 실행할 셀은 정본 rerun_first 순서 그대로
        got = [next(t for t in tags(c) if t.startswith("of-"))[3:] for c in _cells(nb, "rerun", sid)]
        assert got == plan["step"]["rerun_first"], sid


def test_edits_follow_canon_anchor_rules():
    """정본 code_conventions: insert 는 anchor_line 바로 아래(null 이면 셀 맨 아래), replace 는 그 줄 자체를 바꾼다."""
    for plan in B.plan_steps(CANON):
        st = plan["step"]
        lines = st["code"].split("\n") if st["code"] else []
        pos = 0
        for edit in st["edits"]:
            chunk = lines[pos:pos + edit["line_count"]]
            pos += edit["line_count"]
            after = plan["edited"][edit["target_step"]]
            for line in chunk:
                assert line in after, (st["step_id"], line)
            if edit["action"] == "replace":
                assert edit["anchor_line"] not in after, (st["step_id"], edit["anchor_line"])
            assert edit["target_step"] in st["rerun_first"]


def test_student_has_no_answer_code():
    nb = _read(B.STUDENT_FILE)
    for cell in _cells(nb, "step-code") + _cells(nb, "rebuild-code"):
        assert cell.source.startswith(B.PLACEHOLDER) and "\n" not in cell.source, tags(cell)
    assert not _cells(nb, "rerun")
    prose = "\n".join(str(st.get(k) or "") for st in CANON["steps"] for k in ("input_ko", "expected_ko", "title_ko"))
    prose += "\n" + "\n".join(f"{e['where_ko']}\n{e.get('anchor_line') or ''}" for st in CANON["steps"] for e in st["edits"])
    prose += "\n" + "\n".join(f"{t['title_ko']}\n{t['task_ko']}\n{t['pass_ko']}\n{t['check_code']}" for t in CANON["rebuild_tasks"])
    prose += "\n" + "\n".join(st["prepared_code"] for st in CANON["steps"] if st.get("prepared_code"))
    text = "\n".join(c.source for c in nb.cells if "z2h-bundle" not in tags(c))
    leaked = []
    answers = [(st["step_id"], st["code"]) for st in CANON["steps"]]
    answers += [(t["rebuild_id"], t["solution_code"]) for t in CANON["rebuild_tasks"]]
    for owner, code in answers:
        for line in code.split("\n"):
            line = line.strip()
            if len(line) >= 12 and line in text and line not in prose:
                leaked.append((owner, line))
    assert not leaked, f"학생 노트북에 정답 줄이 있습니다: {leaked[:5]}"


@pytest.mark.parametrize("path", ["SOLUTION_FILE", "STUDENT_FILE"])
def test_rebuild_section_follows_canon(path):
    nb = _read(getattr(B, path))
    (start,) = _cells(nb, "rebuild-start")
    last_step = max(i for i, c in enumerate(nb.cells) if tags(c) and tags(c)[0] in STEP_IDS)
    assert last_step < nb.cells.index(start) < nb.cells.index(_cells(nb, "rebuild-guide")[0])
    for task in CANON["rebuild_tasks"]:
        rid = task["rebuild_id"]
        (guide,) = _cells(nb, "rebuild-guide", rid)
        for text in (task["title_ko"], task["task_ko"], task["pass_ko"]):
            assert text in guide.source, (rid, text[:30])
        (check_code,) = _cells(nb, "rebuild-check-code", rid)
        assert check_code.source == task["check_code"]
        (chk,) = _cells(nb, "check", rid)
        assert nb.cells.index(guide) < nb.cells.index(check_code) < nb.cells.index(chk)
        assert len(_cells(nb, "rebuild-resume", rid)) == (B.REBUILD_FLOW[rid] == "lecture")
    student = path == "STUDENT_FILE"
    works = [tags(c)[0] for c in _cells(nb, "rebuild-code")]
    flows = {rid: B.REBUILD_FLOW[rid] for rid in REBUILD_IDS}
    expected = [rid for rid in REBUILD_IDS if not (student and flows[rid] == "continue")]
    assert works == expected


def test_rebuild_flow_matches_canon_task_text():
    """REBUILD_FLOW 는 정본 task_ko 를 따른다: 빈 노트북 / R1 셀에 덧붙이기 / 이 편의 노트북 상태에서."""
    words = {"blank": "빈 노트북", "continue": "R1에서 만든 Value 셀 맨 아래", "lecture": "이 편의 노트북에서"}
    for task in CANON["rebuild_tasks"]:
        assert words[B.REBUILD_FLOW[task["rebuild_id"]]] in task["task_ko"], task["rebuild_id"]


def test_solution_rebuild_cells_are_canon_solution_code():
    nb = _read(B.SOLUTION_FILE)
    by_id = {t["rebuild_id"]: t for t in CANON["rebuild_tasks"]}
    for cell in _cells(nb, "rebuild-code"):
        rid = tags(cell)[0]
        assert cell.source == B.rebuild_work_source(CANON, rid)
        assert by_id[rid]["solution_code"] in cell.source


# ---- 실제 실행 -----------------------------------------------------------------

def _all_checks_pass(nb):
    for cell in nb.cells:
        assert not _errors(cell), (tags(cell), _errors(cell))
    for cell in _cells(nb, "check"):
        sid = tags(cell)[0]
        text = _stream(cell).strip()
        assert text.startswith(PASS_MARK[sid]) and text.endswith(f"[{sid}]") and "\n" not in text, (sid, text)
    code = _result_code(nb)
    assert code["l"] == "L01" and code["f"] == [] and code["p"] == ALL_IDS


@pytest.mark.parametrize("seed", SEEDS)
def test_solution_notebook_runs_and_passes(runs, seed):
    _all_checks_pass(_ok_run(runs[("solution", seed)]))


def test_student_notebook_blank_never_raises(runs):
    nb = _ok_run(runs[("student-empty", None)])
    for cell in _cells(nb, "check") + _cells(nb, "finish") + _cells(nb, "rebuild-start") + _cells(nb, "rebuild-resume"):
        assert not _errors(cell), (tags(cell), _errors(cell))
    for cell in _cells(nb, "check"):
        text = _stream(cell).strip()
        assert text.startswith(("✕ 다시", "○ 아직")) and "\n" not in text, (tags(cell), text)
    code = _result_code(nb)
    assert code["p"] == [] and not set(REBUILD_IDS) & set(code["f"])


def test_student_notebook_with_answers_like_a_learner(runs):
    run = runs[("student-learner", None)]
    nb = _ok_run(run)
    _all_checks_pass(nb)
    ran, in_place = set(), 0
    for act in run["actions"]:
        if act[0] == "run":
            ran.add(act[1])
        elif act[1] in ran:
            in_place += 1  # 이미 실행한 앞 셀을 그 자리에서 고침
    assert in_place == sum(len(p["edited"]) for p in B.plan_steps(CANON)) + 1  # + R2 가 R1 셀에 덧붙임


def test_result_code_matches_finish_table(runs):
    nb = _ok_run(runs[("solution", SEEDS[0])])
    (cell,) = _cells(nb, "finish")
    lines = _stream(cell).strip().splitlines()
    ticked = [line.split()[1] for line in lines if line.startswith("  ✓ ")]
    assert decode_result_code(lines[-1].strip())["p"] == ticked == ALL_IDS
