// 검사를 통과한 묶음을 화면이 쓰는 모양으로 바꾼다.
// 풀이(answer_ko, 채점 값, rubric)와 힌트 본문(H4 정답 포함)은 페이지에 넣지 않고 별도 JSON으로 늦게 불러온다.
import crypto from 'node:crypto';
import { NOTEBOOKS } from '../../content-config.mjs';
import { listOf } from './schema.mjs';
import { readBundle, resolvePaths } from './load.mjs';
import { codeLines, formatReport, validateBundle } from './validate.mjs';

const byOrder = (a, b) => a.order - b.order;
const splitLines = (code) => (code == null ? [] : String(code).replace(/\n+$/, '').split('\n'));

function contentVersion(lf, lecture) {
  if (lecture?.content_version) return String(lecture.content_version);
  const h = crypto.createHash('sha256').update(JSON.stringify(lf.data));
  return `auto-${h.digest('hex').slice(0, 12)}`;
}

export const stepSlug = (stepId) => String(stepId).split('-').slice(1).join('-');

/** edits 를 나눈다: code 앞쪽 줄이 edits 순서대로 넣을 줄, 나머지는 새 셀 (data-spec v1.2) */
export function splitEdits(step) {
  const lines = splitLines(step.code);
  const notes = step.code_line_notes_ko ?? [];
  let at = 0;
  const blocks = (step.edits ?? []).map((e) => {
    const b = { ...e, lines: lines.slice(at, at + e.line_count), notes: notes.slice(at, at + e.line_count) };
    at += e.line_count;
    return b;
  });
  return { blocks, rest: { lines: lines.slice(at), notes: notes.slice(at) } };
}

const norm = (s) => String(s).trim();
const uncomment = (s) => norm(s).replace(/^#\s*/, '').trim();

/** 대상 셀에 앞 단계들의 edits 를 차례로 적용한 "고친 뒤 셀 전체". 기준 줄을 못 찾으면 ok:false */
export function reconstructCell(steps, step, targetId) {
  const target = steps.find((s) => s.step_id === targetId);
  if (!target) return { ok: false, lines: [] };
  let cell = splitLines(target.code).map((text) => ({ text, isNew: false }));
  let ok = true;
  const upto = [...steps].sort(byOrder).filter((s) => s.order <= step.order && s.order > target.order);
  for (const s of upto) {
    const { blocks } = splitEdits(s);
    for (const b of blocks.filter((x) => x.target_step === targetId)) {
      const mine = s.step_id === step.step_id;
      const add = b.lines.map((text) => ({ text, isNew: mine }));
      if (b.action === 'replace') {
        const want = b.lines.map(uncomment);
        const idx = cell.findIndex((_, i) => want.every((w, k) => cell[i + k] && uncomment(cell[i + k].text) === w));
        if (idx < 0) {
          ok = false;
          continue;
        }
        cell = [...cell.slice(0, idx), ...add, ...cell.slice(idx + b.lines.length)];
      } else if (b.anchor_line) {
        let idx = -1;
        cell.forEach((l, i) => {
          if (norm(l.text) === norm(b.anchor_line)) idx = i;
        });
        if (idx < 0) {
          ok = false;
          continue;
        }
        cell = [...cell.slice(0, idx + 1), ...add, ...cell.slice(idx + 1)];
      } else {
        // "셀 맨 아래": 클래스처럼 들여 쓴 덩어리의 마지막 줄 바로 아래 (뒤에 붙은 확인용 줄 앞)
        let idx = cell.length - 1;
        for (let i = cell.length - 1; i >= 0; i--) {
          if (/^\s+\S/.test(cell[i].text)) {
            idx = i;
            break;
          }
        }
        cell = [...cell.slice(0, idx + 1), ...add, ...cell.slice(idx + 1)];
      }
    }
  }
  return { ok, lines: cell };
}

function publicStep(s, steps, hintsByTarget, segEntry, questionsAfter) {
  const { hint_ids, ...rest } = s;
  const hs = hintsByTarget.get(s.step_id) ?? [];
  const edits = s.edits?.length ? splitEdits(s) : null;
  const targetIds = [...new Set((s.edits ?? []).map((e) => e.target_step))];
  return {
    ...rest,
    slug: stepSlug(s.step_id),
    video_segments: (Array.isArray(s.video_segments) ? s.video_segments : (segEntry?.video_segments ?? [])).map((g) => ({ start_s: g.start_s, end_s: g.end_s })),
    hint_levels: hs.map((h) => h.level).sort((a, b) => a - b),
    hint_unlock: Object.fromEntries(hs.filter((h) => h.unlock).map((h) => [h.level, h.unlock])),
    question_ids: questionsAfter.map((q) => q.question_id),
    edit_view: edits
      ? {
          blocks: edits.blocks,
          rest: edits.rest,
          targets: targetIds.map((t) => {
            const ts = steps.find((x) => x.step_id === t);
            const rc = reconstructCell(steps, s, t);
            return { step_id: t, title_ko: ts?.title_ko ?? t, slug: stepSlug(t), full: rc };
          }),
        }
      : null,
    rerun_first: (s.rerun_first ?? []).map((id) => ({ step_id: id, slug: stepSlug(id), title_ko: steps.find((x) => x.step_id === id)?.title_ko ?? id })),
  };
}

function publicQuestion(q, hintsByTarget) {
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
    max_points: q.max_points,
    must_pass: !!q.must_pass,
    grade_type: q.auto_grade?.type ?? 'manual',
    hint_levels: hs.map((h) => h.level).sort((a, b) => a - b),
    hint_unlock: Object.fromEntries(hs.filter((h) => h.unlock).map((h) => [h.level, h.unlock])),
  };
}

export function buildSite(bundle) {
  const lectureList = bundle.lecturesFile ? (listOf(bundle.lecturesFile.data, 'lectures') ?? []) : [];
  const units = bundle.unitsFile ? (listOf(bundle.unitsFile.data, 'units') ?? []) : [];
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
    // 힌트 JSON: 대상별, H4 show_solution 이면 정답(단계: 코드·줄별 풀이, 문제: 풀이)을 함께 담는다
    const hints = {};
    for (const [t, hs] of hintsByTarget) {
      const step = steps.find((s) => s.step_id === t);
      const q = questions.find((x) => x.question_id === t);
      hints[t] = hs
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
    const answers = {};
    for (const q of questions)
      answers[q.question_id] = {
        answer_ko: q.answer_ko,
        auto_grade: q.auto_grade,
        rubric: q.rubric,
        answer_index: q.answer_index ?? null,
        choices: q.choices ?? null,
        max_points: q.max_points,
        type: q.type,
      };
    const nb = NOTEBOOKS[lid] ?? null;
    details[lid] = {
      lecture: {
        ...lecture,
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
      rebuild: (d.rebuild_tasks ?? []).map(({ hint_ids, ...t }) => t),
      answers,
      hints,
      code_lines: Object.fromEntries(steps.map((s) => [s.step_id, codeLines(s.code)])),
    };
  }
  const byId = new Map(lectureList.map((l) => [l.lecture_id, l]));
  for (const lid of Object.keys(details)) if (!byId.has(lid)) byId.set(lid, { lecture_id: lid, title_ko: details[lid].lecture.title_ko, video_seconds: details[lid].lecture.video_seconds });
  return {
    source: bundle.source,
    lectures: [...byId.values()]
      .map((l) => ({ ...l, video_seconds: l.video_seconds ?? bundle.segments?.lectures?.[l.lecture_id]?.video_seconds ?? null, available: !!details[l.lecture_id] }))
      .sort((a, b) => a.lecture_id.localeCompare(b.lecture_id)),
    units,
    details,
  };
}

let cached = null;

/** Astro 페이지가 부른다. 검사에 실패하면 빌드를 멈춘다 */
export function loadSite() {
  if (cached) return cached;
  const bundle = readBundle(resolvePaths());
  const report = validateBundle(bundle);
  if (report.errors.length) throw new Error(`콘텐츠 검사 실패. npm run check:content 로 자세히 보세요.\n${formatReport(report, bundle.source, bundle.contentDir)}`);
  cached = buildSite(bundle);
  return cached;
}
