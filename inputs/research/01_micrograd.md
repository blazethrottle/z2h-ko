# 01. micrograd: 신경망과 역전파 기초

- 영상: [The spelled-out intro to neural networks and backpropagation: building micrograd](https://www.youtube.com/watch?v=VMj-3S1tku0) (2022-08-16 업로드, 2시간 25분 52초)
- 저장소: [karpathy/micrograd](https://github.com/karpathy/micrograd) (`micrograd/engine.py`, `micrograd/nn.py`, `demo.ipynb`)
- 강의 노트북: [nn-zero-to-hero/lectures/micrograd](https://github.com/karpathy/nn-zero-to-hero/tree/master/lectures/micrograd) (`micrograd_lecture_first_half_roughly.ipynb`, `micrograd_lecture_second_half_roughly.ipynb`)
- 근거: 영상 설명란(챕터 포함), 자동 자막(분석용, 공유 폴더에 원문 미보관), 저장소 코드, GitHub 이슈, 유튜브 상위 댓글 300개 표본

## 1. 다루는 개념과 나오는 순서

1. micrograd가 무엇인지: 자동미분(autograd) 엔진, 역전파(backpropagation)가 신경망 학습의 핵심이라는 점
2. 미분의 직관: 입력을 아주 조금(h) 움직였을 때 출력이 얼마나 변하는지(기울기)를 숫자로 직접 계산
3. 입력이 여러 개인 함수의 미분(편미분)
4. `Value` 객체: 숫자 하나와 그 숫자가 어떤 연산으로 만들어졌는지(계산 그래프)를 기억하는 상자, graphviz로 그래프 시각화
5. 손으로 하는 역전파 1: 간단한 식에서 연쇄법칙(chain rule)으로 기울기를 거꾸로 전달
6. 한 번의 최적화 단계 미리보기: 기울기 방향으로 값을 조금 움직이면 결과가 바뀜
7. 손으로 하는 역전파 2: 뉴런 하나(가중치 곱, 더하기, tanh)
8. 연산마다 `_backward` 함수를 구현해 자동화
9. 위상 정렬(topological sort)로 그래프 전체에 `backward()` 실행
10. 같은 노드를 여러 번 쓸 때 생기는 버그와 해결(기울기는 덮어쓰기가 아니라 더하기 `+=`)
11. tanh를 더 작은 연산(exp, 나누기 등)으로 쪼개도 같은 결과가 나오는지 확인
12. 같은 일을 PyTorch로 해 보고 비교
13. 신경망 라이브러리 만들기: Neuron, Layer, MLP
14. 작은 데이터셋과 손실 함수(평균제곱오차 형태)
15. 모든 파라미터 모으기, 경사하강법으로 직접 학습, `zero_grad` 필요성
16. 요약, 실제 micrograd 저장소 코드 둘러보기, PyTorch 내부의 tanh backward 찾아보기

## 2. 코드를 만들어 가는 단계와 타임스탬프

출처: 영상 설명란 챕터(유튜브 공식 챕터). 괄호 안 "자막 확인"은 자동 자막에서 해당 시점 발화를 직접 확인한 것입니다.

| 시각 | 단계 |
|---|---|
| 0:00:00 | intro |
| 0:00:25 | micrograd 개요 |
| 0:08:08 | 입력 1개 함수의 미분 |
| 0:14:12 | 입력 여러 개 함수의 미분 |
| 0:19:09 | `Value` 객체 시작, 시각화(draw_dot) |
| 0:32:10 | 손으로 역전파 예제 1: 간단한 식 |
| 0:51:10 | 최적화 한 단계 미리보기 |
| 0:52:52 | 손으로 역전파 예제 2: 뉴런 |
| 1:09:02 | 연산별 `_backward` 구현 |
| 1:17:32 | 그래프 전체 `backward()` 구현 |
| 1:22:28 | 노드를 여러 번 쓸 때의 버그 수정 |
| 1:27:05 | tanh 쪼개기, 연산 더 추가 |
| 1:39:31 | PyTorch로 같은 일 하기 |
| 1:43:55 | MLP 라이브러리 만들기 |
| 1:51:04 | 작은 데이터셋, 손실 함수 |
| 1:57:56 | 파라미터 모으기 |
| 2:01:12 | 경사하강법으로 직접 학습 |
| 2:14:03 | 배운 것 요약, 현대 신경망으로 가는 길 |
| 2:16:46 | GitHub의 micrograd 전체 코드 둘러보기 |
| 2:21:10 | PyTorch의 tanh backward 찾아보기 |
| 2:24:39 | 결론 |
| 2:25:20 | NG 장면(outtakes) |

## 3. 미리 알아야 하는 것

- 설명란 원문: "It only assumes basic knowledge of Python and a vague recollection of calculus from high school." 즉 파이썬 기초와 고등학교 미분에 대한 희미한 기억만 가정합니다.
- 비개발자 기준으로 필요한 최소 목록(리서치 판단): 파이썬 변수, 함수, 클래스(`__init__`, `__add__` 같은 특수 메서드), 리스트, for 문, 미분의 뜻(기울기), 연쇄법칙의 직관
- 유튜브 최상위 댓글(좋아요 약 1000개)이 "remember back in your calculus class?.... nope."라고 할 정도로 미분 기억이 없는 학습자가 많습니다. 미분 사전 모듈이 필요하다는 신호로 보입니다.

## 4. 설명란의 연습 과제

- 설명란 원문: "Exercises: you should now be able to complete the following google collab, good luck!" 링크: https://colab.research.google.com/drive/1FPTx1RXtBfc4MaTkf7viZZD4U2F9gtKN?usp=sharing
- Colab 안의 개별 문항 내용은 이번에 열어 보지 않아 미확인입니다(Colab은 로그인 화면이 섞여 텍스트 추출을 시도하지 않았습니다).

## 5. 학습자가 자주 막히는 지점

GitHub 이슈:
- 기울기 누적과 `zero_grad`: `backward()`를 여러 번 부르면 기울기가 계속 쌓임. [micrograd#53](https://github.com/karpathy/micrograd/issues/53), [micrograd#25](https://github.com/karpathy/micrograd/issues/25) (내부 노드도 0으로 만들어야 하나는 질문), [nn-zero-to-hero#30](https://github.com/karpathy/nn-zero-to-hero/issues/30)
- 같은 값을 여러 번 쓸 때 기울기 오류: 영상 1:22:28 버그와 같은 주제. [micrograd#2](https://github.com/karpathy/micrograd/issues/2)
- `int + Value` 오류(`TypeError: unsupported operand type(s) for +: 'int' and 'Value'`): `sum()`이 0부터 더하기 때문. [nn-zero-to-hero#41](https://github.com/karpathy/nn-zero-to-hero/issues/41)
- 위상 정렬이 왜 필요한가, 순환 그래프면 안 됨: [micrograd#96](https://github.com/karpathy/micrograd/issues/96), [micrograd#67](https://github.com/karpathy/micrograd/issues/67)
- 그래프 그리기 전에 `L.backward()`를 빠뜨림: [nn-zero-to-hero#40](https://github.com/karpathy/nn-zero-to-hero/issues/40)

유튜브 댓글(상위 300개 표본):
- 1:54:47 근처 오류는 `__radd__`가 없어서 생긴다는 안내(좋아요 약 594): [댓글](https://www.youtube.com/watch?v=VMj-3S1tku0&lc=UgywQLgKtZJ8AZEzs3J4AaABAg)
- 1:54:01 `float - Value` 오류에는 `__rsub__` 추가: [댓글](https://www.youtube.com/watch?v=VMj-3S1tku0&lc=UgwQGs6pY9UKs7CwKU14AaABAg)
- 1:54:50 `sum(..., Value(0.0))`로 시작값을 주는 해결: [댓글](https://www.youtube.com/watch?v=VMj-3S1tku0&lc=UgxyyCB-JdL0-EyGTml4AaABAg)
- 2:04:41 `zero_grad()`는 `loss.backward()` 앞에 와야 한다는 지적: [댓글](https://www.youtube.com/watch?v=VMj-3S1tku0&lc=UgwwggsUuZUX2FLprtJ4AaABAg)
- graphviz 설치 문제(시스템 graphviz와 파이썬 패키지 둘 다 필요): [댓글](https://www.youtube.com/watch?v=VMj-3S1tku0&lc=UgyGMhM_g6mVGSgsm_Z4AaABAg)
- 시간: "2시간 30분 영상에 4~5시간", "1주일" 걸렸다는 댓글이 여러 개입니다. [예1](https://www.youtube.com/watch?v=VMj-3S1tku0&lc=UgwR-NUYp9W6yik4tMB4AaABAg), [예2](https://www.youtube.com/watch?v=VMj-3S1tku0&lc=Ugx1QDP9NPfKLggoTg54AaABAg)

앱 반영 제안: 1:43:55 이후 MLP 단계 전에 `__radd__`, `__rsub__`, `zero_grad` 위치를 "막힘 힌트"로 미리 넣는 것이 좋겠습니다.

## 6. 실습 환경과 데이터

- 파이썬: 강의 노트북 메타데이터는 Python 3.8.5, micrograd `setup.py`는 `python_requires='>=3.6'`. 최신 3.11~3.12에서도 순수 파이썬이라 문제 소지는 낮다고 보지만 실행 검증은 아직 안 했습니다(미확인).
- 라이브러리: 핵심은 순수 파이썬. 시각화에 graphviz(시스템 프로그램 + `pip install graphviz`), PyTorch 비교 구간(1:39:31)에 torch, 데모에 numpy, matplotlib, scikit-learn(`demo.ipynb`의 make_moons)이 쓰입니다.
- 데이터: 영상 안에서 손으로 만든 4개짜리 작은 데이터(1:51:04), 저장소 `demo.ipynb`는 make_moons 2D 데이터
- 맥미니 M4: CPU만으로 충분합니다. GPU 불필요. graphviz는 Homebrew `brew install graphviz`가 필요할 수 있습니다(설치는 승인 후).
- Colab 무료: 그대로 실행 가능, graphviz 기본 탑재 여부는 미확인
