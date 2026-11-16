# Z2H M0 실측 (맥미니 M4 32GB, 2026-11-16 20:00~20:15 KST)

- 환경: macOS 맥미니 M4 32GB, 저장소 .venv Python 3.12.13, torch 2.15.0, tiktoken 0.14.0, graphviz 16.1.1(brew)/0.21(pip)
- 스크립트·원자료: 맥 `~/MonkeyHub/scratch/z2h-measure/` (`out/*.json`, `out/run_all.log`). 저장소 밖 별도 폴더
- 주의: 20:02~20:08 사이 PM(Claude Code) 세션이 같은 맥에서 돌았음(주로 파일 읽기). 7편 측정과 10편 초반이 겹쳐 시간이 약간 늘었을 수 있음
- 방향 전환(20:06) 뒤 실습 기본은 Colab이라, 아래 MPS 숫자는 "로컬 선택" 사용자와 우리 검증용 기준값임

## ① 07편·10편 축소 설정 속도 (MPS, 200스텝)
| 설정 | 파라미터 | 스텝당(중앙값) | 200스텝 | 예상 전체 | 200스텝 손실 |
|---|---|---|---|---|---|
| 07 축소 batch 12 (block 64, n_embd 128, head 4, layer 4, dropout 0.1) | 0.82M | 0.016초 | 3.8초 | 2000스텝 0.5분, 5000스텝 1.4분 | 4.37 → 2.51 |
| 07 축소 batch 32 (같은 크기) | 0.82M | 0.025초 | 5.2초 | 2000스텝 0.8분, 5000스텝 2.1분 | 4.39 → 2.28 |
| 07 원본 gpt.py (batch 64, block 256, n_embd 384, head 6, layer 6) | 10.8M | 0.77초 (20스텝만) | | 5000스텝 약 64분 | |
| 10 축소 (layer 6, head 6, n_embd 384, block 256, vocab 50304, B 8, T 256, 한 스텝 32,768토큰 = 기울기 누적 16) | 30.1M (임베딩 빼면 10.6M) | 3.60초 | 717초 (12분) | 1000스텝 60분, 2000스텝 120분 | 10.88 → 4.70 |

- 예상 전체 시간은 학습 스텝만. 중간 평가(estimate_loss, val)는 빠짐 → 실제로는 10~20% 더 [가정]
- 07편: pedagogy 제안값(batch 12~32, 2000~5000스텝)은 MPS에서 1~3분이라 여유가 큼. 원본 설정도 MPS 약 1시간이라 "선택 과제"로 가능
- 10편: pedagogy의 "1천만~2천만 파라미터"는 임베딩을 뺀 수(10.6M)와 맞음. 임베딩 포함하면 3천만. "수천 스텝"은 MPS에서 2시간 이상이라 맞지 않음
  - 수십 분 이내 안: (a) 500스텝(약 30분) 또는 (b) 한 스텝 토큰을 2^14(16,384, 누적 8)로 줄이고 1000스텝(약 30분, 스텝당 약 1.8초 [가정: 선형 비례])
- 데이터: tiny shakespeare (글자 1,115,394개, GPT-2 토큰 338,025개)

## ② 한 배치 과적합 MPS 멈춤 (build-nanogpt#92) 재현 시도
| 모델 | 스텝 | CPU 최종 손실 | MPS 최종 손실 |
|---|---|---|---|
| 작은 GPT (4층, 256) B4 T32 | 50 | 2.204 | 2.204 |
| GPT-2 124M 구조 B4 T32 | 50 | 0.366 | 0.362 |
| GPT-2 124M 구조 B4 T32 | 200 | 0.0012 | 0.0013 |
- 결론: torch 2.15.0에서는 재현 안 됨(MPS도 0.001대까지 내려감, 8~9에서 멈추지 않음). 이슈는 예전 torch 버전 문제였을 가능성 [가정]. 막힘 힌트에는 "torch 버전을 올려 보세요 + CPU로 바꿔 비교"로 남기기 권장
- 설정: AdamW lr 3e-4, 고정 시드 1337, tiny shakespeare 앞부분

## ③ MPS autocast·torch.compile (10편 축소 모델, B8 T256, 학습 1스텝)
| 항목 | 동작 | 스텝당 | 메모 |
|---|---|---|---|
| fp32 + SDPA(flash 자리) | 됨 | 0.233초 | 기준 |
| fp32 + 손으로 쓴 어텐션 | 됨 | 0.233초 | 이 크기에선 차이 없음 |
| autocast bfloat16 | 됨 (오류 없음) | 0.238초 | 빨라지지 않음 |
| autocast float16 | 됨 (오류 없음) | 0.238초 | 빨라지지 않음, 손실 미세 차이 |
| fused AdamW | 됨 | 0.224초 | 약 4% 빠름 |
| torch.compile | 됨 | 0.214초 (첫 스텝 4.9초) | 약 8% 빠름 |
- 앱 안내: "맥에서는 bf16·compile 효과가 작거나 없음. 영상의 A100 수치(1000ms → 93ms)는 읽기만" (pedagogy 10편 "영상 수치 읽기" 표와 연결)
- Colab(실측 아님, 문서·일반 근거): 무료 T4 GPU는 Turing 세대라 bf16 하드웨어 지원이 없어 fp16 autocast가 맞음, CUDA에서 torch.compile·SDPA 사용 가능 [가정: Colab 실측 필요]

## ④ FineWeb-Edu 소량 샘플 크기
- HF 저장소 `HuggingFaceFW/fineweb-edu` `sample/10BT`: parquet 14개, 합계 28.5GB, 파일당 약 2.15GB [확인됨: HF API 파일 목록]. 카드 기준 sample-10BT는 약 100억 토큰 [카드 표기]
- 실제로 받은 양: datasets-server rows API로 앞 1000문서만(약 4.9MB 텍스트)
- 측정: 문서당 GPT-2 토큰 약 1,058개, 토큰당 4.64바이트
- 환산: 1천만 토큰 = 문서 약 9,450개 = 텍스트 약 46MB = uint16 조각 파일 20MB. 10편 축소 1000스텝(3,280만 토큰)을 한 바퀴 돌리려면 약 3,300만 토큰(텍스트 약 150MB)
- 권장: parquet 한 파일(2.15GB) 대신 rows API로 1천만 토큰(요청 약 95번)만 받거나, tiny shakespeare로 대체. rows API 호출 한도는 미확인

## ⑤ graphviz와 micrograd draw_dot
- brew graphviz 16.1.1 + 파이썬 graphviz 0.21 설치(.venv에만). 원본 강의 방식 draw_dot으로 a*b+c 그래프를 SVG 렌더 성공(노드 7개, 6.5KB)
- Colab은 graphviz가 기본으로 깔려 있다는 것이 일반적 경험이나 실측 아님

## 02편 torch.multinomial (리서치 지적 makemore#31)
- torch 2.15.0, 같은 시드 2147483647:
  - `torch.rand(3)` → [0.6064, 0.3033, 0.0903], 3개 확률에서 100번 뽑기 → **원본 노트북과 같음**
  - 바이그램 첫 글자 뽑기 → 'c' (원본 'm'), 이름 5개 → cexze., momasurailezitynn., konimittain., llayn., ka. (원본 mor., axx., minaymoryles., ...) → **다름**
- 결론: 27개짜리 분포 뽑기는 버전에 따라 결과가 달라짐. 정답 대조는 글자 일치가 아니라 "확률 표·손실 범위"로 하고, 화면에 "영상과 다른 이름이 나와도 정상" 표시

## ⑥ data-spec.md 필드 ↔ 설계 단계 스키마 ↔ 디자인 HANDOFF 대조
| 항목 | pedagogy data-spec | CTO 설계(v1) | design HANDOFF 6절 | 제안 |
|---|---|---|---|---|
| 단계 id | `step_id` "L01-S12" | `id` "ep01-s03" | `lectureId`+`stepNo` | data-spec 채택 |
| 영상 | 강의에 `video_url`, 단계에 `video_segment{start:"1:22:28", end, source}` 글자 시각 | `video{videoId, start초, end초}` | `video{id,start,end}` | 저장은 data-spec 글자, 빌드 때 `video_id`(강의에서 상속)·`start_sec`·`end_sec`로 변환(C8: 끝 없음·시작 여러 개 처리). 변환 함수 한 곳 |
| 제목·목적 | `title_ko`, `meaning_ko`, `objective_ids` | `title`, `goal` | `title`, `purpose`, `summary[3]` | `purpose_ko`, `summary_ko[3]` 추가 필요 |
| 개념 | 없음 | `concepts[{term,plain}]` | `concepts[{term,plain}]` | `concepts_ko` 추가 필요 |
| 코드 풀이 | `code` + `code_line_notes_ko`(줄 수 같아야 함) | `code[{line,ko}]` | `code[{line,explain}]` | data-spec 채택, 화면용 변환 |
| 따라하기·예상 출력 | `input_ko`, `expected_ko`, `expected_check{manual/output_match/value_range}`, `kind` | `steps[{do,expect}]` | `expectedOutput`, `outputVaries`, `tolerance`, `mismatchHints[]` | data-spec + `output_varies`, `tolerance`, `mismatch_hints_ko` 추가 |
| 확인 문제 | 별도 `question`(lecture_id만, 단계 연결 없음), 4유형, 객관식 없음(C3) | 단계 안 `check[]` | `quiz[]` | question에 `step_id`(선택) 또는 step에 `question_ids` 추가 |
| 힌트 | 별도 `hint`, level 1~4 + 5=HELP, `unlock` | `hints[level,text]` 2단계 이상 | v1.2: 힌트 4단계, 풀이는 제출 뒤 | data-spec 채택, 해제 조건은 C4(앱 안 시도 횟수) |
| 노트북 연결 | 없음 | `notebook{file,cells,grader}` | 실행 장소 칩 | `notebook{file, cell_tag, grader_id, colab_url}` 추가 |
| 다음 단계 | `order` | 순서 | `next{title}`, `stepCount` | 빌드 때 계산 |
| 실습 시간 | `step_progress.started_at/done_at` | 없음 | v1.2 6-2 자동+수정 | `active_seconds_auto`, `active_seconds_user` + `study_session` 테이블 추가 |
| 사용자 | 없음 | 없음 | | 모든 기록에 `user_id` 추가(결정 9) |
| 동기화 | 없음 | | v1.2 6-1 저장됨/동기화 중/오프라인 | 모든 기록에 `updated_at`, `sync_conflicts` 테이블 |
| 시각 | `+09:00` 문자열 | | | 유지, Postgres에선 TIMESTAMPTZ |
- pedagogy v1.1(20:16 KST)로 해결된 것: 영상이 초 단위 `video_segments[{start_s,end_s}]`와 `youtube_video_id`·`video_seconds`로 바뀜(C8 대부분 해결), 객관식 `choice`(choices, answer_index) 추가(C3 해결), checkpoint 스키마 추가(C5 데이터 쪽), `prepared_code`·`new_code_lines`·`long_step` 추가(C1 쪽). 남은 차이는 아래 요청 항목.
- 교사·디자이너에게 요청할 것: `purpose_ko`, `summary_ko`, `concepts_ko`, `output_varies`/`tolerance`/`mismatch_hints_ko`, question↔step 연결 방식 확정

## 교사 몽키에게 줄 6줄 요약
1. 07편 축소 설정(batch 12~32, 2000~5000스텝)은 맥 MPS로 1~3분이면 끝나요. 원본 설정도 약 1시간이라 선택 과제로 둘 수 있어요.
2. 10편 축소 설정은 한 스텝 3.6초라 "수천 스텝"은 2시간이 넘어요. 500스텝(30분) 또는 한 스텝 토큰 절반으로 1000스텝(약 30분)을 추천해요. 파라미터는 임베딩 빼고 1,060만, 포함 3,000만이에요.
3. MPS 한 배치 과적합 멈춤(#92)은 torch 2.15에서 재현 안 됐어요. CPU와 MPS 모두 0.001대까지 내려가요.
4. 맥 MPS에서 bf16·fp16 autocast는 오류 없이 돌지만 빨라지지 않고, compile은 약 8%, fused AdamW는 약 4% 빨라져요. Colab 쪽은 실측 아니에요.
5. FineWeb-Edu 1천만 토큰은 문서 약 9,450개, 텍스트 약 46MB예요. parquet 한 파일(2.15GB) 대신 필요한 만큼만 받는 방법을 권해요.
6. 02편은 같은 시드여도 바이그램 이름 샘플이 영상과 달라요(첫 글자 'c', 원본 'm'). 정답 대조는 이름 글자가 아니라 확률 표와 손실 범위로 해 주세요. graphviz draw_dot은 맥에서 동작 확인했어요.
