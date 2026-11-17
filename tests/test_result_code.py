"""결과코드 Z2H1.{base64url(JSON)}.{crc32} 규칙 테스트. 앱·서버 해독기와 같은 기준값을 쓴다."""
import base64
import json
import re
import zlib

import pytest

from z2h_check import ResultCodeError, decode_result_code, encode_result_code

# p1-app 에 보낸 예시와 같은 값(앱·서버 해독기 테스트의 공통 기준값).
GOLDEN_ARGS = ("L01", ["L01-S11b"], ["L01-R2"], "2026-11-16T21:00:00+09:00")
GOLDEN_JSON = '{"v":1,"l":"L01","p":["L01-S11b"],"f":["L01-R2"],"t":"2026-11-16T21:00:00+09:00"}'
GOLDEN_CODE = ("Z2H1.eyJ2IjoxLCJsIjoiTDAxIiwicCI6WyJMMDEtUzExYiJdLCJmIjpbIkwwMS1SMiJdLCJ0Ijoi"
               "MjAyNi0xMS0xNlQyMTowMDowMCswOTowMCJ9.32dccd52")
B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"


def test_golden_value():
    assert encode_result_code(*GOLDEN_ARGS) == GOLDEN_CODE


def test_same_code_as_server_golden_vector():
    # server/tests/test_result_code.py 의 기준값(진도 서버 작업자가 규칙대로 손으로 만든 코드)과 같아야 한다
    server_golden = ("Z2H1.eyJ2IjoxLCJsIjoiTDAxIiwicCI6WyJMMDEtUzA0IiwiTDAxLVMxMWIiXSwiZiI6WyJMMDEtUzEyIl0sInQi"
                     "OiIyMDI2LTExLTIwVDIxOjAwOjAwKzA5OjAwIn0.e00a6ba9")
    assert encode_result_code("L01", ["L01-S04", "L01-S11b"], ["L01-S12"], "2026-11-20T21:00:00+09:00") == server_golden


def test_layout_json_and_crc_rule():
    code = encode_result_code(*GOLDEN_ARGS)
    prefix, b64, crc = code.split(".")
    assert prefix == "Z2H1"
    assert "=" not in b64 and re.fullmatch(r"[A-Za-z0-9_-]+", b64)
    assert re.fullmatch(r"[0-9a-f]{8}", crc)
    raw = base64.urlsafe_b64decode(b64 + "=" * (-len(b64) % 4)).decode("utf-8")
    assert raw == GOLDEN_JSON  # 키 순서 고정, 공백 없음
    assert crc == format(zlib.crc32(b64.encode("utf-8")) & 0xFFFFFFFF, "08x")


def test_roundtrip_many_ids():
    passed = [f"L01-S{n:02d}" for n in range(1, 17)] + ["L01-S09b", "L01-S14c", "L01-R1"]
    failed = ["L01-R2", "L01-R3"]
    code = encode_result_code("L01", passed, failed, "2026-11-20T08:15:00+09:00")
    got = decode_result_code(code)
    assert got == {"v": 1, "l": "L01", "p": passed, "f": failed, "t": "2026-11-20T08:15:00+09:00"}
    assert list(got) == ["v", "l", "p", "f", "t"]


def test_default_time_is_kst():
    got = decode_result_code(encode_result_code("L01", [], []))
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+09:00", got["t"])
    assert got["p"] == [] and got["f"] == []


def test_whitespace_and_line_breaks_are_ignored():
    code = GOLDEN_CODE
    pasted = "  " + code[:20] + "\n" + code[20:50] + " \r\n" + code[50:] + "\n"
    assert decode_result_code(pasted)["p"] == ["L01-S11b"]


def test_every_single_character_change_is_detected():
    code = GOLDEN_CODE
    alphabet = B64URL + "."
    changed = 0
    for i, ch in enumerate(code):
        for repl in (alphabet[(alphabet.index(ch) + 1) % len(alphabet)] if ch in alphabet else "A",
                     "a" if ch != "a" else "b"):
            if repl == ch:
                continue
            bad = code[:i] + repl + code[i + 1:]
            with pytest.raises(ResultCodeError):
                decode_result_code(bad)
            changed += 1
    assert changed >= 2 * len(code) - 5


@pytest.mark.parametrize("bad", [
    "", "hello", "Z2H1", "Z2H1..", "Z2H2." + GOLDEN_CODE[5:], GOLDEN_CODE[:-1], GOLDEN_CODE[:-9],
    GOLDEN_CODE + "0", GOLDEN_CODE.upper(), GOLDEN_CODE.replace(".", ":"), GOLDEN_CODE[:30],
])
def test_bad_codes_raise_with_korean_message(bad):
    with pytest.raises(ResultCodeError) as info:
        decode_result_code(bad)
    assert re.search(r"[가-힣]", str(info.value))
    assert info.value.message_ko == str(info.value)


def test_non_string_input():
    for bad in (None, 123, b"Z2H1.abc.00000000"):
        with pytest.raises(ResultCodeError):
            decode_result_code(bad)


def test_valid_crc_but_wrong_payload_shape_is_rejected():
    def make(obj_text):
        b64 = base64.urlsafe_b64encode(obj_text.encode()).rstrip(b"=").decode()
        return f"Z2H1.{b64}.{zlib.crc32(b64.encode()) & 0xFFFFFFFF:08x}"
    for text in ['{"v":2,"l":"L01","p":[],"f":[],"t":"x"}', '[1,2]', 'not json',
                 '{"v":1,"l":"L01","p":"L01-S01","f":[],"t":"x"}', '{"v":1,"l":"L01","p":[],"f":[]}']:
        with pytest.raises(ResultCodeError):
            decode_result_code(make(text))
