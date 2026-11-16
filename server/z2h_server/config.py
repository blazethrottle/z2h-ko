"""진도 서버 설정을 모아 둔 한 곳.

경로·주소·제한값은 모두 여기서 정한다. 환경변수로 바꿀 수 있는 것:

- Z2H_DB_PATH   SQLite 파일 위치(기본 server/data/z2h.sqlite3)
- Z2H_DB_URL    DB 주소 전체(나중에 Postgres로 옮길 때). 있으면 Z2H_DB_PATH보다 우선
- Z2H_APP_DIST  빌드된 앱 폴더(기본 app/dist)
- Z2H_PORT      포트(기본 8787)
- Z2H_HOST      바인드 주소. 127.0.0.1 말고는 실행을 거부한다
- Z2H_EXTRA_HOSTS, Z2H_EXTRA_ORIGINS  쉼표로 구분한 추가 허용값(기본 없음. 나중 터널 주소용)
- Z2H_DEV_AUTH  0 이면 개발용 로그인을 끈다. 허용 Host 에 127.0.0.1·localhost 가 아닌 주소가 있어도 꺼진다
"""

from __future__ import annotations

import os
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

    @property
    def allowed_hostnames(self) -> frozenset[str]:
        return frozenset(h.lower() for h in (*ALLOWED_HOSTNAMES, *self.extra_hosts))

    @property
    def allowed_origins(self) -> frozenset[str]:
        own = {f"http://{h}:{self.port}" for h in ALLOWED_HOSTNAMES}
        return frozenset({*own, *(o.lower().rstrip("/") for o in self.extra_origins)})

    @property
    def dev_auth_off_reason(self) -> str | None:
        """개발용 로그인을 꺼야 하면 그 이유, 켜도 되면 None.

        터널 등으로 바깥 주소를 허용하면 터널 프로그램이 127.0.0.1 에서 접속하므로
        접속 주소 검사만으로는 바깥 사람을 막을 수 없다. 그래서 그런 설정이 하나라도 있으면 끈다.
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
        **overrides,
    )
