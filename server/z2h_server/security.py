"""요청 검사(DESIGN.md 12.5). 모든 요청(정적 파일 포함)이 이 문을 지난다.

1. 접속한 쪽과 받은 쪽 주소가 127.0.0.1 인지(바인드가 잘못돼도 바깥 접속은 거부)
2. Host 머리말이 127.0.0.1 또는 localhost(포트는 붙어도 됨)인지. DNS 재바인딩 공격 막기
3. 쓰기 요청(POST 등)은 Origin 이 있으면 이 서버 주소와 같은지. 다른 사이트에서 몰래 보내는 쓰기 막기
   (Origin 이 없는 요청은 브라우저 밖 프로그램, 예: 로컬 Jupyter 의 finish(). 브라우저는 POST 에 늘 Origin 을 붙인다)
4. 본문 1MB 제한(Content-Length 가 없어도 실제로 센다)
"""

from __future__ import annotations

from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from .config import Settings

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
LOOPBACK = "127.0.0.1"


def host_allowed(raw: str | None, allowed: frozenset[str]) -> bool:
    if not raw:
        return False
    text = raw.strip().lower()
    if not text or text.startswith("["):
        return False  # IPv6 주소는 받지 않는다(127.0.0.1 에만 바인드)
    name, sep, port = text.rpartition(":")
    if not sep:
        name = text
    elif not port.isdigit() or not (0 < int(port) < 65536):
        return False
    return name in allowed


def _error(status: int, error: str, message_ko: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": error, "message_ko": message_ko}, status_code=status)


class GuardMiddleware:
    def __init__(self, app: ASGIApp, settings: Settings):
        self.app = app
        self.settings = settings

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "lifespan":
            await self.app(scope, receive, send)
            return
        if scope["type"] != "http":
            await send({"type": "websocket.close", "code": 1008})
            return

        s = self.settings
        headers = Headers(scope=scope)

        if s.require_loopback_peer:
            client = scope.get("client")
            server = scope.get("server")
            if not client or client[0] != LOOPBACK or (server and server[0] != LOOPBACK):
                resp = _error(403, "not_loopback", "이 서버는 이 컴퓨터 안(127.0.0.1)에서만 열 수 있습니다.")
                await resp(scope, receive, send)
                return

        if not host_allowed(headers.get("host"), s.allowed_hostnames):
            resp = _error(400, "bad_host", "주소가 맞지 않습니다. http://127.0.0.1:8787 로 열어 주세요.")
            await resp(scope, receive, send)
            return

        method = scope.get("method", "GET").upper()
        if method in UNSAFE_METHODS:
            origin = headers.get("origin")
            if origin is not None and origin.strip().lower().rstrip("/") not in s.allowed_origins:
                resp = _error(403, "bad_origin", "다른 사이트에서 보낸 쓰기 요청은 받지 않습니다.")
                await resp(scope, receive, send)
                return
            if headers.get("sec-fetch-site", "").lower() == "cross-site":
                resp = _error(403, "bad_origin", "다른 사이트에서 보낸 쓰기 요청은 받지 않습니다.")
                await resp(scope, receive, send)
                return

        limit = s.max_body_bytes
        too_large = _error(413, "too_large", "보내는 내용이 너무 큽니다(최대 1MB). 나눠서 보내 주세요.")
        length = headers.get("content-length")
        if length is not None and (not length.strip().isdigit() or int(length) > limit):
            await too_large(scope, receive, send)
            return

        if method in UNSAFE_METHODS or length is not None or "transfer-encoding" in headers:
            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                body += message.get("body", b"")
                if len(body) > limit:
                    await too_large(scope, receive, send)
                    return
                if not message.get("more_body", False):
                    break

            replayed = False

            async def replay() -> dict:
                nonlocal replayed
                if not replayed:
                    replayed = True
                    return {"type": "http.request", "body": bytes(body), "more_body": False}
                return await receive()

            await self.app(scope, replay, send)
            return

        await self.app(scope, receive, send)
