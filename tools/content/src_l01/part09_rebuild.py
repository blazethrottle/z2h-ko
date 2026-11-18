# 출처: 이 조각의 코드 글(단계·문항·재구성 코드)은 karpathy/micrograd(engine.py, nn.py)와 karpathy/nn-zero-to-hero(lectures/micrograd 강의 노트북)를 따른 것이며 둘 다 MIT License. 전문은 third_party/licenses/, 표는 NOTICE.md.
"""L01 조각 9: 재구성 과제 3개와 익힘 기준."""

R1_SOLUTION = """import math
class Value:
  def __init__(self, data, _children=(), _op='', label=''):
    self.data = data
    self.grad = 0.0
    self._backward = lambda: None
    self._prev = set(_children)
    self._op = _op
    self.label = label
  def __repr__(self):
    return f"Value(data={self.data})"
  def __add__(self, other):
    out = Value(self.data + other.data, (self, other), '+')
    def _backward():
      self.grad += 1.0 * out.grad
      other.grad += 1.0 * out.grad
    out._backward = _backward
    return out
  def __mul__(self, other):
    out = Value(self.data * other.data, (self, other), '*')
    def _backward():
      self.grad += other.data * out.grad
      other.grad += self.data * out.grad
    out._backward = _backward
    return out
  def tanh(self):
    x = self.data
    t = (math.exp(2*x) - 1)/(math.exp(2*x) + 1)
    out = Value(t, (self,), 'tanh')
    def _backward():
      self.grad += (1 - t**2) * out.grad
    out._backward = _backward
    return out"""

R2_ADD = """  def backward(self):
    topo = []
    visited = set()
    def build_topo(v):
      if v not in visited:
        visited.add(v)
        for child in v._prev:
          build_topo(child)
        topo.append(v)
    build_topo(self)
    self.grad = 1.0
    for node in reversed(topo):
      node._backward()"""

R3_SOLUTION = """random.seed(1337)
n = MLP(3, [4, 4, 1])
for k in range(20):
  ypred = [n(x) for x in xs]
  loss = sum((yout - ygt)**2 for ygt, yout in zip(ys, ypred))
  for p in n.parameters():
    p.grad = 0.0
  loss.backward()
  for p in n.parameters():
    p.data += -0.05 * p.grad
  print(k, loss.data)"""

R1_CHECK = [
    ("x1 = Value(2.0); x2 = Value(0.0); w1 = Value(-3.0); w2 = Value(1.0); b = Value(6.8813735870195432)", "S23과 같은 뉴런 재료 다섯 상자를 만듭니다."),
    ("a1 = x1*w1; a2 = x2*w2; s = a1 + a2; n = s + b; o = n.tanh()", "S24와 같은 뉴런 계산."),
    ("o.grad = 1.0", "맨 끝 기울기 1."),
    ("for v in (o, n, s, a2, a1):", "뒤에서 앞 순서로 상자마다,"),
    ("  v._backward()", "_backward를 부릅니다(S29와 같음)."),
    ("print([round(v.grad, 4) for v in (x1, w1, x2, w2, b)])", "x1, w1, x2, w2, b의 기울기를 넷째 자리까지 찍습니다. S41의 PyTorch 값과 같아야 합니다."),
    ("c = Value(3.0); d = c * c; d.grad = 1.0; d._backward()", "같은 상자를 두 번 쓰는 곱하기(c x c)로 += 누적을 확인합니다."),
    ("print(d._prev == {c}, c.grad)", "재료 묶음이 c 하나인지와 c.grad를 찍습니다. c²의 기울기 2c = 6.0이어야 합니다."),
]

R2_CHECK = [
    ("a = Value(3.0)", "같은 상자를 두 번 쓰는 시험용 상자."),
    ("b = a + a", "b = 2a."),
    ("b.backward()", "내가 만든 backward()로 역전파."),
    ("print(a.grad)", "2.0이어야 합니다."),
    ("x1 = Value(2.0); x2 = Value(0.0); w1 = Value(-3.0); w2 = Value(1.0); bb = Value(6.8813735870195432)", "뉴런 재료(편향 이름은 위의 b와 겹치지 않게 bb)."),
    ("o = (x1*w1 + x2*w2 + bb).tanh()", "뉴런 계산을 한 줄로."),
    ("o.backward()", "역전파 한 번."),
    ("print([round(v.grad, 4) for v in (x1, w1, x2, w2, bb)])", "S41의 PyTorch 값과 같아야 합니다."),
]

R3_CHECK = [
    ("print(round(loss.data, 4), loss.data < 3.0)", "마지막 반복의 손실과, 그것이 처음 손실(약 6.0)의 절반인 3.0보다 작은지를 찍습니다."),
]


def _code(pairs):
    return "\n".join(c for c, _ in pairs)


def _notes(pairs):
    return [n for _, n in pairs]


REBUILDS = [
    {
        "rebuild_id": "L01-R1",
        "lecture_id": "L01",
        "title_ko": "+, *, tanh와 각 _backward(+= 누적)가 있는 Value",
        "task_ko": "Colab에서 빈 노트북을 하나 엽니다. 앞 단계를 보지 않고, 새 셀에 Value 설계도를 다시 만듭니다. "
                   "들어가야 하는 것: __init__(data, _children, _op, label, grad, _backward), __repr__, __add__, __mul__, tanh. "
                   "세 연산 모두 _backward를 갖고, 기울기는 +=로 쌓아야 합니다. 맨 위에 import math를 잊지 마세요. "
                   "다 만들면 확인 셀(check_code)을 붙여 넣어 실행합니다. backward()는 R2에서 만들므로 여기서는 없어도 됩니다.",
        "check": {"type": "output_match", "reference": "karpathy/micrograd engine.py 동작, S41의 PyTorch 기울기",
                  "expected": "[-1.5, 1.0, 0.5, 0.0, 0.5]\nTrue 6.0"},
        "check_code": _code(R1_CHECK),
        "check_code_line_notes_ko": _notes(R1_CHECK),
        "pass_ko": "확인 셀의 출력이 `[-1.5, 1.0, 0.5, 0.0, 0.5]`와 `True 6.0` 두 줄이면 통과입니다.",
        "solution_code": R1_SOLUTION,
        "solution_source_ko": "S07~S34의 Value 셀에서 + , *, tanh 부분만 모은 것(karpathy/micrograd engine.py, nn-zero-to-hero 강의 노트북 기반, MIT).",
        "max_hint_level_for_pass": 2,
        "hints": [
            "상자를 만들 때 필요한 칸은 몇 개였나요? data 말고 무엇을 기억해야 거꾸로 갈 수 있었나요?",
            "칸: data, grad(0.0), _backward(빈 함수), _prev(재료 묶음), _op(연산 이름), label. 연산마다 out을 만들고, 그 안에 _backward를 정의해 out에 맡깁니다. 규칙: 더하기는 그대로, 곱하기는 상대편 값, tanh는 1 - t². 모두 +=. S11, S12, S27, S28, S34를 보세요.",
            ("빈칸을 채워 보세요.",
             "  def __mul__(self, other):\n    out = Value(self.data * other.data, (self, other), ____)\n    def _backward():\n      self.grad ____ ____ * out.grad\n      other.grad ____ ____ * out.grad\n    out._backward = ____\n    return out"),
            "풀이: solution_code의 Value 설계도입니다. 확인 셀을 실행해 두 줄이 맞는지 보세요.",
        ],
    },
    {
        "rebuild_id": "L01-R2",
        "lecture_id": "L01",
        "title_ko": "위상 정렬을 쓰는 backward()",
        "task_ko": "R1에서 만든 Value 셀 맨 아래에, 앞 단계를 보지 않고 backward()를 다시 만듭니다. "
                   "줄 세우기(위상 정렬) → 맨 끝 기울기 1 → 줄을 거꾸로 돌며 _backward 부르기. Value 셀을 다시 실행한 뒤 확인 셀을 붙여 넣어 실행합니다.",
        "check": {"type": "output_match", "reference": "karpathy/micrograd engine.py 동작",
                  "expected": "2.0\n[-1.5, 1.0, 0.5, 0.0, 0.5]"},
        "check_code": _code(R2_CHECK),
        "check_code_line_notes_ko": _notes(R2_CHECK),
        "pass_ko": "확인 셀의 출력이 `2.0`과 `[-1.5, 1.0, 0.5, 0.0, 0.5]` 두 줄이면 통과입니다.",
        "solution_code": R2_ADD,
        "solution_source_ko": "S30, S31의 backward()(karpathy/micrograd engine.py 기반, MIT). R1의 Value 셀 맨 아래에 붙입니다.",
        "max_hint_level_for_pass": 2,
        "hints": [
            "_backward는 어떤 순서로 불러야 했나요? 결과가 먼저인가요, 재료가 먼저인가요?",
            "재료를 먼저 줄에 세운 뒤 자기를 넣으면(위상 정렬) 재료가 늘 앞에 옵니다. 그 줄을 reversed로 돌면 결과부터 기울기를 넘깁니다. 시작 기울기는 self.grad = 1.0. S30, S31을 보세요.",
            ("빈칸을 채워 보세요.",
             "  def backward(self):\n    topo = []\n    visited = set()\n    def build_topo(v):\n      if v not in ____:\n        visited.add(v)\n        for child in v.____:\n          build_topo(child)\n        topo.____(v)\n    build_topo(____)\n    self.grad = ____\n    for node in ____(topo):\n      node._backward()"),
            "풀이: solution_code의 13줄을 Value 셀 맨 아래에 붙이고 Value 셀을 다시 실행합니다.",
        ],
    },
    {
        "rebuild_id": "L01-R3",
        "lecture_id": "L01",
        "title_ko": "학습 반복문(앞으로, 비우기, 거꾸로, 고치기)",
        "task_ko": "이 편의 노트북에서 Value 셀, Neuron, Layer, MLP 셀(S50에서 고친 것), 데이터 셀(S47)까지 실행된 상태로 시작합니다. "
                   "새 셀에 앞 단계를 보지 않고, random.seed(1337)과 n = MLP(3, [4, 4, 1])로 신경망을 새로 만든 뒤 "
                   "학습률 0.05로 20번 학습하는 반복문을 씁니다. 반복마다 print(k, loss.data)로 손실을 찍습니다. 그다음 확인 셀을 실행합니다.",
        "check": {"type": "output_match", "reference": "20번 뒤 손실이 처음의 절반 아래(시드 1337, 학습률 0.05 기준 약 0.0596)",
                  "expected": "0.0596 True"},
        "check_code": _code(R3_CHECK),
        "check_code_line_notes_ko": _notes(R3_CHECK),
        "pass_ko": "확인 셀의 끝이 `True`이면 통과입니다(마지막 손실 < 3.0). 시드와 학습률을 위처럼 했다면 숫자는 `0.0596`입니다.",
        "solution_code": R3_SOLUTION,
        "solution_source_ko": "S50, S52, S53의 학습 셀(nn-zero-to-hero 강의 노트북 기반, MIT). 시드 줄은 우리가 넣은 것.",
        "max_hint_level_for_pass": 2,
        "hints": [
            "한 바퀴에 하는 일 네 가지를 먼저 우리말로 적어 보세요. 어느 것이 backward()보다 먼저여야 하나요?",
            "앞으로 계산(ypred, loss) → 비우기(p.grad = 0.0) → 거꾸로(loss.backward()) → 고치기(p.data += -0.05 * p.grad). S51, S53과 Q14를 보세요.",
            ("빈칸을 채워 보세요.",
             "random.seed(1337)\nn = MLP(3, [4, 4, 1])\nfor k in range(____):\n  ypred = [n(x) for x in xs]\n  loss = sum((yout - ygt)**2 for ygt, yout in zip(ys, ypred))\n  for p in n.parameters():\n    p.grad = ____\n  loss.____()\n  for p in n.parameters():\n    p.data += ____ * p.grad\n  print(k, loss.data)"),
            "풀이: solution_code의 반복문입니다. 비우기 두 줄이 loss.backward() 앞에 있는지 확인하세요.",
        ],
    },
]

MASTERY = {
    "mastery_rule_id": "default",
    "steps_complete_ratio": 1.0,
    "question_score_ratio": 0.8,
    "rebuild_max_hint_level": 2,
    "extra_checks": [],
}
