"""Tailscale 로그인 잇기 명령(맥미니에서 직접 실행. HTTP API 없음).

python -m z2h_server link-tailscale --login <로그인 이름> --user <user_id>
python -m z2h_server unlink-tailscale --login <로그인 이름>
python -m z2h_server list-tailscale
인자 없는 python -m z2h_server 는 지금처럼 서버를 켠다.
출력에 로그인 이름이 나오는 것은 결과 줄뿐이고, 오류 글에는 넣지 않는다.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

from helpers import new_user
from z2h_server import __main__ as entry
from z2h_server.storage.sqlite import SqliteAdapter

SERVER_DIR = Path(__file__).resolve().parents[1]
LOGIN = "someone@example.com"
OTHER_LOGIN = "other@example.com"
MISSING_USER = "00000000-0000-4000-8000-00000000dead"


@pytest.fixture
def env(db_path, tmp_path) -> dict[str, str]:
    return {"Z2H_DB_PATH": str(db_path), "Z2H_APP_DIST": str(tmp_path / "none")}


@pytest.fixture
def users(db_path) -> tuple[str, str]:
    storage = SqliteAdapter(db_path)
    try:
        return new_user(storage, "맥 계정"), new_user(storage, "다른 계정")
    finally:
        storage.close()


def _identity(db_path, login):
    storage = SqliteAdapter(db_path)
    try:
        return storage.find_identity("tailscale", login)
    finally:
        storage.close()


def _run(argv, env, capsys) -> tuple[int, str, str]:
    code = entry.main(argv, env=env)
    out = capsys.readouterr()
    return code, out.out, out.err


def test_link_prints_one_result_line(env, users, db_path, capsys):
    a, _ = users
    code, out, err = _run(["link-tailscale", "--login", "SomeOne@Example.com", "--user", a], env, capsys)
    assert code == 0, err
    lines = out.strip().splitlines()
    assert len(lines) == 1 and LOGIN in lines[0] and a in lines[0]
    assert sum(LOGIN in ln for ln in (out + err).splitlines()) == 1
    assert _identity(db_path, LOGIN) == a


def test_link_again_is_an_error_until_unlinked(env, users, db_path, capsys):
    a, b = users
    assert _run(["link-tailscale", "--login", LOGIN, "--user", a], env, capsys)[0] == 0
    for target in (a, b):
        code, out, err = _run(["link-tailscale", "--login", LOGIN, "--user", target], env, capsys)
        assert code == 1 and out == ""
        assert "unlink-tailscale" in err and LOGIN not in err
    assert _identity(db_path, LOGIN) == a

    code, out, err = _run(["unlink-tailscale", "--login", LOGIN], env, capsys)
    assert code == 0 and LOGIN in out and len(out.strip().splitlines()) == 1
    assert _identity(db_path, LOGIN) is None
    code, out, err = _run(["unlink-tailscale", "--login", LOGIN], env, capsys)
    assert code == 1 and LOGIN not in err

    assert _run(["link-tailscale", "--login", LOGIN, "--user", b], env, capsys)[0] == 0
    assert _identity(db_path, LOGIN) == b


def test_link_to_missing_user_is_an_error(env, users, db_path, capsys):
    code, out, err = _run(["link-tailscale", "--login", LOGIN, "--user", MISSING_USER], env, capsys)
    assert code == 1 and "계정" in err and LOGIN not in err
    assert _identity(db_path, LOGIN) is None


@pytest.mark.parametrize("bad", ["", "=?utf-8?q?someone=40example.com?=", "a b@example.com", f"{LOGIN},{OTHER_LOGIN}"])
def test_bad_login_is_an_error(env, users, capsys, bad):
    a, _ = users
    code, out, err = _run(["link-tailscale", "--login", bad, "--user", a], env, capsys)
    assert code == 1 and out == ""


def test_list(env, users, capsys):
    a, b = users
    code, out, _ = _run(["list-tailscale"], env, capsys)
    assert code == 0 and "없습니다" in out
    _run(["link-tailscale", "--login", LOGIN, "--user", a], env, capsys)
    _run(["link-tailscale", "--login", OTHER_LOGIN, "--user", b], env, capsys)
    code, out, _ = _run(["list-tailscale"], env, capsys)
    assert code == 0
    lines = out.strip().splitlines()
    assert len(lines) == 2
    assert LOGIN in lines[0] and a in lines[0] and "맥 계정" in lines[0]
    assert OTHER_LOGIN in lines[1] and b in lines[1]


def test_missing_db_is_an_error_and_not_created(tmp_path, capsys):
    db = tmp_path / "nothing.sqlite3"
    code, out, err = _run(["list-tailscale"], {"Z2H_DB_PATH": str(db)}, capsys)
    assert code == 1 and "DB" in err
    assert not db.exists()


def test_required_arguments(env, capsys):
    with pytest.raises(SystemExit) as exc:
        entry.main(["link-tailscale", "--login", LOGIN], env=env)
    assert exc.value.code == 2
    with pytest.raises(SystemExit):
        entry.main(["unlink-tailscale"], env=env)


def test_no_arguments_still_start_the_server(monkeypatch, tmp_path):
    seen = {}
    monkeypatch.setattr(entry.uvicorn, "run", lambda app, **kw: seen.update(kw))
    env = {"Z2H_DB_PATH": str(tmp_path / "x.sqlite3"), "Z2H_APP_DIST": str(tmp_path)}
    assert entry.main([], env=env) == 0
    assert seen["host"] == "127.0.0.1" and seen["port"] == 8787
    seen.clear()
    assert entry.main(["--port", "8899"], env=env) == 0
    assert seen["port"] == 8899


def test_commands_never_start_the_server(monkeypatch, env, users, capsys):
    def boom(*_a, **_k):  # pragma: no cover - 불리면 실패
        raise AssertionError("서버를 켜면 안 됨")

    monkeypatch.setattr(entry.uvicorn, "run", boom)
    a, _ = users
    assert _run(["link-tailscale", "--login", LOGIN, "--user", a], env, capsys)[0] == 0
    assert _run(["list-tailscale"], env, capsys)[0] == 0
    assert _run(["unlink-tailscale", "--login", LOGIN], env, capsys)[0] == 0


def test_python_m_link_and_list(env, users, db_path):
    a, _ = users
    full = {**os.environ, **env}

    def run(*args):
        return subprocess.run(
            [sys.executable, "-m", "z2h_server", *args], cwd=SERVER_DIR, env=full, capture_output=True, text=True, timeout=20
        )

    p = run("link-tailscale", "--login", LOGIN, "--user", a)
    assert p.returncode == 0, p.stderr
    assert LOGIN in p.stdout and p.stderr == ""
    p = run("list-tailscale")
    assert p.returncode == 0 and LOGIN in p.stdout and a in p.stdout
    p = run("link-tailscale", "--login", LOGIN, "--user", a)
    assert p.returncode == 1 and LOGIN not in p.stderr
    assert _identity(db_path, LOGIN) == a
