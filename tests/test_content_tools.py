"""정본 생성 도구(tools/content/) 검사.

조각(src_f/, src_l01/)에서 다시 만든 정본이 저장소 정본과 글자까지 같은지, --check 가 종료 코드로 알려 주는지,
형식 검사·실행 대조·자체 확인이 두 정본에서 통과하는지, 옮긴 파일에 공개하면 안 되는 글자가 없는지 본다.
도구는 사용자가 치는 그대로 따로 띄운 파이썬으로 돌린다(정본 폴더에는 아무것도 쓰지 않는다).
"""
import json
import os
import re
import shutil
import socket
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

import pytest

import build_canon

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools", "content")
CONTENT = os.path.join(ROOT, "inputs", "pedagogy", "content")
CANON_FILES = {"F": "F.json", "L01": "L01.json"}
VERIFY_RECORD = os.path.join(TOOLS, "src_f", "_verify_result.json")
TIMEOUT = 600


def canon_path(name):
    return os.path.join(CONTENT, CANON_FILES[name])


def read_bytes(path):
    with open(path, "rb") as fh:
        return fh.read()


def tool(script, *args, env_extra=None, cwd=ROOT):
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", MPLBACKEND="Agg", **(env_extra or {}))
    return subprocess.run([sys.executable, os.path.join(TOOLS, script), *args],
                          capture_output=True, text=True, timeout=TIMEOUT, env=env, cwd=cwd)


# 정본의 코드를 실제로 돌리는 실행(몇 초씩 걸림). 서로 기다리지 않게 한꺼번에 띄운다.
SLOW_RUNS = {
    "run_code F": ("run_code.py", canon_path("F"), "--questions", "--json"),
    "run_code L01": ("run_code.py", canon_path("L01"), "--questions", "--json"),
    "selftest": ("selftest_tools.py",),
    "verify_f": ("verify_f.py",),
    "verify_l01": ("verify_l01.py",),
}


@pytest.fixture(scope="module")
def verify_record_before():
    return read_bytes(VERIFY_RECORD)


@pytest.fixture(scope="module")
def run_dirs(tmp_path_factory):
    """도구마다 빈 폴더에서 띄운다. 학습 코드가 만드는 파일(names.txt 등)이 그 폴더에 남는지 보려고."""
    return {key: tmp_path_factory.mktemp("cwd") for key in SLOW_RUNS}


@pytest.fixture(scope="module")
def slow_runs(verify_record_before, run_dirs, tmp_path_factory):
    env_extra = {"IPYTHONDIR": str(tmp_path_factory.mktemp("ipython"))}
    with ThreadPoolExecutor(max_workers=len(SLOW_RUNS)) as pool:
        futures = {key: pool.submit(tool, *args, env_extra=env_extra, cwd=run_dirs[key]) for key, args in SLOW_RUNS.items()}
        return {key: future.result() for key, future in futures.items()}


def first_difference(made, canon):
    n = next((i for i, (x, y) in enumerate(zip(made, canon)) if x != y), min(len(made), len(canon)))

    def around(data):
        return data[max(0, n - 60):n + 60].decode("utf-8", "replace")
    return "첫 차이 %d번째 바이트(길이 %d / %d)\n만든 것: %s\n정본: %s" % (n, len(made), len(canon), around(made), around(canon))


# ---- 재현: 조각 → 정본 --------------------------------------------------------

@pytest.fixture(scope="module")
def rebuilt_dir(tmp_path_factory):
    out = tmp_path_factory.mktemp("rebuilt")
    proc = tool("build_canon.py", "--out-dir", str(out))
    assert proc.returncode == 0, proc.stdout + proc.stderr
    return out


@pytest.mark.parametrize("name", sorted(CANON_FILES))
def test_rebuilt_canon_is_byte_identical(rebuilt_dir, name):
    made = read_bytes(os.path.join(rebuilt_dir, CANON_FILES[name]))
    canon = read_bytes(canon_path(name))
    assert made == canon, first_difference(made, canon)


def test_check_passes_on_repo_canon_and_writes_nothing():
    before = {n: (read_bytes(canon_path(n)), os.stat(canon_path(n)).st_mtime_ns) for n in CANON_FILES}
    proc = tool("build_canon.py", "--check")
    assert proc.returncode == 0, proc.stdout + proc.stderr
    after = {n: (read_bytes(canon_path(n)), os.stat(canon_path(n)).st_mtime_ns) for n in CANON_FILES}
    assert before == after


def test_check_reports_stale_and_missing_canon_without_writing(tmp_path):
    shutil.copy(canon_path("L01"), tmp_path / "L01.json")
    stale = read_bytes(canon_path("F")).replace("사전 기초".encode("utf-8"), "사전 기쵸".encode("utf-8"), 1)
    (tmp_path / "F.json").write_bytes(stale)
    proc = tool("build_canon.py", "--check", "--out-dir", str(tmp_path))
    assert proc.returncode == 1, proc.stdout + proc.stderr
    assert "F.json" in proc.stdout and "다름" in proc.stdout
    assert (tmp_path / "F.json").read_bytes() == stale
    (tmp_path / "L01.json").unlink()
    proc = tool("build_canon.py", "--check", "--out-dir", str(tmp_path), "L01")
    assert proc.returncode == 1 and "없음" in proc.stdout, proc.stdout + proc.stderr
    assert not (tmp_path / "L01.json").exists()


def test_check_one_canon_by_name(tmp_path):
    shutil.copy(canon_path("L01"), tmp_path / "L01.json")
    proc = tool("build_canon.py", "--check", "--out-dir", str(tmp_path), "L01")
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert tool("build_canon.py", "--check", "NOPE").returncode == 2


def test_postprocess_steps_run_after_serialize_in_order():
    canon = build_canon.CANONS["L01"]
    plain = build_canon.render(canon)
    assert plain.encode("utf-8") == read_bytes(canon_path("L01"))
    seen = []

    def first(name, text):
        seen.append(name)
        return text.replace('"lecture_id": "L01"', '"lecture_id": "L01-A"', 1)

    def second(name, text):
        return text.replace('"L01-A"', '"L01-B"', 1)

    changed = build_canon.render(canon, postprocess=(first, second))
    assert seen == ["L01"]
    assert changed == plain.replace('"lecture_id": "L01"', '"lecture_id": "L01-B"', 1)
    assert build_canon.POSTPROCESS == ()


def test_fragment_imports_do_not_leak_into_the_process():
    path_before = list(sys.path)
    for canon in build_canon.CANONS.values():
        build_canon.render(canon)
    assert sys.path == path_before
    src_dirs = [os.path.join(TOOLS, d) for d in ("src_f", "src_l01")]
    leaked = [name for name, mod in sys.modules.items()
              if any(os.path.abspath(getattr(mod, "__file__", None) or "").startswith(d + os.sep) for d in src_dirs)]
    assert leaked == []


# ---- 검사 도구: 형식 검사, 실행 대조, 자체 확인 -------------------------------------

@pytest.mark.parametrize("name", sorted(CANON_FILES))
def test_check_format_passes_on_canon(name):
    extra = ["--foundation", canon_path("F")] if name == "L01" else []
    proc = tool("check_format.py", canon_path(name), "--json", *extra)
    assert proc.returncode == 0, proc.stdout[-3000:] + proc.stderr
    report = json.loads(proc.stdout)
    assert report["errors"] == 0 and report["passed"] is True
    assert report["kind"] == ("foundation" if name == "F" else "lecture")


@pytest.mark.content_run
@pytest.mark.parametrize("name", sorted(CANON_FILES))
def test_run_code_has_no_mismatch_on_canon(slow_runs, name):
    proc = slow_runs["run_code " + name]
    report = json.loads(proc.stdout)
    bad = [(r["id"], r["status"], r.get("detail")) for r in report["steps"] + report["questions"]
           if r["status"] in ("mismatch", "error")]
    assert bad == [] and proc.returncode == 0, (bad, proc.stderr[-2000:])
    assert report["steps"], "단계를 하나도 실행하지 않음"


@pytest.mark.content_run
def test_selftest_tools_passes(slow_runs):
    proc = slow_runs["selftest"]
    assert proc.returncode == 0, proc.stdout[-4000:] + proc.stderr[-2000:]
    assert "자체 확인 모두 통과" in proc.stdout


@pytest.mark.content_run
def test_verify_f_passes_and_does_not_rewrite_its_record(slow_runs, verify_record_before):
    proc = slow_runs["verify_f"]
    assert proc.returncode == 0, proc.stdout[-4000:] + proc.stderr[-2000:]
    assert read_bytes(VERIFY_RECORD) == verify_record_before


@pytest.mark.content_run
def test_verify_l01_passes(slow_runs):
    proc = slow_runs["verify_l01"]
    assert proc.returncode == 0, proc.stdout[-4000:] + proc.stderr[-2000:]
    assert "실패 0" in proc.stdout


@pytest.mark.content_run
def test_running_content_code_leaves_no_files_where_the_tool_started(slow_runs, run_dirs):
    left = {key: sorted(os.listdir(run_dirs[key])) for key in SLOW_RUNS}
    assert left == {key: [] for key in SLOW_RUNS}


# ---- 공개 저장소 위생과 출처 ---------------------------------------------------

def moved_files():
    for base, dirs, files in os.walk(TOOLS):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for f in files:
            if not f.endswith(".pyc"):
                yield os.path.join(base, f)


def test_moved_files_have_no_private_or_banned_text():
    home = os.path.expanduser("~")
    host = socket.gethostname().split(".")[0]
    email = re.compile(r"[\w.+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}")
    found = []
    for path in moved_files():
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        rel = os.path.relpath(path, ROOT)
        for label, hit in (("긴 줄표", chr(0x2014) in text), ("홈 경로", home in text), ("/private/tmp", "/private/tmp" in text),
                           ("기기 이름", len(host) >= 6 and host.lower() in text.lower()), ("이메일", bool(email.search(text)))):
            if hit:
                found.append((rel, label))
    assert found == []


def test_l01_fragments_with_lecture_code_name_their_source():
    src = os.path.join(TOOLS, "src_l01")
    parts = sorted(f for f in os.listdir(src) if re.match(r"part0[1-9]_.*\.py$", f))
    assert len(parts) == 9
    for name in parts:
        with open(os.path.join(src, name), encoding="utf-8") as fh:
            first = fh.readline()
        assert first.startswith("# 출처:"), name
        assert "karpathy/micrograd" in first and "karpathy/nn-zero-to-hero" in first and "MIT" in first, name
    with open(os.path.join(ROOT, "NOTICE.md"), encoding="utf-8") as fh:
        notice = fh.read()
    assert "tools/content/src_l01/" in notice
