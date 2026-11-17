// 맛보기 콘텐츠 검사·화면 데이터 (교사 정본 inputs/pedagogy/content/taster.json, 손으로 고치지 않는다).
// 1편 로더(build.mjs·validate.mjs)와 같은 방식: 묶음을 읽고(load.mjs) → 검사(어기면 빌드 실패) → 화면이 쓰는 모양으로 바꾼다.
// 풀이(answer_ko)와 힌트 본문은 페이지에 넣지 않고 /data/TASTER/answers.json·hints.json 으로 늦게 불러온다.
import crypto from 'node:crypto';
import { isNoVideoStep, NAMES_TXT, TASTER } from '../../content-config.mjs';
import { buildNameFilter, checkBlocklist, isBlockedName } from '../name-filter.mjs';
import { readTasterBundle, resolvePaths } from './load.mjs';
import { hintSchema, KNOWN, TASTER_ID, tasterLectureSchema, tasterQuestionSchema, tasterStepSchema } from './schema.mjs';
import { codeLines, RULES, strings, zodIssues } from './validate.mjs';

export const TASTER_LECTURE_ID = TASTER_ID.lecture;
const byOrder = (a, b) => a.order - b.order;
export const tasterSlug = (stepId) => String(stepId).split('-').slice(1).join('-');

/** 출력 예 비교: 끝 줄바꿈만 무시 */
const sameOutput = (a, b) => String(a ?? '').replace(/\n+$/, '') === String(b ?? '').replace(/\n+$/, '');

export function validateTaster(tb) {
  const errors = [];
  const warnings = [];
  const err = (rule, file, message) => errors.push({ rule, file, message });
  const warn = (file, message) => warnings.push({ file, message });
  for (const p of tb.parseErrors ?? []) err(1, p.path, `읽기 실패: ${p.message}`);
  const d = tb.file?.data;
  const file = tb.file?.path ?? TASTER.file;
  if (!d || typeof d !== 'object') return { errors, warnings, stats: { steps: 0, questions: 0 } };

  const lecture = d.lecture ?? {};
  for (const m of zodIssues(tasterLectureSchema.safeParse(lecture))) err(1, file, `lecture.${m}`);
  for (const k of Object.keys(lecture)) if (!KNOWN.tasterLecture.has(k)) warn(file, `lecture: 모르는 칸 "${k}"`);
  if (!Array.isArray(d.steps)) err(1, file, 'steps 목록이 없습니다');
  if (!Array.isArray(d.questions)) err(1, file, 'questions 목록이 없습니다');
  if (!Array.isArray(d.hints)) err(1, file, 'hints 목록이 없습니다');
  const steps = Array.isArray(d.steps) ? d.steps : [];
  const questions = Array.isArray(d.questions) ? d.questions : [];
  const hints = Array.isArray(d.hints) ? d.hints : [];

  const seen = new Map();
  const claim = (id) => {
    if (seen.has(id)) err(6, file, `id 중복: ${id}`);
    else seen.set(id, true);
  };
  const stepIds = new Set(steps.map((s) => s?.step_id).filter(Boolean));
  const questionIds = new Set(questions.map((q) => q?.question_id).filter(Boolean));

  // 힌트
  const hintIds = new Set();
  const levelsByTarget = new Map();
  hints.forEach((h, i) => {
    for (const m of zodIssues(hintSchema.safeParse(h))) err(1, file, `hints[${i}] ${m}`);
    if (!h || typeof h !== 'object') return;
    for (const k of Object.keys(h)) if (!KNOWN.hint.has(k)) warn(file, `${h.hint_id ?? `hints[${i}]`}: 모르는 칸 "${k}"`);
    if (h.hint_id) {
      claim(h.hint_id);
      hintIds.add(h.hint_id);
      if (h.target_id && h.level && h.hint_id !== `${h.target_id}-H${h.level}`) err(6, file, `${h.hint_id}: hint_id 는 ${h.target_id}-H${h.level} 이어야 합니다`);
    }
    if (h.target_id && !stepIds.has(h.target_id) && !questionIds.has(h.target_id)) err(6, file, `${h.hint_id}: 대상 ${h.target_id}가 없습니다`);
    if (h.code_with_blanks != null) err(1, file, `${h.hint_id}: 맛보기 힌트는 빈칸 코드를 쓰지 않습니다(taster.md)`);
    if (h.target_id && Number.isInteger(h.level)) {
      const set = levelsByTarget.get(h.target_id) ?? new Set();
      if (set.has(h.level)) err(6, file, `${h.target_id}: 힌트 단계 ${h.level}가 두 번 있습니다`);
      set.add(h.level);
      levelsByTarget.set(h.target_id, set);
    }
  });
  for (const [t, lv] of levelsByTarget) {
    const sorted = [...lv].sort((a, b) => a - b);
    if (sorted.some((x, i) => x !== i + 1)) err(6, file, `${t}: 힌트 단계가 1부터 이어지지 않습니다: ${sorted.join(',')}`);
  }

  // 단계
  const orders = new Map();
  steps.forEach((s, i) => {
    for (const m of zodIssues(tasterStepSchema.safeParse(s))) err(1, file, `steps[${i}] ${s?.step_id ?? ''} ${m}`);
    if (!s || typeof s !== 'object') return;
    const sid = s.step_id ?? `steps[${i}]`;
    for (const k of Object.keys(s)) if (!KNOWN.tasterStep.has(k)) warn(file, `${sid}: 모르는 칸 "${k}"`);
    if (s.step_id) claim(s.step_id);
    if (Number.isInteger(s.order)) {
      if (orders.has(s.order)) err(1, file, `${sid}: order ${s.order}가 ${orders.get(s.order)}와 겹칩니다`);
      orders.set(s.order, sid);
    }
    // 2 줄별 풀이 (셀 코드와 Colab 밖 대체 셀 둘 다)
    if (codeLines(s.code) !== (s.code_line_notes_ko?.length ?? 0)) err(2, file, `${sid}: code ${codeLines(s.code)}줄, code_line_notes_ko ${s.code_line_notes_ko?.length ?? 0}개`);
    if (s.code_alt_local != null || s.code_alt_local_line_notes_ko != null) {
      if (codeLines(s.code_alt_local) !== (s.code_alt_local_line_notes_ko?.length ?? 0))
        err(2, file, `${sid}: code_alt_local ${codeLines(s.code_alt_local)}줄, code_alt_local_line_notes_ko ${s.code_alt_local_line_notes_ko?.length ?? 0}개`);
    }
    // 3 줄 수: 맛보기는 새로 치는 코드 0줄, 셀 줄 수는 cell_code_lines
    if (Number.isInteger(s.cell_code_lines) && s.cell_code_lines !== codeLines(s.code)) err(3, file, `${sid}: cell_code_lines ${s.cell_code_lines} ≠ code ${codeLines(s.code)}줄`);
    if (s.new_code_lines !== 0) err(3, file, `${sid}: 맛보기는 새로 치는 코드가 0줄이어야 합니다(new_code_lines ${s.new_code_lines})`);
    if (s.long_step === true) err(10, file, `${sid}: 맛보기 단계는 long_step: false`);
    if (s.kind === 'copy_run' && codeLines(s.code) === 0) err(3, file, `${sid}: copy_run 단계에 코드가 없습니다`);
    if (s.kind === 'read' && codeLines(s.code) > 0) err(3, file, `${sid}: read 단계에는 코드가 없어야 합니다`);
    // 5 영상: 맛보기는 모두 영상 없음(D53)
    if (Array.isArray(s.video_segments) && s.video_segments.length > 0) err(5, file, `${sid}: 맛보기 단계에 영상 구간이 있습니다(D53: 영상 없음)`);
    if (s.step_id && !isNoVideoStep(s.step_id)) err(5, file, `${sid}: 영상 없는 단계 목록(content-config)에 없습니다`);
    // 9 힌트: 단계마다 H1~H4
    if (s.step_id) {
      const lv = levelsByTarget.get(s.step_id) ?? new Set();
      const missing = [1, 2, 3, 4].filter((l) => !lv.has(l));
      if (missing.length) err(9, file, `${sid}: 힌트 ${missing.map((l) => `H${l}`).join(', ')}가 없습니다(H1~H4 모두 필요)`);
    }
    for (const hid of s.hint_ids ?? []) if (!hintIds.has(hid)) err(6, file, `${sid}: hint_ids 의 ${hid}가 hints 목록에 없습니다`);
    for (const qid of s.question_ids ?? []) {
      const qq = questions.find((x) => x?.question_id === qid);
      if (!qq) err(6, file, `${sid}: question_ids 의 ${qid}가 없습니다`);
      else if (qq.after_step !== s.step_id) err(6, file, `${sid}: ${qid}의 after_step(${qq.after_step})이 이 단계가 아닙니다`);
    }
    // 11 출력 예 = 교사 실행 출력
    const outs = tb.outputsFile?.data;
    if (outs && s.step_id) {
      const has = Object.prototype.hasOwnProperty.call(outs, s.step_id);
      if (s.expected_output_example != null && !has) err(11, file, `${sid}: 출력 예가 있는데 교사 실행 출력에 이 단계가 없습니다`);
      if (has && !sameOutput(outs[s.step_id], s.expected_output_example)) err(11, file, `${sid}: expected_output_example 이 교사 실행 출력(taster_outputs.json)과 다릅니다`);
    }
  });
  if (tb.outputsFile?.data) {
    for (const k of Object.keys(tb.outputsFile.data)) if (!k.startsWith('_') && !stepIds.has(k)) err(11, tb.outputsFile.path, `${k}: 맛보기 단계에 없는 출력입니다`);
  }
  if (Array.isArray(lecture.video_segments) && lecture.video_segments.length) err(5, file, '맛보기 lecture.video_segments 는 빈 목록이어야 합니다');

  // 문항
  questions.forEach((q, i) => {
    for (const m of zodIssues(tasterQuestionSchema.safeParse(q))) err(1, file, `questions[${i}] ${q?.question_id ?? ''} ${m}`);
    if (!q || typeof q !== 'object') return;
    const qid = q.question_id ?? `questions[${i}]`;
    for (const k of Object.keys(q)) if (!KNOWN.tasterQuestion.has(k)) warn(file, `${qid}: 모르는 칸 "${k}"`);
    if (q.question_id) claim(q.question_id);
    if (typeof q.answer_ko !== 'string' || !q.answer_ko.trim()) err(6, file, `${qid}: answer_ko 가 없습니다`);
    if (!Array.isArray(q.rubric) || q.rubric.length === 0) err(6, file, `${qid}: rubric 이 없습니다`);
    if (q.after_step && !stepIds.has(q.after_step)) err(6, file, `${qid}: after_step ${q.after_step}가 맛보기에 없습니다`);
    if (q.scored !== false) err(12, file, `${qid}: 맛보기 문항은 scored: false 여야 합니다(점수 없이 바로 풀이)`);
    if (q.type !== 'choice') err(12, file, `${qid}: 맛보기 문항은 고르기(choice)만 씁니다`);
    if (!Array.isArray(q.choices) || q.choices.length < 2) err(4, file, `${qid}: choices 가 2개 이상이어야 합니다`);
    if (!Number.isInteger(q.answer_index)) err(4, file, `${qid}: answer_index 가 없습니다`);
    else if (Array.isArray(q.choices) && (q.answer_index < 0 || q.answer_index >= q.choices.length)) err(4, file, `${qid}: answer_index ${q.answer_index}가 보기 범위 밖입니다`);
    if (q.type === 'choice' && q.auto_grade?.type !== 'choice') err(4, file, `${qid}: choice 문항은 auto_grade.type 이 choice 여야 합니다`);
    for (const hid of q.hint_ids ?? []) if (!hintIds.has(hid)) err(6, file, `${qid}: hint_ids 의 ${hid}가 hints 목록에 없습니다`);
  });

  // 12 완료 조건·공유 결과물
  for (const sid of lecture.completion_rule?.requires_steps ?? []) if (!stepIds.has(sid)) err(12, file, `completion_rule.requires_steps 의 ${sid}가 없습니다`);
  if (lecture.artifact?.unlock_after && !stepIds.has(lecture.artifact.unlock_after)) err(12, file, `artifact.unlock_after ${lecture.artifact.unlock_after}가 없습니다`);
  if (lecture.completion_rule?.questions_scored === true) err(12, file, 'completion_rule.questions_scored 는 false 여야 합니다');

  // 12 이름 카드 금칙어(정본 taster_blocklist.json) + names.txt(허용 규칙)
  const blFile = tb.blocklistFile?.path ?? TASTER.blocklistFile;
  if (tb.blocklistFile?.data || tb.realNames) {
    for (const m of checkBlocklist(tb.blocklistFile?.data ?? null, tb.realNames, NAMES_TXT.count)) err(12, m.startsWith('names.txt') ? NAMES_TXT.path : blFile, m);
  }
  // 교사 실행 출력의 이름(카드에 넣는 단계)이 금칙어에 걸리면 알린다(경고만)
  if (tb.blocklistFile?.data && Array.isArray(tb.realNames) && lecture.artifact?.unlock_after) {
    const nf = buildNameFilter(tb.blocklistFile.data, tb.realNames);
    const out = String(tb.outputsFile?.data?.[lecture.artifact.unlock_after] ?? '');
    const hit = out.split('\n').filter((l) => isBlockedName(l, nf)).length;
    if (hit) warn(tb.outputsFile?.path ?? TASTER.outputsFile, `${lecture.artifact.unlock_after} 출력 이름 ${hit}줄이 금칙어에 걸립니다`);
  }

  // 7 긴 줄표
  for (const [at, v] of strings(d)) if (v.includes('\u2014')) err(7, file, `${at}: 긴 줄표(U+2014)가 있습니다`);
  if (tb.outputsFile?.data) for (const [at, v] of strings(tb.outputsFile.data)) if (v.includes('\u2014')) err(7, tb.outputsFile.path, `${at}: 긴 줄표(U+2014)가 있습니다`);

  return { errors, warnings, stats: { steps: stepIds.size, questions: questionIds.size } };
}

export function formatTasterReport({ errors, warnings, stats }, filePath) {
  const out = [`맛보기 콘텐츠 검사 (${filePath}): 단계 ${stats.steps}개, 확인 질문 ${stats.questions}개`];
  for (const e of errors) out.push(`  ✕ 규칙 ${e.rule} ${RULES[e.rule]} | ${e.file} | ${e.message}`);
  for (const w of warnings) out.push(`  △ 경고 | ${w.file} | ${w.message}`);
  out.push(errors.length ? `실패: 오류 ${errors.length}건, 경고 ${warnings.length}건` : `통과: 오류 0건, 경고 ${warnings.length}건`);
  return out.join('\n');
}

/** 검사를 통과한 묶음 → 화면 데이터 */
export function buildTaster(tb) {
  const d = tb.file.data;
  const lecture = d.lecture;
  const steps = [...d.steps].sort(byOrder);
  const questions = d.questions ?? [];
  const hintsByTarget = new Map();
  for (const h of d.hints ?? []) hintsByTarget.set(h.target_id, [...(hintsByTarget.get(h.target_id) ?? []), h]);
  const outputs = Object.fromEntries(Object.entries(tb.outputsFile?.data ?? {}).filter(([k]) => !k.startsWith('_')));
  const elapsed = Number(tb.outputsFile?.data?._elapsed_s);
  const contentVersion = lecture.content_version
    ? String(lecture.content_version)
    : `auto-${crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex').slice(0, 12)}`;
  const notebookFile = TASTER.notebook.split('/').pop();

  const hints = {};
  for (const [t, hs] of hintsByTarget) {
    const step = steps.find((s) => s.step_id === t);
    hints[t] = [...hs]
      .sort((a, b) => a.level - b.level)
      .map((h) => ({
        hint_id: h.hint_id,
        target_id: t,
        level: h.level,
        role_ko: h.taster_role_ko ?? null,
        text_ko: h.text_ko,
        // H4(show_solution): 맛보기에서는 "예상 출력 전체"
        expected_output: h.show_solution && step ? (step.expected_output_example ?? null) : null,
      }));
  }
  const answers = Object.fromEntries(
    questions.map((q) => [q.question_id, { answer_ko: q.answer_ko, answer_index: q.answer_index ?? null, choices: q.choices ?? null }]),
  );
  const unlockOf = (id) => Object.fromEntries((hintsByTarget.get(id) ?? []).filter((h) => h.unlock).map((h) => [h.level, h.unlock]));
  const levelsOf = (id) => (hintsByTarget.get(id) ?? []).map((h) => h.level).sort((a, b) => a - b);

  return {
    lecture: {
      lecture_id: lecture.lecture_id,
      title_ko: lecture.title_ko,
      minutes: lecture.minutes,
      verified_kst: lecture.verified_kst ?? null,
      content_version: contentVersion,
      requires_steps: lecture.completion_rule.requires_steps,
      artifact: lecture.artifact
        ? {
            artifact_id: lecture.artifact.artifact_id,
            name_ko: lecture.artifact.name_ko,
            unlock_after: lecture.artifact.unlock_after,
            ...lecture.artifact.card_fields,
            // X 글쓰기 창에 미리 채우는 글(정본 그대로). 자동 게시·이미지 첨부 없음(attach_image·auto_post false)
            prefill_ko: lecture.artifact.x_compose?.prefill_ko ?? null,
          }
        : null,
      next_ko: lecture.next_ko ?? [],
      notebook: { path: TASTER.notebook, file: notebookFile, available: !!tb.notebookExists, url: tb.notebookExists ? `${TASTER.publicDir}${notebookFile}` : null },
    },
    steps: steps.map(({ hint_ids, objective_ids, prepared_code, prepared_code_line_notes_ko, edits, rerun_first, ...s }) => ({
      ...s,
      slug: tasterSlug(s.step_id),
      video_segments: [],
      hint_levels: levelsOf(s.step_id),
      hint_unlock: unlockOf(s.step_id),
      question_ids: questions.filter((q) => q.after_step === s.step_id).map((q) => q.question_id),
    })),
    questions: questions.map((q) => ({
      question_id: q.question_id,
      type: q.type,
      after_step: q.after_step,
      prompt_ko: q.prompt_ko,
      code: q.code ?? null,
      choices: q.choices ?? null,
      hint_levels: levelsOf(q.question_id),
    })),
    answers,
    hints,
    outputs,
    elapsed_s: Number.isFinite(elapsed) ? elapsed : null,
    total_minutes: steps.reduce((a, s) => a + (Number(s.minutes) || 0), 0),
    // 이름 카드 금칙어: 정본 목록 + 허용 목록(names.txt 대조로 뽑은 것만). 끝 화면·공유 화면 부품에 넘긴다
    nameFilter: buildNameFilter(tb.blocklistFile?.data, tb.realNames ?? []),
  };
}

let cached = null;

/** Astro 페이지가 부른다. 검사에 실패하면 빌드를 멈춘다 */
export function loadTaster() {
  if (cached) return cached;
  const tb = readTasterBundle(resolvePaths());
  const report = validateTaster(tb);
  if (report.errors.length) throw new Error(`맛보기 콘텐츠 검사 실패. npm run check:content 로 자세히 보세요.\n${formatTasterReport(report, tb.file?.path ?? TASTER.file)}`);
  cached = buildTaster(tb);
  return cached;
}
