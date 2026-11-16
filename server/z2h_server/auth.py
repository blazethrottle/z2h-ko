"""요청마다 '지금 누구인가(user_id)'를 정하는 인증 계층(D43·D44).

서버의 다른 곳은 user_id 를 이 계층(AuthAdapter.current_user_id)으로만 얻는다. 고정 user_id 는 어디에도 없다.

지금 구현은 LocalDevAuth 하나:
- 로컬 개발용 로그인. 계정을 여러 개 만들고 바꿀 수 있다. 비밀번호 없음.
- 이 컴퓨터 안에서 바로 온 요청에서만 동작한다(local_only). 요청마다 직접 검사하고, 공용 문 검사에만 기대지 않는다.
  1) 접속한 쪽이 127.0.0.1  2) 프록시·터널 머리말(CF-Connecting-IP, X-Forwarded-For 등)이 하나도 없음
  3) Host 가 127.0.0.1 또는 localhost. 하나라도 어기면 그 요청에서는 누구도 아니다.
- 터널 주소를 허용하는 설정이 있거나 Z2H_DEV_AUTH=0 이면 서버가 LocalDevAuth 대신 NoAuth 를 쓴다(앱 조립 때).
- 브라우저는 쿠키(z2h_dev_session), 브라우저 밖 도구(로컬 Jupyter 의 finish() 등)는 머리말 X-Z2H-User: {user_id}.

나중(공개 승인 항목, 지금 만들지 않음):
- EmailOtpAuth: 이메일 일회용 코드(+ 같은 메일의 매직 링크). 메일 발송 서비스와 키가 필요하다.
- GoogleAuth: Google 로그인(OAuth). 클라이언트 키 발급이 필요하다.
- X 로그인은 넣지 않는다(D44).
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any

from starlette.requests import Request

from .security import host_allowed
from .storage.base import StorageAdapter
from .timeutil import KST, to_kst_iso

LOOPBACK = "127.0.0.1"
LOCAL_HOSTNAMES = frozenset({"127.0.0.1", "localhost"})
# 이 중 하나라도 있으면 프록시·터널을 거친 요청으로 본다
FORWARDING_HEADERS = (
    "cf-connecting-ip",
    "cf-ray",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-real-ip",
    "forwarded",
)


class AuthAdapter(ABC):
    """요청 → 현재 계정. 없으면 None(그러면 학습 기록 API 는 401)."""

    provider: str = ""

    @abstractmethod
    def current_user_id(self, request: Request) -> str | None: ...


class NoAuth(AuthAdapter):
    """로그인 수단이 없는 상태(개발용 로그인을 끈 때). 모든 요청이 누구도 아니므로 기록 API 는 401."""

    provider = "none"

    def current_user_id(self, request: Request) -> str | None:
        return None


class EmailOtpAuth(AuthAdapter):  # pragma: no cover - 자리만
    """이메일 일회용 코드 로그인. 공개 승인 뒤 구현(메일 발송·키 필요). 지금은 만들 수 없다."""

    provider = "email_otp"

    def __init__(self, *_: Any, **__: Any):
        raise NotImplementedError("이메일 로그인은 공개 승인 뒤 구현합니다(메일 발송 서비스·키 필요)")

    def current_user_id(self, request: Request) -> str | None:
        raise NotImplementedError


class GoogleAuth(AuthAdapter):  # pragma: no cover - 자리만
    """Google 로그인(OAuth). 공개 승인 뒤 구현(클라이언트 키 필요). 지금은 만들 수 없다."""

    provider = "google"

    def __init__(self, *_: Any, **__: Any):
        raise NotImplementedError("Google 로그인은 공개 승인 뒤 구현합니다(OAuth 클라이언트 키 필요)")

    def current_user_id(self, request: Request) -> str | None:
        raise NotImplementedError


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def local_only(request: Request) -> bool:
    """이 컴퓨터 안에서 프록시·터널 없이 바로 온 요청인가. 개발용 로그인의 문."""
    client = request.client
    if client is None or client.host != LOOPBACK:
        return False
    if any(name in request.headers for name in FORWARDING_HEADERS):
        return False
    return host_allowed(request.headers.get("host"), LOCAL_HOSTNAMES)


class LocalDevAuth(AuthAdapter):
    provider = "dev_local"
    COOKIE = "z2h_dev_session"
    HEADER = "x-z2h-user"

    def __init__(self, storage: StorageAdapter, *, session_days: int = 30):
        self.storage = storage
        self.session_days = session_days

    # ---- 요청의 현재 계정 ----
    def allows(self, request: Request) -> bool:
        return local_only(request)

    def current_user_id(self, request: Request) -> str | None:
        if not self.allows(request):
            return None
        header = request.headers.get(self.HEADER)
        if header:
            user = self.storage.get_user(header.strip())
            return None if user is None else user["user_id"]
        token = request.cookies.get(self.COOKIE)
        if token:
            return self.storage.find_session(_hash(token))
        return None

    # ---- 계정 만들기·목록·전환 ----
    def create_account(self, *, display_name: str | None = None, path_id: str = "full", locale: str = "ko-KR") -> dict:
        user_id = str(uuid.uuid4())
        user = self.storage.create_user(user_id, display_name=display_name, locale=locale, path_id=path_id)
        self.storage.add_identity(user_id, self.provider, user_id)
        return user

    def list_accounts(self) -> list[dict]:
        return self.storage.list_users(self.provider)

    def login(self, user_id: str) -> tuple[str, int]:
        """세션을 만들고 (쿠키 값, 유지 초)를 돌려준다. DB 에는 쿠키 값의 해시만 남긴다."""
        if self.storage.get_user(user_id) is None:
            raise KeyError(user_id)
        token = secrets.token_urlsafe(32)
        seconds = self.session_days * 24 * 3600
        expires = to_kst_iso(datetime.now(KST) + timedelta(seconds=seconds), micro=True)
        self.storage.create_session(user_id, _hash(token), expires)
        return token, seconds

    def logout(self, request: Request) -> None:
        token = request.cookies.get(self.COOKIE)
        if token:
            self.storage.delete_session(_hash(token))
