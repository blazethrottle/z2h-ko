# 05. makemore 4편: 역전파 닌자 되기

- 영상: [Building makemore Part 4: Becoming a Backprop Ninja](https://www.youtube.com/watch?v=q8SA3rM6ckI) (2022-10-11 업로드, 1시간 55분 24초)
- 저장소: [karpathy/makemore](https://github.com/karpathy/makemore)
- 강의 노트북: [nn-zero-to-hero/lectures/makemore/makemore_part4_backprop.ipynb](https://github.com/karpathy/nn-zero-to-hero/blob/master/lectures/makemore/makemore_part4_backprop.ipynb)
- 연습 Colab(설명란): https://colab.research.google.com/drive/1WV2oi2fh9XXyldh02wupFQX0wh5ZC-z-?usp=sharing
- 근거: 설명란(챕터, 과제), 자동 자막(분석용), 저장소, GitHub 이슈, 유튜브 상위 댓글 300개 표본

## 1. 다루는 개념과 나오는 순서

설명란 요지: 04편의 BatchNorm 포함 2층 MLP를 PyTorch autograd의 `loss.backward()` 없이 손으로 역전파합니다. cross entropy 손실, 두 번째 Linear, tanh, batchnorm, 첫 번째 Linear, 임베딩 표 순서입니다. micrograd처럼 스칼라가 아니라 텐서 단위로 기울기가 흐르는 감각을 기릅니다.

1. 왜 역전파를 직접 이해해야 하는지와 역사(설명란 참고 글: "Yes you should understand backprop")
2. 시작 코드: 순전파를 아주 작은 연산 단위로 쪼개 둠, `cmp()`로 손 계산 기울기와 PyTorch 기울기 비교
3. 연습 1: 쪼갠 계산 그래프를 한 줄씩 역전파(logprobs, probs, counts, 정규화, logits, h, hpreact, bn 관련 변수, W1, b1, emb, C)
4. 곁가지: BatchNorm의 Bessel 보정(n 대신 n-1로 나누기)
5. 연습 2: cross entropy 역전파를 한 식으로 단순화
6. 연습 3: batchnorm 층 역전파를 한 식으로 단순화(수식 유도)
7. 연습 4: 모두 합쳐 수동 역전파로 학습 전체 돌리기

## 2. 코드를 만들어 가는 단계와 타임스탬프

출처: 영상 설명란 챕터. 설명란 챕터는 8개라 세부 시각은 자막으로 보충했습니다.

| 시각 | 단계 |
|---|---|
| 0:00:00 | intro: 왜 신경 써야 하나, 재미있는 역사 |
| 0:07:26 | 시작 코드 |
| 0:13:01 | 연습 1: 원자 단위 계산 그래프 역전파 |
| 1:05:17 | 곁가지: batchnorm의 Bessel 보정 |
| 1:26:31 | 연습 2: cross entropy 손실 역전파 |
| 1:36:37 | 연습 3: batch norm 층 역전파 |
| 1:50:02 | 연습 4: 전부 합치기 |
| 1:54:24 | outro |

연습 1 내부 세부 시각(챕터 아님): 댓글 기준으로 0:37:35 부근 `dlogit_maxes`, 1:16:00 부근 `dbnmeani`, 1:26:00 부근 `dC`(임베딩 역전파)가 언급됩니다. 자막으로 정확한 시작 시각을 아직 대조하지 않아 미확인으로 둡니다.

## 3. 미리 알아야 하는 것

- 01편 micrograd의 연쇄법칙과 기울기 누적(`+=`)
- 04편 BatchNorm 순전파 식(평균, 분산, 정규화, gamma, beta)
- 행렬곱의 shape 규칙, 브로드캐스팅, `sum(dim, keepdim=True)`. 이 편에서 가장 많이 쓰입니다.
- 수학: 행렬 미분은 "shape를 맞추는 방식"으로 유도할 수 있다는 점을 영상이 보여 줍니다(댓글에서도 이 요령이 도움됐다는 반응이 있습니다).

## 4. 설명란의 연습 과제

- 설명란 원문(요지): "영상은 그냥 보는 용도가 아님. 연습을 직접 풀면서 함께 진행하고, 막힐 때마다 영상을 재생해 내가 답을 공개하는 것을 보라." 연습 링크는 위 Colab입니다.
- 연습 구성은 챕터 이름과 같습니다: 연습 1(원자 단위 그래프 역전파), 연습 2(cross entropy 역전파 단순화), 연습 3(batchnorm 역전파 단순화), 연습 4(전부 합쳐 학습)

## 5. 학습자가 자주 막히는 지점

GitHub 이슈:
- `dhpreact`부터 `exact: False`(근사로는 True): Colab과 로컬 결과 차이, 부동소수점 오차. [nn-zero-to-hero#13](https://github.com/karpathy/nn-zero-to-hero/issues/13) (댓글 8), [nn-zero-to-hero#45](https://github.com/karpathy/nn-zero-to-hero/issues/45)
- 임베딩 역전파 `dC`를 루프 하나로 쓰면 틀리는 이유: [nn-zero-to-hero#57](https://github.com/karpathy/nn-zero-to-hero/issues/57)
- `dC` 벡터화 대안들: [#55](https://github.com/karpathy/nn-zero-to-hero/issues/55), [#46](https://github.com/karpathy/nn-zero-to-hero/issues/46), [#29](https://github.com/karpathy/nn-zero-to-hero/issues/29)

유튜브 댓글(상위 300개 표본):
- 같은 증상(`dhpreact`부터 exact 불일치, maxdiff 1e-9~1e-10)이 여러 번 반복됩니다: [예1](https://www.youtube.com/watch?v=q8SA3rM6ckI&lc=UgwH5FF5AYlzHla_ryl4AaABAg) (좋아요 13), [예2](https://www.youtube.com/watch?v=q8SA3rM6ckI&lc=UgxmaXnOE8MqcpLZCg14AaABAg), [예3](https://www.youtube.com/watch?v=q8SA3rM6ckI&lc=UgytO7hcWiXr1xmQic94AaABAg)
- 1:16:00 부근 `dbnmeani`에 `keepdim=True`가 필요해 보인다는 지적: [댓글](https://www.youtube.com/watch?v=q8SA3rM6ckI&lc=UgzM7XVlBgquRYTIO-Z4AaABAg)
- 0:37:35 `dlogit_maxes`가 거의 0이 되는 이유 설명이 도움됨: [댓글](https://www.youtube.com/watch?v=q8SA3rM6ckI&lc=Ugz42W_xR--ynTf9AwR4AaABAg)
- `cmp('probs', dprobs, probs)` 이름 규칙이 헷갈림: [댓글](https://www.youtube.com/watch?v=q8SA3rM6ckI&lc=UgwnScv7TJq2DlXmmZ94AaABAg)
- 1:26:00 `dC`를 `index_add_`로 벡터화: [댓글](https://www.youtube.com/watch?v=q8SA3rM6ckI&lc=Ugwz2m2nqa5ytRbdOd54AaABAg)
- 시간: "며칠 걸렸다": [댓글](https://www.youtube.com/watch?v=q8SA3rM6ckI&lc=UgwgejwaxNsEtkzfsPN4AaABAg)

앱 반영 제안: `exact: False / approximate: True`는 대부분 정상(부동소수점 차이)이라는 점을 첫 막힘 힌트로 넣는 것이 좋겠습니다. 정답 대조는 `approximate` 기준이 안전합니다. 이 편은 시리즈에서 비개발자에게 가장 어려운 구간으로 보여, 변수 하나씩 쪼갠 확인 문제가 필요합니다.

## 6. 실습 환경과 데이터

- 데이터: [makemore/names.txt](https://github.com/karpathy/makemore/blob/master/names.txt)
- 파이썬: 노트북 메타데이터 Python 3.8.5, PyTorch 버전 미확인
- 라이브러리: torch, matplotlib, random
- 맥미니 M4: CPU로 충분합니다. `cmp()`의 exact 비교는 기기와 버전에 따라 달라질 수 있어(위 이슈) MPS보다 CPU 실행을 권합니다(리서치 판단)
- Colab 무료: 설명란 연습 Colab 그대로 사용
