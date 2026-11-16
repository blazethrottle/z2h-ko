// 콘텐츠 빌드 검사 (DESIGN.md 12.4절 + PM 계약 보충: 교사 JSON, D49, data-spec v1.2). 어기면 빌드 실패.
// 순수 함수: 디스크를 읽지 않고 load.mjs 가 만든 묶음만 본다(테스트에서 묶음을 고쳐 실패 예를 만든다).
import { isNoVideoStep } from '../../content-config.mjs';
import {
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
  unitSchema,
} from './schema.mjs';

export const RULES = {
  1: '스키마와 id 모양',
  2: '코드 줄 수 = 줄별 풀이 개수',
  3: '줄 수 규칙 (long_step ↔ new_code_lines, code = new + moved + 바꾸는 줄)',
  4: 'choice 보기와 answer_index',
  5: '영상 구간',
  6: '문제 answer_ko·rubric, id 중복, 참조 대상',
  7: '긴 줄표(U+2014) 금지',
  8: '원본 코드 출처와 라이선스',
  9: '힌트 개수 (코드 단계·설명·버그·적용 H1~H4 모두, 예측 0개)',
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

/** 따옴표 밖의 # 이 있으면 주석 (decisions C2. 검사는 경고만: 교사 정본 S16 은 # 로 줄을 막는 단계) */
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
  const units = bundle.unitsFile ? listOf(bundle.unitsFile.data, 'units') : null;
  const unitIds = new Set();
  (units ?? []).forEach((u, i) => {
    for (const m of zodIssues(unitSchema.safeParse(u))) err(1, bundle.unitsFile.path, `[${i}] ${m}`);
    if (u?.unit_id) unitIds.add(u.unit_id);
  });

  const seen = new Map();
  const claim = (id, file) => {
    if (seen.has(id)) err(6, file, `id 중복: ${id} (처음: ${seen.get(id)})`);
    else seen.set(id, file);
  };
  const segs = bundle.segments;
  const licenseNames = (bundle.licenseFiles ?? []).map((f) => String(f).toLowerCase());
  let stepCount = 0;

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
    for (const u of [...(lecture.prereq_units ?? []), ...(lecture.prereq_units_optional ?? [])])
      if (units && !unitIds.has(u)) warn(file, `prereq_units ${u}가 units.yaml 에 없습니다`);

    const steps = Array.isArray(d.steps) ? d.steps : [];
    const questions = Array.isArray(d.questions) ? d.questions : [];
    const rebuilds = Array.isArray(d.rebuild_tasks) ? d.rebuild_tasks : [];
    const hints = Array.isArray(d.hints) ? d.hints : [];
    const stepIds = new Set(steps.map((s) => s?.step_id).filter(Boolean));
    const questionIds = new Set(questions.map((q) => q?.question_id).filter(Boolean));
    const rebuildIds = new Set(rebuilds.map((r) => r?.rebuild_id).filter(Boolean));
    const targets = new Set([...stepIds, ...questionIds, ...rebuildIds]);
    stepCount += stepIds.size;

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
      if (h.code_with_blanks != null && h.level !== 3) err(1, file, `${h.hint_id}: code_with_blanks 는 3단계에서만 씁니다`);
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
      // 7 주석(경고)
      if (s.code && hasPythonComment(s.code)) warn(file, `${sid}: code 안에 # 주석이 있습니다(decisions C2, 경고만)`);
      // 9 힌트 개수
      if (s.kind === 'code' && s.step_id) needH1toH4(s.step_id);
      checkHintIds(sid, s.hint_ids, file);
      // 6 참조
      for (const o of s.objective_ids ?? []) if (!objectiveIds.has(o)) err(6, file, `${sid}: objective_ids ${o}가 lecture.objectives 에 없습니다`);
      for (const x of s.rerun_first ?? []) if (!stepIds.has(x)) err(6, file, `${sid}: rerun_first ${x}가 같은 편에 없습니다`);
      for (const e of s.edits ?? []) if (e?.target_step && !stepIds.has(e.target_step)) err(6, file, `${sid}: edits.target_step ${e.target_step}가 같은 편에 없습니다`);
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
      if (q.type === 'predict' && (levelsByTarget.get(q.question_id)?.size ?? 0) > 0) err(9, file, `${qid}: 예측 문제에는 힌트를 두지 않습니다`);
      if (['explain', 'fix_bug', 'apply'].includes(q.type) && q.question_id) needH1toH4(q.question_id);
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
      if (t?.rebuild_id) claim(t.rebuild_id, file);
      checkHintIds(t?.rebuild_id ?? `rebuild_tasks[${i}]`, t?.hint_ids, file);
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
  return { errors, warnings, stats: { lectures: bundle.lectureFiles?.length ?? 0, steps: stepCount } };
}

const SOURCE_LABEL = {
  snapshot: '교사 정본 사본 app/tests/fixtures/pedagogy (병합 전)',
  content: '교사 정본 inputs/pedagogy/content',
};

export function formatReport({ errors, warnings, stats }, source, contentDir) {
  const out = [`콘텐츠 검사 (${SOURCE_LABEL[source] ?? contentDir}): 강의 ${stats.lectures}편, 단계 ${stats.steps}개`];
  for (const e of errors) out.push(`  ✕ 규칙 ${e.rule} ${RULES[e.rule]} | ${e.file} | ${e.message}`);
  for (const w of warnings) out.push(`  △ 경고 | ${w.file} | ${w.message}`);
  out.push(errors.length ? `실패: 오류 ${errors.length}건, 경고 ${warnings.length}건` : `통과: 오류 0건, 경고 ${warnings.length}건`);
  return out.join('\n');
}

export { ID };
