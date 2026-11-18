# 출처: 이 조각의 코드 글(단계·문항·재구성 코드)은 karpathy/micrograd(engine.py, nn.py)와 karpathy/nn-zero-to-hero(lectures/micrograd 강의 노트북)를 따른 것이며 둘 다 MIT License. 전문은 third_party/licenses/, 표는 NOTICE.md.
"""L01 조각 2: S09~S16 (챕터 5 나머지: 연산 가르치기, 계산 그래프, 그림. 챕터 6 시작: 손 역전파)."""
from common import S, segs, vr, om, ins, rep

RERUN_NOTE = "에러가 나면 먼저 확인: Value 셀을 고친 뒤 그 셀을 다시 실행했나요? 그다음 상자를 만드는 셀도 다시 실행했나요? "

# 그림 안 글자 확인용(verify). draw_dot 이 만든 그림 설명(source)에 이 글자들이 있어야 한다.
def _label(name, data, grad):
    return "'{ %s | data %.4f | grad %.4f }'" % (name, data, grad)


def _has(var, items):
    return "s = draw_dot(%s).source\n" % var + "\n".join(
        "assert %s in s, %s" % (_label(*it), _label(*it)) for it in items)


DRAW_PREP = [
    ("from graphviz import Digraph", "graphviz(그래프 그림 도구)에서 Digraph(화살표 그림)를 불러옵니다."),
    ("def trace(root):", "root(맨 끝 상자)에서 출발해 연결된 상자와 화살표를 모두 찾는 함수입니다."),
    ("  nodes, edges = set(), set()", "찾은 상자(nodes)와 화살표(edges)를 담을 빈 묶음 두 개를 만듭니다."),
    ("  def build(v):", "상자 v 하나를 살피는 안쪽 함수입니다."),
    ("    if v not in nodes:", "아직 담지 않은 상자일 때만,"),
    ("      nodes.add(v)", "그 상자를 담고,"),
    ("      for child in v._prev:", "그 상자를 만든 재료 상자(_prev)마다,"),
    ("        edges.add((child, v))", "'재료 → 결과' 화살표를 담고,"),
    ("        build(child)", "재료 상자도 같은 방법으로 살핍니다(자기 자신을 다시 부름)."),
    ("  build(root)", "맨 끝 상자부터 살피기 시작합니다."),
    ("  return nodes, edges", "찾은 상자들과 화살표들을 돌려줍니다."),
    ("def draw_dot(root):", "계산 그래프를 그림으로 그리는 함수입니다."),
    ("  dot = Digraph(format='svg', graph_attr={'rankdir': 'LR'})", "왼쪽에서 오른쪽(LR)으로 흐르는 빈 그림을 만듭니다."),
    ("  nodes, edges = trace(root)", "위의 trace로 상자와 화살표를 모두 찾습니다."),
    ("  for n in nodes:", "상자마다,"),
    ("    uid = str(id(n))", "그 상자만의 번호(id)를 글자로 바꿔 그림 속 이름으로 씁니다."),
    ("    dot.node(name=uid, label=\"{ %s | data %.4f | grad %.4f }\" % (n.label, n.data, n.grad), shape='record')",
     "네모 칸에 '이름 | data 값 | grad 값'을 소수 넷째 자리까지 적어 그립니다."),
    ("    if n._op:", "이 상자가 어떤 연산(+, * 등)으로 만들어졌다면,"),
    ("      dot.node(name=uid + n._op, label=n._op)", "연산 기호를 적은 동그라미를 하나 더 그리고,"),
    ("      dot.edge(uid + n._op, uid)", "동그라미에서 결과 상자로 화살표를 긋습니다."),
    ("  for n1, n2 in edges:", "찾아 둔 화살표마다,"),
    ("    dot.edge(str(id(n1)), str(id(n2)) + n2._op)", "재료 상자에서 결과 상자의 연산 동그라미로 화살표를 긋습니다."),
    ("  return dot", "다 그린 그림을 돌려줍니다. 셀 마지막 줄이면 화면에 그림이 나옵니다."),
    ("def draw_text(root):", "그림 도구가 안 될 때 쓰는 대신 함수입니다. 같은 내용을 글자로 찍습니다."),
    ("  nodes, edges = trace(root)", "상자를 모두 찾습니다."),
    ("  for n in nodes:", "상자마다,"),
    ("    print(n.label, '| data %.4f | grad %.4f |' % (n.data, n.grad), n._op, [c.label for c in n._prev])",
     "이름, data, grad, 연산, 재료 상자 이름들을 한 줄로 찍습니다."),
]

STEPS = [
    S(9, "더하기 가르치기", segs(5), "code",
      "같은 구간에서 __add__를 만드는 장면을 봅니다. 두 곳에 칩니다. "
      "(1) Value 셀(S07) 맨 아래에 3줄을 넣습니다. def 줄은 빈칸 2칸, 나머지는 4칸입니다. "
      "(2) Value 셀과 예시 셀(S08)을 차례로 다시 실행한 뒤, 새 셀에 마지막 1줄을 칩니다.",
      code=[
          ("  def __add__(self, other):", "상자에 +를 쓰면 파이썬이 이 함수를 부릅니다. other는 + 오른쪽 상자입니다."),
          ("    out = Value(self.data + other.data)", "두 상자의 숫자를 더해 새 상자 out을 만듭니다."),
          ("    return out", "새 상자를 돌려줍니다."),
          ("a + b", "새 셀: a와 b를 더한 결과를 보여 줍니다. 2.0 + (-3.0)입니다."),
      ],
      edits=[ins(7, "Value 셀 맨 아래(__repr__의 return 줄 다음)", None, 3)],
      rerun=[7, 8],
      expected="`Value(data=-1.0)`",
      check=om("Value(data=-1.0)"),
      meaning="+의 뜻을 상자에게 가르쳤습니다. 이제 상자끼리 더할 수 있고, 결과도 상자입니다.",
      obj=["L01-O2"],
      hints=[
          RERUN_NOTE + "TypeError: unsupported operand type(s) for +가 보이면 Value 셀을 다시 실행하지 않은 것입니다.",
          "클래스를 고치면 그 셀을 다시 실행해야 새 설계도가 생기고, 옛 설계도로 만든 상자는 새 기능이 없어서 상자도 다시 만들어야 합니다. 기초 F-P6(특수 메서드), F-P8(셀 순서)을 보세요.",
          ("빈칸을 채워 보세요.", ["__add__", "self.data + other.data", "return out"]),
          "풀이: Value 셀 맨 아래에 3줄을 넣고, Value 셀, 예시 셀, 새 셀 순서로 실행합니다. 2.0 + (-3.0) = -1.0입니다.",
      ]),

    S(10, "곱하기 가르치기", segs(5), "code",
      "같은 구간에서 __mul__을 만드는 장면을 봅니다. Value 셀 맨 아래에 3줄을 넣고, "
      "Value 셀과 예시 셀을 다시 실행한 뒤, 새 셀에 2줄을 칩니다.",
      code=[
          ("  def __mul__(self, other):", "상자에 *를 쓰면 파이썬이 이 함수를 부릅니다."),
          ("    out = Value(self.data * other.data)", "두 상자의 숫자를 곱해 새 상자 out을 만듭니다."),
          ("    return out", "새 상자를 돌려줍니다."),
          ("d = a*b + c", "새 셀: S05와 같은 식을 이번에는 상자로 계산합니다."),
          ("d", "d를 보여 줍니다."),
      ],
      edits=[ins(7, "Value 셀 맨 아래(__add__의 return out 다음)", None, 3)],
      rerun=[7, 8],
      expected="`Value(data=4.0)`. S05의 `4.0`과 같은 답입니다.",
      check=om("Value(data=4.0)"),
      meaning="*의 뜻도 가르쳤습니다. 이제 S05의 식을 상자만으로 계산할 수 있습니다.",
      obj=["L01-O2"],
      hints=[
          RERUN_NOTE + "a*b가 먼저 계산되고, 그 결과 상자에 c를 더합니다. 어느 함수가 먼저 불릴까요?",
          "a*b는 a.__mul__(b), 그 결과 + c는 __add__입니다. 기초 F-P6을 보세요.",
          ("빈칸을 채워 보세요.", ["__mul__", "self.data * other.data", "a*b + c"]),
          "풀이: __mul__ 3줄을 Value 셀 맨 아래에 넣고 Value 셀, 예시 셀을 다시 실행한 뒤 새 셀을 실행합니다. 2 x (-3) + 10 = 4입니다.",
      ]),

    S(11, "어디서 왔는지 기억하기", segs(5), "code",
      "같은 구간에서 _children과 _op를 넣는 장면을 봅니다. Value 셀의 네 곳을 고칩니다. "
      "(1) __init__ 줄을 바꾸고 (2) self.data = data 아래에 2줄을 넣고 (3) __add__의 out = 줄과 (4) __mul__의 out = 줄을 바꿉니다. "
      "그다음 Value 셀, 예시 셀, S10 셀을 차례로 다시 실행하고 새 셀에 1줄을 칩니다.",
      code=[
          ("  def __init__(self, data, _children=(), _op=''):", "바꾼 줄: 재료 상자들(_children)과 연산 이름(_op)도 받습니다. 안 주면 빈 값입니다."),
          ("    self._prev = set(_children)", "넣은 줄: 재료 상자들을 _prev 칸에 묶음(set)으로 기억합니다."),
          ("    self._op = _op", "넣은 줄: 어떤 연산으로 만들어졌는지 기억합니다."),
          ("    out = Value(self.data + other.data, (self, other), '+')", "바꾼 줄: 더한 결과 상자에 '재료는 self와 other, 연산은 +'를 적어 둡니다."),
          ("    out = Value(self.data * other.data, (self, other), '*')", "바꾼 줄: 곱한 결과 상자에 '재료와 연산 *'를 적어 둡니다."),
          ("d._prev, d._op", "새 셀: d의 재료와 연산을 함께 보여 줍니다."),
      ],
      edits=[
          rep(7, "__init__ 줄을 통째로 바꿉니다", "  def __init__(self, data):"),
          ins(7, "self.data = data 줄 바로 아래", "    self.data = data", 2),
          rep(7, "__add__ 안의 out = 줄을 바꿉니다", "    out = Value(self.data + other.data)"),
          rep(7, "__mul__ 안의 out = 줄을 바꿉니다", "    out = Value(self.data * other.data)"),
      ],
      rerun=[7, 8, 10],
      expected="`({Value(data=-6.0), Value(data=10.0)}, '+')`. 중괄호 안 두 상자의 순서는 반대로 나와도 정상입니다(묶음 set은 순서를 정하지 않습니다).",
      check=vr(2, 2, "len(d._prev)"),
      meaning="결과 상자가 '나는 무엇과 무엇을 어떤 연산으로 합쳐 만들어졌다'를 기억합니다. 이 기억 덕분에 나중에 끝에서 앞으로 거꾸로 따라갈 수 있습니다.",
      obj=["L01-O2"],
      hints=[
          RERUN_NOTE + "d는 a*b의 결과(-6.0)와 c(10.0)를 더해 만들었습니다. 그러면 d의 재료는 무엇일까요?",
          "_prev는 재료 상자 묶음, _op는 연산 이름입니다. 계산 그래프는 이 기억들을 이은 지도입니다. 기초 F-P6을 보세요.",
          ("빈칸을 채워 보세요.", ["_children=(), _op=''", "set(_children)", "(self, other), '+'", "(self, other), '*'"]),
          "풀이: __init__에 _children, _op를 받게 하고, 두 out = 줄에 (self, other)와 연산 기호를 넘깁니다. 고친 뒤 Value 셀, 예시 셀, S10 셀을 다시 실행해야 d가 새 설계도로 만들어집니다.",
      ],
      verify="assert d._op == '+'\nassert sorted(v.data for v in d._prev) == [-6.0, 10.0]"),

    S(12, "이름표와 grad 칸", segs(5), "code",
      "같은 구간에서 label과 grad를 넣는 장면을 봅니다. Value 셀의 세 곳과 예시 셀의 세 줄을 고친 뒤, "
      "Value 셀과 예시 셀을 다시 실행합니다. 이 단계에는 새 셀이 없습니다.",
      code=[
          ("  def __init__(self, data, _children=(), _op='', label=''):", "바꾼 줄: 이름표(label)도 받습니다. 그림에 이름을 적으려고 씁니다."),
          ("    self.grad = 0.0", "넣은 줄: 기울기 칸 grad를 만들고 0.0으로 시작합니다. 0은 '아직 영향 없음'이라는 뜻입니다."),
          ("    self.label = label", "넣은 줄: 받은 이름표를 label 칸에 넣습니다."),
          ("a = Value(2.0, label='a')", "예시 셀에서 바꾼 줄: 상자 a에 이름표 'a'를 붙입니다."),
          ("b = Value(-3.0, label='b')", "예시 셀에서 바꾼 줄: 이름표 'b'."),
          ("c = Value(10.0, label='c')", "예시 셀에서 바꾼 줄: 이름표 'c'."),
      ],
      edits=[
          rep(7, "__init__ 줄을 통째로 바꿉니다", "  def __init__(self, data, _children=(), _op=''):"),
          ins(7, "self.data = data 줄 바로 아래", "    self.data = data", 1),
          ins(7, "self._op = _op 줄 바로 아래", "    self._op = _op", 1),
          rep(8, "예시 셀의 a = 줄", "a = Value(2.0)"),
          rep(8, "예시 셀의 b = 줄", "b = Value(-3.0)"),
          rep(8, "예시 셀의 c = 줄", "c = Value(10.0)"),
      ],
      rerun=[7, 8],
      expected="예시 셀을 다시 실행하면 에러 없이 `Value(data=2.0)`이 보입니다. 겉모습은 그대로지만 상자 안에 이름표와 grad 칸이 생겼습니다.",
      check=om("Value(data=2.0)"),
      meaning="상자마다 이름과 기울기를 적을 칸이 생겼습니다. 다음 단계에서 그림을 그리면 이 두 칸이 함께 보입니다.",
      obj=["L01-O2"],
      hints=[
          RERUN_NOTE + "TypeError: __init__() got an unexpected keyword argument 'label'이 보이면 어느 셀을 다시 실행하지 않은 걸까요?",
          "label=''처럼 =로 기본값을 주면, 이름표를 안 줘도 됩니다. grad는 처음에 0.0입니다. 기초 F-P6을 보세요.",
          ("빈칸을 채워 보세요.", ["label=''", "self.grad = 0.0", "self.label = label", "label='a'"]),
          "풀이: Value 셀의 __init__에 label을 받게 하고 grad, label 칸을 만든 뒤, 예시 셀에서 세 상자에 이름표를 붙입니다. 두 셀을 다시 실행합니다.",
      ],
      verify="assert a.label == 'a' and b.label == 'b' and c.label == 'c'\nassert a.grad == 0.0"),

    S(13, "식 L까지 늘리기", segs(5), "code",
      "같은 구간에서 e, d, f, L을 만드는 장면을 본 뒤 새 셀에 8줄을 칩니다. "
      "주의: 여기서 f라는 이름을 상자에 다시 쓰므로 S02의 함수 f는 사라집니다. 앞으로 함수 f는 쓰지 않으니 괜찮습니다.",
      code=[
          ("e = a*b", "a와 b를 곱한 상자를 e라고 부릅니다."),
          ("e.label = 'e'", "e에 이름표를 붙입니다."),
          ("d = e + c", "e에 c를 더한 상자를 d라고 부릅니다."),
          ("d.label = 'd'", "d에 이름표를 붙입니다."),
          ("f = Value(-2.0, label='f')", "새 입력 상자 f(-2.0)를 만듭니다."),
          ("L = d * f", "d와 f를 곱한 상자 L. 이 식의 맨 끝 결과입니다."),
          ("L.label = 'L'", "L에 이름표를 붙입니다."),
          ("L", "L을 보여 줍니다."),
      ],
      expected="`Value(data=-8.0)`. 계산: e = 2 x (-3) = -6, d = -6 + 10 = 4, L = 4 x (-2) = -8.",
      check=om("Value(data=-8.0)"),
      meaning="입력 4개(a, b, c, f)에서 L 하나가 나오는 작은 계산 그래프를 만들었습니다. 신경망도 이것을 아주 크게 키운 것입니다.",
      obj=["L01-O2"],
      hints=[
          "e, d, L을 차례로 손으로 계산해 보세요. L은 몇이 나와야 할까요?",
          "결과 상자에는 이름표를 따로 붙여야 합니다(e.label = 'e'). 이름표가 없으면 그림에 이름이 비어 보입니다. 기초 F-P2를 보세요.",
          ("빈칸을 채워 보세요.", ["a*b", "e + c", "d * f"]),
          "풀이: 위 8줄 그대로입니다. e = -6.0, d = 4.0, L = -8.0입니다.",
      ],
      verify="assert e.data == -6.0 and d.data == 4.0 and L.data == -8.0\nassert L._op == '*'"),

    S(14, "그림으로 보기", segs(5), "code",
      "같은 구간에서 draw_dot으로 그림을 그리는 장면을 봅니다. 그림 그리는 코드는 길어서 직접 치지 않습니다. "
      "(1) 노트북에 미리 들어 있는 그림 준비 코드 셀을 실행합니다(없으면 아래 준비 코드를 새 셀에 붙여 넣고 실행). (2) 다음 새 셀에 1줄을 칩니다.",
      prepared=DRAW_PREP,
      prepared_source="출처: karpathy/nn-zero-to-hero lectures/micrograd 강의 노트북(MIT)의 trace, draw_dot. 바꾼 점: 주석과 빈 줄을 빼고, 그림이 안 될 때 쓰는 draw_text 4줄을 우리가 새로 덧붙였습니다.",
      code=[
          ("draw_dot(L)", "L에서 출발해 계산 그래프 전체를 그립니다."),
      ],
      expected="왼쪽에서 오른쪽으로 흐르는 그림이 나옵니다. 스스로 확인할 것: (1) 네모가 7개(a, b, c, e, d, f, L)이다. "
               "(2) 동그라미가 3개(*, +, *)이고 연산을 나타낸다. (3) 맨 오른쪽 L 칸이 `L | data -8.0000 | grad 0.0000`이다. (4) 모든 칸의 grad가 0.0000이다. "
               "그림 대신 에러가 나면 힌트 H2를 보세요.",
      check={"type": "manual"},
      meaning="계산 그래프를 눈으로 봅니다. 지금 grad는 모두 0입니다. 다음 단계부터 이 grad 칸을 맨 끝 L에서 앞으로 하나씩 채웁니다.",
      obj=["L01-O2"],
      hints=[
          "에러의 마지막 줄에 graphviz나 ExecutableNotFound라는 말이 있나요? 아니면 NameError인가요?",
          "그림 도구 graphviz는 파이썬 부품과 컴퓨터 프로그램(dot) 두 가지가 다 있어야 합니다. "
          "Colab만: ModuleNotFoundError가 나면 새 셀에 `!pip install graphviz`를 실행한 뒤 준비 코드 셀을 다시 실행합니다. "
          "그동안은 draw_dot(L) 대신 draw_text(L)로 같은 내용을 글자로 볼 수 있습니다. 기초 F-P8(에러 읽기)을 보세요.",
          ("빈칸을 채워 보세요. 그림 도구가 안 되면 두 번째 줄을 쓰세요.", "____(L)\n# 안 될 때: draw_text(L)"),
          "풀이: 준비 코드 셀을 먼저 실행하고, 새 셀에 draw_dot(L)을 실행합니다. 그림이 안 나오면 draw_text(L)로 이름, data, grad를 글자로 확인해도 이 단계는 통과입니다.",
      ],
      verify=_has("L", [("a", 2.0, 0.0), ("b", -3.0, 0.0), ("c", 10.0, 0.0), ("e", -6.0, 0.0),
                        ("d", 4.0, 0.0), ("f", -2.0, 0.0), ("L", -8.0, 0.0)])),

    S(15, "맨 끝에서 시작", segs(6), "code",
      "영상 32분 10초부터 봅니다. 맨 끝 L의 기울기를 정하는 장면 뒤에 새 셀에 2줄을 칩니다.",
      code=[
          ("L.grad = 1.0", "L의 grad 칸에 1.0을 넣습니다. L을 L로 본 기울기입니다."),
          ("draw_dot(L)", "그림을 다시 그립니다."),
      ],
      expected="스스로 확인할 것: (1) L 칸이 `grad 1.0000`이다. (2) 나머지 여섯 칸은 모두 `grad 0.0000`이다.",
      check={"type": "manual"},
      meaning="역전파는 늘 맨 끝에서 시작합니다. L을 조금 올리면 L도 정확히 그만큼 오르므로, 시작 기울기는 1입니다.",
      obj=["L01-O3"],
      hints=[
          "L을 0.001 올리면 L은 얼마 오르나요? 그 비율은요?",
          "grad는 'L을 기준으로 이 상자를 조금 움직이면 L이 얼마나 변하나'입니다. 자기 자신에 대한 기울기는 1입니다. 기초 F-M1을 보세요.",
          ("빈칸을 채워 보세요.", ["1.0"]),
          "풀이: L.grad = 1.0을 넣고 그림을 다시 그립니다. 다른 칸은 다음 단계에서 채웁니다.",
      ],
      verify=_has("L", [("L", -8.0, 1.0), ("d", 4.0, 0.0)])),

    S(16, "곱셈 규칙", segs(6), "code",
      "같은 구간에서 L = d * f를 미분하는 장면을 봅니다. 영상에서 손으로 구한 두 값을 새 셀에 적습니다(3줄).",
      code=[
          ("f.grad = 4.0", "L = d x f에서 f를 움직이면 L은 d(=4.0)배로 변합니다."),
          ("d.grad = -2.0", "d를 움직이면 L은 f(=-2.0)배로 변합니다."),
          ("draw_dot(L)", "그림을 다시 그립니다."),
      ],
      expected="스스로 확인할 것: (1) f 칸 `grad 4.0000` (2) d 칸 `grad -2.0000` (3) L 칸 `grad 1.0000` (4) a, b, c, e는 아직 `grad 0.0000`.",
      check={"type": "manual"},
      meaning="곱하기 칸의 규칙: 한쪽의 기울기는 '상대편 값 x 뒤에서 온 기울기'입니다. 여기서는 뒤에서 온 기울기가 1이라 상대편 값 그대로입니다. S06에서 본 것과 같은 규칙입니다.",
      obj=["L01-O3"],
      hints=[
          "L = d x f에서 f만 1 늘리면 L은 얼마나 변할까요? d가 4라는 점을 쓰세요.",
          "곱하기 x*y를 x로 본 기울기는 y, y로 본 기울기는 x입니다. 기초 F-M1, F-M2(연쇄법칙)를 보세요.",
          ("빈칸을 채워 보세요.", ["4.0", "-2.0"]),
          "풀이: f.grad = d의 값 4.0, d.grad = f의 값 -2.0입니다. 둘 다 뒤에서 온 기울기 1.0을 곱한 값입니다.",
      ],
      verify=_has("L", [("f", -2.0, 4.0), ("d", 4.0, -2.0), ("L", -8.0, 1.0)])),
]
