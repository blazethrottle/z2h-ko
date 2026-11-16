"""저장 계층 인터페이스. 지금은 SqliteAdapter, 나중에 PostgresAdapter 가 같은 약속을 지킨다.

학습 기록을 읽고 쓰는 함수는 모두 첫 인자가 user_id 다(USER_DATA_METHODS).
그 밖의 함수:
- 사용자와 무관: ping, schema_version, close
- 계정(인증 계층 AuthAdapter 전용): create_user, update_user, list_users, add_identity,
  create_session, find_session, delete_session. 세션 찾기·지우기는 세션 값으로 찾으므로 user_id 가 첫 인자가 아니다.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from typing import Any

from .. import schema


@dataclass
class SyncResult:
    applied: list[str] = field(default_factory=list)
    superseded: list[str] = field(default_factory=list)
    rejected: list[dict[str, Any]] = field(default_factory=list)  # [{op_id, reason_ko}]
    server_time: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class GradeOutcome:
    """채점 결과 저장 결과. 목록 안은 check_id."""

    applied: list[str] = field(default_factory=list)
    superseded: list[str] = field(default_factory=list)
    rejected: list[dict[str, Any]] = field(default_factory=list)  # [{check_id, reason_ko}]
    server_time: str = ""


class StorageAdapter(ABC):
    SYNC_TABLES: tuple[str, ...] = schema.SYNC_TABLES
    USER_DATA_METHODS: tuple[str, ...] = (
        "get_user",
        "update_user",
        "apply_ops",
        "get_row",
        "list_rows",
        "get_state",
        "export_all",
        "list_conflicts",
        "record_grade_results",
        "grant_badge",
        "record_share_card",
        "create_user",
        "add_identity",
        "create_session",
    )

    # ---- 사용자와 무관 ----
    @abstractmethod
    def ping(self) -> bool: ...

    @abstractmethod
    def schema_version(self) -> str | None: ...

    @abstractmethod
    def close(self) -> None: ...

    # ---- 계정 (AuthAdapter 가 쓴다) ----
    @abstractmethod
    def create_user(
        self, user_id: str, *, display_name: str | None = None, locale: str = "ko-KR", path_id: str = "full"
    ) -> dict[str, Any]: ...

    @abstractmethod
    def get_user(self, user_id: str) -> dict[str, Any] | None: ...

    @abstractmethod
    def update_user(self, user_id: str, **changes: Any) -> dict[str, Any]:
        """path_id, display_name, locale 만 바꿀 수 있다."""

    @abstractmethod
    def list_users(self, provider: str) -> list[dict[str, Any]]:
        """그 로그인 방식(provider)으로 만든 계정 목록."""

    @abstractmethod
    def add_identity(self, user_id: str, provider: str, subject: str) -> None: ...

    @abstractmethod
    def create_session(self, user_id: str, session_hash: str, expires_at: str) -> None: ...

    @abstractmethod
    def find_session(self, session_hash: str) -> str | None:
        """유효한 세션이면 user_id, 없거나 지났으면 None."""

    @abstractmethod
    def delete_session(self, session_hash: str) -> None: ...

    # ---- 동기화 ----
    @abstractmethod
    def apply_ops(self, user_id: str, client_id: str, ops: list[Any]) -> SyncResult:
        """대기열 묶음을 반영한다. 같은 op_id 는 한 번만. 잘못된 줄은 rejected 로, 나머지는 계속."""

    @abstractmethod
    def get_row(self, user_id: str, table: str, key: dict[str, Any]) -> dict[str, Any] | None: ...

    @abstractmethod
    def list_rows(self, user_id: str, table: str, since: int | None = None) -> list[dict[str, Any]]: ...

    @abstractmethod
    def get_state(self, user_id: str, since: int | None = None) -> dict[str, Any]:
        """server_seq 가 since 보다 큰 기록과 지금의 가장 큰 server_seq. since 가 없으면 전체."""

    @abstractmethod
    def export_all(self, user_id: str) -> dict[str, Any]: ...

    @abstractmethod
    def list_conflicts(self, user_id: str) -> list[dict[str, Any]]: ...

    # ---- 채점·배지·공유 카드 ----
    @abstractmethod
    def record_grade_results(
        self,
        user_id: str,
        results: list[dict[str, Any]],
        *,
        source: str,
        at: str,
        op_key: str,
    ) -> GradeOutcome:
        """[{check_id, passed, message_ko?}] 를 grade_result 에 저장(늦은 at 이 이김). 같은 op_key 는 한 번만."""

    @abstractmethod
    def grant_badge(self, user_id: str, badge_id: str, *, earned_at: str, evidence: Any = None) -> str:
        """배지 기록만 쓴다. 언제 주는지 계산하는 규칙(badge_rules)은 아직 만들지 않는다."""

    @abstractmethod
    def record_share_card(
        self,
        user_id: str,
        *,
        kind: str,
        payload: Any,
        image_path: str | None = None,
        created_at: str | None = None,
    ) -> dict[str, Any]: ...
