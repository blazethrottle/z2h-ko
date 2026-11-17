# 04. makemore 3편: 활성값과 기울기, BatchNorm

- 영상: [Building makemore Part 3: Activations & Gradients, BatchNorm](https://www.youtube.com/watch?v=P6sfmUTpUmc) (2022-10-04 업로드, 1시간 55분 57초)
- 저장소: [karpathy/makemore](https://github.com/karpathy/makemore)
- 강의 노트북: [nn-zero-to-hero/lectures/makemore/makemore_part3_bn.ipynb](https://github.com/karpathy/nn-zero-to-hero/blob/master/lectures/makemore/makemore_part3_bn.ipynb)
- 설명란 Colab: https://colab.research.google.com/drive/1H5CSy-OnisagUgDUXhHwo1ng2pjKHYSN?usp=sharing
- 근거: 설명란(챕터, 과제), 자동 자막(분석용), 저장소, GitHub 이슈, 유튜브 상위 댓글 300개 표본

## 1. 다루는 개념과 나오는 순서

설명란 요지: 여러 층 MLP의 내부를 들여다보며 순전파 활성값과 역전파 기울기의 통계, 크기가 잘못 맞춰졌을 때의 함정, 깊은 신경망 건강 상태를 보는 진단 도구와 시각화를 다룹니다. 깊은 신경망 학습이 왜 불안정한지 보고, 이를 쉽게 만든 첫 현대 기법인 Batch Normalization을 소개합니다. 잔차 연결(residual)과 Adam은 이후 영상으로 미룹니다.

1. 03편 MLP 코드에서 출발
2. 초기 손실이 너무 큰 문제 고치기(출력층 가중치를 작게)
3. tanh 포화(값이 -1, 1에 몰려 기울기가 사라짐) 고치기
4. 초기화 크기 계산: Kaiming 초기화(gain / sqrt(fan_in))
5. Batch Normalization: 배치 평균과 분산으로 정규화, gamma와 beta, 추론용 running 통계
6. 실제 예: ResNet50 코드 살펴보기
7. 코드를 PyTorch 스타일 클래스(Linear, BatchNorm1d, Tanh)로 정리
8. 진단 시각화 4종: 순전파 활성값 통계, 역전파 기울기 통계, 파라미터와 기울기 통계, 업데이트 대 데이터 비율(update:data ratio)
9. 비선형이 전혀 없는 완전 선형 경우
10. BatchNorm을 다시 넣고 시각화 비교

## 2. 코드를 만들어 가는 단계와 타임스탬프

출처: 영상 설명란 챕터.

| 시각 | 단계 |
|---|---|
| 0:00:00 | intro |
| 0:01:22 | 시작 코드 |
| 0:04:19 | 초기 손실 고치기 |
| 0:12:59 | 포화된 tanh 고치기 |
| 0:27:53 | 초기화 크기 계산: Kaiming init |
| 0:40:40 | batch normalization |
| 1:03:07 | batch normalization 요약 |
| 1:04:50 | 실제 예: ResNet50 살펴보기 |
| 1:14:10 | 강의 요약 |
| 1:18:35 | 2부: 코드 PyTorch화 |
| 1:26:51 | 시각화 1: 순전파 활성값 통계 |
| 1:30:54 | 시각화 2: 역전파 기울기 통계 |
| 1:32:07 | 비선형이 없는 완전 선형 경우 |
| 1:36:15 | 시각화 3: 파라미터 활성값과 기울기 통계 |
| 1:39:55 | 시각화 4: 시간에 따른 update:data 비율 |
| 1:46:04 | batchnorm 다시 넣고 시각화 보기 |
| 1:51:34 | 진짜 강의 요약 |

## 3. 미리 알아야 하는 것

- 03편 MLP(임베딩, 은닉층, cross_entropy, 학습률, train/val 분할)
- 통계 기초: 평균, 분산, 표준편차, 정규분포, 히스토그램 읽기
- tanh 함수 모양과 미분(01편)
- 설명란 참고 논문: Kaiming init(arXiv 1502.01852), BatchNorm(arXiv 1502.03167), BatchNorm 실전 문제(arXiv 2105.07576)

## 4. 설명란의 연습 과제 (원문 요지 번역)

- E01: 영상에서 못 본 것: 모든 가중치와 편향을 0으로 초기화하고 학습해 보기. 1) 잘 학습된다, 2) 전혀 안 된다고 생각할 수 있지만 실제로는 3) 일부만 학습되고 최종 성능이 꽤 나쁨. 기울기와 활성값을 살펴 왜 일부만 학습되는지, 정확히 어느 부분이 학습되는지 알아내기
- E02: BatchNorm은 LayerNorm/GroupNorm과 달리 학습 후 gamma/beta를 앞 Linear 층의 W, b에 "접어 넣을(fold)" 수 있어 추론 때 BatchNorm을 없앨 수 있음. BatchNorm이 있는 작은 3층 MLP를 학습한 뒤 새 W2, b2를 만들어 BatchNorm을 지우고, 추론 순전파가 같은지 검증하기

## 5. 학습자가 자주 막히는 지점

GitHub 이슈:
- 노트북 샘플링 셀이 BatchNorm 층의 `training`을 False로 바꾸지 않은 채 실행됨: [nn-zero-to-hero#82](https://github.com/karpathy/nn-zero-to-hero/issues/82) (수정 PR [#83](https://github.com/karpathy/nn-zero-to-hero/pull/83))
- BatchNorm1d 구현 오류 가능성 제기(닫힘): [nn-zero-to-hero#44](https://github.com/karpathy/nn-zero-to-hero/issues/44)
- 배치 크기 1이면 분산이 nan: [makemore#22](https://github.com/karpathy/makemore/issues/22)
- LayerNorm eps 값 질문: [makemore#1](https://github.com/karpathy/makemore/issues/1)

유튜브 댓글(상위 300개 표본):
- 초기 손실이 영상 값과 다름(6.6 정도): [댓글](https://www.youtube.com/watch?v=P6sfmUTpUmc&lc=UgwXO9VmuodBEy48qDJ4AaABAg)
- 49:00 근처 왜 분산이 아니라 표준편차로 나누는지 헷갈림: [댓글](https://www.youtube.com/watch?v=P6sfmUTpUmc&lc=UgzN9CyLfEqZx4f283N4AaABAg)
- 학습 때 배치 통계를 쓰고 추론 때 running 통계를 쓰는 이유 질문: [댓글](https://www.youtube.com/watch?v=P6sfmUTpUmc&lc=Ugzd0ViCmW_WrDMapkR4AaABAg)
- 1:10:23 PyTorch Linear 기본 초기화(균등분포)와 구현 차이 질문: [댓글](https://www.youtube.com/watch?v=P6sfmUTpUmc&lc=UgwQLx7A9A7GzlmOwf94AaABAg)
- `.data` 사용이 권장되지 않는다는 지적: [댓글](https://www.youtube.com/watch?v=P6sfmUTpUmc&lc=Ugzu-vDO-OPVgmu0QfZ4AaABAg)
- 학습 방법 조언: "한 번 보고, 두 번째는 기억으로 코드 쓰기"(좋아요 20): [댓글](https://www.youtube.com/watch?v=P6sfmUTpUmc&lc=UgwNioy_c07aQTBi6Ut4AaABAg)

앱 반영 제안: 이 편은 새 코드보다 "그래프 읽기"가 핵심이라, 시각화 4종(1:26:51~1:39:55) 각각에 "정상 모양과 비정상 모양" 비교 문제가 필요해 보입니다.

## 6. 실습 환경과 데이터

- 데이터: [makemore/names.txt](https://github.com/karpathy/makemore/blob/master/names.txt)
- 파이썬: 노트북 메타데이터 Python 3.8.5, PyTorch 버전 미확인
- 라이브러리(노트북 import 기준): torch, matplotlib, numpy, scipy.stats, ipywidgets
- 맥미니 M4: CPU로 충분합니다. 다만 ipywidgets는 Jupyter 환경에 따라 별도 설정이 필요할 수 있습니다(미확인)
- Colab 무료: 설명란 Colab 그대로 실행 가능
