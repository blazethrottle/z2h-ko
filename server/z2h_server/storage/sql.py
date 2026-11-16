"""SQLAlchemy Core 표준 SQL만 쓰는 공통 어댑터. SQLite 전용 구문을 쓰지 않는다.

- upsert 는 '조회 → insert 또는 update' 로 어댑터에서 처리한다(SQLite 전용 덮어쓰기 구문을 쓰지 않음).
- 기록이 바뀔 때마다 sync_counter 의 번호를 1 올려 그 행의 server_seq 에 넣는다(12.5절).
- 쌓이는 기록의 attempt_no 는 같은 묶음(예: 같은 question_id) 안에서 도착 순서로 서버가 매긴다.
- 한 프로세스 안의 쓰기는 잠금 하나로 줄 세운다(SQLite 한 파일. Postgres 로 옮기면 다시 볼 곳).
"""

from __future__ import annotations

import hashlib
import json
import secrets
import threading
from datetime import datetime, timedelta
from typing import Any

import sqlalchemy as sa

from .. import migrate, schema, sync
from ..timeutil import KST, now_kst, parse_time, to_kst_iso
from .base import GradeOutcome, StorageAdapter, SyncResult

_CLIENT_ID_MAX = 64
_USER_EDITABLE = {"path_id", "display_name", "locale"}


def _dump_json(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _load_json(text: str | None) -> Any:
    if text is None:
        return None
    return json.loads(text)


def _op_id(prefix: str, *parts: str) -> str:
    """서버가 만드는 op_id. 계정이 달라도 겹치지 않게 user_id 를 섞어 해시한다."""
    return f"{prefix}:" + hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:40]


class SqlAdapter(StorageAdapter):
    def __init__(self, engine: sa.Engine):
        self.engine = engine
        self._lock = threading.RLock()
        self._last_time: datetime | None = None

    # ---------- 공통 도우미 ----------

    def _now(self) -> str:
        """서버 시각(마이크로초). 같은 프로세스 안에서는 늘 앞으로만 간다."""
        with self._lock:
            now = datetime.now(KST)
            if self._last_time is not None and now <= self._last_time:
                now = self._last_time + timedelta(microseconds=1)
            self._last_time = now
            return to_kst_iso(now, micro=True)

    @staticmethod
    def _next_seq(conn: sa.Connection) -> int:
        c = schema.sync_counter
        conn.execute(sa.update(c).where(c.c.name == "server_seq").values(value=c.c.value + 1))
        return conn.execute(sa.select(c.c.value).where(c.c.name == "server_seq")).scalar_one()

    @staticmethod
    def _current_seq(conn: sa.Connection) -> int:
        c = schema.sync_counter
        return conn.execute(sa.select(c.c.value).where(c.c.name == "server_seq")).scalar_one()

    @staticmethod
    def _rule(table: str) -> sync.TableRule:
        rule = sync.RULES.get(table)
        if rule is None:
            raise KeyError(f"동기화 표가 아님: {table}")
        return rule

    @staticmethod
    def _where_key(rule: sync.TableRule, user_id: str, key: dict[str, Any]):
        t = rule.table
        conds = [t.c.user_id == user_id]
        conds += [t.c[k] == v for k, v in key.items()]
        return sa.and_(*conds)

    @staticmethod
    def _from_db(rule: sync.TableRule, row: sa.RowMapping) -> dict[str, Any]:
        out = dict(row)
        for col in rule.json_columns:
            out[col] = _load_json(out.get(col))
        return out

    @staticmethod
    def _to_db(rule: sync.TableRule, values: dict[str, Any]) -> dict[str, Any]:
        out = dict(values)
        for col in rule.json_columns:
            if col in out:
                out[col] = _dump_json(out[col])
        return out

    @staticmethod
    def _to_api(rule: sync.TableRule, row: dict[str, Any]) -> dict[str, Any]:
        out: dict[str, Any] = {k: row[k] for k in rule.key}
        if rule.numbered_by is not None:
            out["attempt_no"] = row.get("attempt_no")
        for col, fr in rule.fields.items():
            out[fr.api] = row.get(col)
        out["updated_at"] = row.get("updated_at")
        out["server_seq"] = row.get("server_seq")
        return out

    def _select_row(self, conn: sa.Connection, rule: sync.TableRule, user_id: str, key: dict[str, Any]):
        row = conn.execute(sa.select(rule.table).where(self._where_key(rule, user_id, key))).mappings().first()
        return None if row is None else self._from_db(rule, row)

    def _next_attempt_no(self, conn: sa.Connection, rule: sync.TableRule, user_id: str, key: dict[str, Any]) -> int:
        t = rule.table
        conds = [t.c.user_id == user_id] + [t.c[g] == key[g] for g in (rule.numbered_by or ())]
        current = conn.execute(sa.select(sa.func.max(t.c.attempt_no)).where(*conds)).scalar_one_or_none()
        return (current or 0) + 1

    def _checkpoint_no(self, conn: sa.Connection, user_id: str, checkpoint_attempt_id: str | None) -> int | None:
        if checkpoint_attempt_id is None:
            return None
        cp = schema.checkpoint_attempt
        return conn.execute(
            sa.select(cp.c.attempt_no).where(cp.c.user_id == user_id, cp.c.attempt_id == checkpoint_attempt_id)
        ).scalars().first()

    # ---------- 사용자와 무관 ----------

    def ping(self) -> bool:
        with self.engine.connect() as conn:
            return conn.execute(sa.select(sa.literal(1))).scalar_one() == 1

    def schema_version(self) -> str | None:
        with self.engine.connect() as conn:
            return migrate.current_revision(conn)

    def close(self) -> None:
        self.engine.dispose()

    # ---------- 계정 ----------

    def create_user(
        self, user_id: str, *, display_name: str | None = None, locale: str = "ko-KR", path_id: str = "full"
    ) -> dict[str, Any]:
        self._check_user_values({"display_name": display_name, "locale": locale, "path_id": path_id})
        with self._lock, self.engine.begin() as conn:
            conn.execute(
                sa.insert(schema.users).values(
                    user_id=user_id, display_name=display_name, locale=locale, path_id=path_id, created_at=self._now()
                )
            )
        user = self.get_user(user_id)
        assert user is not None
        return user

    def get_user(self, user_id: str) -> dict[str, Any] | None:
        users = schema.users
        with self.engine.connect() as conn:
            row = conn.execute(sa.select(users).where(users.c.user_id == user_id)).mappings().first()
        return None if row is None else dict(row)

    @staticmethod
    def _check_user_values(values: dict[str, Any]) -> None:
        unknown = set(values) - _USER_EDITABLE
        if unknown:
            raise ValueError(f"바꿀 수 없는 칸: {', '.join(sorted(unknown))}")
        if "path_id" in values and values["path_id"] not in schema.PATH_IDS:
            raise ValueError(f"path_id 는 {', '.join(schema.PATH_IDS)} 중 하나여야 합니다")
        name = values.get("display_name")
        if name is not None and (not isinstance(name, str) or len(name) > 100):
            raise ValueError("display_name 은 100자 이하 글자여야 합니다")
        locale = values.get("locale")
        if locale is not None and (not isinstance(locale, str) or len(locale) > 16):
            raise ValueError("locale 은 16자 이하 글자여야 합니다")

    def update_user(self, user_id: str, **changes: Any) -> dict[str, Any]:
        self._check_user_values(changes)
        users = schema.users
        with self._lock, self.engine.begin() as conn:
            if changes:
                conn.execute(sa.update(users).where(users.c.user_id == user_id).values(**changes))
        user = self.get_user(user_id)
        if user is None:
            raise KeyError(user_id)
        return user

    def list_users(self, provider: str) -> list[dict[str, Any]]:
        u, a = schema.users, schema.auth_identity
        stmt = (
            sa.select(u)
            .select_from(u.join(a, a.c.user_id == u.c.user_id))
            .where(a.c.provider == provider)
            .order_by(u.c.created_at, u.c.user_id)
        )
        with self.engine.connect() as conn:
            return [dict(r) for r in conn.execute(stmt).mappings()]

    def add_identity(self, user_id: str, provider: str, subject: str) -> None:
        with self._lock, self.engine.begin() as conn:
            conn.execute(
                sa.insert(schema.auth_identity).values(
                    provider=provider, subject=subject, user_id=user_id, created_at=self._now()
                )
            )

    def create_session(self, user_id: str, session_hash: str, expires_at: str) -> None:
        with self._lock, self.engine.begin() as conn:
            conn.execute(
                sa.insert(schema.sessions).values(
                    session_id=session_hash, user_id=user_id, created_at=self._now(), expires_at=expires_at
                )
            )

    def find_session(self, session_hash: str) -> str | None:
        s = schema.sessions
        with self.engine.connect() as conn:
            row = conn.execute(sa.select(s.c.user_id, s.c.expires_at).where(s.c.session_id == session_hash)).first()
        if row is None or parse_time(row.expires_at) <= parse_time(now_kst()):
            return None
        return row.user_id

    def delete_session(self, session_hash: str) -> None:
        s = schema.sessions
        with self._lock, self.engine.begin() as conn:
            conn.execute(sa.delete(s).where(s.c.session_id == session_hash))

    # ---------- 동기화 ----------

    def apply_ops(self, user_id: str, client_id: str, ops: list[Any]) -> SyncResult:
        if not isinstance(client_id, str) or not (1 <= len(client_id) <= _CLIENT_ID_MAX):
            raise ValueError("client_id 는 1~64자 글자여야 합니다")
        result = SyncResult()
        for raw in ops:
            op_id = raw.get("op_id") if isinstance(raw, dict) else None
            outcome, reason = self._apply_one(user_id, client_id, raw)
            if outcome == "rejected":
                result.rejected.append({"op_id": op_id, "reason_ko": reason})
            elif outcome == "superseded":
                result.superseded.append(op_id)
            else:
                result.applied.append(op_id)
        result.server_time = self._now()
        return result

    def _apply_one(self, user_id: str, client_id: str, raw: Any) -> tuple[str, str | None]:
        try:
            op = sync.validate_op(raw, user_id)
        except sync.OpRejected as exc:
            return "rejected", exc.reason_ko
        rule = op.rule
        ops_t = schema.applied_ops
        try:
            with self._lock, self.engine.begin() as conn:
                prev = conn.execute(
                    sa.select(ops_t.c.user_id, ops_t.c.outcome).where(ops_t.c.op_id == op.op_id)
                ).first()
                if prev is not None:
                    if prev.user_id != user_id:
                        return "rejected", "이 op_id 는 다른 계정에서 이미 쓰였습니다. 새 op_id 로 보내 주세요"
                    return prev.outcome, None  # 같은 op_id: 처음 결과를 그대로

                existing = self._select_row(conn, rule, user_id, op.key)
                decision = sync.decide(op, existing, client_id)
                now = self._now()
                seq = None
                if decision.action == "insert":
                    seq = self._next_seq(conn)
                    values = dict(decision.row)
                    if rule.numbered_by is not None:
                        values["attempt_no"] = self._next_attempt_no(conn, rule, user_id, op.key)
                    if rule.name == "question_attempt":
                        no = self._checkpoint_no(conn, user_id, values.get("checkpoint_attempt_id"))
                        if no is not None:
                            values["checkpoint_attempt_no"] = no
                    values = self._to_db(rule, values)
                    values.update(user_id=user_id, server_seq=seq)
                    conn.execute(sa.insert(rule.table).values(**values))
                    if rule.name == "checkpoint_attempt":
                        self._link_checkpoint_questions(conn, user_id, op.key["attempt_id"], values["attempt_no"], seq)
                elif decision.action == "update":
                    changed = dict(decision.changed)
                    if rule.name == "question_attempt" and "checkpoint_attempt_id" in changed:
                        no = self._checkpoint_no(conn, user_id, changed["checkpoint_attempt_id"])
                        if no is not None:
                            changed["checkpoint_attempt_no"] = no
                    seq = self._next_seq(conn)
                    values = self._to_db(rule, changed)
                    values["server_seq"] = seq
                    conn.execute(
                        sa.update(rule.table).where(self._where_key(rule, user_id, op.key)).values(**values)
                    )
                if decision.conflict is not None:
                    conn.execute(
                        sa.insert(schema.sync_conflicts).values(
                            user_id=user_id,
                            table_name=rule.name,
                            row_key=_dump_json(op.key),
                            losing_json=_dump_json(decision.conflict),
                            at=now,
                        )
                    )
                conn.execute(
                    sa.insert(ops_t).values(
                        op_id=op.op_id,
                        user_id=user_id,
                        client_id=client_id,
                        table_name=rule.name,
                        outcome=decision.outcome,
                        at=now,
                    )
                )
                return decision.outcome, None
        except sync.OpRejected as exc:
            return "rejected", exc.reason_ko
        except sa.exc.IntegrityError:
            return "rejected", "저장할 수 없습니다: 없는 계정이거나 열쇠가 다른 기록과 겹칩니다(예: 다른 계정의 share_id)"

    def _link_checkpoint_questions(
        self, conn: sa.Connection, user_id: str, cp_attempt_id: str, cp_no: int, seq: int
    ) -> None:
        """누적 점검 시도가 늦게 도착해도, 먼저 와 있던 문항 응답에 시도 번호를 채운다."""
        q = schema.question_attempt
        conn.execute(
            sa.update(q)
            .where(
                q.c.user_id == user_id,
                q.c.checkpoint_attempt_id == cp_attempt_id,
                sa.or_(q.c.checkpoint_attempt_no.is_(None), q.c.checkpoint_attempt_no != cp_no),
            )
            .values(checkpoint_attempt_no=cp_no, server_seq=seq)
        )

    def get_row(self, user_id: str, table: str, key: dict[str, Any]) -> dict[str, Any] | None:
        rule = self._rule(table)
        key = sync.validate_key(rule, key)
        with self.engine.connect() as conn:
            row = self._select_row(conn, rule, user_id, key)
        return None if row is None else self._to_api(rule, row)

    def _list(self, conn: sa.Connection, rule: sync.TableRule, user_id: str, since: int | None):
        t = rule.table
        stmt = sa.select(t).where(t.c.user_id == user_id)
        if since is not None:
            stmt = stmt.where(t.c.server_seq > since)
        stmt = stmt.order_by(t.c.server_seq, *[t.c[k] for k in rule.key])
        return [self._to_api(rule, self._from_db(rule, r)) for r in conn.execute(stmt).mappings()]

    @staticmethod
    def _since(since: Any) -> int | None:
        if since is None:
            return None
        if isinstance(since, bool) or not isinstance(since, int) or since < 0:
            raise ValueError("since 는 0 이상의 정수(server_seq)여야 합니다")
        return since

    def list_rows(self, user_id: str, table: str, since: int | None = None) -> list[dict[str, Any]]:
        rule = self._rule(table)
        since = self._since(since)
        with self.engine.connect() as conn:
            return self._list(conn, rule, user_id, since)

    def get_state(self, user_id: str, since: int | None = None) -> dict[str, Any]:
        since = self._since(since)
        # 잠금 안에서 번호를 먼저 읽고 행을 읽는다. 다음 since 로 이 번호를 쓰면 빠지는 기록이 없다.
        with self._lock:
            with self.engine.connect() as conn:
                seq = self._current_seq(conn)
                tables = {name: self._list(conn, sync.RULES[name], user_id, since) for name in self.SYNC_TABLES}
                version = migrate.current_revision(conn)
            server_time = self._now()
        user = self.get_user(user_id)
        return {
            "user": None if user is None else {k: user[k] for k in ("user_id", "display_name", "path_id", "locale")},
            "since": since,
            "server_seq": seq,
            "server_time": server_time,
            "schema_version": version,
            "tables": tables,
        }

    def list_conflicts(self, user_id: str) -> list[dict[str, Any]]:
        t = schema.sync_conflicts
        with self.engine.connect() as conn:
            rows = conn.execute(sa.select(t).where(t.c.user_id == user_id).order_by(t.c.conflict_id)).mappings()
            return [
                {
                    "conflict_id": r["conflict_id"],
                    "table_name": r["table_name"],
                    "row_key": _load_json(r["row_key"]),
                    "losing": _load_json(r["losing_json"]),
                    "at": r["at"],
                }
                for r in rows
            ]

    def export_all(self, user_id: str) -> dict[str, Any]:
        state = self.get_state(user_id)
        tables = dict(state["tables"])
        tables["sync_conflicts"] = self.list_conflicts(user_id)
        return {
            "format": "z2h-backup",
            "format_version": 1,
            "exported_at": state["server_time"],
            "schema_version": state["schema_version"],
            "server_seq": state["server_seq"],
            "user_id": user_id,
            "user": self.get_user(user_id),
            "tables": tables,
        }

    # ---------- 채점·배지·공유 카드 ----------

    def record_grade_results(
        self,
        user_id: str,
        results: list[dict[str, Any]],
        *,
        source: str,
        at: str,
        op_key: str,
    ) -> GradeOutcome:
        ops = []
        by_op: dict[str, str] = {}
        for item in results:
            check_id = item["check_id"]
            op_id = _op_id("grade", user_id, source, op_key, check_id)
            by_op[op_id] = check_id
            ops.append(
                {
                    "op_id": op_id,
                    "table": "grade_result",
                    "key": {"check_id": check_id},
                    "data": {
                        "passed": item["passed"],
                        "message_ko": item.get("message_ko"),
                        "source": source,
                        "at": at,
                    },
                    "updated_at": at,
                }
            )
        res = self.apply_ops(user_id, f"server:{source}", ops)
        return GradeOutcome(
            applied=[by_op[o] for o in res.applied],
            superseded=[by_op[o] for o in res.superseded],
            rejected=[{"check_id": by_op.get(r["op_id"]), "reason_ko": r["reason_ko"]} for r in res.rejected],
            server_time=res.server_time,
        )

    def grant_badge(self, user_id: str, badge_id: str, *, earned_at: str, evidence: Any = None) -> str:
        res = self.apply_ops(
            user_id,
            "server:badge",
            [
                {
                    "op_id": _op_id("badge", user_id, badge_id, earned_at),
                    "table": "user_badge",
                    "key": {"badge_id": badge_id},
                    "data": {"earned_at": earned_at, "evidence": evidence},
                    "updated_at": earned_at,
                }
            ],
        )
        if res.rejected:
            raise ValueError(res.rejected[0]["reason_ko"])
        return "applied" if res.applied else "superseded"

    def record_share_card(
        self,
        user_id: str,
        *,
        kind: str,
        payload: Any,
        image_path: str | None = None,
        created_at: str | None = None,
    ) -> dict[str, Any]:
        share_id = secrets.token_urlsafe(18)  # 24자, 추측 불가
        when = created_at or self._now()
        res = self.apply_ops(
            user_id,
            "server:share",
            [
                {
                    "op_id": _op_id("share", user_id, share_id),
                    "table": "share_card",
                    "key": {"share_id": share_id},
                    "data": {
                        "kind": kind,
                        "payload": payload,
                        "image_path": image_path,
                        "visibility": "private",
                        "created_at": when,
                    },
                    "updated_at": when,
                }
            ],
        )
        if res.rejected:
            raise ValueError(res.rejected[0]["reason_ko"])
        row = self.get_row(user_id, "share_card", {"share_id": share_id})
        assert row is not None
        return row
