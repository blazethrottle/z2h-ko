# 06. makemore 5편: WaveNet 만들기

- 영상: [Building makemore Part 5: Building a WaveNet](https://www.youtube.com/watch?v=t3YJ5hKiMQ0) (2022-11-21 업로드, 56분 21초)
- 저장소: [karpathy/makemore](https://github.com/karpathy/makemore) (`makemore.py`에 여러 모델 구현)
- 강의 노트북: [nn-zero-to-hero/lectures/makemore/makemore_part5_cnn1.ipynb](https://github.com/karpathy/nn-zero-to-hero/blob/master/lectures/makemore/makemore_part5_cnn1.ipynb)
- 설명란 Colab: https://colab.research.google.com/drive/1CXVEmCO_7r7WYZGb5qnjfyxTvQa13g5X?usp=sharing
- 근거: 설명란(챕터), 자동 자막(분석용), 저장소, GitHub 이슈, 유튜브 상위 댓글 198개 표본(수집된 전부)

## 1. 다루는 개념과 나오는 순서

설명란 요지: 05편까지의 2층 MLP를 트리 구조로 더 깊게 만들어 DeepMind WaveNet(2016)과 비슷한 합성곱 구조에 도달합니다. 원 논문은 같은 계층 구조를 causal dilated convolution으로 더 효율적으로 구현합니다(이 영상에서는 아직 다루지 않음). torch.nn이 내부에서 어떻게 동작하는지, 그리고 문서 읽기, 다차원 shape 추적, 노트북과 저장소 코드 오가기 같은 실제 개발 과정을 봅니다.

1. 시작 코드 살펴보기, 학습률 그래프 고치기
2. 코드 PyTorch화: Embedding, FlattenConsecutive, Sequential 같은 층과 컨테이너, 그 과정의 버그
3. WaveNet 개요: 글자를 한 번에 펼치지 않고 2개씩 묶어 단계적으로 합치기
4. 문맥 길이를 8로 늘리고 기준선 다시 돌리기
5. WaveNet 구현, 첫 학습
6. BatchNorm1d가 3차원 입력에서 잘못된 차원으로 통계를 내던 버그 수정
7. 규모 키우기
8. 실험 환경(experimental harness)의 필요성, dilated causal convolution과의 관계, torch.nn, 개발 과정 이야기
9. 과제: 손실을 더 낮춰 보기

## 2. 코드를 만들어 가는 단계와 타임스탬프

출처: 영상 설명란 챕터.

| 시각 | 단계 |
|---|---|
| 0:00:00 | intro |
| 0:01:40 | 시작 코드 살펴보기 |
| 0:06:56 | 학습률 그래프 고치기 |
| 0:09:16 | 코드 PyTorch화: 층, 컨테이너, torch.nn, 재미있는 버그 |
| 0:17:11 | 개요: WaveNet |
| 0:19:33 | 데이터셋 문맥 길이 8로 늘리기 |
| 0:19:55 | block_size 8로 기준선 다시 돌리기 |
| 0:21:36 | WaveNet 구현 |
| 0:37:41 | WaveNet 첫 학습 |
| 0:38:50 | batchnorm1d 버그 수정 |
| 0:45:21 | 버그 수정 후 다시 학습 |
| 0:46:07 | WaveNet 규모 키우기 |
| 0:46:58 | 실험 환경 |
| 0:47:44 | dilated causal convolution 버전의 WaveNet |
| 0:51:34 | torch.nn |
| 0:52:28 | 깊은 신경망 개발 과정 |
| 0:54:17 | 앞으로 |
| 0:55:26 | 내 손실을 이겨 보라 |

보조 확인(자막): 0:21:00 문맥 3에서 8로 늘리자 "2.02", 0:45:30 버그 수정 후 "2.029 to 2.022", 0:46:30 규모 확대 후 검증 손실 "1.993".

## 3. 미리 알아야 하는 것

- 04편 BatchNorm과 PyTorch화한 층 클래스
- 3차원 텐서 (B, T, C) shape 감각, `view`, `torch.nn` 기본 사용
- 합성곱(convolution)은 개념만 언급되므로 깊은 사전지식은 필요 없습니다.
- 설명란 참고 논문: WaveNet 2016(arXiv 1609.03499)

## 4. 설명란의 연습 과제

- 설명란에 "Exercises" 항목은 없습니다(이번에 연 설명란 기준).
- 마지막 챕터 0:55:26 "improve on my loss! how far can we improve a WaveNet on this data?"가 사실상 과제입니다. 자막 0:55:30에서 1.993을 이겨 보라고 말합니다.

## 5. 학습자가 자주 막히는 지점

GitHub 이슈:
- FlattenConsecutive 층을 3개 넘게 쌓으면 `not enough values to unpack (expected 3, got 2)`: [nn-zero-to-hero#23](https://github.com/karpathy/nn-zero-to-hero/issues/23) (같은 내용 [유튜브 댓글](https://www.youtube.com/watch?v=t3YJ5hKiMQ0&lc=Ugz5B7Xu2SSUszoDG-l4AaABAg))

유튜브 댓글(수집 198개):
- 0:46:00 부근 batchnorm 버그가 있어도 왜 에러 없이 학습되는지 질문: [댓글](https://www.youtube.com/watch?v=t3YJ5hKiMQ0&lc=UgxJuvFSkJncCrOOorN4AaABAg)
- `self.training` 철자 실수로 몇 시간 허비: [댓글](https://www.youtube.com/watch?v=t3YJ5hKiMQ0&lc=Ugwh2-UudbVV7qNsbHR4AaABAg)
- 다차원 shape와 곱셈을 따라가기 어려움: [댓글](https://www.youtube.com/watch?v=t3YJ5hKiMQ0&lc=UgxludZyW3ztd1v7Z9N4AaABAg), [댓글](https://www.youtube.com/watch?v=t3YJ5hKiMQ0&lc=UgxWxyaiLyfmiXRNqRJ4AaABAg)
- 최신 버전에서 코드가 안 돈다는 질문(구체 내용 없음): [댓글](https://www.youtube.com/watch?v=t3YJ5hKiMQ0&lc=UgwSDCPxEWnzjE4XGst4AaABAg)
- dilated convolution 버전을 직접 해 본 사람 있는지 질문: [댓글](https://www.youtube.com/watch?v=t3YJ5hKiMQ0&lc=UgyTDM_itQXlNsoPo4p4AaABAg)

앱 반영 제안: 층마다 입력과 출력 shape를 표로 보여 주는 "shape 추적기" 단계가 있으면 가장 큰 막힘을 줄일 수 있어 보입니다.

## 6. 실습 환경과 데이터

- 데이터: [makemore/names.txt](https://github.com/karpathy/makemore/blob/master/names.txt)
- 파이썬: 노트북 메타데이터 Python 3.8.5, PyTorch 버전 미확인
- 라이브러리: torch, matplotlib, random
- 맥미니 M4: CPU로 가능합니다. 규모를 키운 마지막 실험은 영상에서 "기다려야 한다"(자막 0:46:30)고 할 만큼 길어지므로 MPS를 써 볼 수 있으나 실제 소요는 미측정
- Colab 무료: 설명란 Colab 사용 가능
