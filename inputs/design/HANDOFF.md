# Z2H 디자인 → CTO 인계

작성: 디자이너 몽키 · 2026-11-16 KST (v1.2: 19:43 임베드, 19:52 CEO 답, 19:53 교사 몽키 pedagogy v1 반영 · v1.3: 20:07 교사 C1~C10 답 · v2: 20:06 얼큰이 지시 t833u, 일반 사용자 제품 · 20:18 pedagogy v1.1, VALUE_CURRICULUM, video-segments.json v1.1 반영). 코딩은 CTO 쪽, 이 폴더는 디자인 원본이다. 목업의 진도 숫자는 예시이고, 단계·코드·문제·영상 시각은 pedagogy/ v1에서 옮겼다.

## 1. 폴더 안내
| 파일 | 내용 |
|---|---|
| `flow.md` | 학습 흐름 mermaid, 화면 목록, 전환 규칙 |
| `tokens.json` | 디자인 토큰 원본 (색, 대비, 글꼴, 글자 크기, 간격, 모서리, 분기점) |
| `tokens.md` | 토큰 설명, WCAG 대비표, 글꼴 파일 목록 |
| `spec.md` | 화면별 컴포넌트, 상태, 문구, 모바일/데스크톱 차이, 접근성 |
| `decisions.md` | 결정 D1~D57과 이유, 해결된 질문(Q1~Q8, C1~C10, X2·X3·X6·X9~X16), 남은 질문 X4·X5·X8 |
| `mockups/src/*.html` + `z2h.css` | 목업 HTML. 반응형 하나로 390/1280 둘 다 그림. 구조 참고용 (운영 코드로 그대로 쓰지 말 것) |
| `mockups/png/*_{m390,d1280}.png` | 화면 23종 × 2폭 = 46장 (2배 해상도): v1 `s1~s10`, v1.3 `c1~c4` 누적 점검 + `c5_prepared` 준비된 코드 + `c6_segments` 구간 전환·영상 없음, v2 `v2_*` (다리 카드 `v2_bridge` 포함), `c7_edits` 바뀐 줄만 |
| `mockups/png/card_*.png` | 공유 카드 예시 3장 (`card_names`, `card_wavenet`, `card_gpt`), 1200x675 실제 크기 |
| `mockups/src/gen.py`, `gen_v2.py`, `render.py`, `fontscan.py`, `contact*.py` | 목업 생성·촬영·글꼴 검사·모음 스크립트 |
| `contact_sheet.png` | v1 화면 10종 한 장 요약 (v1.3 반영) |
| `contact_sheet_v1.3.png` | 누적 점검 4화면 + 준비된 코드 + 구간 전환·영상 없음 + 01편 26단계 목록 + 고르기 문항 + 모르겠어요 + 자동으로 건너뛰지 않음 |
| `contact_sheet_v2.png` | v2 화면 5종 + 공유 카드 3장만 |
| `mockups/font_check.json`, `font_scan.json` | 글꼴 실제 로딩 검사 결과 |

## 2. 만들 순서 (권장)
1. **토큰 + 기본 틀**: `tokens.json` → CSS 변수, Pretendard·JetBrains Mono 자체 호스팅, 상단 바(동기화 표시 포함)·하단 탭·카드·버튼·다음 줄·결과 상자.
1-1. **계정 + 진도 저장 (시제품: 맥미니, 계정별 데이터 구조) + 동기화 표시** (`spec.md` 0.6·13.3, 아래 6-1절·7-1절, D43).
2. **4 따라 하기 실습** (대표 화면, 가장 위험): 세 칸 머리, 예측 먼저, 코드 줄·풀이 2단/1단 전환, 복사, 실행 장소 칩, `expected_check` 3유형, 에러 읽기 도우미 (`spec.md` 4절).
3. **영상 플레이어 컴포넌트** (`spec.md` 0.5): youtube-nocookie 임베드, start/end, 한국어 자막, 자동 재생 없음, 접기, 불러오는 중·오류·구간 준비 중·대체 링크.
4. **3 강의 구간**, **6 힌트 사다리** (4단계 + 도움 요청, 열림 조건, 점수 문구).
5. **5 확인 문제** (4유형, 4채점 방식, 제출 뒤 풀이, 채점 기준 체크 목록, 힌트 점수 비율).
6. **1 홈·진도** (실습 시간 자동 + 수정), **2 강의 개요**, **10 강연 편 단계** (정리 카드, 선택 실습 건너뛰기).
7. **7 복습** (1·3·7·14·30·60, 통과/흔들림/놓침, 25분 상한), **8 사전 기초** (진단 추천).
8. **9 빈·불러오는 중·오류·동기화** 상태 전부.
9. **누적 점검** CP 안내·문항·손 과제·결과 (`spec.md` 12절). 핵심 재구성 과제·익힘 판정 화면은 아직 디자인 대기.
10. **v2**: 랜딩 → 30분 맛보기(Colab 8단계, 준비된 코드) → 가입·로그인 → 배지·공유 카드 (`spec.md` 13절). 공개 배포 전 얼큰이 승인 필요 (BRIEF).

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
- 시각은 `pedagogy/video-segments.json` v1.2 (169단계) `steps[step_id]`의 `video_segments: [{start_s, end_s}]`와 `shared_with`에서 읽는다 (D38). 169단계 모두 들어 있다. 19:09–32:10은 L01-S04~S06이 함께 쓰는 공식 챕터 구간 (pedagogy/01, research 출처), 영상 id는 data-spec 예시의 `VMj-3S1tku0`.
- **구간 공유 `shared_with`**: 값이 있으면 그 단계들 사이에서 플레이어 인스턴스를 유지하고 재생 위치를 이어 간다. 문구 "이 구간은 단계 4~6이 함께 씁니다" (자기 + `shared_with` 단계 번호 범위). 쪼갠 단계(L01-S14b)는 원래 단계 구간을 그대로 쓴다.
- **구간이 여럿** (48단계, L02-S12·L10-S18은 3개, L08-S02는 5개): 칩 줄 "구간 1/3 · 1:10:01" + "다음 구간". 바꿀 때 `cueVideoById({videoId, startSeconds, endSeconds})` (재생하지 않고 준비만). 구간 순서는 배열 순서 그대로 (L08-S02처럼 시각이 앞뒤로 오갈 수 있음).
- **영상 없음** `video_segments: []` (L08-S01·S04·S08, 맛보기 T-S01~T-S08, D53): 플레이어 iframe을 만들지 않는다. `novid` 한 줄만 (D40, D49 확정: 빈 목록 = 영상 없는 단계).
- `end_s`는 늘 채워져 온다 (D49, 교사 20:34). 값을 그대로 쓴다.
- 자막: `cc_load_policy=1&cc_lang_pref=ko`. 자동 번역 한국어 자막은 YouTube가 주지 않을 수 있다 (영상·지역·시점마다 다름). 그때는 영어 자막 또는 자막 없이 재생되고, 화면 안내 문구와 세 줄 요약이 대신한다. 앱이 자막을 따로 만들거나 올리지 않는다.
- 영상 파일을 내려받거나 다시 올리지 않는다.

## 6. data-spec 필드 → 화면 대응 (pedagogy/data-spec.md 기준)

| data-spec 필드 | 화면·구역 | 표시 |
|---|---|---|
| `lecture.lecture_id`, `title_ko` | 1 홈 강의 행, 2 개요 제목 | "01 micrograd", 제목 |
| `lecture.video_minutes` | 1 홈 행, 2 개요 머리 | "영상 2:26" |
| `lecture.prereq_units` | 1 홈 기초 카드, 2 개요 추천 줄 | "먼저 보면 좋은 기초: F-P6 …" |
| `lecture.objectives` | 2 개요 (펼침, 목업 없음) | 학습 목표 목록 |
| `step.step_id`, `order` | 2 목록 번호, 3·4 위치 줄, 노트북 칸 이름 | "단계 4 / 26 · L01-S04" (분모 = 그 편 step 수, v1.2 합 169) |
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

### 6-1. 진도 저장과 동기화 (D17 → D43, CEO 정리(얼큰이 t833u 기준), 20:34)
- **시제품**: 데이터는 맥미니에 저장한다. 단, 처음부터 **계정별 데이터 구조**로 만든다 (모든 진도·시도·복습·배지 기록에 계정 id, 계정 사이 섞임 없음, 계정 단위로 내보내기·지우기 가능). 그래야 공개 때 저장소만 옮기면 된다.
- **공개 출시 때**: 공개 서버 DB와 그 위치는 CTO가 제안하고 얼큰이님이 승인해 정한다. 공개 배포 자체도 승인 항목이다.
- 화면 변경 없음. 동기화 표시 3상태(저장됨 / 동기화 중 / 오프라인)와 아래 규칙은 그대로 쓴다. 휴대폰과 맥이 같은 계정 기록을 본다.
- 모든 쓰기는 먼저 기기 대기열(IndexedDB 등)에 넣고 서버로 보낸다. 성공하면 "✓ 저장됨", 1초 넘게 걸리면 "↻ 동기화 중", 실패하면 "✕ 오프라인" + "지금 다시 시도". 재시도 간격 30초, 1분, 5분, 연결 복구 즉시.
- 시각은 모두 `+09:00` 저장 (data-spec 검수 규칙 5). 충돌하면 나중 시각 우선, `question_attempt`·`review_card.history`처럼 쌓이는 기록은 합친다.

### 6-2. 실습 시간 (D18)
- 자동: 실습·구간·문제·복습 화면이 보이는 상태(`document.visibilityState === "visible"`)이고 마지막 입력(스크롤, 키, 탭)이 5분 안일 때만 1초씩 셈.
- 수정: 홈 시간 카드 "수정" → 시간·분 입력. 저장하면 `edited_seconds`를 쓰고 화면에 "수정됨 · 자동 2:25". "자동 기록으로 되돌리기"는 `edited_seconds`를 비움.

## 7. 새 data-spec 필드 쓰는 곳 (v1.3, pedagogy v1.1)
- `prepared_code` (null 아니면): 새 코드 블록 위에 "준비된 코드 · 붙여넣기만" 블록 (점선 테두리, 접힌 줄별 풀이, 복사). 예측 칸·결과 비교·시도 세기·문제 연결 없음 (D41, spec 4.2, 목업 `c5_prepared`). `new_code_lines`는 준비 코드를 빼고 센다.
- `long_step: true` → 실습 제목 "(긴 단계)" 배지 + 위 띠 문구, 새 코드 최대 10줄 (D34, spec 4.2).
- `type: "choice"`, `choices`, `answer_index` → 고르기 카드 (spec 5절). "모르겠어요" 보기는 감점 없이 오답 기록, 추천에만.
- `step_progress.prediction` 빈 값 + "모르겠어요" → 예측 없이 공개. 예측은 점수·진행에 쓰지 않는다 (D39).
- 누적 점검: data-spec `checkpoint` 그대로 (`covers`, `unlocks_lecture`, `items`, `question_ids`, `pass_ratio` 0.8, `max_hint_level` 2, `time_limit_min` null, `hand_task_format`, `fail_action`) + `checkpoint_attempt`. 문항 합 40 (CP1 11, CP2 13, CP3 16). 점수 = 문항별 힌트 비율 적용 합 / 문항 수. H3 이상 버튼은 숨김. 아직이면 `fail_action`대로 놓친 편 카드 1일, 재도전은 마지막 시도 + 3일 (재도전 시각 필드는 data-spec에 없음, `checkpoint_attempt.at` + `retry_after_days`로 계산). 통과는 단계 배지 조건의 일부, 단독 배지 없음 (spec 12절).

## 7-2. data-spec v1.2 새 칸 (교사 20:43, D50~D55)
| 칸 | 화면 | 처리 |
|---|---|---|
| `edits[]` (`target_step`, `where_ko`, `action` insert/replace, `anchor_line`, `line_count`) | 4.2-1 바뀐 줄만 (`c7_edits`) | 비었으면 새 셀, 있으면 바뀐 줄 화면. `code` 앞쪽 줄을 `edits` 순서·`line_count`로 나눔. `anchor_line` null = 셀 맨 아래. `cell_mode`·`changed_lines_only`는 없음 |
| `rerun_first` | 4.2-1 위 안내 | "먼저 다시 실행: L01-S04 셀" + 링크 |
| `moved_code_lines` | 4.2 새 코드 블록 | 옮겨 붙이는 줄에 꼬리표 "앞 단계에서 옮김", 새 코드 줄 수에 넣지 않음 |
| `prepared_code_line_notes_ko`, `prepared_code_source_ko` | 4.2 준비된 코드 블록 | 줄별 풀이(접기), 출처 한 줄 `caption` |
| `kind: copy_run`, `expected_output_example`, `aha_ko`, `code_alt_local` | 13.2 맛보기 | 붙여넣기만, 실제 출력, 깨달음, "Colab 밖에서 하려면" 접힌 대체 셀 |
| 문항 `after_step`, `scored` | 5절, 13.2 | `scored: false`면 제출 단추 없이 고르면 바로 풀이, 점수·복습 없음 |
| 힌트 `show_solution` | 6절 H4 | 정답 코드 + 줄별 풀이 펼침 |
| 편 `rewards` (`stamp`, `badge_progress`, `artifact`) | 13.4 | 편 도장, 배지 진행 줄, 공유 결과물 단추 |
| 학습자 `path_id` (full / office_worker / investor) | 13.4 띠, 13.6, 12.5 | 길 띠·다리 카드 표시·점검 문항 계산. "전체 길로 바꾸기"는 `path_id`를 full로 바꾸고 기록은 그대로 |
| `checkpoint.path_variants[]` (`path_id`, `taken`, `replace[{from,to}]`, `remove_if_lecture_not_mastered`, `pass_ratio`, `badge_on_pass`, `gate`) | 12.5 | 문항 목록 = 원 목록에서 replace·remove 적용(그 편을 mastered면 빼지 않음). `taken: false`(CP2)면 `gate {cards, must_correct, unlocks_lecture: L07}` |
| 배지 변형 | 13.4 | 요약 경로 배지는 `badge_on_pass` id(예 `BADGE-S1-SUMMARY`)로 구분. 요약 경로 표시가 붙은 배지와 "AI 속 들여다보기 수료"는 다른 모양 (spec 13.4). 전체 배지를 받으면 요약 표시를 바꿈 |
| 다리 카드 질문 id `B03-1-Q1` | 13.6 | bridge-cards-03-04.md. 관문 질문 정답 여부만 기록(점수 없음) |

## 7-1. v2 구현 메모
- **가입·로그인 (D33)**: Google OAuth + 이메일 일회용 코드(6자리, 10분, 5회) + 같은 메일 속 매직 링크. 비밀번호 저장 없음. 동의 기록(약관 버전, 시각 `+09:00`, 만 14세 확인)을 계정에 남긴다.
- **맛보기 (D30)**: VALUE_CURRICULUM 3절의 8단계 Colab 흐름. 앱은 Colab 맛보기 노트북 링크(T1)와 셀별 준비된 코드·풀이·보이는 것·깨달음을 보여 주고, 사용자는 "비슷해요 / 달라요"를 누른다. 가입 전 기록은 브라우저(IndexedDB) `taste_progress`, 가입·로그인 때 계정으로 옮긴다. 결과(손실, 이름 10개)는 사용자가 붙여 넣은 글만 쓴다. 앱은 Colab을 읽지 못하므로 단계 완료는 자기 확인 "직접 확인했어요" (D54). 맛보기 확인 질문 3개는 `scored: false`. 맛보기 Colab 노트북 파일을 어디에 둘지(공개 GitHub 또는 Drive 공유 링크)는 CTO가 정한다 (공개 = 승인 사항일 수 있음).
- **다리 카드 03·04 (D48 → D50·D55, 원본 10장)**: 사용자가 고른 길이 회사원 또는 투자자일 때만, 02편을 마친 뒤 07편을 열기 전에 다리 카드 2장(03 임베딩, 04 정규화)을 보인다. 입문 개발자 길에는 없다. 데이터 원본 `pedagogy/bridge-cards-03-04.md` (작성 중). 카드 필드 제안: `bridge_id`, `lecture_id`, `title_ko`, `body_ko`(한 문단), `figure_ko` 또는 `mini_practice`, `questions`(1~2개, `type: "choice"`, 점수 없음), `video_segments`(03·04편 구간). 요약 경로 순서 (D57): 01편 → 02편 → 03편 다리 카드 6장 → CP1(요약) → 04편 다리 카드 4장(07편 관문) → 07편 → 그 길의 남은 편 (길별 선택, VALUE_CURRICULUM 4-1·4-2) → CP3(요약, 줄인 판). 07편 뒤 편을 코드에 고정하지 말고 학습자 길(`path_id`)의 편 목록과 선택 편 익힘 여부에서 계산한다. 03편 카드 질문 B03-1-Q1·Q2는 CP1(요약) 문항으로 쓰고, 04편 카드 질문 4개는 07편 관문(`gate.must_correct`)이다. 화면 `spec.md` 13.6, 목업 `v2_bridge`.
- **브라우저 안 실행**: 쓰지 않음 (X1 닫힘). 맛보기에 torch가 필요하고 Colab이 "설치 없음"을 충족.
- **공유 카드 (D32)**: 카드 PNG는 서버 또는 브라우저 캔버스에서 1200x675로 그린다 (목업 `card_*.html`이 배치 원본). 출력은 사용자가 실습에서 붙여 넣은 실제 결과만 쓴다. 출처 줄 "Andrej Karpathy의 공개 강의를 따라 만든 결과 (비공식)" 고정, 이름 카드는 실제 이름 안내 줄 추가. "글 복사"는 클립보드에 사실 문장만. "X에 공유"는 `https://x.com/intent/post?text=…`를 새 창으로 열 뿐, 자동 게시 API를 쓰지 않는다. intent는 이미지 첨부가 안 되므로 버튼 바로 아래에 "저장한 이미지를 첨부해 주세요"를 늘 보인다 (D45, `aria-describedby`). 맛보기 이름 카드와 정리 화면에는 "첫 모델이라 아직 서툴러요" 한 줄. X 로그인은 만들지 않는다 (D44).

## 8. 열린 질문·충돌 (CTO 관련, 전체는 decisions.md "남은 질문과 충돌")
- X1 닫힘: 맛보기는 Colab (브라우저 안 실행 안 씀).
- 20:34 닫힘: X2 저장(D43), X3 X 로그인 안 함(D44), X6 빈 구간 = 영상 없음·`end_s` 늘 채움(D49), X9 X에 공유 유지 + 첨부 안내(D45), X10 CP 통과 = 단계 배지(D47), X11 다리 카드(D48), X12 랜딩·약관·개인정보 문구는 공개 전 승인 항목(D46).
- 20:43 닫힘: X13 단계 수 169·새 칸 (D51·D52), X14 요약 경로 점검·배지 (D50).
- 20:55 닫힘: X15 이름 카드 1200 × 675 유지 (D56), X16 요약 경로 순서 (D57).
- 남음: X4 공유 카드 이미지 첨부 방식(기본안: 이미지 저장 뒤 직접 첨부). X5 동의·약관 법적 검토. X8 맛보기 보관 7일·코드 10분·재전송 60초 값.
- C2·C4는 교사 동의로 닫힘: 주석 없는 코드 + 옆 칸 풀이, 앱 안 "비교하기"·"제출" = 시도 1회.
- 비교 기능 숫자 허용 오차 기본값 (상대 1e-4 제안).

## 9. 검수 요청
구현 화면이 나오면 디자이너가 390/1280에서 목업과 비교하고, 글꼴 로딩(`document.fonts` + 굵기별 파일), 44px, 대비, em dash 여부를 다시 검사한다.
