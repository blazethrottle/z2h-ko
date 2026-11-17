# z2h_check: 노트북 채점 패키지

학생이 노트북에서 쓴 코드가 맞게 동작하는지 바로 알려 주는 도구입니다(DESIGN.md 12.7절 갈래 A).
런타임 의존은 파이썬 표준 라이브러리뿐이고, torch는 있을 때만 씁니다.

```python
from z2h_check import check, finish
check("L01-S11b", Value)   # ✓ 맞음: … [L01-S11b]   또는   ✕ 다시: 무엇이 다른지 [L01-S11b]
finish("L01")              # 채점표 + 결과코드 (+ 로컬 진도 서버로 보내기 시도)
```

## 노트북에서 쓰는 법

| 실행 장소 | 준비 셀 |
|---|---|
| Colab (기본) | `python -m z2h_check.bundle` 출력(= `z2h_check/_bundle.py` 내용)을 준비 셀에 그대로 붙여 넣는다. 실행하면 `check`, `finish`가 생기고 `from z2h_check import check, finish`도 된다. 두 번 실행해도 된다 |
| 로컬 Jupyter (선택) | 같은 준비 셀을 써도 되고, 저장소 루트에서 `uv pip install --python .venv/bin/python -e .` 로 설치해도 된다 |

- 채점 셀은 그 단계 코드 셀 바로 뒤에 둔다. 넘기는 인자는 아래 표 그대로 쓴다.
- 학생 코드가 틀리거나 비어 있어도(None, `...`, 예외를 던지는 클래스) `check()`는 예외를 던지지 않고 `False`와 "✕ 다시"만 낸다.
  빈칸을 `___`로 두는 학생 노트북은 준비 셀에 `___ = None` 을 두면, 값 칸은 "칸이 비어 있습니다", 메서드 안 빈칸은 "빈칸(___)…" 안내가 나온다.
  학생 코드 자체가 채점 셀 전에 오류를 내는 셀은 노트북 쪽에서 막아야 한다(채점기가 볼 수 없음).
- 채점하는 동안 학생 코드의 print·경고는 숨기고, 학생의 `random` 상태는 채점 뒤 그대로 되돌린다.

출력 5가지

| 표시 | 뜻 | 결과코드 |
|---|---|---|
| `✓ 맞음: …` | 통과 | `p`에 들어감 |
| `✕ 다시: …` | 다름, 비어 있음, 학생 코드 오류. 무엇이 다른지와 고칠 곳을 쉬운 한국어로 | `f`에 들어감 |
| `· 건너뜀: …` | 채점할 수 없음(예: torch가 없어 건너뜀) | 넣지 않음 |
| `⚠ 채점기 오류: …` | 채점 프로그램 자체의 고장(학생 탓 아님). 모르는 채점 번호도 여기 | 넣지 않음 |
| `○ 아직: …` / `○ 참고: …` | 아직 진행 중(지금은 L01-R3에서 학습 셀을 다시 실행하는 중일 때만). 기록하지 않음: 이 칸의 이전 기록은 그대로, 서버 보내기·시도 횟수에도 안 들어감 | 넣지 않음 |

## 1편 호출 규약

채점 칸은 교사 정본(`inputs/pedagogy/content/L01.json`, origin/m0-setup c6d3e72, R3 다시 실행 규칙은 2026-11-17 갱신본)의 단계 id·순서·제목 그대로이고, 재구성 3조각(R1~R3)이 뒤에 붙습니다.
재구성 3조각은 따로 채점 노트북을 만들지 않고 1편 노트북 끝 "재구성(자기 확인)" 구역에서 채점합니다(교사 결정 2026-11-17). 그래서 결과코드의 `p`/`f`에 `L01-R1`~`L01-R3`이 들어갈 수 있습니다.
칸 수는 코드에 박지 않고 `graders/l01.py`의 `@grader` 등록 목록에서 셉니다(`finish("L01")` 채점표도 같은 목록). `tests/test_l01_reference.py`가 교사 정본과 같은지 확인합니다.

학생 `Value`로 식을 계산해 `backward()`한 기울기를 같은 식의 PyTorch 기울기(float64)와 비교합니다(원본 micrograd `test/test_engine.py` 방식, 허용 오차 1e-6).
torch가 없으면 PyTorch 비교만 "torch가 없어 건너뜀"으로 표시하고, 손으로 계산한 기준값 비교는 그대로 합니다. `L01-S13e`만 통째로 건너뜁니다.
`L01-S11b`, `L01-R2`만 학생 `backward()`를 쓰고, 나머지 기울기 칸은 채점기가 직접 거꾸로 돕니다. 그래서 `backward()`가 틀려도 S12·S13 묶음·R1은 그 단계 내용만 따로 채점됩니다.
가벼운 검사: 교사 정본에서 눈으로 보는 단계(S01 그림, S06 그림, S16 손실 비교)는 넘긴 객체의 종류만 보거나 `seen=True`("눈으로 확인했어요") 표시로 통과합니다. 나머지 칸은 실제로 계산해 봅니다.

| check_id | 단계 | 채점 셀 | 넘기는 것 (이름: 형태) |
|---|---|---|---|
| L01-S01 | 함수 그래프 그리기 | `check("L01-S01", f)` | `f`: 함수 f(x) = 3x² - 4x + 5. 그림만 봤다면 `check("L01-S01", seen=True)` |
| L01-S02 | 숫자 기울기 | `check("L01-S02", slope)` | `slope`: (f(x + h) - f(x)) / h 숫자. 약 14 (교사 범위 13.99~14.01) |
| L01-S03 | 입력이 여러 개일 때 | `check("L01-S03", slope_a, slope_b=slope_b, slope_c=slope_c)` | `slope_a`: (d2 - d1) / h (약 -3). 선택 `slope_b`(약 2), `slope_c`(약 1) |
| L01-S04 | Value 클래스 뼈대 | `check("L01-S04", Value)` | `Value` 클래스: data, grad = 0.0, _prev, _op, 출력 `Value(data=2.0)` |
| L01-S05 | 덧셈과 곱셈 기록하기 | `check("L01-S05", Value)` | `Value` 클래스: `__add__`, `__mul__`이 재료 (self, other)와 기호를 기록 |
| L01-S06 | 계산 그래프 그림 | `check("L01-S06", draw_dot(d))` | graphviz 그림 객체(종류만 확인). graphviz를 못 쓰면 `check("L01-S06", seen=True)` |
| L01-S07 | 손으로 기울기 채우기 | `check("L01-S07", a=a, b=b, c=c, d=d, e=e, f=f, L=L)` | e = a*b, d = e + c, L = d * f 로 만든 Value 7개(grad를 손으로 채운 뒤) |
| L01-S08 | 한 걸음 움직여 보기 | `check("L01-S08", L)` | S08 셀 뒤의 `L`(Value 또는 L.data). 강의 숫자 기준 -8.0 → 약 -7.29 (-7.4~-7.2). 숫자를 바꿨다면 `check("L01-S08", L_before, L_after)` |
| L01-S09 | 뉴런 하나 계산하기 | `check("L01-S09", n, x1=x1, x2=x2, w1=w1, w2=w2, b=b)` | `n` = x1*w1 + x2*w2 + b 결과 Value와 재료 Value 5개 |
| L01-S09b | tanh 붙이기 | `check("L01-S09b", Value, o=o)` | `Value` 클래스(tanh 있음). `o`(n.tanh() 결과)는 선택 |
| L01-S10 | _backward를 + 와 * 안에 넣기 | `check("L01-S10", Value)` | `Value` 클래스. 출력 없는 단계지만 + 와 * 의 _backward 를 바로 불러 확인 |
| L01-S10b | tanh의 _backward | `check("L01-S10b", Value)` | `Value` 클래스. 강의 뉴런의 o._backward(), n._backward() 뒤 n.grad, b.grad 0.5 포함 |
| L01-S11 | 위상 정렬 | `check("L01-S11", topo, o)` | `topo`: build_topo(o)로 만든 Value 목록(강의 뉴런이면 10개), `o`: 맨 끝 값 |
| L01-S11b | backward() 메서드 | `check("L01-S11b", Value)` | `Value` 클래스(backward 있음). 학생 backward()로 강의 뉴런 기울기와 PyTorch 비교 |
| L01-S12 | 같은 값을 두 번 쓰는 버그 | `check("L01-S12", Value)` | `Value` 클래스. 또는 숫자 `a.grad`(a = Value(3.0); b = a + a; b.backward() 뒤, 2.0이어야 함) |
| L01-S13 | 숫자와 섞어 계산하기 | `check("L01-S13", Value)` | `Value` 클래스: Value(2.0) + 1, 1 + Value(2.0), 2 * Value(3.0), sum() |
| L01-S13b | exp와 빼기 | `check("L01-S13b", Value)` | `Value` 클래스: exp(와 _backward), `__neg__`, `__sub__`. 출력 없는 단계지만 값과 기울기를 계산해 확인 |
| L01-S13c | 거듭제곱과 나누기 | `check("L01-S13c", Value)` | `Value` 클래스: `__pow__`(와 _backward), `__truediv__` |
| L01-S13d | tanh를 쪼개서 다시 계산하기 | `check("L01-S13d", Value)` | `Value` 클래스. o = (e - 1)/(e + 1) 로 강의 뉴런을 계산해 o 0.7071, 기울기가 S11b와 같은지 + 여러 연산 식 PyTorch 비교 |
| L01-S13e | PyTorch로 비교 | `check("L01-S13e", x1=x1, x2=x2, w1=w1, w2=w2, b=b, o=o)` | requires_grad 텐서 5개(o = torch.tanh(...); o.backward() 뒤). `o` 선택. float32면 허용 오차 1e-4. torch가 없으면 건너뜀 |
| L01-S14 | Neuron 클래스 | `check("L01-S14", Neuron)` | `Neuron` 클래스: Neuron(2)([2.0, 3.0])이 -1~1 Value |
| L01-S14b | Layer 클래스 | `check("L01-S14b", Layer)` | `Layer` 클래스: Layer(2, 3)([2.0, 3.0])이 Value 3개 목록 |
| L01-S14c | MLP 클래스와 parameters() | `check("L01-S14c", MLP)` | `MLP` 클래스: MLP(3, [4, 4, 1]) 파라미터 41개, MLP(2, [3, 1]) 13개, 출력 Value 하나 |
| L01-S15 | 데이터와 손실 | `check("L01-S15", n, loss)` | `n`: MLP(3, [4, 4, 1])(학습 전), `loss`: S15 셀의 손실(Value 또는 숫자). 파라미터 41개, 손실 = 넘긴 n으로 다시 계산한 제곱합. 학습 전에 채점. 통과하면 이 n의 시작 손실을 기억 |
| L01-S15b | 학습 반복 | `check("L01-S15b", n, loss)` | 학습 셀 뒤의 `n`과 마지막 `loss`. 정본에 시드 고정이 없어 **손실이 줄었는지만** 봄(S15 칸이 기억한 시작 손실 → 지금 n으로 다시 계산한 손실). S15 칸을 안 거쳤으면 `start=처음 손실`로 넘김. 0.1 위면 "셀을 한 번 더 실행" 안내만 붙음 |
| L01-S16 | grad 비우기를 빼먹는 버그 | `check("L01-S16", seen=True)` | 눈으로 비교하는 단계. 손실 목록을 모았다면 `check("L01-S16", losses_ok, losses_no_zero)`로 두 목록이 다른지 확인 |
| L01-R1 | Value에 +, *, tanh와 각각의 _backward | `check("L01-R1", Value)` | 빈 노트북에서 다시 만든 `Value`(`__add__`, `__mul__`, tanh, 각 _backward). backward()는 없어도 됨 |
| L01-R2 | 위상 정렬을 쓰는 backward() | `check("L01-R2", Value)` | 다시 만든 `Value`(위상 정렬을 쓰는 backward() 포함) |
| L01-R3 | MLP(3, [4,4,1]) 학습으로 손실 0.1 아래 | `check("L01-R3", n, loss, runs=runs)` | 다시 만들어 학습한 `n`(MLP(3, [4, 4, 1])), 학습 셀의 마지막 `loss`, `runs`(그 n 으로 학습 셀을 몇 번째 실행했는지, 1 이상). 아래 "L01-R3 다시 실행 규칙" |

### L01-R3 다시 실행 규칙 (교사 정본 2026-11-17)

정본 `rebuild_tasks` L01-R3 의 `check.max_reruns`(5), `check.steps_per_run`(20), `check.max`(0.1)를 기준값 파일 `reference/l01.json`의 `R3`에 옮겨 쓰고, `tests/test_l01_reference.py`가 정본과 같은지 확인합니다. 채점 코드에는 숫자를 박지 않습니다.
학습 셀 1번 실행 = 20번 반복이고, 다시 실행한 횟수는 힌트로 세지 않습니다.

| 상황 (`runs` = k) | 표시 | 기록 |
|---|---|---|
| k ≤ 5, 마지막 손실과 n으로 다시 계산한 손실이 둘 다 0.1 미만 | `✓ 맞음` ("학습 셀 k번째 실행(합계 20k번 반복)에서…") | `p` |
| k < 5, 아직 0.1 위 | `○ 아직` ("학습 셀만 한 번 더 실행", 앞으로 몇 번 남았는지) | 기록 안 함 |
| k = 5, 아직 0.1 위 | `✕ 다시` (구현을 의심, 앱의 힌트 H1부터) | `f` |
| k > 5, 같은 n 이 5번 안에서 이미 통과 | `○ 참고` ("이미 통과, 기록 그대로") | 기록 안 함(통과 그대로) |
| k > 5, 그 밖 | `✕ 다시` ("통과로 치지 않음, 처음부터 다시 만들어 보세요") | `f` |
| `runs` 없음(None) | 예전처럼 손실만 봄 (0.1 미만이면 `✓`, 아니면 `✕`) | `p` 또는 `f` |

`runs`는 노트북이 셉니다: `z2h_check.runs.watch(("n",))`가 IPython(Jupyter, Colab)의 셀 실행 끝 알림에 작은 함수를 걸고, 셀이 끝날 때마다 이름 `n`의 모델 파라미터 값이 바뀌었으면 그 모델의 실행 수를 1 늘립니다(새 모델이면 0부터).
`z2h_check.runs.runs_of(n)`이 그 수(1 이상)를 돌려주고, IPython이 아니거나 처음 보는 모델이면 `None`입니다. 학습 셀 안의 반복 수(`range(20)`)는 보지 않습니다. 준비 셀을 다시 실행해도 이미 걸린 함수를 그대로 써서 두 번 세지 않습니다. 결과코드·서버 보내기에는 실행 횟수가 들어가지 않습니다.
Colab에서 셀 실행 끝 알림이 동작하는지는 미확인입니다(맥 Jupyter 커널에서 확인). 정답 구현 실측(2026-11-17, 시작값 1000개): 999개가 5번 안에 통과, 1개는 6번째에 통과(`notebooks/ep01-micrograd/README.md`).
시험: `tests/test_l01_rebuild_runs.py`(규칙과 가짜 IPython 셸로 세기), `tests/test_notebooks_l01.py`(실제 커널에서 학습 셀 6번).

정답 노트북 흐름의 예시는 `tests/reference_impl/scenarios.py` 에 있습니다(이 표와 같은 모양으로 모든 칸을 부름).

## finish("L01")와 결과코드

`finish("L01")`은 채점표(통과·다시·건너뜀·아직 안 함)를 출력하고, 서버 보내기를 시도한 뒤, 결과코드를 늘 마지막 줄에 출력하고 돌려줍니다.

결과코드 규칙 (진도 서버·앱 해독기와 같음, 바꾸지 않음)
- 모양: `Z2H1.{base64url(JSON)}.{crc32 8자리 소문자 16진수}`. base64url은 패딩 `=`를 뗀다.
- crc32 대상: base64url 문자열의 UTF-8 바이트.
- JSON: 키 순서 고정, 공백 없음. `{"v":1,"l":"L01","p":[통과 check_id…],"f":[실패 check_id…],"t":"2026-11-16T21:00:00+09:00"}`
- 기준 예시: `encode_result_code("L01", ["L01-S11b"], ["L01-R2"], "2026-11-16T21:00:00+09:00")` →
  `Z2H1.eyJ2IjoxLCJsIjoiTDAxIiwicCI6WyJMMDEtUzExYiJdLCJmIjpbIkwwMS1SMiJdLCJ0IjoiMjAyNi0xMS0xNlQyMTowMDowMCswOTowMCJ9.32dccd52`
- `decode_result_code(code)`는 공백·줄바꿈을 무시하고, 글자가 하나라도 바뀌면 `ResultCodeError`(한국어 `message_ko`)를 던진다.
- 비밀값이 아니며 위조를 막지 않는다. 목적은 붙여넣기 편의와 오타 잡기.

서버 보내기
- `POST http://127.0.0.1:8787/api/grade`, 본문 `{"lecture_id":"L01","results":[{"check_id","passed","message_ko"}],"at":"…+09:00"}` (통과·다시만 담음).
  `message_ko`는 화면에 나온 줄과 같은 `✓ 맞음: …` / `✕ 다시: …` (끝의 `[check_id]`는 뺌). `at`은 결과코드의 `t`와 같은 시각.
- 머리: `Content-Type: application/json; charset=utf-8`, `Origin: http://127.0.0.1:8787`(보내는 주소 그대로), 프록시 안 씀, 2초 제한.
- 실패하면 조용히 "서버에 닿지 못했습니다. 아래 결과코드를 앱에 붙여 넣으세요"(Colab에서는 정상). 주소는 `http://127.0.0.1`·`localhost`만 허용.
- 환경변수: `Z2H_SERVER_URL`(주소 바꾸기, 127.0.0.1만), `Z2H_NO_SEND=1`(보내지 않기), `Z2H_NO_TORCH=1`(torch 없는 것처럼, 시험용).

## 기준값 파일 `reference/l01.json`

채점에 쓰는 기준값·허용 오차를 한 곳에 둡니다. 손으로 계산할 수 있는 값과 교사 정본의 `expected_check` 범위만 넣었습니다.
실행해야 아는 값은 `null`로 두고 옆 `<키>_주석` 칸에 "노트북 실행 후 확정"을 적는 규칙입니다(`tests/test_l01_reference.py`가 검사).
| 노트북 실행 뒤 채울 키 | 지금 | 뜻 |
|---|---|---|
| `S15b.last_loss_max` | `null` (S15 시작 손실보다 줄었는지만 봄) | 교사 정본에 시드 고정이 없어 마지막 손실이 실행마다 다름(정답 구현 100번: 중앙 0.054, 95% 0.26, 최대 2.12). 기준을 정하면 그 값 미만도 확인. 정본 범위 0.0~0.1은 `teacher_value_range`에 두고 안내 문구에만 씀 |

고친 뒤에는 `python -m z2h_check.bundle --write` 로 묶음을 다시 만듭니다(`tests/test_bundle.py`가 최신인지 확인).

## 묶음과 테스트

```bash
.venv/bin/python -m z2h_check.bundle            # 준비 셀용 소스 출력
.venv/bin/python -m z2h_check.bundle --write    # z2h_check/_bundle.py 저장
.venv/bin/python -m z2h_check.bundle --check    # 최신인지 확인
.venv/bin/python -m pytest tests z2h_check -q    # 전체 테스트
```

출처: 채점 기준의 강의 예제 숫자와 학습 데이터는 karpathy/nn-zero-to-hero, 기울기 비교 방식은 karpathy/micrograd (둘 다 MIT). 루트 `NOTICE.md` 참고.
