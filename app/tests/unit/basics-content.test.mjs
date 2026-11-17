// 사전 기초 콘텐츠 검사 (교사 정본 F.json 클로드 버전 형식): 최상위 키 7개, ID 규칙(F-P1-S1·F-P1-S2b·F-P1-Q1·F-P1-R1·F-D1·{대상}-H{n}),
// answer_index·dont_know_index 범위, unit_id 존재(진단 F-DIAG), units 의 step_ids·question_ids·rebuild_ids·objective_ids 와 실제 항목 양방향 일치,
// order 중복 없음, status(없음 = 내용 있음, planned = 내용 0건), 힌트 대상·가리키는 단위·설명 카드 문장, 빈칸 답 수, 셀 줄 수 합, 실행 순서,
// 진단 약속 값(hints·locks_anything false), 모르겠어요(고르기 dont_know_index, 직접 입력 allow_dont_know), 추천 규칙, 편별 선행 기초 단위.
// 규칙은 테스트용 예시(tests/fixtures/basics/F.json, 정본 claude-1.1 에서 다시 뽑음)로 확인하고, 정본 F.json 도 같은 검사를 통과해야 한다.
// 문구는 박지 않는다(개수·ID·구조로 검사). 시험에 쓰는 단계·문항은 칸 모양으로 고른다.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASICS, MASTERY_EXCLUDED_KINDS } from '../../src/content-config.mjs';
import { APP_DIR, REPO_ROOT, readBasicsBundle, readBundle, resolveBasicsPath, resolvePaths } from '../../src/lib/content/load.mjs';
import { buildBasics, checkPrereqUnits, isOpenUnit, TOP_KEYS, validateBasics } from '../../src/lib/content/basics.mjs';

const FIXTURE = path.join(APP_DIR, 'tests/fixtures/basics/F.json');
const base = readBasicsBundle(resolveBasicsPath({ Z2H_BASICS_FILE: FIXTURE }));
const clone = () => structuredClone(base);
const D = (b) => b.file.data;
const unit = (b, id) => D(b).lecture.units.find((u) => u.unit_id === id);
const q = (b, id) => D(b).questions.find((x) => x.question_id === id);
const st = (b, id) => D(b).steps.find((x) => x.step_id === id);
const rb = (b, id) => D(b).rebuild_tasks.find((x) => x.rebuild_id === id);
const hint = (b, id) => D(b).hints.find((h) => h.hint_id === id);
const rules = (b) => validateBasics(b).errors.map((e) => e.rule);

const U0 = D(base).lecture.units[0].unit_id;
const S0 = D(base).steps.find((s) => s.unit_id === U0).step_id;
const Q0 = D(base).questions.find((x) => x.unit_id === U0).question_id;
const R0 = D(base).rebuild_tasks.find((x) => x.unit_id === U0).rebuild_id;
const DIAG = D(base).lecture.diagnostic.question_ids;
const DIAG_CHOICE = DIAG.find((id) => q(base, id).type === 'choice');
const DIAG_TEXT = DIAG.find((id) => q(base, id).type === 'predict');
const BLANK_HINT = D(base).hints.find((h) => h.blank_answers).hint_id;
const POINT_HINT = D(base).hints.find((h) => h.points_to_card_line).hint_id;
const PLAN_STEP = D(base).steps.find((s) => (s.run_plan ?? []).some((x) => x.startsWith('cell:'))).step_id;
const OUTPUT_Q = D(base).questions.find((x) => x.graded_on === 'output').question_id;

describe('로더: 교사 정본 F.json 하나만 (경로는 설정 한 곳, 없으면 빌드 실패)', () => {
  it('기본 경로는 content-config BASICS.file', () => {
    expect(BASICS.file).toBe('inputs/pedagogy/content/F.json');
    expect(resolveBasicsPath({}, REPO_ROOT)).toEqual({ path: path.join(REPO_ROOT, BASICS.file), source: 'canonical' });
  });
  it('테스트만 환경 변수로 다른 파일', () => {
    expect(resolveBasicsPath({ Z2H_BASICS_FILE: FIXTURE }, REPO_ROOT)).toEqual({ path: FIXTURE, source: 'override' });
  });
  it('파일이 없으면 검사 오류(빌드 실패)', () => {
    const b = readBasicsBundle({ path: path.join(APP_DIR, 'tests/fixtures/basics/없는파일.json'), source: 'override' });
    expect(validateBasics(b).errors.map((e) => e.rule)).toContain(1);
  });
});

describe('테스트용 예시는 통과', () => {
  it('오류 0·경고 0, 단위·단계·문항·과제·힌트 수는 콘텐츠에서 센다', () => {
    const r = validateBasics(base);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.stats).toMatchObject({ units: D(base).lecture.units.length, steps: D(base).steps.length, questions: D(base).questions.length, rebuild: D(base).rebuild_tasks.length, hints: D(base).hints.length, diagnostic: DIAG.length });
    expect(r.stats.written + r.stats.planned).toBe(r.stats.units);
  });
});

describe('형식 검사 실패 예', () => {
  it('최상위 키 7개: 빠지면 오류, 모르는 키는 경고만', () => {
    expect(TOP_KEYS).toEqual(['_meta', 'lecture', 'steps', 'questions', 'rebuild_tasks', 'mastery_rule', 'hints']);
    const b1 = clone();
    delete D(b1).rebuild_tasks;
    expect(rules(b1)).toContain(1);
    const b2 = clone();
    D(b2).new_top = [];
    expect(rules(b2)).toEqual([]);
    expect(validateBasics(b2).warnings.some((w) => w.message.includes('new_top'))).toBe(true);
  });
  it('모르는 칸이 늘어도 빌드는 깨지지 않는다(경고만)', () => {
    const b = clone();
    st(b, S0).new_field = 1;
    q(b, Q0).new_field = 1;
    rb(b, R0).new_field = 1;
    unit(b, U0).new_field = 1;
    expect(rules(b)).toEqual([]);
    expect(validateBasics(b).warnings).toHaveLength(4);
  });
  it('ID 규칙: 단계 F-P1-S1·F-P1-S2b, 문항 F-P1-Q1, 과제 F-P1-R1, 진단 F-D1, 힌트 {대상}-H{n}', () => {
    expect(D(base).steps.some((s) => /-S\d+[a-z]$/.test(s.step_id))).toBe(true); // 쪼갠 단계도 통과
    const cases = [
      (b) => (st(b, S0).step_id = `${U0}-2`),
      (b) => (q(b, Q0).question_id = `${U0}-QA`),
      (b) => (rb(b, R0).rebuild_id = `${U0}-X1`),
      (b) => (q(b, DIAG[0]).question_id = 'F-DX'),
      (b) => (D(b).hints.find((h) => h.target_id === S0 && h.level === 1).hint_id = `${S0}-H9`),
    ];
    for (const c of cases) {
      const b = clone();
      c(b);
      expect(rules(b)).toContain(1);
    }
  });
  it('단위 id 머리말과 kind 가 맞아야(F-P 파이썬, F-M 수학)', () => {
    const b = clone();
    unit(b, U0).kind = unit(b, U0).kind === 'python' ? 'math' : 'python';
    expect(rules(b)).toContain(2);
  });
  it('answer_index 가 choices 범위 밖이면 실패, 모르겠어요 보기 번호는 정답이 아니어야', () => {
    const b = clone();
    q(b, DIAG_CHOICE).answer_index = q(b, DIAG_CHOICE).choices.length;
    expect(rules(b)).toContain(4);
    const b2 = clone();
    q(b2, DIAG_CHOICE).dont_know_index = q(b2, DIAG_CHOICE).answer_index;
    expect(rules(b2)).toContain(4);
  });
  it('모든 unit_id 가 units 에 있어야(진단은 F-DIAG)', () => {
    const b1 = clone();
    st(b1, S0).unit_id = 'F-X1';
    expect(rules(b1).length).toBeGreaterThan(0);
    const b2 = clone();
    q(b2, DIAG[1]).unit_id = 'F-DIAGX';
    expect(rules(b2).length).toBeGreaterThan(0);
    const b3 = clone();
    rb(b3, R0).unit_id = D(b3).lecture.units[1].unit_id;
    expect(rules(b3)).toContain(6);
  });
  it('units 의 step_ids·question_ids·rebuild_ids·objective_ids 와 실제 항목이 양방향으로 같아야', () => {
    for (const k of ['step_ids', 'question_ids', 'rebuild_ids', 'objective_ids']) {
      const b = clone();
      unit(b, U0)[k] = unit(b, U0)[k].slice(1);
      expect(rules(b), k).toContain(3);
    }
  });
  it('order 중복 없음', () => {
    const b = clone();
    D(b).steps[1].order = D(b).steps[0].order;
    expect(rules(b)).toContain(1);
  });
  it('status: 없으면 내용 있음(여는 단위), planned 는 내용 0건이어야, 모르는 값은 실패', () => {
    expect(D(base).lecture.units.every((u) => u.status === undefined)).toBe(true);
    expect(D(base).lecture.units.every(isOpenUnit)).toBe(true);
    const b1 = clone();
    unit(b1, U0).status = 'planned';
    expect(rules(b1)).toContain(3);
    const b2 = clone();
    unit(b2, U0).status = 'soon';
    expect(rules(b2)).toContain(1);
  });
  it('힌트 대상, 가리키는 단위·설명 카드 문장, 빈칸 답 수', () => {
    const b1 = clone();
    D(b1).hints.push({ hint_id: `${U0}-S99-H1`, target_id: `${U0}-S99`, level: 1, text_ko: '힌트' });
    expect(rules(b1)).toContain(6);
    const b2 = clone();
    hint(b2, POINT_HINT).points_to_id = 'F-P99';
    expect(rules(b2)).toContain(6);
    const b3 = clone();
    hint(b3, POINT_HINT).points_to_card_line = 99;
    expect(rules(b3)).toContain(6);
    const b4 = clone();
    hint(b4, BLANK_HINT).blank_answers = [...hint(b4, BLANK_HINT).blank_answers, '하나 더'];
    expect(rules(b4)).toContain(1);
  });
  it('실행 순서(run_plan)와 셀 위치(place_before)는 같은 단위 안, 셀 줄 수 합은 새 셀 줄 수', () => {
    const b1 = clone();
    st(b1, PLAN_STEP).run_plan = ['cell:F-M6-S1:9'];
    expect(rules(b1)).toContain(6);
    const b2 = clone();
    st(b2, PLAN_STEP).run_plan = ['new:9'];
    expect(rules(b2)).toContain(6);
    const b3 = clone();
    st(b3, S0).place_before = D(b3).steps.find((s) => s.unit_id !== U0).step_id;
    expect(rules(b3)).toContain(6);
    const b4 = clone();
    st(b4, S0).cell_line_counts = [...st(b4, S0).cell_line_counts, 1];
    expect(rules(b4)).toContain(9);
  });
  it('진단: 문항 목록, 추천 단위, 힌트 없음, 직접 입력 exact, 모르겠어요가 모든 문항에', () => {
    const b1 = clone();
    D(b1).lecture.diagnostic.question_ids.push('F-D9');
    expect(rules(b1)).toContain(4);
    const b2 = clone();
    q(b2, DIAG[1]).recommend_units_if_wrong = [U0, 'F-P10'];
    expect(rules(b2)).toContain(4);
    const b3 = clone();
    q(b3, DIAG_TEXT).auto_grade = { type: 'keywords', keywords: ['8'] };
    expect(rules(b3)).toContain(4);
    const b4 = clone();
    q(b4, DIAG[0]).hint_ids = [`${DIAG[0]}-H1`];
    D(b4).hints.push({ hint_id: `${DIAG[0]}-H1`, target_id: DIAG[0], level: 1, text_ko: '힌트' });
    expect(rules(b4)).toContain(4);
    const b5 = clone();
    delete q(b5, DIAG_TEXT).allow_dont_know;
    expect(rules(b5)).toContain(4);
    const b6 = clone();
    delete q(b6, DIAG_CHOICE).dont_know_index;
    expect(rules(b6)).toContain(4);
  });
  it('진단 약속(힌트 없음·잠금 없음)이 다르면 실패', () => {
    for (const [k, v] of Object.entries(BASICS.diagnosticPromises)) {
      const b = clone();
      D(b).lecture.diagnostic[k] = !v;
      expect(rules(b), k).toContain(4);
    }
  });
  it('확인 문제: 실행 결과로 채점하면 정답 = answer_output, 정답 코드 줄별 풀이 개수', () => {
    const b1 = clone();
    q(b1, OUTPUT_Q).answer_output = '다른 출력';
    expect(rules(b1)).toContain(8);
    const b2 = clone();
    q(b2, OUTPUT_Q).answer_code_line_notes_ko.pop();
    expect(rules(b2)).toContain(8);
  });
  it('익힘 규칙 값과 추천 규칙(앱이 아는 규칙, 처음이면 먼저 = recommend_first)', () => {
    const b1 = clone();
    D(b1).mastery_rule.question_score_ratio = 1.5;
    expect(rules(b1)).toContain(11);
    const b2 = clone();
    D(b2).lecture.recommend_rules.push({ rule_id: 'new_rule', label_ko: '새 규칙', when_ko: '언제' });
    expect(rules(b2)).toContain(1);
    const b3 = clone();
    const notFirst = D(b3).lecture.units.find((u) => !u.recommend_first);
    notFirst.recommend_first = true;
    expect(rules(b3)).toContain(13);
  });
  it('영상 없음, 줄별 풀이, 단계 힌트 H1~H2·문제 힌트 H1~H4, 긴 줄표', () => {
    const b1 = clone();
    st(b1, S0).video_segments = [{ start_s: 0, end_s: 10 }];
    expect(rules(b1)).toEqual(expect.arrayContaining([1, 5]));
    const b2 = clone();
    st(b2, S0).code_line_notes_ko = [];
    expect(rules(b2)).toContain(9);
    const b3 = clone();
    D(b3).hints = D(b3).hints.filter((h) => h.hint_id !== `${S0}-H2`);
    st(b3, S0).hint_ids = st(b3, S0).hint_ids.filter((x) => x !== `${S0}-H2`);
    expect(rules(b3)).toContain(10);
    const b4 = clone();
    D(b4).hints = D(b4).hints.filter((h) => h.hint_id !== `${Q0}-H4`);
    q(b4, Q0).hint_ids = q(b4, Q0).hint_ids.filter((x) => x !== `${Q0}-H4`);
    expect(rules(b4)).toContain(10);
    const b5 = clone();
    st(b5, S0).meaning_ko = `실행했습니다${String.fromCharCode(0x2014)}끝`;
    expect(rules(b5)).toContain(7);
  });
  it('편별 선행 기초 단위: 기초 단위 목록에 있고, 강의 정본 prereq_units 와 같아야', () => {
    const lectures = readBundle(resolvePaths()).lectureFiles;
    expect(checkPrereqUnits(lectures, D(base))).toEqual([]);
    const fake = [{ path: 'L99.json', data: { lecture: { lecture_id: 'L99', prereq_units: [U0, 'F-X9'] } } }];
    expect(checkPrereqUnits(fake, D(base)).map((e) => e.rule)).toEqual([12]);
    const b = clone();
    D(b).lecture.lecture_prereq_units.L01 = [U0];
    expect(checkPrereqUnits(lectures, D(b)).map((e) => e.rule)).toEqual([12]);
    const b2 = clone();
    D(b2).lecture.lecture_prereq_units.L02 = ['F-P99'];
    expect(rules(b2)).toContain(12);
  });
});

describe('화면 데이터', () => {
  const site = buildBasics(base);
  it('단위는 정본 순서, 여는 단위 = status 없음·written, 묶음은 kind', () => {
    expect(site.units.map((u) => u.unit_id)).toEqual(D(base).lecture.units.map((u) => u.unit_id));
    expect(site.readyIds).toEqual(D(base).lecture.units.filter(isOpenUnit).map((u) => u.unit_id));
    for (const g of site.groups) expect(g.unit_ids).toEqual(D(base).lecture.units.filter((u) => u.kind === g.id).map((u) => u.unit_id));
    expect(Object.keys(site.steps).sort()).toEqual([...site.readyIds].sort());
  });
  it('planned 단위는 준비 중(내용 없음), 다른 단위는 그대로', () => {
    const b = clone();
    const u = unit(b, U0);
    D(b).steps = D(b).steps.filter((s) => s.unit_id !== U0);
    D(b).questions = D(b).questions.filter((x) => x.unit_id !== U0);
    D(b).rebuild_tasks = D(b).rebuild_tasks.filter((x) => x.unit_id !== U0);
    D(b).hints = D(b).hints.filter((h) => !h.target_id.startsWith(`${U0}-`));
    Object.assign(u, { status: 'planned', step_ids: [], question_ids: [], rebuild_ids: [] });
    const s2 = buildBasics(b);
    expect(s2.readyIds).not.toContain(U0);
    expect(s2.units.find((x) => x.unit_id === U0)).toMatchObject({ ready: false, status: 'planned' });
  });
  it('설명 카드(card_ko·analogy_ko)·목표·예상 시간·필요한 편은 단위 데이터에 그대로', () => {
    for (const u of D(base).lecture.units) {
      const pub = site.units.find((x) => x.unit_id === u.unit_id);
      expect(pub).toMatchObject({ card_ko: u.card_ko, analogy_ko: u.analogy_ko, goal_ko: u.goal_ko, estimated_minutes: u.estimated_minutes, needed_by_lectures: u.needed_by_lectures, recommend_first: u.recommend_first });
      expect(pub.objectives).toEqual(u.objective_ids.map((o) => D(base).lecture.objectives.find((x) => x.objective_id === o).text_ko));
    }
  });
  it('진단: 안내·결과 문구는 정본 그대로, 공개 칸에는 정답·재는 것이 없고, 모르겠어요 칸은 있다', () => {
    const dx = D(base).lecture.diagnostic;
    expect(site.diagnostic).toMatchObject({ rules_ko: dx.rules_ko, result_if_correct_ko: dx.result_if_correct_ko, result_if_wrong_ko: dx.result_if_wrong_ko });
    expect(site.diagnostic.questions.map((x) => x.question_id)).toEqual(dx.question_ids);
    for (const x of site.diagnostic.questions) {
      for (const k of ['answer_index', 'answer_ko', 'auto_grade', 'measures_ko', 'verify_code']) expect(x).not.toHaveProperty(k);
      const src = q(base, x.question_id);
      expect(x.code).toBe(src.code ?? null);
      expect(x.dont_know_index).toBe(src.dont_know_index ?? null);
      expect(x.allow_dont_know).toBe(src.allow_dont_know === true);
    }
    expect(site.answers[DIAG[0]].measures_ko).toBe(q(base, DIAG[0]).measures_ko);
  });
  it('추천 규칙: 이름·설명은 정본 그대로, 처음이면 먼저 단위 = recommend_first', () => {
    for (const r of D(base).lecture.recommend_rules) expect(site.recommend[r.rule_id]).toMatchObject({ label_ko: r.label_ko, when_ko: r.when_ko });
    expect(site.recommend.always_first.units).toEqual(D(base).lecture.units.filter((u) => u.recommend_first).map((u) => u.unit_id));
    expect(site.lecturePrereq).toEqual(D(base).lecture.lecture_prereq_units);
  });
  it('단위 문제 공개 칸에는 풀이가 없고, 풀이·정답 코드는 answers 에만', () => {
    for (const qs of Object.values(site.questions)) for (const x of qs) for (const k of ['answer_ko', 'auto_grade', 'rubric', 'answer_code', 'answer_output']) expect(x).not.toHaveProperty(k);
    expect(site.answers[Q0].answer_ko).toBe(q(base, Q0).answer_ko);
    expect(site.answers[OUTPUT_Q]).toMatchObject({ answer_code: q(base, OUTPUT_Q).answer_code, answer_code_line_notes_ko: q(base, OUTPUT_Q).answer_code_line_notes_ko, answer_output: q(base, OUTPUT_Q).answer_output });
    expect(site.answers[DIAG_CHOICE].answer_index).toBe(q(base, DIAG_CHOICE).answer_index);
    const qs = Object.values(site.questions).flat();
    expect(qs.find((x) => x.question_id === OUTPUT_Q).graded_on).toBe('output');
  });
  it('단계: unit_id 로 묶고 order 로 정렬, 단위 안 번호, 주소 S1·S2b, 영상 없음, 확인 문제는 after_step 단계에, 새 칸은 화면 데이터에', () => {
    for (const uid of site.readyIds) {
      const raw = D(base).steps.filter((s) => s.unit_id === uid).sort((a, b) => a.order - b.order);
      expect(site.steps[uid].map((s) => s.step_id)).toEqual(raw.map((s) => s.step_id));
      expect(site.steps[uid].map((s) => s.order)).toEqual(raw.map((_, i) => i + 1));
      for (const s of site.steps[uid]) {
        const src = st(base, s.step_id);
        expect(s.slug).toBe(s.step_id.split('-').pop());
        expect(s.video_segments).toEqual([]);
        expect(s.question_ids).toEqual(D(base).questions.filter((x) => x.after_step === s.step_id).map((x) => x.question_id));
        expect(s.cells.map((c) => c.lines.length)).toEqual(src.cell_line_counts);
        expect(s.expected_output_example).toBe(src.expected_output_example);
        expect(s.expected_error ?? null).toBe(src.expected_error ?? null);
        expect(s.self_check_ko ?? null).toEqual(src.self_check_ko ?? null);
        expect(s.restart_first ?? false).toBe(src.restart_first ?? false);
        expect(s.place_before?.step_id ?? null).toBe(src.place_before ?? null);
        expect((s.run_plan ?? []).length).toBe((src.run_plan ?? []).length);
        for (const k of ['expr', 'checks', 'mode', 'lines']) expect(s.expected_check).not.toHaveProperty(k);
      }
    }
  });
  it('고치는 단계(edits): 대상 셀 주소도 기초 주소, 고친 뒤 셀을 만든다', () => {
    const all = Object.values(site.steps).flat().filter((s) => s.edit_view);
    expect(all.length).toBeGreaterThan(0);
    for (const s of all) for (const t of s.edit_view.targets) {
      expect(t.slug).toBe(t.step_id.split('-').pop());
      expect(t.full.ok).toBe(true);
    }
  });
  it('익힘 판정 입력: optional 단계는 빼고, 문제는 max_points·must_pass, 익힘 과제는 판정에 넣는 것만(정본 rebuild_required false)', () => {
    const ex = new Set(MASTERY_EXCLUDED_KINDS);
    for (const u of site.units.filter((x) => x.ready)) {
      expect(u.mastery.step_ids).toEqual(site.steps[u.unit_id].filter((s) => !ex.has(s.kind)).map((s) => s.step_id));
      expect(u.mastery.activity_step_ids).toEqual(site.steps[u.unit_id].map((s) => s.step_id));
      expect(u.mastery.questions.map((x) => x.question_id)).toEqual(unit(base, u.unit_id).question_ids);
      expect(u.mastery.rebuilds).toEqual(D(base).rebuild_tasks.filter((r) => r.unit_id === u.unit_id && (D(base).mastery_rule.rebuild_required || r.required_for_mastery)).map((r) => ({ rebuild_id: r.rebuild_id, max_hint_level_for_pass: r.max_hint_level_for_pass })));
    }
    expect(site.rule).toEqual({ steps_complete_ratio: D(base).mastery_rule.steps_complete_ratio, question_score_ratio: D(base).mastery_rule.question_score_ratio, rebuild_max_hint_level: D(base).mastery_rule.rebuild_max_hint_level, note_ko: D(base).mastery_rule.note_ko });
  });
  it('익힘 과제: 과제 글·출력 예·스스로 확인할 것·힌트 단계, 정답 코드는 hints JSON(H4)에만', () => {
    for (const r of D(base).rebuild_tasks) {
      const pub = site.rebuild[r.unit_id].find((x) => x.rebuild_id === r.rebuild_id);
      expect(pub).toMatchObject({ task_ko: r.prompt_ko, expected_output_example: r.expected_output_example, self_check_ko: r.self_check_ko, max_hint_level_for_pass: r.max_hint_level_for_pass, required_for_mastery: r.required_for_mastery });
      expect(pub.hint_levels).toEqual(D(base).hints.filter((h) => h.target_id === r.rebuild_id).map((h) => h.level).sort());
      expect(JSON.stringify(pub)).not.toContain('solution');
      const h4 = site.hints[r.rebuild_id].find((h) => h.level === 4);
      expect(h4).toMatchObject({ code: r.solution_code, code_line_notes_ko: r.solution_code_line_notes_ko });
    }
  });
  it('힌트 JSON: H2 가리키는 곳(단위·단계·설명 카드 문장), H3 빈칸 답과 채운 뒤 출력', () => {
    const h = hint(base, POINT_HINT);
    const out = site.hints[h.target_id].find((x) => x.level === h.level);
    expect(out.points_to.card_line).toBe(h.points_to_card_line);
    expect([out.points_to.unit_id, out.points_to.step_id]).toContain(h.points_to_id);
    const stepPoint = D(base).hints.find((x) => x.points_to_id && st(base, x.points_to_id));
    if (stepPoint) expect(site.hints[stepPoint.target_id].find((x) => x.level === stepPoint.level).points_to).toMatchObject({ step_id: stepPoint.points_to_id, unit_id: st(base, stepPoint.points_to_id).unit_id });
    const bh = hint(base, BLANK_HINT);
    expect(site.hints[bh.target_id].find((x) => x.level === 3)).toMatchObject({ blank_answers: bh.blank_answers, blank_filled_output: bh.blank_filled_output ?? null });
  });
});

// ---- 교사 정본 F.json (클로드 버전) ----
describe('교사 정본 F.json', () => {
  const rb2 = readBasicsBundle(resolveBasicsPath({}, REPO_ROOT), REPO_ROOT);
  const d = rb2.file?.data;
  it('검사 오류 0, 1편 선행 기초 단위가 모두 있고 서로 같음', () => {
    expect(validateBasics(rb2).errors).toEqual([]);
    expect(checkPrereqUnits(readBundle(resolvePaths()).lectureFiles, d)).toEqual([]);
  });
  it('15단위 모두 내용 있음(정본에 status 칸 없음), 진단 5문제', () => {
    expect(d.lecture.units).toHaveLength(15);
    for (const u of d.lecture.units) expect(d.steps.filter((s) => s.unit_id === u.unit_id).length, u.unit_id).toBeGreaterThan(0);
    expect(d.lecture.diagnostic.question_ids).toHaveLength(5);
    expect(buildBasics(rb2).readyIds).toEqual(d.lecture.units.map((u) => u.unit_id));
  });
});
