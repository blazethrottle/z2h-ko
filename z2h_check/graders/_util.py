"""채점 함수들이 같이 쓰는 도구.

원칙
- 학생 코드(넘긴 이름 공간의 함수·클래스·값)는 늘 student()로 감싸 부른다. 거기서 난 오류는 Fail("✕ 다시")이 된다.
- 학생 값을 숫자로 바꿀 때는 as_number()를 쓴다. 이 도구들은 어떤 입력에도 Fail 말고 다른 예외를 내지 않는다.
  그래서 이 밖에서 난 예외는 채점기 자체의 오류로 본다.
"""
import math
import re


class Fail(Exception):
    """학생 결과가 기준과 다름 ("✕ 다시"). message_ko 는 무엇이 다른지."""

    def __init__(self, message_ko):
        super().__init__(message_ko)
        self.message_ko = message_ko


class Skip(Exception):
    """채점할 수 없어 건너뜀 (예: 셀 출력을 읽을 수 없는 곳). 통과도 실패도 아니다."""

    def __init__(self, message_ko):
        super().__init__(message_ko)
        self.message_ko = message_ko


class Pass:
    """통과를 돌려줄 때 화면 앞머리를 바꾸고 싶으면 쓴다(예: 그림 단계 "✓ 실행됨"). 글만 돌려주면 "✓ 맞음"."""

    def __init__(self, message_ko, mark):
        self.message_ko = message_ko
        self.mark = mark


class NotYet(Exception):
    """아직 하지 않음 ("○ 아직"): 필요한 셀을 아직 실행하지 않았거나 빈 셀 그대로일 때. 기록하지 않는다."""

    def __init__(self, message_ko, mark="○ 아직"):
        super().__init__(message_ko)
        self.message_ko = message_ko
        self.mark = mark


# ---- 오류 설명 -------------------------------------------------------------

def _safe_str(exc):
    try:
        text = str(exc)
    except Exception:
        text = "(오류 내용을 읽지 못함)"
    text = " ".join(text.split())
    return text if len(text) <= 160 else text[:157] + "..."


def describe_exc(exc):
    name = type(exc).__name__
    text = _safe_str(exc)
    return f"{name}: {text}" if text else name


_WRAP_HINT = "숫자와 섞어 계산하려면 숫자를 Value로 감싸세요: other = other if isinstance(other, Value) else Value(other)"


def hint_for(exc):
    """자주 막히는 오류에 붙이는 한 줄 도움말 (정본 L01 막힘 힌트: __radd__, __rmul__, 감싸기, 셀 다시 실행)."""
    text = _safe_str(exc)
    if isinstance(exc, NameError) and "___" in text:
        return "빈칸(___)이 아직 남아 있습니다. 빈칸을 채우고 그 셀부터 다시 실행하세요."
    if isinstance(exc, NameError):
        return "아직 정의하지 않은 이름이 있습니다. 앞 셀들을 위에서부터 다시 실행했나요?"
    if isinstance(exc, SyntaxError):
        return "코드 모양(괄호, 쌍점, 들여쓰기)이 맞지 않습니다. 오류가 가리키는 줄을 보세요."
    if isinstance(exc, RecursionError):
        return "같은 값을 끝없이 따라갑니다. 위상 정렬에서 visited로 이미 본 값을 건너뛰나요?"
    if isinstance(exc, ZeroDivisionError):
        return "0으로 나눴습니다."
    if isinstance(exc, OverflowError):
        return "숫자가 너무 커졌습니다."
    if isinstance(exc, TypeError) and "unsupported operand" in text:
        m = re.search(r"for (\S+): '(\w+)' and '(\w+)'", text)
        if m:
            op, left, right = m.groups()
            if left in ("int", "float") and right not in ("int", "float"):
                if op == "+":
                    return "숫자 + Value 를 하려면 __radd__가 필요합니다(sum()은 0부터 더합니다)."
                name = {"*": "__rmul__", "-": "__rsub__", "/": "__rtruediv__"}.get(op)
                if name:
                    return f"숫자 {op} Value 를 하려면 {name}가 필요합니다."
            if right in ("int", "float"):
                return _WRAP_HINT
    if isinstance(exc, AttributeError):
        if re.search(r"'(int|float)' object has no attribute '(data|grad|_prev)'", text):
            return _WRAP_HINT
        m = re.search(r"has no attribute '(\w+)'", text)
        if m:
            return f"{m.group(1)} 이(가) 아직 없습니다. 그 단계의 코드를 넣고 그 셀을 다시 실행했나요?"
    return ""


def student_error_message(what, exc):
    hint = hint_for(exc)
    msg = f"{what} 중 오류가 났습니다: {describe_exc(exc)}."
    return f"{msg} {hint}" if hint else msg


def student(what, fn, *args, **kwargs):
    """학생 코드를 부른다. 오류가 나면 Fail(무엇을 하다 무슨 오류가 났는지)로 바꾼다."""
    try:
        return fn(*args, **kwargs)
    except (KeyboardInterrupt, Fail, Skip, NotYet):
        raise
    except BaseException as exc:
        raise Fail(student_error_message(what, exc)) from None


# ---- 값 읽기 ---------------------------------------------------------------

def type_name(x):
    try:
        return type(x).__name__
    except Exception:
        return "알 수 없는 것"


def fmt(x):
    """화면용 숫자: 2.0, -3.0, 14.003, 0.707107"""
    if isinstance(x, bool):
        return str(x)
    if isinstance(x, int):
        return str(x)
    if isinstance(x, float):
        if math.isfinite(x) and x == int(x) and abs(x) < 1e15:
            return f"{x:.1f}"
        return f"{x:.6g}"
    return str(x)


def as_number(x, label, _depth=0):
    """학생 값을 float로. 텐서·numpy처럼 .item()이 있으면 그 값."""
    if isinstance(x, bool) or x is None:
        raise Fail(f"{label}에는 숫자가 와야 하는데 {x}가 왔습니다.")
    if isinstance(x, (int, float)):
        v = float(x)
    elif isinstance(x, (str, bytes)) or _depth >= 3:
        raise Fail(f"{label}에는 숫자가 와야 하는데 {type_name(x)}이(가) 왔습니다.")
    else:
        item = getattr(x, "item", None) if not isinstance(x, type) else None
        if callable(item):
            return as_number(student(f"{label}을(를) 숫자로 바꾸기", item), label, _depth + 1)
        v = student(f"{label}을(를) 숫자로 바꾸기", float, x)
    if not math.isfinite(v):
        raise Fail(f"{label}: 내 값 {v}. 계산 중 숫자가 넘쳤거나 0으로 나눴습니다.")
    return v


def close(got, want, tol):
    return abs(got - want) <= tol * max(1.0, abs(want))


# ---- 출력 글 비교 ------------------------------------------------------------

# 앞뒤가 글자·숫자·점에 붙지 않은 숫자만 숫자로 본다(x1 같은 이름, 0x13d20f5b0 같은 메모리 주소 안 숫자는 글자로 본다)
NUMBER = re.compile(r"(?<![\w.])-?\d+(?:\.\d*)?(?:[eE][-+]?\d+)?(?![\w.])")


def _pattern(expected):
    """기대 출력 글을 정규식으로: 숫자 자리는 아무 숫자나 잡고(나중에 허용 오차로 비교), 빈칸은 빈칸 여러 개와도 맞는다."""
    parts, numbers, pos = [], [], 0
    for m in NUMBER.finditer(expected):
        parts.append(_text_pattern(expected[pos:m.start()]))
        parts.append("(" + NUMBER.pattern + ")")
        numbers.append(float(m.group()))
        pos = m.end()
    parts.append(_text_pattern(expected[pos:]))
    return re.compile("".join(parts)), numbers


def _text_pattern(text):
    return "".join(r"\s+" if piece.isspace() else re.escape(piece) for piece in re.split(r"(\s+)", text) if piece)


def output_has(text, expected, tol):
    """출력 글 text 안에 기대 출력 expected 가 있는지(정본 규칙: contains, 소수는 허용 오차 tol)."""
    pattern, numbers = _pattern(expected.strip())
    pos = 0
    while True:
        m = pattern.search(text, pos)
        if m is None:
            return False
        if all(close(float(got), want, tol) for got, want in zip(m.groups(), numbers)):
            return True
        pos = m.start() + 1


def last_number(text):
    found = NUMBER.findall(text)
    return float(found[-1]) if found else None


def preview(text, limit=80):
    """학생 출력을 한 줄로 짧게: 줄바꿈은 ' / ' 로."""
    flat = " / ".join(line.strip() for line in text.strip().splitlines() if line.strip())
    return flat if len(flat) <= limit else flat[:limit - 3] + "..."
