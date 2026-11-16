# Z2H 리서치 산출물 색인

작성: 리서치 몽키, 2026-11-16 KST. 대상: Andrej Karpathy "Neural Networks: Zero to Hero" 재생목록 10편
재생목록: https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ

## 파일 목록

| 번호 | 파일 | 영상 | 길이 | 코드 근거 |
|---|---|---|---|---|
| 01 | [01_micrograd.md](01_micrograd.md) | [VMj-3S1tku0](https://www.youtube.com/watch?v=VMj-3S1tku0) | 2:25:52 | micrograd, nn-zero-to-hero/lectures/micrograd |
| 02 | [02_makemore_bigram.md](02_makemore_bigram.md) | [PaCmpygFfXo](https://www.youtube.com/watch?v=PaCmpygFfXo) | 1:57:45 | makemore, makemore_part1_bigrams.ipynb |
| 03 | [03_makemore_mlp.md](03_makemore_mlp.md) | [TCH_1BHY58I](https://www.youtube.com/watch?v=TCH_1BHY58I) | 1:15:40 | makemore_part2_mlp.ipynb |
| 04 | [04_activations_batchnorm.md](04_activations_batchnorm.md) | [P6sfmUTpUmc](https://www.youtube.com/watch?v=P6sfmUTpUmc) | 1:55:57 | makemore_part3_bn.ipynb |
| 05 | [05_backprop_ninja.md](05_backprop_ninja.md) | [q8SA3rM6ckI](https://www.youtube.com/watch?v=q8SA3rM6ckI) | 1:55:24 | makemore_part4_backprop.ipynb |
| 06 | [06_wavenet.md](06_wavenet.md) | [t3YJ5hKiMQ0](https://www.youtube.com/watch?v=t3YJ5hKiMQ0) | 0:56:21 | makemore_part5_cnn1.ipynb |
| 07 | [07_build_gpt.md](07_build_gpt.md) | [kCc8FmEb1nY](https://www.youtube.com/watch?v=kCc8FmEb1nY) | 1:56:20 | ng-video-lecture, nanoGPT |
| 08 | [08_state_of_gpt.md](08_state_of_gpt.md) | [bZQun8Y4L2A](https://www.youtube.com/watch?v=bZQun8Y4L2A) | 0:42:40 | 없음(강연) |
| 09 | [09_gpt_tokenizer.md](09_gpt_tokenizer.md) | [zduSFxRajkE](https://www.youtube.com/watch?v=zduSFxRajkE) | 2:13:34 | minbpe |
| 10 | [10_gpt2_repro.md](10_gpt2_repro.md) | [l8pRSuU81PU](https://www.youtube.com/watch?v=l8pRSuU81PU) | 4:01:26 | build-nanogpt, nanoGPT |

길이는 yt-dlp 메타데이터(초 단위) 기준입니다. 합계 약 19시간 41분입니다.

## 각 파일 구성 (6개 항목 공통)

1. 다루는 개념과 나오는 순서
2. 코드를 만들어 가는 단계와 타임스탬프(유튜브 공식 챕터 기준, 자막에서 직접 본 시각은 "자막"으로 표시)
3. 미리 알아야 하는 것
4. 설명란의 연습 과제(원문 요지 번역)
5. 학습자가 자주 막히는 지점(GitHub 이슈, Discussions, 유튜브 상위 댓글 링크)
6. 실습 환경과 데이터(맥미니 M4 MPS, Colab 무료 기준). 10편은 GPU 요구와 축소판 포함

## 편 사이 연결 (선행 관계)

- 01 micrograd → 02 바이그램(1:26:17에서 micrograd 참조) → 03 MLP → 04 BatchNorm → 05 수동 역전파(04의 모델) → 06 WaveNet(04의 PyTorch화 층) → 07 GPT(설명란이 makemore 선행 권장) → 09 토크나이저(07의 gpt.py 재방문) → 10 GPT-2 재현(07, 09 기반)
- 08 State of GPT는 코드 없는 개관 강연이라 07 이후 어디에 두어도 됩니다.
- 번호 주의: nn-zero-to-hero 저장소 README는 08 강연을 목록에 넣지 않아 토크나이저를 "Lecture 8"로 부릅니다. 앱에서는 재생목록 순서(이 폴더 번호)를 쓰는 것을 권합니다.

## 교사·디자이너 몽키께 넘기는 핵심

- 가장 어려운 구간(댓글, 이슈 기준): 05 수동 역전파(`exact: False` 혼란), 07 self-attention 행렬 요령(0:47:11~0:58:26), 06 다차원 shape
- 버전 차이로 숫자가 영상과 다르게 나오는 문제: 02 `torch.multinomial`(makemore#31), 05 exact 비교. 정답 대조는 정확한 값보다 범위와 shape로 하는 편이 안전합니다.
- 맥미니 M4: 01~06, 08, 09는 CPU로 충분, 07 최종 설정은 MPS로 수 시간 걸릴 수 있음(M1 사용자 보고 약 3시간), 10은 1부와 축소 학습만 로컬, 원본 규모는 8xA100 약 1~2시간(Karpathy 말로 약 10달러)이며 결제라 얼큰이님 승인 필요

## 근거와 한계

- 자막: yt-dlp 자동 자막(영어). 원문은 공유 폴더에 두지 않고 리서치 개인 작업 폴더에만 보관합니다. 영상 파일은 받지 않았습니다.
- 댓글: 영상마다 yt-dlp로 "인기순" 최상위 댓글 최대 300개만 표본으로 봤습니다(06은 198개, 08은 24개 수집). 답글은 보지 않았습니다.
- GitHub 이슈: 저장소마다 댓글 많은 순 40개(PR 제외)와 일부 키워드 검색. Discussions는 build-nanogpt만 봤습니다.
- Colab 노트북 내부 문항, Discord 대화는 열지 않았습니다(미확인).
- 실행 검증: 이번 작업에서는 어떤 코드도 맥미니나 Colab에서 실제로 돌려 보지 않았습니다. 소요 시간 예측은 모두 미측정입니다.
