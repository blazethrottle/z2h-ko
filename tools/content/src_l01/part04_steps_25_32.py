# 출처: 이 조각의 코드 글(단계·문항·재구성 코드)은 karpathy/micrograd(engine.py, nn.py)와 karpathy/nn-zero-to-hero(lectures/micrograd 강의 노트북)를 따른 것이며 둘 다 MIT License. 전문은 third_party/licenses/, 표는 NOTICE.md.
"""L01 조각 4: S25~S32 (챕터 8 나머지: 뉴런 손 역전파, 챕터 9: _backward, 챕터 10: 위상 정렬과 backward())."""
from common import S, segs, vr, om, ins
from part02_steps_09_16 import RERUN_NOTE, _has

NEURON_GRADS = [("x1", 2.0, -1.5), ("w1", -3.0, 1.0), ("x2", 0.0, 0.5), ("w2", 1.0, 0.0), ("b", 6.8813735870195432, 0.5),
                ("n", 0.8813735870195432, 0.5), ("o", 0.7071067811865476, 1.0)]

# 상자 둘을 더하고 out 에 기울기 1을 준 뒤 _backward 한 번. 두 재료의 grad 합(정답 2.0)
ADD_BACK_EXPR = "(lambda u, v: (lambda w: (setattr(w, 'grad', 1.0), w._backward(), u.grad + v.grad)[-1])(u + v))(Value(1.0), Value(2.0))"
# 3 x 4 의 _backward: u.grad = 4, v.grad = 3. 합 7.0
MUL_BACK_EXPR = "(lambda u, v: (lambda w: (setattr(w, 'grad', 1.0), w._backward(), u.grad + v.grad)[-1])(u * v))(Value(3.0), Value(4.0))"

STEPS = [
    S(25, "tanh를 지나 거꾸로", segs(8), "code",
      "같은 구간에서 o에서 n으로 기울기를 넘기는 장면을 봅니다. 새 셀에 3줄을 칩니다.",
      code=[
          ("o.grad = 1.0", "맨 끝 o에서 시작합니다. 기울기 1."),
          ("n.grad = 1 - o.data**2", "tanh의 기울기는 1 - (출력)²입니다. o.data가 0.7071이면 1 - 0.5 = 0.5."),
          ("draw_dot(o)", "그림을 다시 그립니다."),
      ],
      expected="스스로 확인할 것: (1) o 칸 `grad 1.0000` (2) n 칸 `grad 0.5000` (3) 나머지는 아직 `grad 0.0000`.",
      check={"type": "manual"},
      meaning="tanh 칸의 규칙: 기울기 = (1 - 출력²) x 뒤에서 온 기울기. 출력이 1이나 -1에 가까울수록 기울기는 0에 가까워집니다(곡선이 평평한 곳).",
      obj=["L01-O3"],
      hints=[
          "o.data는 약 0.7071입니다. 그 제곱은 얼마인가요?",
          "tanh(x)를 x로 미분하면 1 - tanh(x)²입니다. 이미 계산된 출력 o.data를 쓰면 됩니다. 기초 F-M3(tanh), F-M2를 보세요.",
          ("빈칸을 채워 보세요.", ["1 - o.data**2"]),
          "풀이: 0.7071의 제곱은 0.5이므로 n.grad = 1 - 0.5 = 0.5입니다(o.grad가 1이라 곱해도 그대로).",
      ],
      verify=_has("o", [("o", 0.7071067811865476, 1.0), ("n", 0.8813735870195432, 0.4999999999999999)])),

    S(26, "입력과 가중치까지", segs(8), "code",
      "같은 구간에서 더하기 칸 두 개와 곱하기 칸 두 개를 지나 기울기를 넘기는 장면을 봅니다. 새 셀에 9줄을 칩니다.",
      code=[
          ("x1w1x2w2.grad = 0.5", "n = x1w1x2w2 + b는 더하기라 n.grad 0.5가 그대로 넘어옵니다."),
          ("b.grad = 0.5", "b도 같은 더하기 칸이라 0.5."),
          ("x1w1.grad = 0.5", "x1w1x2w2 = x1w1 + x2w2도 더하기라 0.5가 그대로."),
          ("x2w2.grad = 0.5", "x2w2도 0.5."),
          ("x2.grad = w2.data * x2w2.grad", "곱하기 칸: x2의 기울기 = 상대편 w2의 값(1.0) x 0.5 = 0.5."),
          ("w2.grad = x2.data * x2w2.grad", "w2의 기울기 = 상대편 x2의 값(0.0) x 0.5 = 0.0."),
          ("x1.grad = w1.data * x1w1.grad", "x1의 기울기 = w1의 값(-3.0) x 0.5 = -1.5."),
          ("w1.grad = x1.data * x1w1.grad", "w1의 기울기 = x1의 값(2.0) x 0.5 = 1.0."),
          ("draw_dot(o)", "그림을 다시 그립니다."),
      ],
      expected="스스로 확인할 것: (1) x1 `grad -1.5000` (2) w1 `grad 1.0000` (3) x2 `grad 0.5000` (4) w2 `grad 0.0000` "
               "(5) b, n, x1*w1, x2*w2, x1*w1 + x2*w2 칸은 모두 `grad 0.5000`.",
      check={"type": "manual"},
      meaning="뉴런 하나의 역전파를 손으로 끝냈습니다. w2.grad가 0인 것은 x2가 0이라 w2를 아무리 바꿔도 출력이 안 변한다는 뜻입니다. 기울기는 '이 손잡이가 지금 출력에 얼마나 힘이 있나'를 알려 줍니다.",
      obj=["L01-O3"],
      hints=[
          "더하기 칸은 받은 기울기를 어떻게 넘기나요? 곱하기 칸은요? S18과 S19에서 쓴 규칙을 떠올려 보세요.",
          "더하기: 그대로 넘김. 곱하기: 상대편 값 x 뒤에서 온 기울기. 길을 따라 곱하는 것이 연쇄법칙입니다. 기초 F-M2를 보세요.",
          ("빈칸을 채워 보세요.", ["0.5", "w2.data * x2w2.grad", "x2.data * x2w2.grad", "w1.data", "x1.data"]),
          "풀이: 더하기 칸 넷은 0.5를 그대로 받고, 곱하기 칸은 상대편 값을 곱합니다. x1 = -3 x 0.5 = -1.5, w1 = 2 x 0.5 = 1.0, x2 = 1 x 0.5 = 0.5, w2 = 0 x 0.5 = 0.0입니다.",
      ],
      verify=_has("o", [("x1", 2.0, -1.5), ("w1", -3.0, 1.0), ("x2", 0.0, 0.5), ("w2", 1.0, 0.0),
                        ("b", 6.8813735870195432, 0.5), ("x1*w1", -6.0, 0.5), ("x2*w2", 0.0, 0.5)])),

    S(27, "더하기의 _backward", segs(9), "code",
      "영상 1시간 9분 2초부터 봅니다. 기울기 넘기는 일을 연산마다 맡기는 장면입니다. Value 셀의 두 곳에 넣고 Value 셀을 다시 실행합니다. "
      "(1) self.grad = 0.0 아래에 1줄 (2) __add__의 out = 줄 아래에 4줄. "
      "여기서는 영상대로 `=`를 씁니다. 이 `=`에는 숨은 버그가 있고, S34에서 고칩니다.",
      code=[
          ("    self._backward = lambda: None", "넣은 줄: 기울기를 넘기는 함수 칸 _backward. 처음엔 아무 일도 안 하는 빈 함수(lambda: None)입니다."),
          ("    def _backward():", "넣은 줄: 더하기 결과 out의 기울기를 재료에게 넘기는 함수를 만듭니다."),
          ("      self.grad = 1.0 * out.grad", "왼쪽 재료의 기울기 = 1 x out의 기울기(더하기는 그대로 넘김)."),
          ("      other.grad = 1.0 * out.grad", "오른쪽 재료도 같습니다."),
          ("    out._backward = _backward", "이 함수를 결과 상자 out에 맡겨 둡니다. 나중에 out._backward()로 부릅니다."),
      ],
      edits=[
          ins(7, "self.grad = 0.0 줄 바로 아래", "    self.grad = 0.0", 1),
          ins(7, "__add__ 안의 out = 줄 바로 아래(return out 위)", "    out = Value(self.data + other.data, (self, other), '+')", 4),
      ],
      rerun=[7],
      expected="아무것도 출력되지 않으면 정상입니다.",
      check=vr(1.9999, 2.0001, ADD_BACK_EXPR),
      meaning="결과 상자가 '내 기울기를 재료에게 어떻게 나눠 줄지'를 스스로 기억합니다. 이제 손으로 숫자를 적지 않아도 됩니다.",
      obj=["L01-O4"],
      hints=[
          RERUN_NOTE + "_backward 안의 줄은 빈칸 6칸입니다. def _backward(): 줄보다 2칸 더 들어갔나요?",
          "함수 안에 함수를 만들 수 있습니다. 안쪽 함수는 바깥의 self, other, out을 기억합니다. 더하기의 규칙은 S18의 '그대로 넘김'입니다. 기초 F-P4, F-M2를 보세요.",
          ("빈칸을 채워 보세요.", ["lambda: None", "1.0 * out.grad", "out._backward = _backward"]),
          "풀이: Value 셀의 self.grad = 0.0 아래에 _backward 칸을 만들고, __add__의 out = 줄과 return out 사이에 4줄을 넣습니다. 그다음 Value 셀을 실행합니다.",
      ],
      verify="u, v = Value(1.0), Value(2.0)\nw = u + v\nw.grad = 3.0\nw._backward()\nassert u.grad == 3.0 and v.grad == 3.0"),

    S(28, "곱하기와 tanh의 _backward", segs(9), "code",
      "같은 구간에서 곱하기와 tanh의 _backward를 만드는 장면을 봅니다. Value 셀의 두 곳에 넣고 Value 셀을 다시 실행합니다. "
      "(1) __mul__의 out = 줄 아래에 4줄 (2) tanh의 out = 줄 아래에 3줄.",
      code=[
          ("    def _backward():", "넣은 줄(__mul__): 곱하기 결과의 기울기를 넘기는 함수."),
          ("      self.grad = other.data * out.grad", "왼쪽 재료의 기울기 = 상대편 값 x out의 기울기."),
          ("      other.grad = self.data * out.grad", "오른쪽 재료의 기울기 = 상대편(self) 값 x out의 기울기."),
          ("    out._backward = _backward", "이 함수를 out에 맡깁니다."),
          ("    def _backward():", "넣은 줄(tanh): tanh 결과의 기울기를 넘기는 함수."),
          ("      self.grad = (1 - t**2) * out.grad", "재료의 기울기 = (1 - 출력²) x out의 기울기. t는 tanh 출력입니다."),
          ("    out._backward = _backward", "이 함수를 out에 맡깁니다."),
      ],
      edits=[
          ins(7, "__mul__ 안의 out = 줄 바로 아래(return out 위)", "    out = Value(self.data * other.data, (self, other), '*')", 4),
          ins(7, "tanh 안의 out = 줄 바로 아래(return out 위)", "    out = Value(t, (self,), 'tanh')", 3),
      ],
      rerun=[7],
      expected="아무것도 출력되지 않으면 정상입니다.",
      check=vr(6.9999, 7.0001, MUL_BACK_EXPR),
      meaning="S16(곱하기)과 S25(tanh)에서 손으로 쓴 규칙을 코드로 옮겼습니다. 이제 세 연산 모두 기울기를 스스로 넘길 줄 압니다.",
      obj=["L01-O4"],
      hints=[
          RERUN_NOTE + "곱하기 칸에서 self의 기울기에는 누구의 값을 곱해야 할까요? self일까요, other일까요?",
          "곱하기: 한쪽 기울기 = 상대편 값 x 뒤에서 온 기울기. tanh: (1 - 출력²) x 뒤에서 온 기울기. 기초 F-M2, F-M3을 보세요.",
          ("빈칸을 채워 보세요.", ["other.data * out.grad", "self.data * out.grad", "(1 - t**2)"]),
          "풀이: __mul__에는 self.grad = other.data x out.grad, other.grad = self.data x out.grad를, tanh에는 self.grad = (1 - t²) x out.grad를 넣습니다. 각각 out._backward = _backward로 맡깁니다.",
      ],
      verify="u = Value(0.5)\nw = u.tanh()\nw.grad = 1.0\nw._backward()\nassert abs(u.grad - (1 - w.data**2)) < 1e-12"),

    S(29, "_backward를 하나씩 부르기", segs(9), "code",
      "같은 구간에서 _backward를 뒤에서부터 차례로 부르는 장면을 봅니다. "
      "먼저 Value 셀, 뉴런 입력 셀(S23), 뉴런 계산 셀(S24)을 차례로 다시 실행해 grad를 0으로 되돌립니다. 그다음 새 셀에 7줄을 칩니다.",
      code=[
          ("o.grad = 1.0", "맨 끝 o의 기울기는 1로 시작합니다(이것만 손으로)."),
          ("o._backward()", "o(tanh)가 n에게 기울기를 넘깁니다."),
          ("n._backward()", "n(더하기)이 x1w1x2w2와 b에게 넘깁니다."),
          ("x1w1x2w2._backward()", "x1w1x2w2(더하기)가 x1w1과 x2w2에게 넘깁니다."),
          ("x2w2._backward()", "x2w2(곱하기)가 x2와 w2에게 넘깁니다."),
          ("x1w1._backward()", "x1w1(곱하기)이 x1과 w1에게 넘깁니다."),
          ("draw_dot(o)", "그림을 다시 그립니다."),
      ],
      rerun=[7, 23, 24],
      expected="스스로 확인할 것: S26과 같은 숫자인가? x1 `grad -1.5000`, w1 `grad 1.0000`, x2 `grad 0.5000`, w2 `grad 0.0000`, n과 b `grad 0.5000`.",
      check={"type": "manual"},
      meaning="손 계산을 코드가 대신했습니다. 하지만 아직 부르는 순서(뒤에서 앞으로)를 사람이 정해야 합니다. 다음 단계에서 이 순서도 자동으로 만듭니다.",
      obj=["L01-O4"],
      hints=[
          "숫자가 S26과 다르다면, 다시 실행해야 할 세 셀(Value 셀, S23, S24)을 순서대로 돌렸나요?",
          "_backward는 뒤에서 앞 순서로 불러야 합니다. 앞 칸은 뒤 칸이 기울기를 넘겨준 뒤에야 넘길 값이 생기기 때문입니다. 기초 F-M2를 보세요.",
          ("빈칸을 채워 보세요.", ["o._backward()", "x1w1x2w2._backward()", "x1w1._backward()"]),
          "풀이: o.grad = 1.0으로 시작해 o, n, x1w1x2w2, x2w2, x1w1 순서로 _backward()를 부릅니다. b, x1 같은 맨 앞 상자는 빈 함수라 부르지 않아도 됩니다.",
      ],
      verify=_has("o", NEURON_GRADS)),

    S(30, "줄 세우기: 위상 정렬", segs(10), "code",
      "영상 1시간 17분 32초부터 봅니다. topo 목록을 만드는 장면 뒤에 새 셀에 10줄을 칩니다. "
      "위상 정렬은 '어떤 상자보다 그 재료가 늘 앞에 오도록' 줄을 세우는 방법입니다.",
      code=[
          ("topo = []", "줄 세운 상자를 담을 빈 목록."),
          ("visited = set()", "이미 살핀 상자를 적어 둘 빈 묶음. 같은 상자를 두 번 넣지 않으려고 씁니다."),
          ("def build_topo(v):", "상자 v를 줄에 세우는 함수."),
          ("  if v not in visited:", "아직 안 살핀 상자라면,"),
          ("    visited.add(v)", "살폈다고 적고,"),
          ("    for child in v._prev:", "v의 재료 상자마다,"),
          ("      build_topo(child)", "재료를 먼저 줄에 세웁니다(자기 자신을 다시 부름)."),
          ("    topo.append(v)", "재료를 다 세운 뒤에 v를 줄 끝에 넣습니다. 그래서 재료가 늘 앞에 옵니다."),
          ("build_topo(o)", "맨 끝 o에서 시작합니다."),
          ("topo", "줄 세운 목록을 보여 줍니다."),
      ],
      expected="`[Value(data=...), ..., Value(data=0.7071067811865476)]` 모양으로 상자 10개가 든 목록. 맨 끝은 늘 o(0.7071...)입니다. 앞쪽 순서는 사람마다 조금 다를 수 있습니다.",
      check=vr(10, 10, "len(topo)"),
      meaning="재료가 늘 결과보다 앞에 오는 줄을 만들었습니다. 이 줄을 거꾸로(끝에서 앞으로) 따라가며 _backward를 부르면 순서 걱정이 없습니다.",
      obj=["L01-O4"],
      hints=[
          "topo.append(v) 줄은 for 문 안에 있어야 할까요, 밖에 있어야 할까요? 빈칸 수를 보세요(4칸).",
          "재료를 모두 줄에 세운 다음 자기를 넣으면 재료가 늘 앞에 옵니다. 함수가 자기 자신을 부르는 것을 재귀라고 합니다. 기초 F-P3(리스트와 for 문), F-P4(함수)를 보세요.",
          ("빈칸을 채워 보세요.", ["v not in visited", "build_topo(child)", "topo.append(v)"]),
          "풀이: 위 10줄 그대로입니다. topo.append(v)는 for 문과 같은 깊이(화면 빈칸 4칸)라 재료를 다 세운 뒤 한 번 실행됩니다.",
      ],
      verify="assert topo[-1] is o\nassert all(topo.index(c) < topo.index(v) for v in topo for c in v._prev)"),

    S(31, "backward()를 상자에 넣기", segs(10), "code",
      "같은 구간에서 backward()를 Value 안에 넣는 장면을 봅니다. Value 셀 맨 아래에 13줄을 넣는데, 그중 8줄은 S30 셀에서 복사해 옵니다. "
      "(1) `  def backward(self):`를 칩니다. (2) S30의 첫 8줄(topo = []부터 topo.append(v)까지)을 복사해 붙이고, 줄마다 두 깊이만큼 더 들여씁니다(화면 기준 빈칸 4칸, 4칸씩 쓰는 셀이면 8칸). "
      "여러 줄을 고른 뒤 Tab 키를 누르면 한꺼번에 들여쓸 수 있습니다. 화면처럼 맞을 때까지 누르세요. "
      "(3) 나머지 4줄을 칩니다. 그다음 Value 셀을 다시 실행합니다.",
      code=[
          ("  def backward(self):", "새로 친 줄: 상자에 backward 기능을 만듭니다. o.backward()처럼 씁니다."),
          ("    topo = []", "옮긴 줄(S30): 줄 세울 빈 목록."),
          ("    visited = set()", "옮긴 줄: 살핀 상자 묶음."),
          ("    def build_topo(v):", "옮긴 줄: 줄 세우는 함수."),
          ("      if v not in visited:", "옮긴 줄: 안 살핀 상자라면,"),
          ("        visited.add(v)", "옮긴 줄: 살폈다고 적고,"),
          ("        for child in v._prev:", "옮긴 줄: 재료마다,"),
          ("          build_topo(child)", "옮긴 줄: 재료를 먼저 세우고,"),
          ("        topo.append(v)", "옮긴 줄: 자기를 줄 끝에 넣습니다."),
          ("    build_topo(self)", "새로 친 줄: o 대신 self(이 상자 자신)에서 시작합니다."),
          ("    self.grad = 1.0", "새로 친 줄: 맨 끝 기울기는 1로 시작합니다."),
          ("    for node in reversed(topo):", "새로 친 줄: 줄을 거꾸로(끝에서 앞으로) 하나씩 꺼내,"),
          ("      node._backward()", "새로 친 줄: 그 상자의 _backward를 부릅니다."),
      ],
      edits=[ins(7, "Value 셀 맨 아래(tanh의 return out 다음)", None, 13)],
      moved=8,
      rerun=[7],
      expected="아무것도 출력되지 않으면 정상입니다.",
      check=vr(0.9999, 1.0001, "(lambda v: (v.backward(), v.grad)[1])(Value(5.0))"),
      meaning="줄 세우기와 거꾸로 부르기를 상자의 기능 하나로 묶었습니다. 이제 어떤 계산이든 맨 끝 상자에서 backward()만 부르면 모든 기울기가 채워집니다.",
      obj=["L01-O4"],
      hints=[
          RERUN_NOTE + "IndentationError가 나면 옮긴 8줄의 빈칸 수를 하나씩 비교해 보세요. 가장 바깥 줄(topo = [])은 def backward 줄보다 한 깊이 안쪽(화면 4칸)이어야 합니다.",
          "S30의 o를 self로 바꾼 것뿐입니다. reversed는 목록을 뒤에서부터 꺼냅니다. 기초 F-P3, F-P6을 보세요.",
          ("빈칸을 채워 보세요.", ["def backward(self):", "build_topo(self)", "reversed(topo)", "node._backward()"]),
          "풀이: Value 셀 맨 아래에 def backward(self):, S30의 8줄(두 깊이 더 들여씀), build_topo(self), self.grad = 1.0, for node in reversed(topo):, node._backward()를 넣습니다.",
      ]),

    S(32, "한 줄로 역전파", segs(10), "code",
      "같은 구간에서 o.backward()를 부르는 장면을 봅니다. Value 셀, 뉴런 입력 셀(S23), 뉴런 계산 셀(S24)을 차례로 다시 실행한 뒤 새 셀에 2줄을 칩니다.",
      code=[
          ("o.backward()", "맨 끝 o에서 역전파를 한 번에 합니다."),
          ("draw_dot(o)", "그림을 다시 그립니다."),
      ],
      rerun=[7, 23, 24],
      expected="스스로 확인할 것: S26, S29와 같은 숫자인가? x1 `grad -1.5000`, w1 `grad 1.0000`, x2 `grad 0.5000`, w2 `grad 0.0000`, n과 b `grad 0.5000`, o `grad 1.0000`.",
      check={"type": "manual"},
      meaning="이제 backward() 한 줄이면 됩니다. PyTorch 같은 큰 도구도 바로 이 일을 합니다.",
      obj=["L01-O4"],
      hints=[
          "AttributeError: 'Value' object has no attribute 'backward'라면, Value 셀을 다시 실행한 뒤 S23, S24도 다시 실행했나요?",
          "backward()는 줄 세우기 → 맨 끝 기울기 1 → 거꾸로 _backward 부르기를 한 번에 합니다. S31을 보세요.",
          ("빈칸을 채워 보세요.", ["o.backward()"]),
          "풀이: 세 셀을 다시 실행해 새 상자를 만든 뒤 o.backward()와 draw_dot(o)를 실행합니다.",
      ],
      verify=_has("o", NEURON_GRADS)),
]
