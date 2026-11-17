# 출처: 강의 예제 숫자와 학습 데이터는 karpathy/nn-zero-to-hero (lectures/micrograd), PyTorch 기울기 비교 방식은 karpathy/micrograd (test/test_engine.py), 둘 다 MIT License. 식과 채점 코드는 새로 씀.
"""1편 micrograd 채점 함수: 교사 정본(inputs/pedagogy/content/L01.json)의 단계 전부 + 재구성 L01-R1 ~ L01-R3.

- 단계 id·순서·내용은 교사 정본을 따른다. 개수는 아래 @grader 등록 목록(CHECKS)에서 센다(코드에 박지 않음).
- 호출 규약(넘기는 인자)은 각 함수의 usage와 z2h_check/README.md 표가 정본이다.
- 맞으면 짧은 문장을 돌려주고, 다르면 Fail("무엇이 다른지")을 던진다. 학생 코드는 U.student()로만 부른다.
- 기울기는 학생 Value로 계산해 같은 식의 PyTorch 기울기, 또는 손으로 계산한 값(reference/l01.json)과 비교한다.
- 학생 backward()를 시험하는 칸(S11b, R2)만 학생 backward()를 쓰고, 나머지는 채점기가 직접 거꾸로 돈다
  (U.drive_backward). 그래서 backward()가 틀려도 S12·S13 묶음·R1은 그 단계 내용만 따로 채점된다.
"""
import math

from . import _util as U
from .._resources import load_json

CHECKS = []   # [(check_id, title)] 교사 정본 순서(등록 순서 그대로)
GRADERS = {}  # check_id -> 채점 함수
USAGE = {}    # check_id -> 호출 예


def grader(check_id, title, usage):
    def deco(fn):
        CHECKS.append((check_id, title))
        GRADERS[check_id] = fn
        USAGE[check_id] = usage
        return fn
    return deco


def ref():
    return load_json("reference/l01.json")


def tol():
    return ref()["tolerance"]["grad"]


F = U.fmt


# ---- 여러 칸이 같이 쓰는 식 --------------------------------------------------

def _tanh_by_exp(n):
    e = (2 * n).exp()
    return (e - 1) / (e + 1)


# S11b: 덧셈·곱셈·tanh만, 값마다 한 번씩만 쓰는 식 (+= 버그와 섞이지 않게)
TREE_EXPRS = [
    U.Expr("(a*b + c).tanh() * d", lambda a, b, c, d: (a * b + c).tanh() * d, (0.5, -1.5, 0.3, 2.0)),
    U.Expr("(a*b + c*d).tanh() + e", lambda a, b, c, d, e: (a * b + c * d).tanh() + e, (1.2, -0.7, 0.4, 0.9, -2.0)),
    U.Expr("((a*b + c).tanh()*d + e).tanh() * f",
           lambda a, b, c, d, e, f: ((a * b + c).tanh() * d + e).tanh() * f, (0.8, -1.1, 0.2, 1.7, -0.3, 2.5)),
]
# R1, R2: 같은 값을 여러 번 쓰는 식 (완성본은 += 로 쌓아야 맞음)
REUSE_EXPRS = [
    U.Expr("a*a + a*b", lambda a, b: a * a + a * b, (1.5, -2.0)),
    U.Expr("(a*b + b).tanh() * a", lambda a, b: (a * b + b).tanh() * a, (0.7, -1.3)),
    U.Expr("((a + b) * (a * b)).tanh() + b*b", lambda a, b: ((a + b) * (a * b)).tanh() + b * b, (0.4, 0.9)),
]
# S13d: 빼기·나누기·거듭제곱·exp·숫자 섞기를 모두 쓴 식
OPS_EXPRS = [
    U.Expr("(a - b) / c**2", lambda a, b, c: (a - b) / c ** 2, (3.0, -1.5, 2.0)),
    U.Expr("(2*a).exp() - b/3 + c**3", lambda a, b, c: (2 * a).exp() - b / 3 + c ** 3, (0.3, 1.2, -0.8)),
    U.Expr("-a + b**0.5 * c - (a*c).exp()", lambda a, b, c: -a + b ** 0.5 * c - (a * c).exp(), (0.6, 2.0, -1.1)),
    U.Expr("(e - 1)/(e + 1), e = (2*(a*b + c)).exp()", lambda a, b, c: _tanh_by_exp(a * b + c), (0.9, -0.4, 0.2)),
]


def _lecture_neuron(Value):
    """강의 뉴런: x1 = 2, x2 = 0, w1 = -3, w2 = 1, b = 6.8813735870195432, n = x1*w1 + x2*w2 + b."""
    r = ref()["S09"]
    leaves = {k: U.make_value(Value, r[k]) for k in ("x1", "x2", "w1", "w2", "b")}
    n = U.student("n = x1*w1 + x2*w2 + b 계산",
                  lambda: leaves["x1"] * leaves["w1"] + leaves["x2"] * leaves["w2"] + leaves["b"])
    U.require_value_like(n, "n = x1*w1 + x2*w2 + b 의 결과")
    return leaves, n


ORDER_HINT = ("결과 쪽부터 거꾸로 _backward()를 불러야 기울기가 재료로 전해집니다: "
              "for node in reversed(topo): node._backward()")
ROOT_HINT = "backward() 안에서 self.grad = 1.0 을 넣은 뒤 거꾸로 도세요."


def _neuron_mismatch(leaves, n, o):
    """강의 뉴런의 기울기를 손 계산 값과 비교. 다 맞으면 None, 다르면 (이름, 내 값, 맞는 값)."""
    want = ref()["S11b"]["lecture_grads"]
    t = tol()
    for name, node in (("o", o), ("n", n)) + tuple((k, leaves[k]) for k in ("x1", "w1", "x2", "w2", "b")):
        g = U.grad_of(node, name)
        if not U.close(g, want[name], t):
            return name, g, want[name]
    return None


def _neuron_message(mm, extra):
    name, got, want = mm
    if name == "o":
        return f"backward() 뒤 o.grad: 내 값 {F(got)}, 맞는 값 1.0. {ROOT_HINT}"
    tail = " (1 - o²)" if name == "n" else ""
    return f"강의 뉴런의 {name}.grad: 내 값 {F(got)}, 맞는 값 {F(want)}{tail}. {extra}"


def _ops_ok(Value, exprs):
    """채점기가 직접 거꾸로 돌면(학생 backward() 없이) 맞는지. 맞으면 틀린 곳은 backward() 쪽이다."""
    try:
        leaves, n = _lecture_neuron(Value)
        o = U.student("o = n.tanh() 계산", lambda: n.tanh())
        U.require_value_like(o, "n.tanh() 의 결과")
        U.drive_backward(o)
        if _neuron_mismatch(leaves, n, o) is not None:
            return False
        U.compare_with_torch(Value, exprs, False, tol())
        return True
    except U.Fail:
        return False


def _why_backward_wrong(Value, exprs, ops_ref):
    if _ops_ok(Value, exprs):
        return ORDER_HINT
    return f"연산마다의 _backward 가 틀렸습니다. {ops_ref} 를 먼저 맞추세요."


def _check_add_mul_backward(Value, label):
    """+ 와 * 의 _backward를 바로 불러 본다 (out.grad 배수 포함)."""
    r = ref()["S10"]
    t = tol()
    hint_bw = "__init__에 self._backward = lambda: None 을 넣고, + 와 * 안에서 out._backward = _backward 로 넣으세요."
    for og in r["out_grads"]:
        a, b = U.make_value(Value, r["a"]), U.make_value(Value, r["b"])
        c = U.student("c = a*b 계산", lambda: a * b)
        U.require_value_like(c, "a*b 의 결과")
        bw = U.get_attr(c, "_backward", "a*b 의 결과", hint=hint_bw)
        U.set_grad(c, og, "c")
        U.student("c._backward() 실행", bw)
        ga, gb = U.grad_of(a, "a"), U.grad_of(b, "b")
        wa, wb = r["b"] * og, r["a"] * og
        if not (U.close(ga, wa, t) and U.close(gb, wb, t)):
            extra = " 기울기가 0이면 out._backward = _backward 로 넣었는지 보세요." if ga == 0 and gb == 0 else ""
            raise U.Fail(f"{label}곱셈 c = a*b (a = {F(r['a'])}, b = {F(r['b'])}, c.grad = {F(og)}) 뒤 "
                         f"a.grad: 내 값 {F(ga)}, 맞는 값 {F(wa)} / b.grad: 내 값 {F(gb)}, 맞는 값 {F(wb)}. "
                         f"곱셈은 상대 값을 곱해 전합니다: self.grad += other.data * out.grad, "
                         f"other.grad += self.data * out.grad.{extra}")
        a, b = U.make_value(Value, r["a"]), U.make_value(Value, r["b"])
        d = U.student("d = a + b 계산", lambda: a + b)
        U.require_value_like(d, "a + b 의 결과")
        bw = U.get_attr(d, "_backward", "a + b 의 결과", hint=hint_bw)
        U.set_grad(d, og, "d")
        U.student("d._backward() 실행", bw)
        ga, gb = U.grad_of(a, "a"), U.grad_of(b, "b")
        if not (U.close(ga, og, t) and U.close(gb, og, t)):
            raise U.Fail(f"{label}덧셈 d = a + b (d.grad = {F(og)}) 뒤 a.grad: 내 값 {F(ga)}, b.grad: 내 값 {F(gb)}, "
                         f"맞는 값 둘 다 {F(og)}. 덧셈은 기울기를 그대로 전합니다: self.grad += 1.0 * out.grad, "
                         f"other.grad += 1.0 * out.grad.")
    leaf = U.make_value(Value, 1.0)
    bw = U.get_attr(leaf, "_backward", "Value(1.0)", hint=hint_bw)
    U.student("재료 값(Value(1.0))의 _backward() 실행", bw)


def _check_tanh_backward(Value, label):
    r = ref()["S10b"]
    t = tol()
    for x in r["x_values"]:
        for og in r["out_grads"]:
            v = U.make_value(Value, x)
            o = U.student(f"Value({F(x)}).tanh() 계산", lambda: v.tanh())
            U.require_value_like(o, "tanh() 의 결과")
            bw = U.get_attr(o, "_backward", "tanh() 의 결과",
                            hint="tanh 안에서 def _backward(): ... 를 만들고 out._backward = _backward 로 넣으세요.")
            U.set_grad(o, og, "o")
            U.student("o._backward() 실행", bw)
            got = U.grad_of(v, "x")
            th = math.tanh(x)
            want = (1 - th * th) * og
            if not U.close(got, want, t):
                raise U.Fail(f"{label}o = Value({F(x)}).tanh(), o.grad = {F(og)} 뒤 x.grad: 내 값 {F(got)}, "
                             f"맞는 값 {F(want)}. tanh의 기울기는 (1 - t**2) * out.grad 입니다 (t는 tanh 결과).")


# ---- 단계 S01 ~ S16 ---------------------------------------------------------

@grader("L01-S01", "함수 그래프 그리기", 'check("L01-S01", f)')
def s01(f=None, seen=False):
    """f: 그래프를 그린 함수 f(x) = 3x² - 4x + 5. 그림만 눈으로 봤다면 check("L01-S01", seen=True)."""
    if f is None and seen is True:
        return "눈으로 확인했다고 표시했습니다. 그림이 포물선(U자 모양)이면 맞습니다."
    U.need_callable(f, "f", 'check("L01-S01", f)')
    for x, want in ref()["S01"]["f_at"]:
        got = U.as_number(U.student(f"f({F(x)}) 계산", f, x), f"f({F(x)})")
        if not U.close(got, want, tol()):
            raise U.Fail(f"f({F(x)}): 내 값 {F(got)}, 맞는 값 {F(want)}. f(x) = 3*x**2 - 4*x + 5 인지 보세요.")
    return "f(x) = 3x² - 4x + 5 가 맞습니다. 그림은 포물선(U자 모양)이어야 합니다."


@grader("L01-S02", "숫자 기울기", 'check("L01-S02", slope)')
def s02(slope=None):
    """slope: (f(x + h) - f(x)) / h 로 구한 숫자 (x = 3.0, h = 0.0001이면 약 14)."""
    v = U.as_number(slope, "기울기")
    r = ref()["S02"]
    if r["min"] <= v <= r["max"]:
        return f"숫자 기울기 {F(v)}: 약 14가 맞습니다. x를 조금 올리면 f가 약 14배만큼 오릅니다."
    if r["min"] <= -v <= r["max"]:
        hint = "부호가 반대입니다. (f(x + h) - f(x)) / h 순서인지 보세요."
    elif 0 < abs(v) < 0.01:
        hint = "h로 나누는 것을 빠뜨렸나요?"
    else:
        hint = "x = 3.0, h = 0.0001 인지 보세요."
    raise U.Fail(f"기울기: 내 값 {F(v)}, 맞는 값 약 14 ({F(r['min'])}~{F(r['max'])}). {hint}")


@grader("L01-S03", "입력이 여러 개일 때", 'check("L01-S03", slope_a, slope_b=slope_b, slope_c=slope_c)')
def s03(slope_a=None, slope_b=None, slope_c=None):
    """slope_a: a만 h만큼 올려 구한 (d2 - d1) / h (약 -3.0). 선택: slope_b(약 2.0), slope_c(약 1.0)."""
    r = ref()["S03"]
    want = {"a": -3.0, "b": 2.0, "c": 1.0}
    hint = {"a": "a만 h만큼 올린 d2와 비교해 (d2 - d1) / h 를 구하세요. 답은 b의 값(-3.0)입니다.",
            "b": "b만 h만큼 올리면 기울기는 a의 값(2.0)입니다.",
            "c": "c만 h만큼 올리면 기울기는 1.0입니다."}
    done = []
    for name, val in (("a", slope_a), ("b", slope_b), ("c", slope_c)):
        if val is None and name != "a":
            continue
        v = U.as_number(val, f"{name}에 대한 기울기")
        if not r[name]["min"] <= v <= r[name]["max"]:
            raise U.Fail(f"{name}에 대한 기울기: 내 값 {F(v)}, 맞는 값 약 {F(want[name])}. {hint[name]}")
        done.append(f"{name} → {F(want[name])}")
    return "d = a*b + c 의 숫자 기울기가 맞습니다: " + ", ".join(done) + ". d를 a로 미분하면 b의 값입니다."


@grader("L01-S04", "Value 클래스 뼈대", 'check("L01-S04", Value)')
def s04(Value=None):
    """Value: data, grad, _prev, _op, __repr__ 가 있는 클래스."""
    usage = USAGE["L01-S04"]
    U.need_callable(Value, "Value", usage)
    r = ref()["S04"]
    v = U.make_value(Value, r["data"])
    d = U.data_of(v, "Value(2.0)")
    if d != r["data"]:
        raise U.Fail(f"Value(2.0).data: 내 값 {F(d)}, 맞는 값 2.0. self.data = data 인지 보세요.")
    g = U.grad_of(v, "Value(2.0)")
    if g != 0.0:
        raise U.Fail(f"처음 grad: 내 값 {F(g)}, 맞는 값 0.0. self.grad = 0.0 으로 시작하세요.")
    if U.prev_of(v, "Value(2.0)"):
        raise U.Fail("재료 없이 만든 Value(2.0)의 _prev는 비어 있어야 합니다. self._prev = set(_children) 인지 보세요.")
    op = U.get_attr(v, "_op", "Value(2.0)", hint="__init__에 self._op = _op 를 넣으세요.")
    if not (isinstance(op, str) and op == ""):
        raise U.Fail(f"재료 없이 만든 Value(2.0)의 _op: 내 값 {U.short(op)}, 맞는 값 ''(빈 글자).")
    text = U.student("Value(2.0)의 출력 모양 만들기", repr, v)
    if not (isinstance(text, str) and text.startswith(r["repr_prefix"])):
        raise U.Fail(f"출력 모양: 내 값 {U.short(text)}, 맞는 값 'Value(data=2.0)'. "
                     "__repr__에서 f\"Value(data={self.data})\" 를 돌려주세요.")
    a, b = U.make_value(Value, 1.0), U.make_value(Value, 3.0)
    c = U.student("Value(4.0, (a, b), '+') 만들기", Value, 4.0, (a, b), "+")
    U.require_value_like(c, "Value(4.0, (a, b), '+')")
    if not U.same_items(U.prev_of(c, "Value(4.0, (a, b), '+')"), [a, b]):
        raise U.Fail("Value(4.0, (a, b), '+')의 _prev에 a와 b가 들어 있어야 합니다. self._prev = set(_children) 인지 보세요.")
    op = U.get_attr(c, "_op", "Value(4.0, (a, b), '+')")
    if not (isinstance(op, str) and op == "+"):
        raise U.Fail(f"Value(4.0, (a, b), '+')의 _op: 내 값 {U.short(op)}, 맞는 값 '+'. self._op = _op 인지 보세요.")
    return "Value(2.0)이 Value(data=2.0)으로 보이고, data·grad·_prev·_op 칸이 모두 맞습니다."


@grader("L01-S05", "덧셈과 곱셈 기록하기", 'check("L01-S05", Value)')
def s05(Value=None):
    """Value: __add__, __mul__ 이 결과 Value에 재료 (self, other)와 기호 '+', '*' 를 넘기는 클래스."""
    U.need_callable(Value, "Value", USAGE["L01-S05"])
    r = ref()["S05"]
    t = tol()
    a, b, c = U.make_value(Value, r["a"]), U.make_value(Value, r["b"]), U.make_value(Value, r["c"])
    d = U.student("d = a*b + c 계산", lambda: a * b + c)
    U.require_value_like(d, "a*b + c 의 결과")
    dd = U.data_of(d, "d")
    if not U.close(dd, r["d"], t):
        raise U.Fail(f"d = a*b + c (a = 2.0, b = -3.0, c = 10.0): 내 값 {F(dd)}, 맞는 값 4.0. "
                     "__add__는 data를 더하고 __mul__은 곱하나요?")
    op = U.get_attr(d, "_op", "d")
    if not (isinstance(op, str) and op == "+"):
        raise U.Fail(f"d._op: 내 값 {U.short(op)}, 맞는 값 '+'. __add__에서 Value(..., (self, other), '+') 처럼 넘기세요.")
    prev = U.prev_of(d, "d")
    if len(prev) != 2 or not any(p is c for p in prev):
        raise U.Fail("d._prev에 재료 두 개(a*b의 결과와 c)가 있어야 합니다. Value(..., (self, other), '+') 처럼 넘기세요.")
    e = [p for p in prev if p is not c][0]
    ed = U.data_of(e, "a*b")
    if not U.close(ed, r["ab"], t):
        raise U.Fail(f"a*b: 내 값 {F(ed)}, 맞는 값 -6.0.")
    op = U.get_attr(e, "_op", "a*b 의 결과")
    if not (isinstance(op, str) and op == "*"):
        raise U.Fail(f"(a*b)._op: 내 값 {U.short(op)}, 맞는 값 '*'. __mul__에서 Value(..., (self, other), '*') 처럼 넘기세요.")
    if not U.same_items(U.prev_of(e, "a*b 의 결과"), [a, b]):
        raise U.Fail("a*b 의 _prev에 a와 b가 있어야 합니다. Value(..., (self, other), '*') 처럼 넘기세요.")
    return "d = a*b + c 가 4.0이고, d._prev에 재료 두 개, d._op에 '+'가 들어 있습니다."


@grader("L01-S06", "계산 그래프 그림", 'check("L01-S06", draw_dot(d))')
def s06(dot=None, seen=False):
    """dot: draw_dot(d)가 돌려준 graphviz 그림. graphviz를 못 쓰는 곳이면 check("L01-S06", seen=True)."""
    if dot is None and seen is True:
        return "눈으로 확인했다고 표시했습니다. 상자(a, b, c, d)와 동그라미(+, *)가 이어져 있으면 맞습니다."
    U.need(dot, "그림")
    ok_msg = "graphviz 그림입니다. 상자(값)와 동그라미(+, *)가 이어졌는지 눈으로 확인하세요."
    try:
        module = type(dot).__module__
    except Exception:
        module = ""
    if isinstance(module, str) and module.split(".")[0] == "graphviz":
        return ok_msg
    source = U.try_attr(dot, "source")
    if isinstance(source, str) and "digraph" in source:
        return ok_msg
    raise U.Fail(f"graphviz 그림이 아닙니다(받은 것: {U.type_name(dot)}). check(\"L01-S06\", draw_dot(d)) 처럼 "
                 "draw_dot의 결과를 넘기세요.")


@grader("L01-S07", "손으로 기울기 채우기", 'check("L01-S07", a=a, b=b, c=c, d=d, e=e, f=f, L=L)')
def s07(a=None, b=None, c=None, d=None, e=None, f=None, L=None):
    """e = a*b, d = e + c, L = d * f 로 만든 Value 7개. 각 grad를 손으로 채운 뒤 넘긴다."""
    nodes = {"a": a, "b": b, "c": c, "d": d, "e": e, "f": f, "L": L}
    for name, node in nodes.items():
        U.require_value_like(node, name)
    v = {name: U.data_of(node, name) for name, node in nodes.items()}
    g = {name: U.grad_of(node, name) for name, node in nodes.items()}
    t = tol()
    if not (U.close(v["e"], v["a"] * v["b"], t) and U.close(v["d"], v["e"] + v["c"], t)
            and U.close(v["L"], v["d"] * v["f"], t)):
        raise U.Fail("식 모양이 다릅니다. e = a*b, d = e + c, L = d * f 로 만든 값을 넘기세요.")
    want = {"L": 1.0, "f": v["d"], "d": v["f"]}
    want["e"] = want["c"] = want["d"]
    want["a"] = want["e"] * v["b"]
    want["b"] = want["e"] * v["a"]
    hints = {
        "L": "맨 끝 L의 grad는 1.0부터 시작합니다.",
        "f": "L = d * f 이므로 f.grad 는 d의 값입니다.",
        "d": "L = d * f 이므로 d.grad 는 f의 값입니다.",
        "e": "d = e + c 에서 + 노드는 기울기를 그대로 전합니다: e.grad = d.grad",
        "c": "d = e + c 에서 + 노드는 기울기를 그대로 전합니다: c.grad = d.grad",
        "a": "e = a * b 에서 * 노드는 상대 값을 곱해 전합니다: a.grad = e.grad * b.data",
        "b": "e = a * b 에서 * 노드는 상대 값을 곱해 전합니다: b.grad = e.grad * a.data",
    }
    for name in ("L", "f", "d", "e", "c", "a", "b"):
        if not U.close(g[name], want[name], t):
            raise U.Fail(f"{name}.grad: 내 값 {F(g[name])}, 맞는 값 {F(want[name])}. {hints[name]}")
    return "손으로 채운 기울기 7개가 모두 맞습니다. + 노드는 그대로, * 노드는 상대 값을 곱해 전했습니다."


@grader("L01-S08", "한 걸음 움직여 보기", 'check("L01-S08", L)')
def s08(L=None, L_after=None):
    """L: S08 셀을 실행한 뒤의 L (Value 또는 L.data). 움직이기 전 값은 강의 숫자의 -8.0으로 본다.
    숫자를 바꿔 실습했다면 check("L01-S08", L_before, L_after) 처럼 전·후 두 값을 넘긴다."""
    r = ref()["S08"]
    if L_after is None:
        before, after = r["before"], U.as_number(L, "움직인 뒤 L")
    else:
        before, after = U.as_number(L, "움직이기 전 L"), U.as_number(L_after, "움직인 뒤 L")
    if after == before:
        raise U.Fail("L이 그대로입니다. a, b, c, f 를 움직인 뒤 e, d, L 을 다시 계산했나요?")
    if not after > before:
        raise U.Fail(f"L: {F(before)} → {F(after)}. 커져야 합니다. v.data += 0.01 * v.grad 처럼 기울기 방향(+)으로 "
                     "움직였는지, S07에서 grad를 먼저 채웠는지 보세요.")
    if before == r["before"] and not r["after_min"] <= after <= r["after_max"]:
        raise U.Fail(f"움직인 뒤 L: 내 값 {F(after)}, 맞는 값 약 -7.29 ({F(r['after_min'])}~{F(r['after_max'])}). "
                     "a, b, c, f 네 값을 0.01 * grad 만큼씩 움직였는지 보세요.")
    return f"L이 커졌습니다: {F(before)} → {F(after)}. 기울기 방향으로 움직이면 결과가 커집니다."


@grader("L01-S09", "뉴런 하나 계산하기", 'check("L01-S09", n, x1=x1, x2=x2, w1=w1, w2=w2, b=b)')
def s09(n=None, x1=None, x2=None, w1=None, w2=None, b=None):
    """n = x1*w1 + x2*w2 + b 로 계산한 Value와, 그 재료 Value 5개."""
    U.require_value_like(n, "n")
    parts = {"x1": x1, "x2": x2, "w1": w1, "w2": w2, "b": b}
    vals = {}
    for name, node in parts.items():
        U.require_value_like(node, name)
        vals[name] = U.data_of(node, name)
    want = vals["x1"] * vals["w1"] + vals["x2"] * vals["w2"] + vals["b"]
    got = U.data_of(n, "n")
    if not U.close(got, want, tol()):
        raise U.Fail(f"n: 내 값 {F(got)}, 맞는 값 {F(want)}. n = x1*w1 + x2*w2 + b 인지 보세요.")
    reach = {id(x) for x in U.walk(n, "n")}
    missing = [name for name, node in parts.items() if id(node) not in reach]
    if missing:
        raise U.Fail(f"n의 재료에 없는 값: {', '.join(missing)}. 넘긴 Value들로 n = x1*w1 + x2*w2 + b 를 계산하세요.")
    return f"n = x1*w1 + x2*w2 + b 계산이 맞습니다 (n = {F(got)}). 곱셈 두 개와 덧셈이 이어져 있습니다."


@grader("L01-S09b", "tanh 붙이기", 'check("L01-S09b", Value, o=o)')
def s09b(Value=None, o=None):
    """Value: tanh() 메서드가 있는 클래스. 선택: o = n.tanh() 결과."""
    U.need_callable(Value, "Value", USAGE["L01-S09b"])
    t = tol()
    for x in ref()["S09b"]["x_values"]:
        v = U.make_value(Value, x)
        out = U.student(f"Value({F(x)}).tanh() 계산", lambda: v.tanh())
        U.require_value_like(out, f"Value({F(x)}).tanh() 의 결과")
        got = U.data_of(out, "tanh 결과")
        want = math.tanh(x)
        if not U.close(got, want, t):
            raise U.Fail(f"Value({F(x)}).tanh(): 내 값 {F(got)}, 맞는 값 {F(want)}. "
                         "math.tanh(x) 또는 (math.exp(2*x) - 1)/(math.exp(2*x) + 1) 를 쓰세요.")
        if not U.same_items(U.prev_of(out, "tanh 결과"), [v]):
            raise U.Fail("tanh 결과의 재료(_prev)는 자기 자신(self) 하나여야 합니다. Value(t, (self,), 'tanh') 처럼 넘기세요.")
    if o is not None:
        U.require_value_like(o, "o")
        od = U.data_of(o, "o")
        if not -1 < od < 1:
            raise U.Fail(f"o: 내 값 {F(od)}. tanh 결과는 -1과 1 사이여야 합니다.")
    return "tanh 결과가 -1과 1 사이이고, 재료는 자기 자신 하나입니다. tanh의 기울기는 1 - o² 입니다."


@grader("L01-S10", "_backward를 + 와 * 안에 넣기", 'check("L01-S10", Value)')
def s10(Value=None):
    """Value: __init__에 self._backward, + 와 * 안에 _backward 가 있는 클래스."""
    U.need_callable(Value, "Value", USAGE["L01-S10"])
    _check_add_mul_backward(Value, "")
    return "+ 와 * 의 _backward가 기울기를 재료에게 맞게 나눠 줍니다(+ 는 그대로, * 는 상대 값을 곱해)."


@grader("L01-S10b", "tanh의 _backward", 'check("L01-S10b", Value)')
def s10b(Value=None):
    """Value: tanh 안에 _backward 가 있는 클래스."""
    U.need_callable(Value, "Value", USAGE["L01-S10b"])
    _check_tanh_backward(Value, "")
    # 교사 정본의 확인: 강의 뉴런에서 o.grad = 1.0; o._backward(); n._backward() 뒤 n.grad 0.5, b.grad 0.5
    leaves, n = _lecture_neuron(Value)
    o = U.student("o = n.tanh() 계산", lambda: n.tanh())
    U.require_value_like(o, "n.tanh() 의 결과")
    U.set_grad(o, 1.0, "o")
    U.student("o._backward() 실행", U.get_attr(o, "_backward", "o"))
    U.student("n._backward() 실행", U.get_attr(n, "_backward", "n"))
    want = ref()["S11b"]["lecture_grads"]
    for name, node in (("n", n), ("b", leaves["b"])):
        g = U.grad_of(node, name)
        if not U.close(g, want[name], tol()):
            raise U.Fail(f"강의 뉴런에서 o._backward(), n._backward() 뒤 {name}.grad: 내 값 {F(g)}, 맞는 값 0.5. "
                         "tanh 는 (1 - t**2) * out.grad, 덧셈은 out.grad 를 그대로 전합니다.")
    return "tanh의 _backward가 (1 - t²) × out.grad 를 전합니다. 강의 뉴런의 n.grad, b.grad 도 0.5 입니다."


@grader("L01-S11", "위상 정렬", 'check("L01-S11", topo, o)')
def s11(topo=None, o=None):
    """topo: build_topo(o)로 만든 Value 목록, o: 맨 끝 값."""
    U.need(topo, "topo 목록")
    U.require_value_like(o, "o")
    if isinstance(topo, (str, bytes)):
        raise U.Fail("topo 에는 Value 목록이 와야 합니다.")
    items = U.student("topo 목록 읽기", list, topo)
    if not items:
        raise U.Fail("topo 목록이 비어 있습니다. build_topo(o)를 실행한 뒤 topo를 넘기세요.")
    for i, item in enumerate(items):
        U.require_value_like(item, f"topo[{i}]")
    reach_ids = {id(x) for x in U.walk(o, "o")}
    ids = [id(x) for x in items]
    if len(set(ids)) != len(ids):
        raise U.Fail("같은 값이 목록에 두 번 이상 들어 있습니다. visited에 이미 넣은 값은 건너뛰세요.")
    missing = reach_ids - set(ids)
    if missing:
        raise U.Fail(f"o에 이어진 값 {len(missing)}개가 목록에 없습니다. 재료(_prev)를 모두 따라가며 넣으세요.")
    extra = set(ids) - reach_ids
    if extra:
        raise U.Fail(f"o와 이어지지 않은 값 {len(extra)}개가 목록에 있습니다. build_topo(o)로 새로 만든 목록인지 보세요.")
    if ids[-1] != id(o):
        raise U.Fail("맨 끝이 o가 아닙니다. 재료를 먼저 넣고, 결과(o)는 맨 뒤에 와야 합니다.")
    pos = {i: k for k, i in enumerate(ids)}
    for node in items:
        for child in U.prev_of(node, "값"):
            if pos[id(child)] > pos[id(node)]:
                raise U.Fail("재료가 결과보다 뒤에 있습니다. 재료(_prev)를 다 넣은 다음에 자기 자신을 넣으세요 "
                             "(topo.append(v)는 for 문 뒤).")
    return f"값 {len(items)}개가 재료부터 결과 순으로 줄 섰습니다. 맨 끝은 o입니다."


@grader("L01-S11b", "backward() 메서드", 'check("L01-S11b", Value)')
def s11b(Value=None):
    """Value: backward() 메서드(위상 정렬 + self.grad = 1.0 + reversed)가 있는 클래스."""
    U.need_callable(Value, "Value", USAGE["L01-S11b"])
    leaves, n = _lecture_neuron(Value)
    o = U.student("o = n.tanh() 계산", lambda: n.tanh())
    U.require_value_like(o, "n.tanh() 의 결과")
    bw = U.get_attr(o, "backward", "Value", hint="Value에 backward() 메서드를 넣으세요.")
    U.student("o.backward() 실행", bw)
    ops_ref = "L01-S10(+, *)과 L01-S10b(tanh)"
    mm = _neuron_mismatch(leaves, n, o)
    if mm is not None:
        extra = "" if mm[0] == "o" else _why_backward_wrong(Value, TREE_EXPRS, ops_ref)
        raise U.Fail(_neuron_message(mm, extra))
    try:
        done = U.compare_with_torch(Value, TREE_EXPRS, True, tol())
    except U.Fail as exc:
        raise U.Fail(f"{exc.message_ko} {_why_backward_wrong(Value, TREE_EXPRS, ops_ref)}") from None
    return "o.backward() 한 줄로 손으로 구한 기울기와 같은 값이 나옵니다." + U.torch_note(done, len(TREE_EXPRS))


@grader("L01-S12", "같은 값을 두 번 쓰는 버그", 'check("L01-S12", Value)')
def s12(Value=None):
    """Value: += 로 기울기를 쌓는 클래스. 또는 a = Value(3.0); b = a + a; b.backward() 뒤의 a.grad 숫자."""
    U.need(Value, "Value")
    r = ref()["S12"]
    t = tol()
    if not callable(Value):
        g = U.as_number(Value, "a.grad")
        if U.close(g, r["a_plus_a"], t):
            return "a.grad = 2.0 이 맞습니다. 두 길의 기울기를 += 로 더했습니다."
        if U.close(g, 1.0, t):
            raise U.Fail("a.grad: 내 값 1.0, 맞는 값 2.0. _backward 안에서 = 대신 += 로 기울기를 쌓아야 합니다.")
        raise U.Fail(f"a.grad: 내 값 {F(g)}, 맞는 값 2.0. a = Value(3.0); b = a + a; b.backward() 뒤의 a.grad를 넘기세요.")
    a = U.make_value(Value, r["a"])
    b = U.student("b = a + a 계산", lambda: a + a)
    U.require_value_like(b, "a + a 의 결과")
    U.drive_backward(b)
    g = U.grad_of(a, "a")
    if not U.close(g, r["a_plus_a"], t):
        raise U.Fail(f"b = a + a 뒤 a.grad: 내 값 {F(g)}, 맞는 값 2.0. 같은 값이 두 길로 쓰이면 기울기를 더해야 합니다. "
                     "_backward 안의 = 를 += 로 바꾸세요.")
    a = U.make_value(Value, r["a"])
    b = U.student("b = a * a 계산", lambda: a * a)
    U.require_value_like(b, "a * a 의 결과")
    U.drive_backward(b)
    g = U.grad_of(a, "a")
    if not U.close(g, r["a_times_a"], t):
        raise U.Fail(f"b = a * a 뒤 a.grad: 내 값 {F(g)}, 맞는 값 6.0 (2 × a). 곱셈의 _backward 를 보세요(L01-S10): "
                     "self.grad += other.data * out.grad, other.grad += self.data * out.grad 둘 다 += 로 쌓아야 합니다.")
    return "같은 값을 두 번 써도 기울기가 += 로 쌓입니다 (a + a 는 2.0, a * a 는 6.0)."


# S13 ~ S13c 의 연산 하나짜리 식. 숫자는 reference/l01.json 의 cases 에 있고, 식은 여기 이름으로 찾는다.
_ONE_OP = {
    "a + 1": lambda a, b: a + 1,
    "1 + a": lambda a, b: 1 + a,
    "a * 2": lambda a, b: a * 2,
    "2 * a": lambda a, b: 2 * a,
    "a.exp()": lambda a, b: a.exp(),
    "-a": lambda a, b: -a,
    "a - b": lambda a, b: a - b,
    "a - 1": lambda a, b: a - 1,
    "a ** 2": lambda a, b: a ** 2,
    "a ** -1": lambda a, b: a ** -1,
    "a ** 0.5": lambda a, b: a ** 0.5,
    "a / 2": lambda a, b: a / 2,
    "a / b": lambda a, b: a / b,
}
_POW_HINT = "거듭제곱의 기울기는 other * self.data**(other - 1) * out.grad 입니다(__pow__)."
_ONE_OP_HINT = {
    "a + 1": U._WRAP_HINT,
    "1 + a": "숫자 + Value 는 __radd__ 가 필요합니다: def __radd__(self, other): return self + other",
    "a * 2": U._WRAP_HINT,
    "2 * a": "숫자 * Value 는 __rmul__ 이 필요합니다: def __rmul__(self, other): return self * other",
    "a.exp()": "exp 는 Value(math.exp(self.data), (self,), 'exp') 이고 기울기는 out.data * out.grad 입니다.",
    "-a": "__neg__ 는 self * -1 입니다.",
    "a - b": "빼기는 self + (-other) 로 만듭니다(__neg__, __sub__).",
    "a - 1": "빼기는 self + (-other) 로 만듭니다. 숫자를 Value로 감싸는 줄도 필요합니다.",
    "a ** 2": _POW_HINT,
    "a ** -1": _POW_HINT,
    "a ** 0.5": _POW_HINT,
    "a / 2": "나누기는 self * other**-1 로 만듭니다(__truediv__).",
    "a / b": "나누기는 self * other**-1 로 만듭니다(__truediv__). Value ** -1 이 필요해 __pow__ 도 씁니다.",
}


def _check_one_op_cases(Value, cases):
    """cases: [{"expr", "a", "b"(선택), "value", "grad_a", "grad_b"(선택)}]. 값과 기울기를 손 계산 값과 비교."""
    t = tol()
    for case in cases:
        expr = case["expr"]
        fn = _ONE_OP[expr]
        a = U.make_value(Value, case["a"])
        b = U.make_value(Value, case["b"]) if "b" in case else None
        where = f"a = {F(case['a'])}" + (f", b = {F(case['b'])}" if "b" in case else "")
        out = U.student(f"{expr} ({where}) 계산", fn, a, b)
        U.require_value_like(out, f"{expr} 의 결과")
        got = U.data_of(out, expr)
        if not U.close(got, case["value"], t):
            raise U.Fail(f"{expr} ({where}): 내 값 {F(got)}, 맞는 값 {F(case['value'])}. {_ONE_OP_HINT[expr]}")
        U.drive_backward(out)
        grads = [("a", a, case["grad_a"])] + ([("b", b, case["grad_b"])] if b is not None else [])
        for name, node, want in grads:
            g = U.grad_of(node, name)
            if not U.close(g, want, t):
                raise U.Fail(f"{expr} ({where}) 의 기울기 {name}.grad: 내 값 {F(g)}, 맞는 값 {F(want)}. {_ONE_OP_HINT[expr]}")


@grader("L01-S13", "숫자와 섞어 계산하기", 'check("L01-S13", Value)')
def s13(Value=None):
    """Value: 숫자를 Value로 감싸는 줄(__add__, __mul__ 첫 줄)과 __radd__, __rmul__ 이 있는 클래스."""
    U.need_callable(Value, "Value", USAGE["L01-S13"])
    r = ref()["S13"]
    _check_one_op_cases(Value, r["cases"])
    vals = [U.make_value(Value, v) for v in r["sum"]["values"]]
    total = U.student("sum([Value(1.0), Value(2.0), Value(3.0)]) 계산", sum, vals)
    U.require_value_like(total, "sum(...) 의 결과")
    got = U.data_of(total, "sum(...)")
    if not U.close(got, r["sum"]["value"], tol()):
        raise U.Fail(f"sum([Value(1.0), Value(2.0), Value(3.0)]): 내 값 {F(got)}, 맞는 값 6.0. "
                     "sum() 은 0부터 더하므로 __radd__ 가 필요합니다.")
    return "Value와 숫자를 섞어 계산할 수 있습니다(Value(2.0) + 1, 1 + Value(2.0), 2 * Value(3.0)). sum() 도 됩니다."


@grader("L01-S13b", "exp와 빼기", 'check("L01-S13b", Value)')
def s13b(Value=None):
    """Value: exp(와 그 _backward), __neg__, __sub__ 가 있는 클래스."""
    U.need_callable(Value, "Value", USAGE["L01-S13b"])
    _check_one_op_cases(Value, ref()["S13b"]["cases"])
    return "exp 와 빼기(-a, a - b, a - 1)의 값과 기울기가 맞습니다."


@grader("L01-S13c", "거듭제곱과 나누기", 'check("L01-S13c", Value)')
def s13c(Value=None):
    """Value: __pow__(와 그 _backward), __truediv__ 가 있는 클래스."""
    U.need_callable(Value, "Value", USAGE["L01-S13c"])
    _check_one_op_cases(Value, ref()["S13c"]["cases"])
    return "거듭제곱(a ** 2, a ** -1, a ** 0.5)과 나누기(a / 2, a / b)의 값과 기울기가 맞습니다."


@grader("L01-S13d", "tanh를 쪼개서 다시 계산하기", 'check("L01-S13d", Value)')
def s13d(Value=None):
    """Value: exp, 빼기, 나누기, 숫자 섞기가 있는 클래스. 강의 뉴런을 o = (e - 1)/(e + 1) 로 계산해 본다."""
    U.need_callable(Value, "Value", USAGE["L01-S13d"])
    t = tol()
    leaves, n = _lecture_neuron(Value)
    o = U.student("e = (2*n).exp(); o = (e - 1) / (e + 1) 계산", _tanh_by_exp, n)
    U.require_value_like(o, "(e - 1) / (e + 1) 의 결과")
    od = U.data_of(o, "o")
    want_o = ref()["S09b"]["o_lecture"]
    if not U.close(od, want_o, t):
        raise U.Fail(f"o: 내 값 {F(od)}, 맞는 값 {F(want_o)}. e = (2*n).exp(), o = (e - 1) / (e + 1) 인지 보세요.")
    U.drive_backward(o)
    mm = _neuron_mismatch(leaves, n, o)
    if mm is not None:
        raise U.Fail(_neuron_message(mm, "exp, 나누기, 빼기, 더하기의 _backward 를 하나씩 보세요(L01-S13b, L01-S13c). "
                                         "식에서 e 를 두 번 쓰므로 += 로 쌓는지도 보세요."))
    done = U.compare_with_torch(Value, OPS_EXPRS, False, t)
    return ("tanh 를 exp, 빼기, 나누기로 풀어 써도 o = 0.7071, 기울기도 S11b 와 같습니다."
            + U.torch_note(done, len(OPS_EXPRS)))


@grader("L01-S13e", "PyTorch로 비교", 'check("L01-S13e", x1=x1, x2=x2, w1=w1, w2=w2, b=b, o=o)')
def s13e(x1=None, x2=None, w1=None, w2=None, b=None, o=None):
    """x1, x2, w1, w2, b: requires_grad=True 인 PyTorch 텐서(o = torch.tanh(x1*w1 + x2*w2 + b); o.backward() 뒤). o는 선택."""
    torch = U.get_torch()
    if torch is None:
        raise U.Skip("torch가 없어 건너뜀. PyTorch가 있는 곳(Colab 등)에서 다시 실행하면 채점됩니다.")
    names = ("x1", "x2", "w1", "w2", "b")
    tensors = dict(zip(names, (x1, x2, w1, w2, b)))
    vals, grads, low = {}, {}, False
    for name in names:
        tensor = U.need(tensors[name], name)
        if not isinstance(tensor, torch.Tensor):
            raise U.Fail(f"{name} 자리에 PyTorch 텐서가 와야 합니다(받은 것: {U.type_name(tensor)}). "
                         f"torch.tensor([2.0], dtype=torch.double, requires_grad=True) 처럼 만드세요.")
        grad = U.get_attr(tensor, "grad", name)
        if grad is None:
            raise U.Fail(f"{name}.grad 가 비어 있습니다. requires_grad=True 로 만들고 o.backward() 를 실행했나요?")
        if tensor.dtype != torch.float64:
            low = True
        vals[name] = U.as_number(tensor, name)
        grads[name] = U.as_number(grad, f"{name}.grad")
    n = vals["x1"] * vals["w1"] + vals["x2"] * vals["w2"] + vals["b"]
    th = math.tanh(n)
    g = 1 - th * th
    want = {"x1": vals["w1"] * g, "w1": vals["x1"] * g, "x2": vals["w2"] * g, "w2": vals["x2"] * g, "b": g}
    t = ref()["tolerance"]["float32"] if low else tol()
    for name in ("x2", "w2", "x1", "w1", "b"):
        if not U.close(grads[name], want[name], t):
            raise U.Fail(f"{name}.grad: 내 값 {F(grads[name])}, 맞는 값 {F(want[name])}. "
                         "o = torch.tanh(x1*w1 + x2*w2 + b), o.backward() 순서인지 보세요.")
    if o is not None:
        od = U.as_number(o, "o")
        if not U.close(od, th, t):
            raise U.Fail(f"o: 내 값 {F(od)}, 맞는 값 {F(th)}. o = torch.tanh(x1*w1 + x2*w2 + b) 인지 보세요.")
    note = (" (float32 텐서라 소수점 넷째 자리까지만 비교했습니다. dtype=torch.double 로 만들면 micrograd와 소수점 아래까지 같아집니다.)"
            if low else "")
    return "PyTorch로 구한 기울기가 micrograd와 같습니다. 우리가 만든 것이 PyTorch가 하는 일의 핵심입니다." + note


@grader("L01-S14", "Neuron 클래스", 'check("L01-S14", Neuron)')
def s14(Neuron=None):
    """Neuron: Neuron(입력 개수)로 만들고, neuron(x 목록)이 -1~1 사이 Value를 내는 클래스."""
    U.need_callable(Neuron, "Neuron", USAGE["L01-S14"])
    r = ref()["S14"]
    t = tol()
    for case in r["cases"]:
        nin, x = case["nin"], case["x"]
        label = f"Neuron({nin})({x})"
        for _ in range(r["repeat"]):
            neuron = U.student(f"Neuron({nin}) 만들기", Neuron, nin)
            out = U.student(f"{label} 계산", neuron, list(x))
            U.require_value_like(out, f"{label} 의 결과")
            od = U.data_of(out, label)
            if not -1 < od < 1:
                raise U.Fail(f"{label}: 내 값 {F(od)}. -1과 1 사이여야 합니다. 마지막에 tanh() 를 했나요?")
            w, bias = U.try_attr(neuron, "w"), U.try_attr(neuron, "b")
            if w is U.MISSING or bias is U.MISSING:
                continue
            ws = U.student("neuron.w 읽기", list, w)
            if len(ws) != nin:
                raise U.Fail(f"Neuron({nin}) 의 w 개수: 내 값 {len(ws)}개, 맞는 값 {nin}개. 입력마다 가중치가 하나씩 있어야 합니다.")
            act = sum(U.data_of(wi, "w") * xi for wi, xi in zip(ws, x)) + U.data_of(bias, "b")
            want = math.tanh(act)
            if not U.close(od, want, t):
                raise U.Fail(f"{label}: 내 값 {F(od)}, 맞는 값 {F(want)} (tanh(w·x + b)). "
                             "w와 x를 곱해 더하고 b를 더한 뒤 tanh() 를 했나요?")
    return "Neuron(2)([2.0, 3.0]) 이 -1과 1 사이 Value를 냅니다. tanh(w·x + b) 계산도 맞습니다."


@grader("L01-S14b", "Layer 클래스", 'check("L01-S14b", Layer)')
def s14b(Layer=None):
    """Layer: Layer(입력, 출력)로 만들고, layer(x 목록)이 Value 목록(출력 개수만큼)을 내는 클래스."""
    U.need_callable(Layer, "Layer", USAGE["L01-S14b"])
    for case in ref()["S14b"]["cases"]:
        nin, nout, x = case["nin"], case["nout"], case["x"]
        label = f"Layer({nin}, {nout})({x})"
        layer = U.student(f"Layer({nin}, {nout}) 만들기", Layer, nin, nout)
        outs = U.student(f"{label} 계산", layer, list(x))
        U.need(outs, f"{label} 의 결과")
        if U.is_value_like(outs) or isinstance(outs, (str, bytes)):
            raise U.Fail(f"{label} 의 결과가 목록이 아닙니다. 뉴런 {nout}개의 결과를 목록으로 돌려주세요.")
        items = U.student(f"{label} 의 결과 읽기", list, outs)
        if len(items) != nout:
            raise U.Fail(f"{label} 의 결과 개수: 내 값 {len(items)}개, 맞는 값 {nout}개. 뉴런을 출력 개수만큼 만드세요.")
        for i, item in enumerate(items):
            U.require_value_like(item, f"{label}[{i}]")
            d = U.data_of(item, f"{label}[{i}]")
            if not -1 < d < 1:
                raise U.Fail(f"{label}[{i}]: 내 값 {F(d)}. 뉴런 결과는 -1과 1 사이여야 합니다.")
    return "Layer(2, 3)([2.0, 3.0]) 이 Value 3개를 냅니다. 층은 같은 입력을 보는 뉴런 묶음입니다."


def _param_breakdown(nin, nouts):
    sizes = [nin] + list(nouts)
    return ", ".join(f"{a}→{b}: {(a + 1) * b}개" for a, b in zip(sizes, sizes[1:]))


def _parameters(model, label):
    fn = U.get_attr(model, "parameters", label, hint="Neuron, Layer, MLP 세 클래스 모두에 parameters() 를 넣으세요.")
    params = U.student(f"{label}.parameters() 실행", fn)
    U.need(params, f"{label}.parameters() 의 결과")
    return U.student(f"{label}.parameters() 의 결과 읽기", list, params)


@grader("L01-S14c", "MLP 클래스와 parameters()", 'check("L01-S14c", MLP)')
def s14c(MLP=None):
    """MLP: MLP(입력, [층별 출력])로 만들고 parameters() 가 모든 w, b 를 돌려주는 클래스."""
    U.need_callable(MLP, "MLP", USAGE["L01-S14c"])
    r = ref()["S14c"]
    for case in r["cases"]:
        nin, nouts, want = case["nin"], case["nouts"], case["count"]
        label = f"MLP({nin}, {nouts})"
        model = U.student(f"{label} 만들기", MLP, nin, list(nouts))
        params = _parameters(model, label)
        if len(params) != want:
            if len(params) == want - sum(nouts):
                extra = " 뉴런 수만큼 모자랍니다. Neuron.parameters() 가 w와 b를 모두 돌려주나요? (return self.w + [self.b])"
            else:
                extra = " Neuron, Layer, MLP 세 클래스 모두에 parameters() 가 있고, 층마다 다 모으나요?"
            raise U.Fail(f"{label} 의 parameters() 개수: 내 값 {len(params)}개, 맞는 값 {want}개 "
                         f"({_param_breakdown(nin, nouts)}).{extra}")
        if len({id(p) for p in params}) != len(params):
            raise U.Fail(f"{label}.parameters() 에 같은 값이 두 번 들어 있습니다.")
        for i, p in enumerate(params):
            U.require_value_like(p, f"{label}.parameters()[{i}]")
    model = U.student("MLP(3, [4, 4, 1]) 만들기", MLP, 3, [4, 4, 1])
    x = r["x"]
    out = U.student(f"MLP(3, [4, 4, 1])({x}) 계산", model, list(x))
    U.need(out, "MLP 출력")
    if not U.is_value_like(out) and not isinstance(out, (str, bytes)):
        items = U.student("MLP 출력 읽기", list, out)
        if len(items) != 1:
            raise U.Fail(f"MLP(3, [4, 4, 1]) 의 출력 개수: 내 값 {len(items)}개, 맞는 값 1개.")
        out = items[0]
    U.require_value_like(out, "MLP(3, [4, 4, 1]) 의 출력")
    d = U.data_of(out, "MLP 출력")
    if not -1 < d < 1:
        raise U.Fail(f"MLP(3, [4, 4, 1]) 의 출력: 내 값 {F(d)}. -1과 1 사이여야 합니다.")
    return "MLP(3, [4, 4, 1]) 의 파라미터가 41개입니다(3→4: 16개, 4→4: 20개, 4→1: 5개). 출력도 -1과 1 사이 Value입니다."


def _model_loss(model, label):
    """S15 데이터(xs, ys)로 손실 = (예측 - 정답)² 의 합을 채점기가 숫자로 다시 계산한다(학생 forward 만 씀)."""
    data = ref()["S15"]
    total = 0.0
    for x, y in zip(data["xs"], data["ys"]):
        out = U.student(f"{label}({x}) 계산", model, list(x))
        U.need(out, f"{label} 출력")
        if not U.is_value_like(out) and not isinstance(out, (str, bytes)):
            items = U.student(f"{label} 출력 읽기", list, out)
            if len(items) != 1:
                raise U.Fail(f"{label} 출력 개수: 내 값 {len(items)}개, 맞는 값 1개.")
            out = items[0]
        total += (U.as_number(out, f"{label} 출력") - y) ** 2
    return total


def _check_mlp_41(model, label):
    U.need(model, label)
    want = ref()["S15"]["params"]
    params = _parameters(model, label)
    if len(params) != want:
        raise U.Fail(f"{label} 의 parameters() 개수: 내 값 {len(params)}개, 맞는 값 {want}개 "
                     f"({_param_breakdown(3, [4, 4, 1])}). {label} = MLP(3, [4, 4, 1]) 인지, "
                     "Neuron.parameters() 가 w와 b를 모두 돌려주는지 보세요.")


def _loss_number(loss, label):
    v = U.as_number(loss, label)
    if v < 0:
        raise U.Fail(f"{label}: 내 값 {F(v)}. 손실은 0보다 작을 수 없습니다. (yout - ygt)**2 를 더했나요?")
    if v >= ref()["S15"]["loss_upper_bound"]:
        raise U.Fail(f"{label}: 내 값 {F(v)}. 데이터 4개, 정답 ±1, tanh 출력이면 손실은 16보다 작아야 합니다. "
                     "S15의 xs, ys 와 MLP(3, [4, 4, 1]) 를 썼나요?")
    return v


def _check_trained(n, loss, limit, more):
    """학습 뒤 n 과 마지막 loss. 마지막 손실과, 넘긴 n 으로 다시 계산한 손실이 둘 다 limit 미만이어야 한다."""
    _check_mlp_41(n, "n")
    last = _loss_number(loss, "마지막 loss")
    if not last < limit:
        raise U.Fail(f"마지막 손실: 내 값 {F(last)}, 기준 {F(limit)} 미만. {more} 손실이 줄지 않고 커지면 갱신이 "
                     "p.data += -0.05 * p.grad (빼기)인지, p.grad = 0.0 이 loss.backward() 앞에 있는지 보세요.")
    now = _model_loss(n, "n")
    if not now < limit:
        raise U.Fail(f"넘긴 n 으로 다시 계산한 손실: {F(now)}. {F(limit)} 미만이어야 합니다. 학습한 그 n 과 마지막 loss 를 함께 넘기세요.")
    return last


_S15_START = {}  # id(n) -> (n, S15 칸에서 통과한 시작 손실). S15b 가 "줄었는지" 비교에 쓴다


@grader("L01-S15", "데이터와 손실", 'check("L01-S15", n, loss)')
def s15(n=None, loss=None):
    """n: MLP(3, [4, 4, 1]) (학습 전), loss: S15 데이터로 계산한 손실(Value 또는 숫자). 학습(S15b) 전에 채점한다.
    통과하면 이 n 의 시작 손실을 기억해 두었다가 L01-S15b 에서 손실이 줄었는지 비교한다."""
    _check_mlp_41(n, "n")
    lv = _loss_number(loss, "loss")
    again = _model_loss(n, "n")
    if not U.close(lv, again, tol()):
        raise U.Fail(f"loss: 내 값 {F(lv)}, 넘긴 n 으로 다시 계산한 값 {F(again)}. "
                     "loss = sum((yout - ygt)**2 for ygt, yout in zip(ys, ypred)) 인지, xs·ys 가 S15 데이터인지 보세요. "
                     "학습(S15b) 전에 바로 채점해야 합니다.")
    _S15_START[id(n)] = (n, lv)
    return (f"파라미터 41개, 손실 {F(lv)}: 예측과 정답 차이를 제곱해 더한 값입니다"
            "(시작값이 무작위라 실행마다 다르고 보통 1에서 8 사이).")


@grader("L01-S15b", "학습 반복", 'check("L01-S15b", n, loss)')
def s15b(n=None, loss=None, start=None):
    """n: 학습한 MLP(3, [4, 4, 1]), loss: 학습 셀이 마지막으로 계산한 손실(Value 또는 숫자).
    시작 손실은 같은 n 으로 통과한 L01-S15 칸이 기억한 값을 쓴다. 그 칸을 거치지 않았다면 start=처음 손실 로 넘긴다.
    교사 정본에 시드 고정이 없어 손실이 줄었는지만 본다(reference S15b.last_loss_max 가 null 이 아니면 그 기준도 본다)."""
    _check_mlp_41(n, "n")
    _loss_number(loss, "마지막 loss")
    if start is not None:
        first = _loss_number(start, "start(처음 손실)")
    else:
        saved = _S15_START.get(id(n))
        if saved is None or saved[0] is not n:
            raise U.Fail("처음 손실을 모릅니다. 학습하기 전에 같은 n 으로 L01-S15 채점 칸을 먼저 통과하거나, "
                         "check(\"L01-S15b\", n, loss, start=처음 손실) 처럼 넘기세요.")
        first = saved[1]
    now = _model_loss(n, "n")
    if not now < first:
        if abs(now - first) <= ref()["S16"]["min_difference"]:
            why = "손실이 그대로입니다. loss.backward() 뒤에 p.grad 가 채워지는지(L01-S11b), 갱신 줄이 있는지 보세요."
        else:
            why = ("갱신이 p.data += -0.05 * p.grad (빼기)인지, p.grad = 0.0 이 loss.backward() 앞에 있는지 보세요.")
        raise U.Fail(f"손실이 줄지 않았습니다: 처음 {F(first)} → 지금 n 으로 다시 계산한 손실 {F(now)}. {why}")
    r = ref()["S15b"]
    limit = r["last_loss_max"]
    if limit is not None and not now < limit:
        raise U.Fail(f"지금 손실: 내 값 {F(now)}, 기준 {F(limit)} 미만. 학습 셀을 한 번 더 실행해 20번 더 학습한 뒤 다시 채점하세요.")
    hint_max = r["teacher_value_range"][1]
    note = ("" if now < hint_max else
            f" 교사 안내: {F(hint_max)} 위면 학습 셀을 한 번 더 실행해 20번 더 학습해 보세요(채점은 줄었는지만 봅니다).")
    return (f"손실이 줄었습니다: 처음 {F(first)} → 지금 {F(now)}.{note} 순전파, grad 비우기, 역전파, 갱신을 되풀이하는 것이 "
            "학습의 전부입니다.")


@grader("L01-S16", "grad 비우기를 빼먹는 버그", 'check("L01-S16", seen=True)')
def s16(losses_ok=None, losses_no_zero=None, seen=False):
    """교사 정본은 눈으로 비교하는 단계라 check("L01-S16", seen=True) 로 표시한다.
    손실 목록을 모았다면 check("L01-S16", losses_ok, losses_no_zero) 로 두 목록이 다른지 확인한다."""
    if losses_ok is None and losses_no_zero is None and seen is True:
        return ("눈으로 비교했다고 표시했습니다. grad 를 비우지 않으면 기울기가 반복마다 쌓여(+=) 손실이 고르게 줄지 않고 "
                "튀곤 합니다. # 을 지워 되돌리고 다시 실행했는지 보세요.")
    a = U.number_list(losses_ok, "첫 번째 손실 목록(grad를 비운 학습)")
    b = U.number_list(losses_no_zero, "두 번째 손실 목록(grad를 비우지 않은 학습)")
    if losses_ok is losses_no_zero:
        raise U.Fail("두 칸에 같은 목록을 넘겼습니다. 두 번째는 p.grad = 0.0 줄을 막고 새로 돌린 손실 목록이어야 합니다.")
    if not a[-1] < a[0]:
        raise U.Fail(f"첫 번째 목록(grad를 비운 정상 학습)의 손실이 줄지 않았습니다: {F(a[0])} → {F(a[-1])}. "
                     "S15b와 같은 학습인지 보세요.")
    count = min(len(a), len(b))
    diff = max(abs(x - y) for x, y in zip(a[:count], b[:count]))
    if diff <= ref()["S16"]["min_difference"] and len(a) == len(b):
        raise U.Fail("두 손실 목록이 똑같습니다. 두 번째는 p.grad = 0.0 줄을 막고 다시 돌린 결과여야 합니다.")
    return "grad를 비우지 않으면 손실이 다르게 움직입니다. 기울기가 반복마다 쌓이기(+=) 때문에 매번 비워야 합니다."


# ---- 재구성 3조각 -------------------------------------------------------------

@grader("L01-R1", "Value에 +, *, tanh와 각각의 _backward", 'check("L01-R1", Value)')
def r1(Value=None):
    """Value: 빈 노트북에서 다시 만든 __add__, __mul__, tanh 와 각각의 _backward (backward() 는 없어도 됨)."""
    U.need_callable(Value, "Value", USAGE["L01-R1"])
    t = tol()
    a, b = U.make_value(Value, 2.0), U.make_value(Value, -3.0)
    for desc, fn, want in (("a + b", lambda: a + b, -1.0), ("a * b", lambda: a * b, -6.0)):
        out = U.student(f"{desc} 계산", fn)
        U.require_value_like(out, f"{desc} 의 결과")
        got = U.data_of(out, desc)
        if not U.close(got, want, t):
            raise U.Fail(f"{desc} (a = 2.0, b = -3.0): 내 값 {F(got)}, 맞는 값 {F(want)}.")
    x = U.make_value(Value, 0.5)
    o = U.student("Value(0.5).tanh() 계산", lambda: x.tanh())
    U.require_value_like(o, "tanh() 의 결과")
    got = U.data_of(o, "Value(0.5).tanh()")
    if not U.close(got, math.tanh(0.5), t):
        raise U.Fail(f"Value(0.5).tanh(): 내 값 {F(got)}, 맞는 값 {F(math.tanh(0.5))}.")
    _check_add_mul_backward(Value, "")
    _check_tanh_backward(Value, "")
    # += 로 쌓기: _backward 를 두 번 부르면 두 배
    a, b = U.make_value(Value, 2.0), U.make_value(Value, -3.0)
    c = U.student("c = a*b 계산", lambda: a * b)
    bw = U.get_attr(c, "_backward", "a*b 의 결과")
    U.set_grad(c, 1.0, "c")
    U.student("c._backward() 실행", bw)
    U.student("c._backward() 한 번 더 실행", bw)
    ga = U.grad_of(a, "a")
    if not U.close(ga, -6.0, t):
        raise U.Fail(f"c = a*b 에서 c._backward() 를 두 번 부른 뒤 a.grad: 내 값 {F(ga)}, 맞는 값 -6.0. "
                     "_backward 안에서 = 대신 += 로 쌓아야 합니다.")
    a = U.make_value(Value, 3.0)
    s = U.student("b = a + a 계산", lambda: a + a)
    U.require_value_like(s, "a + a 의 결과")
    U.drive_backward(s)
    ga = U.grad_of(a, "a")
    if not U.close(ga, 2.0, t):
        raise U.Fail(f"b = a + a 뒤 a.grad: 내 값 {F(ga)}, 맞는 값 2.0. _backward 안에서 = 대신 += 로 쌓아야 합니다.")
    # 강의 뉴런 (채점기가 직접 거꾸로 돈다)
    leaves, n = _lecture_neuron(Value)
    o = U.student("o = n.tanh() 계산", lambda: n.tanh())
    U.require_value_like(o, "n.tanh() 의 결과")
    U.drive_backward(o)
    mm = _neuron_mismatch(leaves, n, o)
    if mm is not None:
        raise U.Fail(_neuron_message(mm, "각 연산의 _backward 를 다시 보세요."))
    done = U.compare_with_torch(Value, REUSE_EXPRS, False, t,
                                hint="같은 값을 여러 번 쓰는 식입니다. _backward 안에서 += 로 쌓나요?")
    return ("__add__, __mul__, tanh 와 각각의 _backward 가 원본 micrograd 와 같은 기울기를 냅니다."
            + U.torch_note(done, len(REUSE_EXPRS)))


@grader("L01-R2", "위상 정렬을 쓰는 backward()", 'check("L01-R2", Value)')
def r2(Value=None):
    """Value: 빈 노트북에서 다시 만든 backward() (위상 정렬, self.grad = 1.0, reversed) 가 있는 클래스."""
    U.need_callable(Value, "Value", USAGE["L01-R2"])
    t = tol()
    bw_hint = "Value에 backward() 메서드를 넣으세요."
    leaves, n = _lecture_neuron(Value)
    o = U.student("o = n.tanh() 계산", lambda: n.tanh())
    U.require_value_like(o, "n.tanh() 의 결과")
    U.student("o.backward() 실행", U.get_attr(o, "backward", "Value", hint=bw_hint))
    ops_ref = "L01-R1(연산과 _backward)"
    mm = _neuron_mismatch(leaves, n, o)
    if mm is not None:
        extra = "" if mm[0] == "o" else _why_backward_wrong(Value, REUSE_EXPRS, ops_ref)
        raise U.Fail(_neuron_message(mm, extra))
    r = ref()["R2"]["diamond"]

    def diamond_grads(use_student_backward):
        vals = {k: U.make_value(Value, r[k]) for k in ("a", "b", "c", "d")}

        def build():
            x = vals["a"] * vals["b"]
            return (x + vals["c"]) + (x * vals["d"])

        w = U.student("x = a*b; w = (x + c) + (x * d) 계산", build)
        U.require_value_like(w, "w")
        if use_student_backward:
            U.student("w.backward() 실행", U.get_attr(w, "backward", "Value", hint=bw_hint))
        else:
            U.drive_backward(w)
        return {k: U.grad_of(v, k) for k, v in vals.items()}

    got = diamond_grads(True)
    for name in ("a", "b", "c", "d"):
        if not U.close(got[name], r["grads"][name], t):
            ops = diamond_grads(False)
            if all(U.close(ops[k], r["grads"][k], t) for k in ops):
                why = "연산은 맞으니 backward() 쪽입니다. 위상 정렬에서 visited 로 같은 값을 한 번만 넣나요?"
            else:
                why = "같은 값을 두 길로 쓰면 기울기를 더해야 합니다. _backward 에서 += 로 쌓나요? (L01-R1)"
            raise U.Fail(f"x = a*b 를 두 길로 쓰는 식 w = (x + c) + (x * d) 에서 {name}.grad: 내 값 {F(got[name])}, "
                         f"맞는 값 {F(r['grads'][name])}. {why}")
    single = U.make_value(Value, 3.0)
    U.student("Value(3.0).backward() 실행", U.get_attr(single, "backward", "Value", hint=bw_hint))
    g = U.grad_of(single, "Value(3.0)")
    if not U.close(g, 1.0, t):
        raise U.Fail(f"재료 없는 Value(3.0).backward() 뒤 grad: 내 값 {F(g)}, 맞는 값 1.0. self.grad = 1.0 을 넣으세요.")
    try:
        done = U.compare_with_torch(Value, REUSE_EXPRS, True, t)
    except U.Fail as exc:
        raise U.Fail(f"{exc.message_ko} {_why_backward_wrong(Value, REUSE_EXPRS, ops_ref)}") from None
    return "위상 정렬을 쓰는 backward() 가 원본 micrograd 와 같은 기울기를 냅니다." + U.torch_note(done, len(REUSE_EXPRS))


_R3_PASSED = {}  # id(n) -> (n, 통과한 학습 셀 실행 번째). 기준 횟수를 넘긴 뒤 다시 확인해도 통과 기록을 지우지 않으려고 기억한다


def _runs_number(runs):
    """학습 셀 실행 횟수(1 이상 정수)."""
    if isinstance(runs, bool) or not isinstance(runs, int):
        raise U.Fail(f"runs 에는 학습 셀을 실행한 횟수(1 이상 정수)가 와야 합니다(받은 것: {U.type_name(runs)}). "
                     f"이렇게 부르세요: {USAGE['L01-R3']}")
    if runs < 1:
        raise U.Fail(f"runs: 내 값 {runs}. 학습 셀을 실행한 횟수는 1 이상이어야 합니다.")
    return runs


@grader("L01-R3", "MLP(3, [4,4,1]) 학습으로 손실 0.1 아래", 'check("L01-R3", n, loss, runs=runs)')
def r3(n=None, loss=None, runs=None):
    """n: 빈 노트북에서 다시 만들어 학습한 MLP(3, [4, 4, 1]), loss: 학습 셀이 마지막으로 계산한 손실(Value 또는 숫자),
    runs: 그 n 으로 학습 셀을 몇 번 실행했는지(1 이상, 노트북은 셀 실행을 세어 넣는다).

    교사 정본 L01-R3: 학습 셀(steps_per_run 번 반복)은 최대 max_reruns 번 다시 실행해도 되고, 다시 실행은 힌트로 세지 않는다.
    - runs 번째 안에서 마지막 손실이 기준 미만이면 통과.
    - 아직 기준 위이고 runs < max_reruns 면 "○ 아직"(기록하지 않음: 결과코드·서버·시도 횟수에 안 들어감).
    - runs == max_reruns 인데 기준 위면 "✕ 다시"(구현을 의심하고 힌트로).
    - runs > max_reruns 면 통과로 치지 않는다(처음부터 다시). 같은 n 이 기준 안에서 이미 통과했다면 그 기록은 두고 "○ 참고"만.
    - runs 를 모르면(None, 셀 실행을 셀 수 없는 곳) 손실만 본다."""
    r = ref()["R3"]
    limit, max_runs, steps = r["last_loss_max"], r["max_reruns"], r["steps_per_run"]
    if runs is None:
        last = _check_trained(n, loss, limit, f"학습 셀({steps}번 반복)은 최대 {max_runs}번까지 다시 실행해도 됩니다. "
                                              "학습 셀을 한 번 더 실행한 뒤 다시 확인하세요.")
        return (f"MLP(3, [4, 4, 1]) 학습 손실이 {F(limit)} 아래로 내려갔습니다(마지막 손실 {F(last)}). "
                "학습 셀을 몇 번 실행했는지는 셀 수 없어 손실만 봤습니다.")
    k = _runs_number(runs)
    _check_mlp_41(n, "n")
    last = _loss_number(loss, "마지막 loss")
    now = _model_loss(n, "n")
    if last < limit and not now < limit:
        raise U.Fail(f"넘긴 n 으로 다시 계산한 손실: {F(now)}. {F(limit)} 미만이어야 합니다. 학습한 그 n 과 마지막 loss 를 함께 넘기세요.")
    where = f"학습 셀 {k}번째 실행(합계 {k * steps}번 반복)"
    total = f"학습 셀 {max_runs}번(합계 {max_runs * steps}번 반복)"
    if k > max_runs:
        passed = _R3_PASSED.get(id(n))
        if passed is not None and passed[0] is n:
            raise U.NotYet(f"이 n 은 학습 셀 {passed[1]}번째 실행에서 이미 통과했습니다. 지금은 {k}번째라 기준({max_runs}번)을 넘었고, "
                           "그 뒤로 더 학습한 결과는 따로 채점하지 않습니다. 통과 기록은 그대로입니다.", mark="○ 참고")
        raise U.Fail(f"{where}입니다. 재구성 기준은 {total} 안이라 이번 결과는 통과로 치지 않습니다(마지막 손실 {F(last)}). "
                     "처음부터 다시 만들어 보세요: 만들기 셀부터 다시 실행하면 새 n 으로 1번째부터 다시 셉니다.")
    if last < limit:
        first = _R3_PASSED.get(id(n))
        if first is None or first[0] is not n:  # 같은 n 이 처음 통과한 번째를 기억한다
            _R3_PASSED[id(n)] = (n, k)
        return (f"{where}에서 손실이 {F(limit)} 아래로 내려갔습니다(마지막 손실 {F(last)}). "
                "학습 셀을 다시 실행한 횟수는 힌트로 세지 않습니다. 더 실행하지 않아도 됩니다.")
    if k < max_runs:
        raise U.NotYet(f"마지막 손실 {F(last)}, 목표는 {F(limit)} 미만입니다({where}). 학습 셀만 한 번 더 실행한 뒤 이 셀을 다시 "
                       f"실행하세요(앞으로 {max_runs - k}번 더 됩니다). 다시 실행은 힌트로 세지 않습니다. "
                       "만들기 셀을 다시 실행하면 새 n 이라 처음부터 셉니다.")
    raise U.Fail(f"{total} 실행해도 마지막 손실이 {F(last)} 로 {F(limit)} 위입니다. 정답 구현은 거의 언제나 이 안에 내려가니 "
                 "구현을 의심해 보세요: 갱신이 p.data += -0.05 * p.grad (빼기)인지, p.grad = 0.0 이 loss.backward() 앞에 있는지, "
                 "Neuron·Layer·MLP 의 parameters() 가 모든 w, b 를 모으는지. 막히면 앱에서 이 조각의 힌트 H1부터 보세요. "
                 "구현이 맞아 보이면 드물게 시작값 탓일 수 있으니 만들기 셀부터 다시 실행해 새 n 으로 해 보세요.")
