# Z2H 디자인 → CTO 인계

작성: 디자이너 몽키 · 2026-11-16 KST (v1.2: 19:43 임베드, 19:52 CEO 답, 19:53 교사 몽키 pedagogy v1 반영 · v1.3: 20:07 교사 C1~C10 답 · v2: 20:06 얼큰이 지시 t833u, 일반 사용자 제품). 코딩은 CTO 쪽, 이 폴더는 디자인 원본이다. 목업의 진도 숫자는 예시이고, 단계·코드·문제·영상 시각은 pedagogy/ v1에서 옮겼다.

## 1. 폴더 안내
| 파일 | 내용 |
|---|---|
| `flow.md` | 학습 흐름 mermaid, 화면 목록, 전환 규칙 |
| `tokens.json` | 디자인 토큰 원본 (색, 대비, 글꼴, 글자 크기, 간격, 모서리, 분기점) |
| `tokens.md` | 토큰 설명, WCAG 대비표, 글꼴 파일 목록 |
| `spec.md` | 화면별 컴포넌트, 상태, 문구, 모바일/데스크톱 차이, 접근성 |
| `decisions.md` | 결정 D1~D39와 이유, 해결된 질문(Q1~Q8, C1~C10), 남은 질문과 충돌 X1~X8 |
| `mockups/src/*.html` + `z2h.css` | 목업 HTML. 반응형 하나로 390/1280 둘 다 그림. 구조 참고용 (운영 코드로 그대로 쓰지 말 것) |
| `mockups/png/*_{m390,d1280}.png` | 화면 19종 × 2폭 = 38장 (2배 해상도): v1 `s1~s10`, v1.3 누적 점검 `c1~c4`, v2 `v2_*` |
| `mockups/png/card_*.png` | 공유 카드 예시 3장, 1200x675 실제 크기 |
| `mockups/src/gen.py`, `gen_v2.py`, `render.py`, `fontscan.py`, `contact*.py` | 목업 생성·촬영·글꼴 검사·모음 스크립트 |
| `contact_sheet.png` | v1 화면 10종 한 장 요약 (v1.3 반영) |
| `contact_sheet_v1.3.png` | 누적 점검 4화면 + 고르기 문항 + 모르겠어요 + 자동으로 건너뛰지 않음 |
| `contact_sheet_v2.png` | v2 화면 5종 + 공유 카드 3장만 |
| `mockups/font_check.json`, `font_scan.json` | 글꼴 실제 로딩 검사 결과 |

## 2. 만들 순서 (권장)
1. **토큰 + 기본 틀**: `tokens.json` → CSS 변수, Pretendard·JetBrains Mono 자체 호스팅, 상단 바(동기화 표시 포함)·하단 탭·카드·버튼·다음 줄·결과 상자.
1-1. **계정 + 진도 저장 (서버 DB) + 동기화 표시** (`spec.md` 0.6·13.3, 아래 6-1절·7-1절. D17과 충돌 X2 먼저 확정).
2. **4 따라 하기 실습** (대표 화면, 가장 위험): 세 칸 머리, 예측 먼저, 코드 줄·풀이 2단/1단 전환, 복사, 실행 장소 칩, `expected_check` 3유형, 에러 읽기 도우미 (`spec.md` 4절).
3. **영상 플레이어 컴포넌트** (`spec.md` 0.5): youtube-nocookie 임베드, start/end, 한국어 자막, 자동 재생 없음, 접기, 불러오는 중·오류·구간 준비 중·대체 링크.
4. **3 강의 구간**, **6 힌트 사다리** (4단계 + 도움 요청, 열림 조건, 점수 문구).
5. **5 확인 문제** (4유형, 4채점 방식, 제출 뒤 풀이, 채점 기준 체크 목록, 힌트 점수 비율).
6. **1 홈·진도** (실습 시간 자동 + 수정), **2 강의 개요**, **10 강연 편 단계** (정리 카드, 선택 실습 건너뛰기).
7. **7 복습** (1·3·7·14·30·60, 통과/흔들림/놓침, 25분 상한), **8 사전 기초** (진단 추천).
8. **9 빈·불러오는 중·오류·동기화** 상태 전부.
9. **누적 점검** CP 안내·문항·손 과제·결과 (`spec.md` 12절). 핵심 재구성 과제·익힘 판정 화면은 아직 디자인 대기.
10. **v2**: 랜딩 → 30분 맛보기(브라우저 실행, X1 확인 뒤) → 가입·로그인 → 배지·공유 카드 (`spec.md` 13절). 공개 배포 전 얼큰이 승인 필요 (BRIEF).

01 micrograd 한 편을 처음부터 끝까지 돌릴 수 있게 만든 뒤 나머지 편으로 넓히는 것을 권장한다.

## 3. 토큰 쓰는 법
- `tokens.json`의 `color.*.*.value`를 같은 이름의 CSS 변수로: `--paper`, `--paper-raised`, `--paper-sunken`, `--ink`, `--ink-muted`, `--line`, `--line-strong`, `--accent`, `--accent-tint`, `--on-accent`, `--correct`, `--correct-tint`, `--retry`, `--retry-tint`, `--code-*`.
- 컴포넌트에서 hex를 직접 쓰지 않는다. 새 색이 필요하면 디자이너에게 요청.
- `type.*`는 모바일 값. 1024 이상에서 `title-1` 26, `title-2` 21, `title-3` 18, 본문 17, 코드 14 (`tokens.md` 5절).
- 숫자 표시 요소에 `font-variant-numeric: tabular-nums`. 코드에 `font-variant-ligatures: none`.
- 한국어 문장에 `word-break: keep-all`.

## 4. 글꼴 (반드시 확인)
- Pretendard 1.3.9 `woff2` 4개: Regular 400, Medium 500, SemiBold 600, Bold 700. **굵기마다 다른 파일을 `@font-face`로 연결.**
- JetBrains Mono 가변 woff2 1개 (`font-weight: 100 800`), 400·600만 사용.
- 배포 뒤 확인: 브라우저 콘솔에서 `[...document.fonts].map(f=>f.family+' '+f.weight+' '+f.status)`가 모두 `loaded`인지. 시스템에 Pretendard가 깔린 맥에서는 스크린샷만 보고 판단하면 안 된다 (CDN이나 파일 경로가 빠져도 정상처럼 보임).
- `button`, `input`, `textarea`, `code`는 글꼴을 상속하지 않는 브라우저 기본값이 있으니 `font-family: inherit` 또는 `var(--font-code)`를 명시. (목업에서 이것 때문에 DejaVu Sans Mono로 그려진 곳이 있었고 고쳤다.)
- 아이콘은 인라인 SVG (Pretendard에 ✕, ▾ 등 글리프 없음).

## 5. 영상 임베드 (2026-11-16 19:43 얼큰이님 결정)
```html
<iframe
  src="https://www.youtube-nocookie.com/embed/VMj-3S1tku0?start=1149&end=1930&rel=0&playsinline=1&cc_load_policy=1&cc_lang_pref=ko"
  title="영상 19:09–32:10: Value 클래스 뼈대"
  loading="lazy"
  allow="encrypted-media; picture-in-picture; fullscreen"
  referrerpolicy="strict-origin-when-cross-origin"
  style="aspect-ratio:16/9;width:100%;border:0"></iframe>
```
- `autoplay` 매개변수와 `allow="autoplay"`를 넣지 않는다. IFrame API를 써도 `playVideo()`를 자동 호출하지 않는다.
- 대체 링크: `https://www.youtube.com/watch?v={videoId}&t={start}s`, 새 창. 늘 보이게 둔다 (오류 상태에서는 큰 버튼으로 바뀜).
- 오류 판정: 10초 안에 로드 없음, 또는 IFrame API `onError`. 
- 시각은 단계 데이터 `video_segments: [{start_s, end_s}]` (초 단위 배열, D38)에서 읽는다. 19:09–32:10은 L01-S04~S06이 함께 쓰는 공식 챕터 구간 (pedagogy/01, research 출처), 영상 id는 data-spec 예시의 `VMj-3S1tku0`.
- **구간 공유 (D38, 교사 C8 답)**: 같은 편 여러 단계가 같은 `{start_s, end_s}`를 가질 수 있다. 같은 구간이면 플레이어를 다시 만들지 말고 재생 위치를 유지하며 "이 구간은 단계 4~6이 함께 씁니다"를 보인다 (같은 구간을 쓰는 연속 단계 범위를 계산).
- 한 단계에 구간이 여럿이면 구간 버튼 줄을 두고, 누르면 `start`/`end`만 바꿔 다시 불러온다 (IFrame API `loadVideoById({videoId,startSeconds,endSeconds})`, 자동 재생이 되지 않게 `cueVideoById` 권장).
- `end_s`가 없으면 **같은 편 다음 단계의 `start_s`**를 끝으로 쓴다 (마지막 단계면 영상 끝). data-spec 49행은 "null = 영상 끝까지"라 적혀 있어 교사에게 문구 확인 요청 중 (decisions X6). 배열이 비면 "구간 준비 중" + 영상 처음 링크.
- 자막: `cc_load_policy=1&cc_lang_pref=ko`. 자동 번역 한국어 자막은 YouTube가 주지 않을 수 있다 (영상·지역·시점마다 다름). 그때는 영어 자막 또는 자막 없이 재생되고, 화면 안내 문구와 세 줄 요약이 대신한다. 앱이 자막을 따로 만들거나 올리지 않는다.
- 영상 파일을 내려받거나 다시 올리지 않는다.

## 6. data-spec 필드 → 화면 대응 (pedagogy/data-spec.md 기준)

| data-spec 필드 | 화면·구역 | 표시 |
|---|---|---|
| `lecture.lecture_id`, `title_ko` | 1 홈 강의 행, 2 개요 제목 | "01 micrograd", 제목 |
| `lecture.video_minutes` | 1 홈 행, 2 개요 머리 | "영상 2:26" |
| `lecture.prereq_units` | 1 홈 기초 카드, 2 개요 추천 줄 | "먼저 보면 좋은 기초: F-P6 …" |
| `lecture.objectives` | 2 개요 (펼침, 목업 없음) | 학습 목표 목록 |
| `step.step_id`, `order` | 2 목록 번호, 3·4 위치 줄, 노트북 칸 이름 | "단계 4 / 16 · L01-S04" (분모 = 그 편 step 수) |
| `step.title_ko` | 2 목록, 3·4 제목 | |
| `step.video_segment.start/end` | 0.5 플레이어 | 임베드 start·end, "영상 19:09–32:10" |
| `step.kind` | 4 (code) / 10 (read, reflect) / 10 선택 카드 (optional) | |
| `step.input_ko` | 4 세 칸 1 | 입력할 것 |
| `step.code` + `code_line_notes_ko` | 4 코드 블록 2단/1단 | 줄 수가 같아야 함 (검수 규칙 1) |
| `step.expected_ko` | 4 세 칸 2, 예상 출력 상자 | 예측 전에는 가림 |
| `step.expected_check.type` | 4.3 결과 확인 | output_match 붙여넣기 비교 / value_range 숫자 / manual 같아요·달라요 |
| `step.meaning_ko` | 4 세 칸 3, "3 · 그 뜻" 카드, 2 목록 한 줄 요약 | |
| `step.hint_ids` → `hint.level`, `text_ko`, `code_with_blanks`, `unlock` | 6 사다리 | 1~4 + 5(HELP). 잠금 글자는 `unlock`에서 |
| `question.type` | 5 유형 배지·답 칸 | predict 결과 예측 / explain 내 말로 설명 / fix_bug 버그 고치기 / apply 적용하기 |
| `question.prompt_ko`, `code` | 5 질문 | |
| `question.auto_grade.type` | 5 채점 | exact, numeric_range, keywords, manual |
| `question.answer_ko` | 5 결과 상자 (제출 뒤) | 정답·모범 설명 |
| `question.rubric[]` | 5 채점 기준 체크 목록 | 항목 + "0.5점" |
| `question.max_points`, `question_attempt.points_awarded`, `score_ratio` | 5 점수 줄 | "점수 0.5 / 1 · 힌트 2단계 · 80%로 계산" |
| `question_attempt.max_hint_level` | 5·6 기록 | "이 문제 힌트: 2 / 4" |
| `step_progress.status` | 2 목록 상태, 1 홈 진도 | not_started ○ 아직 / in_progress ● 지금 / done ✓ 완료 / skipped_optional 건너뜀 (선택) |
| `step_progress.max_hint_level` | 4 "이 단계 힌트 사용" | 점수 없음 |
| `mastery_state.state` | 1 홈 강의 행 배지 | locked 잠김 / open / in_progress 진행 중 / almost 거의 익힘 / mastered 익힘 / revisit 다시 보기 (배지 글은 다음 작업에서 확정) |
| `review_card.kind`, `interval_days`, `due_at`, `last_result` | 7 복습 카드·목록·간격 줄 | 개념/예측/손, "지금 간격 3일", 통과·흔들림·놓침 |
| `checkpoint_attempt` | 1 홈 점선 줄 (CP1~3) | 점검 화면은 다음 작업 |
| `help_note` | 6 도움 요청 메모 | 이 화면에만 저장, 보내기 없음 |
| `rebuild_task`, `rebuild_attempt` | 2 개요 편 끝 카드 | 화면은 다음 작업 |

data-spec에 없어서 디자인이 추가로 바라는 필드 (교사 몽키·CTO 확인 필요):
- `step.summary_ko[3]` (구간 세 줄 요약), `step.concept_ko {term, plain}` (단계의 새 개념 1개)
- `step.mismatch_hints_ko[]` (비교 결과 ✕일 때 "볼 곳" 한 줄)
- `step.prediction_text` 저장용 `step_progress.prediction` (예측 먼저)
- `card.est_minutes` (복습 예상 분, 없으면 종류별 기본값)
- 시간 기록 `practice_time {week, auto_seconds, edited_seconds, edited_at}` (D18)

### 6-1. 진도 저장과 동기화 (D17 → v2에서 바뀜)
- **[충돌 X2, CTO·CEO 확인 필요]** D17은 "맥미니 서버, 1인"이었다. v2(D28·D33)는 일반 사용자, 계정, 서버 DB다. 저장소·인증·개인정보 처리 주체·백업이 모두 바뀌고, 일반 사용자 공개는 BRIEF의 "공개 배포 = 얼큰이 승인" 항목이다. 아래 동기화 규칙(대기열, 3상태, 재시도)은 서버 DB에서도 그대로 쓴다.
- (v1 기준) 저장 위치는 맥미니 서버. 휴대폰과 맥이 같은 기록을 본다. 로그인·주소 노출 방식은 CTO가 정한다 (공개 배포는 별도 승인).
- 모든 쓰기는 먼저 기기 대기열(IndexedDB 등)에 넣고 서버로 보낸다. 성공하면 "✓ 저장됨", 1초 넘게 걸리면 "↻ 동기화 중", 실패하면 "✕ 오프라인" + "지금 다시 시도". 재시도 간격 30초, 1분, 5분, 연결 복구 즉시.
- 시각은 모두 `+09:00` 저장 (data-spec 검수 규칙 5). 충돌하면 나중 시각 우선, `question_attempt`·`review_card.history`처럼 쌓이는 기록은 합친다.

### 6-2. 실습 시간 (D18)
- 자동: 실습·구간·문제·복습 화면이 보이는 상태(`document.visibilityState === "visible"`)이고 마지막 입력(스크롤, 키, 탭)이 5분 안일 때만 1초씩 셈.
- 수정: 홈 시간 카드 "수정" → 시간·분 입력. 저장하면 `edited_seconds`를 쓰고 화면에 "수정됨 · 자동 2:25". "자동 기록으로 되돌리기"는 `edited_seconds`를 비움.

## 7. 새 data-spec 필드 쓰는 곳 (v1.3)
- `long_step: true` → 실습 제목 "(긴 단계)" 배지 + 위 띠 문구, 새 코드 최대 10줄 (D34, spec 4.2).
- `type: "choice"`, `choices`, `answer_index` → 고르기 카드 (spec 5절). "모르겠어요" 보기는 감점 없이 오답 기록, 추천에만.
- `step_progress.prediction` 빈 값 + "모르겠어요" → 예측 없이 공개. 예측은 점수·진행에 쓰지 않는다 (D39).
- 누적 점검: 점수 = 문항별 힌트 비율 적용 합 / 문항 수, 80% 이상 통과, 힌트 H2 상한 (H3 버튼 자체를 숨김), 아직이면 놓친 편 `review_card.interval_days = 1` + `checkpoint.retry_at = 오늘 + 3일` (spec 12절).

## 7-1. v2 구현 메모
- **가입·로그인 (D33)**: Google OAuth + 이메일 일회용 코드(6자리, 10분, 5회) + 같은 메일 속 매직 링크. 비밀번호 저장 없음. 동의 기록(약관 버전, 시각 `+09:00`, 만 14세 확인)을 계정에 남긴다.
- **맛보기 (D30)**: 가입 전 진도는 브라우저(IndexedDB) `taste_progress` 로, 가입·로그인 순간 서버 계정의 L01 진도로 합친다. 서버에 이미 L01 진도가 있으면 더 앞선 쪽을 남긴다.
- **브라우저 실행 (X1)**: Pyodide 같은 브라우저 파이썬을 가정했다. 첫 로딩 크기·시간, 휴대폰 동작, 맛보기용 Value 준비 코드 숨김 셀 방식을 확인 바란다. 안 되면 맛보기 전체를 "Colab에서 열기 + 붙여넣기 비교"로 바꾸면 되도록 화면을 짰다.
- **공유 카드 (D32)**: 카드 PNG는 서버 또는 브라우저 캔버스에서 1200x675로 그린다 (목업 `card_*.html`이 배치 원본). 출력은 사용자가 실습에서 붙여 넣은 실제 결과만 쓴다. "X에 공유"는 `https://x.com/intent/post?text=…`를 새 창으로 열 뿐, 자동 게시 API를 쓰지 않는다. intent는 이미지 첨부가 안 되므로 X4 결정 전까지 "이미지 저장 후 직접 첨부" 안내.

## 8. 열린 질문·충돌 (CTO 관련, 전체는 decisions.md "남은 질문과 충돌")
- X1 맛보기 브라우저 실행 가능 여부 (Pyodide 등).
- X2 D17 맥미니 1인 저장 ↔ v2 계정·서버 DB (CTO·CEO 확인, 공개 배포는 얼큰이 승인).
- X3 X 로그인 여부. X4 공유 카드 이미지 첨부 방식. X8 맛보기 보관 7일·코드 10분·재전송 60초 값.
- C2·C4는 교사 동의로 닫힘: 주석 없는 코드 + 옆 칸 풀이, 앱 안 "비교하기"·"제출" = 시도 1회.
- 비교 기능 숫자 허용 오차 기본값 (상대 1e-4 제안).

## 9. 검수 요청
구현 화면이 나오면 디자이너가 390/1280에서 목업과 비교하고, 글꼴 로딩(`document.fonts` + 굵기별 파일), 44px, 대비, em dash 여부를 다시 검사한다.
