"""저장소 루트 tests/ 공통 설정."""
import os
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONTENT_TOOLS = os.path.join(ROOT, "tools", "content")  # 정본 생성 도구(build_canon 등)를 테스트에서 바로 부른다
for _p in (ROOT, HERE, CONTENT_TOOLS):
    if _p not in sys.path:
        sys.path.insert(0, _p)


def pytest_configure(config):
    config.addinivalue_line("markers", "content_run: 정본의 코드를 실제로 돌려 보는 검사(기본 실행에 들어감. 빼려면 -m 'not content_run')")

# 실수로 실제 진도 서버(127.0.0.1:8787)에 테스트 결과를 보내지 않도록, 기본 주소를 아무도 듣지 않는 포트로 돌린다.
CLOSED_URL = "http://127.0.0.1:9/api/grade"


@pytest.fixture(autouse=True)
def _z2h_isolation(monkeypatch):
    monkeypatch.setenv("Z2H_SERVER_URL", CLOSED_URL)
    monkeypatch.delenv("Z2H_NO_SEND", raising=False)
    import z2h_check
    from z2h_check import runs
    z2h_check.reset()
    runs.forget()
    yield
    z2h_check.reset()
    runs.forget()


@pytest.fixture(scope="session")
def torch_mod():
    try:
        import torch
    except Exception:
        pytest.skip("torch 없음")
    return torch
