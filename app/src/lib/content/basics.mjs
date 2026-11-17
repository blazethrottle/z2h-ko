// 사전 기초 콘텐츠 검사·화면 데이터 (spec 8절, 교사 정본 inputs/pedagogy/content/F.json 하나만 읽는다).
// 모양은 1편 L01.json 과 같은 data-spec v1.2 에 F 추가 칸(unit_id, read_first_ko, lecture.units, lecture.diagnostic, expected_check error_match, figure)을 더한 것.
// 1편 로더와 같은 방식: 묶음을 읽고 → 검사(어기면 빌드 실패, 모르는 칸은 경고) → 화면이 쓰는 모양으로 바꾼다. 단계·문항 화면 데이터는 1편과 같은 함수(build.mjs)로 만든다.
// 풀이(answer_ko, 정답 번호, 채점 값)와 힌트 본문은 페이지에 넣지 않고 /data/F/answers.json·hints.json 으로 늦게 불러온다.
import crypto from 'node:crypto';
import { BASICS } from '../../content-config.mjs';
import { publicQuestion, publicStep, reconstructCell } from './build.mjs';
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
import { codeLines, strings, zodIssues } from './validate.mjs';

export const BASICS_RULES = {
  1: '스키마와 id 모양(최상위 키 7개, F-P1-S01·F-P1-Q1·F-P1-R1·F-D1·{대상}-H{n})',
  2: '단위 지도(15단위, 순서)',
  3: '단위 상태와 id 목록(written: 내용 있음 / planned: 내용 0건, step_ids·question_ids·rebuild_ids = 실제 항목)',
  4: '진단(약속 값, 문항 목록, 보기·정답 번호, 직접 입력 exact, 추천 단위, 힌트 없음)',
  5: '영상 없음(video_segments 빈 목록)',
  6: 'id 중복, 참조 대상(같은 단위 안)',
  7: '긴 줄표(U+2014) 금지',
  8: '확인 문제 풀이·채점',
  9: '코드 줄 수 = 줄별 풀이 개수, 긴 단계 규칙',
  10: '힌트 개수(코드·선택 단계, 설명·버그·적용 문제 H1~H4, 예측 0개)',
  11: '익힘 규칙(mastery_rule, review 값)',
  12: '1편 선행 기초 단위(prereq_units)가 기초 단위 목록에 있음',
};

export const TOP_KEYS = ['_meta', 'lecture', 'steps', 'questions', 'rebuild_tasks', 'mastery_rule', 'hints'];

const nonEmpty = (s) => typeof s === 'string' && s.trim() !== '';
const groupOf = (unitId) => BASICS.groups.find((g) => String(unitId).startsWith(g.prefix))?.id ?? null;

/** 화면에서 내용을 여는 단위: 정본 status written */
export const isOpenUnit = (u) => u?.status === 'written';

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

  const seen = new Set();
  const claim = (id) => {
    if (seen.has(id)) err(6, `id 중복: ${id}`);
    else seen.add(id);
  };

  // 단위
  const unitById = new Map();
  units.forEach((u, i) => {
    for (const m of zodIssues(basicsUnitSchema.safeParse(u))) err(1, `units[${i}] ${u?.unit_id ?? ''} ${m}`);
    if (!u || typeof u !== 'object') return;
    for (const k of Object.keys(u)) if (!KNOWN.basicsUnit.has(k)) warn(`${u.unit_id ?? `units[${i}]`}: 모르는 칸 "${k}"`);
    if (u.unit_id) {
      claim(u.unit_id);
      unitById.set(u.unit_id, u);
    }
  });
  const ids = units.map((u) => u?.unit_id);
  if (JSON.stringify(ids) !== JSON.stringify(BASICS.unitMap)) err(2, `단위 목록이 단위 지도(${BASICS.unitMap.join(', ')})와 다릅니다: ${ids.join(', ')}`);

  // 힌트
  const stepIds = new Set(steps.map((s) => s?.step_id).filter(Boolean));
  const questionIds = new Set(questions.map((q) => q?.question_id).filter(Boolean));
  const rebuildIds = new Set(rebuilds.map((r) => r?.rebuild_id).filter(Boolean));
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
    if (h.code_with_blanks != null && h.level !== 3) err(1, `${h.hint_id}: code_with_blanks 는 3단계에서만 씁니다`);
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
  const needH1toH4 = (targetId) => {
    const lv = levelsByTarget.get(targetId) ?? new Set();
    const missing = [1, 2, 3, 4].filter((l) => !lv.has(l));
    if (missing.length) err(10, `${targetId}: 힌트 ${missing.map((l) => `H${l}`).join(', ')}가 없습니다(H1~H4 모두 필요)`);
  };
  const checkHintIds = (owner, list) => {
    for (const hid of list ?? []) if (!hintIds.has(hid)) err(6, `${owner}: hint_ids 의 ${hid}가 hints 목록에 없습니다`);
  };

  // 단계
  const stepById = new Map();
  const orders = new Map();
  steps.forEach((s, i) => {
    for (const m of zodIssues(basicsStepSchema.safeParse(s))) err(1, `steps[${i}] ${s?.step_id ?? ''} ${m}`);
    if (!s || typeof s !== 'object') return;
    const sid = s.step_id ?? `steps[${i}]`;
    for (const k of Object.keys(s)) if (!KNOWN.basicsStep.has(k)) warn(`${sid}: 모르는 칸 "${k}"`);
    if (s.step_id) {
      claim(s.step_id);
      stepById.set(s.step_id, s);
    }
    if (Number.isInteger(s.order)) {
      if (orders.has(s.order)) err(1, `${sid}: order ${s.order}가 ${orders.get(s.order)}와 겹칩니다`);
      orders.set(s.order, sid);
    }
    if (!unitById.has(s.unit_id)) err(6, `${sid}: unit_id ${s.unit_id}가 단위 목록에 없습니다`);
    else if (s.step_id && !s.step_id.startsWith(`${s.unit_id}-`)) err(6, `${sid}: step_id 가 unit_id(${s.unit_id})로 시작하지 않습니다`);
    if (Array.isArray(s.video_segments) && s.video_segments.length) err(5, `${sid}: 기초 단계에는 영상이 없습니다(video_segments 는 빈 목록)`);
    if (codeLines(s.code) !== (s.code_line_notes_ko?.length ?? 0)) err(9, `${sid}: code ${codeLines(s.code)}줄, code_line_notes_ko ${s.code_line_notes_ko?.length ?? 0}개`);
    if (s.kind !== 'read' && codeLines(s.code) === 0) err(1, `${sid}: ${s.kind} 단계에 코드가 없습니다`);
    if (s.kind === 'read' && codeLines(s.code) > 0) err(1, `${sid}: read 단계에는 코드가 없어야 합니다`);
    if (s.expected_check?.type === 'output_match' && !nonEmpty(s.expected_check.value)) warn(`${sid}: output_match 값이 비어 있어(출력 없음) 화면에서는 "같아요/달라요" 확인으로 보입니다`);
    if (Number.isInteger(s.new_code_lines) && typeof s.long_step === 'boolean') {
      const n = s.new_code_lines;
      if (n > 10) err(9, `${sid}: new_code_lines ${n}는 10을 넘습니다`);
      else if (n >= 6 && !s.long_step) err(9, `${sid}: new_code_lines ${n}(6~10)이면 long_step: true`);
      else if (n <= 5 && s.long_step) err(9, `${sid}: new_code_lines ${n}(0~5)이면 long_step: false`);
    }
    const editLines = (s.edits ?? []).reduce((a, e) => a + (e?.line_count ?? 0), 0);
    if (editLines > codeLines(s.code)) err(1, `${sid}: edits 줄 수 합(${editLines})이 code 줄 수(${codeLines(s.code)})보다 큽니다`);
    if ((s.kind === 'code' || s.kind === 'optional') && s.step_id) needH1toH4(s.step_id);
    checkHintIds(sid, s.hint_ids);
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
  for (const [k, v] of Object.entries(BASICS.diagnosticPromises)) if (diag[k] !== v) err(4, `diagnostic.${k} 는 ${v} 여야 합니다(앱은 추천만 하고 잠금·건너뛰기·힌트가 없습니다)`);
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
    if (q.type === 'choice') {
      if (!Array.isArray(q.choices) || q.choices.length < 2) err(isDiag ? 4 : 8, `${qid}: choices 가 2개 이상이어야 합니다`);
      if (!Number.isInteger(q.answer_index) || (Array.isArray(q.choices) && (q.answer_index < 0 || q.answer_index >= q.choices.length)))
        err(isDiag ? 4 : 8, `${qid}: answer_index ${q.answer_index}가 보기 범위 밖입니다`);
      if (q.auto_grade?.type !== 'choice') err(isDiag ? 4 : 8, `${qid}: choice 문항은 auto_grade.type 이 choice 여야 합니다`);
    }
    if (isDiag) {
      diagFound.push(q.question_id);
      if (!BASICS_ID.diagnostic.test(String(q.question_id))) err(1, `${qid}: 진단 문항 id 는 F-D{번호}`);
      if (!diagIds.includes(q.question_id)) err(4, `${qid}: lecture.diagnostic.question_ids 에 없습니다`);
      if (q.type === 'predict') {
        if (q.auto_grade?.type !== 'exact' || q.auto_grade?.value == null || String(q.auto_grade.value).trim() === '') err(4, `${qid}: 직접 입력 문항은 auto_grade 가 exact(값 있음)여야 합니다`);
      } else if (q.type !== 'choice') err(4, `${qid}: 진단 문항은 choice 또는 predict 만 씁니다`);
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
    if (!nonEmpty(q.answer_ko)) err(8, `${qid}: answer_ko 가 없습니다`);
    if (['keywords', 'manual'].includes(q.auto_grade?.type) && (!Array.isArray(q.rubric) || !q.rubric.length)) err(8, `${qid}: ${q.auto_grade.type} 채점에는 rubric 이 필요합니다`);
    if (q.recommend_units_if_wrong != null) warn(`${qid}: recommend_units_if_wrong 은 진단 문항에만 씁니다`);
    if (q.type === 'predict' && lv > 0) err(10, `${qid}: 예측 문제에는 힌트를 두지 않습니다`);
    if (['explain', 'fix_bug', 'apply'].includes(q.type) && q.question_id) needH1toH4(q.question_id);
    checkHintIds(qid, q.hint_ids);
    const list = questionsByUnit.get(q.unit_id) ?? [];
    list.push(q);
    questionsByUnit.set(q.unit_id, list);
  });
  for (const id of diagIds) if (!diagFound.includes(id)) err(4, `lecture.diagnostic.question_ids 의 ${id}가 문항 목록에 없습니다(unit_id ${BASICS.diagnosticUnitId})`);
  if (new Set(diagIds).size !== diagIds.length) err(4, 'lecture.diagnostic.question_ids 에 같은 문항이 두 번 있습니다');

  // 스스로 해 보기(rebuild_tasks)
  rebuilds.forEach((r, i) => {
    for (const m of zodIssues(basicsRebuildSchema.safeParse(r))) err(1, `rebuild_tasks[${i}] ${r?.rebuild_id ?? ''} ${m}`);
    if (!r || typeof r !== 'object') return;
    for (const k of Object.keys(r)) if (!KNOWN.basicsRebuild.has(k)) warn(`${r.rebuild_id ?? `rebuild_tasks[${i}]`}: 모르는 칸 "${k}"`);
    if (r.rebuild_id) claim(r.rebuild_id);
    if (!unitById.has(r.unit_id)) err(6, `${r.rebuild_id}: unit_id ${r.unit_id}가 단위 목록에 없습니다`);
    else if (r.rebuild_id && !r.rebuild_id.startsWith(`${r.unit_id}-`)) err(6, `${r.rebuild_id}: rebuild_id 가 unit_id(${r.unit_id})로 시작하지 않습니다`);
    checkHintIds(r.rebuild_id, r.hint_ids);
  });

  // 3 단위 상태와 단위의 id 목록(양방향)
  const sameSet = (a, b) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
  for (const u of units) {
    if (!u?.unit_id) continue;
    const st = steps.filter((s) => s?.unit_id === u.unit_id).map((s) => s.step_id);
    const qs = (questionsByUnit.get(u.unit_id) ?? []).map((q) => q.question_id);
    const rs = rebuilds.filter((r) => r?.unit_id === u.unit_id).map((r) => r.rebuild_id);
    if (!sameSet(u.step_ids, st)) err(3, `${u.unit_id}: step_ids(${(u.step_ids ?? []).join(',')})가 이 단위의 단계(${st.join(',')})와 다릅니다`);
    if (!sameSet(u.question_ids, qs)) err(3, `${u.unit_id}: question_ids 가 이 단위의 문항과 다릅니다`);
    if (!sameSet(u.rebuild_ids, rs)) err(3, `${u.unit_id}: rebuild_ids 가 이 단위의 스스로 해 보기와 다릅니다`);
    if (u.status === 'written') {
      if (!nonEmpty(u.goal_ko)) err(3, `${u.unit_id}: written 단위에 goal_ko(목표)가 없습니다`);
      if (!nonEmpty(u.mastery_ko)) err(3, `${u.unit_id}: written 단위에 mastery_ko(익힘 기준)가 없습니다`);
      if (!st.length) err(3, `${u.unit_id}: written 단위에 단계가 없습니다`);
      if (!rs.length) warn(`${u.unit_id}: written 단위에 스스로 해 보기가 없습니다(익힘 판정은 단계·문제만 봅니다)`);
    } else if (u.status === 'planned') {
      if (st.length || qs.length || rs.length) err(3, `${u.unit_id}: planned 단위에 단계·문항·스스로 해 보기가 있습니다(내용 0건이어야 함)`);
    }
  }

  // 7 긴 줄표
  for (const [at, v] of strings(d)) if (v.includes('\u2014')) err(7, `${at}: 긴 줄표(U+2014)가 있습니다`);

  return {
    errors,
    warnings,
    stats: {
      units: units.length,
      written: units.filter((u) => u?.status === 'written').length,
      planned: units.filter((u) => u?.status === 'planned').length,
      steps: stepIds.size,
      questions: questions.length,
      diagnostic: diagIds.length,
      rebuild: rebuilds.length,
      hints: hints.length,
    },
  };
}

/** 1편 등 강의의 선행 기초 단위(prereq_units, prereq_units_optional)가 기초 단위 목록에 있는지 (규칙 12) */
export function checkPrereqUnits(lectureFiles, basicsData) {
  const ids = new Set((basicsData?.lecture?.units ?? []).map((u) => u?.unit_id));
  const out = [];
  for (const lf of lectureFiles ?? []) {
    const L = lf?.data?.lecture;
    if (!L) continue;
    for (const u of [...(L.prereq_units ?? []), ...(L.prereq_units_optional ?? [])])
      if (!ids.has(u)) out.push({ rule: 12, file: lf.path, message: `${L.lecture_id} prereq ${u}가 기초 단위 목록(F.json lecture.units)에 없습니다` });
  }
  return out;
}

export function formatBasicsReport({ errors, warnings, stats }, bb) {
  const file = bb.file?.path ?? BASICS.file;
  const out = [
    `기초 콘텐츠 검사 (${file}): 단위 ${stats.units}개(written ${stats.written}, planned ${stats.planned}), 단계 ${stats.steps}개, 문항 ${stats.questions}개(진단 ${stats.diagnostic} 포함), 스스로 해 보기 ${stats.rebuild}개, 힌트 ${stats.hints}개`,
  ];
  for (const e of errors) out.push(`  ✕ 규칙 ${e.rule} ${BASICS_RULES[e.rule]} | ${e.file} | ${e.message}`);
  for (const w of warnings) out.push(`  △ 경고 | ${w.file} | ${w.message}`);
  out.push(errors.length ? `실패: 오류 ${errors.length}건, 경고 ${warnings.length}건` : `통과: 오류 0건, 경고 ${warnings.length}건`);
  return out.join('\n');
}

const byOrder = (a, b) => a.order - b.order;
/** 단계 주소 끝: F-P1-S02 → S02 (/basics/F-P1/S02/) */
export const basicsStepSlug = (stepId) => String(stepId).split('-').pop();
const figureLabel = (f) => (f ? (BASICS.figureLabels[f] ?? null) : null);

/** 검사를 통과한 묶음 → 화면 데이터. 공개 칸(페이지에 들어감)에는 풀이·정답 번호·채점 값·힌트 본문이 없다 */
export function buildBasics(bb) {
  const d = bb.file.data;
  const lecture = d.lecture;
  const units = lecture.units;
  const allSteps = [...(d.steps ?? [])].sort(byOrder);
  const questions = d.questions ?? [];
  const rebuilds = d.rebuild_tasks ?? [];
  const MR = d.mastery_rule;
  const excluded = new Set(MR.steps_complete_excludes_kinds ?? []);
  const contentVersion = `F-${d._meta?.version ?? 'x'}-${crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex').slice(0, 12)}`;
  const hintsByTarget = new Map();
  for (const h of d.hints ?? []) hintsByTarget.set(h.target_id, [...(hintsByTarget.get(h.target_id) ?? []), h]);
  const levelsOf = (id) => (hintsByTarget.get(id) ?? []).map((h) => h.level).sort((a, b) => a - b);
  const unlockOf = (id) => Object.fromEntries((hintsByTarget.get(id) ?? []).filter((h) => h.unlock).map((h) => [h.level, h.unlock]));
  const open = new Set(units.filter(isOpenUnit).map((u) => u.unit_id));

  const stepsOut = {};
  const questionsOut = {};
  const rebuildOut = {};
  for (const u of units) {
    if (!open.has(u.unit_id)) continue;
    const us = allSteps.filter((s) => s.unit_id === u.unit_id);
    // 1편과 같은 단계 데이터. order 는 단위 안 번호(1부터), 정본 전체 번호는 global_order
    stepsOut[u.unit_id] = us.map((s, i) => ({
      ...publicStep(s, us, hintsByTarget, null, questions.filter((q) => q.after_step === s.step_id)),
      // 출력이 없는 단계(output_match 빈 값)는 붙여 넣을 것이 없으니 "같아요/달라요" 확인으로 보인다
      expected_check: s.expected_check?.type === 'output_match' && !nonEmpty(s.expected_check.value) ? { type: 'manual' } : s.expected_check,
      figure_label: figureLabel(s.expected_check?.figure),
      slug: basicsStepSlug(s.step_id),
      order: i + 1,
      global_order: s.order,
      rerun_first: (s.rerun_first ?? []).map((id) => ({ step_id: id, slug: basicsStepSlug(id), title_ko: us.find((x) => x.step_id === id)?.title_ko ?? id })),
    }));
    for (const st of stepsOut[u.unit_id]) {
      if (st.edit_view) st.edit_view.targets = st.edit_view.targets.map((t) => ({ ...t, slug: basicsStepSlug(t.step_id) }));
    }
    questionsOut[u.unit_id] = questions.filter((q) => q.unit_id === u.unit_id).map((q) => publicQuestion(q, hintsByTarget));
    rebuildOut[u.unit_id] = rebuilds
      .filter((r) => r.unit_id === u.unit_id)
      .map((r) => ({
        rebuild_id: r.rebuild_id,
        title_ko: r.title_ko,
        task_ko: r.task_ko,
        test_ko: r.check?.test_ko ?? null,
        figure: r.check?.figure ?? null,
        figure_label: figureLabel(r.check?.figure),
        max_hint_level_for_pass: r.max_hint_level_for_pass ?? null,
        hint_levels: levelsOf(r.rebuild_id),
        hint_unlock: unlockOf(r.rebuild_id),
      }));
  }

  // 힌트 JSON(대상별). H4 show_solution 이면 정답(단계: 코드·줄별 풀이, 문제: 풀이)을 함께 (1편 build.mjs 와 같은 모양)
  const hints = {};
  for (const [t, hs] of hintsByTarget) {
    const step = allSteps.find((s) => s.step_id === t);
    const q = questions.find((x) => x.question_id === t);
    hints[t] = [...hs]
      .sort((a, b) => a.level - b.level)
      .map((h) => ({
        hint_id: h.hint_id,
        target_id: t,
        level: h.level,
        text_ko: h.text_ko,
        code_with_blanks: h.code_with_blanks ?? null,
        code: h.code ?? (h.show_solution && step ? step.code : null),
        code_line_notes_ko: h.code_line_notes_ko ?? (h.show_solution && step ? step.code_line_notes_ko : null),
        answer_ko: h.show_solution && q ? q.answer_ko : null,
        why_ko: h.why_ko ?? null,
      }));
  }
  const answers = Object.fromEntries(
    questions.map((q) => [
      q.question_id,
      { answer_ko: q.answer_ko ?? null, auto_grade: q.auto_grade, rubric: q.rubric ?? [], answer_index: q.answer_index ?? null, choices: q.choices ?? null, max_points: q.max_points, type: q.type },
    ]),
  );
  const unitsOut = units.map((u) => {
    const ready = open.has(u.unit_id);
    const st = ready ? stepsOut[u.unit_id] : [];
    return {
      unit_id: u.unit_id,
      group: groupOf(u.unit_id),
      title_ko: u.title_ko,
      used_in_ko: u.used_in_ko ?? null,
      status: u.status,
      required: !!u.required,
      ready,
      goal_ko: ready ? u.goal_ko : null,
      mastery_ko: ready ? u.mastery_ko : null,
      // 익힘 판정에 쓰는 것 (lib/basics.ts unitMastery). 제외 종류(optional) 단계는 step_ids 에서 뺀다
      mastery: {
        step_ids: st.filter((s) => !excluded.has(s.kind)).map((s) => s.step_id),
        activity_step_ids: st.map((s) => s.step_id),
        questions: (ready ? questionsOut[u.unit_id] : []).map((q) => ({ question_id: q.question_id, max_points: q.max_points, must_pass: q.must_pass })),
        rebuilds: (ready ? rebuildOut[u.unit_id] : []).map((r) => ({ rebuild_id: r.rebuild_id, max_hint_level_for_pass: r.max_hint_level_for_pass })),
      },
    };
  });
  const diag = lecture.diagnostic;
  return {
    file: bb.file.path,
    lecture_id: lecture.lecture_id,
    title_ko: lecture.title_ko,
    intro_ko: lecture.intro_ko,
    common_format_ko: lecture.common_format_ko,
    content_version: contentVersion,
    unitOrder: units.map((u) => u.unit_id),
    readyIds: units.filter((u) => open.has(u.unit_id)).map((u) => u.unit_id),
    groups: BASICS.groups.map((g) => ({ id: g.id, label_ko: g.label_ko, unit_ids: units.filter((u) => groupOf(u.unit_id) === g.id).map((u) => u.unit_id) })),
    rule: { steps_complete_ratio: MR.steps_complete_ratio, question_score_ratio: MR.question_score_ratio, must_pass_all: MR.must_pass_all },
    units: unitsOut,
    diagnostic: {
      title_ko: diag.title_ko,
      purpose_ko: diag.purpose_ko,
      result_ko: {
        score_template_ko: diag.result_ko.score_template_ko,
        recommend_template_ko: diag.result_ko.recommend_template_ko,
        always_add_ko: diag.result_ko.always_add_ko,
        not_ready_ko: diag.result_ko.not_ready_ko,
      },
      questions: diag.question_ids.map((id) => {
        const q = questions.find((x) => x.question_id === id);
        return {
          question_id: q.question_id,
          type: q.type,
          prompt_ko: q.prompt_ko,
          choices: q.type === 'choice' ? q.choices : null,
          recommend_units_if_wrong: q.recommend_units_if_wrong,
          // 직접 입력 문항의 "모르겠어요" 버튼(정본 dont_know_allowed). 고르기 문항은 보기 안에 모르겠어요가 있다
          dont_know_allowed: q.dont_know_allowed === true,
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

/** Astro 페이지가 부른다. 검사에 실패하면 빌드를 멈추고, 처음 읽을 때 어느 파일을 읽었는지 한 줄 남긴다 */
export function loadBasics() {
  if (cached) return cached;
  const bb = readBasicsBundle(resolveBasicsPath());
  const report = validateBasics(bb);
  if (report.errors.length) throw new Error(`기초 콘텐츠 검사 실패. npm run check:content 로 자세히 보세요.\n${formatBasicsReport(report, bb)}`);
  cached = buildBasics(bb);
  const c = cached.counts;
  console.log(`[기초] ${bb.file.path} 를 읽었습니다: 단계 ${c.steps}, 문항 ${c.questions}, 스스로 해 보기 ${c.rebuild}, 힌트 ${c.hints}, 여는 단위 ${cached.readyIds.length}개`);
  return cached;
}
