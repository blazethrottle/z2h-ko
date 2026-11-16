"""정답 노트북이 하는 일을 흉내 내어 1편 채점 칸을 교사 정본 순서대로 부른다 (테스트 전용).

z2h_check/README.md 의 호출 규약 표와 같은 모양으로 부른다. 노트북 작업자가 채점 셀을 쓸 때
이 파일을 예시로 봐도 된다.
"""
import random

R3_STEPS = 200  # 재구성 3: 손실 0.1 아래까지 충분히 반복


def mse_loss(model, xs, ys):
    """교사 정본 S15 의 손실: sum((yout - ygt)**2 for ygt, yout in zip(ys, ypred))"""
    ypred = [model(x) for x in xs]
    return sum((yout - ygt)**2 for ygt, yout in zip(ys, ypred))


def _draw_dot(root):
    """graphviz가 있으면 강의 draw_dot과 같은 종류(Digraph)의 그림을 만든다. 없으면 None."""
    try:
        from graphviz import Digraph
    except Exception:
        return None
    dot = Digraph(format="svg", graph_attr={"rankdir": "LR"})
    seen = set()
    stack = [root]
    while stack:
        v = stack.pop()
        if id(v) in seen:
            continue
        seen.add(id(v))
        dot.node(name=str(id(v)), label="{ data %.4f | grad %.4f }" % (v.data, v.grad), shape="record")
        for child in v._prev:
            dot.edge(str(id(child)), str(id(v)))
            stack.append(child)
    return dot


def lecture_neuron(Value):
    x1 = Value(2.0); x2 = Value(0.0)
    w1 = Value(-3.0); w2 = Value(1.0)
    b = Value(6.8813735870195432)
    n = x1*w1 + x2*w2 + b
    return dict(x1=x1, x2=x2, w1=w1, w2=w2, b=b, n=n)


def run(ns, check, torch=None, seed=0, skip=()):
    """ns: Value·Neuron·Layer·MLP·build_topo·f·train 이 든 모듈. 반환: {check_id: check() 결과}."""
    Value, Neuron, Layer, MLP = ns.Value, ns.Neuron, ns.Layer, ns.MLP
    out = {}

    def call(cid, *args, **kwargs):
        if cid not in skip:
            out[cid] = check(cid, *args, **kwargs)

    # S01~S03: 숫자 기울기
    call("L01-S01", ns.f)
    h = 0.0001
    x = 3.0
    call("L01-S02", (ns.f(x + h) - ns.f(x)) / h)
    a, b, c = 2.0, -3.0, 10.0
    d = a*b + c
    call("L01-S03", ((a + h)*b + c - d) / h,
         slope_b=(a*(b + h) + c - d) / h, slope_c=(a*b + (c + h) - d) / h)

    # S04~S06: Value 뼈대와 그림
    call("L01-S04", Value)
    call("L01-S05", Value)
    a = Value(2.0); b = Value(-3.0); c = Value(10.0)
    d = a*b + c
    dot = _draw_dot(d)
    if dot is not None:
        call("L01-S06", dot)
    else:
        call("L01-S06", seen=True)

    # S07: 손으로 기울기 채우기
    a = Value(2.0); b = Value(-3.0); c = Value(10.0)
    e = a*b
    d = e + c
    f = Value(-2.0)
    L = d * f
    L.grad = 1.0
    f.grad = d.data
    d.grad = f.data
    e.grad = d.grad
    c.grad = d.grad
    a.grad = e.grad * b.data
    b.grad = e.grad * a.data
    call("L01-S07", a=a, b=b, c=c, d=d, e=e, f=f, L=L)

    # S08: 한 걸음 (강의 숫자라 움직이기 전 L = -8.0)
    for v in (a, b, c, f):
        v.data += 0.01 * v.grad
    e = a*b
    d = e + c
    L = d * f
    call("L01-S08", L)

    # S09~S10b: 뉴런, tanh, _backward
    nn = lecture_neuron(Value)
    call("L01-S09", nn["n"], x1=nn["x1"], x2=nn["x2"], w1=nn["w1"], w2=nn["w2"], b=nn["b"])
    o = nn["n"].tanh()
    call("L01-S09b", Value, o=o)
    call("L01-S10", Value)
    call("L01-S10b", Value)

    # S11~S12: 위상 정렬, backward, += 버그
    topo = ns.build_topo(o)
    call("L01-S11", topo, o)
    call("L01-S11b", Value)
    call("L01-S12", Value)

    # S13~S13e: 숫자 섞기, exp와 빼기, 거듭제곱과 나누기, tanh 쪼개기, PyTorch 비교
    call("L01-S13", Value)
    call("L01-S13b", Value)
    call("L01-S13c", Value)
    call("L01-S13d", Value)
    if torch is not None:
        x1 = torch.tensor([2.0], dtype=torch.float64, requires_grad=True)
        x2 = torch.tensor([0.0], dtype=torch.float64, requires_grad=True)
        w1 = torch.tensor([-3.0], dtype=torch.float64, requires_grad=True)
        w2 = torch.tensor([1.0], dtype=torch.float64, requires_grad=True)
        bt = torch.tensor([6.8813735870195432], dtype=torch.float64, requires_grad=True)
        ot = torch.tanh(x1*w1 + x2*w2 + bt)
        ot.backward()
        call("L01-S13e", x1=x1, x2=x2, w1=w1, w2=w2, b=bt, o=ot)
    else:
        call("L01-S13e")

    # S14~S14c: Neuron, Layer, MLP
    call("L01-S14", Neuron)
    call("L01-S14b", Layer)
    call("L01-S14c", MLP)

    # S15~S16: 데이터와 손실, 학습 반복, grad 비우기 버그
    # 틀린 구현은 학습 셀 자체가 오류를 낼 수 있다(예: 값이 넘쳐 OverflowError). 노트북에서처럼 그 셀의 채점 칸은 부르지 않는다.
    random.seed(seed)
    model = MLP(3, [4, 4, 1])
    call("L01-S15", model, mse_loss(model, ns.XS, ns.YS))
    if cell(lambda: ns.train(model, steps=20, lr=0.05)) is not CELL_ERROR:  # 교사 정본 S15b: 20번
        call("L01-S15b", model, mse_loss(model, ns.XS, ns.YS))
    random.seed(seed)
    m1 = MLP(3, [4, 4, 1])
    l1 = cell(lambda: ns.train(m1, steps=20, lr=0.05))
    random.seed(seed)
    m2 = MLP(3, [4, 4, 1])
    l2 = cell(lambda: ns.train(m2, steps=20, lr=0.05, zero_grad=False))
    if l1 is not CELL_ERROR and l2 is not CELL_ERROR:
        call("L01-S16", l1, l2)

    # 재구성 3조각
    call("L01-R1", Value)
    call("L01-R2", Value)
    random.seed(seed)
    model = MLP(3, [4, 4, 1])
    if cell(lambda: ns.train(model, steps=R3_STEPS, lr=0.05)) is not CELL_ERROR:
        call("L01-R3", model, mse_loss(model, ns.XS, ns.YS))
    return out


CELL_ERROR = object()


def cell(fn):
    """학생 셀 하나를 실행한다. 오류가 나면 CELL_ERROR (노트북에서 그 셀이 빨간 오류로 끝난 것과 같음)."""
    try:
        return fn()
    except (ArithmeticError, RecursionError, ValueError):
        return CELL_ERROR
