# 데이터 구조 명세 (진도 추적용)

대상: CTO 몽키, 디자이너 몽키, 구현 서브 에이전트. 목적: pedagogy 문서의 단계, 문제, 힌트, 익힘, 복습을 앱이 그대로 저장하고 보여 줄 수 있게 필드 이름을 정합니다. 형식은 JSON 기준이며(예시 안의 `//` 뒤 글은 설명용 주석이라 실제 저장 때는 뺍니다) 저장소 종류(로컬 파일, SQLite 등)는 CTO가 정합니다. 필드 이름은 영어 snake_case, 화면에 보이는 글은 한국어입니다.

## 1. 아이디 규칙

| 대상 | 형식 | 예 |
|---|---|---|
| 강의 | `L01` ~ `L10` | `L07` |
| 기초 단위 | `F-P1` ~ `F-P9`, `F-M1` ~ `F-M6` | `F-M2` |
| 실습 단계 | `{lecture_id}-S{두 자리}` | `L07-S11` |
| 확인 문제 | `{lecture_id}-Q{두 자리}` | `L07-Q04` |
| 재구성 조각 | `{lecture_id}-R{번호}` | `L01-R2` |
| 기초 단위 문제 | `{unit_id}-Q{번호}` | `F-P9-Q4` |
| 복습 카드 | `RC-{원본 id}-{번호}` | `RC-L01-Q06-1` |
| 누적 점검 | `CP1`, `CP2`, `CP3` | `CP2` |

## 2. 콘텐츠(읽기 전용, 문서에서 생성)

### lecture
```json
{
  "lecture_id": "L01",
  "title_ko": "micrograd: 신경망과 역전파를 손으로 만들기",
  "video_url": "https://www.youtube.com/watch?v=VMj-3S1tku0",
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
  "video_segment": {"start": "1:22:28", "end": "1:27:05", "source": "research/01_micrograd.md"},   // 시각이 없으면 null과 note_ko "리서치 반영 예정",
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

### question (확인 문제)
```json
{
  "question_id": "L01-Q06",
  "lecture_id": "L01",
  "type": "fix_bug",                   // predict | explain | fix_bug | apply
  "prompt_ko": "...",
  "code": "...",
  "answer_ko": "...",
  "auto_grade": {"type": "exact", "value": "2.0"},   // exact | numeric_range | keywords | manual
  "rubric": [{"point": 0.5, "criterion_ko": "누적이라는 말"}, {"point": 0.5, "criterion_ko": "+= 위치"}],
  "max_points": 1,
  "must_pass": false,                  // 익힘 판정 때 반드시 정답이어야 하는 문항
  "objective_ids": ["L01-O4"],
  "hint_ids": ["L01-Q06-H1", "L01-Q06-H2"]
}
```

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
4. `video_segment.start`가 비어 있으면 화면에 "구간 준비 중"으로 보이고, 영상 링크만 제공합니다.
5. 시각은 모두 `+09:00`(KST)로 저장합니다.
6. 진도는 맥미니에 저장하고, 실습 시간은 앱이 단계 시작과 완료 시각으로 자동으로 잽니다(CEO 결정 2026-11-16). 저장 방식은 CTO가 정합니다.
