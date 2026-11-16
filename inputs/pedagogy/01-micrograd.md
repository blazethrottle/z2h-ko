# 01 micrograd: 신경망과 역전파를 손으로 만들기

- 영상: "The spelled-out intro to neural networks and backpropagation: building micrograd", 2시간 26분, https://www.youtube.com/watch?v=VMj-3S1tku0
- 원본 저장소: karpathy/micrograd (`micrograd/engine.py`의 `Value`, `micrograd/nn.py`의 `Neuron`, `Layer`, `MLP`, `demo.ipynb`, `trace_graph.ipynb`), 강의 노트북은 karpathy/nn-zero-to-hero의 `lectures/micrograd`
- 실습 환경: CPU면 충분합니다. 맥미니 Jupyter 또는 Colab. 그림 도구 graphviz는 시스템 프로그램과 파이썬 패키지 둘 다 설치합니다(맥미니: `brew install graphviz`와 `pip install graphviz`, 맥미니에서 draw_dot SVG 그림 확인, CTO 실측 2026-11-16, cto/MEASURE_M0.md. Colab은 기본 설치로 알려져 있으나 실측 아님).
- 영상 구간 타임스탬프: `research/01_micrograd.md`의 유튜브 공식 챕터 기준으로 반영(2026-11-16). 단계별 시각은 3절 첫 표에 있습니다.
- 제작용 판(v1.2, 2026-11-16 CEO 결정으로 마무리): 3~5절은 `content/l01_source.py`, `content/l01_extra.py`에서 만들어지며 앱용 JSON은 `content/L01.json`입니다. 모든 코드는 실행 확인을 마쳤습니다(`content/test_content.py`).

## 1. 학습 목표

이 편을 마치면 얼큰이님은:
1. 숫자 기울기(f(x+h)-f(x))/h 를 계산하고 그 뜻을 말로 설명할 수 있습니다.
2. `+`, `*`, `tanh` 노드에서 기울기가 어떻게 전달되는지(연쇄 법칙) 손으로 채울 수 있습니다.
3. `Value` 클래스가 계산을 기록하고 `backward()`로 거꾸로 기울기를 채우는 과정을 줄별로 설명할 수 있습니다.
4. 같은 값을 두 번 쓰면 기울기를 더해야(`+=`) 하는 이유를 버그 예로 보여 줄 수 있습니다.
5. `Neuron`, `Layer`, `MLP`를 만들고, 손실을 줄이는 학습 반복(순전파, 기울기 0으로 비우기, 역전파, 갱신)을 직접 돌릴 수 있습니다.
6. 같은 계산을 PyTorch로 해서 기울기가 같은지 비교할 수 있습니다.

## 2. 선행 지식

- 반드시: F-P1, F-P2, F-P5, F-P6(특수 메서드), F-P7, F-M1, F-M2, F-M6
- 있으면 좋음: F-P3, F-P4, F-P8(그래프 그리기)

## 3. 따라 하기 단계

영상 구간표(출처: `research/01_micrograd.md` 2절, 유튜브 공식 챕터. 챕터 시작 시각이며 끝은 다음 챕터 시작입니다):

| 단계 | 영상 시각 | 챕터 |
|---|---|---|
| S01~S02 | 0:08:08 | 입력 1개 함수의 미분 |
| S03 | 0:14:12 | 입력 여러 개 함수의 미분 |
| S04~S06 | 0:19:09 | Value 객체, draw_dot 시각화 |
| S07 | 0:32:10 | 손으로 역전파 예제 1 |
| S08 | 0:51:10 | 최적화 한 단계 미리보기 |
| S09 | 0:52:52 | 손으로 역전파 예제 2: 뉴런 |
| S10 | 1:09:02 | 연산별 _backward |
| S11 | 1:17:32 | 그래프 전체 backward() |
| S12 | 1:22:28 | 여러 번 쓰는 노드 버그 |
| S13~S13d | 1:27:05 | tanh 쪼개기(숫자 섞기, exp, 빼기, 거듭제곱, 나누기) |
| S13e | 1:39:31 | PyTorch 비교 |
| S14~S14c | 1:43:55 | MLP 라이브러리 |
| S15 | 1:51:04 / 1:57:56 | 데이터와 손실 / 파라미터 모으기 |
| S15b | 2:01:12 | 경사하강 학습 |
| S16 | 2:01:12 구간 안 | zero_grad 필요성 |
| 복습용 | 2:14:03 / 2:16:46 | 요약 / 원본 저장소 둘러보기 |

형식: 단계마다 영상 구간, 새 코드 줄 수, 입력할 것, 코드와 줄별 풀이, 보여야 하는 것, 뜻, 힌트 H1~H4를 둡니다. 이 절은 `pedagogy/content/l01_source.py`에서 `build_content.py`로 만든 것이며, 같은 내용이 `pedagogy/content/L01.json`에 있습니다. 고칠 때는 원본(l01_source.py)을 고치고 다시 만듭니다. 모든 코드는 교사 몽키가 2026-11-16에 학습자 순서대로 실행해 확인했습니다(`content/test_content.py`).

코드 표의 `·`는 띄어쓰기 한 칸입니다(앱 화면에서는 보통 공백으로 보입니다). 'Value 클래스 셀'은 S04에서 만든 셀이며, S05부터 그 셀 안에 줄을 더하고 다시 실행합니다. 클래스를 고친 뒤에는 그 전에 만든 Value 상자들이 옛 설계도를 쓰므로, '먼저 다시 실행'에 적힌 셀을 다시 돌립니다.

**L01-S01 함수 그래프 그리기 (긴 단계)**
- 영상 구간: 0:08:08 ~ 0:14:12 (챕터 0:08:08 입력 1개 함수의 미분, video-segments.json과 같음)
- 새 코드: 9줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 입력: 새 셀에 아래 9줄을 입력하고 실행합니다. 앞 4줄은 이 편에서 쓸 도구를 불러오는 줄입니다(F-P8).

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `import math` | 수학 함수(tanh, exp)를 담은 도구를 불러옵니다 |
| 2 | `import random` | 무작위 숫자 도구를 불러옵니다. S14에서 씁니다 |
| 3 | `import numpy as np` | 숫자 목록을 한꺼번에 계산하는 도구를 np라는 짧은 이름으로 불러옵니다 |
| 4 | `import matplotlib.pyplot as plt` | 그래프 그리는 도구를 plt라는 짧은 이름으로 불러옵니다 |
| 5 | `def f(x):` | f라는 함수를 만듭니다. 숫자 x를 받습니다 |
| 6 | `····return 3*x**2 - 4*x + 5` | 3x² - 4x + 5를 계산해 돌려줍니다(**는 거듭제곱) |
| 7 | `xs = np.arange(-5, 5, 0.25)` | -5부터 5 바로 앞까지 0.25 간격으로 x 값 40개를 만듭니다 |
| 8 | `ys = f(xs)` | x 값 40개 모두에 f를 계산합니다 |
| 9 | `plt.plot(xs, ys)` | x와 f(x)를 선으로 이어 그립니다 |

- 보여야 하는 것: 아래로 볼록한 포물선(U 모양) 그래프가 보입니다. 가장 낮은 곳은 x가 약 0.67인 부근입니다. 그래프 위에 `[<matplotlib.lines.Line2D ...>]` 같은 글이 한 줄 보여도 정상입니다.
- 점검 방식: 직접 확인(학습자가 '보여야 하는 것'과 비교)
- 뜻: 신경망도 결국 입력을 넣으면 출력이 나오는 큰 함수입니다. 오늘은 이런 함수의 '기울기'를 직접 재고 계산합니다.
- 힌트: H1 "그래프가 안 보인다면, 마지막 줄이 무엇을 하는 줄인지 다시 읽어 보셨나요?" / H2 "`def f(x):` 다음 줄은 띄어쓰기 4칸으로 들여 써야 합니다(F-P5). 에러가 `NameError: np`라면 3번째 줄 import를 실행했는지 보세요." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: 들여쓰기를 빠뜨리거나 `**` 대신 `^`를 쓰는 경우가 많습니다. 파이썬에서 거듭제곱은 `**`입니다.

```python
import math
import random
import numpy as np
import matplotlib.pyplot as plt
def f(x):
    return ___
xs = ___
ys = f(xs)
plt.plot(xs, ys)
```

**L01-S02 숫자 기울기**
- 영상 구간: 0:08:08 ~ 0:14:12 (챕터 0:08:08 입력 1개 함수의 미분, video-segments.json과 같음)
- 새 코드: 3줄. 셀: 새 셀.
- 입력: 새 셀에 3줄을 입력하고 실행합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `h = 0.0001` | 아주 작은 걸음 h를 정합니다 |
| 2 | `x = 3.0` | 기울기를 잴 위치입니다 |
| 3 | `(f(x + h) - f(x)) / h` | x를 h만큼 올렸을 때 f가 변한 양을 h로 나눕니다. 이것이 숫자 기울기입니다 |

- 보여야 하는 것: 약 14.0003 이 보입니다(14에 아주 가까운 수).
- 점검 방식: 값 범위 13.99 ~ 14.01
- 뜻: x를 아주 조금 올리면 f는 그 약 14배만큼 오릅니다. 기울기는 '조금 바꾸면 몇 배로 변하나'입니다.
- 힌트: H1 "f(x + h)와 f(x)의 차이를 무엇으로 나눠야 '몇 배'가 될까요?" / H2 "숫자 기울기 공식은 (f(x+h) - f(x)) / h 입니다(F-M1). 괄호 위치를 확인하세요." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: 괄호 없이 `f(x + h) - f(x) / h`로 쓰면 나눗셈이 먼저 계산되어 전혀 다른 숫자가 나옵니다.

```python
___ = 0.0001
x = 3.0
(___) / h
```

**L01-S03 입력이 여러 개일 때 (긴 단계)**
- 영상 구간: 0:14:12 ~ 0:19:09 (챕터 0:14:12 입력 여러 개 함수의 미분, video-segments.json과 같음)
- 새 코드: 7줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 입력: 새 셀에 7줄을 입력하고 실행합니다. a만 조금 올려서 d가 얼마나 변하는지 봅니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `a = 2.0` | 입력 a |
| 2 | `b = -3.0` | 입력 b |
| 3 | `c = 10.0` | 입력 c |
| 4 | `d1 = a*b + c` | 처음 결과 d1을 계산합니다 |
| 5 | `a += h` | a만 h만큼 올립니다(a = a + h와 같음) |
| 6 | `d2 = a*b + c` | a를 올린 뒤의 결과 d2를 계산합니다 |
| 7 | `print(d1, d2, (d2 - d1) / h)` | 두 결과와, d가 a에 대해 변한 비율(기울기)을 보여 줍니다 |

- 보여야 하는 것: `4.0 3.999699999999999 -3.000000000010772`처럼 세 숫자가 보입니다. 마지막 숫자는 약 -3.0(b의 값)입니다. 소수 끝자리가 지저분한 것은 컴퓨터 소수 계산의 작은 오차라 정상입니다.
- 점검 방식: 값 범위 -3.01 ~ -2.99
- 뜻: d를 a로 미분하면 b가 나옵니다. `a += h`를 `b += h`로 바꾸면 2.0(a의 값), `c += h`로 바꾸면 1.0이 나오는지 직접 해 봅니다.
- 힌트: H1 "a를 올렸더니 d가 내려갔다면, 기울기의 부호는 무엇일까요?" / H2 "곱셈 a*b에서 a를 조금 올리면 결과는 b배만큼 변합니다(F-M2). 마지막 줄은 (d2 - d1) / h 입니다." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: S02 셀을 실행하지 않아 h가 없다는 NameError가 나는 경우가 많습니다. 위 셀부터 차례로 실행하세요.

```python
a = 2.0
b = -3.0
c = 10.0
d1 = a*b + c
___
d2 = a*b + c
print(d1, d2, ___)
```

**L01-S04 Value 클래스 뼈대 (긴 단계)**
- 영상 구간: 0:19:09 ~ 0:32:10 (챕터 0:19:09 Value 객체, draw_dot 시각화, video-segments.json과 같음)
- 새 코드: 9줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 입력: 새 셀에 Value 클래스 8줄과 확인 1줄을 입력하고 실행합니다. 이 셀을 앞으로 'Value 클래스 셀'이라 부르며, S05부터 이 셀 안에 줄을 더해 갑니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `class Value:` | 숫자 하나를 감싸는 상자 Value를 정의합니다(F-P6 클래스) |
| 2 | `····def __init__(self, data, _children=(), _op=''):` | 상자를 만들 때 실행됩니다. 숫자, 재료 값들, 계산 기호를 받습니다 |
| 3 | `········self.data = data` | 실제 숫자를 담습니다 |
| 4 | `········self.grad = 0.0` | 기울기 칸입니다. 처음엔 0입니다 |
| 5 | `········self._prev = set(_children)` | 나를 만든 재료 값들(족보)을 기억합니다 |
| 6 | `········self._op = _op` | 어떤 계산으로 만들어졌는지('+', '*' 등) 기억합니다 |
| 7 | `····def __repr__(self):` | 상자를 화면에 보여 줄 때의 모양을 정합니다 |
| 8 | `········return f"Value(data={self.data})"` | Value(data=숫자) 모양으로 보여 줍니다 |
| 9 | `Value(2.0)` | 2.0을 담은 상자를 하나 만들어 봅니다 |

- 보여야 하는 것: `Value(data=2.0)`이 보입니다.
- 점검 방식: 출력 일치 `Value(data=2.0)`
- 뜻: 평범한 숫자에 '기울기 칸'과 '족보(재료 기록)'를 붙였습니다. 이 두 칸이 역전파의 전부입니다.
- 힌트: H1 "`__init__` 안의 줄들은 어느 만큼 들여 써야 할까요?" / H2 "클래스 안 함수는 4칸, 함수 안 줄은 8칸 들여 씁니다(F-P5, F-P6). `__init__`은 밑줄이 앞뒤로 두 개씩입니다." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: `__init__`을 `_init_`(밑줄 하나)로 쓰면 에러 없이 넘어가다가 `Value(2.0)`에서 에러가 납니다.

```python
class Value:
    def __init__(self, data, _children=(), _op=''):
        self.data = data
        ___
        self._prev = ___
        self._op = _op
    def __repr__(self):
        return f"Value(data={self.data})"
Value(2.0)
```

**L01-S05 덧셈과 곱셈 기록하기 (긴 단계)**
- 영상 구간: 0:19:09 ~ 0:32:10 (챕터 0:19:09 Value 객체, draw_dot 시각화, video-segments.json과 같음)
- 새 코드: 7줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: Value 클래스 셀(L01-S04) 고치기.
- 넣을 곳: Value 클래스 셀 맨 아래에 6줄. 아래 코드 표의 앞 줄들이 넣을 줄이고(넣을 곳 순서대로), 그 뒤 줄은 새 셀에 칩니다.
- 입력: Value 클래스 셀의 맨 아래(`__repr__` 다음)에 6줄을 더하고 그 셀을 다시 실행합니다. 그다음 새 셀에 확인 1줄을 실행합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `····def __add__(self, other):` | `+` 기호를 쓰면 실행되는 함수입니다 |
| 2 | `········out = Value(self.data + other.data, (self, other), '+')` | 두 숫자를 더한 새 상자를 만들고, 재료(나와 상대)와 기호 '+'를 기록합니다 |
| 3 | `········return out` | 새 상자를 돌려줍니다 |
| 4 | `····def __mul__(self, other):` | `*` 기호를 쓰면 실행되는 함수입니다 |
| 5 | `········out = Value(self.data * other.data, (self, other), '*')` | 두 숫자를 곱한 새 상자를 만들고 재료와 기호 '*'를 기록합니다 |
| 6 | `········return out` | 새 상자를 돌려줍니다 |
| 7 | `print(Value(2.0) * Value(-3.0) + Value(10.0))` | 곱하고 더한 결과를 보여 줍니다 |

- 보여야 하는 것: `Value(data=4.0)`이 보입니다.
- 점검 방식: 출력 일치 `Value(data=4.0)`
- 뜻: 계산할 때마다 '누가 누구로 만들어졌는지'가 그물(계산 그래프)로 남습니다.
- 힌트: H1 "결과 상자를 만들 때 재료로 넘겨야 하는 두 값은 무엇일까요?" / H2 "`Value(...)`의 두 번째 칸은 재료 묶음 `(self, other)`, 세 번째 칸은 기호입니다(S04의 `__init__`). 클래스 셀을 고친 뒤 꼭 다시 실행하세요." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: 클래스 셀을 고치고 다시 실행하지 않으면 `TypeError: unsupported operand`가 납니다. 고친 클래스는 다시 실행해야 적용됩니다.

```python
    def __add_____:
        out = Value(___, (self, other), '+')
        return out
    def __mul__(self, other):
        out = Value(self.data * other.data, (self, other), '*')
        return out
print(Value(2.0) * Value(-3.0) + Value(10.0))
```

**L01-S06 계산 그래프 그림 (긴 단계)**
- 영상 구간: 0:19:09 ~ 0:32:10 (챕터 0:19:09 Value 객체, draw_dot 시각화, video-segments.json과 같음)
- 새 코드: 6줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 준비 코드(붙여 넣기만, 외울 필요 없음, 확인 문제와 재구성 과제에 나오지 않음): karpathy/nn-zero-to-hero lectures/micrograd 노트북의 draw_dot를 줄여 다듬은 것(label 칸 대신 data와 grad만 표시)

<details><summary>준비 코드 draw_dot 줄별 풀이</summary>

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `from graphviz import Digraph` | 그림 도구 graphviz에서 그림판(Digraph)을 불러옵니다 |
| 2 | `def trace(root):` | 결과 값에서 출발해 모든 상자와 연결선을 모으는 함수입니다 |
| 3 | `····nodes, edges = set(), set()` | 상자 모음과 연결선 모음을 빈 집합으로 시작합니다 |
| 4 | `····def build(v):` | 값 하나를 받아 그 재료를 따라 내려가는 안쪽 함수입니다 |
| 5 | `········if v not in nodes:` | 아직 모으지 않은 값이면 |
| 6 | `············nodes.add(v)` | 상자 모음에 넣고 |
| 7 | `············for child in v._prev:` | 그 값을 만든 재료마다 |
| 8 | `················edges.add((child, v))` | 재료에서 결과로 가는 선을 기록하고 |
| 9 | `················build(child)` | 재료의 재료도 같은 방법으로 모읍니다 |
| 10 | `····build(root)` | 결과 값에서 모으기를 시작합니다 |
| 11 | `····return nodes, edges` | 모은 상자와 선을 돌려줍니다 |
| 12 | `def draw_dot(root):` | 모은 것을 그림으로 그리는 함수입니다 |
| 13 | `····dot = Digraph(format='svg', graph_attr={'rankdir': 'LR'})` | 왼쪽에서 오른쪽으로 흐르는 그림판을 만듭니다 |
| 14 | `····nodes, edges = trace(root)` | 상자와 선을 모읍니다 |
| 15 | `····for n in nodes:` | 상자마다 |
| 16 | `········uid = str(id(n))` | 상자마다 겹치지 않는 이름표를 만듭니다 |
| 17 | `········dot.node(name=uid, label=f"data {n.data:.4f} \| grad {n.grad:.4f}", shape='record')` | 상자에 값(data)과 기울기(grad)를 소수 넷째 자리까지 적습니다 |
| 18 | `········if n._op:` | 계산으로 만들어진 값이면 |
| 19 | `············dot.node(name=uid + n._op, label=n._op)` | 계산 기호(+, * 등) 동그라미를 하나 더 그리고 |
| 20 | `············dot.edge(uid + n._op, uid)` | 기호에서 결과 상자로 선을 긋습니다 |
| 21 | `····for n1, n2 in edges:` | 기록한 선마다 |
| 22 | `········dot.edge(str(id(n1)), str(id(n2)) + n2._op)` | 재료 상자에서 결과의 계산 기호로 선을 긋습니다 |
| 23 | `····return dot` | 그림을 돌려줍니다. 셀 마지막 줄이면 그림이 화면에 보입니다 |

</details>

- 입력: 준비 코드 셀에 그림 함수 draw_dot을 붙여 넣고 실행합니다(직접 치지 않음). 그다음 새 셀에 6줄을 입력하고 실행합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `a = Value(2.0)` | 값 a |
| 2 | `b = Value(-3.0)` | 값 b |
| 3 | `c = Value(10.0)` | 값 c |
| 4 | `e = a*b` | a와 b를 곱한 중간 값 e |
| 5 | `d = e + c` | e와 c를 더한 결과 d |
| 6 | `draw_dot(d)` | d에서 거슬러 올라가며 계산 그래프를 그립니다 |

- 보여야 하는 것: a, b, c, e, d가 상자로, `*`와 `+`가 동그라미로 이어진 그림이 보입니다. 모든 상자의 grad는 아직 0.0000입니다.
- 점검 방식: 직접 확인(학습자가 '보여야 하는 것'과 비교)
- 뜻: 역전파는 이 그림을 오른쪽(결과)에서 왼쪽(재료)으로 거슬러 가는 일입니다.
- 힌트: H1 "그림이 안 나온다면, 준비 코드 셀을 먼저 실행했나요?" / H2 "`ExecutableNotFound` 에러는 코드가 아니라 graphviz 설치 문제입니다(F-P8, 환경 안내). Colab은 기본 설치되어 있습니다." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: graphviz는 파이썬 패키지와 시스템 프로그램 둘 다 필요합니다. 코드가 맞는데 그림만 안 나오면 HELP로 환경 문제를 알립니다.

```python
a = Value(2.0)
b = Value(-3.0)
c = Value(10.0)
e = ___
d = ___
draw_dot(d)
```

**L01-S07 손으로 기울기 채우기 (긴 단계)**
- 영상 구간: 0:32:10 ~ 0:51:10 (챕터 0:32:10 손으로 역전파 예제 1, video-segments.json과 같음)
- 새 코드: 10줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 입력: 새 셀에 10줄을 입력하고 실행합니다. 결과 L에서 시작해 거꾸로 기울기를 직접 채웁니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `f = Value(-2.0)` | 값 f를 하나 더 만듭니다(S01의 함수 f는 여기서 덮어써집니다) |
| 2 | `L = d * f` | 최종 결과 L = d × f |
| 3 | `L.grad = 1.0` | L을 L로 미분하면 1입니다. 거꾸로 가는 출발점입니다 |
| 4 | `d.grad = f.data` | 곱셈: d의 기울기는 상대인 f의 값입니다 |
| 5 | `f.grad = d.data` | 곱셈: f의 기울기는 상대인 d의 값입니다 |
| 6 | `c.grad = d.grad` | 덧셈: 받은 기울기를 그대로 전합니다 |
| 7 | `e.grad = d.grad` | 덧셈: e에게도 그대로 전합니다 |
| 8 | `a.grad = e.grad * b.data` | 연쇄 법칙: 위에서 온 기울기 × 상대 값 b |
| 9 | `b.grad = e.grad * a.data` | 연쇄 법칙: 위에서 온 기울기 × 상대 값 a |
| 10 | `draw_dot(L)` | 기울기가 채워진 그림을 봅니다 |

- 보여야 하는 것: L의 data는 -8.0000입니다. grad: L 1.0, d -2.0, f 4.0, c -2.0, e -2.0, a 6.0, b -4.0.
- 점검 방식: 직접 확인(앱 점검값: L.data = -8.0, a.grad = 6.0, b.grad = -4.0, c.grad = -2.0, f.grad = 4.0)
- 뜻: + 는 기울기를 그대로 나눠 주고, * 는 상대 값을 곱해 전합니다. 결과에서 거꾸로 곱해 오는 것이 연쇄 법칙입니다.
- 힌트: H1 "d가 1 늘면 L = d × f는 얼마나 변할까요?" / H2 "곱셈 노드는 상대 값을 곱해 전하고, 덧셈 노드는 그대로 전합니다(F-M2 연쇄 법칙). 순서는 L, d와 f, c와 e, a와 b입니다." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: a.grad에 b.data만 쓰고 위에서 온 e.grad를 곱하지 않는 실수가 흔합니다. 숫자가 6.0이 아니라 -3.0이 나옵니다.

```python
f = Value(-2.0)
L = d * f
L.grad = 1.0
___ = ___
f.grad = d.data
c.grad = d.grad
e.grad = d.grad
a.grad = ___
b.grad = e.grad * a.data
draw_dot(L)
```

**L01-S08 한 걸음 움직여 보기 (긴 단계)**
- 영상 구간: 0:51:10 ~ 0:52:52 (챕터 0:51:10 최적화 한 단계 미리보기, video-segments.json과 같음)
- 새 코드: 6줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 입력: 새 셀에 6줄을 입력하고 실행합니다. 기울기 방향으로 값을 조금 움직이고 L을 다시 계산합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `for v in [a, b, c, f]:` | 직접 만든 입력 값 네 개를 하나씩 |
| 2 | `····v.data += 0.01 * v.grad` | 기울기 방향으로 0.01배만큼 움직입니다 |
| 3 | `e = a*b` | 움직인 값으로 다시 곱하고 |
| 4 | `d = e + c` | 다시 더하고 |
| 5 | `L = d * f` | 다시 L을 계산합니다 |
| 6 | `print(L.data)` | 새 L을 보여 줍니다 |

- 보여야 하는 것: 약 -7.29가 보입니다. 처음 -8.0보다 커졌습니다.
- 점검 방식: 값 범위 -7.4 ~ -7.2
- 뜻: 기울기는 '어느 쪽으로 움직이면 결과가 커지는지' 알려 줍니다. 학습은 이것을 반대로(손실을 줄이는 쪽으로) 쓰는 일입니다.
- 힌트: H1 "값을 기울기와 같은 방향으로 움직이면 L은 커질까요, 작아질까요?" / H2 "`v.data += 0.01 * v.grad`는 기울기 방향 한 걸음입니다(F-M6 경사 하강). 그 뒤 e, d, L을 순서대로 다시 계산해야 합니다." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: 값만 바꾸고 e, d, L을 다시 계산하지 않으면 L이 그대로 -8.0으로 보입니다.

```python
for v in [a, b, c, f]:
    v.data += ___
e = a*b
d = e + c
L = ___
print(L.data)
```

**L01-S09 뉴런 하나 계산하기 (긴 단계)**
- 영상 구간: 0:52:52 ~ 1:09:02 (챕터 0:52:52 손으로 역전파 예제 2: 뉴런, video-segments.json과 같음)
- 새 코드: 7줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 입력: 새 셀에 7줄을 입력하고 실행합니다. 입력 2개, 가중치 2개, 편향 1개로 뉴런의 합을 계산합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `x1 = Value(2.0)` | 입력 1 |
| 2 | `x2 = Value(0.0)` | 입력 2 |
| 3 | `w1 = Value(-3.0)` | 입력 1의 가중치(얼마나 중요하게 볼지) |
| 4 | `w2 = Value(1.0)` | 입력 2의 가중치 |
| 5 | `b = Value(6.8813735870195432)` | 편향. 계산을 보기 좋게 만들려고 영상에서 고른 값입니다 |
| 6 | `n = x1*w1 + x2*w2 + b` | 입력 × 가중치를 모두 더하고 편향을 더합니다 |
| 7 | `print(n)` | 합을 보여 줍니다 |

- 보여야 하는 것: `Value(data=0.8813735870195432)`이 보입니다.
- 점검 방식: 값 범위 0.8813 ~ 0.8814
- 뜻: 뉴런은 '입력 × 가중치의 합 + 편향'입니다. 여기까지는 S05에서 만든 +와 *만 씁니다.
- 힌트: H1 "입력마다 무엇을 곱해서 더해야 할까요?" / H2 "뉴런 합 = x1*w1 + x2*w2 + b 입니다(F-M3). 편향 숫자는 그대로 복사해 붙여 넣으세요." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: 편향 숫자를 짧게 줄여 쓰면 뒤 단계의 0.7071 같은 깔끔한 숫자가 안 나옵니다.

```python
x1 = Value(2.0)
x2 = Value(0.0)
w1 = Value(-3.0)
w2 = Value(1.0)
b = Value(6.8813735870195432)
n = ___
print(n)
```

**L01-S09b tanh 붙이기 (긴 단계)**
- 영상 구간: 0:52:52 ~ 1:09:02 (챕터 0:52:52 손으로 역전파 예제 2: 뉴런, video-segments.json과 같음)
- 새 코드: 6줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: Value 클래스 셀(L01-S04) 고치기.
- 넣을 곳: Value 클래스 셀 맨 아래에 4줄. 아래 코드 표의 앞 줄들이 넣을 줄이고(넣을 곳 순서대로), 그 뒤 줄은 새 셀에 칩니다.
- 먼저 다시 실행: L01-S09 셀
- 입력: Value 클래스 셀 맨 아래에 tanh 4줄을 더하고 다시 실행합니다. 클래스를 바꿨으니 S09 셀도 다시 실행한 뒤, 새 셀에 2줄을 실행합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `····def tanh(self):` | tanh(값을 -1과 1 사이로 눌러 주는 함수, F-M5)를 Value에 붙입니다 |
| 2 | `········t = math.tanh(self.data)` | 내 숫자의 tanh를 계산해 t에 둡니다 |
| 3 | `········out = Value(t, (self,), 'tanh')` | t를 담은 새 상자, 재료는 나 하나, 기호는 'tanh' |
| 4 | `········return out` | 새 상자를 돌려줍니다 |
| 5 | `o = n.tanh()` | 뉴런 합 n에 tanh를 씌운 출력 o |
| 6 | `draw_dot(o)` | o까지 이어진 그림을 봅니다 |

- 보여야 하는 것: 그림 맨 오른쪽 o 상자의 data가 0.7071입니다.
- 점검 방식: 직접 확인(앱 점검값: o.data = 0.7071)
- 뜻: 뉴런의 출력은 합에 tanh를 씌운 값입니다. 이 활성화 함수 덕분에 신경망이 곡선 모양도 배울 수 있습니다.
- 힌트: H1 "`AttributeError: 'Value' object has no attribute 'tanh'`가 났다면, n은 언제 만든 상자일까요?" / H2 "클래스를 고치기 전에 만든 상자는 옛 설계도를 씁니다. 클래스 셀 실행 후 S09 셀을 다시 실행하세요(F-P6)." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: 재료 묶음을 `(self)`로 쓰면 묶음이 아니라 그냥 값이 되어 에러가 납니다. 하나짜리 묶음은 `(self,)`처럼 쉼표가 필요합니다(F-P3).

```python
    def tanh(self):
        t = ___
        out = Value(t, ___, 'tanh')
        return out
o = n.tanh()
draw_dot(o)
```

**L01-S10 _backward를 + 와 * 안에 넣기 (긴 단계)**
- 영상 구간: 1:09:02 ~ 1:17:32 (챕터 1:09:02 연산별 _backward, video-segments.json과 같음)
- 새 코드: 9줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: Value 클래스 셀(L01-S04) 고치기.
- 넣을 곳: `__init__` 안, `self.grad = 0.0` 바로 아래에 1줄 / `__add__` 안, `out = ...` 줄과 `return out` 사이에 4줄 / `__mul__` 안, `out = ...` 줄과 `return out` 사이에 4줄. 아래 코드 표의 앞 줄들이 넣을 줄이고(넣을 곳 순서대로), 그 뒤 줄은 새 셀에 칩니다.
- 입력: Value 클래스 셀 세 곳에 줄을 더하고 다시 실행합니다. 이 단계는 실행 결과가 따로 없고, 확인은 S10b에서 합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `········self._backward = lambda: None` | 기울기를 재료에 나눠 주는 함수 칸. 처음엔 아무것도 안 하는 함수입니다 |
| 2 | `········def _backward():` | 덧셈 결과의 기울기를 재료에게 나눠 주는 함수입니다 |
| 3 | `············self.grad += out.grad` | 덧셈은 받은 기울기를 그대로 전합니다. 더하기(+=)로 쌓습니다 |
| 4 | `············other.grad += out.grad` | 상대에게도 그대로 전합니다 |
| 5 | `········out._backward = _backward` | 이 함수를 결과 상자에 저장해 둡니다(나중에 부름) |
| 6 | `········def _backward():` | 곱셈 결과의 기울기를 재료에게 나눠 주는 함수입니다 |
| 7 | `············self.grad += other.data * out.grad` | 곱셈: 상대 값 × 받은 기울기(S07에서 손으로 한 것) |
| 8 | `············other.grad += self.data * out.grad` | 상대는 내 값 × 받은 기울기 |
| 9 | `········out._backward = _backward` | 결과 상자에 저장해 둡니다 |

- 보여야 하는 것: 클래스 셀이 에러 없이 실행됩니다. 화면에 따로 보이는 것은 없습니다.
- 점검 방식: 직접 확인(학습자가 '보여야 하는 것'과 비교)
- 뜻: S07에서 손으로 한 규칙을 각 계산 안에 넣어, 결과 상자가 '내 기울기를 재료에게 어떻게 나눌지'를 스스로 알게 했습니다.
- 힌트: H1 "덧셈 결과의 기울기는 재료에게 어떤 모양으로 전해졌었나요(S07)?" / H2 "+ 는 out.grad 그대로, * 는 상대 data × out.grad 입니다(L01-S07). `def _backward():`는 `out = ...` 줄과 같은 깊이(8칸)로 씁니다." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: `out._backward = _backward()`처럼 괄호를 붙이면 함수를 저장하지 않고 바로 실행해 버립니다. 괄호 없이 저장합니다.

```python
        self.___ = lambda: None
        def _backward():
            self.grad += ___
            other.grad += out.grad
        out._backward = _backward
        def _backward():
            self.grad += ___
            other.grad += self.data * out.grad
        out._backward = _backward
```

**L01-S10b tanh의 _backward (긴 단계)**
- 영상 구간: 1:09:02 ~ 1:17:32 (챕터 1:09:02 연산별 _backward, video-segments.json과 같음)
- 새 코드: 7줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: Value 클래스 셀(L01-S04) 고치기.
- 넣을 곳: `tanh` 안, `out = ...` 줄과 `return out` 사이에 3줄. 아래 코드 표의 앞 줄들이 넣을 줄이고(넣을 곳 순서대로), 그 뒤 줄은 새 셀에 칩니다.
- 먼저 다시 실행: L01-S09, L01-S09b 셀
- 입력: tanh 안에 3줄을 더하고 클래스 셀을 다시 실행합니다. S09, S09b 셀을 다시 실행한 뒤 새 셀에 4줄을 실행합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `········def _backward():` | tanh 결과의 기울기를 재료에게 전하는 함수입니다 |
| 2 | `············self.grad += (1 - t**2) * out.grad` | tanh의 미분은 1 - t²입니다. 받은 기울기에 곱해 전합니다 |
| 3 | `········out._backward = _backward` | 결과 상자에 저장해 둡니다 |
| 4 | `o.grad = 1.0` | 출발점 o의 기울기를 1로 둡니다 |
| 5 | `o._backward()` | o가 재료 n에게 기울기를 전합니다 |
| 6 | `n._backward()` | n이 자기 재료(합과 b)에게 전합니다 |
| 7 | `draw_dot(o)` | 그림으로 확인합니다 |

- 보여야 하는 것: n의 grad가 0.5000, b의 grad가 0.5000입니다. 그보다 왼쪽 상자들은 아직 0입니다.
- 점검 방식: 직접 확인(앱 점검값: n.grad = 0.5, b.grad = 0.5)
- 뜻: 각 상자가 자기 _backward를 부르면 기울기가 한 칸씩 왼쪽으로 갑니다. 이것을 모든 상자에 순서대로 하면 역전파입니다.
- 힌트: H1 "o.data가 0.7071일 때 1 - o.data²은 얼마인가요?" / H2 "tanh의 미분은 1 - t²입니다(F-M5). 0.7071² = 0.5 이므로 0.5가 나와야 합니다." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: 클래스를 고친 뒤 S09, S09b를 다시 실행하지 않으면 옛 o에는 새 _backward가 없어 grad가 0으로 남습니다.

```python
        def _backward():
            self.grad += ___
        out._backward = _backward
o.grad = 1.0
o._backward()
n._backward()
draw_dot(o)
```

**L01-S11 위상 정렬 (긴 단계)**
- 영상 구간: 1:17:32 ~ 1:22:28 (챕터 1:17:32 그래프 전체 backward(), video-segments.json과 같음)
- 새 코드: 10줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 입력: 새 셀에 10줄을 입력하고 실행합니다. 상자들을 '재료가 먼저, 결과가 나중' 순서로 줄 세웁니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `topo = []` | 줄 세운 결과를 담을 빈 목록 |
| 2 | `visited = set()` | 이미 들른 상자를 기억하는 집합 |
| 3 | `def build_topo(v):` | 상자 하나를 받아 줄 세우는 함수 |
| 4 | `····if v not in visited:` | 아직 안 들른 상자면 |
| 5 | `········visited.add(v)` | 들렀다고 표시하고 |
| 6 | `········for child in v._prev:` | 그 상자의 재료마다 |
| 7 | `············build_topo(child)` | 재료를 먼저 줄 세웁니다 |
| 8 | `········topo.append(v)` | 재료가 다 줄 선 뒤에 나를 뒤에 붙입니다 |
| 9 | `build_topo(o)` | 출력 o에서 시작합니다 |
| 10 | `topo` | 줄 세운 목록을 보여 줍니다 |

- 보여야 하는 것: Value 10개가 담긴 목록이 보입니다. 맨 뒤가 o(`Value(data=0.7071...)`)입니다.
- 점검 방식: 직접 확인(앱 점검값: len(topo) = 10)
- 뜻: 재료가 늘 결과보다 앞에 섭니다. 이 목록을 거꾸로 돌면, 결과 쪽 기울기가 다 모인 뒤에 재료로 넘어갑니다.
- 힌트: H1 "나를 목록에 붙이기 전에 먼저 해야 할 일은 무엇일까요?" / H2 "재료(`v._prev`)를 모두 줄 세운 뒤에 `topo.append(v)`를 합니다. append 줄은 for 줄과 같은 깊이(8칸)입니다." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: `topo.append(v)`를 for 안(12칸)에 넣으면 같은 상자가 여러 번 들어가 목록이 10개보다 길어집니다.

```python
topo = []
visited = set()
def build_topo(v):
    if ___:
        visited.add(v)
        for child in v._prev:
            ___
        ___
build_topo(o)
topo
```

**L01-S11b backward() 메서드 (긴 단계)**
- 영상 구간: 1:17:32 ~ 1:22:28 (챕터 1:17:32 그래프 전체 backward(), video-segments.json과 같음)
- 새 코드: 7줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다), 옮겨 붙이는 줄 8줄(S11에서 쓴 줄, 새로 생각할 것 없음). 셀: Value 클래스 셀(L01-S04) 고치기.
- 넣을 곳: Value 클래스 셀 맨 아래에 13줄. 아래 코드 표의 앞 줄들이 넣을 줄이고(넣을 곳 순서대로), 그 뒤 줄은 새 셀에 칩니다.
- 먼저 다시 실행: L01-S09, L01-S09b 셀
- 입력: Value 클래스 셀 맨 아래에 backward를 더합니다. 13줄 가운데 8줄은 S11에서 쓴 줄을 그대로 옮겨 붙이는 것이고, 새로 생각할 줄은 5줄입니다. 클래스 셀, S09, S09b를 다시 실행한 뒤 새 셀에 2줄을 실행합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `····def backward(self):` | (새 줄) 이 상자에서 시작해 전체 기울기를 채우는 함수입니다 |
| 2 | `········topo = []` | (옮긴 줄) 빈 목록 |
| 3 | `········visited = set()` | (옮긴 줄) 들른 상자 기억 |
| 4 | `········def build_topo(v):` | (옮긴 줄) 줄 세우기 함수 |
| 5 | `············if v not in visited:` | (옮긴 줄) 안 들른 상자면 |
| 6 | `················visited.add(v)` | (옮긴 줄) 표시하고 |
| 7 | `················for child in v._prev:` | (옮긴 줄) 재료마다 |
| 8 | `····················build_topo(child)` | (옮긴 줄) 재료 먼저 |
| 9 | `················topo.append(v)` | (옮긴 줄) 그다음 나 |
| 10 | `········build_topo(self)` | (새 줄) o 대신 나(self)에서 시작합니다 |
| 11 | `········self.grad = 1.0` | (새 줄) 출발점 기울기는 1입니다 |
| 12 | `········for node in reversed(topo):` | (새 줄) 줄 세운 목록을 거꾸로(결과부터) 돌며 |
| 13 | `············node._backward()` | (새 줄) 상자마다 재료에게 기울기를 전합니다 |
| 14 | `o.backward()` | o에서 역전파를 한 번에 실행합니다 |
| 15 | `draw_dot(o)` | 모든 grad가 채워진 그림을 봅니다 |

- 보여야 하는 것: grad: o 1.0, n 0.5, b 0.5, x1 -1.5, w1 1.0, x2 0.5, w2 0.0.
- 점검 방식: 직접 확인(앱 점검값: x1.grad = -1.5, w1.grad = 1.0, x2.grad = 0.5, w2.grad = 0.0)
- 뜻: 손으로 하던 역전파가 `o.backward()` 한 줄이 되었습니다. PyTorch의 `loss.backward()`도 같은 일을 합니다.
- 힌트: H1 "출력 o의 grad는 처음에 무엇이어야 거꾸로 전할 수 있을까요?" / H2 "`backward()`에서 `self.grad = 1.0`을 하고, 위상 정렬 목록을 `reversed`로 돕니다(L01-S11)." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: 옮긴 줄들의 들여쓰기를 4칸씩 더 넣지 않아 클래스 밖으로 빠지는 경우가 많습니다. backward 안이므로 모두 한 단계 더 들여 씁니다.

```python
    def backward(self):
        topo = []
        visited = set()
        def build_topo(v):
            if v not in visited:
                visited.add(v)
                for child in v._prev:
                    build_topo(child)
                topo.append(v)
        build_topo(self)
        ___
        for node in ___:
            node._backward()
o.backward()
draw_dot(o)
```

**L01-S12 같은 값을 두 번 쓰는 버그**
- 영상 구간: 1:22:28 ~ 1:27:05 (챕터 1:22:28 여러 번 쓰는 노드 버그, video-segments.json과 같음)
- 새 코드: 4줄. 셀: 새 셀.
- 입력: 새 셀에 4줄을 입력하고 실행합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `a = Value(3.0)` | 3.0을 담은 a |
| 2 | `b = a + a` | a를 두 번 더합니다. b = 2a |
| 3 | `b.backward()` | 역전파 |
| 4 | `print(a.grad)` | a의 기울기를 봅니다 |

- 보여야 하는 것: `2.0`이 보입니다.
- 점검 방식: 출력 일치 `2.0`
- 뜻: a에서 b로 가는 길이 두 개라 기울기 1이 두 번 와서 2가 됩니다. S10에서 `=`가 아니라 `+=`로 쌓았기 때문입니다. (해 보기: `__add__`의 `+=`를 `=`로 바꾸면 1.0이 나오는 것을 확인하고 다시 되돌립니다.)
- 힌트: H1 "b = a + a에서 a가 b에 영향을 주는 길은 몇 개인가요?" / H2 "두 길의 기울기를 합쳐야 합니다. `_backward` 안이 `+=`인지 보세요(L01-S10)." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: 1.0이 나온다면 S10의 `_backward`에서 `+=` 대신 `=`를 쓴 것입니다.

```python
a = Value(3.0)
b = ___
b.backward()
print(___)
```

**L01-S13 숫자와 섞어 계산하기 (긴 단계)**
- 영상 구간: 1:27:05 ~ 1:39:31 (챕터 1:27:05 tanh 쪼개기(더 많은 연산), video-segments.json과 같음)
- 새 코드: 7줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: Value 클래스 셀(L01-S04) 고치기.
- 넣을 곳: `__add__`의 첫 줄(`def __add__...`) 바로 아래에 1줄 / `__mul__`의 첫 줄 바로 아래에 1줄 / Value 클래스 셀 맨 아래에 4줄. 아래 코드 표의 앞 줄들이 넣을 줄이고(넣을 곳 순서대로), 그 뒤 줄은 새 셀에 칩니다.
- 입력: Value 클래스 셀 네 곳에 줄을 더하고 다시 실행한 뒤, 새 셀에 확인 1줄을 실행합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `········other = other if isinstance(other, Value) else Value(other)` | 상대가 그냥 숫자면 Value 상자로 감쌉니다 |
| 2 | `········other = other if isinstance(other, Value) else Value(other)` | 곱셈에서도 숫자를 Value로 감쌉니다 |
| 3 | `····def __radd__(self, other):` | `숫자 + Value`처럼 숫자가 앞에 올 때 실행됩니다 |
| 4 | `········return self + other` | 순서를 바꿔 Value + 숫자로 계산합니다 |
| 5 | `····def __rmul__(self, other):` | `숫자 * Value`일 때 실행됩니다 |
| 6 | `········return self * other` | Value * 숫자로 계산합니다 |
| 7 | `print(Value(2.0) + 1, 1 + Value(2.0), 2 * Value(3.0))` | 세 가지 섞어 쓰기를 한 번에 확인합니다 |

- 보여야 하는 것: `Value(data=3.0) Value(data=3.0) Value(data=6.0)`이 보입니다.
- 점검 방식: 출력 일치 `Value(data=3.0) Value(data=3.0) Value(data=6.0)`
- 뜻: 이제 `a + 1`, `1 + a`, `2 * a`처럼 평범한 숫자를 섞어 쓸 수 있습니다. S15의 `sum(...)`이 0부터 더하기 때문에 `__radd__`가 꼭 필요합니다.
- 힌트: H1 "`1 + Value(2.0)`에서 파이썬은 먼저 누구의 더하기를 시도할까요?" / H2 "숫자 1은 Value를 더할 줄 모르니, 파이썬이 Value의 `__radd__`를 부릅니다(F-P6 특수 메서드)." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: isinstance 줄을 `out = ...` 줄 아래에 넣으면 감싸기 전에 계산해 `AttributeError: 'int' object has no attribute 'data'`가 납니다.

```python
        other = other if ___ else Value(other)
        other = other if isinstance(other, Value) else Value(other)
    def __radd__(self, other):
        return ___
    def __rmul__(self, other):
        return self * other
print(Value(2.0) + 1, 1 + Value(2.0), 2 * Value(3.0))
```

**L01-S13b exp와 빼기 (긴 단계)**
- 영상 구간: 1:27:05 ~ 1:39:31 (챕터 1:27:05 tanh 쪼개기(더 많은 연산), video-segments.json과 같음)
- 새 코드: 10줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: Value 클래스 셀(L01-S04) 고치기.
- 넣을 곳: Value 클래스 셀 맨 아래에 10줄. 아래 코드 표의 앞 줄들이 넣을 줄이고(넣을 곳 순서대로), 그 뒤 줄은 새 셀에 칩니다.
- 입력: Value 클래스 셀 맨 아래에 10줄을 더하고 다시 실행합니다. 확인은 S13c 마지막 줄에서 함께 합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `····def exp(self):` | e의 거듭제곱(exp, 지수 함수)을 Value에 붙입니다 |
| 2 | `········out = Value(math.exp(self.data), (self,), 'exp')` | exp를 계산한 새 상자, 재료는 나, 기호는 'exp' |
| 3 | `········def _backward():` | 기울기를 재료에게 전하는 함수 |
| 4 | `············self.grad += out.data * out.grad` | exp의 미분은 exp 자신입니다. 그래서 out.data를 곱합니다 |
| 5 | `········out._backward = _backward` | 결과 상자에 저장 |
| 6 | `········return out` | 새 상자를 돌려줍니다 |
| 7 | `····def __neg__(self):` | `-a`(부호 바꾸기)일 때 실행됩니다 |
| 8 | `········return self * -1` | -1을 곱합니다. 곱셈의 _backward를 그대로 씁니다 |
| 9 | `····def __sub__(self, other):` | `a - b`일 때 실행됩니다 |
| 10 | `········return self + (-other)` | a + (-b)로 바꿔 계산합니다 |

- 보여야 하는 것: 클래스 셀이 에러 없이 실행됩니다. 화면에 따로 보이는 것은 없습니다.
- 점검 방식: 직접 확인(학습자가 '보여야 하는 것'과 비교)
- 뜻: 빼기는 새 규칙 없이 '더하기 + 부호 바꾸기'로 만들었습니다. 이미 만든 연산을 조합하면 기울기도 저절로 맞습니다.
- 힌트: H1 "exp(x)를 x로 미분하면 무엇이 되었나요?" / H2 "exp의 미분은 exp 자신이므로 `out.data`를 곱합니다(F-M2). 빼기는 `self + (-other)`입니다." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: `math.exp(self.data)` 대신 `math.exp(self)`로 쓰면 상자 자체를 넣어 TypeError가 납니다.

```python
    def exp(self):
        out = Value(math.exp(self.data), (self,), 'exp')
        def _backward():
            self.grad += ___
        out._backward = _backward
        return out
    def __neg__(self):
        return ___
    def __sub__(self, other):
        return self + (___)
```

**L01-S13c 거듭제곱과 나누기 (긴 단계)**
- 영상 구간: 1:27:05 ~ 1:39:31 (챕터 1:27:05 tanh 쪼개기(더 많은 연산), video-segments.json과 같음)
- 새 코드: 9줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: Value 클래스 셀(L01-S04) 고치기.
- 넣을 곳: Value 클래스 셀 맨 아래에 8줄. 아래 코드 표의 앞 줄들이 넣을 줄이고(넣을 곳 순서대로), 그 뒤 줄은 새 셀에 칩니다.
- 입력: Value 클래스 셀 맨 아래에 8줄을 더하고 다시 실행한 뒤, 새 셀에 확인 1줄을 실행합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `····def __pow__(self, other):` | `a**2`처럼 거듭제곱일 때 실행됩니다. other는 보통 숫자입니다 |
| 2 | `········out = Value(self.data**other, (self,), f'**{other}')` | 거듭제곱한 새 상자. 기호는 '**2' 같은 글자 |
| 3 | `········def _backward():` | 기울기를 전하는 함수 |
| 4 | `············self.grad += other * self.data**(other - 1) * out.grad` | x^k의 미분은 k·x^(k-1)입니다 |
| 5 | `········out._backward = _backward` | 결과 상자에 저장 |
| 6 | `········return out` | 새 상자를 돌려줍니다 |
| 7 | `····def __truediv__(self, other):` | `a / b`일 때 실행됩니다 |
| 8 | `········return self * other**-1` | a × b의 -1제곱으로 바꿔 계산합니다 |
| 9 | `print(Value(3.0) - 1, Value(2.0)**2, Value(6.0) / 2, Value(0.0).exp())` | 빼기, 거듭제곱, 나누기, exp를 한 번에 확인합니다 |

- 보여야 하는 것: `Value(data=2.0) Value(data=4.0) Value(data=3.0) Value(data=1.0)`이 보입니다.
- 점검 방식: 출력 일치 `Value(data=2.0) Value(data=4.0) Value(data=3.0) Value(data=1.0)`
- 뜻: 나누기도 '곱하기 + 거듭제곱'으로 만들었습니다. S15의 손실 `(yout - ygt)**2`가 이 단계의 빼기와 거듭제곱을 씁니다.
- 힌트: H1 "x²을 x로 미분하면 무엇인가요? x³은요?" / H2 "거듭제곱의 미분은 other × x^(other - 1)입니다(F-M1). 나누기는 `self * other**-1`입니다." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: `Value(6.0) / 2`에서 2는 숫자라 `2**-1` = 0.5가 되고, 곱셈의 isinstance 줄이 감싸 줍니다. S13을 건너뛰었다면 여기서 에러가 납니다.

```python
    def __pow__(self, other):
        out = Value(self.data**other, (self,), f'**{other}')
        def _backward():
            self.grad += ___ * out.grad
        out._backward = _backward
        return out
    def __truediv__(self, other):
        return self * ___
print(Value(3.0) - 1, Value(2.0)**2, Value(6.0) / 2, Value(0.0).exp())
```

**L01-S13d tanh를 쪼개서 다시 계산하기**
- 영상 구간: 1:27:05 ~ 1:39:31 (챕터 1:27:05 tanh 쪼개기(더 많은 연산), video-segments.json과 같음)
- 새 코드: 4줄. 셀: 새 셀.
- 먼저 다시 실행: L01-S09 셀
- 입력: S09 셀을 다시 실행한 뒤 새 셀에 4줄을 실행합니다. tanh를 exp, 빼기, 나누기로 풀어 써서 같은 답이 나오는지 봅니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `e = (2*n).exp()` | e^(2n)을 계산합니다(`2*n`에는 __rmul__이 쓰입니다) |
| 2 | `o = (e - 1) / (e + 1)` | tanh 공식 (e^(2n) - 1) / (e^(2n) + 1) |
| 3 | `o.backward()` | 역전파 |
| 4 | `draw_dot(o)` | 더 길어진 그림을 봅니다 |

- 보여야 하는 것: o의 data는 0.7071, x1 grad -1.5, w1 grad 1.0, x2 grad 0.5, w2 grad 0.0으로 S11b와 같습니다. 그림은 상자가 더 많습니다.
- 점검 방식: 직접 확인(앱 점검값: o.data = 0.7071, x1.grad = -1.5, w1.grad = 1.0)
- 뜻: 같은 계산을 큰 덩어리(tanh) 하나로 하든 작은 연산 여러 개로 쪼개든 기울기는 같습니다. 덩어리를 얼마나 크게 둘지는 만드는 사람이 정합니다.
- 힌트: H1 "grad가 S11b보다 두 배로 나온다면, 이 셀을 두 번 실행하지 않았나요?" / H2 "grad는 `+=`로 쌓이므로(L01-S12) 같은 셀을 다시 돌리면 쌓입니다. S09 셀부터 다시 실행해 새 상자로 시작하세요." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: S09를 다시 실행하지 않아 앞 단계 grad가 남아 숫자가 커지는 경우가 가장 흔합니다.

```python
e = ___
o = ___
o.backward()
draw_dot(o)
```

**L01-S13e PyTorch로 비교 (긴 단계)**
- 영상 구간: 1:39:31 ~ 1:43:55 (챕터 1:39:31 PyTorch 비교, video-segments.json과 같음)
- 새 코드: 9줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 입력: 새 셀에 9줄을 입력하고 실행합니다. 같은 뉴런을 PyTorch로 계산해 기울기를 비교합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `import torch` | PyTorch를 불러옵니다 |
| 2 | `x1 = torch.tensor([2.0], dtype=torch.double, requires_grad=True)` | 입력 1. double은 정밀한 소수, requires_grad는 '기울기를 구해 달라'는 표시 |
| 3 | `x2 = torch.tensor([0.0], dtype=torch.double, requires_grad=True)` | 입력 2 |
| 4 | `w1 = torch.tensor([-3.0], dtype=torch.double, requires_grad=True)` | 가중치 1 |
| 5 | `w2 = torch.tensor([1.0], dtype=torch.double, requires_grad=True)` | 가중치 2 |
| 6 | `b = torch.tensor([6.8813735870195432], dtype=torch.double, requires_grad=True)` | 편향(S09와 같은 숫자) |
| 7 | `o = torch.tanh(x1*w1 + x2*w2 + b)` | 같은 뉴런 계산 |
| 8 | `o.backward()` | PyTorch의 역전파 |
| 9 | `print(o.item(), x1.grad.item(), w1.grad.item(), x2.grad.item(), w2.grad.item())` | 출력과 기울기 네 개를 숫자로 보여 줍니다 |

- 보여야 하는 것: `0.7071067811865476 -1.4999999999999998 0.9999999999999999 0.49999999999999994 0.0`처럼, S11b와 같은 숫자(0.7071, -1.5, 1.0, 0.5, 0.0)에 아주 가까운 값이 보입니다.
- 점검 방식: 직접 확인(앱 점검값: o = 0.7071, x1.grad = -1.5, w1.grad = 1.0, x2.grad = 0.5, w2.grad = 0.0)
- 뜻: 우리가 만든 micrograd와 PyTorch는 같은 역전파를 합니다. PyTorch는 숫자 하나 대신 텐서(숫자 묶음)로 빠르게 할 뿐입니다.
- 힌트: H1 "PyTorch에게 '이 값의 기울기를 구해 달라'고 알리는 표시는 무엇이었나요?" / H2 "`requires_grad=True`가 빠지면 grad가 None입니다. `.item()`은 텐서에서 숫자 하나를 꺼냅니다." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: 이 셀은 x1, w1, b, o를 텐서로 덮어씁니다. 이후 micrograd 실험을 다시 하려면 S09부터 다시 실행합니다.

```python
import torch
x1 = torch.tensor([2.0], dtype=torch.double, ___)
x2 = torch.tensor([0.0], dtype=torch.double, requires_grad=True)
w1 = torch.tensor([-3.0], dtype=torch.double, requires_grad=True)
w2 = torch.tensor([1.0], dtype=torch.double, requires_grad=True)
b = torch.tensor([6.8813735870195432], dtype=torch.double, requires_grad=True)
o = torch.tanh(x1*w1 + x2*w2 + b)
___
print(o.item(), x1.grad.item(), w1.grad.item(), x2.grad.item(), w2.grad.item())
```

**L01-S14 Neuron 클래스 (긴 단계)**
- 영상 구간: 1:43:55 ~ 1:51:04 (챕터 1:43:55 MLP 라이브러리, video-segments.json과 같음)
- 새 코드: 10줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 입력: 새 셀에 Neuron 클래스 9줄과 확인 1줄을 입력하고 실행합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `class Neuron:` | 뉴런 하나를 만드는 설계도 |
| 2 | `····def __init__(self, nin):` | 입력 개수 nin을 받아 뉴런을 만듭니다 |
| 3 | `········self.w = [Value(random.uniform(-1, 1)) for _ in range(nin)]` | 입력마다 -1과 1 사이 무작위 가중치를 하나씩 |
| 4 | `········self.b = Value(random.uniform(-1, 1))` | 무작위 편향 하나 |
| 5 | `····def __call__(self, x):` | 뉴런(x)처럼 함수처럼 부르면 실행됩니다 |
| 6 | `········act = sum((wi*xi for wi, xi in zip(self.w, x)), self.b)` | 가중치 × 입력을 모두 더하고 편향에서 시작합니다 |
| 7 | `········return act.tanh()` | 합에 tanh를 씌워 돌려줍니다 |
| 8 | `····def parameters(self):` | 학습으로 고칠 숫자(파라미터) 목록을 돌려주는 함수 |
| 9 | `········return self.w + [self.b]` | 가중치들과 편향을 한 목록으로 |
| 10 | `Neuron(2)([2.0, 3.0])` | 입력 2개짜리 뉴런을 만들어 [2.0, 3.0]을 넣어 봅니다 |

- 보여야 하는 것: `Value(data=...)`가 보이고, 숫자는 -1과 1 사이입니다(무작위라 실행마다 다름).
- 점검 방식: 값 범위 -1.0 ~ 1.0
- 뜻: S09에서 손으로 만든 뉴런을 설계도로 만들었습니다. 가중치는 무작위로 시작해 학습으로 고쳐집니다.
- 힌트: H1 "뉴런 출력이 -1과 1 사이인 까닭은 마지막에 무엇을 씌웠기 때문일까요?" / H2 "`sum(..., self.b)`는 편향에서 더하기를 시작합니다. `__call__` 덕분에 `Neuron(2)(x)`처럼 부를 수 있습니다(F-P6)." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: S01에서 `import random`을 실행하지 않았다면 NameError가 납니다.

```python
class Neuron:
    def __init__(self, nin):
        self.w = [Value(___) for _ in range(nin)]
        self.b = Value(random.uniform(-1, 1))
    def __call__(self, x):
        act = sum((wi*xi for wi, xi in ___), self.b)
        return act.tanh()
    def parameters(self):
        return ___
Neuron(2)([2.0, 3.0])
```

**L01-S14b Layer 클래스 (긴 단계)**
- 영상 구간: 1:43:55 ~ 1:51:04 (챕터 1:43:55 MLP 라이브러리, video-segments.json과 같음)
- 새 코드: 9줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 입력: 새 셀에 Layer 클래스 8줄과 확인 1줄을 입력하고 실행합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `class Layer:` | 뉴런 여러 개를 한 줄로 세운 층 |
| 2 | `····def __init__(self, nin, nout):` | 입력 개수 nin, 뉴런 개수 nout |
| 3 | `········self.neurons = [Neuron(nin) for _ in range(nout)]` | 뉴런을 nout개 만듭니다 |
| 4 | `····def __call__(self, x):` | 층에 입력을 넣으면 |
| 5 | `········outs = [n(x) for n in self.neurons]` | 뉴런마다 같은 입력을 넣어 출력을 모읍니다 |
| 6 | `········return outs[0] if len(outs) == 1 else outs` | 출력이 하나면 목록 대신 그 값 하나만 돌려줍니다 |
| 7 | `····def parameters(self):` | 층의 파라미터 목록 |
| 8 | `········return [p for n in self.neurons for p in n.parameters()]` | 모든 뉴런의 파라미터를 한 목록으로 모읍니다 |
| 9 | `Layer(2, 3)([2.0, 3.0])` | 입력 2개, 뉴런 3개짜리 층에 넣어 봅니다 |

- 보여야 하는 것: Value 3개가 담긴 목록이 보입니다.
- 점검 방식: 직접 확인(학습자가 '보여야 하는 것'과 비교)
- 뜻: 층은 같은 입력을 여러 뉴런이 동시에 보는 것입니다.
- 힌트: H1 "뉴런 3개에 같은 입력을 넣으면 출력은 몇 개일까요?" / H2 "`[n(x) for n in self.neurons]`는 뉴런마다 부르는 목록 만들기입니다(F-P4)." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: 이중 목록 만들기 순서를 `for p in n.parameters() for n in self.neurons`로 뒤집으면 NameError가 납니다.

```python
class Layer:
    def __init__(self, nin, nout):
        self.neurons = [___ for _ in range(nout)]
    def __call__(self, x):
        outs = [___ for n in self.neurons]
        return outs[0] if len(outs) == 1 else outs
    def parameters(self):
        return [p for n in self.neurons for p in n.parameters()]
Layer(2, 3)([2.0, 3.0])
```

**L01-S14c MLP 클래스와 parameters() (긴 단계)**
- 영상 구간: 1:43:55 ~ 1:51:04 (챕터 1:43:55 MLP 라이브러리, video-segments.json과 같음)
- 새 코드: 10줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 입력: 새 셀에 MLP 클래스 10줄을 입력하고 실행합니다(이 클래스는 한 덩어리라 나누지 않습니다).

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `class MLP:` | 층 여러 개를 이은 신경망(다층 퍼셉트론) |
| 2 | `····def __init__(self, nin, nouts):` | 입력 개수와, 층마다의 뉴런 개수 목록 |
| 3 | `········sz = [nin] + nouts` | 예: 3과 [4, 4, 1]이면 [3, 4, 4, 1] |
| 4 | `········self.layers = [Layer(sz[i], sz[i+1]) for i in range(len(nouts))]` | 이웃한 크기끼리 층을 만듭니다: 3→4, 4→4, 4→1 |
| 5 | `····def __call__(self, x):` | 입력을 넣으면 |
| 6 | `········for layer in self.layers:` | 층마다 차례로 |
| 7 | `············x = layer(x)` | 앞 층의 출력을 다음 층의 입력으로 |
| 8 | `········return x` | 마지막 층의 출력을 돌려줍니다 |
| 9 | `····def parameters(self):` | 신경망 전체 파라미터 |
| 10 | `········return [p for layer in self.layers for p in layer.parameters()]` | 모든 층의 파라미터를 한 목록으로 |

- 보여야 하는 것: 셀이 에러 없이 실행됩니다. 화면에 따로 보이는 것은 없습니다. 파라미터 개수(41개)는 S15 첫 출력에서 확인합니다.
- 점검 방식: 직접 확인(학습자가 '보여야 하는 것'과 비교)
- 뜻: 신경망은 층을 이은 것이고, 학습이란 이 41개 숫자를 조금씩 고치는 일입니다.
- 힌트: H1 "입력 3개짜리 뉴런 하나에는 숫자가 몇 개 들어 있나요?" / H2 "뉴런 하나 = 입력 수만큼의 가중치 + 편향 1개(L01-S14). 3→4 층은 4 × (3 + 1) = 16입니다." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: parameters 줄을 빠뜨리면 S15에서 `AttributeError: 'MLP' object has no attribute 'parameters'`가 납니다.

```python
class MLP:
    def __init__(self, nin, nouts):
        sz = ___
        self.layers = [___ for i in range(len(nouts))]
    def __call__(self, x):
        for layer in self.layers:
            ___
        return x
    def parameters(self):
        return [p for layer in self.layers for p in layer.parameters()]
```

**L01-S15 데이터와 손실 (긴 단계)**
- 영상 구간: 1:51:04 ~ 1:57:56, 1:57:56 ~ 2:01:12 (챕터 1:51:04 데이터와 손실, 1:57:56 파라미터 모으기, video-segments.json과 같음)
- 새 코드: 7줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 입력: 새 셀에 7줄을 입력하고 실행합니다. 신경망의 파라미터 개수를 세고, 작은 데이터 4개와, 얼마나 틀렸는지 재는 손실을 만듭니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `n = MLP(3, [4, 4, 1])` | 입력 3개, 은닉층 4·4, 출력 1개인 신경망 |
| 2 | `print(len(n.parameters()))` | 파라미터 개수를 셉니다(3→4: 16, 4→4: 20, 4→1: 5, 합 41) |
| 3 | `xs = [[2.0, 3.0, -1.0], [3.0, -1.0, 0.5], [0.5, 1.0, 1.0], [1.0, 1.0, -1.0]]` | 입력 예시 4개(각각 숫자 3개) |
| 4 | `ys = [1.0, -1.0, -1.0, 1.0]` | 각 예시의 정답 |
| 5 | `ypred = [n(x) for x in xs]` | 신경망의 예측 4개 |
| 6 | `loss = sum((yout - ygt)**2 for ygt, yout in zip(ys, ypred))` | 예측과 정답 차이의 제곱을 모두 더한 손실 |
| 7 | `print(loss)` | 손실을 보여 줍니다 |

- 보여야 하는 것: 첫 줄에 `41`, 둘째 줄에 `Value(data=...)`가 보입니다. 손실 숫자는 실행마다 다르고 보통 1에서 8 사이입니다.
- 점검 방식: 직접 확인(앱 점검값: len(n.parameters()) = 41)
- 뜻: 손실은 '얼마나 틀렸나'를 숫자 하나로 모은 것입니다. 0이면 다 맞힌 것입니다.
- 힌트: H1 "예측과 정답이 같으면 (yout - ygt)**2는 얼마일까요?" / H2 "손실 = (예측 - 정답)² 의 합입니다(F-M6). `sum`은 0부터 더하므로 S13의 `__radd__`가 쓰입니다." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: `(ygt - yout)`으로 순서를 바꾸면 `숫자 - Value`라 `__rsub__`가 없어 에러가 납니다(영상 1:54 부근 댓글). 이 앱 코드처럼 `yout - ygt` 순서로 씁니다.

```python
n = MLP(3, [4, 4, 1])
print(len(n.parameters()))
xs = [[2.0, 3.0, -1.0], [3.0, -1.0, 0.5], [0.5, 1.0, 1.0], [1.0, 1.0, -1.0]]
ys = [1.0, -1.0, -1.0, 1.0]
ypred = [n(x) for x in xs]
loss = sum(___ for ygt, yout in ___)
print(loss)
```

**L01-S15b 학습 반복 (긴 단계)**
- 영상 구간: 2:01:12 ~ 2:14:03 (챕터 2:01:12 경사 하강 학습, video-segments.json과 같음)
- 새 코드: 9줄 (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다). 셀: 새 셀.
- 입력: 새 셀에 9줄을 입력하고 실행합니다. 순전파, 기울기 비우기, 역전파, 갱신을 20번 반복합니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `for k in range(20):` | 20번 반복합니다 |
| 2 | `····ypred = [n(x) for x in xs]` | 순전파: 예측 4개 |
| 3 | `····loss = sum((yout - ygt)**2 for ygt, yout in zip(ys, ypred))` | 손실 계산 |
| 4 | `····for p in n.parameters():` | 파라미터마다 |
| 5 | `········p.grad = 0.0` | 지난번 기울기를 비웁니다(+=로 쌓이니까) |
| 6 | `····loss.backward()` | 역전파: 손실에 대한 모든 기울기 |
| 7 | `····for p in n.parameters():` | 파라미터마다 |
| 8 | `········p.data += -0.05 * p.grad` | 기울기 반대 방향으로 0.05배 움직입니다(학습률 0.05) |
| 9 | `····print(k, loss.data)` | 반복 번호와 손실을 보여 줍니다 |

- 보여야 하는 것: 20줄이 보이고 손실이 대체로 줄어듭니다. 마지막 손실은 대개 0.1 아래입니다(시작값이 무작위라 실행마다 다름). 0.1 위면 셀을 한 번 더 실행해 20번 더 학습합니다.
- 점검 방식: 값 범위 0.0 ~ 0.1 (마지막 줄 손실)
- 뜻: 이것이 신경망 학습의 전부입니다: 예측하고, 틀린 정도를 재고, 기울기를 구해, 반대로 조금 움직이기. 큰 AI도 같은 반복을 아주 크게 할 뿐입니다.
- 힌트: H1 "손실을 줄이려면 기울기와 같은 쪽으로 움직여야 할까요, 반대쪽일까요?" / H2 "갱신은 `p.data += -학습률 * p.grad`입니다(F-M6). 기울기 비우기는 `loss.backward()` 앞에 옵니다(L01-S12)." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: 학습률 부호를 +로 쓰면 손실이 커집니다. grad 비우기를 빼먹으면 S16의 버그가 생깁니다.

```python
for k in range(20):
    ypred = [n(x) for x in xs]
    loss = sum((yout - ygt)**2 for ygt, yout in zip(ys, ypred))
    for p in n.parameters():
        ___
    ___
    for p in n.parameters():
        p.data += ___
    print(k, loss.data)
```

**L01-S16 grad 비우기를 빼먹는 버그**
- 영상 구간: 2:01:12 ~ 2:14:03 (챕터 2:01:12 경사 하강 학습, video-segments.json과 같음)
- 새 코드: 0줄 (기존 줄 2개 앞에 `#`만 붙임). 셀: 앞 단계 셀 고치기.
- 바꿀 곳: L01-S15b 셀의 grad 비우기 2줄
- 먼저 다시 실행: L01-S15 셀
- 입력: S15b 셀에서 grad 비우기 2줄 앞에 `#`을 붙여 막고, S15 셀과 S15b 셀을 다시 실행해 손실을 비교합니다. 비교한 뒤 `#`을 지워 되돌립니다. 새로 치는 코드는 없습니다.

| 줄 | 코드 | 풀이 |
|---|---|---|
| 1 | `····# for p in n.parameters():` | 앞에 #을 붙여 이 줄을 실행하지 않게 막습니다 |
| 2 | `····#     p.grad = 0.0` | 기울기 비우기도 막습니다 |

- 보여야 하는 것: 손실이 고르게 줄지 않고 중간에 튀어 오르는 모습이 자주 보입니다(실행마다 다름). 이 작은 문제에서는 튄 뒤 오히려 더 빨리 0에 가까워지는 것처럼 보일 수도 있습니다. 쌓인 기울기가 우연히 큰 걸음이 된 것일 뿐이고, 큰 문제에서는 학습을 망칩니다. 되돌리고 다시 실행하면 S15b처럼 고르게 줄어듭니다.
- 점검 방식: 직접 확인(학습자가 '보여야 하는 것'과 비교)
- 뜻: 기울기는 `+=`로 쌓이므로, 반복마다 비우지 않으면 지난 반복의 기울기가 섞여 걸음이 엉뚱하게 커집니다. Karpathy도 영상에서 이 실수를 했고, 문제가 쉬워서 우연히 잘 된 것처럼 보였다고 직접 말합니다.
- 힌트: H1 "grad를 비우지 않으면 두 번째 반복의 grad에는 무엇이 섞여 있을까요?" / H2 "`_backward`가 `+=`로 쌓는다는 것(L01-S12)과, 반복마다 `p.grad = 0.0`을 하는 이유를 연결해 보세요." / H3 빈칸 코드(아래) / H4 정답 코드와 줄별 풀이를 봅니다. 흔한 원인: `#`을 지우는 것을 잊고 다음 편으로 넘어가지 않도록, 비교가 끝나면 꼭 되돌립니다.

```python
    # for p in n.parameters():
    #     ___
```

## 4. 확인 문제

채점: 문항마다 1점, 11점 만점. 예측 문제는 실행 전에 맞히는 문제라 힌트가 없습니다(hints.md 2절). 객관식은 `choices`와 `answer_index`(0부터 셈)로 자동 채점, 설명 문제는 핵심어 자동 채점 뒤 애매하면 직접 확인(rubric)합니다. 힌트 반영은 hints.md 3절. 같은 내용이 `content/L01.json`의 questions에 있습니다.

| 번호 | 유형 | 나오는 때 | 문제 | 정답 | 채점 |
|---|---|---|---|---|---|
| L01-Q01 | 예측 | L01-S02 뒤 | f(x) = 3x² - 4x + 5 에서 x = 2/3 일 때, 숫자 기울기 (f(x + h) - f(x)) / h (h = 0.0001)는 대략 얼마일까요? 숫자로 답합니다. | 약 0 (실제로는 0.0003 정도). x = 2/3 은 포물선의 가장 낮은 곳이라 기울기가 0입니다. | 숫자 범위 -0.01 ~ 0.01 |
| L01-Q02 | 설명 | L01-S02 뒤 | S02에서 기울기가 14로 나왔습니다. '기울기가 14'라는 말을 자기 말로 한두 문장으로 설명해 보세요. | x를 아주 조금 올리면, f는 그 올린 양의 약 14배만큼 오른다는 뜻입니다. | 핵심어(조금/약간/살짝; 배), 애매하면 직접 확인 |
| L01-Q03 | 예측 | L01-S07 뒤 | d = a*b + c 이고 a = 2, b = -3, c = 10 입니다. d를 b에 대해 미분한 값(b.grad)은 얼마일까요? | 2.0. 곱셈은 상대 값을 곱해 전하므로 b의 기울기는 a의 값 2입니다. | 숫자 범위 1.99 ~ 2.01 |
| L01-Q04 | 객관식 | L01-S07 뒤 | + 노드와 * 노드가 기울기를 재료에게 전하는 방식으로 맞는 것은? | +는 그대로, *는 상대 값을 곱해 전합니다(L01-S07). | 객관식, 정답 2번(answer_index 1) |
| L01-Q05 | 예측 | L01-S10b 뒤 | o = tanh(n) 이고 o.data = 0.7, o.grad = 1 입니다. o._backward()를 부르면 n.grad는 얼마가 될까요? | 1 - 0.7² = 1 - 0.49 = 0.51 | 숫자 범위 0.5 ~ 0.52 |
| L01-Q06 | 객관식 | L01-S12 뒤 | 누군가의 코드에서 `a = Value(3.0); b = a + a; b.backward()` 후 a.grad가 2.0이 아니라 1.0으로 나옵니다. 어디를 고쳐야 할까요? | `_backward` 안의 `=`를 `+=`로 바꿉니다. a에서 b로 가는 길이 두 개라 기울기를 쌓아야 합니다. | 객관식, 정답 3번(answer_index 2) |
| L01-Q07 | 설명 | L01-S11b 뒤 | backward()가 위상 정렬 목록을 거꾸로(reversed) 도는 이유를 자기 말로 설명해 보세요. | 어떤 상자의 기울기는 그 상자를 쓴 결과 쪽 상자들에서 모두 전해져야 완성됩니다. 거꾸로 돌면 결과 쪽 기울기가 먼저 다 모인 뒤에 재료에게 나눠 줄 수 있습니다. | 핵심어(결과/뒤/출력; 모인/모여/다 받/완성), 애매하면 직접 확인 |
| L01-Q08 | 객관식 | L01-S15b 뒤 | 학습할수록 손실이 오히려 커집니다. 갱신 줄이 `p.data += 0.05 * p.grad` 입니다. 어떻게 고쳐야 할까요? | 부호를 바꿔 `-0.05`로 씁니다. 기울기는 손실이 커지는 방향이라 반대로 가야 줄어듭니다. | 객관식, 정답 2번(answer_index 1) |
| L01-Q09 | 객관식 | L01-S16 뒤 | 학습 반복에서 `p.grad = 0.0` 줄이 빠져 손실이 튑니다. 이 줄은 어디에 넣어야 할까요? | 반복마다 `loss.backward()` 바로 앞에 넣습니다. 그래야 이번 반복의 기울기만 남습니다. | 객관식, 정답 3번(answer_index 2) |
| L01-Q10 | 예측 | L01-S15 뒤 | MLP(2, [3, 1])의 파라미터는 모두 몇 개일까요? | 13개. 2→3 층: 3 × (2 + 1) = 9, 3→1 층: 1 × (3 + 1) = 4, 합 13. | 정확히 13 |
| L01-Q11 | 설명 | L01-S13e 뒤 | 우리가 만든 micrograd와 PyTorch의 공통점 하나와 차이 하나를 말해 보세요. | 공통점: 같은 역전파 원리로 같은 기울기를 구합니다(S13e에서 숫자가 같음). 차이: PyTorch는 숫자 하나 대신 텐서(숫자 묶음) 단위로, 훨씬 빠르게 계산합니다. | 핵심어(같은/똑같/역전파; 텐서/묶음/빠르), 애매하면 직접 확인 |

**L01-Q02**
- 채점 기준: 0.5점 '아주 조금 바꾸면'에 해당하는 말; 0.5점 '몇 배로 변한다'에 해당하는 말
- 힌트: H1 "x를 3에서 3.0001로 올리면 f는 얼마나 변했을까요?" / H2 "기울기 = f가 변한 양 ÷ x를 움직인 양 입니다(L01-S02, F-M1)." / H3 빈칸 채우기: "x를 ___ 올리면 f는 그 약 ___배만큼 오른다." / H4 모범 답: x를 아주 조금 올리면 f는 그 약 14배만큼 오릅니다. 흔한 원인: '14만큼 오른다'고 쓰면 '배'가 빠져 반쪽 답이 됩니다.

**L01-Q04**
- 보기: (1) +는 상대 값을 곱해 전하고, *는 그대로 전합니다 / (2) +는 받은 기울기를 그대로 전하고, *는 상대 값을 곱해 전합니다 / (3) 둘 다 받은 기울기를 그대로 전합니다 / (4) 모르겠어요. 정답 (2).
- 채점 기준: 1점 정답 보기 선택
- 힌트: H1 "c.grad와 a.grad를 채울 때 S07에서 각각 무엇을 썼나요?" / H2 "S07의 `c.grad = d.grad`(덧셈)와 `a.grad = e.grad * b.data`(곱셈)를 비교해 보세요(F-M2)." / H3 빈칸 채우기: "+는 기울기를 ___ 전하고, *는 ___ 값을 곱해 전한다." / H4 정답은 2번(+는 그대로, *는 상대 값을 곱해)입니다. 흔한 원인: 곱셈에서 '자기' 값을 곱한다고 헷갈리는 경우가 많습니다. 곱하는 것은 '상대' 값입니다.

**L01-Q06**

```python
def _backward():
    self.grad = out.grad
    other.grad = out.grad
```

- 보기: (1) `backward()`의 `self.grad = 1.0`을 `2.0`으로 바꿉니다 / (2) `reversed(topo)`를 `topo`로 바꿉니다 / (3) `_backward` 안의 `=`를 `+=`로 바꿉니다 / (4) 모르겠어요. 정답 (3).
- 채점 기준: 1점 정답 보기 선택
- 힌트: H1 "b = a + a에서 a가 b에 영향을 주는 길은 몇 개인가요?" / H2 "두 길의 기울기를 합쳐야 합니다(L01-S12). 두 번째 줄이 첫 번째 줄의 값을 덮어쓰고 있지 않나요?" / H3 빈칸 코드: `self.grad ___ out.grad` / H4 정답은 3번(`=`를 `+=`로)입니다. `=`는 덮어쓰기라 두 번째 길의 기울기가 첫 번째를 지웁니다. 흔한 원인: 출발점 값을 바꾸면 된다고 생각하기 쉽지만 다른 그래프에서는 틀립니다.

**L01-Q07**
- 채점 기준: 0.5점 결과(출력) 쪽부터 간다는 말; 0.5점 기울기가 먼저 다 모여야 나눠 줄 수 있다는 말
- 힌트: H1 "재료에게 기울기를 나눠 주려면, 그 전에 내 기울기가 어떤 상태여야 할까요?" / H2 "위상 정렬은 '재료가 먼저, 결과가 나중' 순서입니다(L01-S11). 거꾸로 돌면 어느 쪽부터 처리될까요?" / H3 빈칸 채우기: "___ 쪽 기울기가 먼저 다 ___ 뒤에야 재료에게 나눠 줄 수 있다." / H4 모범 답: 결과 쪽 기울기가 먼저 다 모여야 그것을 재료에게 나눠 줄 수 있기 때문입니다. 흔한 원인: '빠르게 하려고'라고 답하는 경우가 많지만 속도가 아니라 순서의 문제입니다.

**L01-Q08**
- 보기: (1) `p.data += 0.5 * p.grad` (더 크게) / (2) `p.data += -0.05 * p.grad` (기울기 반대 방향으로) / (3) `p.grad += 0.05` (기울기에 더하기) / (4) 모르겠어요. 정답 (2).
- 채점 기준: 1점 정답 보기 선택(부호)
- 힌트: H1 "기울기는 손실이 커지는 쪽을 가리킬까요, 작아지는 쪽을 가리킬까요?" / H2 "경사 하강은 기울기 반대 방향으로 움직입니다(F-M6, L01-S08)." / H3 빈칸 코드: `p.data += ___0.05 * p.grad` / H4 정답은 2번(`-0.05`)입니다. S08에서는 L을 키우려고 +로 움직였지만, 학습은 손실을 줄이는 것이라 -가 필요합니다.

**L01-Q09**
- 보기: (1) 반복마다 `loss.backward()` 바로 뒤, 갱신 앞에 / (2) 반복문 밖, 맨 처음에 한 번만 / (3) 반복마다 `loss.backward()` 바로 앞에 / (4) 모르겠어요. 정답 (3).
- 채점 기준: 1점 정답 보기 선택(위치까지)
- 힌트: H1 "backward()가 기울기를 덮어쓸까요, 쌓을까요?" / H2 "기울기는 `+=`로 쌓입니다(L01-S12). 그러니 새로 쌓기 직전에 비워야 합니다(L01-S15b)." / H3 빈칸 코드: `for p in n.parameters(): p.grad = 0.0` 다음 줄에 `___` / H4 정답은 3번(`loss.backward()` 바로 앞)입니다. backward 뒤에 비우면 방금 구한 기울기를 지워 갱신이 0이 되고, 맨 처음 한 번만 비우면 두 번째 반복부터 쌓입니다.

**L01-Q11**
- 채점 기준: 0.5점 공통점: 같은 역전파, 같은 기울기; 0.5점 차이: 텐서 단위, 빠름
- 힌트: H1 "S13e에서 두 방법의 기울기 숫자는 어땠나요?" / H2 "micrograd의 Value는 숫자 하나, PyTorch의 tensor는 숫자 묶음입니다(L01-S13e)." / H3 빈칸 채우기: "둘 다 같은 ___로 기울기를 구하지만, PyTorch는 ___ 단위로 빠르게 계산한다." / H4 모범 답: 둘 다 같은 역전파로 같은 기울기를 구하지만, PyTorch는 텐서 단위로 훨씬 빠르게 계산합니다. 흔한 원인: 차이만 쓰고 공통점을 빠뜨려 0.5점이 되는 경우가 많습니다.

## 5. 핵심 재구성 과제

빈 노트북에서 다음 3조각을 다시 만듭니다. 각 조각은 H2 이하여야 합니다(H3, H4는 열리지만 쓰면 통과가 아니라 연습으로 기록).

**L01-R1 Value에 +, *, tanh와 각각의 _backward**
- 과제: 빈 노트북에서 Value 클래스를 다시 만듭니다: __init__, __repr__, __add__, __mul__, tanh, 그리고 각각의 _backward.
- 점검: S09 뉴런을 만들고 o._backward()와 n._backward()를 불러 n.grad 0.5, b.grad 0.5 (대조: karpathy/micrograd engine.py 동작)
- 힌트: H1 "결과 상자는 무엇을 기억해야 나중에 기울기를 나눠 줄 수 있을까요?" / H2 "재료(_prev), 기호(_op), 그리고 _backward 함수입니다(L01-S04, L01-S10)." / H3 빈칸 코드: `def _backward(): self.grad += ___ * out.grad` (곱셈일 때) / H4 정답은 L01-S04, S05, S09b, S10, S10b 코드를 합친 것입니다. 흔한 원인: `+=` 대신 `=`.

**L01-R2 위상 정렬을 쓰는 backward()**
- 과제: 빈 노트북에서(R1 결과 위에) backward() 메서드를 만듭니다.
- 점검: o.backward() 후 x1.grad -1.5, w1.grad 1.0, x2.grad 0.5, w2.grad 0.0 (대조: karpathy/micrograd engine.py 동작)
- 힌트: H1 "기울기를 나눠 주는 순서는 재료부터일까요, 결과부터일까요?" / H2 "위상 정렬 목록을 만든 뒤 reversed로 돕니다. 출발점 grad는 1.0입니다(L01-S11, S11b)." / H3 빈칸 코드: `self.grad = ___` / `for node in ___(topo): node._backward()` / H4 정답은 L01-S11b 코드입니다. 흔한 원인: append를 for 안에 넣음.

**L01-R3 MLP(3, [4,4,1]) 학습으로 손실 0.1 아래**
- 과제: Neuron, Layer, MLP를 만들고 S15 데이터로 학습해 손실을 0.1 아래로 내립니다. 이 조각에 필요한 Value 연산(숫자 섞기, 빼기, 거듭제곱)은 붙여 넣어도 됩니다.
- 점검: 값 범위 0.0 ~ 0.1 (마지막 손실)
- 힌트: H1 "학습 반복의 네 동작은 무엇이었나요?" / H2 "순전파, 기울기 비우기, 역전파, 갱신(-학습률 × 기울기) 순서입니다(L01-S15b)." / H3 빈칸 코드: `p.grad = ___` / `loss.___()` / `p.data += ___ * p.grad` / H4 정답은 L01-S14, S14b, S14c, S15, S15b 코드입니다. 흔한 원인: 학습률 부호, grad 비우기 위치.

정답 대조: 원본 karpathy/micrograd의 `engine.py`, `nn.py`와 기능 비교(결과 숫자 비교). 원본 `nn.py`는 tanh 대신 relu를 쓰고 `Module` 부모 클래스와 `zero_grad()`가 있으니 앱이 그 차이를 알려 줍니다.

선택 심화: 영상 설명란의 연습 Colab(research/01 4절 링크). 문항 내용은 아직 열어 보지 않아 앱 반영은 확인 뒤에 합니다.

## 6. "익혔다" 기준

- 실습 단계 S01~S16 완료(쪼갠 단계 S09b, S10b, S11b, S13b~S13e, S14b, S14c, S15b 포함, 모두 26단계).
- 확인 문제 점수 80% 이상(11점 중 9점 이상).
- 핵심 재구성 3조각 모두 H2 이하로 완성.
- 마지막 말하기 질문 통과: "역전파를 친구에게 세 문장으로 설명해 보세요." 채점: 결과에서 거꾸로 간다, 연쇄 법칙으로 곱한다, 그 기울기로 값을 조정한다.

### 6-1. 도장과 배지 연결(VALUE_CURRICULUM.md 2절)

- 편 도장: **01 micrograd 도장**(`STAMP-L01`). 조건은 위 익힘 기준 그대로(mastery_state = mastered).
- 단계 배지: 이 편은 1단계 배지 **언어 모델 견습**(L01, L02, L03 익힘 + CP1 통과)의 첫 조건입니다. 01편을 익히면 배지 진행 표시가 1/4로 바뀝니다.
- 공유 결과물(선택): **내 micrograd 학습 기록 카드**(`ART-L01`). S15b를 마치면 만들 수 있습니다(도장 전에도 가능). 학습자가 S15b 손실 20줄을 붙여 넣으면 앱이 손실 곡선을 그리고, 원하면 S11b 계산 그래프 화면 캡처를 직접 첨부합니다. 출처 표기를 넣고 개인 정보는 넣지 않으며, 자동 게시는 없습니다. 공유 화면은 이미지 저장, 글 복사, 'X에 공유'(글쓰기 창만 열림, '저장한 이미지를 첨부해 주세요' 안내)입니다.

## 7. 자주 막히는 곳

리서치 반영(`research/01_micrograd.md` 5절, GitHub 이슈와 유튜브 댓글 근거):
- `sum()`이 0(정수)부터 더해서 `int + Value` TypeError가 납니다. `__radd__`를 추가하거나 `sum(..., Value(0.0))`처럼 시작값을 줍니다(GitHub nn-zero-to-hero#41, 영상 1:54 부근 댓글). S14 전에 막힘 힌트로 미리 보여 줍니다.
- `float - Value` 오류는 `__rsub__`가 없어서입니다(영상 1:54:01 부근 댓글).
- grad 비우기(zero_grad)는 `loss.backward()` 앞에 와야 합니다(2:04:41 부근 댓글, micrograd#53, #25).
- 그래프를 그리기 전에 `backward()`를 빠뜨려 grad가 모두 0으로 보임(nn-zero-to-hero#40).
- graphviz는 시스템 프로그램과 파이썬 패키지 둘 다 필요합니다(댓글). 맥미니에서 둘 다 설치해 SVG 그림이 나오는 것을 확인했습니다(CTO 실측 2026-11-16, cto/MEASURE_M0.md).
- 학습 시간: 댓글들에 2시간 30분 영상에 4~5시간, 길게는 1주일 걸렸다는 보고가 많습니다. 이 앱의 예상 8~12시간과 어긋나지 않습니다.

교사 몽키 예상(강의 지식 기반):
- 클래스 셀을 고친 뒤 그 전에 만든 Value 상자를 그대로 쓰면 새 메서드가 없다는 AttributeError가 납니다. 3절의 '먼저 다시 실행' 줄과 S09b 힌트가 이것을 다룹니다.
- S16에서 grad 비우기를 빼도 이 작은 문제에서는 손실이 오히려 빨리 줄어 보일 수 있습니다(교사 몽키 실행 확인). 앱은 '우연히 잘 된 것'임을 S16 '보여야 하는 것'에서 미리 알려 줍니다.
- S15b를 20번 돌려도 무작위 시작에 따라 손실이 0.1 위에 남는 경우가 있습니다(시작값 20개 중 4개, 교사 몽키 실행 확인). 셀을 한 번 더 실행하면 됩니다.
- `+=`와 `=`의 차이(S12). 가장 흔하고 중요합니다.
- `Value + 숫자`(예: `a + 1`)가 에러: 숫자를 `Value`로 감싸는 처리가 필요하고, `1 + a`는 `__radd__`가 필요합니다.
- 클래스 안의 함수 안의 함수(`_backward`)가 낯섦. F-P6으로 돌아가 "함수도 값처럼 저장할 수 있다"를 먼저 봅니다.
- graphviz 설치 문제(맥미니). 환경 문제이므로 HELP로 보냅니다.
- 학습률 부호와 grad 초기화 빼먹기(S15, S16).

## 8. 편별 힌트

모든 단계(26개), 힌트가 있는 확인 문제(Q02, Q04, Q06, Q07, Q08, Q09, Q11), 재구성 조각(R1~R3)에 H1~H4가 있습니다. 3~5절과 `content/L01.json`의 hints(144개)를 봅니다. 예측 문제(Q01, Q03, Q05, Q10)에는 힌트가 없습니다(hints.md 2절).
