"""진도 서버 설정을 모아 둔 한 곳.

주소·Origin·쿠키·DB 접근·제한값은 모두 여기서 나온다(Settings). 다른 파일에 값을 박지 않는다
(tests/test_config_and_assembly.py 가 쿠키 이름, 127.0.0.1, localhost, 8787, DB 파일 이름이 이 파일 밖에 없는지 본다).

환경변수로 바꿀 수 있는 것:

- Z2H_DB_PATH   SQLite 파일 위치(기본 server/data/z2h.sqlite3)
- Z2H_DB_URL    DB 주소 전체(나중에 Postgres로 옮길 때). 있으면 Z2H_DB_PATH보다 우선
- Z2H_APP_DIST  빌드된 앱 폴더(기본 app/dist)
- Z2H_PORT      포트(기본 8787)
- Z2H_HOST      바인드 주소. 127.0.0.1 말고는 실행을 거부한다
- Z2H_EXTRA_HOSTS, Z2H_EXTRA_ORIGINS  쉼표로 구분한 추가 허용값(기본 없음. 나중 터널 주소용)
- Z2H_DEV_AUTH  0 이면 개발용 로그인을 끈다. 허용 Host 에 127.0.0.1·localhost 가 아닌 주소가 있어도 꺼진다
- Z2H_TAILSCALE_HOST  폰 로그인(TailscaleAuth)을 켠다. 값은 '<기기>.<tailnet>.ts.net' 이름 1개(스킴·포트·쉼표 없이).
                      그 이름이 허용 Host 에 자동으로 들어간다. Origin 은 Host 와 묶는다: serve 이름 Host 의 쓰기는
                      Origin 이 정확히 https://<그 이름> 일 때만, 로컬 Host 의 쓰기는 그 Origin 을 받지 않는다.
                      이 이름은 개발용 로그인을 끄는 '바깥 주소'로 치지 않는다. 비우거나 없으면 지금과 똑같다
- Z2H_SESSION_DAYS     로그인 쿠키 유지 일수(기본 30, 1~400)
- Z2H_COOKIE_SECURE    1 이면 쿠키에 Secure(https 에서만 보냄). 기본 0
- Z2H_COOKIE_SAMESITE  strict(기본) 또는 lax. none 은 받지 않는다
값이 틀리면 ConfigRefused 로 서버를 켜지 않는다(python -m z2h_server 종료 코드 2).

설정으로 풀 수 없는 불변식(공개 전환 뒤에도 그대로. 공개는 '앞에 프록시를 두고 서버는 127.0.0.1' 전제)
- 바인드 주소는 127.0.0.1 만(BIND_HOST). 0.0.0.0 등은 실행 거부
- 접속한 쪽 주소를 머리말로 바꾸지 않는다(uvicorn proxy_headers 끔)
- 개발용 로그인은 LOOPBACK 에서, LOCAL_HOSTNAMES Host 로, 전달 머리말 없이 온 요청만(auth.local_only)
- 세션 쿠키는 늘 HttpOnly, SameSite=None 금지
- DB 오류 글에 SQL 값을 싣지 않는다(DB_HIDE_PARAMETERS)
"""

from __future__ import annotations

import os
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

SERVER_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SERVER_DIR.parent

DEFAULT_DB_PATH = SERVER_DIR / "data" / "z2h.sqlite3"
DEFAULT_APP_DIST = REPO_ROOT / "app" / "dist"
ALEMBIC_INI = SERVER_DIR / "alembic.ini"
ALEMBIC_DIR = SERVER_DIR / "alembic"

# ---- 불변식: 설정 칸이 없다 ----
BIND_HOST = "127.0.0.1"
LOOPBACK = BIND_HOST  # 접속한 쪽·받은 쪽이 이 주소여야 한다(security.GuardMiddleware, auth.local_only)
LOCAL_HOSTNAMES = frozenset({BIND_HOST, "localhost"})  # 개발용 로그인이 받는 Host 이름
TRUST_PROXY_HEADERS = False  # uvicorn proxy_headers. 켜면 머리말로 접속 주소를 속일 수 있다
DB_HIDE_PARAMETERS = True  # SQLAlchemy hide_parameters. 오류 기록에 로그인 이름·학습 기록이 남지 않게

# ---- 기본값 ----
DEFAULT_PORT = 8787
MAX_BODY_BYTES = 1024 * 1024  # 본문 1MB 제한
DB_TIMEOUT_SECONDS = 30.0  # DB 잠금을 기다리는 시간(SQLite busy timeout)
LOG_LEVEL = "info"

# 계정은 AuthAdapter(auth.py)가 요청마다 정한다. 서버 코드에 고정 user_id 를 두지 않는다(D43).
DEV_SESSION_DAYS = 30  # 로그인 쿠키 유지 기간(지금은 개발용 로그인만 쿠키를 쓴다)
SESSION_COOKIE_NAME = "z2h_dev_session"
SAMESITE_CHOICES = ("strict", "lax")  # none 은 다른 사이트 요청에도 쿠키가 붙어 받지 않는다
MAX_COOKIE_DAYS = 400  # 브라우저가 받는 Max-Age 상한(400일)

ALLOWED_HOSTNAMES = tuple(sorted(LOCAL_HOSTNAMES))  # 공용 문이 기본으로 받는 Host(이 컴퓨터 안 이름)


class ConfigRefused(ValueError):
    """설정값이 틀려 서버를 켜지 않을 때(종료 코드 2). 하위: BindRefused, TailscaleHostRefused."""


class BindRefused(ConfigRefused):
    """127.0.0.1 이 아닌 주소로 띄우려 할 때."""


def validate_bind_host(host: object) -> str:
    """바인드 주소 검사. 정확히 '127.0.0.1' 만 통과한다(0.0.0.0, ::, 빈 값, localhost 모두 거부)."""
    if host != BIND_HOST:
        raise BindRefused(
            f"서버는 {BIND_HOST} 에만 띄울 수 있습니다. 받은 값: {host!r}. "
            "다른 주소(0.0.0.0, ::, 빈 값 등)는 외부 공개가 될 수 있어 실행하지 않습니다."
        )
    return BIND_HOST


class TailscaleHostRefused(ConfigRefused):
    """Z2H_TAILSCALE_HOST 값이 '<기기>.<tailnet>.ts.net' 이름 1개가 아닐 때. 서버를 켜지 않는다."""


_DNS_LABEL = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
# Tailscale MagicDNS 이름: 기기 이름 + tailnet 이름 + ts.net (예: macmini.example-tailnet.ts.net)
_TAILSCALE_HOST = re.compile(rf"{_DNS_LABEL}\.{_DNS_LABEL}\.ts\.net")


def validate_tailscale_host(value: object) -> str:
    """serve 이름 검사. 통과하면 소문자로 맞춘 이름을 돌려준다.

    받는 것: '<기기>.<tailnet>.ts.net' 하나. 거부: 스킴(https://), 포트(:443), 경로(/), 쉼표 목록, 앞뒤 공백,
    끝 점, 별표, IP 주소, ASCII 밖 글자, ts.net 이 아닌 이름. 받은 값은 오류 글에 넣지 않는다(tailnet 이름이 로그에 남지 않게).
    """
    if not isinstance(value, str) or not value.isascii() or not _TAILSCALE_HOST.fullmatch(value.lower()):
        raise TailscaleHostRefused(
            "Z2H_TAILSCALE_HOST 는 '<기기>.<tailnet>.ts.net' 모양의 이름 1개만 받습니다"
            "(https:// 같은 스킴, :443 같은 포트, 쉼표, 공백 없이). 받은 값의 모양이 맞지 않아 실행하지 않습니다."
        )
    return value.lower()


def sqlite_url(path: Path | str) -> str:
    return f"sqlite:///{Path(path).resolve()}"


def _split_list(value: str | None) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(part.strip() for part in value.split(",") if part.strip())


_COOKIE_NAME = re.compile(r"[A-Za-z0-9_-]{1,64}")
_COOKIE_PATH = re.compile(r"/[A-Za-z0-9/_.-]*")
_COOKIE_DOMAIN = re.compile(r"[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?")


@dataclass(frozen=True)
class CookieSettings:
    """로그인 세션 쿠키 한 곳. 기본값 = 지금 동작(HttpOnly, SameSite=Strict, Path=/, Domain 없음, Secure 없음, 30일).

    HttpOnly 는 칸이 없다(늘 켬, 불변식). SameSite 는 strict·lax 만(none 금지).
    """

    name: str = SESSION_COOKIE_NAME
    days: int = DEV_SESSION_DAYS
    secure: bool = False
    samesite: str = "strict"
    path: str = "/"
    domain: str | None = None  # None = 이 주소에만(하위 도메인에 안 붙음)

    def __post_init__(self) -> None:
        if not isinstance(self.name, str) or not _COOKIE_NAME.fullmatch(self.name):
            raise ConfigRefused("쿠키 이름은 영문·숫자·_- 1~64자여야 합니다.")
        if isinstance(self.days, bool) or not isinstance(self.days, int) or not 1 <= self.days <= MAX_COOKIE_DAYS:
            raise ConfigRefused(f"쿠키 유지 일수(Z2H_SESSION_DAYS)는 1~{MAX_COOKIE_DAYS} 사이 정수여야 합니다.")
        if not isinstance(self.secure, bool):
            raise ConfigRefused("쿠키 Secure 는 참/거짓이어야 합니다.")
        if self.samesite not in SAMESITE_CHOICES:
            raise ConfigRefused(f"쿠키 SameSite(Z2H_COOKIE_SAMESITE)는 {'·'.join(SAMESITE_CHOICES)} 중 하나여야 합니다.")
        if not isinstance(self.path, str) or not _COOKIE_PATH.fullmatch(self.path):
            raise ConfigRefused("쿠키 Path 는 / 로 시작하는 경로여야 합니다.")
        if self.domain is not None and (not isinstance(self.domain, str) or not _COOKIE_DOMAIN.fullmatch(self.domain)):
            raise ConfigRefused("쿠키 Domain 은 소문자 도메인 이름이어야 합니다(없으면 이 주소에만).")

    @property
    def max_age_seconds(self) -> int:
        return self.days * 24 * 3600

    def set_kwargs(self, value: str) -> dict[str, Any]:
        """Response.set_cookie 에 넘길 값 전부."""
        return {
            "key": self.name,
            "value": value,
            "max_age": self.max_age_seconds,
            "path": self.path,
            "domain": self.domain,
            "secure": self.secure,
            "httponly": True,  # 불변식: 화면 스크립트가 세션 값을 읽지 못하게
            "samesite": self.samesite,
        }

    def delete_kwargs(self) -> dict[str, Any]:
        """Response.delete_cookie 에 넘길 값. 지울 때는 이름·Path·Domain(·Secure)만 맞으면 된다(나머지는 기존 그대로)."""
        return {"key": self.name, "path": self.path, "domain": self.domain, "secure": self.secure}


def _env_bool(env: Mapping[str, str], name: str, default: bool) -> bool:
    raw = env.get(name)
    if raw is None or raw.strip() == "":
        return default
    value = raw.strip().lower()
    if value in ("1", "true", "on", "yes"):
        return True
    if value in ("0", "false", "off", "no"):
        return False
    raise ConfigRefused(f"{name} 는 1 또는 0 이어야 합니다.")


def _env_int(env: Mapping[str, str], name: str, default: int) -> int:
    raw = env.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw.strip())
    except ValueError:
        raise ConfigRefused(f"{name} 는 정수여야 합니다.") from None


def cookie_from_env(env: Mapping[str, str]) -> CookieSettings:
    samesite = env.get("Z2H_COOKIE_SAMESITE")
    return CookieSettings(
        days=_env_int(env, "Z2H_SESSION_DAYS", DEV_SESSION_DAYS),
        secure=_env_bool(env, "Z2H_COOKIE_SECURE", False),
        samesite=samesite.strip().lower() if samesite and samesite.strip() else "strict",
    )


@dataclass(frozen=True)
class Settings:
    db_url: str = field(default_factory=lambda: sqlite_url(DEFAULT_DB_PATH))
    db_timeout_seconds: float = DB_TIMEOUT_SECONDS
    app_dist: Path = DEFAULT_APP_DIST
    host: str = BIND_HOST
    port: int = DEFAULT_PORT
    log_level: str = LOG_LEVEL
    session_cookie: CookieSettings = field(default_factory=CookieSettings)
    max_body_bytes: int = MAX_BODY_BYTES
    extra_hosts: tuple[str, ...] = ()
    extra_origins: tuple[str, ...] = ()
    require_loopback_peer: bool = True
    auto_migrate: bool = True
    dev_auth: bool = True  # 개발용 로그인(LocalDevAuth). 끄는 조건은 dev_auth_off_reason
    tailscale_host: str | None = None  # Z2H_TAILSCALE_HOST. None 이면 폰 로그인(TailscaleAuth) 없음

    def __post_init__(self) -> None:
        # 어떤 길로 만든 설정이든(load_settings, Settings(...), dataclasses.replace) 같은 검사를 지난다
        if self.tailscale_host is not None:
            object.__setattr__(self, "tailscale_host", validate_tailscale_host(self.tailscale_host))

    @property
    def base_url(self) -> str:
        """이 서버를 여는 기준 주소(안내 글에 쓴다). 지금은 http://127.0.0.1:<포트>. 공개 때 바꿀 곳(README 7절)."""
        return f"http://{self.host}:{self.port}"

    def server_options(self) -> dict[str, Any]:
        """uvicorn.run 에 넘길 값. 바인드는 늘 127.0.0.1, 접속 주소 머리말은 믿지 않는다(불변식)."""
        return {
            "host": validate_bind_host(self.host),
            "port": self.port,
            "proxy_headers": TRUST_PROXY_HEADERS,
            "server_header": False,
            "log_level": self.log_level,
        }

    @property
    def allowed_hostnames(self) -> frozenset[str]:
        serve = (self.tailscale_host,) if self.tailscale_host else ()
        return frozenset(h.lower() for h in (*ALLOWED_HOSTNAMES, *self.extra_hosts, *serve))

    @property
    def allowed_origins(self) -> frozenset[str]:
        """Host 가 serve 이름이 아닌(로컬) 요청의 쓰기에 받는 Origin. serve Origin 은 여기에 들어가지 않는다."""
        own = {f"http://{h}:{self.port}" for h in ALLOWED_HOSTNAMES}
        return frozenset({*own, *(o.lower().rstrip("/") for o in self.extra_origins)} - {self.serve_origin})

    @property
    def serve_origin(self) -> str | None:
        """Host 가 serve 이름인 요청의 쓰기에 받는 유일한 Origin(serve 는 https 기본 포트 443). 설정이 없으면 None."""
        return f"https://{self.tailscale_host}" if self.tailscale_host else None

    @property
    def dev_auth_off_reason(self) -> str | None:
        """개발용 로그인을 꺼야 하면 그 이유, 켜도 되면 None.

        터널 등으로 바깥 주소를 허용하면 터널 프로그램이 127.0.0.1 에서 접속하므로
        접속 주소 검사만으로는 바깥 사람을 막을 수 없다. 그래서 그런 설정이 하나라도 있으면 끈다.
        Z2H_TAILSCALE_HOST 로 들어온 이름만 예외다(extra_hosts 가 아니라 tailscale_host 칸이라 여기서 세지 않는다).
        그 이름으로 온 요청은 개발용 로그인에 닿지 않고 TailscaleAuth 만 보기 때문이다(auth.ByHostAuth).
        같은 이름을 Z2H_EXTRA_HOSTS 에도 넣으면 그것은 바깥 주소로 세어 지금처럼 끈다.
        """
        if not self.dev_auth:
            return "설정으로 끔(Z2H_DEV_AUTH=0)"
        outside = [h for h in self.extra_hosts if h.strip().lower() not in LOCAL_HOSTNAMES]
        if outside:
            return f"{'·'.join(ALLOWED_HOSTNAMES)} 가 아닌 허용 주소가 있음({', '.join(outside)})"
        return None


def load_settings(env: Mapping[str, str] | None = None, **overrides) -> Settings:
    """환경변수(+ 명령줄 값)로 설정을 만든다. 바인드 주소는 여기서 바로 검사한다."""
    env = os.environ if env is None else env
    host = overrides.pop("host", None)
    if host is None:
        host = env.get("Z2H_HOST", BIND_HOST)
    validate_bind_host(host)

    port = overrides.pop("port", None)
    if port is None:
        port = _env_int(env, "Z2H_PORT", DEFAULT_PORT)

    if env.get("Z2H_DB_URL"):
        db_url = env["Z2H_DB_URL"]
    else:
        db_url = sqlite_url(env.get("Z2H_DB_PATH") or DEFAULT_DB_PATH)

    app_dist = Path(env.get("Z2H_APP_DIST") or DEFAULT_APP_DIST)

    return Settings(
        db_url=db_url,
        app_dist=app_dist,
        host=host,
        port=int(port),
        extra_hosts=_split_list(env.get("Z2H_EXTRA_HOSTS")),
        extra_origins=_split_list(env.get("Z2H_EXTRA_ORIGINS")),
        dev_auth=env.get("Z2H_DEV_AUTH", "1").strip().lower() not in ("0", "false", "off", "no"),
        # 빈 값은 설정 없음. 그 밖의 값은 Settings 가 검사한다(틀리면 TailscaleHostRefused)
        tailscale_host=overrides.pop("tailscale_host", None) or env.get("Z2H_TAILSCALE_HOST") or None,
        session_cookie=overrides.pop("session_cookie", None) or cookie_from_env(env),
        **overrides,
    )
