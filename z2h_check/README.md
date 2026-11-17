# z2h_check: 노트북 채점 패키지

학생이 노트북에서 쓴 코드가 맞게 동작하는지 바로 알려 주는 도구입니다(DESIGN.md 12.7절 갈래 A).
런타임 의존은 파이썬 표준 라이브러리뿐입니다.

```python
from z2h_check import check, finish
check("L01-S02", globals())   # ✓ 맞음: … [L01-S02]  /  ✕ 다시: 무엇이 다른지 [L01-S02]  /  ○ 아직: … [L01-S02]
finish("L01")                 # 채점표 + 결과코드 (+ 로컬 진도 서버로 보내기 시도)
```

## 노트북에서 쓰는 법

| 실행 장소 | 준비 셀 |
|---|---|
| Colab (기본) | `python -m z2h_check.bundle` 출력(= `z2h_check/_bundle.py` 내용)을 준비 셀에 그대로 붙여 넣는다. 실행하면 `check`, `finish`가 생기고 `from z2h_check import check, finish`도 된다. 두 번 실행해도 된다 |
| 맥미니 Jupyter (선택) | 같은 준비 셀을 써도 되고, 저장소 루트에서 `uv pip install --python .venv/bin/python -e .` 로 설치해도 된다 |

- 채점 셀은 그 단계 셀 바로 뒤에 두고 `check("<칸 id>", globals())` 한 줄로 부른다. 넘기는 것은 노트북 이름 공간(`globals()`) 하나뿐이라, 채점 셀 자체는 예외를 낼 일이 없다.
- 학생 코드가 틀리거나 비어 있어도 `check()`는 예외를 던지지 않고 `False`와 "✕ 다시" 또는 "○ 아직"만 낸다.
- 채점하는 동안 학생 코드의 print·경고는 숨기고, 학생의 `random` 상태는 채점 뒤 그대로 되돌린다. 확인 식과 확인 셀은 이름 공간의 사본에서 계산해 학생 이름을 바꾸지 않는다.
- IPython(Jupyter, Colab) 안에서 `z2h_check`를 불러오면 셀 실행 기록(`runs.py`)이 켜진다. 셀 실행 앞뒤 알림(`pre_run_cell`, `post_run_cell`)에 작은 함수를 걸어,
  셀이 끝날 때마다 그 셀의 출력 글(print), 마지막 줄 값의 글(text/plain), 오류, 빈 셀(주석뿐)인지를 기억한다. 화면에 보이는 것은 그대로다.
  `check`·`finish`를 부른 셀과 준비 셀, 재구성 시작 셀은 기억하지 않는다(도구 셀). 그래서 채점 셀은 늘 바로 위 '내 셀'을 본다.
  Colab에서 이 알림이 동작하는지는 미확인(맥 Jupyter 커널과 IPython 셸에서 확인).

출력 6가지

| 표시 | 뜻 | 결과코드 |
|---|---|---|
| `✓ 맞음: …` | 통과 | `p`에 들어감 |
| `✓ 실행됨: …` | 그림 단계(정본 `manual`) 통과: 셀이 오류 없이 돌았음. 그림의 숫자는 학습자가 '스스로 확인할 것'으로 확인 | `p`에 들어감 |
| `✕ 다시: …` | 다름, 또는 바로 위 셀이나 확인 식에서 학생 코드 오류. 무엇이 다른지와 고칠 곳을 쉬운 한국어로 | `f`에 들어감 |
| `○ 아직: …` | 확인에 필요한 이름이 아직 없음, 바로 위 셀이 빈 셀(주석뿐), 아직 셀 기록이 없음. 기록하지 않음: 이 칸의 이전 기록 그대로 | 넣지 않음 |
| `· 건너뜀: …` | 채점할 수 없음(IPython 이 아니라 셀 출력을 읽지 못함) | 넣지 않음 |
| `⚠ 채점기 오류: …` | 채점 프로그램 자체의 고장(학생 탓 아님). 모르는 채점 번호도 여기 | 넣지 않음 |

## 1편 채점 칸 (정본 claude-1.0)

채점 칸은 정본(`inputs/pedagogy/content/L01.json`)에서 `python -m z2h_check.refgen --write`로 만든 기준값 파일 `reference/l01.json`을 그대로 씁니다.
칸 = 정본 단계 중 `kind == "code"`인 것 53개(정본 순서) + 재구성 L01-R1~R3. 읽기·정리·선택 단계(S01, S55~S58)는 칸이 없습니다(앱에서 진행).
칸 수와 id는 코드에 박지 않고 기준값 파일에서 읽습니다(`finish("L01")` 채점표도 같은 목록). `tests/test_l01_reference.py`가 정본에서 만든 것과 같은지 확인합니다.

| 정본 `expected_check` | 채점 |
|---|---|
| `value_range` + `expr` | 확인 식을 학생 이름 공간(사본)에서 계산해 `min <= 값 <= max`. 식이 읽는 이름(기준값 `reads`: 람다·생성식 안 포함, 파이썬 기본 이름 제외)이 없으면 "○ 아직". 식을 계산하다 학생 코드에서 난 오류는 "✕ 다시" + 막힘 도움말 |
| `output_match` | 바로 위 '내 셀'이 보인 글(print 출력 + 마지막 줄 값)에 `expected`가 들어 있는지(정본 규칙: contains). 숫자는 허용 오차 `tolerance.number`(정본 1e-6)까지 같으면 맞음. 앞뒤가 글자·숫자·점에 붙은 숫자(`x1` 같은 이름, `0x13d20f5b0` 같은 메모리 주소 안 숫자)는 숫자로 치지 않고 글자로 맞춤. 빈칸은 빈칸 여러 개와도 맞음 |
| `value_range`(식 없음) | 바로 위 셀이 보인 글의 마지막 숫자가 `min~max` 안인지 |
| `manual` | 바로 위 셀이 오류 없이 돌았는지만(빈 셀이면 "○ 아직"). 통과로 기록하되 화면에는 "✓ 실행됨"(내용을 채점하지 않으므로 '맞음'이라 하지 않음). 그림의 숫자는 학습자가 정본 '스스로 확인할 것' 목록으로 확인 |

재구성 칸(정본 `rebuild_tasks`)은 정본 확인 셀(`check_code`)을 학생 이름 공간의 사본에서 실행하고 찍힌 글을 봅니다.
- 통과 기준은 정본 `pass_ko`에서 정합니다. "끝이 `X`이면 통과"(R3: `True`, 마지막 손실 < 3.0)면 출력의 마지막 낱말만, 아니면 `check.expected` 전체(R1, R2)를 위 `output_match` 규칙으로 봅니다.
- 확인 셀이 읽는 이름(`reads`, 코드에서 셈: R1·R2 `Value`, R3 `loss`)이 없으면 "○ 아직".
- 옛 정본의 R3 다시 실행 규칙(최대 5번, 1번 = 20번 반복, 손실 0.1)은 새 정본에 없어 없앴습니다.

재구성 구역 셀 도우미 `rebuild.py`
- `start(globals())`: '재구성 시작' 셀. 본문에서 만든 이름(밑줄로 시작하지 않는 것)을 `_z2h_lecture_names`에 보관하고 지워 빈 노트북처럼 만든다. `check`, `finish`, IPython 이름은 그대로. 두 번 눌러도 처음 보관한 본문을 지킨다.
- `resume(globals(), "L01-R3")`: 'R3 시작' 셀. 정본 R3은 "이 편의 노트북에서 … 실행된 상태로 시작"하므로 보관한 본문 이름을 되돌리고, 확인 셀이 읽는 `loss`는 지운다(본문 S53의 `loss`로 그냥 통과하지 않게). 본문 이름이 없으면(다른 날 새 커널) 정답 코드가 읽는 이름(`needs`: MLP, random, xs, ys) 중 없는 것을 알려 준다.

## finish("L01")와 결과코드

`finish("L01")`은 채점표(통과·다시·건너뜀·아직 안 함)와 익힘 기준 한 줄(정본 `mastery_rule`, 판정은 앱)을 출력하고, 서버 보내기를 시도한 뒤, 결과코드를 늘 마지막 줄에 출력하고 돌려줍니다.

결과코드 규칙 (진도 서버·앱 해독기와 같음, 바꾸지 않음)
- 모양: `Z2H1.{base64url(JSON)}.{crc32 8자리 소문자 16진수}`. base64url은 패딩 `=`를 뗀다.
- crc32 대상: base64url 문자열의 UTF-8 바이트.
- JSON: 키 순서 고정, 공백 없음. `{"v":1,"l":"L01","p":[통과 check_id…],"f":[실패 check_id…],"t":"2026-11-16T21:00:00+09:00"}`
- 기준 예시(모양 예시이며 칸 id는 아무 글자나 됨. 앱·서버 해독기 테스트와 같은 값): `encode_result_code("L01", ["L01-S11b"], ["L01-R2"], "2026-11-16T21:00:00+09:00")` →
  `Z2H1.eyJ2IjoxLCJsIjoiTDAxIiwicCI6WyJMMDEtUzExYiJdLCJmIjpbIkwwMS1SMiJdLCJ0IjoiMjAyNi0xMS0xNlQyMTowMDowMCswOTowMCJ9.32dccd52`
- `decode_result_code(code)`는 공백·줄바꿈을 무시하고, 글자가 하나라도 바뀌면 `ResultCodeError`(한국어 `message_ko`)를 던진다.
- 비밀값이 아니며 위조를 막지 않는다. 목적은 붙여넣기 편의와 오타 잡기.

서버 보내기
- `POST http://127.0.0.1:8787/api/grade`, 본문 `{"lecture_id":"L01","results":[{"check_id","passed","message_ko"}],"at":"…+09:00"}` (통과·다시만 담음).
  `message_ko`는 화면에 나온 줄과 같은 `✓ 맞음: …` / `✓ 실행됨: …` / `✕ 다시: …` (끝의 `[check_id]`는 뺌). `at`은 결과코드의 `t`와 같은 시각.
- 머리: `Content-Type: application/json; charset=utf-8`, `Origin: http://127.0.0.1:8787`(보내는 주소 그대로), 프록시 안 씀, 2초 제한.
- 실패하면 조용히 "서버에 닿지 못했습니다. 아래 결과코드를 앱에 붙여 넣으세요"(Colab에서는 정상). 주소는 `http://127.0.0.1`·`localhost`만 허용.
- 환경변수: `Z2H_SERVER_URL`(주소 바꾸기, 127.0.0.1만), `Z2H_NO_SEND=1`(보내지 않기).

## 기준값 파일 `reference/l01.json`

자동 생성 파일입니다. 손으로 고치지 않습니다.

```bash
.venv/bin/python -m z2h_check.refgen            # 정본에서 만든 내용 출력
.venv/bin/python -m z2h_check.refgen --write    # z2h_check/reference/l01.json 저장
.venv/bin/python -m z2h_check.refgen --check    # 최신인지 확인(다르면 종료 코드 1)
```

| 칸 | 정본에서 |
|---|---|
| `steps[]` | `kind == "code"`인 단계의 `step_id`, `title_ko`, `expected_check` 그대로. 확인 식이 있으면 `reads`(식이 읽는 이름, 코드에서 셈) |
| `rebuild[]` | `rebuild_id`, `title_ko`, `check_code`, `pass`(위 규칙), `reads`(확인 셀이 읽는 이름), `needs`(정답 코드가 읽는 이름), `max_hint_level_for_pass` |
| `tolerance.number` | `_meta.code_conventions`의 "허용오차" 값(1e-6) |
| `mastery_rule` | 그대로(`finish()` 채점표 끝의 익힘 기준 한 줄) |
| `_출처` | `_meta.sources_and_licenses` |

`refgen.py`와 `bundle.py`는 저장소에서만 쓰는 도구라 묶음에 넣지 않습니다. 고친 뒤에는 `python -m z2h_check.bundle --write`, `notebooks/ep01-micrograd/build_notebooks.py`를 차례로 다시 실행합니다.

## 묶음과 테스트

```bash
.venv/bin/python -m z2h_check.bundle            # 준비 셀용 소스 출력
.venv/bin/python -m z2h_check.bundle --write    # z2h_check/_bundle.py 저장
.venv/bin/python -m z2h_check.bundle --check    # 최신인지 확인
.venv/bin/python -m pytest tests -q             # 전체 테스트
```

출처: 채점 기준(정본 확인 식, 재구성 확인 셀)의 강의 예제 숫자는 karpathy/nn-zero-to-hero, Value 동작 기준은 karpathy/micrograd (둘 다 MIT). 루트 `NOTICE.md` 참고.
