"""`python -m z2h_server` 로 진도 서버를 띄운다. 주소는 127.0.0.1:8787 고정.

127.0.0.1 이 아닌 주소(0.0.0.0, ::, 빈 값 등)를 --host 나 Z2H_HOST 로 넘기면 띄우지 않고 끝낸다(종료 코드 2).
Z2H_TAILSCALE_HOST 값이 '<기기>.<tailnet>.ts.net' 이름 1개가 아니어도 띄우지 않는다(종료 코드 2).

폰 로그인(Tailscale) 잇기 명령. 맥미니에서 직접 실행한다(HTTP API 는 없다). 서버를 켜지 않는다.
  python -m z2h_server link-tailscale --login <로그인 이름> --user <user_id>
  python -m z2h_server unlink-tailscale --login <로그인 이름>
  python -m z2h_server list-tailscale
종료 코드: 0 성공, 1 잇기·끊기 실패(이미 이어짐, 없는 계정, DB 없음 등), 2 설정·인자 오류.
로그인 이름(이메일)이 출력에 나오는 것은 결과 줄뿐이고, 오류 글에는 넣지 않는다.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Mapping

import uvicorn

from .app import create_app
from .config import BindRefused, Settings, TailscaleHostRefused, load_settings, validate_bind_host

TAILSCALE_COMMANDS = ("link-tailscale", "unlink-tailscale", "list-tailscale")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m z2h_server", description="Z2H 진도 서버(127.0.0.1 전용)")
    parser.add_argument("--host", default=None, help="127.0.0.1 만 됩니다(기본값). 다른 값은 실행 거부")
    parser.add_argument("--port", type=int, default=None, help="기본 8787")
    sub = parser.add_subparsers(dest="command", metavar="명령", help="없으면 서버를 켭니다")
    link = sub.add_parser("link-tailscale", help="Tailscale 로그인 이름을 학습 계정에 잇기")
    link.add_argument("--login", required=True, help="Tailscale 로그인 이름(예: someone@example.com)")
    link.add_argument("--user", required=True, help="이을 학습 계정의 user_id")
    unlink = sub.add_parser("unlink-tailscale", help="Tailscale 로그인 이름의 잇기 끊기")
    unlink.add_argument("--login", required=True, help="Tailscale 로그인 이름")
    sub.add_parser("list-tailscale", help="이어 둔 Tailscale 로그인 목록")
    return parser


def main(argv: list[str] | None = None, env: Mapping[str, str] | None = None) -> int:
    args = _parser().parse_args(argv)

    try:
        settings = load_settings(os.environ if env is None else env, host=args.host, port=args.port)
        host = validate_bind_host(settings.host)
    except (BindRefused, TailscaleHostRefused) as exc:
        print(f"실행 거부: {exc}", file=sys.stderr)
        return 2

    if args.command in TAILSCALE_COMMANDS:
        return _tailscale_command(args, settings)

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


def _tailscale_command(args: argparse.Namespace, settings: Settings) -> int:
    """잇기·끊기·목록. 표를 만들거나 바꾸지 않는다(DB 는 서버를 한 번 켜서 만든다)."""
    from . import auth
    from .storage import open_adapter

    path = settings.sqlite_path
    if path is not None and not path.exists():
        print(
            "DB 파일이 없습니다. 먼저 서버를 한 번 켜고(python -m z2h_server), 맥에서 계정을 만든 뒤 다시 실행해 주세요.",
            file=sys.stderr,
        )
        return 1
    storage = open_adapter(settings.db_url)
    try:
        if storage.schema_version() is None:
            print("DB 에 표가 없습니다. 먼저 서버를 한 번 켜서 표를 만들어 주세요.", file=sys.stderr)
            return 1
        if args.command == "link-tailscale":
            login = auth.link_tailscale(storage, args.login, args.user)
            print(f"연결함: {login} → {args.user}")
        elif args.command == "unlink-tailscale":
            login = auth.unlink_tailscale(storage, args.login)
            print(f"연결 끊음: {login}")
        else:
            rows = auth.list_tailscale(storage)
            if not rows:
                print("이어 둔 Tailscale 로그인이 없습니다.")
            for row in rows:
                print(f"{row['subject']}\t{row['user_id']}\t{row['display_name'] or '-'}\t{row['created_at']}")
        return 0
    except auth.LinkError as exc:
        print(f"실패: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # DB 오류 등. 글에 로그인 이름이 섞일 수 있어 종류만 보여 준다
        print(f"실패: 처리 중 오류가 났습니다({type(exc).__name__}).", file=sys.stderr)
        return 1
    finally:
        storage.close()


if __name__ == "__main__":
    sys.exit(main())
