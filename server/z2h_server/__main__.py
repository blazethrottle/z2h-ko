"""`python -m z2h_server` 로 진도 서버를 띄운다. 주소는 127.0.0.1:8787 고정.

127.0.0.1 이 아닌 주소(0.0.0.0, ::, 빈 값 등)를 --host 나 Z2H_HOST 로 넘기면 띄우지 않고 끝낸다(종료 코드 2).
"""

from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Mapping

import uvicorn

from .app import create_app
from .config import BindRefused, load_settings, validate_bind_host


def main(argv: list[str] | None = None, env: Mapping[str, str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m z2h_server", description="Z2H 진도 서버(127.0.0.1 전용)")
    parser.add_argument("--host", default=None, help="127.0.0.1 만 됩니다(기본값). 다른 값은 실행 거부")
    parser.add_argument("--port", type=int, default=None, help="기본 8787")
    args = parser.parse_args(argv)

    try:
        settings = load_settings(os.environ if env is None else env, host=args.host, port=args.port)
        host = validate_bind_host(settings.host)
    except BindRefused as exc:
        print(f"실행 거부: {exc}", file=sys.stderr)
        return 2

    app = create_app(settings)
    print(f"Z2H 진도 서버: http://{host}:{settings.port}/  (멈추려면 Ctrl+C)", flush=True)
    uvicorn.run(
        app,
        host=host,
        port=settings.port,
        proxy_headers=False,  # 접속한 쪽 주소를 머리말로 바꾸지 않는다
        server_header=False,
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
