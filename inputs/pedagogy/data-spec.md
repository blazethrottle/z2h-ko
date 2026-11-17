# 데이터 구조 명세 (진도 추적용)

대상: CTO 몽키, 디자이너 몽키, 구현 서브 에이전트. 목적: pedagogy 문서의 단계, 문제, 힌트, 익힘, 복습을 앱이 그대로 저장하고 보여 줄 수 있게 필드 이름을 정합니다. 형식은 JSON 기준이며(예시 안의 `//` 뒤 글은 설명용 주석이라 실제 저장 때는 뺍니다) 저장소 종류(로컬 파일, SQLite 등)는 CTO가 정합니다. 필드 이름은 영어 snake_case, 화면에 보이는 글은 한국어입니다.

## 1. 아이디 규칙

| 대상 | 형식 | 예 |
|---|---|---|
| 강의 | `L01` ~ `L10` | `L07` |
| 기초 단위 | `F-P1` ~ `F-P9`, `F-M1` ~ `F-M6` | `F-M2` |
| 기초 실습 단계 | `{unit_id}-S{번호}`(두 자리 아님), 쪼갠 단계는 뒤에 `b` | `F-P1-S2b` |
| 기초 목표 | `{unit_id}-O{번호}` | `F-P3-O1` |
| 기초 익힘 과제 | `{unit_id}-R{번호}` | `F-P3-R1` |
| 다리 카드 | `B{도착 편}-{번호}` | `B05-2` |
| 실습 단계 | `{lecture_id}-S{두 자리}` | `L07-S11` |
| 확인 문제 | `{lecture_id}-Q{두 자리}` | `L07-Q04` |
| 재구성 조각 | `{lecture_id}-R{번호}` | `L01-R2` |
| 기초 단위 문제 | `{unit_id}-Q{번호}` | `F-P9-Q4` |
| 복습 카드 | `RC-{원본 id}-{번호}` | `RC-L01-Q06-1` |
| 누적 점검 | `CP1`, `CP2`, `CP3` | `CP2` |
| 누적 점검 문항 | `{checkpoint_id}-Q{두 자리}` | `CP1-Q03` |
| 기초 진단 문항 | `F-D{번호}` | `F-D2` |
| 쪼갠 단계 | 기존 `step_id` 뒤에 `b`, `c` | `L01-S14b` |

## 2. 콘텐츠(읽기 전용, 문서에서 생성)

### lecture
```json
{
  "lecture_id": "L01",
  "title_ko": "micrograd: 신경망과 역전파를 손으로 만들기",
  "video_url": "https://www.youtube.com/watch?v=VMj-3S1tku0",   // "유튜브에서 열기" 대체 링크
  "youtube_video_id": "VMj-3S1tku0",   // 임베드용. video-segments.json과 같은 값
  "video_seconds": 8752,               // research 기준 영상 길이(2:25:52)
  "video_minutes": 146,
  "source_repos": ["karpathy/micrograd", "karpathy/nn-zero-to-hero"],
  "env": ["cpu"],                      // cpu | mps | colab_gpu
  "objectives": [{"objective_id": "L01-O1", "text_ko": "..."}],
  "prereq_units": ["F-P6", "F-M2"],
  "prereq_lectures": [],
  "mastery_rule_id": "default",        // 또는 편별 규칙 id
  "research_status": "pending"         // pending | merged
}
```

### step (실습 단계)
```json
{
  "step_id": "L01-S12",
  "lecture_id": "L01",
  "order": 12,
  "title_ko": "같은 값을 두 번 쓰는 버그",
  "video_segments": [{"start_s": 4948, "end_s": 5225}],   // 초 단위. 1:22:28 ~ 1:27:05. start_s, end_s 모두 int(null 없음, 끝은 다음 챕터 시작 또는 영상 길이). 구간이 여럿이면 여러 개. 빈 목록 [] = 이 단계에는 영상이 없음(읽기, 쓰기 단계, 맛보기)
  "long_step": false,                  // 새 코드 6~10줄이면 true, 제목에 "(긴 단계)". 10줄 초과는 허용하지 않음
  "new_code_lines": 2,                 // 새로 치는 코드 줄 수(준비 코드 제외)
  "prepared_code": null,               // 준비 코드(붙여 넣기만, 예: draw_dot). 있으면 줄별 풀이도 함께
  "kind": "code",                      // code | read | reflect | optional
  "input_ko": "입력할 것 설명",
  "code": "a = Value(3.0)\nb = a + a",
  "code_line_notes_ko": ["3.0을 담은 Value", "a를 두 번 더함"],   // 코드 줄 수와 같아야 함(검수 규칙)
  "expected_ko": "a.grad가 2.0",
  "expected_check": {"type": "manual"},  // manual | output_match | value_range
  "meaning_ko": "여러 길이면 기울기를 더한다",
  "objective_ids": ["L01-O4"],
  "hint_ids": ["L01-S12-H1", "L01-S12-H2"]
}
```

### step: v1.2 추가 칸(맛보기, 01편 제작판)

칸은 꼭 필요한 것만 둡니다. 새 셀에 치는 단계는 아래 칸이 모두 기본값(빈 목록, 0, null)입니다.
- `prepared_code_line_notes_ko`: 준비 코드(`prepared_code`)의 줄별 풀이. 줄 수가 같아야 합니다.
- `prepared_code_source_ko`: 준비 코드의 출처 한 줄(원본 저장소와 무엇을 바꿨는지).
- `edits`: 새 셀이 아니라 앞 셀을 고치는 단계의 고칠 곳 목록. 칸은 `target_step`(고칠 셀의 단계 id, 예 L01-S04 = Value 클래스 셀), `where_ko`(넣을 곳 설명), `action`(`insert` 줄 넣기 | `replace` 기존 줄 바꾸기), `anchor_line`(이 줄 바로 아래에 넣음, null이면 셀 맨 아래), `line_count`. `code`의 앞쪽 줄들이 `edits` 순서대로 넣을 줄이고, 나머지 줄은 새 셀에 칩니다. 비어 있으면 새 셀.
- `rerun_first`: 이 단계 전에 다시 실행할 단계 id 목록(클래스를 고친 뒤 옛 Value 상자를 새로 만들기 위함).
- `moved_code_lines`: 앞 단계 코드를 옮겨 붙이는 줄 수(현재 L01-S11b의 8줄만). `new_code_lines`에 넣지 않습니다. 검수: `code` 줄 수 = new + moved(+ replace 줄 수).
- `kind: copy_run`: 맛보기 셀. 복사해 실행만 하므로 `new_code_lines` 0, 셀 줄 수는 `cell_code_lines`. 줄 수 규칙과 익힘 판정에서 빠집니다.
- 맛보기 전용: `code_alt_local`(+ `_line_notes_ko`, Colab 밖 대체 셀), `expected_output_example`(실제 실행 출력), `aha_ko`, `summary_ko`, `minutes`, `question_ids`.
- 정리한 칸: v1.2 초안의 `cell_mode`는 `edits`가 비었는지로 알 수 있어 뺐고, `changed_lines_only`는 `edits[].action = replace`로 합쳤습니다.

화면: `edits`가 있는 단계는 '바뀐 줄만 보여 주는' 화면이 필요합니다. 전체 비교(diff) 도구까지는 필요 없고, 넣을 곳마다 `anchor_line`을 흐리게 한 줄 보여 주고 그 아래에 넣을 줄(`action: replace`면 바뀐 뒤 줄)을 강조해 보여 주면 됩니다. 셀 전체 모습은 '전체 보기' 단추로 펼치게 둡니다.

문항에는 `after_step`(이 단계 뒤에 냄)과 `scored`(false면 점수 없이 풀이만, 맛보기 문항)를 둘 수 있습니다. 힌트에는 `show_solution`(H4에서 정답 코드와 줄별 풀이를 펼침)과 맛보기용 `taster_role_ko`가 있습니다. 편(lecture)에는 `rewards`(편 도장 `stamp`, 단계 배지 진행 `badge_progress`, 공유 결과물 `artifact`)를 둘 수 있습니다(선택 칸). 클로드 버전 `L01.json`에는 `rewards`가 없고, 그때 앱은 편 도장 id를 `STAMP-{편}`(`app/src/badge-rules.ts`)으로 쓰고 공유 결과물(학습 기록 카드)은 내지 않습니다. 예는 `content/L01.json`, `content/taster.json`.

### 클로드 버전 추가 칸 (2026-11-17, `content/F.json` claude-1.1·`content/L01.json` claude-1.0)

모두 선택 칸입니다(없어도 오류가 아닙니다). 정본 `_meta.added_fields`가 칸을 만든 까닭을 적고, 아래 표는 앱이 그 칸을 어떻게 쓰는지 적습니다. 분류는 넷입니다. **화면**: 글이나 값이 보임. **화면 계산**: 판정·연결·순서에 쓰고 글로는 안 보일 수 있음. **늦게**: 풀이·정답·힌트 본문이라 페이지에 넣지 않고, 제출하거나 힌트를 열 때 `/data/{편}/answers.json`·`hints.json`으로 받음. **검사용, 화면에 안 냄**: 검사·검수 도구만 읽고 어떤 화면 데이터에도 넣지 않음. 분류의 기계 정본은 `app/src/lib/content/fields.mjs`이고, `app/tests/unit/fields.test.mjs`가 정본의 모든 칸이 분류되어 있는지와 검사용·늦게 칸이 페이지 데이터에 새지 않는지 확인합니다(칸이 늘면 이 테스트가 먼저 깨집니다).

| 어디 | 칸 | 뜻 | 분류 | 앱이 쓰는 곳 |
|---|---|---|---|---|
| 기초 lecture | `intro_ko` (글 목록) | 기초 첫 화면 안내 | 화면 | 기초 목록 머리 |
| 기초 lecture | `units` | 단위 15개(아래 단위 칸) | 화면 | 기초 목록, 단위 화면 |
| 기초 lecture | `diagnostic` (`question_ids`, `hints`, `locks_anything`, `rules_ko`, `result_if_correct_ko`, `result_if_wrong_ko`) | 진단 5문제 약속과 결과 글 | 화면(`rules_ko`·결과 글), 화면 계산(나머지) | 진단 카드·진단 화면. `hints`·`locks_anything`이 false가 아니면 빌드 검사 실패 |
| 기초 lecture | `recommend_rules[]` (`rule_id`, `units`, `label_ko`, `when_ko`, `units_from`) | 추천 규칙 4개(처음이면 먼저, 진단, 편 시작, 막혔을 때) | 화면(`label_ko`·`when_ko`), 화면 계산(`rule_id`·`units`), 검사용(`units_from`) | 단위 행 표시 이름, 진단 결과, 강의 개요의 "이 편 전에 보면 좋아요". 앱이 모르는 `rule_id`는 빌드 검사 실패 |
| 기초 lecture | `lecture_prereq_units` ({편: 단위 목록}) | 편별 선행 기초 | 화면 계산 | 강의 개요·준비 중 편 안내의 선행 기초(아직 익히지 않은 단위만). 1편 정본 `prereq_units`와 같아야 함 |
| 기초 lecture | `objectives[].unit_id` | 목표가 속한 단위 | 화면 계산 | 단위 화면 목표(목표 글이 `goal_ko`와 같으면 한 번만 보임) |
| 단위 | `kind` (python·math) | 묶음 | 화면 계산 | 목록 2개(파이썬 최소·수학 최소). id 머리말 F-P·F-M과 맞아야 함 |
| 단위 | `card_ko` (글 목록), `analogy_ko` | 설명 카드 문장과 일상 비유 | 화면 | 단위 화면 "설명 카드"(문장마다 `#card-N` 주소) |
| 단위 | `needed_by_lectures`, `estimated_minutes` | 주로 필요한 편, 예상 분(추정) | 화면 | 단위 화면 머리, 목록 행 |
| 단위 | `recommend_first` | 처음이면 먼저 | 화면 계산 | 행 표시 이름. `always_first` 규칙의 단위와 같아야 함 |
| 단위 | `objective_ids`, `step_ids`, `question_ids`, `rebuild_ids` | 단위의 항목 | 화면 계산 | 실제 항목과 양방향 일치 검사 |
| 단위 | `status` (written·planned) | 내용이 있는지 | 화면 계산 | 정본에 칸이 없으면 내용 있음. planned 는 목록에 "준비 중"(주소 없음) |
| 단계 | `unit_id` | 기초 단계가 속한 단위 | 화면 계산 | 단위별 묶기 |
| 단계 | `cell_line_counts` | 새 셀마다 줄 수(edits 로 앞 셀에 넣는 줄 제외) | 화면 | 셀이 둘 이상이면 "새 셀 1 · 3줄"처럼 나눠 보임. 합 = code 줄 수 - edits 줄 수 |
| 단계 | `run_plan` (`new:N`, `cell:단계id:N`, `restart`, `run_all`) | 셀을 실행할 차례 | 화면 | "실행 순서" 목록(앞 단계 셀은 링크) |
| 단계 | `place_before` | 새 셀을 이 단계 셀 바로 위에 | 화면 | "새 셀 위치" 줄(링크) |
| 단계 | `restart_first` | 이 단계 전에 다시 시작 | 화면 | "먼저 다시 시작" 줄 |
| 단계 | `expected_error` | 일부러 내는 에러 종류 | 화면 | "에러가 나는 것이 정상" 줄, 확인은 같아요·달라요 |
| 단계 | `expected_output_example` | 실제 실행 출력 예 | 화면 | "출력 예". 붙여넣기 비교는 이 출력 예가 통과하는 방식만 씀(`app/src/lib/checkPlan.ts`) |
| 단계 | `self_check_ko` | 그림 단계의 스스로 확인할 것 | 화면 | 목록 + "직접 확인했어요" |
| 단계 | `prepared_code_source_ko` | 준비 코드 출처 | 화면 | 준비 코드 아래 한 줄 |
| 단계 expected_check | `expected`, `match` (exact·contains) | 셀 출력과 비교 방식 | 화면(`expected`), 화면 계산(`match`) | 글 비교. contains 는 기대한 줄 묶음이 출력 안에 차례로 있으면 맞음 |
| 단계 expected_check | `min`, `max` | 숫자 범위 | 화면 | `expr`가 없으면 셀 출력의 첫 숫자로 비교, 있으면 출력 예로 확인될 때만 숫자 칸 |
| 단계 expected_check | `expr`, `checks[]`, `mode`, `lines` | 검사 도구(run_code.py, verify_f.py) 칸 | 검사용, 화면에 안 냄 | 화면 데이터에서 뺌(`range_of: tool`만 남김) |
| 문항 | `unit_id` | 기초 문항의 단위(진단은 F-DIAG) | 화면 계산 | 단위별 묶기 |
| 문항 | `auto_grade.accept` | 같은 답의 다른 표기 | 늦게 | exact 채점에서 정답으로 침 |
| 문항 | `graded_on` (output·answer_text·rubric) | 입력 칸에 무엇을 쓰는지 | 화면 계산 | 입력 칸 이름("고친 코드를 실행해 나온 결과" 등). output 이면 정답 = `answer_output`이어야 함 |
| 문항 | `answer_code`, `answer_code_line_notes_ko`, `answer_output` | 풀이 코드·줄별 풀이·그 출력 | 늦게 | 제출 뒤 풀이 상자, H4 |
| 문항 | `verify_code`, `verify_output` | 검수용 실행 코드와 출력 | 검사용, 화면에 안 냄 | 어떤 화면 데이터에도 없음 |
| 진단 문항 | `measures_ko` | 무엇을 재는지 | 늦게 | 결과 화면에만(풀기 전에 보이면 힌트가 됨) |
| 진단 문항 | `dont_know_index` / `allow_dont_know` | 고르기의 "모르겠어요" 보기 번호 / 직접 입력의 "모르겠어요" 단추 | 화면 계산 | 모든 진단 문항에 둘 중 하나가 있어야 함(설계서 2-3). 정답 번호와 같으면 검사 실패 |
| 힌트 | `points_to_id`, `points_to_card_line` | H2가 가리키는 단위(또는 단계)와 설명 카드 문장 번호 | 늦게 | H2를 열면 "기초 F-P3 설명 카드 6번째 문장 보기" 링크. 1편처럼 칸이 없으면 H2 글 속 첫 단위 id 로 잇는다 |
| 힌트 | `blank_answers`, `blank_filled_output` | H3 빈칸(`___`) 답과 채운 뒤 출력 | 늦게 | H3 "빈칸 답 보기"를 눌러야 보임. 빈칸 수와 답 수가 같아야 함 |
| 기초 익힘 과제 | `prompt_ko`, `cell_line_counts`, `expected_output_example`, `self_check_ko`, `check.reference` | 과제 글, 셀 줄 수, 보여야 하는 출력, 스스로 확인할 것, 대조할 곳 | 화면 | 단위 화면 "익힘 과제" 카드 |
| 기초 익힘 과제 | `required_for_mastery` | 익힘 판정에 넣는지 | 화면 | false 면 "익힘 판정에 넣지 않는 연습"(정본은 모두 false, `mastery_rule.rebuild_required` false) |
| 재구성(1편) | `task_ko`, `check_code`, `check_code_line_notes_ko`, `pass_ko`, `check.expected`, `check.reference` | 과제 글, 확인 셀과 줄별 풀이, 통과 기준, 확인 셀 출력, 대조할 곳 | 화면 | 강의 개요 재구성 카드. 통과 기록은 노트북 결과코드(id 는 정본 rebuild_tasks 에서 읽음) |
| 재구성·익힘 과제 | `solution_code`, `solution_code_line_notes_ko`, `solution_source_ko` | 정답 코드와 줄별 풀이·출처 | 늦게 | H4(`show_solution`)에서만 |
| 기초 익힘 과제·재구성 | `check.mode` | 검사 도구의 비교 방식 | 검사용, 화면에 안 냄 | |
| mastery_rule | `applies_to`, `rebuild_required`, `note_ko` | 판정 대상(unit), 과제를 판정에 넣는지, 규칙 글 | 화면(`note_ko`), 화면 계산(나머지) | 단위 화면 "익힘 기준" |
| lecture | `research_status` | 조사 반영 상태 | 검사용, 화면에 안 냄 | |
| 맨 위 | `_meta` | 만든 법·결정·미확인 | 검사용, 화면에 안 냄 | |

익힘의 "단계 완료"는 1편·기초 모두 `kind: optional` 단계를 뺍니다(설계서 3-3, `app/src/content-config.mjs` `MASTERY_EXCLUDED_KINDS`). 확인 문제 힌트는 유형과 상관없이 H1~H4(예측 문제 포함), 기초 실습 단계 힌트는 H1~H2 이상, 1편 코드 단계 힌트는 H1~H4입니다(빌드 검사).

### question (확인 문제)
```json
{
  "question_id": "L01-Q06",
  "lecture_id": "L01",
  "type": "fix_bug",                   // predict | explain | fix_bug | apply | choice
  "prompt_ko": "...",
  "code": "...",
  "answer_ko": "...",
  "auto_grade": {"type": "exact", "value": "2.0"},   // exact | numeric_range | keywords | manual | choice
  "rubric": [{"point": 0.5, "criterion_ko": "누적이라는 말"}, {"point": 0.5, "criterion_ko": "+= 위치"}],
  "max_points": 1,
  "must_pass": false,                  // 익힘 판정 때 반드시 정답이어야 하는 문항
  "alternate_of": null,                // 대체 문항이면 원 문항 id(예: "CP1-Q01-ALT"의 alternate_of = "CP1-Q01"). 원 문항은 null
  "objective_ids": ["L01-O4"],
  "hint_ids": ["L01-Q06-H1", "L01-Q06-H2"]
}
```

### question: 객관식(choice) 예
객관식은 `type: "choice"`, 보기 `choices`(글자 배열), 정답 `answer_index`(0부터 세는 정수)를 씁니다. 채점은 `auto_grade.type: "choice"`로, 고른 번호가 `answer_index`와 같으면 정답입니다. "모르겠어요" 보기는 감점 없이 오답으로 기록하고 추천에만 씁니다.
```json
{
  "question_id": "F-D1",
  "unit_id": "F-DIAG",
  "type": "choice",
  "prompt_ko": "`x = 3` 다음 `x = x + 2`를 실행하면 `x`는?",
  "choices": ["3", "5", "32", "모르겠어요"],
  "answer_index": 1,
  "auto_grade": {"type": "choice"},
  "recommend_units_if_wrong": ["F-P1", "F-P2"],
  "max_points": 1,
  "hint_ids": []                       // 진단 문항에는 힌트 없음
}
```
진단 5문항의 구조: F-D1, F-D2, F-D4, F-D5는 `choice`(+ `dont_know_index`), F-D3은 단답(`type: "predict"`, `auto_grade: {"type": "exact", "value": "6", "accept": ["6.0", "6배"]}`, `allow_dont_know: true`). 진단 문항은 `scored: false`이고 문제 `code`가 있으면 화면에 보입니다.

### hint
```json
{
  "hint_id": "L01-Q06-H2",
  "target_id": "L01-Q06",              // step_id 또는 question_id 또는 재구성 조각 id
  "level": 2,                          // 1~4, 5 = HELP
  "text_ko": "...",
  "code_with_blanks": null,            // level 3에서만
  "unlock": {"after_attempts": 1, "after_minutes": null}
}
```

### rebuild_task (핵심 재구성 조각)
```json
{
  "rebuild_id": "L01-R2",
  "lecture_id": "L01",
  "title_ko": "위상 정렬을 쓰는 backward()",
  "check": {"type": "output_match", "reference": "karpathy/micrograd engine.py 동작"},
  "max_hint_level_for_pass": 2
}
```

### mastery_rule
```json
{
  "mastery_rule_id": "default",
  "steps_complete_ratio": 1.0,
  "question_score_ratio": 0.8,
  "rebuild_max_hint_level": 2,
  "extra_checks": []                   // 예: ["speak_check"], ["graph_read_check"], ["result_report_card"]
}
```

## 3. 학습 기록(얼큰이님 진도, 읽기·쓰기)

### step_progress
```json
{"step_id": "L01-S12", "status": "done", "max_hint_level": 1, "started_at": "2026-11-20T20:01:00+09:00", "done_at": "...", "attempts": 2}
```
`status`: `not_started | in_progress | done | skipped_optional`

### question_attempt
```json
{"question_id": "L01-Q06", "attempt_no": 1, "answer_text": "...", "is_correct": true, "raw_points": 1, "max_hint_level": 2, "score_ratio": 0.8, "points_awarded": 0.8, "env_issue": false, "at": "..."}
```
점수 비율 규칙(hints.md 3절): 힌트 0~1단계 1.0, 2단계 0.8, 3단계 0.5, 4단계 0, HELP이면서 `env_issue: true`면 분모에서 제외.

### rebuild_attempt
```json
{"rebuild_id": "L01-R2", "passed": true, "max_hint_level": 2, "at": "..."}
```

### mastery_state (편 또는 기초 단위별)
```json
{
  "target_id": "L01",
  "state": "mastered",                 // locked | open | in_progress | almost | mastered | revisit
  "steps_done_ratio": 1.0,
  "question_score_ratio": 0.86,
  "must_pass_ok": true,
  "rebuild_ok": true,
  "extra_checks_ok": true,
  "mastered_at": "..."
}
```
`almost`: 점수는 넘었지만 재구성 조각 하나 이상이 H3 이상. `revisit`: 복습 카드 절반 이상 놓침(review.md 3절).

### review_card
```json
{
  "card_id": "RC-L01-Q06-1",
  "source_id": "L01-Q06",
  "kind": "concept",                   // concept | predict | hands_on
  "interval_days": 3,                  // 1, 3, 7, 14, 30, 그 뒤 60
  "due_at": "2026-11-24",
  "last_result": "pass",               // pass | shaky | miss
  "history": [{"at": "...", "result": "pass", "max_hint_level": 0}]
}
```
간격 규칙: pass → 다음 간격, shaky → 같은 간격, miss → 1일. 하루 분량 25분 초과 시 간격 긴 카드부터 하루 미룸.

### checkpoint (누적 점검, 콘텐츠)
```json
{
  "checkpoint_id": "CP1",              // CP1 | CP2 | CP3
  "covers": ["L01", "L02", "L03"],
  "unlocks_lecture": "L04",            // CP2 → "L07", CP3 → null(수료)
  "items": [
    {"type": "explain", "count": 6},   // CP1 6+4+1, CP2 8+4+1, CP3 10+5+1
    {"type": "predict", "count": 4},
    {"type": "hand_task", "count": 1}
  ],
  "question_ids": ["CP1-Q01", "CP1-Q02"],   // review.md 4절의 문항표
  "alternate_question_ids": ["CP1-Q01-ALT", "CP1-Q02-ALT"],   // review.md 4-4절. 재응시 때 냄(같은 순서로 1:1 대응)
  "pass_ratio": 0.8,                   // 힌트 점수 반영 뒤
  "max_hint_level": 2,                 // H2까지만 열림
  "time_limit_min": null,              // 시간 제한 없음
  "hand_task_format": {
    "start": "blank_notebook",         // 빈 노트북에서 시작
    "own_words_comment_per_line": true,   // 줄마다 자기 말 주석
    "compare_with": "original_or_torch_output",   // 원본 저장소 또는 torch 결과와 비교
    "self_check_rubric": ["...", "..."]   // 자가 점검 체크 목록(review.md 4절)
  },
  "fail_action": {
    "reset_review_cards_of_missed_lectures_to_days": 1,
    "retry_after_days": 3
  },
  "path_variants": [                   // 요약 경로 적용(review.md 4-5). 전체 길("full")은 위 칸 그대로라 적지 않음
    {
      "path_id": "office_worker",      // office_worker | investor (VALUE_CURRICULUM 4-1, 4-2)
      "taken": true,                   // false면 이 길에서는 보지 않음(CP2). 대신 gate 사용
      "replace": [{"from": "CP1-Q06", "to": "B03-1-Q2"}, {"from": "CP1-Q09", "to": "B03-1-Q1"}],   // 03·04편 문항 → 다리 카드 질문
      "remove_if_lecture_not_mastered": ["L03", "L04", "L05", "L06"],   // 이 편 문항은 그 편을 익히지 않았으면 뺌(replace에 있는 문항 제외)
      "pass_ratio": 0.8,               // 남은 점수 기준
      "badge_on_pass": "BADGE-S1-SUMMARY",
      "gate": null                     // CP2처럼 taken=false일 때: {"cards": ["B03-1", "...", "B04-4"], "must_correct": ["B04-1-Q1", "B04-2-Q1", "B04-3-Q1", "B04-4-Q1"], "unlocks_lecture": "L07"}
    }
  ]
}
```

### checkpoint_attempt
```json
{"checkpoint_id": "CP1", "covers": ["L01", "L02", "L03"], "score_ratio": 0.82, "passed": true, "max_hint_level_allowed": 2, "at": "..."}
```
`passed`가 true여야 다음 편(CP1 → L04, CP2 → L07)이 열림. CP3 통과 = 수료.

### help_note (HELP 메모, 얼큰이님 화면에만 저장, 자동 발송 없음)
```json
{"target_id": "L07-S12", "goal_ko": "...", "last_cell_code": "...", "error_last_line": "...", "env": {"device": "mps", "torch_version": "..."}, "hints_seen": [1, 2, 3, 4], "created_at": "..."}
```

## 4. 검수 규칙(콘텐츠 생성 때 자동 점검 권장)

1. 모든 `step`의 `code` 줄 수와 `code_line_notes_ko` 개수가 같아야 합니다(비개발자 원칙 1).
2. 모든 `question`에는 `answer_ko`와 `rubric`이 있어야 합니다.
3. 모든 화면 글에 긴 줄표 기호가 없어야 합니다.
4. 영상은 공식 YouTube 임베드 플레이어(`https://www.youtube-nocookie.com/embed/{youtube_video_id}?start={start_s}&end={end_s}`, 자동 재생 없음)로 그 단계 구간만 재생하고, 늘 "유튜브에서 열기" 대체 링크(`video_url`에 `&t={start_s}s`)를 함께 둡니다. 영상 파일은 다시 올리지 않습니다(design/decisions.md D16, 얼큰이님 결정 2026-11-16 19:43 KST). `video_segments`가 빈 목록이면 그 단계에는 영상이 없다는 뜻이며 플레이어를 띄우지 않습니다. `end_s`에 null은 쓰지 않습니다(마지막 챕터의 끝은 영상 길이 `video_seconds`). 단계별 구간 값은 `video-segments.json`에서 읽습니다(2026-11-17 v2.0: 1편은 `L01.json`, 2~10편은 `docs/CURRICULUM.md` 단계 목록 표에서 다시 만듦. 영상 없는 단계는 L04-S36, L10-S47).
5. 시각은 모두 `+09:00`(KST)로 저장합니다.
6. 진도는 맥미니에 저장하고, 실습 시간은 앱이 단계 시작과 완료 시각으로 자동으로 잽니다(CEO 결정 2026-11-16). 저장 방식은 CTO가 정합니다.
7. `long_step`은 `new_code_lines`가 6~10이면 true, 0~5면 false여야 하고, 10을 넘는 단계는 오류로 봅니다. `kind: copy_run`(맛보기)은 이 규칙에서 빠집니다.
8. 객관식은 `choices`가 2개 이상이고 `0 <= answer_index < len(choices)`여야 합니다.
9. `rerun_first`, `edits[].target_step`, `question_ids`, `after_step`에 적힌 id는 같은 편 안에 있어야 합니다.
10. 정본 JSON은 손으로 고치지 않습니다. 기초·1편(클로드 버전)은 정본 `_meta.build`에 적힌 조각 파일과 합치는 도구로 만들고, 맛보기는 `content/taster_source.py`로 만듭니다. 앱 쪽 형식 검사는 `cd app && npm run check:content`(빌드 앞에서도 돎)이고, 칸 분류는 `app/src/lib/content/fields.mjs`입니다.
11. `alternate_of`가 있는 문항은 원 문항과 `type`, `max_points`가 같아야 하고, 원 문항마다 대체 문항이 정확히 하나여야 합니다(checkpoint 문항 40개 = 대체 40개).
12. 학습자 기록에는 `path_id`(full | office_worker | investor)를 두고, 점검 문항 목록은 `path_variants`로 계산합니다. 다리 카드 질문 id는 `B03-1-Q1`처럼 카드 id + 문항 번호입니다(카드 목록은 `docs/CURRICULUM.md` 5-1절, 앱은 `content/lectures.yaml` `bridge_cards`에 카드 요지만 옮김. 옛 bridge-cards-03-04.md는 지움). 배지 id: 첫 셀 완주 `BADGE-S0`, 언어 모델 견습 `BADGE-S1`. 맛보기 완료는 배지가 아닌 표시 `TASTER-DONE`입니다. 요약 경로 배지(`BADGE-S1-SUMMARY` 언어 모델 견습(요약 경로), `BADGE-SUMMARY-DONE` AI 속 들여다보기 수료)는 전체 배지와 다른 id이고, 전체 길에서 같은 단계를 마치면 전체 배지로 바뀝니다.
