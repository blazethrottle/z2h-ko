# 07. GPT를 처음부터 코드로 만들기

- 영상: [Let's build GPT: from scratch, in code, spelled out.](https://www.youtube.com/watch?v=kCc8FmEb1nY) (2023-01-17 업로드, 1시간 56분 20초)
- 영상용 저장소: [karpathy/ng-video-lecture](https://github.com/karpathy/ng-video-lecture) (`bigram.py`, `gpt.py`, `input.txt`)
- 관련 저장소: [karpathy/nanoGPT](https://github.com/karpathy/nanoGPT) (`model.py`, `data/shakespeare_char/prepare.py`, `config/train_shakespeare_char.py`)
- 설명란 Colab: https://colab.research.google.com/drive/1JMLa53HDuA-i7ZBmqV7ZnA3c_fvtXnx-?usp=sharing
- 근거: 설명란(챕터, 과제), 자동 자막(분석용), 저장소, GitHub 이슈, 유튜브 상위 댓글 300개 표본

## 1. 다루는 개념과 나오는 순서

설명란 요지: "Attention is All You Need" 논문과 OpenAI GPT-2/GPT-3를 따라 GPT를 만들고, ChatGPT와의 연결을 이야기합니다. 설명란은 자기회귀 언어 모델링 틀과 텐서, PyTorch nn 기초를 당연하게 쓰므로 앞의 makemore 영상을 먼저 보라고 권합니다.

1. ChatGPT, 트랜스포머, nanoGPT 소개
2. 데이터: tiny shakespeare(글자 65종, 자막 0:09:00 "there's 65 of them")
3. 토큰화(글자 단위)와 train/val 분할, tiktoken 언급
4. 데이터 로더: 길이 block_size 조각을 배치로
5. 가장 단순한 기준선: 바이그램 언어 모델, 손실, 생성
6. 스크립트 파일로 옮기기
7. self-attention 만들기: v1 반복문 평균, 행렬곱이 가중 합산이라는 요령, v2 행렬곱, v3 softmax, 위치 인코딩
8. 핵심: v4 self-attention(query, key, value, 미래를 가리는 마스크)
9. 메모 6개: 통신으로서의 attention, 공간 개념 없음(집합 위에서 동작), 배치 사이 통신 없음, 인코더와 디코더 블록, self와 cross attention, sqrt(head_size)로 나누는 이유
10. 트랜스포머 조립: multi-head, feedforward, 잔차 연결, LayerNorm, 규모 확대와 dropout
11. 인코더, 디코더, 둘 다 쓰는 구조 비교, nanoGPT 빠르게 둘러보기
12. ChatGPT로 돌아가기: 사전학습과 미세조정, RLHF

## 2. 코드를 만들어 가는 단계와 타임스탬프

출처: 영상 설명란 챕터.

| 시각 | 단계 |
|---|---|
| 0:00:00 | intro: ChatGPT, 트랜스포머, nanoGPT, 셰익스피어 |
| 0:07:52 | 데이터 읽고 살펴보기 |
| 0:09:28 | 토큰화, train/val 분할 |
| 0:14:27 | 데이터 로더: 조각들의 배치 |
| 0:22:11 | 가장 단순한 기준선: 바이그램 모델, 손실, 생성 |
| 0:34:53 | 바이그램 모델 학습 |
| 0:38:00 | 코드를 스크립트로 옮기기 |
| 0:42:13 | v1: 반복문으로 과거 문맥 평균(가장 약한 집계) |
| 0:47:11 | self-attention의 요령: 행렬곱을 가중 합산으로 |
| 0:51:54 | v2: 행렬곱 사용 |
| 0:54:42 | v3: softmax 추가 |
| 0:58:26 | 작은 정리 |
| 1:00:18 | 위치 인코딩 |
| 1:02:00 | 영상의 핵심: v4 self-attention |
| 1:11:38 | 메모 1: 통신으로서의 attention |
| 1:12:46 | 메모 2: attention에는 공간 개념이 없고 집합 위에서 동작 |
| 1:13:40 | 메모 3: 배치 차원끼리는 통신 없음 |
| 1:14:14 | 메모 4: 인코더 블록과 디코더 블록 |
| 1:15:39 | 메모 5: attention, self-attention, cross-attention |
| 1:16:56 | 메모 6: "scaled" self-attention, 왜 sqrt(head_size)로 나누나 |
| 1:19:11 | self-attention 블록 하나 넣기 |
| 1:21:59 | multi-head self-attention |
| 1:24:25 | 트랜스포머 블록의 feedforward 층 |
| 1:26:48 | 잔차 연결 |
| 1:32:51 | layernorm(앞서 본 batchnorm과의 관계) |
| 1:37:49 | 모델 키우기, 변수 정리, dropout 추가 |
| 1:42:39 | 인코더, 디코더, 둘 다(?) 트랜스포머 |
| 1:46:22 | nanoGPT 빠른 둘러보기, 배치 처리 multi-head attention |
| 1:48:53 | ChatGPT, GPT-3, 사전학습과 미세조정, RLHF |
| 1:54:32 | 결론 |

보조 확인(자막): 1:39:30~1:40:30에서 batch 64, block 256, 임베딩 384, head 6, layer 6, dropout 0.2로 키워 검증 손실이 2.07에서 1.48로 내려갔고, A100 GPU에서 약 15분 걸렸다고 말합니다. 1:41:00에서 CPU나 MacBook에서는 이 설정을 돌리지 말고 층 수와 임베딩 크기를 줄이라고 합니다.

## 3. 미리 알아야 하는 것

- 설명란이 명시: makemore 영상들(02~06)로 자기회귀 언어 모델링, 텐서, PyTorch nn 기초를 익힌 상태
- 특히 02편 바이그램(0:22:11 기준선이 같은 모델), 04편 BatchNorm(1:32:51 layernorm 비교), 행렬곱과 브로드캐스팅
- 설명란 참고 논문: Attention is All You Need(arXiv 1706.03762), GPT-3(arXiv 2005.14165)

## 4. 설명란의 연습 과제 (원문 요지 번역)

- EX1: n차원 텐서 숙달: `Head`와 `MultiHeadAttention`을 하나의 클래스로 합쳐 모든 head를 병렬 처리(head를 또 하나의 배치 차원으로). 답은 nanoGPT에 있음
- EX2: 원하는 데이터셋으로 GPT 학습. 고급 제안: 두 수 덧셈 a+b=c를 학습시키기(c의 자릿수를 거꾸로 예측하면 도움, 데이터 로더가 무작위 문제를 직접 만들게 하고, 입력 위치 손실은 targets를 -1로 가리기, CrossEntropyLoss ignore_index). 더 나아가 +-*/ 계산기 만들기(쉽지 않음, Chain of Thought가 필요할 수 있음)
- EX3: train과 val 손실 차이가 안 보일 만큼 아주 큰 데이터셋으로 사전학습한 뒤, 그 모델로 tiny shakespeare를 더 적은 스텝, 더 낮은 학습률로 미세조정. 사전학습으로 검증 손실이 더 낮아지나?
- EX4: 트랜스포머 논문을 읽고 사람들이 쓰는 기능이나 변경 하나를 구현. 성능이 좋아지나?

## 5. 학습자가 자주 막히는 지점

GitHub 이슈(ng-video-lecture):
- `m`과 `model` 변수를 섞어 씀(gpt.py에서 `m = model.to(device)` 뒤 둘 다 사용): [#18](https://github.com/karpathy/ng-video-lecture/issues/18), [#36](https://github.com/karpathy/ng-video-lecture/issues/36), [#49](https://github.com/karpathy/ng-video-lecture/issues/49)
- (T, T) @ (B, T, C) 브로드캐스팅이 왜 되나(0:53:10 부근): [#34](https://github.com/karpathy/ng-video-lecture/issues/34)
- "수학적 요령" 구간에서 `torch.allclose(xbow, xbow2)`가 False: [#43](https://github.com/karpathy/ng-video-lecture/issues/43)
- softmax 차원을 -2로 잘못 쓰면 손실은 매우 낮은데 생성은 엉망(미래 정보 누출): [#42](https://github.com/karpathy/ng-video-lecture/issues/42)
- 생성 전에 `model.eval()`을 불러야 하나(dropout): [#16](https://github.com/karpathy/ng-video-lecture/issues/16)
- 학습한 모델 저장, 불러오기, 추론만 하기: [#31](https://github.com/karpathy/ng-video-lecture/issues/31), [#29](https://github.com/karpathy/ng-video-lecture/issues/29), [#40](https://github.com/karpathy/ng-video-lecture/issues/40)
- 하드웨어: Windows CPU만으로 되나 [#37](https://github.com/karpathy/ng-video-lecture/issues/37), RTX 3060 8GB [#38](https://github.com/karpathy/ng-video-lecture/issues/38), Mac Studio MPS에서 학습은 되는데 생성이 끝나지 않음 [#35](https://github.com/karpathy/ng-video-lecture/issues/35)

유튜브 댓글(상위 300개 표본):
- 1:41:03 최종 설정 학습이 2020 M1 MacBook Air에서 mps로 3시간 5분 걸렸다는 보고(좋아요 11): [댓글](https://www.youtube.com/watch?v=kCc8FmEb1nY&lc=Ugy0IkujKveJqHivsep4AaABAg)
- 1:19:35 `register_buffer`가 왜 필요한가(tril을 GPU로 함께 옮기기 위해): [댓글](https://www.youtube.com/watch?v=kCc8FmEb1nY&lc=UgwpukF_hADa542xyq14AaABAg)
- 0:32:10 부근 targets가 None일 때 logits 차원이 달라지는 작은 버그: [댓글](https://www.youtube.com/watch?v=kCc8FmEb1nY&lc=UgzPUhWDWq636XZQ-b94AaABAg)
- 채널 차원 이름 C가 다른 자료와 섞여 헷갈림: [댓글](https://www.youtube.com/watch?v=kCc8FmEb1nY&lc=UgxkN0hOrFwzxW_wDVt4AaABAg)
- 생성 전 eval() 모드 지적: [댓글](https://www.youtube.com/watch?v=kCc8FmEb1nY&lc=UgwjjvAnyZfBPB_8DkV4AaABAg)
- 시간: "이해하는 데 8시간", "며칠": [예1](https://www.youtube.com/watch?v=kCc8FmEb1nY&lc=Ugx3pd70RKzoRyGf50V4AaABAg), [예2](https://www.youtube.com/watch?v=kCc8FmEb1nY&lc=UgwfJDCofP63-0q3Hi54AaABAg)

앱 반영 제안: 0:47:11~0:58:26 "수학적 요령"은 shape 그림과 함께 단계별 확인 문제로, 1:37:49 규모 확대는 맥미니용 축소 설정을 기본으로 제공하는 것이 좋겠습니다.

## 6. 실습 환경과 데이터

- 데이터: tiny shakespeare `input.txt`(ng-video-lecture 저장소 포함, 1,115,394바이트. 원본은 karpathy/char-rnn 저장소)
- 라이브러리: torch만으로 충분(gpt.py 기준). nanoGPT는 `pip install torch numpy transformers datasets tiktoken wandb tqdm`(README)
- 파이썬, PyTorch 버전: ng-video-lecture에 명시 없음(미확인)
- gpt.py 설정: batch_size 64, block_size 256, max_iters 5000, n_embd 384, n_layer 6, device는 `'cuda' if torch.cuda.is_available() else 'cpu'`(MPS 자동 선택 없음, 맥에서 쓰려면 `mps`로 바꿔야 함)
- 맥미니 M4: 0:38:00 바이그램과 작은 설정은 CPU로 충분. 최종 설정은 위 댓글처럼 M1에서 mps로 약 3시간이라는 사용자 보고가 있어, M4에서는 더 짧을 것으로 예상되나 미측정입니다. nanoGPT README의 "I only have a macbook" 축소 설정(`--device=cpu --compile=False --block_size=64 --batch_size=12 --n_layer=4 --n_head=4 --n_embd=128 --max_iters=2000`)이 약 3분, 그리고 Apple Silicon에서는 `--device=mps`로 2~3배 빨라진다고 README에 적혀 있습니다.
- Colab 무료: 설명란 Colab 그대로 가능. 무료 GPU 할당 여부와 시간은 Colab 정책에 따라 달라 미확인
