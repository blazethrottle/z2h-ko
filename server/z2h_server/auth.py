"""요청마다 '지금 누구인가(user_id)'를 정하는 인증 계층(D43·D44).

서버의 다른 곳은 user_id 를 이 계층(AuthAdapter)으로만 얻는다. 고정 user_id 는 어디에도 없다.
API 는 먼저 for_request(request) 로 그 요청을 맡을 로그인 수단 하나를 고르고, 그 수단의 current_user_id 만 본다.

조립과 이름표(공개 전환 대비, 이 파일 맨 아래)
- build_auth(settings, storage): 설정값 → 로그인 수단. 서버가 쓰는 수단은 여기서만 정한다(app.py 는 부르기만).
- AUTH_PROVIDERS: provider 이름 → 수단 클래스. 응답의 auth_provider 와 auth_identity.provider 에 쓰는 이름표.
- API(api.py·app.py)는 수단의 구체 이름·provider 글자로 가르지 않고 AuthAdapter 의 속성·메서드
  (provider, no_user_message_ko, for_request, dev_login, current_user_id)만 쓴다.
  새 수단(EmailOtpAuth·GoogleAuth)을 넣을 때는 새 클래스와 build_auth 만 고치면 된다. 두 수단은 아직 자리만 있다.
- 쿠키 이름·속성·유지 기간은 config.CookieSettings 에서 온다(LocalDevAuth.start_session·end_session).

1. LocalDevAuth (provider "dev_local"): 맥 개발용 로그인
- 계정을 여러 개 만들고 바꿀 수 있다. 비밀번호 없음.
- 이 컴퓨터 안에서 바로 온 요청에서만 동작한다(local_only). 요청마다 직접 검사하고, 공용 문 검사에만 기대지 않는다.
  1) 접속한 쪽이 127.0.0.1  2) 프록시·터널 머리말(CF-Connecting-IP, X-Forwarded-For 등)과
  Tailscale serve 가 붙이는 머리말(Tailscale-User-*, Tailscale-Funnel-Request)이 하나도 없음
  3) Host 가 127.0.0.1 또는 localhost.
  하나라도 어기면 그 요청에서는 누구도 아니다.
- 터널 주소를 허용하는 설정(Z2H_EXTRA_HOSTS 의 바깥 이름)이 있거나 Z2H_DEV_AUTH=0 이면
  서버가 LocalDevAuth 대신 NoAuth 를 쓴다(앱 조립 때). Z2H_TAILSCALE_HOST 의 이름은 여기에 세지 않는다.
- 브라우저는 쿠키(z2h_dev_session), 브라우저 밖 도구(로컬 Jupyter 의 finish() 등)는 머리말 X-Z2H-User: {user_id}.

2. TailscaleAuth (provider "tailscale"): 폰 로그인 A안. Z2H_TAILSCALE_HOST 를 설정했을 때만 있다
- 폰은 Tailscale serve(tailnet 안에서만, Funnel 아님)를 거쳐 이 서버(127.0.0.1:8787)에 닿는다.
  serve 는 프록시한 요청에 Tailscale-User-Login(로그인 이름)을 붙이고, 들어온 요청에 이미 있던 같은 머리말은 지운다.
- 요청 하나를 serve 경유로 인정하는 조건(모두 충족, 하나라도 어기면 그 요청은 누구도 아니다)
  (a) 접속한 쪽이 127.0.0.1  (b) Host 머리말이 정확히 1개이고 Z2H_TAILSCALE_HOST 와 같음(포트 무시, 대소문자 무시)
  (c) Tailscale-User-Login 이 정확히 1개, 비어 있지 않음. RFC 2047 Q 인코딩 값(=? 로 시작)은 풀지 않고 거부
  (d) Tailscale-Funnel-Request(Funnel 금지를 서버에서도 한 번 더), CF-Connecting-IP·CF-Ray(Cloudflare 터널)가 없음
- 쓰기 요청(POST 등)은 공용 문(security.py)에서 Origin 이 정확히 https://<serve 이름> 일 때만 통과한다(없어도 거부).
- 로그인 이름(소문자) → auth_identity(provider="tailscale", subject=이름) → user_id. 자동 가입 없음.
  이어 두지 않은 이름은 None(401). 잇기는 맥미니에서 직접 실행하는 명령(python -m z2h_server link-tailscale)뿐이다.
- X-Forwarded-* 를 serve 가 붙이는지는 문서에 없다(미확인). 그래서 이 판단은 그 머리말의 있고 없음을 보지 않는다.
- 로그인 이름은 이메일일 수 있어 서버 로그·오류 글·응답 본문에 쓰지 않는다.

3. ByHostAuth: Z2H_TAILSCALE_HOST 가 있을 때 위 둘을 묶는다
- Host 가 serve 이름인 요청은 TailscaleAuth 만, 그 밖의 요청은 개발용 로그인(LocalDevAuth 또는 NoAuth)만 본다.
  한 요청이 두 수단에 걸치지 않는다: serve 이름 Host 에서는 /api/dev-auth/* 가 404, X-Z2H-User·개발 쿠키를 보지 않고,
  로컬 Host 에서는 Tailscale 머리말을 신원으로 쓰지 않는다.
- 설정이 없으면 ByHostAuth 를 만들지 않는다(조립이 지금과 같다).

남는 위험(문서 server/README.md 에도 적음)
- 같은 컴퓨터 안 프로그램은 127.0.0.1:8787 에 Host 와 Tailscale-User-Login 을 마음대로 붙여 보낼 수 있다(위조 가능).
  그 프로그램은 DB 파일도 읽을 수 있으므로 이 서버가 막을 수 있는 범위 밖이다.
- serve 대상은 진도 서버(http://127.0.0.1:8787)만이어야 한다. 앱 dev·preview 서버(4321 등)의 /api 프록시는
  Host 를 로컬로 바꾸고 전달 머리말을 지우므로, serve 가 그 포트를 가리키면 신원 머리말 없는 요청(태그된 기기 등)이
  로컬 요청처럼 보여 개발용 로그인에 닿을 수 있다.
- tailnet 을 공유받은 바깥 사람의 요청에도 머리말이 붙는다. 계정에 이어 두지 않았으면 401.
- 태그된 기기의 요청에는 머리말이 없다. 그 기기로는 로그인할 수 없다(401).

나중(공개 승인 항목, 지금 만들지 않음):
- EmailOtpAuth: 이메일 일회용 코드(+ 같은 메일의 매직 링크). 메일 발송 서비스와 키가 필요하다.
- GoogleAuth: Google 로그인(OAuth). 클라이언트 키 발급이 필요하다.
- X 로그인은 넣지 않는다(D44).
"""

from __future__ import annotations

import hashlib
import logging
import re
import secrets
import uuid
from abc import ABC, abstractmethod
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any

from starlette.requests import Request
from starlette.responses import Response

from .config import LOCAL_HOSTNAMES, LOOPBACK, CookieSettings, Settings, validate_tailscale_host
from .security import host_allowed, serve_host_in
from .storage.base import StorageAdapter
from .timeutil import KST, to_kst_iso

log = logging.getLogger("z2h_server")
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
# Tailscale serve 가 프록시한 요청에 붙이는 신원 머리말(태그된 기기·Funnel 요청에는 없음)
TAILSCALE_LOGIN_HEADER = "tailscale-user-login"
TAILSCALE_IDENTITY_HEADERS = (TAILSCALE_LOGIN_HEADER, "tailscale-user-name", "tailscale-user-profile-pic")
# Funnel(인터넷 공개)로 들어온 요청에 serve 가 붙이는 머리말. Funnel 은 쓰지 않으므로 보이면 거부한다
TAILSCALE_FUNNEL_HEADER = "tailscale-funnel-request"
# 개발용 로그인(local_only)이 '전달된 요청'으로 보고 거부하는 머리말 전부
PROXY_MARK_HEADERS = FORWARDING_HEADERS + TAILSCALE_IDENTITY_HEADERS + (TAILSCALE_FUNNEL_HEADER,)
# TailscaleAuth 가 보면 거부하는 머리말: Funnel 표시, Cloudflare 터널 표시.
# X-Forwarded-* 는 serve 가 붙일 수 있어(문서에 없음, 미확인) 여기에 넣지 않는다. 있든 없든 판단에 쓰지 않는다.
TAILSCALE_REFUSE_HEADERS = (TAILSCALE_FUNNEL_HEADER, "cf-connecting-ip", "cf-ray")

MAX_LOGIN_CHARS = 255  # auth_identity.subject 칼럼 길이
# 로그인 이름으로 받는 글자: 공백·쉼표 없는 ASCII 보이는 글자
_LOGIN_TEXT = re.compile(r"[\x21-\x2b\x2d-\x7e]+")

NO_TAILSCALE_USER_KO = (
    "이 Tailscale 계정은 아직 학습 계정에 이어져 있지 않습니다. 맥미니에서 연결해 주세요"
    "(태그된 기기에서는 로그인할 수 없습니다)."
)


DEV_NO_USER_KO = "먼저 계정을 고르거나 만들어 주세요(/api/dev-auth/accounts)."


class AuthAdapter(ABC):
    """요청 → 현재 계정. 없으면 None(그러면 학습 기록 API 는 401).

    API(api.py·app.py)는 수단의 구체 이름이나 provider 글자로 가르지 않고 아래 속성·메서드만 쓴다.
    새 수단(EmailOtpAuth·GoogleAuth 등)은 이 클래스를 이어받고 build_auth 에 한 줄을 더하면 된다.
    - provider: 응답의 auth_provider 값이자 auth_identity.provider 값(AUTH_PROVIDERS 이름표)
    - no_user_message_ko: 이 수단이 맡은 요청에 계정이 없을 때 401 본문의 안내 글
    - for_request: 이 요청을 맡을 수단(묶음 수단만 고른다)
    - dev_login: 개발용 로그인 주소(/api/dev-auth/*)를 이 요청에 열지. 열면 그 수단, 아니면 None(404)
    """

    provider: str = ""
    no_user_message_ko: str = "먼저 로그인해 주세요."

    def for_request(self, request: Request) -> AuthAdapter:
        """이 요청을 맡을 로그인 수단. 수단이 하나면 자기 자신(ByHostAuth 만 Host 로 고른다)."""
        return self

    def dev_login(self, request: Request) -> LocalDevAuth | None:
        """개발용 로그인 주소를 열 수단. 기본은 닫힘(LocalDevAuth 만, 이 컴퓨터 안 요청에서 연다)."""
        return None

    @abstractmethod
    def current_user_id(self, request: Request) -> str | None: ...


class NoAuth(AuthAdapter):
    """로그인 수단이 없는 상태(개발용 로그인을 끈 때). 모든 요청이 누구도 아니므로 기록 API 는 401."""

    provider = "none"
    no_user_message_ko = DEV_NO_USER_KO  # 지금 글 그대로(개발용 로그인을 켜는 것은 맥미니에서)

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
    """이 컴퓨터 안에서 프록시·터널 없이 바로 온 요청인가. 개발용 로그인의 문.

    Tailscale-User-* 머리말도 '전달된 요청' 표시로 본다. serve 만 붙이는 머리말이므로,
    만약 serve 가 Host 를 127.0.0.1 로 바꿔 넘기는 일이 있어도 tailnet 사용자가 개발용 로그인에 닿지 않게 한다.
    """
    client = request.client
    if client is None or client.host != LOOPBACK:
        return False
    if any(name in request.headers for name in PROXY_MARK_HEADERS):
        return False
    return host_allowed(request.headers.get("host"), LOCAL_HOSTNAMES)


class LocalDevAuth(AuthAdapter):
    provider = "dev_local"
    no_user_message_ko = DEV_NO_USER_KO
    COOKIE = CookieSettings().name  # 기본 쿠키 이름(설정 한 곳: config.CookieSettings). 만든 수단은 self.cookie.name
    # 브라우저 밖 도구(로컬 Jupyter 의 finish())와 약속한 머리말 이름. 배포 설정이 아니라 API 약속이라 여기 둔다
    HEADER = "x-z2h-user"

    def __init__(self, storage: StorageAdapter, *, cookie: CookieSettings | None = None):
        self.storage = storage
        self.cookie = cookie or CookieSettings()
        self.COOKIE = self.cookie.name

    # ---- 요청의 현재 계정 ----
    def allows(self, request: Request) -> bool:
        return local_only(request)

    def dev_login(self, request: Request) -> LocalDevAuth | None:
        return self if self.allows(request) else None

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
        seconds = self.cookie.max_age_seconds
        expires = to_kst_iso(datetime.now(KST) + timedelta(seconds=seconds), micro=True)
        self.storage.create_session(user_id, _hash(token), expires)
        return token, seconds

    def start_session(self, response: Response, user_id: str) -> None:
        """세션을 만들고 응답에 쿠키를 단다. 쿠키 속성은 설정(CookieSettings) 한 곳에서."""
        token, _seconds = self.login(user_id)
        response.set_cookie(**self.cookie.set_kwargs(token))

    def logout(self, request: Request) -> None:
        token = request.cookies.get(self.COOKIE)
        if token:
            self.storage.delete_session(_hash(token))

    def end_session(self, request: Request, response: Response) -> None:
        self.logout(request)
        response.delete_cookie(**self.cookie.delete_kwargs())


# ---------------- 폰 로그인 A안: Tailscale serve ----------------


def normalize_tailscale_login(value: str) -> str | None:
    """Tailscale-User-Login 값 → 소문자 로그인 이름. 이름으로 받을 수 없는 값이면 None.

    거부: 빈 값, '=?' 로 시작(RFC 2047 Q 인코딩, 풀지 않음), 공백·쉼표·ASCII 밖 글자, 255자 초과.
    """
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text or text.startswith("=?") or len(text) > MAX_LOGIN_CHARS or not _LOGIN_TEXT.fullmatch(text):
        return None
    return text.lower()


def via_tailscale_serve(request: Request, serve_host: str) -> bool:
    """조건 (a)(b): 이 컴퓨터 안(127.0.0.1)에서 접속했고, Host 머리말이 정확히 1개이며 serve 이름과 같다.

    왜 Host 가 방어선인가: serve 이름(<기기>.<tailnet>.ts.net)으로 이 서버에 닿는 길은 Tailscale serve 뿐이고,
    serve 는 들어온 Tailscale-User-* 머리말을 지우고 자기가 확인한 값만 붙인다.
    브라우저의 악성 페이지는 Host 를 바꿀 수 없고, DNS 리바인딩을 해도 Host 는 공격자 도메인 이름으로 온다.
    그래서 Host 가 127.0.0.1·localhost(또는 다른 이름)인 요청에 Tailscale 머리말이 있으면 serve 를 거치지 않은 것이므로 믿지 않는다.
    Host 를 serve 이름으로 만들어 127.0.0.1:8787 에 직접 보낼 수 있는 것은 같은 컴퓨터 안 프로그램뿐이다(남는 위험).
    """
    client = request.client
    if client is None or client.host != LOOPBACK:
        return False
    hosts = request.headers.getlist("host")
    return len(hosts) == 1 and host_allowed(hosts[0], frozenset({serve_host}))


class TailscaleAuth(AuthAdapter):
    """serve 를 거친 폰 요청 → 맥미니에서 이어 둔 계정. 자동 가입 없음, 세션·쿠키 없음."""

    provider = "tailscale"
    no_user_message_ko = NO_TAILSCALE_USER_KO

    def __init__(self, storage: StorageAdapter, serve_host: str):
        self.storage = storage
        self.serve_host = validate_tailscale_host(serve_host)

    def allows(self, request: Request) -> bool:
        return via_tailscale_serve(request, self.serve_host)

    @staticmethod
    def login_of(request: Request) -> str | None:
        """조건 (c): Tailscale-User-Login 이 정확히 1개이고 이름으로 받을 수 있는 값."""
        values = request.headers.getlist(TAILSCALE_LOGIN_HEADER)
        if len(values) != 1:
            return None  # 없음(태그된 기기·Funnel) 또는 2개 이상(serve 가 만들지 않는 모양)
        return normalize_tailscale_login(values[0])

    def current_user_id(self, request: Request) -> str | None:
        if not self.allows(request):
            return None
        if any(name in request.headers for name in TAILSCALE_REFUSE_HEADERS):
            return None  # 조건 (d): Funnel 요청이거나 Cloudflare 터널을 거친 요청
        login = self.login_of(request)
        if login is None:
            return None
        # 로그인 이름은 로그에 남기지 않는다(이메일). 못 찾으면 그냥 None(401)
        return self.storage.find_identity(self.provider, login)


class ByHostAuth(AuthAdapter):
    """Host 로 로그인 수단 하나를 고른다: routes 의 이름(지금은 serve 이름 → TailscaleAuth)이면 그 수단,
    아니면 local(개발용 로그인 LocalDevAuth 또는 NoAuth). 나중 공개 주소 → 공개용 수단도 routes 에 한 줄이면 된다."""

    provider = "by_host"

    def __init__(self, local: AuthAdapter, routes: Mapping[str, AuthAdapter]):
        self.local = local
        self.routes = dict(routes)

    def for_request(self, request: Request) -> AuthAdapter:
        # Host 가 여러 개(같은 컴퓨터 안 프로그램만 만들 수 있음)여도 하나라도 routes 이름이면 그 수단으로 보낸다.
        # TailscaleAuth 는 Host 가 1개가 아니면 거부하므로, 그런 요청은 개발용 로그인에도 Tailscale 로그인에도 닿지 않는다.
        # 공용 문(security.py)의 Origin 규칙도 같은 함수로 serve 요청을 가른다.
        hosts = request.headers.getlist("host")
        for name, adapter in self.routes.items():
            if serve_host_in(hosts, name):
                return adapter
        return self.local

    def current_user_id(self, request: Request) -> str | None:
        return self.for_request(request).current_user_id(request)


# ---- 잇기·끊기·목록 (맥미니에서 직접 실행하는 명령 전용. HTTP API 로 만들지 않는다) ----


class LinkError(ValueError):
    """잇기·끊기 실패. 글에 로그인 이름을 넣지 않는다."""


_BAD_LOGIN_KO = (
    "로그인 이름 모양이 맞지 않습니다(공백·쉼표 없는 영문 글자 255자 이하, '=?' 로 시작하는 인코딩 값은 안 됨). "
    "Tailscale 관리 화면에 보이는 로그인 이름(예: someone@example.com)을 그대로 넣어 주세요."
)


def _login_or_error(login: str) -> str:
    subject = normalize_tailscale_login(login)
    if subject is None:
        raise LinkError(_BAD_LOGIN_KO)
    return subject


def link_tailscale(storage: StorageAdapter, login: str, user_id: str) -> str:
    """로그인 이름을 계정에 잇는다. 이은 이름(소문자)을 돌려준다. 한 이름은 계정 1개에만(다시 이으면 오류)."""
    subject = _login_or_error(login)
    if storage.get_user(user_id) is None:
        raise LinkError("그런 학습 계정(user_id)이 없습니다. 맥에서 개발용 로그인으로 만든 계정의 user_id 를 넣어 주세요.")
    linked = storage.find_identity(TailscaleAuth.provider, subject)
    if linked is not None:
        raise LinkError(
            f"이 로그인 이름은 이미 계정 {linked} 에 이어져 있습니다. 바꾸려면 먼저 unlink-tailscale 로 끊어 주세요."
        )
    try:
        storage.add_identity(user_id, TailscaleAuth.provider, subject)
    except ValueError as exc:
        raise LinkError(f"{exc}. 상태를 list-tailscale 로 확인하고, 바꾸려면 먼저 unlink-tailscale 로 끊어 주세요.") from None
    return subject


def unlink_tailscale(storage: StorageAdapter, login: str) -> str:
    """잇기를 끊는다. 끊은 이름(소문자)을 돌려준다. 이어져 있지 않으면 오류."""
    subject = _login_or_error(login)
    if not storage.remove_identity(TailscaleAuth.provider, subject):
        raise LinkError("이 로그인 이름은 어느 계정에도 이어져 있지 않습니다(list-tailscale 로 확인).")
    return subject


def list_tailscale(storage: StorageAdapter) -> list[dict[str, Any]]:
    """[{subject(로그인 이름), user_id, display_name, created_at}] 이은 순서."""
    return storage.list_identities(TailscaleAuth.provider)


# ---------------- 수단 이름표와 조립(설정 → 수단, 한 곳) ----------------

# provider 이름 → 수단. 응답의 auth_provider, auth_identity.provider 칸에 쓰는 이름은 이 표에만 있다.
AUTH_PROVIDERS: dict[str, type[AuthAdapter]] = {
    cls.provider: cls for cls in (NoAuth, LocalDevAuth, TailscaleAuth, EmailOtpAuth, GoogleAuth)
}


def build_auth(settings: Settings, storage: StorageAdapter) -> AuthAdapter:
    """설정값으로 로그인 수단을 만든다. 서버가 쓰는 수단은 여기서만 정한다(app.py 는 이 함수를 부를 뿐).

    - 이 컴퓨터 안(127.0.0.1·localhost Host) 요청: 개발용 로그인. 바깥 주소 설정·Z2H_DEV_AUTH=0 이면 NoAuth(잠금 그대로)
    - Z2H_TAILSCALE_HOST: 그 Host 요청만 TailscaleAuth
    - 나중(공개 승인 뒤): 공개 주소 Host → EmailOtpAuth·GoogleAuth 를 routes 에 더하고, 공개 주소에서는 local 을 NoAuth 로.
      EmailOtpAuth·GoogleAuth 는 지금 만들 수 없다(자리만).
    설정이 없으면 조립은 지금과 같다(ByHostAuth 를 만들지 않음).
    """
    off = settings.dev_auth_off_reason
    local: AuthAdapter
    if off is not None:
        # 터널 등 바깥 주소를 허용하면 개발용 로그인을 끈다. 로그인 수단이 없으므로 기록 API 는 모두 401.
        log.warning("개발용 로그인 꺼짐: %s. 기록 API 는 로그인 수단이 없어 401 을 돌려줍니다.", off)
        local = NoAuth()
    else:
        local = LocalDevAuth(storage, cookie=settings.session_cookie)

    routes: dict[str, AuthAdapter] = {}
    if settings.tailscale_host:
        # serve 이름 Host 요청만 TailscaleAuth. 이름(tailnet)과 로그인 이름은 로그에 쓰지 않는다.
        log.warning(
            "Tailscale 로그인 켜짐(Z2H_TAILSCALE_HOST): serve 주소로 온 요청은 맥미니에서 이어 둔 계정으로만 "
            "들어옵니다(자동 가입 없음, 잇기: python -m z2h_server link-tailscale)."
        )
        routes[settings.tailscale_host] = TailscaleAuth(storage, settings.tailscale_host)
    return ByHostAuth(local, routes) if routes else local
