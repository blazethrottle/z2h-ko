"""HTTP API (DESIGN.md 12.5). 모두 JSON.

학습 기록 API 는 요청의 현재 계정(AuthAdapter)으로 처리한다. 계정이 없으면 401 no_user.
요청마다 먼저 그 요청을 맡을 로그인 수단 하나를 고른다(auth.for_request). Z2H_TAILSCALE_HOST 가 있으면
Host 가 serve 이름인 요청은 TailscaleAuth, 그 밖은 개발용 로그인. 401 본문과 GET /api/me 에 그 수단(auth_provider)을 적는다.
로컬 개발 로그인(LocalDevAuth) API 는 /api/dev-auth/* 에 있다(127.0.0.1 전용, serve 이름 Host 에서는 404).
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, StrictBool

from . import result_code as rc
from .auth import AuthAdapter, LocalDevAuth
from .storage.base import StorageAdapter
from .timeutil import normalize_time, now_kst

router = APIRouter(prefix="/api")

_LECTURE = re.compile(r"^L\d{2}$")
_CHECK_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")


class NoUser(Exception):
    """현재 계정이 없음(로그인 전). provider = 이 요청을 맡은 로그인 수단(401 본문의 auth_provider)."""

    def __init__(self, provider: str = ""):
        self.provider = provider
        super().__init__(provider)


class DevAuthOff(Exception):
    """개발용 로그인을 쓸 수 없는 요청(꺼짐, 또는 이 컴퓨터 안에서 바로 온 요청이 아님). 404 로 답한다."""


def error(status: int, code: str, message_ko: str, **extra: Any) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code, "message_ko": message_ko, **extra}, status_code=status)


def _storage(request: Request) -> StorageAdapter:
    return request.app.state.storage


def _auth(request: Request) -> AuthAdapter:
    """이 요청을 맡을 로그인 수단 하나. 한 요청이 두 수단에 걸치지 않는다."""
    return request.app.state.auth.for_request(request)


def _who(request: Request) -> tuple[AuthAdapter, str]:
    auth = _auth(request)
    user_id = auth.current_user_id(request)
    if user_id is None:
        raise NoUser(auth.provider)
    return auth, user_id


def _user(request: Request) -> str:
    return _who(request)[1]


def _public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {k: user.get(k) for k in ("user_id", "display_name", "path_id", "locale", "created_at")}


# ---------------- 상태 확인 ----------------


@router.get("/health")
def health(request: Request):
    try:
        storage = _storage(request)
        storage.ping()
        version = storage.schema_version()
    except Exception:  # DB 에 닿지 못함
        return JSONResponse({"ok": False, "server_time": now_kst(), "schema_version": None}, status_code=503)
    return {"ok": True, "server_time": now_kst(), "schema_version": version}


# ---------------- 로컬 개발 로그인 (LocalDevAuth) ----------------


def _dev_auth(request: Request) -> LocalDevAuth:
    """개발용 로그인 경로의 문. 공용 문 검사(security.py)와 따로, 여기서 직접 막는다.

    꺼져 있거나(터널 주소 설정·Z2H_DEV_AUTH=0), 접속한 쪽이 127.0.0.1 이 아니거나,
    프록시·터널 머리말이 있거나, Host 가 127.0.0.1·localhost 가 아니면 이 경로는 없는 것처럼 404.
    Host 가 serve 이름이면 이 요청을 맡는 수단이 TailscaleAuth 라서 늘 404.
    """
    auth = _auth(request)
    if not isinstance(auth, LocalDevAuth) or not auth.allows(request):
        raise DevAuthOff()
    return auth


def _with_session_cookie(auth: LocalDevAuth, user: dict[str, Any]) -> JSONResponse:
    token, seconds = auth.login(user["user_id"])
    resp = JSONResponse({"ok": True, "user": _public_user(user)})
    resp.set_cookie(auth.COOKIE, token, max_age=seconds, httponly=True, samesite="strict", path="/")
    return resp


class NewAccountBody(BaseModel):
    display_name: str | None = Field(default=None, max_length=100)
    path_id: str = "full"
    locale: str = Field(default="ko-KR", max_length=16)


@router.get("/dev-auth/accounts")
def dev_accounts(request: Request):
    auth = _dev_auth(request)
    return {
        "accounts": [_public_user(u) for u in auth.list_accounts()],
        "current_user_id": auth.current_user_id(request),
    }


@router.post("/dev-auth/accounts")
def dev_create_account(body: NewAccountBody, request: Request):
    """새 개발 계정을 만들고 그 계정으로 로그인(쿠키)."""
    auth = _dev_auth(request)
    try:
        user = auth.create_account(display_name=body.display_name, path_id=body.path_id, locale=body.locale)
    except ValueError as exc:
        return error(400, "bad_account", str(exc))
    return _with_session_cookie(auth, user)


class LoginBody(BaseModel):
    user_id: str = Field(min_length=1, max_length=36)


@router.post("/dev-auth/login")
def dev_login(body: LoginBody, request: Request):
    """다른 계정으로 바꾸기."""
    auth = _dev_auth(request)
    user = _storage(request).get_user(body.user_id)
    if user is None or user["user_id"] not in {u["user_id"] for u in auth.list_accounts()}:
        return error(404, "no_account", "그런 계정이 없습니다.")
    return _with_session_cookie(auth, user)


@router.post("/dev-auth/logout")
def dev_logout(request: Request):
    auth = _dev_auth(request)
    auth.logout(request)
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(auth.COOKIE, path="/")
    return resp


@router.get("/me")
def me(request: Request):
    """현재 계정과 로그인 수단(auth_provider: dev_local | tailscale). 로그인 이름은 돌려주지 않는다."""
    auth, user_id = _who(request)
    user = _storage(request).get_user(user_id)
    return {"ok": True, "user": _public_user(user or {}), "auth_provider": auth.provider}


class MeBody(BaseModel):
    path_id: str | None = None
    display_name: str | None = Field(default=None, max_length=100)
    locale: str | None = Field(default=None, max_length=16)


@router.post("/me")
def update_me(body: MeBody, request: Request):
    """학습자 길(path_id) 등 계정 칸 바꾸기. "전체 길로 바꾸기" = path_id 만 full 로(기록은 그대로)."""
    user_id = _user(request)
    changes = body.model_dump(exclude_none=True)
    try:
        user = _storage(request).update_user(user_id, **changes)
    except ValueError as exc:
        return error(400, "bad_account", str(exc))
    return {"ok": True, "user": _public_user(user)}


# ---------------- 학습 기록 ----------------


@router.get("/state")
def state(request: Request, since: str | None = None):
    user_id = _user(request)
    since_no = None
    if since is not None:
        if not since.isdigit():
            return error(400, "bad_since", "since 는 직전 응답의 server_seq(0 이상 정수)여야 합니다.")
        since_no = int(since)
    return _storage(request).get_state(user_id, since_no)


class SyncBody(BaseModel):
    client_id: str = Field(min_length=1, max_length=64)
    ops: list[Any]


@router.post("/sync")
def sync(body: SyncBody, request: Request):
    return _storage(request).apply_ops(_user(request), body.client_id, body.ops).to_dict()


class ResultCodeBody(BaseModel):
    code: str = Field(max_length=rc.MAX_CODE_CHARS)


def _grade_response(lecture: str, when: str, passed: list[str], failed: list[str], out) -> dict[str, Any]:
    return {
        "ok": True,
        "lecture_id": lecture,
        "t": when,
        "passed": passed,
        "failed": failed,
        "applied": out.applied,
        "superseded": out.superseded,
        "rejected": out.rejected,
        "server_time": out.server_time,
    }


def _save_code(request: Request, user_id: str, code: str, source: str):
    try:
        decoded = rc.decode(code)
    except rc.ResultCodeError as exc:
        return error(400, exc.error, exc.message_ko)
    results = [{"check_id": c, "passed": True} for c in decoded.passed]
    results += [{"check_id": c, "passed": False} for c in decoded.failed]
    out = _storage(request).record_grade_results(
        user_id, results, source=source, at=decoded.t, op_key=f"{decoded.crc}:{decoded.t}"
    )
    return _grade_response(decoded.lecture_id, decoded.t, decoded.passed, decoded.failed, out)


@router.post("/result-code")
def result_code(body: ResultCodeBody, request: Request):
    """앱에 붙여 넣은 결과코드를 풀어 grade_result 로 저장."""
    return _save_code(request, _user(request), body.code, "result_code")


class GradeItem(BaseModel):
    check_id: str = Field(max_length=64)
    passed: StrictBool
    message_ko: str | None = Field(default=None, max_length=2000)


class GradeBody(BaseModel):
    code: str | None = Field(default=None, max_length=rc.MAX_CODE_CHARS)
    lecture_id: str | None = None
    at: str | None = None
    t: str | None = None  # 예전 이름. at 이 없을 때만 본다
    results: list[GradeItem] | None = None


@router.post("/grade")
def grade(body: GradeBody, request: Request):
    """로컬 Jupyter 의 finish() 가 채점 결과를 바로 보낸다(12.7절: {lecture_id, results, at}). 결과코드 그대로도 받는다."""
    user_id = _user(request)
    if body.code is not None:
        return _save_code(request, user_id, body.code, "notebook")
    bad = "채점 결과 모양이 맞지 않습니다. {lecture_id, results:[{check_id, passed, message_ko}], at} 로 보내 주세요."
    if body.lecture_id is None or not _LECTURE.match(body.lecture_id) or body.results is None:
        return error(400, "bad_grade", bad)
    try:
        when = normalize_time(body.at if body.at is not None else body.t)
    except ValueError:
        return error(400, "bad_grade", "at 은 +09:00 시각이어야 합니다.")
    ids = [r.check_id for r in body.results]
    if any(not _CHECK_ID.match(c) for c in ids) or len(set(ids)) != len(ids):
        return error(400, "bad_grade", "check_id 모양이 틀렸거나 겹칩니다.")
    digest = hashlib.sha256(json.dumps(body.model_dump(), sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    results = [r.model_dump() for r in body.results]
    out = _storage(request).record_grade_results(user_id, results, source="notebook", at=when, op_key=digest)
    passed = [r.check_id for r in body.results if r.passed]
    failed = [r.check_id for r in body.results if not r.passed]
    return _grade_response(body.lecture_id, when, passed, failed, out)


@router.get("/export")
def export(request: Request):
    data = _storage(request).export_all(_user(request))
    day = data["exported_at"][:10].replace("-", "")
    return JSONResponse(data, headers={"Content-Disposition": f'attachment; filename="z2h-backup-{day}.json"'})


@router.api_route("/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
def not_found(rest: str):
    return error(404, "not_found", f"없는 API 주소입니다: /api/{rest}")
