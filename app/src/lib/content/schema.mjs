// 콘텐츠 형식: 교사 정본 inputs/pedagogy/content/L01.json 모양 그대로 (data-spec v1.2).
// 최상위 {_meta, lecture, steps, questions, rebuild_tasks, mastery_rule, hints}. 모르는 칸은 오류가 아니라 경고.
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

export const expectedCheckSchema = z.discriminatedUnion('type', [
  z.looseObject({ type: z.literal('manual'), values: opt(z.record(z.string(), z.union([z.number(), z.string()]))) }),
  z.looseObject({ type: z.literal('output_match'), value: z.string().min(1) }),
  z.looseObject({ type: z.literal('value_range'), min: z.number(), max: z.number(), target: opt(z.string()) }),
]);

export const stepSchema = z.looseObject({
  step_id: z.string().regex(ID.step, 'step_id 모양은 L01-S04 또는 L01-S14b'),
  lecture_id: z.string().regex(ID.lecture),
  order: z.number().int().min(1),
  title_ko: str,
  video_segments: z.array(segmentSchema),
  video_chapter_ko: opt(z.string()),
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
  expected_ko: str,
  expected_check: expectedCheckSchema,
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

export const autoGradeSchema = z.discriminatedUnion('type', [
  z.looseObject({ type: z.literal('exact'), value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])).min(1)]) }),
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
});

export const hintSchema = z.looseObject({
  hint_id: z.string().regex(ID.hint, 'hint_id 모양은 {대상}-H{1~5}'),
  target_id: str,
  level: z.number().int().min(1).max(5), // 5 = HELP
  text_ko: str,
  code_with_blanks: opt(z.string()),
  show_solution: z.boolean().optional(), // H4: 정답 코드(단계)·풀이(문제)를 펼침
  unlock: opt(z.looseObject({ after_attempts: opt(z.number().int().min(0)), after_minutes: opt(z.number().min(0)) })),
  code: opt(z.string()),
  code_line_notes_ko: opt(z.array(z.string())),
  why_ko: opt(z.string()),
  taster_role_ko: opt(z.string()),
});

export const rebuildSchema = z.looseObject({
  rebuild_id: z.string().regex(ID.rebuild),
  lecture_id: z.string().regex(ID.lecture),
  title_ko: str,
  task_ko: opt(z.string()),
  check: z.looseObject({ type: str, reference: z.string().optional(), test_ko: z.string().optional() }),
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
  rewards: opt(z.looseObject({})), // 편 도장·단계 배지 진행·공유 결과물 (자리만)
  bridge_card: opt(z.looseObject({})), // DESIGN.md 5-1 다리 카드 (자리만)
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

export const lectureListItemSchema = z.looseObject({
  lecture_id: z.string().regex(ID.lecture),
  title_ko: str,
  youtube_video_id: opt(z.string()),
  video_seconds: opt(z.number().int().positive()),
});

export const unitSchema = z.looseObject({ unit_id: z.string().regex(ID.unit), title_ko: str });

/** 알려진 칸 (모르는 칸 경고용) */
export const KNOWN = {
  step: new Set(Object.keys(stepSchema.shape)),
  question: new Set(Object.keys(questionSchema.shape)),
  hint: new Set(Object.keys(hintSchema.shape)),
  rebuild: new Set(Object.keys(rebuildSchema.shape)),
  lecture: new Set(Object.keys(lectureSchema.shape)),
};

/** 목록 파일은 맨 위가 배열이거나 {키: 배열} 둘 다 받는다 */
export function listOf(data, ...keys) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') for (const k of keys) if (Array.isArray(data[k])) return data[k];
  return null;
}
