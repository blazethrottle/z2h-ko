// 검사를 통과한 묶음을 화면이 쓰는 모양으로 바꾼다.
// 풀이(answer_ko, 채점 값, rubric)와 힌트 본문(H4 정답 포함)은 페이지에 넣지 않고 별도 JSON으로 늦게 불러온다.
import crypto from 'node:crypto';
import { NOTEBOOKS } from '../../content-config.mjs';
import { fieldsOfClass } from './fields.mjs';
import { listOf } from './schema.mjs';
import { readBundle, resolvePaths } from './load.mjs';
import { codeLines, formatReport, validateBundle } from './validate.mjs';
import { reconstructCell, splitCells, splitEdits } from './cells.mjs';

export { reconstructCell, splitCells, splitEdits };

const byOrder = (a, b) => a.order - b.order;

function contentVersion(lf, lecture) {
  if (lecture?.content_version) return String(lecture.content_version);
  const h = crypto.createHash('sha256').update(JSON.stringify(lf.data));
  return `auto-${h.digest('hex').slice(0, 12)}`;
}

export const stepSlug = (stepId) => String(stepId).split('-').slice(1).join('-');

const LECTURE_KEYS = fieldsOfClass('lecture', 'screen', 'data').filter((k) => k !== 'objectives');
const OBJECTIVE_KEYS = fieldsOfClass('lecture.objectives[]', 'screen', 'data').filter((k) => k !== 'unit_id');
const EDIT_KEYS = fieldsOfClass('steps[].edits[]', 'screen', 'data');
const UNLOCK_KEYS = ['after_attempts', 'after_minutes'];
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

/** 힌트 열림 조건(단계별 after_attempts·after_minutes 만) */
export const hintUnlockOf = (hs) => Object.fromEntries(hs.filter((h) => h.unlock).map((h) => [h.level, pick(h.unlock, UNLOCK_KEYS)]));

/** 화면이 비교에 쓰는 expected_check 칸(type, expected, match, min, max). 검사 도구 칸(expr, checks, mode, lines)은 넣지 않는다 */
const CHECK_KEYS = fieldsOfClass('steps[].expected_check', 'screen', 'data');
/** 정본 칸 중 화면 데이터에 그대로 넣는 단계 칸. edits·rerun_first·run_plan·place_before 는 아래에서 풀어서 넣고 hint_ids 는 단계 수만 넣는다 */
const RESOLVED_STEP_KEYS = new Set(['edits', 'rerun_first', 'run_plan', 'place_before', 'hint_ids', 'expected_check', 'objective_ids']);
const STEP_KEYS = fieldsOfClass('steps[]', 'screen', 'data').filter((k) => !RESOLVED_STEP_KEYS.has(k));
/** 정본에는 없고 앱이 덧붙일 수 있는 선택 칸(DESIGN.md 12.4) */
const APP_STEP_KEYS = ['summary_ko', 'concept_ko', 'output_varies', 'tolerance', 'mismatch_hints_ko', 'notebook_cell', 'check_id', 'cell_code_lines'];

/** run_plan 칸을 화면 줄로: 새 셀 N, 앞 단계의 셀 N, 다시 시작, 모두 실행 */
export function resolveRunPlan(plan, steps, slugOf) {
  if (!Array.isArray(plan)) return null;
  return plan.map((item) => {
    const nm = /^new:(\d+)$/.exec(item);
    if (nm) return { kind: 'new', n: Number(nm[1]) };
    const cm = /^cell:(.+):(\d+)$/.exec(item);
    if (cm) {
      const t = steps.find((x) => x.step_id === cm[1]);
      return { kind: 'cell', n: Number(cm[2]), step_id: cm[1], slug: slugOf(cm[1]), title_ko: t?.title_ko ?? cm[1] };
    }
    return { kind: item === 'restart' ? 'restart' : 'run_all' };
  });
}

export function publicStep(s, steps, hintsByTarget, segEntry, questionsAfter, slugOf = stepSlug) {
  const hs = hintsByTarget.get(s.step_id) ?? [];
  const edits = s.edits?.length ? splitEdits(s) : null;
  const targetIds = [...new Set((s.edits ?? []).map((e) => e.target_step))];
  const ref = (id) => ({ step_id: id, slug: slugOf(id), title_ko: steps.find((x) => x.step_id === id)?.title_ko ?? id });
  return {
    ...pick(s, [...STEP_KEYS, ...APP_STEP_KEYS]),
    slug: slugOf(s.step_id),
    // value_range 의 범위가 셀 출력의 숫자인지(output), 검사 도구 식 expr 의 값인지(tool). 식 자체는 넣지 않는다
    expected_check: { ...pick(s.expected_check, CHECK_KEYS), ...(s.expected_check?.type === 'value_range' ? { range_of: s.expected_check.expr ? 'tool' : 'output' } : {}) },
    video_segments: (Array.isArray(s.video_segments) ? s.video_segments : (segEntry?.video_segments ?? [])).map((g) => ({ start_s: g.start_s, end_s: g.end_s })),
    hint_levels: hs.map((h) => h.level).sort((a, b) => a - b),
    hint_unlock: hintUnlockOf(hs),
    question_ids: questionsAfter.map((q) => q.question_id),
    cells: splitCells(s),
    edit_view: edits
      ? {
          blocks: edits.blocks.map((b) => ({ ...pick(b, EDIT_KEYS), lines: b.lines, notes: b.notes })),
          rest: edits.rest,
          targets: targetIds.map((t) => ({ ...ref(t), full: reconstructCell(steps, s, t) })),
        }
      : null,
    rerun_first: (s.rerun_first ?? []).map(ref),
    run_plan: resolveRunPlan(s.run_plan, steps, slugOf),
    place_before: s.place_before ? ref(s.place_before) : null,
  };
}

export function publicQuestion(q, hintsByTarget) {
  const hs = hintsByTarget.get(q.question_id) ?? [];
  return {
    question_id: q.question_id,
    lecture_id: q.lecture_id ?? null,
    type: q.type,
    after_step: q.after_step ?? null,
    scored: q.scored !== false,
    prompt_ko: q.prompt_ko,
    code: q.code ?? null,
    choices: q.type === 'choice' ? (q.choices ?? null) : null,
    // 고르기의 "모르겠어요" 보기 번호(정본에 있을 때만). 고르면 감점 없이 오답으로 기록
    dont_know_index: q.type === 'choice' ? (q.dont_know_index ?? null) : null,
    max_points: q.max_points,
    must_pass: !!q.must_pass,
    grade_type: q.auto_grade?.type ?? 'manual',
    graded_on: q.graded_on ?? null,
    hint_levels: hs.map((h) => h.level).sort((a, b) => a - b),
    hint_unlock: hintUnlockOf(hs),
  };
}

/** 풀이·채점 값(answers JSON, 제출하거나 결과를 볼 때 받는다) */
export function buildAnswers(questions) {
  return Object.fromEntries(
    questions.map((q) => [
      q.question_id,
      {
        answer_ko: q.answer_ko ?? null,
        auto_grade: q.auto_grade,
        rubric: q.rubric ?? [],
        answer_index: q.answer_index ?? null,
        choices: q.choices ?? null,
        max_points: q.max_points,
        type: q.type,
        answer_code: q.answer_code ?? null,
        answer_code_line_notes_ko: q.answer_code_line_notes_ko ?? null,
        answer_output: q.answer_output ?? null,
        measures_ko: q.measures_ko ?? null,
      },
    ]),
  );
}

const UNIT_IN_TEXT = /F-[PM]\d+/;

/**
 * 힌트 본문 JSON(대상별, 열 때 받는다). H4 show_solution 이면 정답을 함께: 단계는 코드·줄별 풀이, 문제는 풀이·정답 코드·출력, 과제는 정답 코드·줄별 풀이·출처.
 * points_to: H2 가 가리키는 기초 단위(정본 points_to_id·points_to_card_line). 칸이 없으면 글 속 첫 단위 id(1편 정본은 글로만 가리킨다).
 */
export function buildHints(allHints, { steps, questions, rebuilds, unitOfStep }) {
  const byTarget = new Map();
  for (const h of allHints ?? []) byTarget.set(h.target_id, [...(byTarget.get(h.target_id) ?? []), h]);
  const out = {};
  for (const [t, hs] of byTarget) {
    const step = steps.find((x) => x.step_id === t);
    const q = questions.find((x) => x.question_id === t);
    const r = rebuilds.find((x) => x.rebuild_id === t);
    out[t] = [...hs]
      .sort((a, b) => a.level - b.level)
      .map((h) => {
        const sol = !!h.show_solution;
        const pointId = h.points_to_id ?? (h.level === 2 ? (UNIT_IN_TEXT.exec(h.text_ko)?.[0] ?? null) : null);
        const pointStep = pointId && unitOfStep(pointId) ? pointId : null;
        return {
          hint_id: h.hint_id,
          target_id: t,
          level: h.level,
          text_ko: h.text_ko,
          code_with_blanks: h.code_with_blanks ?? null,
          blank_answers: h.blank_answers ?? null,
          blank_filled_output: h.blank_filled_output ?? null,
          points_to: pointId ? { unit_id: pointStep ? unitOfStep(pointStep) : pointId, step_id: pointStep, card_line: h.points_to_card_line ?? null } : null,
          code: h.code ?? (sol ? (step?.code ?? q?.answer_code ?? r?.solution_code ?? null) : null),
          code_line_notes_ko: h.code_line_notes_ko ?? (sol ? (step?.code_line_notes_ko ?? q?.answer_code_line_notes_ko ?? r?.solution_code_line_notes_ko ?? null) : null),
          answer_ko: sol && q ? (q.answer_ko ?? null) : null,
          answer_output: sol && q ? (q.answer_output ?? null) : null,
          source_ko: sol && r ? (r.solution_source_ko ?? null) : null,
          why_ko: h.why_ko ?? null,
        };
      });
  }
  return out;
}

/** 1편 재구성 과제(화면): 과제 글, 확인 셀과 줄별 풀이, 통과 기준, 확인 셀 출력, 기준. 정답 코드는 hints JSON(H4)에만 */
export function publicRebuild(t, hintsByTarget) {
  const hs = hintsByTarget.get(t.rebuild_id) ?? [];
  return {
    rebuild_id: t.rebuild_id,
    title_ko: t.title_ko,
    task_ko: t.task_ko ?? null,
    check_code: t.check_code ?? null,
    check_code_line_notes_ko: t.check_code_line_notes_ko ?? null,
    pass_ko: t.pass_ko ?? null,
    expected: t.check?.expected ?? null,
    reference: t.check?.reference ?? null,
    max_hint_level_for_pass: t.max_hint_level_for_pass,
    hint_levels: hs.map((h) => h.level).sort((a, b) => a - b),
    hint_unlock: hintUnlockOf(hs),
  };
}

export function buildSite(bundle) {
  const lectureList = bundle.lecturesFile ? (listOf(bundle.lecturesFile.data, 'lectures') ?? []) : [];
  const segSteps = bundle.segments?.steps ?? {};
  const details = {};
  for (const lf of bundle.lectureFiles) {
    const d = lf.data;
    const lecture = d.lecture;
    const lid = lecture.lecture_id;
    const steps = [...d.steps].sort(byOrder);
    const questions = d.questions ?? [];
    const hintsByTarget = new Map();
    for (const h of d.hints ?? []) hintsByTarget.set(h.target_id, [...(hintsByTarget.get(h.target_id) ?? []), h]);
    const hints = buildHints(d.hints, { steps, questions, rebuilds: d.rebuild_tasks ?? [], unitOfStep: () => null });
    const answers = buildAnswers(questions);
    const nb = NOTEBOOKS[lid] ?? null;
    details[lid] = {
      lecture: {
        ...pick(lecture, [...LECTURE_KEYS, 'rewards', 'study_hours_ko']),
        objectives: (lecture.objectives ?? []).map((o) => pick(o, OBJECTIVE_KEYS)),
        content_version: contentVersion(lf, lecture),
        notebook: { student: nb?.student ?? null, student_available: !!(nb && bundle.notebookExists?.[nb.student]) },
      },
      mastery_rule: d.mastery_rule,
      steps: steps.map((s) =>
        publicStep(
          s,
          steps,
          hintsByTarget,
          segSteps[s.step_id],
          questions.filter((q) => q.after_step === s.step_id),
        ),
      ),
      questions: questions.map((q) => publicQuestion(q, hintsByTarget)),
      rebuild: (d.rebuild_tasks ?? []).map((t) => publicRebuild(t, hintsByTarget)),
      answers,
      hints,
      code_lines: Object.fromEntries(steps.map((s) => [s.step_id, codeLines(s.code)])),
    };
  }
  // 편별 단계 수: 영상 구간 정본(video-segments.json steps)에서 센다 (랜딩 "수료까지의 길", 단계 수 하드코딩 금지)
  const stepCounts = {};
  for (const e of Object.values(segSteps)) if (e?.lecture_id) stepCounts[e.lecture_id] = (stepCounts[e.lecture_id] ?? 0) + 1;
  const byId = new Map(lectureList.map((l) => [l.lecture_id, l]));
  for (const lid of Object.keys(details)) if (!byId.has(lid)) byId.set(lid, { lecture_id: lid, title_ko: details[lid].lecture.title_ko, video_seconds: details[lid].lecture.video_seconds });
  const extras = bundle.lecturesFile?.data ?? {};
  return {
    source: bundle.source,
    bridgeCards: Array.isArray(extras.bridge_cards) ? extras.bridge_cards : [],
    checkpoints: Array.isArray(extras.checkpoints) ? extras.checkpoints : [],
    lectures: [...byId.values()]
      .map((l) => ({ ...l, video_seconds: l.video_seconds ?? bundle.segments?.lectures?.[l.lecture_id]?.video_seconds ?? null, available: !!details[l.lecture_id] }))
      .sort((a, b) => a.lecture_id.localeCompare(b.lecture_id)),
    details,
    stepCounts,
  };
}

let cached = null;

/**
 * Astro 페이지가 부른다. 검사에 실패하면 빌드를 멈춘다
 * @returns {import('./types').Site}
 */
export function loadSite() {
  if (cached) return cached;
  const bundle = readBundle(resolvePaths());
  const report = validateBundle(bundle);
  if (report.errors.length) throw new Error(`콘텐츠 검사 실패. npm run check:content 로 자세히 보세요.\n${formatReport(report, bundle.source, bundle.contentDir)}`);
  cached = buildSite(bundle);
  return cached;
}
