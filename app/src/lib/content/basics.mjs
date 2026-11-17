// 사전 기초 콘텐츠 검사·화면 데이터 (spec 8절, 정본 inputs/pedagogy/content/F.json 하나만 읽는다. 클로드 버전 2026-11-17).
// 모양은 1편 L01.json 과 같은 최상위 키에 lecture.units(설명 카드)·diagnostic·recommend_rules·lecture_prereq_units 와 칸마다 unit_id 를 더한 것.
// 1편 로더와 같은 방식: 묶음을 읽고 → 검사(어기면 빌드 실패, 모르는 칸은 경고) → 화면이 쓰는 모양으로 바꾼다. 단계·문항 화면 데이터는 1편과 같은 함수(build.mjs)로 만든다.
// 풀이(answer_ko, 정답 번호, 채점 값, 정답 코드)와 힌트 본문은 페이지에 넣지 않고 /data/F/answers.json·hints.json 으로 늦게 불러온다(칸 분류는 fields.mjs).
import crypto from 'node:crypto';
import { BASICS, MASTERY_EXCLUDED_KINDS } from '../../content-config.mjs';
import { buildAnswers, buildHints, hintUnlockOf, publicQuestion, publicStep } from './build.mjs';
import { reconstructCell } from './cells.mjs';
import { readBasicsBundle, resolveBasicsPath } from './load.mjs';
import {
  BASICS_ID,
  KNOWN,
  basicsFileSchema,
  basicsLectureSchema,
  basicsMasteryRuleSchema,
  basicsQuestionSchema,
  basicsRebuildSchema,
  basicsStepSchema,
  basicsUnitSchema,
  hintSchema,
} from './schema.mjs';
import { codeLines, hintShapeIssues, notesMismatch, stepCellIssues, strings, zodIssues } from './validate.mjs';

export const BASICS_RULES = {
  1: '스키마와 id 모양(최상위 키 7개, F-P1-S1·F-P1-S2b·F-P1-Q1·F-P1-R1·F-D1·{대상}-H{n})',
  2: '단위 목록(id 머리말과 kind, 중복 없음)',
  3: '단위 상태와 id 목록(status 없음·written: 내용 있음 / planned: 0건, step_ids·question_ids·rebuild_ids·objective_ids = 실제 항목)',
  4: '진단(약속 값, 문항 목록, 보기·정답 번호, 모르겠어요, 직접 입력 exact, 추천 단위, 힌트 없음)',
  5: '영상 없음(video_segments 빈 목록)',
  6: 'id 중복, 참조 대상(같은 단위 안), 힌트가 가리키는 단위와 설명 카드 문장',
  7: '긴 줄표(U+2014) 금지',
  8: '확인 문제 풀이·채점(answer_ko, rubric, 정답 코드 줄별 풀이, 실행 결과로 채점하면 정답 = answer_output)',
  9: '코드 줄 수 = 줄별 풀이 개수, 긴 단계 규칙, 셀 줄 수 합',
  10: '힌트 개수(단계 H1~H2 이상, 확인 문제·익힘 과제 H1~H4)',
  11: '익힘 규칙(mastery_rule)',
  12: '편별 선행 기초 단위(lecture_prereq_units, 강의 prereq_units)가 기초 단위 목록에 있고 서로 같음',
  13: '추천 규칙(앱이 아는 규칙, "처음이면 먼저" 단위 = recommend_first 단위)',
};

export const TOP_KEYS = ['_meta', 'lecture', 'steps', 'questions', 'rebuild_tasks', 'mastery_rule', 'hints'];

const nonEmpty = (s) => typeof s === 'string' && s.trim() !== '';
const groupOf = (unit) => BASICS.groups.find((g) => g.id === unit?.kind)?.id ?? null;

/** 화면에서 내용을 여는 단위: status 가 없거나 written. planned 만 "준비 중" */
export const isOpenUnit = (u) => u?.status !== 'planned';

export function validateBasics(bb) {
  const errors = [];
  const warnings = [];
  const err = (rule, message) => errors.push({ rule, file: bb.file?.path ?? BASICS.file, message });
  const warn = (message) => warnings.push({ file: bb.file?.path ?? BASICS.file, message });
  for (const p of bb.parseErrors ?? []) errors.push({ rule: 1, file: p.path, message: `읽기 실패: ${p.message}` });
  const d = bb.file?.data;
  const empty = { units: 0, written: 0, planned: 0, steps: 0, questions: 0, diagnostic: 0, rebuild: 0, hints: 0 };
  if (!d || typeof d !== 'object') return { errors, warnings, stats: empty };

  // 1 최상위 키 7개 (모르는 키는 경고)
  for (const k of TOP_KEYS) if (!(k in d)) err(1, `최상위 키 ${k}가 없습니다`);
  for (const k of Object.keys(d)) if (!TOP_KEYS.includes(k)) warn(`최상위: 모르는 키 "${k}"`);
  for (const m of zodIssues(basicsFileSchema.safeParse(d))) err(1, m);
  const lecture = d.lecture ?? {};
  for (const m of zodIssues(basicsLectureSchema.safeParse(lecture))) err(1, `lecture.${m}`);
  for (const m of zodIssues(basicsMasteryRuleSchema.safeParse(d.mastery_rule ?? {}))) err(11, `mastery_rule.${m}`);
  if (Array.isArray(lecture.video_segments) && lecture.video_segments.length) err(5, 'lecture.video_segments 는 빈 목록이어야 합니다');
  const units = Array.isArray(lecture.units) ? lecture.units : [];
  const steps = Array.isArray(d.steps) ? d.steps : [];
  const questions = Array.isArray(d.questions) ? d.questions : [];
  const hints = Array.isArray(d.hints) ? d.hints : [];
  const rebuilds = Array.isArray(d.rebuild_tasks) ? d.rebuild_tasks : [];
  const objectives = Array.isArray(lecture.objectives) ? lecture.objectives : [];

  const seen = new Set();
  const claim = (id) => {
    if (seen.has(id)) err(6, `id 중복: ${id}`);
    else seen.add(id);
  };

  // 2 단위: id 머리말(F-P 파이썬, F-M 수학)과 kind 가 맞아야
  const unitById = new Map();
  units.forEach((u, i) => {
    for (const m of zodIssues(basicsUnitSchema.safeParse(u))) err(1, `units[${i}] ${u?.unit_id ?? ''} ${m}`);
    if (!u || typeof u !== 'object') return;
    for (const k of Object.keys(u)) if (!KNOWN.basicsUnit.has(k)) warn(`${u.unit_id ?? `units[${i}]`}: 모르는 칸 "${k}"`);
    if (u.unit_id) {
      claim(u.unit_id);
      unitById.set(u.unit_id, u);
      const g = BASICS.groups.find((x) => x.id === u.kind);
      if (g && !String(u.unit_id).startsWith(g.prefix)) err(2, `${u.unit_id}: kind ${u.kind}이면 id 가 ${g.prefix} 로 시작해야 합니다`);
    }
  });
  if (!units.length) err(2, '단위 목록이 비었습니다');

  // 목표: 단위의 objective_ids 와 lecture.objectives 의 unit_id 가 서로 맞아야
  const objectiveById = new Map(objectives.filter((o) => o?.objective_id).map((o) => [o.objective_id, o]));
  for (const o of objectives) {
    if (o?.objective_id) claim(o.objective_id);
    if (o?.unit_id && !unitById.has(o.unit_id)) err(6, `${o.objective_id}: unit_id ${o.unit_id}가 단위 목록에 없습니다`);
  }

  // 힌트
  const stepIds = new Set(steps.map((s) => s?.step_id).filter(Boolean));
  const questionIds = new Set(questions.map((q) => q?.question_id).filter(Boolean));
  const rebuildIds = new Set(rebuilds.map((r) => r?.rebuild_id).filter(Boolean));
  const stepById = new Map(steps.filter((s) => s?.step_id).map((s) => [s.step_id, s]));
  const hintIds = new Set();
  const levelsByTarget = new Map();
  hints.forEach((h, i) => {
    for (const m of zodIssues(hintSchema.safeParse(h))) err(1, `hints[${i}] ${m}`);
    if (!h || typeof h !== 'object') return;
    for (const k of Object.keys(h)) if (!KNOWN.hint.has(k)) warn(`${h.hint_id ?? `hints[${i}]`}: 모르는 칸 "${k}"`);
    if (h.hint_id) {
      claim(h.hint_id);
      hintIds.add(h.hint_id);
      if (h.target_id && h.level && h.hint_id !== `${h.target_id}-H${h.level}`) err(1, `${h.hint_id}: hint_id 는 ${h.target_id}-H${h.level} 이어야 합니다`);
    }
    if (h.target_id && !stepIds.has(h.target_id) && !questionIds.has(h.target_id) && !rebuildIds.has(h.target_id)) err(6, `${h.hint_id}: 대상 ${h.target_id}가 없습니다`);
    for (const m of hintShapeIssues(h)) err(1, m);
    // H2 가 가리키는 곳: 단위(또는 단계)와 그 단위 설명 카드의 문장 번호
    if (h.points_to_id != null) {
      const u = unitById.get(h.points_to_id) ?? unitById.get(stepById.get(h.points_to_id)?.unit_id);
      if (!u) err(6, `${h.hint_id}: points_to_id ${h.points_to_id}가 단위·단계 목록에 없습니다`);
      else if (h.points_to_card_line != null && h.points_to_card_line > (u.card_ko?.length ?? 0)) err(6, `${h.hint_id}: points_to_card_line ${h.points_to_card_line}이 ${u.unit_id} 설명 카드 문장 수(${u.card_ko?.length ?? 0})를 넘습니다`);
    } else if (h.points_to_card_line != null) err(6, `${h.hint_id}: points_to_card_line 은 points_to_id 와 같이 씁니다`);
    if (h.target_id && Number.isInteger(h.level)) {
      const set = levelsByTarget.get(h.target_id) ?? new Set();
      if (set.has(h.level)) err(6, `${h.target_id}: 힌트 단계 ${h.level}가 두 번 있습니다`);
      set.add(h.level);
      levelsByTarget.set(h.target_id, set);
    }
  });
  for (const [t, lv] of levelsByTarget) {
    const sorted = [...lv].sort((a, b) => a - b);
    if (sorted.some((x, i) => x !== i + 1)) err(6, `${t}: 힌트 단계가 1부터 이어지지 않습니다: ${sorted.join(',')}`);
  }
  const needLevels = (targetId, upTo) => {
    const lv = levelsByTarget.get(targetId) ?? new Set();
    const missing = Array.from({ length: upTo }, (_, i) => i + 1).filter((l) => !lv.has(l));
    if (missing.length) err(10, `${targetId}: 힌트 ${missing.map((l) => `H${l}`).join(', ')}가 없습니다(H1~H${upTo} 필요)`);
  };
  const checkHintIds = (owner, list) => {
    for (const hid of list ?? []) if (!hintIds.has(hid)) err(6, `${owner}: hint_ids 의 ${hid}가 hints 목록에 없습니다`);
  };
  const checkObjectives = (owner, unitId, list) => {
    for (const o of list ?? []) {
      const ob = objectiveById.get(o);
      if (!ob) err(6, `${owner}: objective_ids 의 ${o}가 lecture.objectives 에 없습니다`);
      else if (unitId && ob.unit_id !== unitId) err(6, `${owner}: 목표 ${o}는 다른 단위(${ob.unit_id})의 것입니다`);
    }
  };

  // 단계
  const orders = new Map();
  steps.forEach((s, i) => {
    for (const m of zodIssues(basicsStepSchema.safeParse(s))) err(1, `steps[${i}] ${s?.step_id ?? ''} ${m}`);
    if (!s || typeof s !== 'object') return;
    const sid = s.step_id ?? `steps[${i}]`;
    for (const k of Object.keys(s)) if (!KNOWN.basicsStep.has(k)) warn(`${sid}: 모르는 칸 "${k}"`);
    if (s.step_id) claim(s.step_id);
    if (Number.isInteger(s.order)) {
      if (orders.has(s.order)) err(1, `${sid}: order ${s.order}가 ${orders.get(s.order)}와 겹칩니다`);
      orders.set(s.order, sid);
    }
    if (!unitById.has(s.unit_id)) err(6, `${sid}: unit_id ${s.unit_id}가 단위 목록에 없습니다`);
    else if (s.step_id && !s.step_id.startsWith(`${s.unit_id}-`)) err(6, `${sid}: step_id 가 unit_id(${s.unit_id})로 시작하지 않습니다`);
    if (Array.isArray(s.video_segments) && s.video_segments.length) err(5, `${sid}: 기초 단계에는 영상이 없습니다(video_segments 는 빈 목록)`);
    if (notesMismatch(s.code, s.code_line_notes_ko)) err(9, `${sid}: code ${codeLines(s.code)}줄, code_line_notes_ko ${s.code_line_notes_ko?.length ?? 0}개`);
    if (s.kind !== 'read' && codeLines(s.code) === 0) err(1, `${sid}: ${s.kind} 단계에 코드가 없습니다`);
    if (s.kind === 'read' && codeLines(s.code) > 0) err(1, `${sid}: read 단계에는 코드가 없어야 합니다`);
    if (Number.isInteger(s.new_code_lines) && typeof s.long_step === 'boolean') {
      const n = s.new_code_lines;
      if (n > 10) err(9, `${sid}: new_code_lines ${n}는 10을 넘습니다`);
      else if (n >= 6 && !s.long_step) err(9, `${sid}: new_code_lines ${n}(6~10)이면 long_step: true`);
      else if (n <= 5 && s.long_step) err(9, `${sid}: new_code_lines ${n}(0~5)이면 long_step: false`);
    }
    const editLines = (s.edits ?? []).reduce((a, e) => a + (e?.line_count ?? 0), 0);
    if (editLines > codeLines(s.code)) err(1, `${sid}: edits 줄 수 합(${editLines})이 code 줄 수(${codeLines(s.code)})보다 큽니다`);
    // 같은 단위 안의 단계만 셀 순서·위치로 가리킨다
    const unitSteps = new Map(steps.filter((x) => x?.unit_id === s.unit_id && x.step_id).map((x) => [x.step_id, x]));
    for (const x of stepCellIssues(s, unitSteps)) err(x.kind === 'lines' ? 9 : 6, x.message);
    if ((s.kind === 'code' || s.kind === 'optional') && s.step_id) needLevels(s.step_id, 2);
    checkHintIds(sid, s.hint_ids);
    checkObjectives(sid, s.unit_id, s.objective_ids);
  });
  // 같은 단위 안 참조 (edits, rerun_first), 고칠 기준 줄
  for (const s of steps) {
    if (!s?.step_id) continue;
    for (const x of [...(s.edits ?? []).map((e) => e?.target_step), ...(s.rerun_first ?? [])]) {
      const t = stepById.get(x);
      if (!t) err(6, `${s.step_id}: ${x}가 단계 목록에 없습니다`);
      else if (t.unit_id !== s.unit_id) err(6, `${s.step_id}: ${x}는 다른 단위의 단계입니다`);
    }
    if ((s.edits ?? []).length) {
      const unitSteps = steps.filter((x) => x?.unit_id === s.unit_id);
      for (const t of new Set(s.edits.map((e) => e.target_step))) if (stepById.has(t) && !reconstructCell(unitSteps, s, t).ok) err(6, `${s.step_id}: ${t} 셀에서 고칠 기준 줄을 찾지 못했습니다`);
    }
  }

  // 문항
  const diag = lecture.diagnostic ?? {};
  for (const [k, v] of Object.entries(BASICS.diagnosticPromises)) if (diag[k] !== v) err(4, `diagnostic.${k} 는 ${v} 여야 합니다(앱은 추천만 하고 잠금·힌트가 없습니다)`);
  const diagIds = Array.isArray(diag.question_ids) ? diag.question_ids : [];
  const diagFound = [];
  const questionsByUnit = new Map();
  questions.forEach((q, i) => {
    for (const m of zodIssues(basicsQuestionSchema.safeParse(q))) err(1, `questions[${i}] ${q?.question_id ?? ''} ${m}`);
    if (!q || typeof q !== 'object') return;
    const qid = q.question_id ?? `questions[${i}]`;
    for (const k of Object.keys(q)) if (!KNOWN.basicsQuestion.has(k)) warn(`${qid}: 모르는 칸 "${k}"`);
    if (q.question_id) claim(q.question_id);
    const lv = levelsByTarget.get(q.question_id)?.size ?? 0;
    const isDiag = q.unit_id === BASICS.diagnosticUnitId;
    const rule = isDiag ? 4 : 8;
    if (q.type === 'choice') {
      if (!Array.isArray(q.choices) || q.choices.length < 2) err(rule, `${qid}: choices 가 2개 이상이어야 합니다`);
      if (!Number.isInteger(q.answer_index) || (Array.isArray(q.choices) && (q.answer_index < 0 || q.answer_index >= q.choices.length))) err(rule, `${qid}: answer_index ${q.answer_index}가 보기 범위 밖입니다`);
      if (q.auto_grade?.type !== 'choice') err(rule, `${qid}: choice 문항은 auto_grade.type 이 choice 여야 합니다`);
    }
    if (q.dont_know_index != null && !(q.type === 'choice' && Array.isArray(q.choices) && q.dont_know_index < q.choices.length && q.dont_know_index !== q.answer_index))
      err(rule, `${qid}: dont_know_index 는 정답이 아닌 보기 번호여야 합니다`);
    if (q.allow_dont_know != null && q.type === 'choice') err(rule, `${qid}: allow_dont_know 는 직접 입력 문항에만 씁니다(고르기는 dont_know_index)`);
    if (!nonEmpty(q.answer_ko)) err(rule, `${qid}: answer_ko 가 없습니다`);
    if (q.answer_code != null && notesMismatch(q.answer_code, q.answer_code_line_notes_ko)) err(8, `${qid}: answer_code ${codeLines(q.answer_code)}줄, 줄별 풀이 ${q.answer_code_line_notes_ko?.length ?? 0}개`);
    if (isDiag) {
      diagFound.push(q.question_id);
      if (!BASICS_ID.diagnostic.test(String(q.question_id))) err(1, `${qid}: 진단 문항 id 는 F-D{번호}`);
      if (!diagIds.includes(q.question_id)) err(4, `${qid}: lecture.diagnostic.question_ids 에 없습니다`);
      if (q.type === 'predict') {
        if (q.auto_grade?.type !== 'exact' || q.auto_grade?.value == null || String(q.auto_grade.value).trim() === '') err(4, `${qid}: 직접 입력 문항은 auto_grade 가 exact(값 있음)여야 합니다`);
        // 설계서 2-3: 모든 진단 문제에서 "모르겠어요"를 고를 수 있다
        if (q.allow_dont_know !== true) err(4, `${qid}: 진단 직접 입력 문항은 allow_dont_know: true 여야 합니다(모르겠어요 단추)`);
      } else if (q.type === 'choice') {
        if (q.dont_know_index == null) err(4, `${qid}: 진단 고르기 문항은 dont_know_index(모르겠어요 보기 번호)가 있어야 합니다`);
      } else err(4, `${qid}: 진단 문항은 choice 또는 predict 만 씁니다`);
      const rec = q.recommend_units_if_wrong;
      if (!Array.isArray(rec) || rec.length === 0) err(4, `${qid}: recommend_units_if_wrong 이 비었습니다`);
      for (const u of rec ?? []) if (!unitById.has(u)) err(4, `${qid}: 추천 단위 ${u}가 단위 목록에 없습니다`);
      if ((q.hint_ids ?? []).length || lv) err(4, `${qid}: 진단 문항에는 힌트가 없어야 합니다`);
      if (q.after_step) err(4, `${qid}: 진단 문항에는 after_step 이 없어야 합니다`);
      return;
    }
    if (!unitById.has(q.unit_id)) err(6, `${qid}: unit_id ${q.unit_id}가 단위 목록에 없습니다`);
    else if (q.question_id && !String(q.question_id).startsWith(`${q.unit_id}-`)) err(6, `${qid}: question_id 가 unit_id(${q.unit_id})로 시작하지 않습니다`);
    if (!BASICS_ID.question.test(String(q.question_id))) err(1, `${qid}: 확인 문제 id 는 F-P1-Q1 모양`);
    if (!q.after_step) err(6, `${qid}: after_step 이 없어 단계 화면에 나오지 않습니다`);
    else if (!stepById.has(q.after_step)) err(6, `${qid}: after_step ${q.after_step}가 단계 목록에 없습니다`);
    else if (stepById.get(q.after_step).unit_id !== q.unit_id) err(6, `${qid}: after_step ${q.after_step}가 다른 단위의 단계입니다`);
    if (['keywords', 'manual'].includes(q.auto_grade?.type) && (!Array.isArray(q.rubric) || !q.rubric.length)) err(8, `${qid}: ${q.auto_grade.type} 채점에는 rubric 이 필요합니다`);
    // 실행 결과로 채점하는 문항: 정답(value·accept 중 하나)이 정답 코드의 출력과 같아야 한다
    if (q.graded_on === 'output') {
      const ok = [q.auto_grade?.value, ...(q.auto_grade?.accept ?? [])].some((v) => v != null && String(v) === q.answer_output);
      if (!ok) err(8, `${qid}: graded_on output 인데 정답 값이 answer_output 과 다릅니다`);
    }
    if (q.recommend_units_if_wrong != null) warn(`${qid}: recommend_units_if_wrong 은 진단 문항에만 씁니다`);
    // 확인 문제는 유형과 상관없이 H1~H4 (설계서 2-2)
    if (q.question_id) needLevels(q.question_id, 4);
    checkHintIds(qid, q.hint_ids);
    checkObjectives(qid, q.unit_id, q.objective_ids);
    const list = questionsByUnit.get(q.unit_id) ?? [];
    list.push(q);
    questionsByUnit.set(q.unit_id, list);
  });
  for (const id of diagIds) if (!diagFound.includes(id)) err(4, `lecture.diagnostic.question_ids 의 ${id}가 문항 목록에 없습니다(unit_id ${BASICS.diagnosticUnitId})`);
  if (new Set(diagIds).size !== diagIds.length) err(4, 'lecture.diagnostic.question_ids 에 같은 문항이 두 번 있습니다');

  // 익힘 과제(rebuild_tasks)
  rebuilds.forEach((r, i) => {
    for (const m of zodIssues(basicsRebuildSchema.safeParse(r))) err(1, `rebuild_tasks[${i}] ${r?.rebuild_id ?? ''} ${m}`);
    if (!r || typeof r !== 'object') return;
    const rid = r.rebuild_id ?? `rebuild_tasks[${i}]`;
    for (const k of Object.keys(r)) if (!KNOWN.basicsRebuild.has(k)) warn(`${rid}: 모르는 칸 "${k}"`);
    if (r.rebuild_id) claim(r.rebuild_id);
    if (!unitById.has(r.unit_id)) err(6, `${rid}: unit_id ${r.unit_id}가 단위 목록에 없습니다`);
    else if (r.rebuild_id && !r.rebuild_id.startsWith(`${r.unit_id}-`)) err(6, `${rid}: rebuild_id 가 unit_id(${r.unit_id})로 시작하지 않습니다`);
    if (notesMismatch(r.solution_code, r.solution_code_line_notes_ko)) err(9, `${rid}: solution_code ${codeLines(r.solution_code)}줄, 줄별 풀이 ${r.solution_code_line_notes_ko?.length ?? 0}개`);
    if (Array.isArray(r.cell_line_counts) && r.cell_line_counts.reduce((a, n) => a + n, 0) !== codeLines(r.solution_code)) err(9, `${rid}: cell_line_counts 합이 solution_code 줄 수와 다릅니다`);
    if (r.rebuild_id) needLevels(r.rebuild_id, 4);
    checkHintIds(rid, r.hint_ids);
  });

  // 3 단위 상태와 단위의 id 목록(양방향)
  const sameSet = (a, b) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
  for (const u of units) {
    if (!u?.unit_id) continue;
    const st = steps.filter((s) => s?.unit_id === u.unit_id).map((s) => s.step_id);
    const qs = (questionsByUnit.get(u.unit_id) ?? []).map((q) => q.question_id);
    const rs = rebuilds.filter((r) => r?.unit_id === u.unit_id).map((r) => r.rebuild_id);
    const os = objectives.filter((o) => o?.unit_id === u.unit_id).map((o) => o.objective_id);
    if (!sameSet(u.step_ids, st)) err(3, `${u.unit_id}: step_ids(${(u.step_ids ?? []).join(',')})가 이 단위의 단계(${st.join(',')})와 다릅니다`);
    if (!sameSet(u.question_ids, qs)) err(3, `${u.unit_id}: question_ids 가 이 단위의 문항과 다릅니다`);
    if (!sameSet(u.rebuild_ids, rs)) err(3, `${u.unit_id}: rebuild_ids 가 이 단위의 익힘 과제와 다릅니다`);
    if (!sameSet(u.objective_ids, os)) err(3, `${u.unit_id}: objective_ids 가 이 단위의 목표와 다릅니다`);
    if (isOpenUnit(u)) {
      if (!st.length) err(3, `${u.unit_id}: 내용 있는 단위(status 없음·written)에 단계가 없습니다`);
    } else if (st.length || qs.length || rs.length) err(3, `${u.unit_id}: planned 단위에 단계·문항·익힘 과제가 있습니다(내용 0건이어야 함)`);
  }

  // 12 편별 선행 기초 단위
  for (const [lid, list] of Object.entries(lecture.lecture_prereq_units ?? {})) for (const u of list ?? []) if (!unitById.has(u)) err(12, `lecture_prereq_units.${lid}: ${u}가 단위 목록에 없습니다`);

  // 13 추천 규칙: 앱이 아는 규칙 이름(스키마), "처음이면 먼저" 단위 = recommend_first 단위
  const rules = Array.isArray(lecture.recommend_rules) ? lecture.recommend_rules : [];
  const first = rules.find((r) => r?.rule_id === 'always_first');
  if (!first) err(13, 'recommend_rules 에 always_first(처음이면 먼저)가 없습니다');
  else {
    for (const u of first.units ?? []) if (!unitById.has(u)) err(13, `always_first: ${u}가 단위 목록에 없습니다`);
    const flagged = units.filter((u) => u?.recommend_first).map((u) => u.unit_id);
    if (!sameSet(first.units, flagged)) err(13, `always_first 단위(${(first.units ?? []).join(',')})가 recommend_first 단위(${flagged.join(',')})와 다릅니다`);
  }
  if (!rules.some((r) => r?.rule_id === 'diagnostic')) err(13, 'recommend_rules 에 diagnostic(진단 결과)이 없습니다');

  // 7 긴 줄표
  for (const [at, v] of strings(d)) if (v.includes('\u2014')) err(7, `${at}: 긴 줄표(U+2014)가 있습니다`);

  return {
    errors,
    warnings,
    stats: {
      units: units.length,
      written: units.filter(isOpenUnit).length,
      planned: units.filter((u) => !isOpenUnit(u)).length,
      steps: stepIds.size,
      questions: questions.length,
      diagnostic: diagIds.length,
      rebuild: rebuilds.length,
      hints: hints.length,
    },
  };
}

/** 강의 정본의 선행 기초 단위(prereq_units)가 기초 단위 목록에 있고, 기초 정본 lecture_prereq_units[편] 과 같은지 (규칙 12) */
export function checkPrereqUnits(lectureFiles, basicsData) {
  const ids = new Set((basicsData?.lecture?.units ?? []).map((u) => u?.unit_id));
  const table = basicsData?.lecture?.lecture_prereq_units ?? {};
  const out = [];
  for (const lf of lectureFiles ?? []) {
    const L = lf?.data?.lecture;
    if (!L) continue;
    for (const u of [...(L.prereq_units ?? []), ...(L.prereq_units_optional ?? [])])
      if (!ids.has(u)) out.push({ rule: 12, file: lf.path, message: `${L.lecture_id} prereq ${u}가 기초 단위 목록(F.json lecture.units)에 없습니다` });
    const want = table[L.lecture_id];
    if (want && JSON.stringify([...want].sort()) !== JSON.stringify([...(L.prereq_units ?? [])].sort()))
      out.push({ rule: 12, file: lf.path, message: `${L.lecture_id} prereq_units 가 F.json lecture_prereq_units.${L.lecture_id}와 다릅니다` });
  }
  return out;
}

export function formatBasicsReport({ errors, warnings, stats }, bb) {
  const file = bb.file?.path ?? BASICS.file;
  const out = [
    `기초 콘텐츠 검사 (${file}): 단위 ${stats.units}개(내용 있음 ${stats.written}, 준비 중 ${stats.planned}), 단계 ${stats.steps}개, 문항 ${stats.questions}개(진단 ${stats.diagnostic} 포함), 익힘 과제 ${stats.rebuild}개, 힌트 ${stats.hints}개`,
  ];
  for (const e of errors) out.push(`  ✕ 규칙 ${e.rule} ${BASICS_RULES[e.rule]} | ${e.file} | ${e.message}`);
  for (const w of warnings) out.push(`  △ 경고 | ${w.file} | ${w.message}`);
  out.push(errors.length ? `실패: 오류 ${errors.length}건, 경고 ${warnings.length}건` : `통과: 오류 0건, 경고 ${warnings.length}건`);
  return out.join('\n');
}

const byOrder = (a, b) => a.order - b.order;
/** 단계 주소 끝: F-P1-S2b → S2b (/basics/F-P1/S2b/) */
export const basicsStepSlug = (stepId) => String(stepId).split('-').pop();

/** 검사를 통과한 묶음 → 화면 데이터. 공개 칸(페이지에 들어감)에는 풀이·정답 번호·채점 값·정답 코드·힌트 본문이 없다 */
export function buildBasics(bb) {
  const d = bb.file.data;
  const lecture = d.lecture;
  const units = lecture.units;
  const allSteps = [...(d.steps ?? [])].sort(byOrder);
  const questions = d.questions ?? [];
  const rebuilds = d.rebuild_tasks ?? [];
  const MR = d.mastery_rule;
  const excluded = new Set(MASTERY_EXCLUDED_KINDS);
  const contentVersion = `F-${d._meta?.version ?? 'x'}-${crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex').slice(0, 12)}`;
  const hintsByTarget = new Map();
  for (const h of d.hints ?? []) hintsByTarget.set(h.target_id, [...(hintsByTarget.get(h.target_id) ?? []), h]);
  const levelsOf = (id) => (hintsByTarget.get(id) ?? []).map((h) => h.level).sort((a, b) => a - b);
  const unlockOf = (id) => hintUnlockOf(hintsByTarget.get(id) ?? []);
  const open = new Set(units.filter(isOpenUnit).map((u) => u.unit_id));
  const objectiveText = new Map((lecture.objectives ?? []).map((o) => [o.objective_id, o.text_ko]));

  const stepsOut = {};
  const questionsOut = {};
  const rebuildOut = {};
  for (const u of units) {
    if (!open.has(u.unit_id)) continue;
    const us = allSteps.filter((s) => s.unit_id === u.unit_id);
    // 1편과 같은 단계 데이터. order 는 단위 안 번호(1부터), 정본 전체 번호는 global_order
    stepsOut[u.unit_id] = us.map((s, i) => ({
      ...publicStep(s, us, hintsByTarget, null, questions.filter((q) => q.after_step === s.step_id), basicsStepSlug),
      order: i + 1,
      global_order: s.order,
    }));
    questionsOut[u.unit_id] = questions.filter((q) => q.unit_id === u.unit_id).map((q) => publicQuestion(q, hintsByTarget));
    rebuildOut[u.unit_id] = rebuilds
      .filter((r) => r.unit_id === u.unit_id)
      .map((r) => ({
        rebuild_id: r.rebuild_id,
        title_ko: r.title_ko,
        task_ko: r.prompt_ko,
        reference_ko: r.check?.reference ?? null,
        cell_line_counts: r.cell_line_counts ?? null,
        expected_output_example: r.expected_output_example ?? null,
        self_check_ko: r.self_check_ko ?? [],
        required_for_mastery: MR.rebuild_required === true || r.required_for_mastery === true,
        max_hint_level_for_pass: r.max_hint_level_for_pass ?? null,
        hint_levels: levelsOf(r.rebuild_id),
        hint_unlock: unlockOf(r.rebuild_id),
      }));
  }

  const unitOfStep = (id) => allSteps.find((s) => s.step_id === id)?.unit_id ?? null;
  const hints = buildHints(d.hints, { steps: allSteps, questions, rebuilds, unitOfStep });
  const answers = buildAnswers(questions);
  const rules = Object.fromEntries((lecture.recommend_rules ?? []).map((r) => [r.rule_id, { label_ko: r.label_ko, when_ko: r.when_ko, units: r.units ?? [] }]));
  const unitsOut = units.map((u) => {
    const ready = open.has(u.unit_id);
    const st = ready ? stepsOut[u.unit_id] : [];
    return {
      unit_id: u.unit_id,
      group: groupOf(u),
      title_ko: u.title_ko,
      status: u.status ?? 'written',
      ready,
      goal_ko: u.goal_ko,
      analogy_ko: u.analogy_ko,
      card_ko: u.card_ko,
      needed_by_lectures: u.needed_by_lectures ?? [],
      recommend_first: !!u.recommend_first,
      estimated_minutes: u.estimated_minutes,
      objectives: (u.objective_ids ?? []).map((o) => objectiveText.get(o)).filter(Boolean),
      // 익힘 판정에 쓰는 것 (lib/basics.ts unitMastery). 선택(optional) 단계는 step_ids 에서 빼고, 익힘 과제는 판정에 넣는 것만
      mastery: {
        step_ids: st.filter((s) => !excluded.has(s.kind)).map((s) => s.step_id),
        activity_step_ids: st.map((s) => s.step_id),
        questions: (ready ? questionsOut[u.unit_id] : []).map((q) => ({ question_id: q.question_id, max_points: q.max_points, must_pass: q.must_pass })),
        rebuilds: (ready ? rebuildOut[u.unit_id] : []).filter((r) => r.required_for_mastery).map((r) => ({ rebuild_id: r.rebuild_id, max_hint_level_for_pass: r.max_hint_level_for_pass })),
        activity_rebuild_ids: (ready ? rebuildOut[u.unit_id] : []).map((r) => r.rebuild_id),
      },
    };
  });
  const diag = lecture.diagnostic;
  return {
    file: bb.file.path,
    lecture_id: lecture.lecture_id,
    title_ko: lecture.title_ko,
    intro_ko: lecture.intro_ko,
    content_version: contentVersion,
    unitOrder: units.map((u) => u.unit_id),
    readyIds: units.filter((u) => open.has(u.unit_id)).map((u) => u.unit_id),
    groups: BASICS.groups.map((g) => ({ id: g.id, label_ko: g.label_ko, unit_ids: units.filter((u) => groupOf(u) === g.id).map((u) => u.unit_id) })),
    rule: { steps_complete_ratio: MR.steps_complete_ratio, question_score_ratio: MR.question_score_ratio, rebuild_max_hint_level: MR.rebuild_max_hint_level, note_ko: MR.note_ko },
    recommend: rules,
    lecturePrereq: lecture.lecture_prereq_units ?? {},
    units: unitsOut,
    diagnostic: {
      rules_ko: diag.rules_ko,
      result_if_correct_ko: diag.result_if_correct_ko,
      result_if_wrong_ko: diag.result_if_wrong_ko,
      questions: diag.question_ids.map((id) => {
        const q = questions.find((x) => x.question_id === id);
        return {
          question_id: q.question_id,
          type: q.type,
          prompt_ko: q.prompt_ko,
          code: q.code ?? null,
          choices: q.type === 'choice' ? q.choices : null,
          recommend_units_if_wrong: q.recommend_units_if_wrong,
          // 고르기의 "모르겠어요" 보기 번호, 직접 입력의 "모르겠어요" 단추(정본 dont_know_index·allow_dont_know)
          dont_know_index: q.dont_know_index ?? null,
          allow_dont_know: q.allow_dont_know === true,
        };
      }),
    },
    steps: stepsOut,
    questions: questionsOut,
    rebuild: rebuildOut,
    answers,
    hints,
    counts: { steps: allSteps.length, questions: questions.length, rebuild: rebuilds.length, hints: (d.hints ?? []).length },
  };
}

let cached = null;

/**
 * Astro 페이지가 부른다. 검사에 실패하면 빌드를 멈추고, 처음 읽을 때 어느 파일을 읽었는지 한 줄 남긴다
 * @returns {import('./types').BasicsSite}
 */
export function loadBasics() {
  if (cached) return cached;
  const bb = readBasicsBundle(resolveBasicsPath());
  const report = validateBasics(bb);
  if (report.errors.length) throw new Error(`기초 콘텐츠 검사 실패. npm run check:content 로 자세히 보세요.\n${formatBasicsReport(report, bb)}`);
  cached = buildBasics(bb);
  const c = cached.counts;
  console.log(`[기초] ${bb.file.path} 를 읽었습니다: 단계 ${c.steps}, 문항 ${c.questions}, 익힘 과제 ${c.rebuild}, 힌트 ${c.hints}, 여는 단위 ${cached.readyIds.length}개`);
  return cached;
}
