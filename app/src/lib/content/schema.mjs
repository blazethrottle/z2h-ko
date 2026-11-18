// 콘텐츠 형식: 정본 inputs/pedagogy/content/L01.json 모양 그대로 (data-spec, 클로드 버전 2026-11-17).
// 최상위 {_meta, lecture, steps, questions, rebuild_tasks, mastery_rule, hints}. 모르는 칸은 오류가 아니라 경고.
// 칸마다 화면에 보이는지·검사 전용인지는 fields.mjs 한 곳에 적는다.
import { z } from 'zod';

export const ID = {
  lecture: /^L\d{2}$/,
  step: /^(L\d{2}-S\d{2}[a-z]?|T-S\d{2})$/,
  question: /^(L\d{2}-Q\d{2}|CP\d-Q\d{2}|F-D\d+|B\d{2}-\d+-Q\d+)(-ALT)?$/,
  rebuild: /^L\d{2}-R\d+$/,
  objective: /^L\d{2}-O\d+$/,
  unit: /^F-[PM]\d+$/,
  hint: /^.+-H[1-5]$/,
};

const str = z.string().min(1);
const opt = (s) => s.nullable().optional();

export const segmentSchema = z.looseObject({
  start_s: z.number().int().min(0),
  end_s: z.number().int().min(1), // D49: end_s 는 늘 값이 있다(null 금지)
});

export const editSchema = z.looseObject({
  target_step: z.string().regex(ID.step),
  where_ko: str,
  action: z.enum(['insert', 'replace']),
  anchor_line: z.string().nullable(),
  line_count: z.number().int().min(1),
});

/** 실행 순서(run_plan) 한 칸: new:N(이 단계의 N번째 새 셀), cell:단계id:N(앞 단계의 N번째 셀), restart(다시 시작), run_all(모두 실행) */
export const RUN_PLAN_ITEM = /^(new:\d+|cell:[A-Z][A-Z0-9-]*[a-z]?:\d+|restart|run_all)$/;

/** 검사 도구가 읽는 범위 확인(화면에는 내지 않는다) */
const toolRangeSchema = z.looseObject({ expr: str, min: z.number(), max: z.number() });

// output_match.expected: 셀 출력(붙여넣기 비교, match exact|contains). value_range.min·max: 숫자 범위.
// expr·checks·mode·lines 는 검사 도구 전용(fields.mjs check).
export const expectedCheckSchema = z.discriminatedUnion('type', [
  z.looseObject({ type: z.literal('manual'), checks: opt(z.array(toolRangeSchema)) }),
  z.looseObject({
    type: z.literal('output_match'),
    expected: z.string().min(1),
    match: z.enum(['exact', 'contains']).optional(),
    mode: z.enum(['exact', 'contains_lines']).optional(),
    lines: opt(z.array(z.string())),
  }),
  z.looseObject({ type: z.literal('value_range'), min: z.number(), max: z.number(), expr: opt(str), checks: opt(z.array(toolRangeSchema)) }),
]);

export const stepSchema = z.looseObject({
  step_id: z.string().regex(ID.step, 'step_id 모양은 L01-S04 또는 L01-S14b'),
  lecture_id: z.string().regex(ID.lecture),
  order: z.number().int().min(1),
  title_ko: str,
  video_segments: z.array(segmentSchema),
  long_step: z.boolean(),
  new_code_lines: z.number().int().min(0),
  moved_code_lines: opt(z.number().int().min(0)),
  prepared_code: z.string().nullable(),
  prepared_code_line_notes_ko: opt(z.array(z.string())),
  prepared_code_source_ko: opt(z.string()),
  kind: z.enum(['code', 'read', 'reflect', 'optional', 'copy_run']),
  edits: opt(z.array(editSchema)),
  rerun_first: opt(z.array(z.string().regex(ID.step))),
  input_ko: str,
  code: z.string().nullable(),
  code_line_notes_ko: z.array(z.string()).nullable(),
  /** 새 셀마다 줄 수(edits 로 앞 셀에 넣는 줄은 빼고). 합 = code 줄 수 - edits 줄 수 */
  cell_line_counts: opt(z.array(z.number().int().min(1)).min(1)),
  run_plan: opt(z.array(z.string().regex(RUN_PLAN_ITEM, 'run_plan 칸은 new:N, cell:단계id:N, restart, run_all')).min(1)),
  /** 새 셀을 이 단계의 셀 바로 위에 넣는다 */
  place_before: opt(z.string().regex(ID.step)),
  restart_first: z.boolean().optional(),
  expected_ko: str,
  expected_check: expectedCheckSchema,
  /** 일부러 에러를 내는 단계에서 나야 하는 에러 종류(예 NameError) */
  expected_error: opt(str),
  expected_output_example: opt(z.string()),
  /** 그림이 나오는 단계의 "스스로 확인할 것" */
  self_check_ko: opt(z.array(str).min(1)),
  meaning_ko: str,
  objective_ids: z.array(z.string().regex(ID.objective)),
  hint_ids: opt(z.array(z.string())),
  // 앱 선택 칸(DESIGN.md 12.4 표)
  summary_ko: opt(z.array(str).max(3)),
  concept_ko: opt(z.looseObject({ term: str, plain: str })),
  output_varies: z.boolean().optional(),
  tolerance: opt(z.union([z.number().positive(), z.looseObject({ rel: z.number().min(0).optional(), abs: z.number().min(0).optional() })])),
  mismatch_hints_ko: opt(z.array(str)),
  notebook_cell: opt(z.string()),
  check_id: opt(z.string()),
  code_origin: opt(z.looseObject({ repo: str, path: z.string().optional(), license: z.string().optional() })),
  cell_code_lines: opt(z.number().int().min(0)),
});

const answerList = z.array(str).min(1);

export const autoGradeSchema = z.discriminatedUnion('type', [
  // accept: 같은 답의 다른 표기(예 6 과 6.0)
  z.looseObject({ type: z.literal('exact'), value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])).min(1)]), accept: opt(answerList) }),
  z.looseObject({ type: z.literal('numeric_range'), min: z.number(), max: z.number() }),
  z.looseObject({ type: z.literal('keywords'), keywords: z.array(z.union([str, z.array(str).min(1)])).optional() }),
  z.looseObject({ type: z.literal('manual') }),
  z.looseObject({ type: z.literal('choice') }),
]);

export const questionSchema = z.looseObject({
  question_id: z.string().regex(ID.question),
  lecture_id: opt(z.string().regex(ID.lecture)),
  type: z.enum(['predict', 'explain', 'fix_bug', 'apply', 'choice']),
  after_step: opt(z.string().regex(ID.step)),
  scored: z.boolean().optional(), // false 면 제출 없이 바로 풀이, 점수·복습 없음
  alternate_of: opt(z.string()),
  prompt_ko: str,
  code: opt(z.string()),
  answer_ko: z.string().nullable().optional(), // 규칙 6에서 따로 본다
  auto_grade: autoGradeSchema,
  rubric: z.array(z.looseObject({ point: z.number().positive(), criterion_ko: str, keywords: z.array(str).optional() })).nullable().optional(),
  max_points: z.number().positive(),
  must_pass: z.boolean().optional(),
  objective_ids: opt(z.array(z.string().regex(ID.objective))),
  hint_ids: opt(z.array(z.string())),
  choices: z.array(z.string()).optional().nullable(),
  answer_index: z.number().int().optional().nullable(),
  recommend_units_if_wrong: opt(z.array(z.string().regex(ID.unit))),
  /** 입력 칸에 무엇을 쓰는지: output(고친 코드의 실행 결과) | answer_text(답) | rubric(채점 기준으로 스스로) */
  graded_on: opt(z.enum(['output', 'answer_text', 'rubric'])),
  /** 풀이 코드와 줄별 풀이, 그 출력(제출 뒤에만 보임) */
  answer_code: opt(str),
  answer_code_line_notes_ko: opt(z.array(z.string())),
  answer_output: opt(z.string()),
  /** 검수용(화면에 안 냄) */
  verify_code: opt(z.string()),
  verify_output: opt(z.string()),
  /** 진단: 무엇을 재는지(결과 화면), 고르기의 "모르겠어요" 보기 번호, 직접 입력의 "모르겠어요" 단추 */
  measures_ko: opt(str),
  dont_know_index: opt(z.number().int().min(0)),
  allow_dont_know: z.boolean().optional(),
});

export const hintSchema = z.looseObject({
  hint_id: z.string().regex(ID.hint, 'hint_id 모양은 {대상}-H{1~5}'),
  target_id: str,
  level: z.number().int().min(1).max(5), // 5 = HELP
  text_ko: str,
  code_with_blanks: opt(z.string()),
  show_solution: z.boolean().optional(), // H4: 정답 코드(단계)·풀이(문제)·정답 코드(과제)를 펼침
  unlock: opt(z.looseObject({ after_attempts: opt(z.number().int().min(0)), after_minutes: opt(z.number().min(0)) })),
  code: opt(z.string()),
  code_line_notes_ko: opt(z.array(z.string())),
  why_ko: opt(z.string()),
  taster_role_ko: opt(z.string()),
  /** H2 가 가리키는 기초 단위(또는 단계)와 그 단위 설명 카드의 몇 번째 문장인지(1부터) */
  points_to_id: opt(str),
  points_to_card_line: opt(z.number().int().min(1)),
  /** H3 빈칸의 답(빈칸 ___ 순서대로)과 채운 뒤 나오는 출력 */
  blank_answers: opt(z.array(z.string()).min(1)),
  blank_filled_output: opt(z.string()),
});

export const rebuildSchema = z.looseObject({
  rebuild_id: z.string().regex(ID.rebuild),
  lecture_id: z.string().regex(ID.lecture),
  title_ko: str,
  task_ko: opt(z.string()),
  check: z.looseObject({ type: str, reference: z.string().optional(), expected: opt(z.string()), mode: opt(z.string()) }),
  /** 확인 셀(학습자가 붙여 넣어 실행)과 줄별 풀이, 통과 기준 */
  check_code: opt(str),
  check_code_line_notes_ko: opt(z.array(z.string())),
  pass_ko: opt(str),
  /** 정답 코드(H4 에서만 보임)와 출처 */
  solution_code: opt(str),
  solution_code_line_notes_ko: opt(z.array(z.string())),
  solution_source_ko: opt(z.string()),
  required_for_mastery: z.boolean().optional(),
  max_hint_level_for_pass: z.number().int().min(0).max(4),
  hint_ids: opt(z.array(z.string())),
});

export const masteryRuleSchema = z.looseObject({
  mastery_rule_id: str,
  steps_complete_ratio: z.number().min(0).max(1),
  question_score_ratio: z.number().min(0).max(1),
  question_min_points: opt(z.number().min(0)),
  rebuild_max_hint_level: z.number().int().min(0).max(4),
  extra_checks: z.array(z.string()),
  speak_check: opt(z.looseObject({ prompt_ko: str })),
  applies_to: opt(z.string()),
  rebuild_required: z.boolean().optional(),
  note_ko: opt(z.string()),
});

export const lectureSchema = z.looseObject({
  lecture_id: z.string().regex(ID.lecture),
  title_ko: str,
  video_url: z.string().regex(/^https:\/\/www\.youtube\.com\/watch\?v=/, 'video_url은 https://www.youtube.com/watch?v= 형식'),
  youtube_video_id: str,
  video_seconds: z.number().int().positive(),
  video_minutes: opt(z.number().int().positive()),
  source_repos: z.array(str).optional(),
  env: z.array(z.string()).optional(),
  objectives: z.array(z.looseObject({ objective_id: z.string().regex(ID.objective), text_ko: str })).min(1),
  prereq_units: z.array(z.string().regex(ID.unit)),
  prereq_units_optional: opt(z.array(z.string().regex(ID.unit))),
  prereq_lectures: z.array(z.string().regex(ID.lecture)).optional(),
  mastery_rule_id: opt(z.string()),
  research_status: opt(z.string()),
  rewards: opt(z.looseObject({})), // 편 도장·공유 결과물. 없으면 도장 id 는 STAMP-{편}(badge-rules), 공유 결과물 없음
  content_version: opt(z.string()),
  study_hours_ko: opt(z.string()),
});

export const lectureFileSchema = z.looseObject({
  _meta: opt(z.looseObject({})),
  lecture: z.looseObject({}),
  steps: z.array(z.unknown()),
  questions: z.array(z.unknown()),
  rebuild_tasks: z.array(z.unknown()),
  mastery_rule: z.looseObject({}),
  hints: z.array(z.unknown()),
});

// ---- 10편 목록 content/lectures.yaml (docs/CURRICULUM.md 에서 옮긴 값) ----
const planSchema = z.looseObject({
  chapters: z.number().int().min(0),
  steps: z.number().int().min(1),
  required_steps: z.number().int().min(0),
  optional_steps: z.number().int().min(0),
  questions: z.number().int().min(0),
  rebuild: z.number().int().min(0),
  total_minutes: z.number().int().min(1),
});

/** 화면 칸에서 뺀 설계서 원문(화면에 내지 않음): { 화면 칸 이름: 원문 } */
const designSource = opt(z.record(z.string(), str));

export const lectureListItemSchema = z.looseObject({
  lecture_id: z.string().regex(ID.lecture),
  design_source: designSource,
  title_ko: str,
  youtube_video_id: opt(z.string()),
  video_seconds: opt(z.number().int().positive()),
  video_url: opt(z.string().regex(/^https:\/\/www\.youtube\.com\/watch\?v=/)),
  env_ko: opt(str),
  prereq_lectures: opt(z.array(z.string().regex(ID.lecture))),
  prereq_lectures_note_ko: opt(str),
  objectives: opt(z.array(z.looseObject({ objective_id: z.string().regex(ID.objective), text_ko: str }))),
  plan: opt(planSchema),
  bridge: opt(
    z.looseObject({ from_lecture: z.string().regex(ID.lecture), jump_ko: str, new_ko: str, bridge_ko: str, card_ids: z.array(z.string().regex(/^B\d{2}-\d+$/)), design_source: designSource }),
  ),
});

export const bridgeCardSchema = z.looseObject({ card_id: z.string().regex(/^B\d{2}-\d+$/), lecture_id: z.string().regex(ID.lecture), summary_ko: str, design_source: designSource });

export const checkpointListItemSchema = z.looseObject({
  checkpoint_id: z.string().regex(/^CP\d$/),
  covers: z.array(z.string().regex(ID.lecture)).min(1),
  after_lecture: z.string().regex(ID.lecture),
  items_ko: str,
  question_count: z.number().int().min(1),
});

// ---- 맛보기 (교사 정본 inputs/pedagogy/content/taster.json, data-spec v1.2 kind copy_run) ----
export const TASTER_ID = {
  lecture: 'TASTER',
  step: /^T-S\d{2}$/,
  question: /^T-Q\d{2}$/,
};

export const tasterLectureSchema = z.looseObject({
  lecture_id: z.literal(TASTER_ID.lecture),
  title_ko: str,
  env: z.array(z.string()).optional(),
  minutes: z.number().int().positive(),
  video_segments: z.array(segmentSchema).max(0, '맛보기는 영상이 없습니다(D53)'),
  notebook_ko: opt(z.string()),
  verified_kst: opt(z.string()),
  completion_rule: z.looseObject({
    rule_id: str,
    requires_steps: z.array(z.string().regex(TASTER_ID.step)).min(1),
    step_done_when_ko: opt(z.string()),
    questions_scored: z.boolean().optional(),
    questions_ko: opt(z.string()),
    result: opt(z.string()),
    on_complete_ko: opt(z.string()),
  }),
  artifact: opt(
    z.looseObject({
      artifact_id: str,
      name_ko: str,
      unlock_after: z.string().regex(TASTER_ID.step),
      input_ko: opt(z.string()),
      card_fields: z.looseObject({ title_ko: str, credit_ko: str, humble_line_ko: str, disclaimer_ko: str }),
    }),
  ),
  next_ko: opt(z.array(z.string())),
});

export const tasterStepSchema = stepSchema.extend({
  step_id: z.string().regex(TASTER_ID.step, '맛보기 step_id 모양은 T-S01'),
  lecture_id: z.literal(TASTER_ID.lecture),
  kind: z.enum(['copy_run', 'read']),
  minutes: z.number().int().positive(),
  cell_code_lines: z.number().int().min(0),
  code_alt_local: opt(z.string()),
  code_alt_local_line_notes_ko: opt(z.array(z.string())),
  expected_output_example: opt(z.string()),
  aha_ko: str,
  summary_ko: opt(z.string()),
  question_ids: opt(z.array(z.string().regex(TASTER_ID.question))),
});

export const tasterQuestionSchema = questionSchema.extend({
  question_id: z.string().regex(TASTER_ID.question, '맛보기 문항 id 모양은 T-Q01'),
  lecture_id: z.literal(TASTER_ID.lecture),
  after_step: z.string().regex(TASTER_ID.step),
});

// ---- 사전 기초 (정본 inputs/pedagogy/content/F.json, 클로드 버전: 1편과 같은 모양 + lecture.units·diagnostic·recommend_rules·lecture_prereq_units, 칸마다 unit_id) ----
// 경로는 content-config.mjs BASICS.file. 모르는 칸은 오류가 아니라 경고(정본에 칸이 늘어도 빌드가 깨지지 않게).
export const BASICS_ID = {
  lecture: 'F',
  unit: /^F-[PM]\d+$/,
  step: /^F-[PM]\d+-S\d+[a-z]?$/,
  question: /^F-[PM]\d+-Q\d+$/,
  diagnostic: /^F-D\d+$/,
  rebuild: /^F-[PM]\d+-R\d+$/,
  objective: /^F-[PM]\d+-O\d+$/,
};

export const basicsUnitSchema = z.looseObject({
  unit_id: z.string().regex(BASICS_ID.unit, 'unit_id 모양은 F-P1 또는 F-M1'),
  kind: z.enum(['python', 'math']),
  title_ko: str,
  goal_ko: str,
  /** 설명 카드: 일상 비유 한 줄과 쉬운 말 문장 목록 */
  analogy_ko: str,
  card_ko: z.array(str).min(1),
  needed_by_lectures: z.array(z.string().regex(ID.lecture)),
  recommend_first: z.boolean(),
  objective_ids: z.array(z.string().regex(BASICS_ID.objective)),
  step_ids: z.array(z.string()),
  question_ids: z.array(z.string()),
  rebuild_ids: z.array(z.string()),
  estimated_minutes: z.number().int().positive(),
  // 없으면 내용 있음(written). planned 는 목록에 "준비 중"(누를 수 없음, 주소 없음)
  status: z.enum(['written', 'planned']).optional(),
});

export const basicsDiagnosticSchema = z.looseObject({
  question_ids: z.array(z.string().regex(BASICS_ID.diagnostic)).min(1),
  hints: z.boolean(),
  locks_anything: z.boolean(),
  rules_ko: z.array(str).min(1),
  result_if_correct_ko: str,
  result_if_wrong_ko: str,
});

/** 앱이 아는 추천 규칙(정본 recommend_rules). 모르는 규칙이 오면 화면에 낼 수 없어 빌드 검사가 실패한다 */
export const RECOMMEND_RULE_IDS = ['always_first', 'diagnostic', 'lecture_start', 'stuck'];

export const recommendRuleSchema = z.looseObject({
  rule_id: z.enum(RECOMMEND_RULE_IDS),
  units: opt(z.array(z.string().regex(BASICS_ID.unit)).min(1)),
  units_from: opt(z.string()),
  label_ko: str,
  when_ko: str,
});

export const basicsLectureSchema = z.looseObject({
  lecture_id: z.literal(BASICS_ID.lecture),
  title_ko: str,
  intro_ko: z.array(str).min(1),
  youtube_video_id: z.null().optional(),
  objectives: z.array(z.looseObject({ objective_id: z.string().regex(BASICS_ID.objective), text_ko: str, unit_id: z.string().regex(BASICS_ID.unit) })),
  units: z.array(z.unknown()),
  diagnostic: basicsDiagnosticSchema,
  recommend_rules: z.array(recommendRuleSchema).min(1),
  /** 편별 선행 기초 단위(편 시작 화면의 "이 편 전에 보면 좋아요") */
  lecture_prereq_units: z.record(z.string().regex(ID.lecture), z.array(z.string().regex(BASICS_ID.unit))),
});

/** 기초 익힘 규칙(정본 mastery_rule, 단위마다 판정) */
export const basicsMasteryRuleSchema = z.looseObject({
  mastery_rule_id: str,
  applies_to: z.literal('unit'),
  steps_complete_ratio: z.number().min(0).max(1),
  question_score_ratio: z.number().min(0).max(1),
  rebuild_max_hint_level: z.number().int().min(0).max(4),
  rebuild_required: z.boolean(),
  extra_checks: z.array(z.string()),
  note_ko: str,
});

// 기초는 출력이 없는 단계(에러가 나는 단계, 셀 순서를 바꿔 보는 단계)가 있어 output_match 에 expected 가 비거나 없을 수 있다(화면은 "같아요/달라요" 확인).
export const basicsExpectedCheckSchema = z.discriminatedUnion('type', [
  ...expectedCheckSchema.options.filter((o) => o.shape.type.value !== 'output_match'),
  z.looseObject({ type: z.literal('output_match'), expected: z.string().optional(), match: z.enum(['exact', 'contains']).optional(), mode: z.enum(['exact', 'contains_lines']).optional(), lines: opt(z.array(z.string())) }),
]);

export const basicsStepSchema = stepSchema.extend({
  step_id: z.string().regex(BASICS_ID.step, 'step_id 모양은 F-P1-S1 또는 F-P1-S2b'),
  lecture_id: z.literal(BASICS_ID.lecture),
  unit_id: z.string().regex(BASICS_ID.unit),
  video_segments: z.array(segmentSchema).max(0, '기초 단계에는 영상이 없습니다(빈 목록)'),
  edits: opt(z.array(editSchema.extend({ target_step: z.string().regex(BASICS_ID.step) }))),
  rerun_first: opt(z.array(z.string().regex(BASICS_ID.step))),
  place_before: opt(z.string().regex(BASICS_ID.step)),
  objective_ids: z.array(z.string().regex(BASICS_ID.objective)),
  expected_check: basicsExpectedCheckSchema,
});

export const basicsQuestionSchema = questionSchema.extend({
  question_id: z.string().regex(new RegExp(`${BASICS_ID.question.source}|${BASICS_ID.diagnostic.source}`), 'question_id 모양은 F-P1-Q1 또는 F-D1'),
  lecture_id: opt(z.literal(BASICS_ID.lecture)),
  unit_id: z.string(),
  after_step: opt(z.string().regex(BASICS_ID.step)),
  objective_ids: opt(z.array(z.string().regex(BASICS_ID.objective))),
});

/**
 * 단위별 익힘 과제(정본 rebuild_tasks): 빈 셀에서 혼자 다시 만들기. 화면은 과제 글·출력 예·스스로 확인할 것을 보이고 학습자가 "직접 확인했어요"로 자기 확인한다.
 * required_for_mastery 가 true 인 과제만 단위 익힘 판정에 들어간다(정본 v claude-1.1: 모두 false).
 */
export const basicsRebuildSchema = rebuildSchema.extend({
  rebuild_id: z.string().regex(BASICS_ID.rebuild, 'rebuild_id 모양은 F-P1-R1'),
  lecture_id: z.literal(BASICS_ID.lecture),
  unit_id: z.string().regex(BASICS_ID.unit),
  title_ko: str,
  prompt_ko: str,
  check: z.looseObject({ type: z.enum(['manual', 'output_match', 'value_range']), mode: opt(z.string()), reference: opt(z.string()) }),
  required_for_mastery: z.boolean(),
  solution_code: str,
  solution_code_line_notes_ko: z.array(z.string()),
  cell_line_counts: z.array(z.number().int().min(1)).min(1),
  expected_output_example: z.string(),
  self_check_ko: z.array(str).min(1),
  max_hint_level_for_pass: z.number().int().min(0).max(4).nullable(),
});

export const basicsFileSchema = z.looseObject({
  _meta: opt(z.looseObject({})),
  lecture: z.looseObject({}),
  steps: z.array(z.unknown()),
  questions: z.array(z.unknown()),
  rebuild_tasks: z.array(z.unknown()),
  mastery_rule: z.looseObject({}),
  hints: z.array(z.unknown()),
});

/** 알려진 칸 (모르는 칸 경고용) */
export const KNOWN = {
  step: new Set(Object.keys(stepSchema.shape)),
  question: new Set(Object.keys(questionSchema.shape)),
  hint: new Set(Object.keys(hintSchema.shape)),
  rebuild: new Set(Object.keys(rebuildSchema.shape)),
  lecture: new Set(Object.keys(lectureSchema.shape)),
  tasterLecture: new Set(Object.keys(tasterLectureSchema.shape)),
  tasterStep: new Set(Object.keys(tasterStepSchema.shape)),
  tasterQuestion: new Set(Object.keys(tasterQuestionSchema.shape)),
  basicsUnit: new Set(Object.keys(basicsUnitSchema.shape)),
  basicsStep: new Set(Object.keys(basicsStepSchema.shape)),
  basicsQuestion: new Set(Object.keys(basicsQuestionSchema.shape)),
  basicsRebuild: new Set(Object.keys(basicsRebuildSchema.shape)),
};

/** 목록 파일은 맨 위가 배열이거나 {키: 배열} 둘 다 받는다 */
export function listOf(data, ...keys) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') for (const k of keys) if (Array.isArray(data[k])) return data[k];
  return null;
}
