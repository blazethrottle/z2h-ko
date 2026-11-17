"""결과코드: Z2H1.{base64url(JSON)}.{crc32 8자리}

규칙 (진도 서버·앱의 해독기와 같다. 바꾸지 않는다):
- JSON은 키 순서 v, l, p, f, t 고정, 공백 없음.
  예: {"v":1,"l":"L01","p":["L01-S11b"],"f":["L01-R2"],"t":"2026-11-16T21:00:00+09:00"}
  p = 통과한 check_id, f = 실패한 check_id (L01-S11b 같은 전체 문자열). 둘 다 없으면 "아직 안 함".
- base64url은 패딩(=)을 뗀다.
- crc32는 base64url 문자열의 UTF-8 바이트로 계산해 8자리 소문자 16진수로 쓴다.
비밀값이 아니며 위조를 막지 않는다. 목적은 붙여넣기 오타 잡기다.
"""
import base64
import binascii
import datetime
import json
import re
import zlib

PREFIX = "Z2H1"
VERSION = 1
KEYS = ("v", "l", "p", "f", "t")
KST = datetime.timezone(datetime.timedelta(hours=9))

_B64 = re.compile(r"[A-Za-z0-9_-]+")
_CRC = re.compile(r"[0-9a-f]{8}")

MSG_SHAPE = "결과코드 모양이 아닙니다. 노트북 finish() 아래에 나온 'Z2H1.'로 시작하는 줄 전체를 복사해 주세요."
MSG_CHANGED = "코드가 잘렸거나 글자가 바뀌었습니다. 노트북에서 결과코드를 다시 복사해 주세요."
MSG_CONTENT = "결과코드 안의 내용을 읽지 못했습니다. 노트북에서 finish()를 다시 실행해 새 코드를 받아 주세요."
MSG_VERSION = "이 결과코드는 다른 버전에서 만들었습니다. 노트북의 준비 셀을 새로 받아 다시 실행해 주세요."


class ResultCodeError(ValueError):
    """결과코드를 풀지 못함. message_ko 는 화면에 그대로 보여 줄 한국어 안내."""

    def __init__(self, message_ko):
        super().__init__(message_ko)
        self.message_ko = message_ko


def now_kst_iso():
    """지금 서울 시각, 예: 2026-11-16T21:00:00+09:00"""
    return datetime.datetime.now(KST).replace(microsecond=0).isoformat()


def crc32_hex(text):
    return format(zlib.crc32(text.encode("utf-8")) & 0xFFFFFFFF, "08x")


def encode_result_code(lecture_id, passed, failed, at=None):
    """encode_result_code("L01", ["L01-S11b"], ["L01-R2"], "2026-11-16T21:00:00+09:00") -> "Z2H1.....32dccd52"

    passed·failed 는 넘긴 순서 그대로 담는다. at 이 없으면 지금 서울 시각.
    """
    payload = {
        "v": VERSION,
        "l": str(lecture_id),
        "p": [str(x) for x in passed],
        "f": [str(x) for x in failed],
        "t": at or now_kst_iso(),
    }
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    b64 = base64.urlsafe_b64encode(text.encode("utf-8")).decode("ascii").rstrip("=")
    return f"{PREFIX}.{b64}.{crc32_hex(b64)}"


def decode_result_code(code):
    """결과코드를 풀어 {"v":1,"l":...,"p":[...],"f":[...],"t":...} 를 돌려준다.

    앞뒤·중간의 공백과 줄바꿈은 무시한다. 틀리면 ResultCodeError(한국어 안내)를 던진다.
    """
    if not isinstance(code, str):
        raise ResultCodeError(MSG_SHAPE)
    text = "".join(code.split())
    parts = text.split(".")
    if len(parts) != 3 or parts[0] != PREFIX:
        raise ResultCodeError(MSG_SHAPE)
    _prefix, b64, crc = parts
    if not _B64.fullmatch(b64) or not _CRC.fullmatch(crc):
        raise ResultCodeError(MSG_CHANGED)
    if crc32_hex(b64) != crc:
        raise ResultCodeError(MSG_CHANGED)
    try:
        raw = base64.urlsafe_b64decode(b64 + "=" * (-len(b64) % 4))
        obj = json.loads(raw.decode("utf-8"))
    except (binascii.Error, ValueError, UnicodeDecodeError):
        raise ResultCodeError(MSG_CONTENT) from None
    if not isinstance(obj, dict) or set(obj) != set(KEYS):
        raise ResultCodeError(MSG_CONTENT)
    if type(obj["v"]) is not int or obj["v"] != VERSION:
        raise ResultCodeError(MSG_VERSION)
    if not isinstance(obj["l"], str) or not isinstance(obj["t"], str):
        raise ResultCodeError(MSG_CONTENT)
    for key in ("p", "f"):
        if not isinstance(obj[key], list) or not all(isinstance(x, str) for x in obj[key]):
            raise ResultCodeError(MSG_CONTENT)
    return {key: obj[key] for key in KEYS}
