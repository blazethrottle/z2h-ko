"""채점 함수들이 같이 쓰는 도구.

원칙
- 학생 코드(넘긴 클래스·함수·값)는 늘 student()로 감싸 부른다. 거기서 난 오류는 Fail("✕ 다시")이 된다.
- 학생 값을 숫자로 바꿀 때는 as_number(), 속성은 get_attr()/try_attr()를 쓴다. 이 도구들은 어떤 입력에도
  Fail 말고 다른 예외를 내지 않는다. 그래서 이 밖에서 난 예외는 채점기 자체의 오류로 본다.
"""
import math
import os
import re


class Fail(Exception):
    """학생 결과가 기준과 다름 ("✕ 다시"). message_ko 는 무엇이 다른지."""

    def __init__(self, message_ko):
        super().__init__(message_ko)
        self.message_ko = message_ko


class Skip(Exception):
    """채점할 수 없어 건너뜀 (예: torch 없음). 통과도 실패도 아니다."""

    def __init__(self, message_ko):
        super().__init__(message_ko)
        self.message_ko = message_ko


TORCH_SKIP_NOTE = "PyTorch 비교는 torch가 없어 건너뜀"
MISSING = object()


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
    """자주 막히는 오류에 붙이는 한 줄 도움말 (research/01 5절, pedagogy/01 7절)."""
    text = _safe_str(exc)
    if isinstance(exc, NameError) and "___" in text:
        return "빈칸(___)이 아직 남아 있습니다. 빈칸을 채우고 그 셀부터 다시 실행하세요."
    if isinstance(exc, NameError):
        return "아직 정의하지 않은 이름이 있습니다. 앞 셀들을 위에서부터 다시 실행했나요?"
    if isinstance(exc, NotImplementedError):
        return "아직 채우지 않은 부분이 있습니다."
    if isinstance(exc, RecursionError):
        return "같은 값을 끝없이 따라갑니다. 위상 정렬에서 visited로 이미 본 값을 건너뛰나요?"
    if isinstance(exc, ZeroDivisionError):
        return "0으로 나눴습니다."
    if isinstance(exc, OverflowError):
        return "숫자가 너무 커졌습니다."
    if isinstance(exc, TypeError) and "NoneType" in text:
        return "빈칸(___)을 아직 채우지 않아 None이 남아 있을 수 있습니다. 빈칸을 채우고 셀을 다시 실행하세요."
    if isinstance(exc, TypeError) and "unsupported operand" in text:
        m = re.search(r"for (\S+): '(\w+)' and '(\w+)'", text)
        if m:
            op, left, right = m.groups()
            if left in ("int", "float") and right not in ("int", "float"):
                name = {"+": "__radd__", "*": "__rmul__", "-": "__rsub__", "/": "__rtruediv__"}.get(op)
                if op == "+":
                    return "숫자 + Value 를 하려면 __radd__가 필요합니다(sum()은 0부터 더합니다). 또는 sum(..., Value(0.0))처럼 시작값을 주세요."
                if name:
                    return f"숫자 {op} Value 를 하려면 {name}가 필요합니다."
            if right in ("int", "float"):
                return _WRAP_HINT
    if isinstance(exc, TypeError) and ("not callable" in text or "takes" in text or "argument" in text):
        return "넘긴 것이 함수·클래스 모양과 다릅니다. 셀의 정의를 다시 실행했나요?"
    if isinstance(exc, AttributeError):
        if re.search(r"'(int|float)' object has no attribute '(data|grad|_prev)'", text):
            return _WRAP_HINT
        m = re.search(r"has no attribute '(\w+)'", text)
        if m:
            return f"{m.group(1)} 이(가) 아직 없습니다. 그 단계의 코드를 넣고 클래스 셀을 다시 실행했나요?"
    return ""


def student_error_message(what, exc):
    hint = hint_for(exc)
    msg = f"{what} 중 오류가 났습니다: {describe_exc(exc)}."
    return f"{msg} {hint}" if hint else msg


def student(what, fn, *args, **kwargs):
    """학생 코드를 부른다. 오류가 나면 Fail(무엇을 하다 무슨 오류가 났는지)로 바꾼다."""
    try:
        return fn(*args, **kwargs)
    except (KeyboardInterrupt, Fail, Skip):
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
    """화면용 숫자: 2.0, -3.0, 14.0003, 0.881374"""
    if isinstance(x, bool):
        return str(x)
    if isinstance(x, int):
        return str(x)
    if isinstance(x, float):
        if math.isfinite(x) and x == int(x) and abs(x) < 1e15:
            return f"{x:.1f}"
        return f"{x:.6g}"
    return str(x)


def short(x):
    """학생 값을 안전하게 짧게 보여 준다 (글자는 따옴표, 나머지는 종류 이름)."""
    if isinstance(x, str):
        return repr(x[:30])
    if isinstance(x, (int, float)) and not isinstance(x, bool):
        return fmt(x)
    return f"{type_name(x)} 값"


def is_blank(x):
    return x is None or x is Ellipsis


def need(x, label):
    if is_blank(x):
        raise Fail(f"{label} 칸이 아직 비어 있습니다. 값을 넣고 셀을 다시 실행하세요.")
    return x


def need_callable(x, label, usage):
    need(x, label)
    if not callable(x):
        raise Fail(f"{label} 자리에 {short(x)}이(가) 왔습니다. {usage} 처럼 클래스(함수) 이름을 넘기세요.")
    return x


def try_attr(obj, name):
    """속성을 읽되, 없거나 오류가 나면 MISSING."""
    try:
        return getattr(obj, name)
    except Exception:
        return MISSING


def has_attr(obj, name):
    return try_attr(obj, name) is not MISSING


def get_attr(obj, name, owner, hint=""):
    try:
        return getattr(obj, name)
    except AttributeError:
        extra = f" {hint}" if hint else ""
        raise Fail(f"{owner}에서 '{name}'을(를) 찾지 못했습니다.{extra}") from None
    except (KeyboardInterrupt, Fail, Skip):
        raise
    except BaseException as exc:
        raise Fail(student_error_message(f"{owner}.{name} 읽기", exc)) from None


def as_number(x, label, _depth=0):
    """학생 값을 float로. Value처럼 .data가 있으면 .data, 텐서·numpy처럼 .item()이 있으면 그 값."""
    need(x, label)
    if isinstance(x, bool):
        raise Fail(f"{label}에는 숫자가 와야 하는데 {x}가 왔습니다.")
    if isinstance(x, (int, float)):
        v = float(x)
    elif isinstance(x, (str, bytes)):
        raise Fail(f"{label}에는 숫자가 와야 하는데 글자 {short(x)}이(가) 왔습니다.")
    elif _depth >= 3:
        raise Fail(f"{label}을(를) 숫자로 바꾸지 못했습니다({type_name(x)}).")
    else:
        item = try_attr(x, "item")
        if item is not MISSING and callable(item):
            return as_number(student(f"{label}을(를) 숫자로 바꾸기", item), label, _depth + 1)
        data = try_attr(x, "data")
        if data is not MISSING:
            return as_number(data, label, _depth + 1)
        v = student(f"{label}을(를) 숫자로 바꾸기", float, x)
        if not isinstance(v, float):
            raise Fail(f"{label}을(를) 숫자로 바꾸지 못했습니다({type_name(x)}).")
    if not math.isfinite(v):
        raise Fail(f"{label}: 내 값 {v}. 계산 중 숫자가 넘쳤거나 0으로 나눴습니다.")
    return v


def number_list(x, label, min_len=2):
    need(x, label)
    if isinstance(x, (str, bytes)):
        raise Fail(f"{label}에는 숫자 목록이 와야 하는데 글자가 왔습니다.")
    items = student(f"{label} 읽기", list, x)
    if len(items) < min_len:
        raise Fail(f"{label}에 숫자가 {len(items)}개뿐입니다. 반복마다 loss.data 를 목록에 모아 {min_len}개 이상 넘기세요.")
    return [as_number(v, f"{label}[{i}]") for i, v in enumerate(items)]


def close(got, want, tol):
    return abs(got - want) <= tol * max(1.0, abs(want))


# ---- Value 다루기 -----------------------------------------------------------

def is_value_like(x):
    return not is_blank(x) and has_attr(x, "data") and has_attr(x, "grad")


def require_value_like(x, label):
    need(x, label)
    if not is_value_like(x):
        raise Fail(f"{label}이(가) Value가 아닙니다(받은 것: {type_name(x)}). data와 grad가 있는 Value여야 합니다.")
    return x


def make_value(Value, x):
    out = student(f"Value({fmt(x)}) 만들기", Value, x)
    require_value_like(out, f"Value({fmt(x)})")
    return out


def data_of(v, label):
    return as_number(get_attr(v, "data", label), f"{label}.data")


def grad_of(v, label):
    return as_number(get_attr(v, "grad", label), f"{label}.grad")


def set_grad(v, g, label):
    student(f"{label}.grad = {fmt(g)} 넣기", setattr, v, "grad", g)


def prev_of(v, label):
    p = get_attr(v, "_prev", label, hint="__init__에 self._prev = set(_children) 를 넣으세요.")
    if isinstance(p, (str, bytes)) or is_blank(p):
        raise Fail(f"{label}._prev 에는 재료 값들의 모음(set)이 와야 합니다.")
    return student(f"{label}._prev 읽기", list, p)


def same_items(items, expected):
    """두 목록이 같은 객체들(같은 id)인지. _prev 비교용."""
    return sorted(id(x) for x in items) == sorted(id(x) for x in expected)


def walk(root, label="결과 값"):
    """_prev를 따라 root에 이어진 값을 재료부터 결과 순으로 모은다 (학생 backward와 무관한 채점기 자체 정렬)."""
    order, seen, stack = [], set(), [(root, False)]
    while stack:
        node, done = stack.pop()
        if done:
            order.append(node)
            continue
        if id(node) in seen:
            continue
        seen.add(id(node))
        if len(seen) > 100000:
            raise Fail(f"{label}에 이어진 값이 너무 많습니다(10만 개 넘음).")
        stack.append((node, True))
        for child in prev_of(node, "값"):
            if id(child) not in seen:
                stack.append((child, False))
    return order


def drive_backward(root):
    """학생 backward() 대신 채점기가 직접 거꾸로 돈다: 맨 끝 grad = 1.0, 결과부터 재료 순으로 _backward()."""
    order = walk(root)
    set_grad(root, 1.0, "맨 끝 값")
    hint = "__init__에 self._backward = lambda: None 을 넣고, 연산마다 out._backward = _backward 로 넣으세요."
    for node in reversed(order):
        bw = get_attr(node, "_backward", "Value", hint=hint)
        student("_backward() 실행", bw)


# ---- PyTorch 비교 ----------------------------------------------------------

_TORCH = {"tried": False, "mod": None}


def get_torch():
    """torch가 있으면 모듈, 없으면 None. 환경변수 Z2H_NO_TORCH=1 이면 없는 것으로 친다."""
    if os.environ.get("Z2H_NO_TORCH", "") not in ("", "0"):
        return None
    if not _TORCH["tried"]:
        _TORCH["tried"] = True
        try:
            import torch
            _TORCH["mod"] = torch
        except Exception:
            _TORCH["mod"] = None
    return _TORCH["mod"]


class Expr:
    """학생 Value와 PyTorch 텐서 둘 다에 쓸 수 있는 식 하나 (연산자, .tanh(), .exp()만 씀)."""

    def __init__(self, desc, fn, values):
        self.desc = desc
        self.fn = fn
        self.values = tuple(values)
        self.names = fn.__code__.co_varnames[:fn.__code__.co_argcount]


def run_value_expr(Value, expr, use_student_backward):
    leaves = [make_value(Value, v) for v in expr.values]
    out = student(f"식 {expr.desc} 계산", expr.fn, *leaves)
    require_value_like(out, f"식 {expr.desc}의 결과")
    if use_student_backward:
        bw = get_attr(out, "backward", "Value", hint="Value에 backward() 메서드를 넣으세요.")
        student(f"식 {expr.desc}에서 backward() 실행", bw)
    else:
        drive_backward(out)
    return data_of(out, "결과"), [grad_of(leaf, name) for leaf, name in zip(leaves, expr.names)]


def run_torch_expr(torch, expr):
    leaves = [torch.tensor(float(v), dtype=torch.float64, requires_grad=True) for v in expr.values]
    out = expr.fn(*leaves)
    out.backward()
    grads = [float(leaf.grad.item()) if leaf.grad is not None else 0.0 for leaf in leaves]
    return float(out.item()), grads


def compare_with_torch(Value, exprs, use_student_backward, tol, hint=""):
    """식마다 학생 값·기울기를 PyTorch(float64)와 비교. torch가 없으면 False(건너뜀), 다 같으면 True."""
    torch = get_torch()
    if torch is None:
        return False
    extra = f" {hint}" if hint else ""
    for expr in exprs:
        got_out, got_grads = run_value_expr(Value, expr, use_student_backward)
        want_out, want_grads = run_torch_expr(torch, expr)
        if not close(got_out, want_out, tol):
            raise Fail(f"식 {expr.desc} 의 값: 내 값 {fmt(got_out)}, PyTorch {fmt(want_out)}.{extra}")
        for name, got, want in zip(expr.names, got_grads, want_grads):
            if not close(got, want, tol):
                raise Fail(f"식 {expr.desc} 에서 {name}.grad: 내 값 {fmt(got)}, PyTorch {fmt(want)}.{extra}")
    return True


def torch_note(done, count):
    return f" PyTorch와도 식 {count}개에서 같습니다." if done else f" ({TORCH_SKIP_NOTE})"
