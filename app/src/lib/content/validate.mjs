// 콘텐츠 빌드 검사 (DESIGN.md 12.4절 + PM 계약 보충: 정본 JSON, D49, data-spec 클로드 버전). 어기면 빌드 실패.
// 순수 함수: 디스크를 읽지 않고 load.mjs 가 만든 묶음만 본다(테스트에서 묶음을 고쳐 실패 예를 만든다).
import { isNoVideoStep } from '../../content-config.mjs';
import { reconstructCell } from './cells.mjs';
import {
  bridgeCardSchema,
  checkpointListItemSchema,
  ID,
  KNOWN,
  hintSchema,
  lectureFileSchema,
  lectureListItemSchema,
  lectureSchema,
  listOf,
  masteryRuleSchema,
  questionSchema,
  rebuildSchema,
  stepSchema,
} from './schema.mjs';

export const RULES = {
  1: '스키마와 id 모양',
  2: '코드 줄 수 = 줄별 풀이 개수',
  3: '줄 수 규칙 (long_step ↔ new_code_lines, code = new + moved + 바꾸는 줄, 셀 줄 수 합 = 새 셀 줄)',
  4: 'choice 보기와 answer_index',
  5: '영상 구간',
  6: '문제 answer_ko·rubric, id 중복, 참조 대상',
  7: '긴 줄표(U+2014) 금지',
  8: '원본 코드 출처와 라이선스',
  9: '힌트 개수 (코드 단계·확인 문제·힌트가 있는 재구성 과제 H1~H4 모두)',
  10: 'new_code_lines 0 단계는 long_step false',
  11: '맛보기 출력 예 = 교사 실행 출력(taster_outputs.json)',
  12: '맛보기 문항·완료 조건·공유 결과물',
};

/** 끝 줄바꿈은 빼고 센다. 가운데 빈 줄도 한 줄 */
export function codeLines(code) {
  if (code == null) return 0;
  const s = String(code).replace(/\n+$/, '');
  return s === '' ? 0 : s.split('\n').length;
}

/** 따옴표 밖의 # 이 있으면 주석 (decisions C2. 검사는 경고만: # 로 줄을 막아 두는 단계가 있을 수 있다) */
export function hasPythonComment(code) {
  for (const line of String(code ?? '').split('\n')) {
    let q = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '\\') {
          i++;
          continue;
        }
        if (line.startsWith(q, i)) {
          i += q.length - 1;
          q = null;
        }
        continue;
      }
      if (c === '#') return true;
      if (c === '"' || c === "'") {
        q = line.startsWith(c.repeat(3), i) ? c.repeat(3) : c;
        i += q.length - 1;
      }
    }
  }
  return false;
}

export function zodIssues(res) {
  return res.success ? [] : res.error.issues.map((i) => `${i.path.join('.') || '(전체)'}: ${i.message}`);
}

export function* strings(v, at = '') {
  if (typeof v === 'string') yield [at, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* strings(v[i], `${at}[${i}]`);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* strings(x, at ? `${at}.${k}` : k);
}

/** 줄 수가 같은지: 코드와 줄별 풀이 (빈 코드는 풀이도 없어야 함) */
export function notesMismatch(code, notes) {
  return codeLines(code) !== (notes?.length ?? 0);
}

/** 빈칸(___) 수: H3 빈칸 답(blank_answers)은 빈칸 순서대로 하나씩 */
export const blankCount = (text) => (String(text ?? '').match(/___/g) ?? []).length;

/**
 * 단계 하나의 셀 모양 검사(1편·기초 공통). kind lines: 줄 수 규칙, ref: 참조 대상.
 * - cell_line_counts 합 = code 줄 수 - edits 로 앞 셀에 넣는 줄 수
 * - run_plan 의 new:N 은 이 단계 셀 수 이하, cell:단계id:N 은 그 단계(같은 묶음 안)의 셀 수 이하
 * - place_before 는 같은 묶음 안 단계
 */
export function stepCellIssues(s, stepById) {
  const out = [];
  const sid = s.step_id;
  const editLines = (s.edits ?? []).reduce((a, e) => a + (e?.line_count ?? 0), 0);
  const cells = s.cell_line_counts;
  if (Array.isArray(cells)) {
    const sum = cells.reduce((a, n) => a + n, 0);
    if (sum !== codeLines(s.code) - editLines) out.push({ kind: 'lines', message: `${sid}: cell_line_counts 합(${sum})이 새 셀 줄 수(code ${codeLines(s.code)} - edits ${editLines})와 다릅니다` });
  }
  // 셀 수: cell_line_counts 가 없으면 새 셀 줄이 있을 때 셀 하나
  const cellCount = (x) => {
    if (Array.isArray(x?.cell_line_counts)) return x.cell_line_counts.length;
    const newLines = codeLines(x?.code) - (x?.edits ?? []).reduce((a, e) => a + (e?.line_count ?? 0), 0);
    return newLines > 0 ? 1 : 0;
  };
  for (const item of s.run_plan ?? []) {
    const nm = /^new:(\d+)$/.exec(item);
    const cm = /^cell:(.+):(\d+)$/.exec(item);
    if (nm && (Number(nm[1]) < 1 || Number(nm[1]) > cellCount(s))) out.push({ kind: 'ref', message: `${sid}: run_plan ${item} 은 이 단계의 셀 수(${cellCount(s)})를 넘습니다` });
    if (cm) {
      const t = stepById.get(cm[1]);
      if (!t) out.push({ kind: 'ref', message: `${sid}: run_plan ${item} 의 단계 ${cm[1]}가 같은 묶음에 없습니다` });
      else if (Number(cm[2]) < 1 || Number(cm[2]) > cellCount(t)) out.push({ kind: 'ref', message: `${sid}: run_plan ${item} 은 ${cm[1]}의 셀 수(${cellCount(t)})를 넘습니다` });
    }
  }
  for (const e of s.edits ?? []) if (e?.action === 'replace' && !e.anchor_line) out.push({ kind: 'ref', message: `${sid}: 바꾸기(replace)는 바꿀 줄 anchor_line 이 있어야 합니다` });
  if (s.place_before && !stepById.has(s.place_before)) out.push({ kind: 'ref', message: `${sid}: place_before ${s.place_before}가 같은 묶음에 없습니다` });
  return out;
}

/** 힌트 하나의 모양 검사(1편·기초 공통): 빈칸 답은 3단계에서만, 빈칸 수와 같게 */
export function hintShapeIssues(h) {
  const out = [];
  if (h.code_with_blanks != null && h.level !== 3) out.push(`${h.hint_id}: code_with_blanks 는 3단계에서만 씁니다`);
  if (h.blank_answers != null) {
    if (h.level !== 3) out.push(`${h.hint_id}: blank_answers 는 3단계에서만 씁니다`);
    const n = blankCount(h.code_with_blanks ?? h.text_ko);
    if (n !== h.blank_answers.length) out.push(`${h.hint_id}: 빈칸 ${n}개, blank_answers ${h.blank_answers.length}개`);
  }
  return out;
}

export function validateBundle(bundle) {
  const errors = [];
  const warnings = [];
  const err = (rule, file, message) => errors.push({ rule, file, message });
  const warn = (file, message) => warnings.push({ file, message });

  for (const p of bundle.parseErrors ?? []) err(1, p.path, `읽기 실패: ${p.message}`);

  // 보조 목록
  const lectureList = bundle.lecturesFile ? listOf(bundle.lecturesFile.data, 'lectures') : null;
  const lectureListById = new Map();
  (lectureList ?? []).forEach((l, i) => {
    for (const m of zodIssues(lectureListItemSchema.safeParse(l))) err(1, bundle.lecturesFile.path, `[${i}] ${m}`);
    if (l?.lecture_id) lectureListById.set(l.lecture_id, l);
  });
  // 다리 카드·누적 점검(설계서에서 옮긴 값): 모양, 편 id, 다리가 가리키는 카드가 있는지
  const extras = bundle.lecturesFile?.data;
  const cardIds = new Set();
  (Array.isArray(extras?.bridge_cards) ? extras.bridge_cards : []).forEach((c, i) => {
    for (const m of zodIssues(bridgeCardSchema.safeParse(c))) err(1, bundle.lecturesFile.path, `bridge_cards[${i}] ${m}`);
    if (c?.card_id) cardIds.add(c.card_id);
  });
  for (const l of lectureList ?? []) for (const c of l?.bridge?.card_ids ?? []) if (!cardIds.has(c)) err(6, bundle.lecturesFile.path, `${l.lecture_id} bridge.card_ids 의 ${c}가 bridge_cards 에 없습니다`);
  (Array.isArray(extras?.checkpoints) ? extras.checkpoints : []).forEach((c, i) => {
    for (const m of zodIssues(checkpointListItemSchema.safeParse(c))) err(1, bundle.lecturesFile.path, `checkpoints[${i}] ${m}`);
    for (const id of [...(c?.covers ?? []), c?.after_lecture]) if (id && lectureList && !lectureListById.has(id)) err(6, bundle.lecturesFile.path, `checkpoints[${i}] ${id}가 편 목록에 없습니다`);
  });
  // 설계서의 편별 단계 수(plan.steps)와 영상 구간 정본의 단계 수가 같아야 한다(둘 다 설계서에서 옮김)
  for (const l of lectureList ?? []) {
    const n = Object.values(bundle.segments?.steps ?? {}).filter((e) => e?.lecture_id === l?.lecture_id).length;
    if (l?.plan && bundle.segments && n !== l.plan.steps) err(5, bundle.lecturesFile.path, `${l.lecture_id} plan.steps ${l.plan.steps}가 video-segments.json 의 단계 수 ${n}와 다릅니다`);
    const sl = bundle.segments?.lectures?.[l?.lecture_id];
    if (sl && l?.youtube_video_id && (sl.youtube_video_id !== l.youtube_video_id || sl.video_seconds !== l.video_seconds)) err(5, bundle.lecturesFile.path, `${l.lecture_id} 영상 id·길이가 video-segments.json 과 다릅니다`);
  }
  // 선행 기초 단위(prereq_units)가 실제 기초 단위인지는 기초 정본(F.json)과 함께 본다(basics.mjs checkPrereqUnits, npm run check:content)

  const seen = new Map();
  const claim = (id, file) => {
    if (seen.has(id)) err(6, file, `id 중복: ${id} (처음: ${seen.get(id)})`);
    else seen.set(id, file);
  };
  const segs = bundle.segments;
  const licenseNames = (bundle.licenseFiles ?? []).map((f) => String(f).toLowerCase());
  let stepCount = 0;
  let questionCount = 0;
  let rebuildCount = 0;
  let hintCount = 0;

  for (const lf of bundle.lectureFiles ?? []) {
    const file = lf.path;
    const d = lf.data;
    if (!d) continue;
    for (const m of zodIssues(lectureFileSchema.safeParse(d))) err(1, file, m);
    const lecture = d.lecture ?? {};
    for (const m of zodIssues(lectureSchema.safeParse(lecture))) err(1, file, `lecture.${m}`);
    for (const k of Object.keys(lecture)) if (!KNOWN.lecture.has(k)) warn(file, `lecture: 모르는 칸 "${k}"`);
    for (const m of zodIssues(masteryRuleSchema.safeParse(d.mastery_rule ?? {}))) err(1, file, `mastery_rule.${m}`);
    const lid = lecture.lecture_id;
    if (lid) claim(lid, file);
    if (lid && lectureList && !lectureListById.has(lid)) warn(bundle.lecturesFile.path, `${lid}가 lectures.yaml 에 없습니다`);
    const objectiveIds = new Set((lecture.objectives ?? []).map((o) => o?.objective_id).filter(Boolean));
    for (const o of objectiveIds) claim(o, file);

    const steps = Array.isArray(d.steps) ? d.steps : [];
    const questions = Array.isArray(d.questions) ? d.questions : [];
    const rebuilds = Array.isArray(d.rebuild_tasks) ? d.rebuild_tasks : [];
    const hints = Array.isArray(d.hints) ? d.hints : [];
    const stepIds = new Set(steps.map((s) => s?.step_id).filter(Boolean));
    const stepById = new Map(steps.filter((s) => s?.step_id).map((s) => [s.step_id, s]));
    const questionIds = new Set(questions.map((q) => q?.question_id).filter(Boolean));
    const rebuildIds = new Set(rebuilds.map((r) => r?.rebuild_id).filter(Boolean));
    const targets = new Set([...stepIds, ...questionIds, ...rebuildIds]);
    stepCount += stepIds.size;
    questionCount += questions.length;
    rebuildCount += rebuilds.length;
    hintCount += hints.length;

    // 힌트 (최상위 목록)
    const hintIds = new Set();
    const levelsByTarget = new Map();
    hints.forEach((h, i) => {
      const r = hintSchema.safeParse(h);
      for (const m of zodIssues(r)) err(1, file, `hints[${i}] ${m}`);
      if (!h || typeof h !== 'object') return;
      for (const k of Object.keys(h)) if (!KNOWN.hint.has(k)) warn(file, `${h.hint_id ?? `hints[${i}]`}: 모르는 칸 "${k}"`);
      if (h.hint_id) {
        claim(h.hint_id, file);
        hintIds.add(h.hint_id);
        if (h.target_id && h.level && h.hint_id !== `${h.target_id}-H${h.level}`) err(6, file, `${h.hint_id}: hint_id 는 ${h.target_id}-H${h.level} 이어야 합니다`);
      }
      if (h.target_id && !targets.has(h.target_id)) err(6, file, `${h.hint_id}: 대상 ${h.target_id}가 없습니다`);
      if (h.target_id && Number.isInteger(h.level)) {
        const set = levelsByTarget.get(h.target_id) ?? new Set();
        if (set.has(h.level)) err(6, file, `${h.target_id}: 힌트 단계 ${h.level}가 두 번 있습니다`);
        set.add(h.level);
        levelsByTarget.set(h.target_id, set);
      }
      for (const m of hintShapeIssues(h)) err(1, file, m);
      if (h.code != null || h.code_line_notes_ko != null) {
        if (codeLines(h.code) !== (h.code_line_notes_ko?.length ?? 0)) err(2, file, `${h.hint_id}: 코드 ${codeLines(h.code)}줄, 줄별 풀이 ${h.code_line_notes_ko?.length ?? 0}개`);
      }
    });
    const checkHintIds = (owner, ids, file2) => {
      for (const hid of ids ?? []) if (!hintIds.has(hid)) err(6, file2, `${owner}: hint_ids 의 ${hid}가 hints 목록에 없습니다`);
    };
    const needH1toH4 = (targetId) => {
      const lv = levelsByTarget.get(targetId) ?? new Set();
      const missing = [1, 2, 3, 4].filter((l) => !lv.has(l));
      if (missing.length) err(9, file, `${targetId}: 힌트 ${missing.map((l) => `H${l}`).join(', ')}가 없습니다(H1~H4 모두 필요)`);
    };
    for (const [t, lv] of levelsByTarget) {
      const sorted = [...lv].sort((a, b) => a - b);
      if (sorted.some((x, i) => x !== i + 1)) err(6, file, `${t}: 힌트 단계가 1부터 이어지지 않습니다: ${sorted.join(',')}`);
    }

    // 단계
    const orders = new Map();
    const segL = lid ? segs?.lectures?.[lid] : null;
    if (lid && segs) {
      if (!segL) err(5, file, `${lid}가 video-segments.json lectures 에 없습니다`);
      else {
        if (segL.youtube_video_id !== lecture.youtube_video_id) err(5, file, `youtube_video_id(${lecture.youtube_video_id})가 video-segments.json(${segL.youtube_video_id})과 다릅니다`);
        if (segL.video_seconds !== lecture.video_seconds) err(5, file, `video_seconds(${lecture.video_seconds})가 video-segments.json(${segL.video_seconds})과 다릅니다`);
      }
    }
    const listItem = lid ? lectureListById.get(lid) : null;
    if (listItem?.youtube_video_id && listItem.youtube_video_id !== lecture.youtube_video_id) err(5, bundle.lecturesFile.path, `${lid} youtube_video_id 가 강의 콘텐츠와 다릅니다`);
    const videoSeconds = lecture.video_seconds ?? segL?.video_seconds;

    steps.forEach((s, i) => {
      const r = stepSchema.safeParse(s);
      for (const m of zodIssues(r)) err(1, file, `steps[${i}] ${s?.step_id ?? ''} ${m}`);
      if (!s || typeof s !== 'object') return;
      const sid = s.step_id ?? `steps[${i}]`;
      for (const k of Object.keys(s)) if (!KNOWN.step.has(k)) warn(file, `${sid}: 모르는 칸 "${k}"`);
      if (s.step_id) {
        claim(s.step_id, file);
        if (lid && !s.step_id.startsWith(`${lid}-`)) err(1, file, `${sid}: 강의 id(${lid})로 시작해야 합니다`);
      }
      if (lid && s.lecture_id && s.lecture_id !== lid) err(1, file, `${sid}: lecture_id(${s.lecture_id})가 ${lid}와 다릅니다`);
      if (Number.isInteger(s.order)) {
        if (orders.has(s.order)) err(1, file, `${sid}: order ${s.order}가 ${orders.get(s.order)}와 겹칩니다`);
        orders.set(s.order, sid);
      }
      // 2 줄별 풀이
      if (codeLines(s.code) !== (s.code_line_notes_ko?.length ?? 0)) err(2, file, `${sid}: code ${codeLines(s.code)}줄, code_line_notes_ko ${s.code_line_notes_ko?.length ?? 0}개`);
      if (s.prepared_code != null || s.prepared_code_line_notes_ko != null) {
        if (codeLines(s.prepared_code) !== (s.prepared_code_line_notes_ko?.length ?? 0))
          err(2, file, `${sid}: prepared_code ${codeLines(s.prepared_code)}줄, prepared_code_line_notes_ko ${s.prepared_code_line_notes_ko?.length ?? 0}개`);
      }
      // 3·10 줄 수
      if (s.kind !== 'copy_run' && Number.isInteger(s.new_code_lines) && typeof s.long_step === 'boolean') {
        const n = s.new_code_lines;
        if (n > 10) err(3, file, `${sid}: new_code_lines ${n}는 10을 넘습니다`);
        else if (n >= 6 && !s.long_step) err(3, file, `${sid}: new_code_lines ${n}(6~10)이면 long_step: true`);
        else if (n === 0 && s.long_step) err(10, file, `${sid}: new_code_lines 0이면 long_step: false`);
        else if (n >= 1 && n <= 5 && s.long_step) err(3, file, `${sid}: new_code_lines ${n}(1~5)이면 long_step: false`);
        const replaced = (s.edits ?? []).filter((e) => e?.action === 'replace').reduce((a, e) => a + (e.line_count ?? 0), 0);
        const want = n + (s.moved_code_lines ?? 0) + replaced;
        if (s.code != null && codeLines(s.code) !== want)
          err(3, file, `${sid}: code ${codeLines(s.code)}줄 ≠ new ${n} + moved ${s.moved_code_lines ?? 0} + 바꾸는 줄 ${replaced}`);
      }
      // edits 가 code 앞쪽 줄을 차례로 가져간다
      const editLines = (s.edits ?? []).reduce((a, e) => a + (e?.line_count ?? 0), 0);
      if (editLines > codeLines(s.code)) err(1, file, `${sid}: edits 줄 수 합(${editLines})이 code 줄 수(${codeLines(s.code)})보다 큽니다`);
      for (const x of stepCellIssues(s, stepById)) err(x.kind === 'lines' ? 3 : 6, file, x.message);
      // 7 주석(경고)
      if (s.code && hasPythonComment(s.code)) warn(file, `${sid}: code 안에 # 주석이 있습니다(decisions C2, 경고만)`);
      // 9 힌트 개수
      if (s.kind === 'code' && s.step_id) needH1toH4(s.step_id);
      checkHintIds(sid, s.hint_ids, file);
      // 6 참조
      for (const o of s.objective_ids ?? []) if (!objectiveIds.has(o)) err(6, file, `${sid}: objective_ids ${o}가 lecture.objectives 에 없습니다`);
      for (const x of s.rerun_first ?? []) if (!stepIds.has(x)) err(6, file, `${sid}: rerun_first ${x}가 같은 편에 없습니다`);
      for (const e of s.edits ?? []) if (e?.target_step && !stepIds.has(e.target_step)) err(6, file, `${sid}: edits.target_step ${e.target_step}가 같은 편에 없습니다`);
      // 고친 뒤 셀 전체(화면 "전체 보기")를 만들 수 있어야: 기준 줄이 앞 단계까지 고친 셀에 있어야 한다
      for (const t of new Set((s.edits ?? []).map((e) => e?.target_step).filter((x) => stepIds.has(x))))
        if (!reconstructCell(steps, s, t).ok) err(6, file, `${sid}: ${t} 셀에서 고칠 기준 줄을 찾지 못했습니다`);
      // 5 영상
      const own = Array.isArray(s.video_segments) ? s.video_segments : null;
      const fromSegs = s.step_id && segs ? segs.steps?.[s.step_id] : undefined;
      if (segs && s.step_id && !fromSegs) err(5, file, `${sid}: video-segments.json steps 에 없습니다`);
      if (fromSegs) {
        if (fromSegs.youtube_video_id && fromSegs.youtube_video_id !== lecture.youtube_video_id) err(5, file, `${sid}: 영상 id(${fromSegs.youtube_video_id})가 강의와 다릅니다`);
        if (own && JSON.stringify(own.map((g) => [g?.start_s, g?.end_s])) !== JSON.stringify((fromSegs.video_segments ?? []).map((g) => [g?.start_s, g?.end_s])))
          err(5, file, `${sid}: 단계의 video_segments 가 video-segments.json 과 다릅니다`);
      }
      const list = own ?? fromSegs?.video_segments ?? [];
      if (list.length === 0 && s.step_id && !isNoVideoStep(s.step_id)) err(5, file, `${sid}: 영상 구간이 없습니다(영상 없는 단계 목록에 없음)`);
      if (list.length > 0 && s.step_id && isNoVideoStep(s.step_id)) err(5, file, `${sid}: 영상 없는 단계 목록에 있는데 구간이 있습니다`);
      list.forEach((g, gi) => {
        const st = g?.start_s;
        const en = g?.end_s;
        if (en == null) err(5, file, `${sid} 구간 ${gi + 1}: end_s 가 비었습니다(D49: 늘 값이 있어야 함)`);
        else if (!Number.isInteger(st) || st < 0 || !(st < en)) err(5, file, `${sid} 구간 ${gi + 1}: 0 ≤ start_s(${st}) < end_s(${en}) 가 아닙니다`);
        else if (videoSeconds && en > videoSeconds) err(5, file, `${sid} 구간 ${gi + 1}: end_s ${en}가 영상 길이 ${videoSeconds}초를 넘습니다`);
      });
      // 8 출처
      const o = s.code_origin;
      if (o?.repo) {
        if (/build-nanogpt/i.test(o.repo)) err(8, file, `${sid}: code_origin.repo 에 build-nanogpt 가 있습니다(코드 복사 금지, 링크만)`);
        else if (!licenseNames.some((n) => n.includes(String(o.repo).split('/').pop().toLowerCase())))
          err(8, file, `${sid}: 원본 저장소 ${o.repo}의 LICENSE 가 third_party/licenses/ 에 없습니다`);
      }
    });
    // 구간 정본에 있는 이 편 단계는 모두 콘텐츠에 있어야 한다
    if (lid && segs?.steps) {
      for (const [k, e] of Object.entries(segs.steps)) if (e?.lecture_id === lid && !stepIds.has(k)) err(5, file, `${k}: video-segments.json 에는 있는데 콘텐츠에 없습니다`);
    }

    // 문제
    const alternates = new Map();
    questions.forEach((q, i) => {
      for (const m of zodIssues(questionSchema.safeParse(q))) err(1, file, `questions[${i}] ${q?.question_id ?? ''} ${m}`);
      if (!q || typeof q !== 'object') return;
      const qid = q.question_id ?? `questions[${i}]`;
      for (const k of Object.keys(q)) if (!KNOWN.question.has(k)) warn(file, `${qid}: 모르는 칸 "${k}"`);
      if (q.question_id) claim(q.question_id, file);
      if (typeof q.answer_ko !== 'string' || !q.answer_ko.trim()) err(6, file, `${qid}: answer_ko 가 없습니다`);
      if (!Array.isArray(q.rubric) || q.rubric.length === 0) err(6, file, `${qid}: rubric 이 없습니다`);
      if (q.after_step && !stepIds.has(q.after_step)) err(6, file, `${qid}: after_step ${q.after_step}가 같은 편에 없습니다`);
      if (!q.after_step) warn(file, `${qid}: after_step 이 없어 단계 화면에 나오지 않습니다`);
      for (const o of q.objective_ids ?? []) if (!objectiveIds.has(o)) err(6, file, `${qid}: objective_ids ${o}가 없습니다`);
      checkHintIds(qid, q.hint_ids, file);
      if (q.type === 'choice') {
        if (!Array.isArray(q.choices) || q.choices.length < 2) err(4, file, `${qid}: choices 가 2개 이상이어야 합니다`);
        if (!Number.isInteger(q.answer_index)) err(4, file, `${qid}: answer_index 가 없습니다`);
        else if (Array.isArray(q.choices) && (q.answer_index < 0 || q.answer_index >= q.choices.length)) err(4, file, `${qid}: answer_index ${q.answer_index}가 보기 범위 밖입니다`);
        if (q.auto_grade?.type !== 'choice') err(4, file, `${qid}: choice 문항은 auto_grade.type 이 choice 여야 합니다`);
      }
      if (q.dont_know_index != null && !(q.type === 'choice' && Array.isArray(q.choices) && q.dont_know_index < q.choices.length && q.dont_know_index !== q.answer_index))
        err(4, file, `${qid}: dont_know_index 는 정답이 아닌 보기 번호여야 합니다`);
      if (q.answer_code != null && notesMismatch(q.answer_code, q.answer_code_line_notes_ko)) err(2, file, `${qid}: answer_code ${codeLines(q.answer_code)}줄, 줄별 풀이 ${q.answer_code_line_notes_ko?.length ?? 0}개`);
      // 확인 문제는 유형과 상관없이 힌트 H1~H4 (설계서 3-2)
      if (q.question_id && q.scored !== false) needH1toH4(q.question_id);
      if (q.alternate_of) alternates.set(q.alternate_of, [...(alternates.get(q.alternate_of) ?? []), q]);
    });
    for (const [orig, alts] of alternates) {
      const o = questions.find((x) => x?.question_id === orig);
      if (!o) err(6, file, `alternate_of ${orig}: 원 문항이 없습니다`);
      else for (const a of alts) if (a.type !== o.type || a.max_points !== o.max_points) err(6, file, `${a.question_id}: 원 문항(${orig})과 type·max_points 가 같아야 합니다`);
      if (alts.length !== 1) err(6, file, `${orig}: 대체 문항은 정확히 하나여야 합니다(${alts.length}개)`);
    }

    // 재구성
    rebuilds.forEach((t, i) => {
      for (const m of zodIssues(rebuildSchema.safeParse(t))) err(1, file, `rebuild_tasks[${i}] ${m}`);
      if (!t || typeof t !== 'object') return;
      const rid = t.rebuild_id ?? `rebuild_tasks[${i}]`;
      for (const k of Object.keys(t)) if (!KNOWN.rebuild.has(k)) warn(file, `${rid}: 모르는 칸 "${k}"`);
      if (t.rebuild_id) claim(t.rebuild_id, file);
      checkHintIds(rid, t.hint_ids, file);
      if (typeof t.task_ko !== 'string' || !t.task_ko.trim()) err(6, file, `${rid}: task_ko(과제 글)가 없습니다`);
      if (t.check_code != null) {
        if (notesMismatch(t.check_code, t.check_code_line_notes_ko)) err(2, file, `${rid}: check_code ${codeLines(t.check_code)}줄, 줄별 풀이 ${t.check_code_line_notes_ko?.length ?? 0}개`);
        if (typeof t.pass_ko !== 'string' || !t.pass_ko.trim()) err(6, file, `${rid}: 확인 셀(check_code)이 있으면 통과 기준 pass_ko 가 있어야 합니다`);
      }
      if (t.solution_code != null && t.solution_code_line_notes_ko != null && notesMismatch(t.solution_code, t.solution_code_line_notes_ko)) err(2, file, `${rid}: solution_code 줄 수와 줄별 풀이 개수가 다릅니다`);
      if (t.rebuild_id && levelsByTarget.has(t.rebuild_id)) needH1toH4(t.rebuild_id);
    });

    // 7 긴 줄표: 모든 글자 값
    for (const [at, v] of strings(d)) if (v.includes('\u2014')) err(7, file, `${at}: 긴 줄표(U+2014)가 있습니다`);
  }
  for (const t of bundle.rawTexts ?? []) {
    if (!/\.ya?ml$/.test(t.path)) continue;
    t.text.split('\n').forEach((line, i) => {
      if (line.includes('\u2014')) err(7, t.path, `${i + 1}번째 줄에 긴 줄표(U+2014)가 있습니다`);
    });
  }
  if (!bundle.lectureFiles?.length) err(1, bundle.contentDir, '강의 콘텐츠가 없습니다');
  return { errors, warnings, stats: { lectures: bundle.lectureFiles?.length ?? 0, steps: stepCount, questions: questionCount, rebuild: rebuildCount, hints: hintCount } };
}

const SOURCE_LABEL = {
  snapshot: '정본 사본 app/tests/fixtures/pedagogy (병합 전)',
  content: '정본 inputs/pedagogy/content',
};

export function formatReport({ errors, warnings, stats }, source, contentDir) {
  const out = [`콘텐츠 검사 (${SOURCE_LABEL[source] ?? contentDir}): 강의 ${stats.lectures}편, 단계 ${stats.steps}개, 문항 ${stats.questions}개, 재구성 ${stats.rebuild}개, 힌트 ${stats.hints}개`];
  for (const e of errors) out.push(`  ✕ 규칙 ${e.rule} ${RULES[e.rule]} | ${e.file} | ${e.message}`);
  for (const w of warnings) out.push(`  △ 경고 | ${w.file} | ${w.message}`);
  out.push(errors.length ? `실패: 오류 ${errors.length}건, 경고 ${warnings.length}건` : `통과: 오류 0건, 경고 ${warnings.length}건`);
  return out.join('\n');
}

export { ID };
