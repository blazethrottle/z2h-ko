"""진도 서버 설정을 모아 둔 한 곳.

경로·주소·제한값은 모두 여기서 정한다. 환경변수로 바꿀 수 있는 것:

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
"""

from __future__ import annotations

import os
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SERVER_DIR.parent

DEFAULT_DB_PATH = SERVER_DIR / "data" / "z2h.sqlite3"
DEFAULT_APP_DIST = REPO_ROOT / "app" / "dist"
ALEMBIC_INI = SERVER_DIR / "alembic.ini"
ALEMBIC_DIR = SERVER_DIR / "alembic"

BIND_HOST = "127.0.0.1"
DEFAULT_PORT = 8787
MAX_BODY_BYTES = 1024 * 1024  # 본문 1MB 제한

# 계정은 AuthAdapter(auth.py)가 요청마다 정한다. 서버 코드에 고정 user_id 를 두지 않는다(D43).
DEV_SESSION_DAYS = 30  # 로컬 개발 로그인 쿠키 유지 기간

ALLOWED_HOSTNAMES = ("127.0.0.1", "localhost")


class BindRefused(ValueError):
    """127.0.0.1 이 아닌 주소로 띄우려 할 때."""


def validate_bind_host(host: object) -> str:
    """바인드 주소 검사. 정확히 '127.0.0.1' 만 통과한다(0.0.0.0, ::, 빈 값, localhost 모두 거부)."""
    if host != BIND_HOST:
        raise BindRefused(
            f"서버는 {BIND_HOST} 에만 띄울 수 있습니다. 받은 값: {host!r}. "
            "다른 주소(0.0.0.0, ::, 빈 값 등)는 외부 공개가 될 수 있어 실행하지 않습니다."
        )
    return BIND_HOST


class TailscaleHostRefused(ValueError):
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


@dataclass(frozen=True)
class Settings:
    db_url: str = field(default_factory=lambda: sqlite_url(DEFAULT_DB_PATH))
    app_dist: Path = DEFAULT_APP_DIST
    host: str = BIND_HOST
    port: int = DEFAULT_PORT
    dev_session_days: int = DEV_SESSION_DAYS
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
        outside = [h for h in self.extra_hosts if h.strip().lower() not in ALLOWED_HOSTNAMES]
        if outside:
            return f"127.0.0.1·localhost 가 아닌 허용 주소가 있음({', '.join(outside)})"
        return None

    @property
    def sqlite_path(self) -> Path | None:
        prefix = "sqlite:///"
        if self.db_url.startswith(prefix) and len(self.db_url) > len(prefix):
            return Path(self.db_url[len(prefix) :])
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
        port = int(env.get("Z2H_PORT", DEFAULT_PORT))

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
        **overrides,
    )
