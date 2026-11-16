"""결과코드 해독(DESIGN.md 12.7). 이 규칙은 z2h_check 패키지와 같아야 하므로 바꾸지 않는다.

모양:  Z2H1.{base64url(JSON), 패딩 '=' 없음}.{crc32 8자리 16진수 소문자}
crc32 대상: 가운데 base64url 글자(패딩 없음)의 UTF-8 바이트
JSON:  {"v":1,"l":"L01","p":[통과 check_id...],"f":[실패 check_id...],"t":"ISO시각+09:00"}
       check_id 는 "L01-S11b" 같은 전체 글자

결과코드는 비밀값이 아니고 위조를 막지도 않는다(목적은 편의). crc32는 붙여넣기 오타를 잡는 용도다.
"""

from __future__ import annotations

import base64
import binascii
import json
import re
import zlib
from dataclasses import dataclass

from .timeutil import normalize_time

PREFIX = "Z2H1"
MAX_CODE_CHARS = 64 * 1024

_B64URL = re.compile(r"^[A-Za-z0-9_-]+$")
_CRC = re.compile(r"^[0-9a-fA-F]{8}$")
_LECTURE = re.compile(r"^L\d{2}$")
_CHECK_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
_QUOTES = "'\"`“”‘’"

MESSAGES = {
    "empty": "결과코드가 비어 있습니다. 노트북 마지막 칸에 나온 결과코드를 붙여 넣어 주세요.",
    "bad_format": "결과코드 모양이 아닙니다. 'Z2H1.' 로 시작하는 한 줄 전체를 복사해 붙여 넣어 주세요.",
    "bad_checksum": (
        "결과코드 글자가 틀렸습니다(중간이 빠졌거나 바뀌었습니다). "
        "노트북 마지막 칸에 나온 결과코드를 처음부터 끝까지 다시 복사해 붙여 넣어 주세요."
    ),
    "bad_version": "이 앱이 모르는 결과코드 버전입니다. 노트북을 최신으로 받아 다시 실행해 주세요.",
    "bad_payload": "결과코드 안의 내용이 올바르지 않습니다. 노트북을 다시 실행해 새 결과코드를 받아 주세요.",
}


class ResultCodeError(ValueError):
    def __init__(self, error: str, detail: str | None = None):
        self.error = error
        self.message_ko = MESSAGES[error]
        self.detail = detail
        super().__init__(f"{error}: {detail or self.message_ko}")


@dataclass(frozen=True)
class ResultCode:
    version: int
    lecture_id: str
    passed: list[str]
    failed: list[str]
    t: str  # +09:00 ISO
    crc: str  # 소문자 8자리


def crc32_hex(payload: str) -> str:
    return format(zlib.crc32(payload.encode("utf-8")) & 0xFFFFFFFF, "08x")


def _clean(code: object) -> str:
    if not isinstance(code, str):
        raise ResultCodeError("empty")
    text = "".join(code.split())  # 붙여넣을 때 섞인 공백·줄바꿈 제거
    text = text.strip(_QUOTES)
    if not text:
        raise ResultCodeError("empty")
    if len(text) > MAX_CODE_CHARS:
        raise ResultCodeError("bad_format", "너무 김")
    return text


def _check_ids(value: object, name: str) -> list[str]:
    if not isinstance(value, list):
        raise ResultCodeError("bad_payload", f"{name} 는 목록이어야 함")
    out: list[str] = []
    for item in value:
        if not isinstance(item, str) or not _CHECK_ID.match(item):
            raise ResultCodeError("bad_payload", f"{name} 안에 잘못된 check_id: {item!r}")
        out.append(item)
    return out


def decode(code: object) -> ResultCode:
    """결과코드를 풀어 ResultCode 로. 잘못되면 ResultCodeError(error, message_ko)."""
    text = _clean(code)
    parts = text.split(".")
    if len(parts) != 3 or parts[0] != PREFIX:
        raise ResultCodeError("bad_format", "점(.)으로 나눈 세 부분, 맨 앞 Z2H1")
    payload, crc = parts[1], parts[2]
    if not payload or not _B64URL.match(payload) or not _CRC.match(crc):
        raise ResultCodeError("bad_format", "base64url 글자 또는 crc 8자리 아님")
    if crc32_hex(payload) != crc.lower():
        raise ResultCodeError("bad_checksum")

    try:
        raw = base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
        obj = json.loads(raw.decode("utf-8"))
    except (binascii.Error, ValueError, UnicodeDecodeError) as exc:
        raise ResultCodeError("bad_payload", "base64 또는 JSON 해석 실패") from exc
    if not isinstance(obj, dict):
        raise ResultCodeError("bad_payload", "JSON 이 객체가 아님")
    if obj.get("v") != 1 or isinstance(obj.get("v"), bool):
        raise ResultCodeError("bad_version", f"v={obj.get('v')!r}")
    lecture = obj.get("l")
    if not isinstance(lecture, str) or not _LECTURE.match(lecture):
        raise ResultCodeError("bad_payload", f"l={lecture!r}")
    passed = _check_ids(obj.get("p"), "p")
    failed = _check_ids(obj.get("f"), "f")
    if set(passed) & set(failed):
        raise ResultCodeError("bad_payload", "같은 check_id 가 통과와 실패에 함께 있음")
    try:
        when = normalize_time(obj.get("t"))
    except ValueError as exc:
        raise ResultCodeError("bad_payload", f"t: {exc}") from exc
    return ResultCode(version=1, lecture_id=lecture, passed=passed, failed=failed, t=when, crc=crc.lower())


def encode(lecture_id: str, *, passed: list[str], failed: list[str], t: str) -> str:
    """같은 규칙으로 결과코드를 만든다(테스트와 기준 예시용. 노트북 쪽 정본은 z2h_check)."""
    obj = {"v": 1, "l": lecture_id, "p": list(passed), "f": list(failed), "t": t}
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    payload = base64.urlsafe_b64encode(text.encode("utf-8")).rstrip(b"=").decode("ascii")
    return f"{PREFIX}.{payload}.{crc32_hex(payload)}"
