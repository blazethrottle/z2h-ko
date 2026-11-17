"""z2h_check.runs: 셀이 끝날 때마다 '무엇이 보였는지'를 기록하는지 (진짜 IPython 셸에서, 따로 띄운 파이썬으로).

채점 셀(check 를 부른 셀)과 준비 셀은 기록하지 않아, 채점 셀은 늘 바로 위 '내 셀'을 본다.
"""
import json
import os
import subprocess
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RUNNER = r'''
import json, os, sys
sys.path.insert(0, sys.argv[1])
os.environ["Z2H_NO_SEND"] = "1"
from IPython.core.interactiveshell import InteractiveShell
shell = InteractiveShell.instance(colors="nocolor")
out = []
def run(src):
    shell.run_cell(src, store_history=True)
    from z2h_check import runs
    rec = runs.last_cell()
    out.append(None if rec is None else {
        "source": rec["source"], "stdout": rec["stdout"], "shown": rec["shown"],
        "error": type(rec["error"]).__name__ if rec["error"] is not None else None, "blank": rec["blank"]})
run("import z2h_check\nfrom z2h_check import check, finish")
run("print('hello')\nprint(20.0)\n1 + 1")
run("x = 5;")
run("raise ValueError('boom')")
run("# 여기에 작성")
run("print('보인 글')")
run("check('L01-S03', globals())")
run("import importlib, z2h_check._resources\nimport z2h_check.runs as r\nr.watch(); r.watch()")
run("print('x' * 300000)")
from z2h_check import runs
print("@@STDOUT", type(sys.stdout).__name__)
print("@@HOOKS", sum(1 for cb in shell.events.callbacks["post_run_cell"] if hasattr(cb, "z2h_runs_state")),
      sum(1 for cb in shell.events.callbacks["pre_run_cell"] if hasattr(cb, "z2h_runs_state")))
print("@@WATCHING", runs.watching())
print("@@JSON", json.dumps(out, ensure_ascii=False))
'''


@pytest.fixture(scope="module")
def shell_run(tmp_path_factory):
    pytest.importorskip("IPython")
    work = tmp_path_factory.mktemp("runs")
    script = work / "runner_runs.py"
    script.write_text(RUNNER, encoding="utf-8")
    env = dict(os.environ, IPYTHONDIR=str(work / "ipython"), MPLBACKEND="Agg", PYTHONDONTWRITEBYTECODE="1")
    proc = subprocess.run([sys.executable, "-I", str(script), ROOT], cwd=str(work), env=env,
                          capture_output=True, text=True, timeout=300)
    assert proc.returncode == 0, proc.stderr[-3000:]
    lines = {line.split(" ", 1)[0]: line.split(" ", 1)[1] for line in proc.stdout.splitlines() if line.startswith("@@")}
    return lines, json.loads(lines["@@JSON"])


def test_print_and_last_value_are_recorded(shell_run):
    _lines, recs = shell_run
    rec = recs[1]
    # 터미널용 IPython 셸은 마지막 줄 값을 'Out[n]: …' 으로 stdout 에도 찍는다(Jupyter 커널은 따로 보낸다)
    assert rec["stdout"].startswith("hello\n20.0\n")
    assert rec["shown"] == "2" and rec["error"] is None and rec["blank"] is False


def test_semicolon_hides_value_and_errors_are_kept(shell_run):
    _lines, recs = shell_run
    assert recs[2]["shown"] is None and recs[2]["error"] is None
    assert recs[3]["error"] == "ValueError"


def test_comment_only_cell_is_blank(shell_run):
    _lines, recs = shell_run
    assert recs[4]["blank"] is True and recs[4]["source"] == "# 여기에 작성"


def test_tool_cells_do_not_replace_the_last_learner_cell(shell_run):
    _lines, recs = shell_run
    assert recs[0] is None  # z2h_check 를 불러온 셀 자체는 기록하지 않는다
    assert recs[5]["stdout"] == "보인 글\n"
    assert recs[6] == recs[5]  # check(...) 셀 뒤에도 바로 위 '내 셀' 그대로
    assert recs[7] == recs[5]  # watch() 를 다시 부른 셀도 도구 셀


def test_one_hook_and_stdout_restored(shell_run):
    lines, recs = shell_run
    assert lines["@@HOOKS"] == "1 1"
    assert lines["@@STDOUT"] != "_Tee"
    assert lines["@@WATCHING"] == "True"
    big = recs[8]["stdout"]
    assert len(big) < 300000 and big.startswith("x") and big.rstrip().endswith("x")
