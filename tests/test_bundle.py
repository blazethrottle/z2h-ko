"""파일 하나로 묶은 z2h_check(노트북 준비 셀용)가 패키지와 똑같이 동작하는지."""
import os
import subprocess
import sys

import pytest

from z2h_check import bundle

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUNDLE_FILE = os.path.join(ROOT, "z2h_check", "_bundle.py")
REF_DIR = os.path.join(ROOT, "tests", "reference_impl")
FIXED_AT = "2026-11-16T23:00:00+09:00"

RUNNER = r'''
import importlib.util, json, os, sys
mode, bundle_file, repo_root, ref_dir = sys.argv[1:5]
os.environ["Z2H_NO_SEND"] = "1"
if mode == "bundle":
    assert importlib.util.find_spec("z2h_check") is None, "묶음 없이도 z2h_check가 보이면 시험이 무의미"
    with open(bundle_file, encoding="utf-8") as fh:
        src = fh.read()
    ns = {"__name__": "__main__"}
    exec(compile(src, "<노트북 준비 셀>", "exec"), ns)
    exec(compile(src, "<노트북 준비 셀 다시 실행>", "exec"), ns)   # 준비 셀을 두 번 눌러도 된다
    assert callable(ns["check"]) and callable(ns["finish"])
    import z2h_check
    assert getattr(z2h_check, "__z2h_bundled__", False) is True
    assert ns["check"] is z2h_check.check
    print("@@ready")
else:
    sys.path.insert(0, repo_root)
    import z2h_check
    assert not getattr(z2h_check, "__z2h_bundled__", False)
    print("@@ready")
sys.path.insert(0, ref_dir)
import torch
import scenarios, variants
from z2h_check import check, finish, results
# eq_accumulate(= 버그)는 결과가 set 순회 순서(실행마다 다름)에 따라 달라져 비교에 쓰지 않는다.
for name in (None, "no_grad_one", "tanh_grad_wrong", "params_missing_bias"):
    z2h_check.reset()
    got = scenarios.run(variants.load(name), check, torch=torch, seed=3)
    print("@@got", name, json.dumps(got, sort_keys=True))
    print("@@code", finish("L01", send=False, at="%s"))
    print("@@results", json.dumps({k: (v["status"], v["message_ko"]) for k, v in results().items()},
                                  ensure_ascii=False, sort_keys=True))
print("@@torch_off")
os.environ["Z2H_NO_TORCH"] = "1"
z2h_check.reset()
scenarios.run(variants.load(None), check, torch=None, seed=3)
print("@@code", finish("L01", send=False, at="%s"))
''' % (FIXED_AT, FIXED_AT)


def _run(mode, tmp_path):
    script = tmp_path / f"runner_{mode}.py"
    script.write_text(RUNNER, encoding="utf-8")
    proc = subprocess.run([sys.executable, "-I", str(script), mode, BUNDLE_FILE, ROOT, REF_DIR],
                          cwd=str(tmp_path), capture_output=True, text=True, timeout=600)
    assert proc.returncode == 0, proc.stderr[-3000:]
    out = proc.stdout
    return out[out.index("@@ready"):]


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
                 "z2h_check.graders.l01", "z2h_check.graders._util", "z2h_check._resources"):
        assert repr(name) in src, name
    assert "reference/l01.json" in src
    assert "def build_bundle" not in src  # 묶는 도구 자신은 넣지 않는다
    assert chr(0x2014) not in src


def test_bundle_behaves_like_the_package(tmp_path):
    pytest.importorskip("torch")
    from_bundle = _run("bundle", tmp_path)
    from_package = _run("package", tmp_path)
    assert from_bundle == from_package
    assert from_bundle.count("@@code Z2H1.") == 5  # 변형 4개 + torch 없는 경우 1개
    assert "✓ 맞음" in from_bundle and "✕ 다시" in from_bundle
