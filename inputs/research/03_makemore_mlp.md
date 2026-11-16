# 03. makemore 2편: MLP 언어 모델

- 영상: [Building makemore Part 2: MLP](https://www.youtube.com/watch?v=TCH_1BHY58I) (2022-09-12 업로드, 1시간 15분 40초)
- 저장소: [karpathy/makemore](https://github.com/karpathy/makemore)
- 강의 노트북: [nn-zero-to-hero/lectures/makemore/makemore_part2_mlp.ipynb](https://github.com/karpathy/nn-zero-to-hero/blob/master/lectures/makemore/makemore_part2_mlp.ipynb)
- 설명란 Colab: https://colab.research.google.com/drive/1YIfmkftLrz6MPTOO9Vwqrop2Q5llHIGK?usp=sharing
- 근거: 설명란(챕터, 과제), 자동 자막(분석용), 저장소, GitHub 이슈, 유튜브 상위 댓글 300개 표본

## 1. 다루는 개념과 나오는 순서

설명란 요지: 다층 퍼셉트론(MLP) 글자 단위 언어 모델을 만들고, 학습, 학습률 조정, 하이퍼파라미터, 평가, train/dev/test 분할, 과소적합과 과적합 같은 머신러닝 기초를 소개합니다.

1. Bengio et al. 2003 논문 구조: 앞 글자 여러 개를 임베딩해서 은닉층을 거쳐 다음 글자 예측
2. 학습 데이터 다시 만들기(문맥 길이 block_size = 3)
3. 임베딩 조회표 `C`
4. 은닉층과 torch.Tensor 내부(저장소 storage, view)
5. 출력층, 음의 로그 가능도 손실
6. `F.cross_entropy`를 쓰는 이유(효율, 수치 안정성)
7. 학습 루프, 한 배치 과적합으로 점검
8. 전체 데이터 학습, 미니배치
9. 좋은 초기 학습률 찾기
10. train/val/test 분할과 그 이유
11. 실험: 은닉층 키우기, 임베딩 시각화, 임베딩 크기 키우기
12. 최종 코드 요약, 샘플링

## 2. 코드를 만들어 가는 단계와 타임스탬프

출처: 영상 설명란 챕터.

| 시각 | 단계 |
|---|---|
| 0:00:00 | intro |
| 0:01:48 | Bengio et al. 2003 논문 살펴보기 |
| 0:09:03 | 학습 데이터셋 다시 만들기 |
| 0:12:19 | 임베딩 조회표 구현 |
| 0:18:35 | 은닉층 구현, torch.Tensor 내부(storage, view) |
| 0:29:15 | 출력층 구현 |
| 0:29:53 | 음의 로그 가능도 손실 구현 |
| 0:32:17 | 전체 네트워크 요약 |
| 0:32:49 | `F.cross_entropy` 소개와 이유 |
| 0:37:56 | 학습 루프, 한 배치 과적합 |
| 0:41:25 | 전체 데이터셋, 미니배치 |
| 0:45:40 | 좋은 초기 학습률 찾기 |
| 0:53:20 | train/val/test 분할과 이유 |
| 1:00:49 | 실험: 더 큰 은닉층 |
| 1:05:27 | 글자 임베딩 시각화 |
| 1:07:16 | 실험: 더 큰 임베딩 |
| 1:11:46 | 최종 코드 요약, 결론 |
| 1:13:24 | 모델에서 샘플링 |
| 1:14:55 | Colab 노트북 안내 |

보조 확인(자막): 1:12:00 부근에서 "the best validation loss I've been able to obtain ... is 2.17"이라고 말합니다. 설명란 E01은 "2.2"로 적혀 있어 두 숫자가 약간 다릅니다.

## 3. 미리 알아야 하는 것

- 02편(바이그램, 소프트맥스, 음의 로그 가능도, 원핫과 행 선택)
- 텐서 모양(shape) 읽기, 인덱싱, `view`
- 개념: 학습률, 미니배치, 과적합. 영상 안에서 처음 소개되므로 앱에서는 짧은 사전 설명이면 충분해 보입니다.

## 4. 설명란의 연습 과제 (원문 요지 번역)

- E01: 학습 하이퍼파라미터를 조정해 내 최고 검증 손실 2.2를 이겨 보기
- E02: 이 영상에서 초기화를 신경 쓰지 않았음. (1) 초기 예측 확률이 완전히 균등하면 손실이 얼마여야 하나? 실제로는 얼마인가? (2) 초기화를 조정해 시작 손실을 (1)에 가깝게 만들 수 있나?
- E03: Bengio et al. 2003 논문을 읽고 논문의 아이디어 하나를 구현해 보기. 효과가 있었나?

## 5. 학습자가 자주 막히는 지점

GitHub 이슈:
- `prob[torch.arange(32), Y]`에서 IndexError(배치 크기와 실제 데이터 크기 불일치): [nn-zero-to-hero#50](https://github.com/karpathy/nn-zero-to-hero/issues/50)
- 설명란 Colab에서 임베딩 크기 셀 순서 버그: [makemore#23](https://github.com/karpathy/makemore/issues/23)
- Bengio MLP 학습 방식 안내 제안: [makemore#4](https://github.com/karpathy/makemore/issues/4), MLP 질문: [makemore#9](https://github.com/karpathy/makemore/issues/9)

유튜브 댓글(상위 300개 표본):
- 0:45:40 학습률 찾기 방식(각 학습률을 한 번씩만 쓰고 앞 단계 결과가 누적됨)에 대한 의문: [댓글](https://www.youtube.com/watch?v=TCH_1BHY58I&lc=UgxBYfeLq0zE13wSo3h4AaABAg)
- 0:56:17 test 세트를 왜 아껴 써야 하는지 헷갈림: [댓글](https://www.youtube.com/watch?v=TCH_1BHY58I&lc=Ugxjmbg7Wl4Nwp-8nWB4AaABAg)
- Colab이 임베딩 크기 2를 가정하는데 영상 후반은 10이라 shape가 어긋남: [댓글](https://www.youtube.com/watch?v=TCH_1BHY58I&lc=Ugx9JRq6VLs-JdLWbAd4AaABAg)
- 손실 그래프의 `stepi` 초기화 버그: [댓글](https://www.youtube.com/watch?v=TCH_1BHY58I&lc=UgwgB1AcFez6Rjb74HJ4AaABAg)
- 손실이 inf나 nan으로 나옴: [댓글](https://www.youtube.com/watch?v=TCH_1BHY58I&lc=UgzxWWn2cEK_Ht8HuNd4AaABAg)
- 데이터 셔플 순서를 셀마다 다시 돌려 분할 크기가 바뀌는 문제 지적: [댓글](https://www.youtube.com/watch?v=TCH_1BHY58I&lc=UgztgMNzMRmP9hAe2sh4AaABAg)

앱 반영 제안: 0:18:35 `view`와 shape는 확인 문제로, 0:45:40 학습률 찾기는 "그래프 읽는 법" 힌트로 넣는 것이 좋겠습니다.

## 6. 실습 환경과 데이터

- 데이터: [makemore/names.txt](https://github.com/karpathy/makemore/blob/master/names.txt)
- 파이썬: 노트북 메타데이터 Python 3.8.5, PyTorch 버전 미확인
- 라이브러리: torch, matplotlib, random
- 맥미니 M4: CPU로 충분합니다(파라미터 수: 자막 0:32:30 "about 3,400", 1:01:00 은닉층 확대 후 "10,000"). 학습 반복 20만 회 수준이라 CPU에서 수 분 걸릴 수 있으나 실제 소요는 미측정
- Colab 무료: 설명란 Colab 그대로 실행 가능, `names.txt` 준비 필요
