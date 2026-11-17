"""파일 하나로 묶은 z2h_check(노트북 준비 셀용)가 패키지와 똑같이 동작하는지.

정답 노트북 셀을 진짜 IPython 셸(따로 띄운 파이썬, -I)에서 차례로 돌려, 묶음으로 불러온 경우와 패키지로 불러온 경우의
채점 줄과 결과코드가 같은지 본다.
"""
import os
import re
import subprocess
import sys

import pytest

from z2h_check import bundle, graders

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUNDLE_FILE = os.path.join(ROOT, "z2h_check", "_bundle.py")
SOLUTION_FILE = os.path.join(ROOT, "notebooks", "ep01-micrograd", "ep01_solution.ipynb")
FIXED_AT = "2026-11-17T23:00:00+09:00"

RUNNER = r'''
import importlib.util, json, os, sys
mode, bundle_file, repo_root, nb_file, fixed_at = sys.argv[1:6]
os.environ["Z2H_NO_SEND"] = "1"
os.environ["MPLBACKEND"] = "Agg"
from IPython.core.interactiveshell import InteractiveShell
shell = InteractiveShell.instance(colors="nocolor")
with open(nb_file, encoding="utf-8") as fh:
    cells = json.load(fh)["cells"]
shell.run_cell("import random\nrandom.seed(3)")
for cell in cells:
    if cell["cell_type"] != "code":
        continue
    tags = cell["metadata"].get("tags", [])
    src = cell["source"] if isinstance(cell["source"], str) else "".join(cell["source"])
    if "z2h-bundle" in tags:
        if mode == "bundle":
            assert importlib.util.find_spec("z2h_check") is None, "묶음 없이도 z2h_check가 보이면 시험이 무의미"
            shell.run_cell(src)
            shell.run_cell(src)  # 준비 셀을 두 번 눌러도 된다
            import z2h_check
            assert getattr(z2h_check, "__z2h_bundled__", False) is True
        else:
            shell.run_cell("import sys\nsys.path.insert(0, %r)\nfrom z2h_check import check, finish" % repo_root)
            import z2h_check
            assert not getattr(z2h_check, "__z2h_bundled__", False)
        assert shell.user_ns["check"] is z2h_check.check
        print("@@ready")
        continue
    if "finish" in tags:
        shell.run_cell("print('@@code', finish('L01', send=False, at=%r))" % fixed_at)
        continue
    shell.run_cell(src)
'''


def _run(mode, tmp_path):
    script = tmp_path / f"runner_{mode}.py"
    script.write_text(RUNNER, encoding="utf-8")
    env = dict(os.environ, IPYTHONDIR=str(tmp_path / f"ipython-{mode}"), PYTHONDONTWRITEBYTECODE="1")
    proc = subprocess.run([sys.executable, "-I", str(script), mode, BUNDLE_FILE, ROOT, SOLUTION_FILE, FIXED_AT],
                          cwd=str(tmp_path), env=env, capture_output=True, text=True, timeout=600)
    assert proc.returncode == 0, proc.stderr[-3000:]
    out = proc.stdout[proc.stdout.index("@@ready"):]
    checks = [re.sub(r"\d", "#", line) for line in out.splitlines() if re.search(r"\[L01-[SR]\d+\]$", line)]
    codes = [line.split(" ", 1)[1] for line in out.splitlines() if line.startswith("@@code ")]
    return checks, codes


def test_bundle_file_is_up_to_date():
    with open(BUNDLE_FILE, encoding="utf-8") as fh:
        assert fh.read() == bundle.build_bundle(), "python -m z2h_check.bundle --write 로 다시 만드세요"


def test_module_command_prints_the_same_source():
    proc = subprocess.run([sys.executable, "-m", "z2h_check.bundle"], cwd=ROOT, capture_output=True,
                          text=True, timeout=120)
    assert proc.returncode == 0, proc.stderr
    assert proc.stdout == bundle.build_bundle()
    proc = subprocess.run([sys.executable, "-m", "z2h_check.bundle", "--check"], cwd=ROOT,
                          capture_output=True, text=True, timeout=120)
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_bundle_contains_every_module_and_reference_data():
    src = bundle.build_bundle()
    compile(src, "<묶음>", "exec")
    for name in ("z2h_check", "z2h_check.core", "z2h_check.result_code", "z2h_check.graders",
                 "z2h_check.graders.l01", "z2h_check.graders._util", "z2h_check._resources",
                 "z2h_check.runs", "z2h_check.rebuild"):
        assert repr(name) in src, name
    assert "reference/l01.json" in src
    assert "def build_bundle" not in src  # 묶는 도구 자신은 넣지 않는다
    assert repr("z2h_check.refgen") + ":" not in src  # 정본에서 기준값을 만드는 도구도 넣지 않는다(저장소에서만 씀)
    assert chr(0x2014) not in src


def test_bundle_behaves_like_the_package(tmp_path):
    pytest.importorskip("IPython")
    pytest.importorskip("torch")
    from_bundle = _run("bundle", tmp_path)
    from_package = _run("package", tmp_path)
    assert from_bundle == from_package
    checks, codes = from_bundle
    assert len(codes) == 1 and codes[0].startswith("Z2H1.")
    assert len(checks) == len(graders.lecture_checks("L01"))
    assert all(line.startswith(("✓ 맞음", "✓ 실행됨")) for line in checks), [c for c in checks if not c.startswith("✓")][:3]
