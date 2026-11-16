"""시각 처리. 저장하는 시각은 모두 +09:00(KST) ISO 문자열이다(data-spec 검수 규칙 5)."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))

_SPACE_OFFSET = re.compile(r" (\d{2}:?\d{2})$")


def parse_time(value: object) -> datetime:
    """시간대가 붙은 ISO 문자열만 받는다. 시간대가 없으면 ValueError."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError("시각은 글자(ISO 형식)여야 합니다")
    text = value.strip()
    # 주소 쿼리에서 '+' 가 공백으로 바뀐 경우를 되돌린다(예: '...20:00:00 09:00')
    text = _SPACE_OFFSET.sub(r"+\1", text)
    try:
        dt = datetime.fromisoformat(text)
    except ValueError as exc:
        raise ValueError(f"시각 형식이 아닙니다: {value!r}") from exc
    if dt.tzinfo is None or dt.utcoffset() is None:
        raise ValueError(f"시각에는 +09:00 같은 시간대가 있어야 합니다: {value!r}")
    return dt


def to_kst_iso(dt: datetime, *, micro: bool = False) -> str:
    dt = dt.astimezone(KST)
    return dt.isoformat(timespec="microseconds") if micro else dt.isoformat()


def normalize_time(value: object) -> str:
    """받은 시각을 +09:00 ISO 문자열로 바꾼다(같은 순간이면 늘 같은 글자)."""
    return to_kst_iso(parse_time(value))


def normalize_since(value: object) -> str:
    """since 비교용. 서버가 찍는 시각과 같은 모양(마이크로초까지)으로 맞춘다."""
    return to_kst_iso(parse_time(value), micro=True)


def now_kst() -> str:
    return to_kst_iso(datetime.now(KST), micro=True)
