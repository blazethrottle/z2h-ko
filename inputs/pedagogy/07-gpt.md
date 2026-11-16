# 07 GPT 만들기: 처음부터, 코드로, 한 줄씩

- 영상: "Let's build GPT: from scratch, in code, spelled out.", 1시간 56분, https://www.youtube.com/watch?v=kCc8FmEb1nY
- 원본 저장소: karpathy/nanoGPT(완성형 참고), 강의 동반 저장소 karpathy/ng-video-lecture(`bigram.py`, `gpt.py`, `input.txt`, 2026-11-16 파일 목록 확인). 참고 논문: "Attention is All You Need"(2017)
- 데이터: tiny shakespeare(셰익스피어 작품 모음, 약 100만 글자)
- 실습 환경: 맥미니 MPS 또는 Colab 무료 GPU. 최종 모델은 원본 설정이 무거우므로 **축소 설정**(아래 S14)을 기본으로 합니다.
- 영상 구간 타임스탬프: `research/07_build_gpt.md`의 유튜브 공식 챕터 기준으로 반영(2026-11-16). 단계별 시각은 3절 첫 표에 있습니다.

## 1. 학습 목표

1. 글자 단위 토크나이저(encode, decode)와 학습·검증 분리, `get_batch`(무작위 구간에서 입력 x와 한 칸 밀린 정답 y 뽑기)를 만들 수 있습니다.
2. 바이그램 모델을 `nn.Module`로 만들고 학습·생성할 수 있습니다.
3. 자기주의(self-attention)의 "과거 위치들의 가중 평균"을 아래 삼각 행렬(tril)과 softmax로 계산하는 수학 트릭을 단계별로 보여 줄 수 있습니다.
4. 질의(query, 내가 찾는 것), 키(key, 내가 가진 것), 값(value, 내가 건네줄 것)으로 한 개의 주의 헤드(head)를 만들고, 크기 보정(√head_size로 나누기)과 인과 마스크(미래를 못 보게 가리기)의 이유를 설명할 수 있습니다.
5. 멀티 헤드, 피드포워드, 잔차 연결(residual, 입력을 출력에 더해 길을 터 주기), LayerNorm, 드롭아웃을 쌓아 트랜스포머 블록을 만들 수 있습니다.
6. 축소 설정으로 학습해 셰익스피어 흉내 글을 생성하고, 이 구조가 ChatGPT와 어떻게 연결되는지(사전학습만 한 디코더) 설명할 수 있습니다.

## 2. 선행 지식

- 반드시: 02·03편(언어 모델, 임베딩, 교차 엔트로피), 04편(LayerNorm 이해용 정규화), F-P6(nn.Module 같은 클래스), F-M3(행렬곱, 배치 행렬곱), F-M4(softmax), F-P9(장치 선택)
- 있으면 좋음: 06편(모양 추적)

## 3. 따라 하기 단계

영상 구간표(출처: `research/07_build_gpt.md` 2절, 유튜브 공식 챕터. 챕터 시작 시각이며 끝은 다음 챕터 시작입니다):

| 단계 | 영상 시각 | 챕터 |
|---|---|---|
| S01 | 0:07:52 | 데이터 읽기 |
| S02~S03 | 0:09:28 / 0:14:27 | 토큰화와 분할 / 데이터 로더 |
| S04~S05 | 0:22:11 | 바이그램 기준선, 손실, 생성 |
| S06 | 0:34:53 | 바이그램 학습 |
| S07 | 0:38:00 | 스크립트로 옮기기 |
| S08 | 0:42:13 | v1 반복문 평균 |
| S09 | 0:47:11 / 0:51:54 | 행렬곱 요령 / v2 |
| S10 | 0:54:42 / 0:58:26 | v3 softmax / 정리 |
| S11 | 1:00:18 / 1:02:00 | 위치 인코딩 / v4 self-attention |
| S12 | 1:11:38 ~ 1:16:56 | 메모 1~6 |
| S13 | 1:19:11 / 1:21:59 / 1:24:25 / 1:26:48 / 1:32:51 | 헤드 넣기 / 멀티 헤드 / 피드포워드 / 잔차 / layernorm |
| S14 | 1:37:49 | 키우기, dropout |
| 읽기 | 1:42:39 / 1:46:22 | 인코더·디코더 / nanoGPT 둘러보기 |
| S15 | 1:48:53 | ChatGPT와 사전학습·미세조정 |

**L07-S01 데이터 받기와 보기**
- 입력: ng-video-lecture의 `input.txt`(또는 원본 안내 주소)를 받아 `text = open('input.txt').read()`, `len(text)`, `text[:300]`.
- 보여야 하는 것: 약 111만 글자, 셰익스피어 대사.
- 뜻: 이 글자들의 패턴을 배웁니다.

**L07-S02 글자 토크나이저**
- 입력: `chars = sorted(list(set(text)))`, `stoi`, `itos`, `encode = lambda s: [stoi[c] for c in s]`, `decode = lambda l: ''.join([itos[i] for i in l])`.
- 보여야 하는 것: `vocab_size` 65, `decode(encode("hii there"))`가 원래 글자.
- 뜻: 토큰(token, 모델이 다루는 글자 조각) 하나 = 글자 하나. 9편에서 더 큰 조각을 씁니다.

**L07-S03 학습·검증 나누기와 get_batch**
- 입력: `data = torch.tensor(encode(text))`, 앞 90% train, 뒤 10% val. `block_size=8`, `batch_size=4`로 x는 `data[i:i+8]`, y는 `data[i+1:i+9]`.
- 보여야 하는 것: x, y 모두 [4, 8], y가 x보다 한 칸 밀려 있음.
- 뜻: 8칸 하나 안에 "앞 1글자로 다음", "앞 2글자로 다음" ... 8개 예시가 들어 있습니다.

**L07-S04 바이그램 nn.Module**
- 입력: `nn.Embedding(vocab_size, vocab_size)` 하나로 logits를 내는 `BigramLanguageModel`, `forward(idx, targets)`에서 logits를 [B*T, C]로 펴서 cross_entropy.
- 보여야 하는 것: 시작 손실 약 4.17 (= -ln(1/65)).
- 뜻: 4편에서 배운 "시작 손실 기대값"이 여기서도 맞는지 확인합니다.

**L07-S05 generate**
- 입력: `idx`에 마지막 위치 logits로 softmax → multinomial → 이어 붙이기를 max_new_tokens번.
- 보여야 하는 것: 학습 전엔 뒤죽박죽 글자.
- 뜻: 생성은 "다음 글자 하나 뽑아 붙이기"의 반복입니다.

**L07-S06 바이그램 학습**
- 입력: `optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)`, 반복에서 `optimizer.zero_grad(set_to_none=True)`, `loss.backward()`, `optimizer.step()`.
- 보여야 하는 것: 손실 약 2.5 근처, 생성 글이 조금 단어 같아짐.
- 뜻: AdamW(기울기 크기를 스스로 조절해 주는 개선된 경사 하강)는 1편 갱신 줄의 고급판입니다.

**L07-S07 스크립트로 옮기기와 장치**
- 입력: 원본처럼 코드를 `bigram.py` 한 파일로 정리, `device = 'mps'`(맥미니) 또는 `'cuda'`(Colab), `estimate_loss()`로 train/val 손실을 평균 내어 출력.
- 보여야 하는 것: 일정 간격마다 train, val 손실 한 줄. 생성 전에는 `model.eval()`, 학습 전에는 `model.train()`을 부릅니다(dropout 켜고 끄기).
- 뜻: 장치를 모델과 데이터 양쪽에 맞춰야 합니다(`.to(device)`).

**L07-S08 수학 트릭 1: 반복문으로 평균**
- 입력: `B,T,C = 4,8,2; x = torch.randn(B,T,C)`, 위치 t마다 `x[b,:t+1].mean(0)`.
- 보여야 하는 것: `xbow[0]`의 첫 행이 `x[0,0]`과 같고, 둘째 행은 앞 두 행 평균.
- 뜻: 각 위치가 자기와 과거만 평균 내어 "대화"합니다.

**L07-S09 수학 트릭 2: 행렬곱으로 평균**
- 입력: `wei = torch.tril(torch.ones(T, T)); wei = wei / wei.sum(1, keepdim=True); xbow2 = wei @ x`, `torch.allclose(xbow, xbow2)`.
- 보여야 하는 것: True.
- 뜻: 아래 삼각 행렬로 곱하면 반복문 없이 같은 결과. [T,T] @ [B,T,C]는 배치마다 곱합니다.

**L07-S10 수학 트릭 3: softmax로 평균**
- 입력: `wei = torch.zeros(T,T).masked_fill(tril == 0, float('-inf')); wei = F.softmax(wei, dim=-1)`.
- 보여야 하는 것: S09와 같은 wei.
- 뜻: -무한대는 softmax 뒤 0이 됩니다. 이제 0 대신 "배운 점수"를 넣으면 가중 평균이 됩니다.

**L07-S11 한 개의 헤드**
- 입력: `key = nn.Linear(C, head_size, bias=False)` (query, value도), `wei = q @ k.transpose(-2, -1) * head_size**-0.5`, 마스크, softmax, `out = wei @ v`.
- 보여야 하는 것: `wei[0]`이 아래 삼각 모양이고 행마다 합 1, 칸마다 크기가 다름.
- 뜻: 각 위치가 "누구 말을 얼마나 들을지"를 내용에 따라 정합니다. √head_size로 나누지 않으면 softmax가 한 칸에 쏠립니다.

**L07-S12 주의에 대한 메모 6개 읽기**
- 입력: 앱의 요약 카드 읽기(코드 없음). 주의는 소통 방식이다, 위치 정보가 없어 위치 임베딩이 필요하다, 배치끼리는 섞이지 않는다, 인코더는 마스크가 없다, 교차 주의는 키·값이 다른 곳에서 온다, 크기 보정의 이유.
- 보여야 하는 것: 확인 문제 Q07, Q08로 연결.
- 뜻: 영상의 해설 구간을 정리한 것입니다(구간: 1:11:38 ~ 1:16:56, research/07).

**L07-S13 블록 쌓기**
- 입력: 위치 임베딩 `nn.Embedding(block_size, n_embd)` 추가 → `MultiHeadAttention`(여러 헤드 결과를 이어 붙이고 투영) → `FeedForward`(Linear 4배, ReLU, Linear) → `Block`에 `x = x + self.sa(self.ln1(x))`, `x = x + self.ffwd(self.ln2(x))` → 드롭아웃.
- 보여야 하는 것: 블록 몇 개로 바이그램보다 val 손실이 낮아짐.
- 뜻: 소통(주의) 다음 계산(피드포워드). 잔차와 LayerNorm 덕분에 깊게 쌓아도 학습됩니다.

**L07-S14 축소 설정으로 학습**
- 입력: 앱 기본 축소 설정: `batch_size=12~32, block_size=64, n_embd=128, n_head=4, n_layer=4, dropout=0.1, max_iters=2000~5000`. nanoGPT README의 맥북용 축소 설정(block 64, batch 12, n_layer 4, n_head 4, n_embd 128, 2000스텝, CPU 약 3분, MPS는 2~3배 빠름)과 같은 크기입니다(research/07 6절). (원본 gpt.py 설정은 batch 64, block 256, n_embd 384, n_head 6, n_layer 6, 5000스텝입니다. M1 맥북 MPS에서 약 3시간이라는 사용자 보고가 있어 선택 과제로 둡니다. gpt.py는 MPS를 자동으로 고르지 않으므로 device를 'mps'로 바꿔야 합니다.)
- 보여야 하는 것: val 손실이 바이그램(약 2.5)보다 확실히 낮아짐, 생성 글이 대본 모양(이름: 대사).
- 뜻: 원본과 같은 구조를 작게 돌린 것입니다. 맥미니에서 대략 수십 분 이내 목표(실측은 CTO 확인 예정).

**L07-S15 ChatGPT와의 연결 정리**
- 입력: 앱 요약 읽기.
- 뜻: 우리가 만든 것은 문서를 이어 쓰는 사전학습 디코더입니다. 비서처럼 답하게 하려면 미세조정 단계가 더 필요합니다(8편).

## 4. 확인 문제

| 번호 | 유형 | 문제 | 정답 | 채점 기준 |
|---|---|---|---|---|
| L07-Q01 | 예측 | block_size 8인 x 한 줄에 들어 있는 학습 예시 수 | 8개 | 8 |
| L07-Q02 | 예측 | vocab 65 바이그램 모델의 시작 손실 | 약 4.17 | 4.17 |
| L07-Q03 | 예측 | T=3에서 tril을 행 합으로 나눈 wei의 둘째 행 | [0.5, 0.5, 0] | 정확히 |
| L07-Q04 | 설명 | masked_fill에 -inf를 넣는 이유 | softmax 뒤 0이 되어 미래 위치를 무시 | 0이 됨 |
| L07-Q05 | 설명 | 질의·키·값을 쉬운 말로 | 찾는 것, 가진 것, 건네줄 것. 질의와 키의 내적(곱의 합)이 주의 점수 | 셋 + 점수 |
| L07-Q06 | 버그 | `wei = q @ k` 에서 모양 에러 | `k.transpose(-2, -1)` | 전치 |
| L07-Q07 | 설명 | √head_size로 나누는 이유 | 점수 분산이 커지면 softmax가 한 칸에 쏠려 거의 원-핫이 되기 때문 | 쏠림 |
| L07-Q08 | 설명 | 위치 임베딩이 필요한 이유 | 주의는 순서를 모르는 가중 평균이라 위치 정보를 따로 넣어야 함 | 순서 |
| L07-Q09 | 버그 | generate에서 block_size보다 긴 idx를 넣어 에러 | `idx[:, -block_size:]`로 잘라 넣기 | 자르기 |
| L07-Q10 | 설명 | 잔차 연결이 깊은 신경망을 돕는 이유 | 덧셈은 기울기를 그대로 전해(1편 + 노드) 입력에서 출력까지 고속도로를 만듦 | + 노드 연결 |
| L07-Q11 | 버그 | MPS에서 "Expected all tensors to be on the same device" 에러 | 모델과 데이터 모두 `.to(device)`, 마스크는 `register_buffer`로 등록 | 장치 |
| L07-Q12 | 버그 | 손실은 아주 낮은데 생성 글이 엉망. 코드에 `F.softmax(wei, dim=-2)` | `dim=-1`. 잘못된 축이면 미래 정보가 새어 손실만 낮아짐 | 축 + 누출 |

## 5. 핵심 재구성 과제

1. `Head` 클래스(질의·키·값, 크기 보정, 마스크, softmax, 가중합)를 빈 셀에서 H2 이하로 작성.
2. `Block`(LayerNorm 먼저, 잔차 둘)을 H2 이하로 작성.
3. 축소 설정으로 1000스텝 학습해 val 손실이 바이그램보다 낮아지는지 확인.

선택 심화(설명란 EX1~EX4, research/07 4절): EX1(Head와 MultiHeadAttention을 한 클래스로 합치기)은 10편 준비 과제로 권합니다. EX2 덧셈 학습, EX3 사전학습 뒤 미세조정, EX4 논문 기능 구현은 도전 과제입니다.

## 6. "익혔다" 기준

- S01~S15 완료.
- 확인 문제 80% 이상(12점 중 10점 이상). Q04, Q07은 반드시 정답.
- 재구성 3조각 H2 이하.
- 말하기 질문: "자기주의를 세 문장으로" 채점: 위치마다 질의·키로 점수, 미래 가리고 softmax, 값의 가중 평균.

## 7. 자주 막히는 곳

리서치 반영(`research/07_build_gpt.md` 5절, GitHub 이슈와 유튜브 댓글 근거):
- `m`과 `model` 변수를 섞어 씀(gpt.py, ng-video-lecture#18, #36, #49). 앱 노트북은 `model` 하나로 통일합니다.
- (T, T) @ (B, T, C) 브로드캐스팅이 왜 되는지(0:53:10 부근, #34). S09 풀이에 배치마다 같은 wei를 곱한다는 그림을 붙입니다.
- `torch.allclose(xbow, xbow2)`가 False(#43). 소수 오차일 수 있어 허용 오차를 안내합니다.
- softmax 차원을 -2로 잘못 쓰면 손실은 매우 낮은데 생성은 엉망(미래 정보 누출, #42). Q12로 넣었습니다.
- 생성 전에 `model.eval()`(dropout 끄기)을 불러야 하나(#16, 댓글). 앱은 생성 전 eval()을 기본으로 넣습니다.
- `register_buffer`가 필요한 이유: tril 마스크를 모델과 함께 장치로 옮기기 위해(1:19:35 부근 댓글).
- targets가 None일 때 logits 모양이 달라지는 작은 버그(0:32:10 부근 댓글).
- Mac Studio MPS에서 학습은 되는데 생성이 끝나지 않는 보고(#35). 맥미니 실측 때 CTO 확인 항목입니다.
- 최종 설정 학습이 M1 MacBook Air MPS에서 약 3시간 5분이라는 사용자 보고(1:41:03 부근 댓글). 그래서 S14 축소 설정을 기본으로 둡니다.
- 학습 시간: "이해하는 데 8시간", "며칠"이라는 댓글. 앱 예상 8~12시간과 맞습니다.

교사 몽키 예상(강의 지식 기반):
- 수학 트릭 S08~S10. 작은 숫자(T=3)로 손 계산부터 시킵니다.
- `transpose(-2, -1)`와 배치 행렬곱 모양.
- 노트북에서 스크립트(.py)로 옮기는 과정. 맥미니 터미널 사용이 처음이면 F-P1로 돌아갑니다.
- 장치(MPS/CUDA) 에러와 느린 학습. 축소 설정을 먼저 씁니다.
- 원본 저장소 이름이 여럿(nanoGPT, ng-video-lecture)이라 헷갈림. 앱은 이 편 정답 대조를 ng-video-lecture의 `gpt.py` 기준으로 합니다.

## 8. 편별 힌트 예시

- S11: H1 "q는 [B,T,hs], k도 [B,T,hs]. [T,T] 점수표를 얻으려면 k를 어떻게 돌려야 할까요?" / H2 "마지막 두 축을 바꿉니다(F-M3 전치)" / H3 `wei = q @ k.transpose(___, ___) * head_size**-0.5`.
- S13: H1 "블록 안에서 x는 몇 번 더해지나요?" / H2 "주의 결과와 피드포워드 결과를 각각 x에 더합니다(잔차)".
