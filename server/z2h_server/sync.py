"""동기화 규칙(DESIGN.md 12.5). 저장소 종류와 무관한 순수 함수.

요청 한 줄(op) = {op_id, table, key, data, updated_at, base_updated_at(선택)}
- key: 그 표의 열쇠 칸만 담은 객체(user_id 제외. 서버가 현재 계정으로 붙인다). 예 {"step_id": "L01-S14b"}
- data: 바꿀 칸만 담는다(없는 칸은 그대로, 새 행이면 기본값). null 을 보내면 비운다.
  서버가 정하는 칸(attempt_no, server_seq, last_client_id)과 data 안의 updated_at 은 무시한다(기준은 op 의 updated_at).
  열쇠·user_id 가 data 에 섞여 오면 값이 같은지만 확인한다.
- DB 의 *_json 칼럼은 API 에서 data-spec 이름(covers, history, env, hints_seen 등, `_json` 을 뗀 이름)으로 JSON 값을 주고받는다.
  *_json 이름으로 보내면 JSON 글자(문자열)로 보고 풀어서 받는다.

충돌 규칙
- 같은 행은 updated_at 이 늦은 쪽이 이긴다. 진 값은 sync_conflicts 에 남긴다.
  (같은 기기가 이어서 고친 것, 또는 base_updated_at 이 서버 값과 같은 것은 충돌이 아니라 보통 수정)
- 쌓이는 기록(question_attempt, rebuild_attempt, checkpoint_attempt, diagnostic_result)은 기기가 만든
  attempt_id 가 열쇠라 두 기기가 오프라인에서 각각 풀어도 둘 다 남는다. attempt_no 는 서버가 도착 순서로 매긴다.
- step_progress: status 는 done 우선, max_hint_level·active_seconds_auto·attempts 는 큰 값,
  started_at 은 이른 값, done 이면 done_at 을 잃지 않는다. active_seconds_user 는 늦은 쪽(사용자가 비울 수 있음).
- review_card.history 는 양쪽 기록을 합친다(HANDOFF 6-1 "쌓이는 기록은 합친다").
"""

from __future__ import annotations

import json
import math
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import sqlalchemy as sa

from . import schema
from .timeutil import normalize_time, parse_time

MAX_TEXT_CHARS = 200_000
MAX_JSON_CHARS = 200_000
META_COLUMNS = ("updated_at", "server_seq", "last_client_id")
# data 에 와도 조용히 무시하는 서버 칸(기기가 /api/state 행을 그대로 되돌려 보내도 되게)
IGNORED_IN_DATA = ("server_seq", "last_client_id", "server_updated_at", "updated_at")

_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]*$")
_SHARE_ID = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class OpRejected(ValueError):
    def __init__(self, reason_ko: str):
        self.reason_ko = reason_ko
        super().__init__(reason_ko)


@dataclass(frozen=True)
class FieldRule:
    column: str
    api: str
    kind: str
    nullable: bool
    values: tuple[str, ...] | None = None
    min: float | None = None
    max: float | None = None
    default: Any = None
    max_len: int | None = None
    pattern: str | None = None


@dataclass(frozen=True)
class TableRule:
    name: str
    table: sa.Table
    key: tuple[str, ...]
    key_rules: dict[str, FieldRule]
    fields: dict[str, FieldRule]  # 기기가 쓸 수 있는 칼럼 → 규칙 (열쇠·user_id·메타·서버 번호 제외)
    names: dict[str, str]  # API 이름 또는 칼럼 이름 → 칼럼 이름
    numbered_by: tuple[str, ...] | None  # attempt_no 를 서버가 매기면 묶음 칸(예 ("question_id",)), 아니면 None

    @property
    def json_columns(self) -> tuple[str, ...]:
        return tuple(c for c, r in self.fields.items() if r.kind == "json")


def _rule_for(col: sa.Column) -> FieldRule:
    info = col.info or {}
    kind = info.get("kind", "str")
    api = info.get("api") or (col.name[: -len("_json")] if kind == "json" else col.name)
    max_len = info.get("max_len")
    if max_len is None and isinstance(col.type, sa.String) and col.type.length and kind in ("id", "str"):
        max_len = col.type.length
    return FieldRule(
        column=col.name,
        api=api,
        kind=kind,
        nullable=bool(col.nullable),
        values=info.get("values"),
        min=info.get("min"),
        max=info.get("max"),
        default=info.get("default"),
        max_len=max_len,
        pattern=info.get("pattern"),
    )


def build_rules() -> dict[str, TableRule]:
    rules: dict[str, TableRule] = {}
    for name in schema.SYNC_TABLES:
        table = schema.metadata.tables[name]
        key = tuple(c.name for c in table.primary_key.columns if c.name != "user_id")
        key_rules = {c: _rule_for(table.c[c]) for c in key}
        numbered_by = None
        fields: dict[str, FieldRule] = {}
        for c in table.columns:
            if c.name in key or c.name == "user_id" or c.name in META_COLUMNS:
                continue
            if (c.info or {}).get("kind") == "server_no":
                numbered_by = tuple(c.info.get("group", ()))
                continue
            fields[c.name] = _rule_for(c)
        names: dict[str, str] = {}
        for col, rule in fields.items():
            names[rule.api] = col
            names[col] = col
        rules[name] = TableRule(name, table, key, key_rules, fields, names, numbered_by)
    return rules


RULES = build_rules()
NOT_SYNCABLE = {
    "users",
    "auth_identity",
    "sessions",
    "badge_def",
    "sync_conflicts",
    "applied_ops",
    "sync_counter",
    "alembic_version",
}


# ---------------- 값 검사 ----------------


def coerce(rule: FieldRule, value: Any, *, is_key: bool = False) -> Any:
    name = rule.api
    if value is None:
        if is_key or not rule.nullable:
            raise OpRejected(f"{name}: 비울 수 없는 칸입니다")
        return None
    kind = rule.kind
    if kind in ("id", "str", "text", "enum"):
        if not isinstance(value, str):
            raise OpRejected(f"{name}: 글자여야 합니다")
        # 글 전체가 맞아야 한다(re.match 와 $ 는 끝 줄바꿈을 받아 준다)
        if kind == "id" and (not _ID.fullmatch(value) or len(value) > (rule.max_len or 64)):
            raise OpRejected(f"{name}: 아이디 모양이 아닙니다(영문·숫자·-_.: , 최대 {rule.max_len or 64}자)")
        if rule.pattern and not re.fullmatch(rule.pattern, value):
            raise OpRejected(f"{name}: 정해진 값이 아닙니다: {value}")
        if kind == "str" and rule.max_len and len(value) > rule.max_len:
            raise OpRejected(f"{name}: {rule.max_len}자를 넘습니다")
        if kind == "text" and len(value) > MAX_TEXT_CHARS:
            raise OpRejected(f"{name}: 글이 너무 깁니다(최대 {MAX_TEXT_CHARS}자)")
        if kind == "enum" and value not in (rule.values or ()):
            if rule.column == "visibility":
                raise OpRejected("visibility: 공개 공유는 아직 쓸 수 없습니다(공개 배포 승인 뒤). private 만 됩니다")
            raise OpRejected(f"{name} 값은 {', '.join(rule.values or ())} 중 하나여야 합니다")
        return value
    if kind == "int":
        if isinstance(value, bool) or not isinstance(value, int):
            raise OpRejected(f"{name}: 정수여야 합니다")
        _check_range(rule, value)
        return value
    if kind == "float":
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise OpRejected(f"{name}: 숫자여야 합니다")
        _check_range(rule, value)
        return float(value)
    if kind == "bool":
        if not isinstance(value, bool):
            raise OpRejected(f"{name}: 참/거짓(true/false)이어야 합니다")
        return value
    if kind == "time":
        try:
            return normalize_time(value)
        except ValueError as exc:
            raise OpRejected(f"{name}: {exc}") from exc
    if kind == "date_or_time":
        if isinstance(value, str) and _DATE.match(value):
            return value
        try:
            return normalize_time(value)
        except ValueError as exc:
            raise OpRejected(f"{name}: 날짜(YYYY-MM-DD) 또는 +09:00 시각이어야 합니다") from exc
    if kind == "json":
        try:
            size = len(json.dumps(value, ensure_ascii=False))
        except (TypeError, ValueError) as exc:
            raise OpRejected(f"{name}: JSON 값이 아닙니다") from exc
        if size > MAX_JSON_CHARS:
            raise OpRejected(f"{name}: 너무 큽니다")
        return value
    if kind == "share_id":
        if not isinstance(value, str) or not _SHARE_ID.fullmatch(value):
            raise OpRejected("share_id: 추측할 수 없는 임의 값(영문·숫자·-_ 16~64자)이어야 합니다")
        return value
    raise OpRejected(f"{name}: 알 수 없는 칸 종류")  # pragma: no cover


def _check_range(rule: FieldRule, value: float) -> None:
    if rule.min is not None and value < rule.min:
        raise OpRejected(f"{rule.api}: {rule.min:g} 이상이어야 합니다")
    if rule.max is not None and value > rule.max:
        raise OpRejected(f"{rule.api}: {rule.max:g} 이하여야 합니다")


def _time(name: str, value: Any) -> str:
    try:
        return normalize_time(value)
    except ValueError as exc:
        raise OpRejected(f"{name}: {exc}") from exc


# ---- 표별 추가 검사 ----


def _check_user_pref(key: dict[str, Any], data: dict[str, Any]) -> None:
    """practice_week:{주 시작일} 값은 {edited_seconds, edited_at}. null 이면 자동 기록으로 되돌아감."""
    if not key["pref_key"].startswith("practice_week:") or "value_json" not in data:
        return
    value = data["value_json"]
    if value is None:
        return
    if not isinstance(value, dict) or set(value) - {"edited_seconds", "edited_at"}:
        raise OpRejected("practice_week 값은 {edited_seconds, edited_at} 모양이어야 합니다")
    secs = value.get("edited_seconds")
    if secs is not None and (isinstance(secs, bool) or not isinstance(secs, int) or secs < 0):
        raise OpRejected("edited_seconds: 0 이상 정수 또는 null 이어야 합니다")
    if value.get("edited_at") is not None:
        value["edited_at"] = _time("edited_at", value["edited_at"])


TABLE_CHECKS: dict[str, Callable[[dict[str, Any], dict[str, Any]], None]] = {"user_pref": _check_user_pref}


@dataclass
class ValidOp:
    op_id: str
    rule: TableRule
    key: dict[str, Any]
    data: dict[str, Any]  # 칼럼 이름 → 값
    updated_at: str
    base_updated_at: str | None


def validate_key(rule: TableRule, key_raw: Any, user_id: str | None = None) -> dict[str, Any]:
    if not isinstance(key_raw, dict):
        raise OpRejected(f"열쇠(key)는 객체여야 합니다. 필요한 칸: {', '.join(rule.key)}")
    if user_id is not None:
        key_raw = {k: v for k, v in key_raw.items() if not (k == "user_id" and v == user_id)}
    if "user_id" in key_raw:
        raise OpRejected("user_id 는 서버가 현재 계정으로 정합니다(다른 계정 기록은 쓸 수 없음)")
    if set(key_raw) != set(rule.key):
        raise OpRejected(f"열쇠 칸이 맞지 않습니다. 필요한 칸: {', '.join(rule.key)}")
    return {k: coerce(rule.key_rules[k], key_raw[k], is_key=True) for k in rule.key}


def validate_op(raw: Any, user_id: str) -> ValidOp:
    if not isinstance(raw, dict):
        raise OpRejected("op 는 객체여야 합니다")
    op_id = raw.get("op_id")
    if not isinstance(op_id, str) or not (1 <= len(op_id) <= 128):
        raise OpRejected("op_id 가 없거나 모양이 틀렸습니다(1~128자 글자)")
    unknown_top = set(raw) - {"op_id", "table", "key", "data", "updated_at", "base_updated_at"}
    if unknown_top:
        raise OpRejected(f"op 에 모르는 항목: {', '.join(sorted(unknown_top))}")

    table = raw.get("table")
    if not isinstance(table, str):
        raise OpRejected("table 이 없습니다")
    if table in NOT_SYNCABLE:
        raise OpRejected(f"동기화로 쓸 수 없는 표입니다: {table}")
    rule = RULES.get(table)
    if rule is None:
        raise OpRejected(f"모르는 표입니다: {table}")

    key = validate_key(rule, raw.get("key"), user_id)
    updated_at = _time("updated_at", raw.get("updated_at"))
    base = raw.get("base_updated_at")
    base_updated_at = None if base is None else _time("base_updated_at", base)

    data_raw = raw.get("data", {})
    if not isinstance(data_raw, dict):
        raise OpRejected("data 는 객체여야 합니다")
    data: dict[str, Any] = {}
    for name, value in data_raw.items():
        if name == "user_id":
            if value != user_id:
                raise OpRejected("user_id 는 서버가 현재 계정으로 정합니다(다른 계정 기록은 쓸 수 없음)")
            continue
        if name in rule.key:
            if coerce(rule.key_rules[name], value, is_key=True) != key[name]:
                raise OpRejected(f"data 의 {name} 가 열쇠(key)와 다릅니다")
            continue
        if name in IGNORED_IN_DATA or (name == "attempt_no" and rule.numbered_by is not None):
            continue  # 서버가 정하는 칸
        col = rule.names.get(name)
        if col is None:
            raise OpRejected(f"모르는 칸입니다: {name}")
        if col in data:
            raise OpRejected(f"같은 칸이 두 번 있습니다: {name}")
        fr = rule.fields[col]
        if fr.kind == "json" and name == col and isinstance(value, str):
            # *_json 이름으로 온 값은 JSON 글자로 보고 푼다
            try:
                value = json.loads(value)
            except ValueError as exc:
                raise OpRejected(f"{name}: JSON 글자가 아닙니다") from exc
        data[col] = coerce(fr, value)
    check = TABLE_CHECKS.get(rule.name)
    if check:
        check(key, data)
    return ValidOp(op_id, rule, key, data, updated_at, base_updated_at)


# ---------------- 합치기 ----------------


@dataclass
class Decision:
    action: str  # insert | update | none
    outcome: str  # applied | superseded
    row: dict[str, Any] = field(default_factory=dict)  # 새 행 전체(칼럼 이름, 메타 포함)
    changed: dict[str, Any] = field(default_factory=dict)  # update 때 바뀐 칼럼만
    conflict: dict[str, Any] | None = None


def _max(a, b):
    vals = [v for v in (a, b) if v is not None]
    return max(vals) if vals else None


def _min_time(a, b):
    vals = [v for v in (a, b) if v is not None]
    return min(vals, key=parse_time) if vals else None


def _merge_step_progress(new: dict, old: dict, inc: dict) -> None:
    if "status" in inc and (old.get("status") == "done" or inc["status"] == "done"):
        new["status"] = "done"
    for col in ("max_hint_level", "active_seconds_auto", "attempts"):
        if col in inc:
            new[col] = _max(old.get(col), inc[col])
    if "started_at" in inc:
        new["started_at"] = _min_time(old.get("started_at"), inc["started_at"])
    if new.get("status") == "done" and new.get("done_at") is None:
        new["done_at"] = old.get("done_at") or inc.get("done_at")


def _history_key(item: Any) -> str:
    return json.dumps(item, sort_keys=True, ensure_ascii=False)


def _merge_review_card(new: dict, old: dict, inc: dict) -> None:
    if "history_json" not in inc:
        return
    a, b = old.get("history_json"), inc["history_json"]
    if not isinstance(a, list) or not isinstance(b, list):
        return
    seen: set[str] = set()
    merged = []
    for item in [*a, *b]:
        k = _history_key(item)
        if k not in seen:
            seen.add(k)
            merged.append(item)
    try:
        merged.sort(key=lambda it: parse_time(it["at"]))
    except (KeyError, TypeError, ValueError):
        pass  # 시각이 없거나 틀리면 받은 순서 그대로
    new["history_json"] = merged


MERGERS: dict[str, Callable[[dict, dict, dict], None]] = {
    "step_progress": _merge_step_progress,
    "review_card": _merge_review_card,
}


def decide(op: ValidOp, existing: dict[str, Any] | None, client_id: str) -> Decision:
    rule = op.rule
    if existing is None:
        row: dict[str, Any] = {}
        for col, fr in rule.fields.items():
            if col in op.data:
                row[col] = op.data[col]
            elif fr.default is not None:
                row[col] = fr.default
            elif not fr.nullable:
                raise OpRejected(f"새 기록에는 {fr.api} 칸이 필요합니다")
            else:
                row[col] = None
        row.update(op.key)
        row["updated_at"] = op.updated_at
        row["last_client_id"] = client_id
        return Decision("insert", "applied", row=row)

    inc = op.data
    diff = [c for c, v in inc.items() if existing.get(c) != v]
    if not diff:
        return Decision("none", "applied")

    ex_t = parse_time(existing["updated_at"])
    in_t = parse_time(op.updated_at)
    same_client = existing.get("last_client_id") == client_id
    op_wins = in_t > ex_t or (in_t == ex_t and same_client)

    new = dict(existing)
    if op_wins:
        new.update(inc)
        new["updated_at"] = op.updated_at
        new["last_client_id"] = client_id
    merger = MERGERS.get(rule.name)
    if merger:
        merger(new, existing, inc)

    lost_server = {}
    lost_op = {}
    for col in diff:
        api = rule.fields[col].api
        if new[col] == inc[col] and new[col] != existing.get(col) and existing.get(col) is not None:
            lost_server[api] = existing.get(col)
        elif new[col] == existing.get(col) and new[col] != inc[col] and inc[col] is not None:
            lost_op[api] = inc[col]

    changed = {c: v for c, v in new.items() if existing.get(c) != v}
    concurrent = not same_client and not (
        op.base_updated_at is not None and parse_time(op.base_updated_at) == ex_t
    )
    conflict = None
    if lost_op or (lost_server and concurrent):
        conflict = {
            "op_id": op.op_id,
            "client_id": client_id,
            "op_updated_at": op.updated_at,
            "server_updated_at_before": existing["updated_at"],
            "server_client_id_before": existing.get("last_client_id"),
            "winner": "op" if op_wins else "server",
            "lost_server_values": lost_server,
            "lost_op_values": lost_op,
        }
    outcome = "superseded" if lost_op else "applied"
    return Decision("update" if changed else "none", outcome, row=new, changed=changed, conflict=conflict)
