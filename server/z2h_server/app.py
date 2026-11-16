"""FastAPI 앱 만들기. API 와 빌드된 앱(app/dist)을 같은 주소에서 제공한다."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles
from starlette.types import Receive, Scope, Send

from . import migrate
from .api import DevAuthOff, NoUser, router
from .auth import NO_TAILSCALE_USER_KO, AuthAdapter, ByHostAuth, LocalDevAuth, NoAuth, TailscaleAuth
from .config import Settings, load_settings, validate_bind_host
from .security import GuardMiddleware
from .storage import StorageAdapter, open_adapter

log = logging.getLogger("z2h_server")

# FastAPI 의 OpenTelemetry 기록을 모두 끈다(바깥으로 아무것도 보내지 않게).
TELEMETRY_OFF = {
    "tracing": False,
    "metrics": False,
    "logs": False,
    "operation_spans": False,
    "auto_configure": False,
}


class StaticOrGuide:
    """app/dist 가 있으면 정적 파일, 없으면 안내 JSON."""

    def __init__(self, dist: Path):
        self.dist = Path(dist)
        self._static: StaticFiles | None = None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if self.dist.is_dir():
            if self._static is None:
                self._static = StaticFiles(directory=self.dist, html=True)
            await self._static(scope, receive, send)
            return
        is_root = scope.get("path", "/") in ("", "/")
        resp = JSONResponse(
            {
                "ok": is_root,
                "app_built": False,
                "message_ko": "앱이 아직 빌드되지 않았습니다. app/ 폴더에서 npm run build 를 하면 이 주소에서 앱이 열립니다.",
                "health": "/api/health",
            },
            status_code=200 if is_root else 404,
        )
        await resp(scope, receive, send)


def create_app(
    settings: Settings | None = None,
    *,
    storage: StorageAdapter | None = None,
    auth: AuthAdapter | None = None,
) -> FastAPI:
    settings = settings or load_settings()
    validate_bind_host(settings.host)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if settings.auto_migrate:
            await run_in_threadpool(migrate.upgrade, settings.db_url)
        made = storage or open_adapter(settings.db_url)
        app.state.storage = made
        # 요청의 현재 계정을 정하는 곳. 맥 개발용 로그인 + (설정하면) 폰 Tailscale 로그인. 이메일·Google 은 공개 승인 뒤.
        off = settings.dev_auth_off_reason
        if auth is not None:
            app.state.auth = auth
        else:
            local: AuthAdapter
            if off is not None:
                # 터널 등 바깥 주소를 허용하면 개발용 로그인을 끈다. 로그인 수단이 없으므로 기록 API 는 모두 401.
                log.warning("개발용 로그인 꺼짐: %s. 기록 API 는 로그인 수단이 없어 401 을 돌려줍니다.", off)
                local = NoAuth()
            else:
                local = LocalDevAuth(made, session_days=settings.dev_session_days)
            if settings.tailscale_host:
                # serve 이름 Host 요청만 TailscaleAuth. 이름(tailnet)과 로그인 이름은 로그에 쓰지 않는다.
                log.warning(
                    "Tailscale 로그인 켜짐(Z2H_TAILSCALE_HOST): serve 주소로 온 요청은 맥미니에서 이어 둔 계정으로만 "
                    "들어옵니다(자동 가입 없음, 잇기: python -m z2h_server link-tailscale)."
                )
                app.state.auth = ByHostAuth(local, TailscaleAuth(made, settings.tailscale_host))
            else:
                app.state.auth = local  # 설정이 없으면 지금과 같은 조립
        try:
            yield
        finally:
            if storage is None:
                made.close()

    app = FastAPI(
        title="Z2H 진도 서버",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        telemetry=TELEMETRY_OFF,
    )
    app.state.settings = settings

    @app.exception_handler(NoUser)
    async def _no_user(request: Request, exc: NoUser):
        # auth_provider: 이 요청을 맡은 로그인 수단(dev_local | tailscale | none). 로그인 이름은 되돌려 주지 않는다.
        if exc.provider == TailscaleAuth.provider:
            message = NO_TAILSCALE_USER_KO
        else:
            message = "먼저 계정을 고르거나 만들어 주세요(/api/dev-auth/accounts)."
        return JSONResponse(
            {"ok": False, "error": "no_user", "message_ko": message, "auth_provider": exc.provider},
            status_code=401,
        )

    @app.exception_handler(DevAuthOff)
    async def _dev_auth_off(request: Request, exc: DevAuthOff):
        return JSONResponse(
            {"ok": False, "error": "not_found", "message_ko": "없는 API 주소입니다."},
            status_code=404,
        )

    @app.exception_handler(RequestValidationError)
    async def _bad_request(request: Request, exc: RequestValidationError):
        detail = [{"loc": list(e.get("loc", ())), "msg": e.get("msg")} for e in exc.errors()]
        return JSONResponse(
            {"ok": False, "error": "bad_request", "message_ko": "요청 모양이 맞지 않습니다.", "detail": detail},
            status_code=422,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            {"ok": False, "error": "http_error", "message_ko": str(exc.detail)}, status_code=exc.status_code
        )

    @app.exception_handler(Exception)
    async def _server_error(request: Request, exc: Exception):
        log.exception("처리 중 오류")
        return JSONResponse(
            {"ok": False, "error": "server_error", "message_ko": "서버 안에서 오류가 났습니다. 잠시 뒤 다시 시도해 주세요."},
            status_code=500,
        )

    app.include_router(router)
    app.mount("/", StaticOrGuide(settings.app_dist), name="app")
    app.add_middleware(GuardMiddleware, settings=settings)
    return app
