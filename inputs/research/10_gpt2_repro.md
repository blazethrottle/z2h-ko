# 10. GPT-2 (124M) 재현하기

- 영상: [Let's reproduce GPT-2 (124M)](https://www.youtube.com/watch?v=l8pRSuU81PU) (2024-06-09 업로드, 4시간 1분 26초)
- 저장소: [karpathy/build-nanogpt](https://github.com/karpathy/build-nanogpt) (`train_gpt2.py`, `fineweb.py`, `hellaswag.py`, `play.ipynb`, `input.txt`). README 원문: 커밋을 단계별로 깔끔하게 남겨 git 커밋 기록을 따라가며 만들어지는 과정을 볼 수 있음
- 관련 저장소: [karpathy/nanoGPT](https://github.com/karpathy/nanoGPT) (설명란: 이 영상은 nanoGPT를 만드는 과정이며 끝나면 약 90% 비슷), [karpathy/llm.c](https://github.com/karpathy/llm.c)
- 근거: 설명란(챕터), 자동 자막(분석용), 저장소 코드와 커밋 기록, GitHub 이슈와 Discussions, 유튜브 상위 댓글 300개 표본

## 1. 다루는 개념과 나오는 순서

설명란 요지: GPT-2 (124M)를 처음부터 재현합니다. GPT-2 네트워크를 만들고, 학습을 아주 빠르게 최적화하고, GPT-2와 GPT-3 논문의 하이퍼파라미터대로 학습을 설정한 뒤, 밤새 돌리고 다음 날 아침 결과를 봅니다.

1. 1부 모델 구현: OpenAI GPT-2 124M 체크포인트(Hugging Face) 살펴보기, GPT-2 nn.Module 작성, 공개 가중치 불러오기, 순전파와 샘플링, 장치 자동 감지(cuda, mps, cpu)
2. 학습 준비: (B,T) 배치, cross entropy, 한 배치 과적합, DataLoaderLite, 임베딩과 출력층 가중치 공유, GPT-2식 초기화(std 0.02, 잔차 경로 스케일)
3. 2부 속도: GPU와 혼합 정밀도, Tensor Core와 TF32, float16과 bfloat16, torch.compile과 커널 융합, flash attention, "예쁜 숫자"(vocab 50257을 50304로)
4. 3부 하이퍼파라미터: AdamW, 기울기 클리핑, 학습률 워밍업과 코사인 감소, 배치 크기 스케줄, weight decay, fused AdamW, 기울기 누적, 분산 데이터 병렬(DDP)
5. 데이터: GPT-2와 GPT-3의 데이터, FineWeb-Edu(10B 토큰 샘플), 검증 분할, HellaSwag 평가
6. 4부 결과: 다음 날 아침 결과(GPT-2 124M을 HellaSwag에서 넘음), llm.c 소개, 요약

## 2. 코드를 만들어 가는 단계와 타임스탬프

출처: 영상 설명란 챕터. 오른쪽 열은 build-nanogpt 커밋 메시지를 챕터 제목에 맞춰 대응시킨 것입니다(리서치 판단, 커밋에는 영상 시각이 없음).

| 시각 | 단계 | 대응 커밋 |
|---|---|---|
| 0:00:00 | intro: GPT-2 (124M) 재현 | |
| 0:03:39 | OpenAI GPT-2 124M 체크포인트 살펴보기 | `28916d9` initial commit |
| 0:13:47 | 1부: GPT-2 nn.Module 구현 | |
| 0:28:08 | Hugging Face GPT-2 파라미터 불러오기 | |
| 0:31:00 | 순전파로 logits 얻기 | `dd03c64` add forward() |
| 0:33:31 | 샘플링 준비, 접두 토큰, 토큰화 | |
| 0:37:02 | 샘플링 루프 | `af6e591` generate from the model |
| 0:41:47 | 샘플링, 장치 자동 감지 | `ce84eb3` autodetect device |
| 0:45:50 | 학습: 데이터 배치 (B,T)에서 logits (B,T,C) | `92b5bf9` tiny shakespeare 배치 |
| 0:52:53 | cross entropy 손실 | `41078d1` |
| 0:56:42 | 최적화 루프: 한 배치 과적합 | `7822fce` |
| 1:02:00 | data loader lite | `631f7d6` |
| 1:06:14 | wte와 lm_head 파라미터 공유 | `ec39245` weight tie |
| 1:13:47 | 초기화: std 0.02, 잔차 초기화 | `9ac321e` |
| 1:22:18 | 2부: 빠르게. GPU, 혼합 정밀도, 1000ms | |
| 1:28:14 | Tensor Core, 시간 재기, TF32, 333ms | `5265b20` |
| 1:39:38 | float16, gradient scaler, bfloat16, 300ms | `177e4cd` |
| 1:48:15 | torch.compile, 파이썬 오버헤드, 커널 융합, 130ms | `fb8bd6e` |
| 2:00:18 | flash attention, 96ms | `7ee630c` |
| 2:06:54 | 예쁜 숫자: vocab 50257에서 50304로, 93ms | `7230096` |
| 2:14:55 | 3부: 하이퍼파라미터, AdamW, 기울기 클리핑 | `105f117` |
| 2:21:06 | 학습률 스케줄러: 워밍업 + 코사인 감소 | `90e5d15` |
| 2:26:21 | 배치 크기 스케줄, weight decay, FusedAdamW, 90ms | `3a148e4` |
| 2:34:09 | 기울기 누적 | `01be6b3` |
| 2:46:52 | 분산 데이터 병렬(DDP) | `ba2554a` |
| 3:10:21 | GPT-2, GPT-3의 데이터셋, FineWeb(EDU) | `69cb21f` switch to FineWeb EDU |
| 3:23:10 | 검증 분할, 검증 손실, 샘플링 되살리기 | `21d3d32`, `4a63e6a` |
| 3:28:23 | 평가: HellaSwag, 학습 시작 | `8018ed2` |
| 3:43:05 | 4부: 아침 결과! GPT-2, GPT-3 재현 | `efedfac` 체크포인트, `fb78c49` 시각화 |
| 3:56:21 | llm.c 소개(C/CUDA로 같은 일을 더 빠르게) | |
| 3:59:39 | 요약, build-nanogpt 저장소 | |

챕터 제목의 ms 숫자는 한 스텝 시간이 1000ms에서 90ms까지 줄어드는 과정입니다(8xA100이 아니라 GPU 1장 기준 단계, DDP는 2:46:52부터).

## 3. 미리 알아야 하는 것

- 설명란 원문: 일부는 Zero to Hero 앞 영상의 지식을 바탕으로 함. 특히 07편(GPT 구조, self-attention, 잔차, LayerNorm)과 09편(GPT-2 토크나이저, tiktoken)
- 04편 초기화 감각(1:13:47 std 0.02), 03편 학습률과 배치 개념
- 새로 나오는 하드웨어 개념: GPU 메모리(HBM), 부동소수점 형식(FP32, TF32, FP16, BF16), 여러 GPU 통신. 영상 안에서 설명하지만 비개발자에게는 사전 그림 설명이 필요해 보입니다.
- 유튜브 댓글 중 이 영상을 먼저 보다가 19:00 부근 잔차와 micrograd 설명에서 시리즈 전체를 선행으로 보고 돌아왔다는 사례가 있습니다: [댓글](https://www.youtube.com/watch?v=l8pRSuU81PU&lc=Ugyhm5FJuA7PEytWu3F4AaABAg)

## 4. 설명란의 연습 과제

- 설명란에 연습 과제 항목은 없습니다. 대신 "Corrections: 모든 정오표와 후속 내용은 build-nanogpt 저장소에 올림"이라고 적혀 있습니다.
- 저장소 README의 Errata(정오표) 4건 요지: flash attention 전환 후 남은 `register_buffer` 삭제, 옛 PyTorch에서 uint16을 long으로 바꾸기 어려워 `npt.astype(np.int32)` 추가, `torch.autocast`에는 `device`가 아니라 `device_type`(`cuda:3`이 아니라 `cuda`)을 넘겨야 함(mps는 CPU로 처리됨, 저자도 의도된 방식인지 100% 확신은 없다고 적음), `require_backward_grad_sync` 위치 이동
- 영상 속 개선 제안(자막 3:50:00): 여러 epoch를 돌 때 문서와 샤드를 epoch마다 섞기. Discussions에 이 주기성(seasonality) 수정, 평가 중 torch.compile 사용, 학습 재개를 구현한 사례가 있습니다: [#87](https://github.com/karpathy/build-nanogpt/discussions/87) (작성자 보고: 8xA100 80GB에서 1 epoch 2시간 미만, 약 0.34초/스텝, HellaSwag 최고 0.3101)

## 5. 학습자가 자주 막히는 지점

GitHub 이슈(build-nanogpt):
- FineWeb 샤딩이 마지막 샤드에서 멈춤: [#25](https://github.com/karpathy/build-nanogpt/issues/25)
- GPU 1장에서 OutOfMemory, 2장에서 invalid device ordinal: [#41](https://github.com/karpathy/build-nanogpt/issues/41)
- `unsupported autocast device_type 'cuda:0'`(정오표 항목과 같은 문제): [#44](https://github.com/karpathy/build-nanogpt/issues/44)
- Windows에서 fineweb.py 오류, Triton이 없어 torch.compile 불가, Colab 친화 요청: [#45](https://github.com/karpathy/build-nanogpt/issues/45)
- 영상 속 `log124M_40B/log.txt`를 구할 수 없음(play.ipynb 시각화용): [#47](https://github.com/karpathy/build-nanogpt/issues/47)
- 한 배치 과적합에서 cpu는 0.003까지, mps는 8~9에서 멈추는 차이: [#92](https://github.com/karpathy/build-nanogpt/issues/92)
- `GPT.from_pretrained('gpt2')` 가중치 파일을 못 찾는 OSError: [#103](https://github.com/karpathy/build-nanogpt/issues/103)
- torch.compile 옵션 논의: [#6](https://github.com/karpathy/build-nanogpt/issues/6)

GitHub Discussions(build-nanogpt):
- 40B 토큰 학습에서 기울기 폭발: [#35](https://github.com/karpathy/build-nanogpt/discussions/35)
- flash attention 전환 뒤 마스크가 사라진 것처럼 보이는 이유(`is_causal`): [#65](https://github.com/karpathy/build-nanogpt/discussions/65)
- 한 배치 과적합과 가중치 공유 질문: [#61](https://github.com/karpathy/build-nanogpt/discussions/61)
- 학습 후 모델 불러오기: [#55](https://github.com/karpathy/build-nanogpt/discussions/55), build-nanogpt와 nanoGPT 차이: [#53](https://github.com/karpathy/build-nanogpt/discussions/53)
- RTX 5090 1장으로 FineWeb-Edu 10BT 재현 사례(RoPE, SwiGLU 추가): [#107](https://github.com/karpathy/build-nanogpt/discussions/107)

nanoGPT 이슈(맥 관련): MPS 학습 [nanoGPT#28](https://github.com/karpathy/nanoGPT/issues/28) (댓글 46), M1에서 `torch.amp` 없음 오류(옛 PyTorch) [nanoGPT#150](https://github.com/karpathy/nanoGPT/issues/150)

유튜브 댓글(상위 300개 표본):
- OpenAI 가중치 일부를 전치(transpose)해야 하는 이유가 헷갈림(TensorFlow Conv1D 유래, 자막 0:30:00): [댓글](https://www.youtube.com/watch?v=l8pRSuU81PU&lc=UgxNSKCntgvEW1I77AZ4AaABAg)
- 파라미터 수가 124M이 아니라 117M으로 나오는 원인은 vocab 크기: [댓글](https://www.youtube.com/watch?v=l8pRSuU81PU&lc=UgyasDljJVzuYkEoLu94AaABAg)
- 학습자 비용 보고: Lambda Labs 8xH100에서 약 120달러, A100은 진행이 멈춰 H100으로 바꿈(개인 보고, 검증 안 됨): [댓글](https://www.youtube.com/watch?v=l8pRSuU81PU&lc=UgzwEDqenFOT6iSKLHh4AaABAg)

## 6. 실습 환경과 데이터, GPU 요구

### 원본 규모 (Karpathy가 직접 말하거나 저장소에 적은 것만)

- GPU: 영상의 학습 장비는 A100 SXM 80GB 8장(자막 1:23:00 "a100 sxm 80 gb", 2:47:00 "I am paying for eight gpus"), Lambda Labs에서 시간 단위로 빌림
- 시간과 비용: README "today, reproducing it is a matter of ~1hr and ~$10". 자막 0:02:30 "roughly an hour or probably less ... about 10 bucks"
- 실제 영상 속 실행: 10B 토큰 1 epoch = 19,073 스텝(코드 주석 "~1 epoch, if data is 10B tokens and batch size 0.5M tokens"), 스텝당 약 330ms로 "1.7 hours"(자막 3:22:00), 다른 곳에서는 "one epoch which took roughly two hours"(자막 3:48:30). 처리량 약 150만 토큰/초(자막 3:21:30)
- 밤샘 실행: 4 epoch, 약 40B 토큰, 약 8시간(자막 3:48:30). HellaSwag 33.24(자막 3:53:00), GPT-3 124M 정확도에 "거의 도달"(자막 3:49:30)
- 비교 기준: hellaswag.py 기준 GPT-2 124M acc_norm 0.2955, GPT-2 XL 0.4893. 검증 세트 10,042문항
- 설정: total_batch_size 524,288 토큰(2^19), 미니배치 B=64, T=1024, max_lr 6e-4, warmup 715 스텝, weight_decay 0.1, bfloat16 autocast, TF32 matmul
- 영상의 1~2부 속도 단계는 GPU 1장 기준이며, 메모리가 부족하면 배치를 16에서 8, 4로 줄이라고 말합니다(자막 1:35:30)
- 참고(다른 저장소): nanoGPT README의 OpenWebText 재현은 "at least an 8X A100 40GB node", "about 4 days"로, build-nanogpt(FineWeb-Edu 10B, 약 1~2시간)와 데이터와 학습량이 다릅니다.
- 원본 규모 실행은 클라우드 GPU 결제가 필요하므로 BRIEF 규칙대로 얼큰이님 별도 승인 대상입니다. 현재 GPU 시간당 가격은 이번에 조회하지 않았습니다(미확인).

### 데이터

- tiny shakespeare `input.txt`: 1부(0:45:50~1:13:47) 디버깅용, 저장소에 포함
- FineWeb-Edu `sample-10BT`(Hugging Face `HuggingFaceFW/fineweb-edu`): `fineweb.py`가 내려받아 GPT-2 토크나이저로 바꾸고 1억 토큰 샤드 100개(`edu_fineweb10B`)로 저장, 첫 샤드는 검증용(자막 3:17:00). 토큰을 uint16(2바이트)으로 저장하므로 샤드 합계는 약 20GB로 계산됩니다(계산값, 실측 아님). 원본 텍스트 다운로드 용량은 미확인
- HellaSwag 검증 세트: `hellaswag.py`가 내려받음
- 라이브러리: torch, numpy, tiktoken, transformers(가중치 불러오기, hellaswag 비교), datasets, tqdm. `play.ipynb` 메타데이터는 Python 3.10.14. PyTorch 버전 명시는 없음(미확인). torch.compile과 flash attention(`F.scaled_dot_product_attention`)은 PyTorch 2.x 기능

### 축소판 선택지 (리서치 제안, 실행 검증 전)

- 맥미니 M4(MPS)에서 가능한 범위:
  - 1부 전체(0:03:39~1:13:47): 공개 GPT-2 124M 가중치 불러오기, 샘플링, tiny shakespeare로 한 배치 과적합, DataLoaderLite. 코드가 mps를 자동 감지합니다(train_gpt2.py 307~313행)
  - 3부 개념(학습률 스케줄, 기울기 누적, weight decay): 작은 B(예: 4~8), T(예: 256)로 수백 스텝
  - FineWeb-Edu는 샤드 1~2개만 만들어 짧게 학습하고 HellaSwag 일부로 평가
- 맥에서 안 되거나 다르게 동작하는 것: DDP(코드가 CUDA 전제, 292행 주석 "use of DDP atm demands CUDA"), fused AdamW(`device_type == "cuda"`일 때만), flash attention 속도 이득, TF32와 bf16 autocast의 속도 비교(mps는 정오표상 CPU 경로로 처리), torch.compile 효과. 2부 속도 단계는 앱에서 "영상 수치 읽기"로 대체하는 것이 현실적입니다.
- cpu와 mps 결과가 다를 수 있음([#92](https://github.com/karpathy/build-nanogpt/issues/92))을 막힘 힌트로 넣어야 합니다.
- Colab 무료: 무료 GPU 종류(T4 등)와 시간 제한은 정책에 따라 달라 미확인. T4는 bf16과 TF32를 지원하지 않는 세대로 알려져 있어 2부 속도 단계 재현이 어렵다고 판단되나, 이번에 확인하지 않았습니다(미확인).
- 중간 규모 참고: Discussions [#107](https://github.com/karpathy/build-nanogpt/discussions/107) 작성자 보고로 RTX 5090(32GB) 1장, FineWeb-Edu 10BT, 약 28시간, HellaSwag(1000문항 표본) 최고 0.369(모델을 RoPE, SwiGLU로 바꾼 변형이라 원본과 직접 비교는 어려움). GPU 1장이면 8장 대비 하루 이상 걸린다는 감을 주는 사례입니다.
