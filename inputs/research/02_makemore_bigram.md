# 02. makemore 1편: 바이그램 언어 모델

- 영상: [The spelled-out intro to language modeling: building makemore](https://www.youtube.com/watch?v=PaCmpygFfXo) (2022-09-07 업로드, 1시간 57분 45초)
- 저장소: [karpathy/makemore](https://github.com/karpathy/makemore) (`names.txt`, `makemore.py`)
- 강의 노트북: [nn-zero-to-hero/lectures/makemore/makemore_part1_bigrams.ipynb](https://github.com/karpathy/nn-zero-to-hero/blob/master/lectures/makemore/makemore_part1_bigrams.ipynb)
- 근거: 영상 설명란(챕터, 연습 과제), 자동 자막(분석용), 저장소, GitHub 이슈, 유튜브 상위 댓글 300개 표본

## 1. 다루는 개념과 나오는 순서

설명란 요지: 글자 단위 바이그램 언어 모델을 만들고, (1) `torch.Tensor`와 그 미묘한 점, (2) 학습, 샘플링, 손실(음의 로그 가능도) 평가로 이루어진 언어 모델링의 전체 틀을 소개합니다.

1. 데이터셋 읽기: 이름 약 32,000개(자막 0:04:00 "We expect this to be roughly 32,000")
2. 바이그램(앞 글자 하나로 다음 글자 맞히기)의 뜻
3. 파이썬 딕셔너리로 세기, 이어서 2차원 텐서로 세기(이것이 "학습")
4. 텐서 시각화, 시작과 끝 표시를 `.` 하나로 통합
5. 확률 분포에서 샘플링(`torch.multinomial`, `torch.Generator`로 시드 고정)
6. 효율: 행 단위 정규화를 벡터화, 브로드캐스팅 규칙과 `keepdim`
7. 손실 함수: 데이터의 음의 로그 가능도(negative log likelihood), 평균
8. 가짜 개수를 더하는 스무딩
9. 2부: 같은 문제를 신경망으로. 바이그램 데이터셋, 원핫 인코딩
10. 선형층 하나(행렬곱), 소프트맥스로 확률 만들기
11. 벡터화한 손실, PyTorch의 backward와 업데이트
12. 메모 1: 원핫 벡터는 사실 가중치 행렬의 한 행을 고르는 것
13. 메모 2: 스무딩은 정규화(regularization) 손실과 같음
14. 신경망에서 샘플링, 결론

## 2. 코드를 만들어 가는 단계와 타임스탬프

출처: 영상 설명란 챕터.

| 시각 | 단계 |
|---|---|
| 0:00:00 | intro |
| 0:03:03 | 데이터셋 읽고 살펴보기 |
| 0:06:24 | 데이터 속 바이그램 살펴보기 |
| 0:09:24 | 파이썬 딕셔너리로 바이그램 세기 |
| 0:12:45 | 2차원 torch 텐서로 세기("모델 학습") |
| 0:18:19 | 바이그램 텐서 시각화 |
| 0:20:54 | (S), (E) 토큰을 `.` 하나로 바꾸기 |
| 0:24:02 | 모델에서 샘플링 |
| 0:36:17 | 효율: 행 정규화 벡터화, 브로드캐스팅 |
| 0:50:14 | 손실 함수(음의 로그 가능도) |
| 1:00:50 | 가짜 개수로 스무딩 |
| 1:02:57 | 2부: 신경망 접근 소개 |
| 1:05:26 | 신경망용 바이그램 데이터셋 만들기 |
| 1:10:01 | 정수를 신경망에 넣기: 원핫 인코딩 |
| 1:13:53 | 행렬곱으로 만든 선형층 하나 |
| 1:18:46 | 출력을 확률로: 소프트맥스 |
| 1:26:17 | 요약, 다음 단계 예고, micrograd 연결 |
| 1:35:49 | 벡터화한 손실 |
| 1:38:36 | PyTorch로 backward와 업데이트 |
| 1:42:55 | 전부 합치기 |
| 1:47:49 | 메모 1: 원핫은 가중치 행 선택과 같음 |
| 1:50:18 | 메모 2: 스무딩은 정규화 손실 |
| 1:54:31 | 신경망에서 샘플링 |
| 1:56:16 | 결론 |

## 3. 미리 알아야 하는 것

- 01편 micrograd(기울기, backward, 경사하강법). 설명란도 1:26:17에서 micrograd를 다시 참조합니다.
- 설명란이 권하는 연습 자료: CS231n Python + Numpy 튜토리얼, PyTorch Tensor 튜토리얼 2종. 설명란 원문은 numpy 배열과 torch 텐서의 설계(브로드캐스팅, 자료형 등)가 매우 비슷해서 하나를 연습하면 다른 하나도 연습하는 셈이지만, 함수 이름과 인자는 다를 수 있으니 조심하라고 합니다.
- 수학: 확률(합이 1), 로그, 평균. 로그 가능도가 왜 손실이 되는지는 영상에서 설명합니다.

## 4. 설명란의 연습 과제 (원문 요지 번역)

- E01: 트라이그램 모델(앞 두 글자로 세 번째 글자 예측)을 세기 또는 신경망으로 학습하고 손실을 평가. 바이그램보다 나아졌는가?
- E02: 데이터를 무작위로 80% train, 10% dev, 10% test로 나누고 바이그램과 트라이그램을 train에서만 학습, dev와 test에서 평가. 무엇이 보이는가?
- E03: dev 세트로 트라이그램의 스무딩(정규화) 강도를 조정. train과 dev 손실이 어떻게 변하는지 보고, 최적 설정으로 test를 마지막에 한 번만 평가
- E04: 원핫 벡터는 W의 한 행을 고를 뿐이니, `F.one_hot` 대신 W의 행을 직접 인덱싱하도록 바꿔 보기
- E05: `F.cross_entropy`를 찾아 써 보기. 같은 결과가 나와야 함. 왜 이것을 선호할까?
- E06: 메타 과제. 재미있는 과제를 스스로 만들어 풀기

## 5. 학습자가 자주 막히는 지점

GitHub 이슈:
- 같은 시드인데 샘플 결과가 영상과 다름(영상은 'm', 학습자는 'c' 등): PyTorch 2.x에서 `torch.multinomial` 내부가 바뀐 것으로 추정된다는 보고. [makemore#31](https://github.com/karpathy/makemore/issues/31), [nn-zero-to-hero#34](https://github.com/karpathy/nn-zero-to-hero/issues/34)
- `names.txt`가 nn-zero-to-hero 저장소에 없음(makemore 저장소에 있음): [nn-zero-to-hero#48](https://github.com/karpathy/nn-zero-to-hero/issues/48), [nn-zero-to-hero#16](https://github.com/karpathy/nn-zero-to-hero/issues/16)
- 셀 실행 순서를 건너뛰어 `NameError: name 'P' is not defined`: [nn-zero-to-hero#37](https://github.com/karpathy/nn-zero-to-hero/issues/37)
- 가능도(likelihood) 계산 버그 제보(닫힘): [nn-zero-to-hero#1](https://github.com/karpathy/nn-zero-to-hero/issues/1)
- `names.txt` 안 중복 이름: [makemore#25](https://github.com/karpathy/makemore/issues/25)

유튜브 댓글(상위 300개 표본):
- 결과 숫자가 영상과 다른 이유는 torch 버전 차이라는 댓글이 여러 개(좋아요 23, 7, 3): [예1](https://www.youtube.com/watch?v=PaCmpygFfXo&lc=UgxzKirCrlsSEYyyv214AaABAg), [예2](https://www.youtube.com/watch?v=PaCmpygFfXo&lc=UgzEvGZXMoIuGG4YfrZ4AaABAg), [예3](https://www.youtube.com/watch?v=PaCmpygFfXo&lc=Ugy6ifgrhjT-MYWmjXt4AaABAg)
- `P[0].sum()`과 `P[:, 1].sum()`이 왜 둘 다 1인지 헷갈림(브로드캐스팅, 정규화 방향): [댓글](https://www.youtube.com/watch?v=PaCmpygFfXo&lc=UgzaRGqkFtT8atId3nx4AaABAg)
- 브로드캐스팅과 `keepdim`을 길게 설명한 점이 도움됐다는 반응: [댓글](https://www.youtube.com/watch?v=PaCmpygFfXo&lc=UgzjmZvWFMU2JoJW5Yl4AaABAg)
- 시간: Colab에서 1주 넘게 걸렸다는 61세 학습자 댓글: [댓글](https://www.youtube.com/watch?v=PaCmpygFfXo&lc=UgyeMZWJXlGJ6sx1uUx4AaABAg)

앱 반영 제안: "숫자가 영상과 달라도 정상일 수 있음(버전 차이)" 안내를 0:24:02 샘플링 단계에 넣고, 정답 대조는 정확한 값보다 범위나 형태(shape)로 하는 편이 안전합니다. 0:36:17 브로드캐스팅은 별도 확인 문제가 필요해 보입니다.

## 6. 실습 환경과 데이터

- 데이터: [makemore/names.txt](https://github.com/karpathy/makemore/blob/master/names.txt) (저장소 파일 228,145바이트, 이름 약 32,000개)
- 파이썬: 강의 노트북 메타데이터 Python 3.8.5. 영상 당시 PyTorch 버전은 노트북에 출력이 없어 미확인. 댓글들은 1.12 계열로 추정하지만 확인된 사실은 아닙니다.
- 라이브러리: torch, torch.nn.functional, matplotlib (노트북 import 기준)
- 맥미니 M4: CPU로 충분합니다. 바이그램 텐서가 27x27이라 GPU 불필요
- Colab 무료: 그대로 실행 가능. `names.txt`는 업로드하거나 makemore 저장소 원본 URL에서 내려받아야 합니다.
