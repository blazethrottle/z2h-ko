"""바인드 거부: 127.0.0.1 이 아니면 서버를 띄우지 않는다. 실제 실행 한 번(빈 포트)."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest

from z2h_server import __main__ as entry
from z2h_server.app import create_app
from z2h_server.config import BindRefused, Settings, load_settings, validate_bind_host

SERVER_DIR = Path(__file__).resolve().parents[1]


def test_loopback_is_the_only_allowed_host():
    assert validate_bind_host("127.0.0.1") == "127.0.0.1"


@pytest.mark.parametrize(
    "host",
    ["0.0.0.0", "::", "[::]", "", " ", " 127.0.0.1", "localhost", "127.0.0.2", "192.168.0.10", "::1", None, "0"],
)
def test_other_hosts_are_refused(host):
    with pytest.raises(BindRefused):
        validate_bind_host(host)


@pytest.mark.parametrize("value", ["0.0.0.0", "", "::"])
def test_env_host_is_checked(value):
    with pytest.raises(BindRefused):
        load_settings(env={"Z2H_HOST": value})


def test_settings_default_is_loopback_8787():
    s = load_settings(env={})
    assert (s.host, s.port) == ("127.0.0.1", 8787)
    assert s.db_url.endswith("server/data/z2h.sqlite3")


def test_create_app_refuses_bad_host(tmp_path):
    with pytest.raises(BindRefused):
        create_app(Settings(host="0.0.0.0", db_url="sqlite://", app_dist=tmp_path))


def test_main_passes_only_loopback_to_uvicorn(monkeypatch, tmp_path):
    seen = {}

    def fake_run(app, **kwargs):
        seen.update(kwargs)

    monkeypatch.setattr(entry.uvicorn, "run", fake_run)
    code = entry.main([], env={"Z2H_DB_PATH": str(tmp_path / "x.sqlite3"), "Z2H_APP_DIST": str(tmp_path)})
    assert code == 0
    assert seen["host"] == "127.0.0.1" and seen["port"] == 8787
    assert "uds" not in seen and "fd" not in seen


def _run_module(args, env_extra, timeout=20):
    env = dict(os.environ)
    env.update(env_extra)
    return subprocess.run(
        [sys.executable, "-m", "z2h_server", *args],
        cwd=SERVER_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


@pytest.mark.parametrize(
    "args, env_extra",
    [
        (["--host", "0.0.0.0"], {}),
        (["--host", "::"], {}),
        (["--host", ""], {}),
        ([], {"Z2H_HOST": "0.0.0.0"}),
        ([], {"Z2H_HOST": ""}),
    ],
)
def test_python_m_z2h_server_refuses_to_start(args, env_extra, tmp_path):
    env_extra = {**env_extra, "Z2H_DB_PATH": str(tmp_path / "x.sqlite3")}
    proc = _run_module(args, env_extra)
    assert proc.returncode == 2, proc.stderr
    assert "127.0.0.1" in proc.stderr
    assert not (tmp_path / "x.sqlite3").exists()  # DB도 만들지 않고 멈춘다


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_real_server_starts_on_loopback_and_answers_health(tmp_path):
    port = _free_port()
    env = dict(os.environ)
    env.update({"Z2H_DB_PATH": str(tmp_path / "real.sqlite3"), "Z2H_APP_DIST": str(tmp_path / "none")})
    proc = subprocess.Popen(
        [sys.executable, "-m", "z2h_server", "--port", str(port)],
        cwd=SERVER_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        body = None
        deadline = time.time() + 20
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1) as r:
                    body = json.loads(r.read())
                    break
            except OSError:
                if proc.poll() is not None:
                    break
                time.sleep(0.2)
        assert body is not None, proc.stderr.read() if proc.poll() is not None else "응답 없음"
        assert body["ok"] is True and body["schema_version"] == "0002"
        assert (tmp_path / "real.sqlite3").exists()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:  # pragma: no cover
            proc.kill()
