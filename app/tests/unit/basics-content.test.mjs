// 사전 기초 콘텐츠 검사 (교사 정본 F.json 형식, CTO 지시 목록): 최상위 키 7개, ID 규칙(F-P1-S01·F-P1-Q1·F-P1-R1·F-D1·{대상}-H{n}),
// answer_index 범위, unit_id 존재(진단 F-DIAG), units 의 step_ids·question_ids·rebuild_ids 와 실제 항목 양방향 일치, order 중복 없음,
// written 은 내용 있음·planned 는 내용 0건, 힌트 대상 존재, 진단 question_ids 존재, recommend_units_if_wrong 이 실제 단위,
// 진단 약속 값(recommend_only·locks·auto_skip·uses_hints), mastery_rule.review 값. 화면 데이터에 풀이가 섞이지 않음.
// 규칙은 테스트용 예시(tests/fixtures/basics/F.json, 정본 v1.1 에서 일부만 뽑은 것)로 확인하고, 정본 F.json 도 같은 검사를 통과해야 한다.
// 문구는 박지 않는다(개수·ID·구조로 검사). written/planned 목록은 정본 status 에서 읽는다.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASICS } from '../../src/content-config.mjs';
import { APP_DIR, REPO_ROOT, readBasicsBundle, readBundle, resolveBasicsPath, resolvePaths } from '../../src/lib/content/load.mjs';
import { buildBasics, checkPrereqUnits, TOP_KEYS, validateBasics } from '../../src/lib/content/basics.mjs';

const FIXTURE = path.join(APP_DIR, 'tests/fixtures/basics/F.json');
const base = readBasicsBundle(resolveBasicsPath({ Z2H_BASICS_FILE: FIXTURE }));
const clone = () => structuredClone(base);
const D = (b) => b.file.data;
const unit = (b, id) => D(b).lecture.units.find((u) => u.unit_id === id);
const q = (b, id) => D(b).questions.find((x) => x.question_id === id);
const st = (b, id) => D(b).steps.find((x) => x.step_id === id);
const rb = (b, id) => D(b).rebuild_tasks.find((x) => x.rebuild_id === id);
const rules = (b) => validateBasics(b).errors.map((e) => e.rule);
const written = (b) => D(b).lecture.units.filter((u) => u.status === 'written').map((u) => u.unit_id);
const planned = (b) => D(b).lecture.units.filter((u) => u.status === 'planned').map((u) => u.unit_id);

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
  it('오류 0, 15단위(written/planned 는 status 에서)', () => {
    const r = validateBasics(base);
    expect(r.errors).toEqual([]);
    expect(r.stats.units).toBe(BASICS.unitMap.length);
    expect(r.stats.written + r.stats.planned).toBe(r.stats.units);
    expect(r.stats.written).toBe(written(base).length);
  });
});

describe('형식 검사 실패 예 (CTO 목록)', () => {
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
    st(b, 'F-P1-S02').new_field = 1;
    q(b, 'F-P1-Q1').new_field = 1;
    rb(b, 'F-P1-R1').new_field = 1;
    unit(b, 'F-P1').new_field = 1;
    expect(rules(b)).toEqual([]);
  });
  it('ID 규칙: 단계 F-P1-S01, 문항 F-P1-Q1, 과제 F-P1-R1, 진단 F-D1, 힌트 {대상}-H{n}', () => {
    const cases = [
      (b) => (st(b, 'F-P1-S02').step_id = 'F-P1-2'),
      (b) => (q(b, 'F-P1-Q1').question_id = 'F-P1-QA'),
      (b) => (rb(b, 'F-P1-R1').rebuild_id = 'F-P1-X1'),
      (b) => (q(b, 'F-D1').question_id = 'F-DX'),
      (b) => (D(b).hints.find((h) => h.target_id === 'F-P1-S02' && h.level === 1).hint_id = 'F-P1-S02-H9'),
    ];
    for (const c of cases) {
      const b = clone();
      c(b);
      expect(rules(b)).toContain(1);
    }
  });
  it('answer_index 가 choices 범위 밖이면 실패', () => {
    const b = clone();
    q(b, 'F-D1').answer_index = q(b, 'F-D1').choices.length;
    expect(rules(b)).toContain(4);
  });
  it('모든 unit_id 가 units 에 있어야(진단은 F-DIAG)', () => {
    const b1 = clone();
    st(b1, 'F-P1-S02').unit_id = 'F-X1';
    expect(rules(b1).length).toBeGreaterThan(0);
    const b2 = clone();
    q(b2, 'F-D2').unit_id = 'F-DIAGX';
    expect(rules(b2).length).toBeGreaterThan(0);
    const b3 = clone();
    rb(b3, 'F-P1-R1').unit_id = 'F-P2';
    expect(rules(b3)).toContain(6);
  });
  it('units 의 step_ids·question_ids·rebuild_ids 와 실제 항목이 양방향으로 같아야', () => {
    const b1 = clone();
    unit(b1, 'F-P1').step_ids = unit(b1, 'F-P1').step_ids.slice(1);
    expect(rules(b1)).toContain(3);
    const b2 = clone();
    unit(b2, 'F-P1').question_ids = [...unit(b2, 'F-P1').question_ids, 'F-P1-Q9'];
    expect(rules(b2)).toContain(3);
    const b3 = clone();
    unit(b3, 'F-P1').rebuild_ids = [];
    expect(rules(b3)).toContain(3);
  });
  it('order 중복 없음', () => {
    const b = clone();
    st(b, 'F-P1-S02').order = st(b, 'F-P1-S01').order;
    expect(rules(b)).toContain(1);
  });
  it('written 은 내용 1개 이상, planned 는 내용 0건', () => {
    const p = planned(base)[0];
    const w = written(base)[0];
    const b1 = clone();
    D(b1).steps.push({ ...st(b1, 'F-P1-S01'), step_id: `${p}-S01`, unit_id: p, order: 999 });
    unit(b1, p).step_ids = [`${p}-S01`];
    expect(rules(b1)).toContain(3);
    const b2 = clone();
    const ids = unit(b2, w).step_ids;
    D(b2).steps = D(b2).steps.filter((s) => !ids.includes(s.step_id));
    D(b2).hints = D(b2).hints.filter((h) => !ids.includes(h.target_id));
    D(b2).questions = D(b2).questions.filter((x) => x.unit_id !== w);
    D(b2).hints = D(b2).hints.filter((h) => !String(h.target_id).startsWith(`${w}-Q`));
    unit(b2, w).step_ids = [];
    unit(b2, w).question_ids = [];
    expect(rules(b2)).toContain(3);
    const b3 = clone();
    unit(b3, w).goal_ko = null;
    expect(rules(b3)).toContain(3);
    const b4 = clone();
    unit(b4, w).status = 'soon';
    expect(rules(b4)).toContain(1);
  });
  it('힌트 대상이 있어야', () => {
    const b = clone();
    D(b).hints.push({ hint_id: 'F-P1-S99-H1', target_id: 'F-P1-S99', level: 1, text_ko: '힌트' });
    expect(rules(b)).toContain(6);
  });
  it('진단 question_ids 가 모두 있어야, recommend_units_if_wrong 은 실제 단위', () => {
    const b1 = clone();
    D(b1).lecture.diagnostic.question_ids.push('F-D9');
    expect(rules(b1)).toContain(4);
    const b2 = clone();
    q(b2, 'F-D2').recommend_units_if_wrong = ['F-P3', 'F-P10'];
    expect(rules(b2)).toContain(4);
    const b3 = clone();
    q(b3, 'F-D3').auto_grade = { type: 'keywords', keywords: ['8'] };
    expect(rules(b3)).toContain(4);
    const b4 = clone();
    q(b4, 'F-D4').hint_ids = ['F-D4-H1'];
    D(b4).hints.push({ hint_id: 'F-D4-H1', target_id: 'F-D4', level: 1, text_ko: '힌트' });
    expect(rules(b4)).toContain(4);
  });
  it('진단 약속(추천만·잠금 없음·자동 건너뛰기 없음·힌트 없음)이 다르면 실패', () => {
    for (const [k, v] of Object.entries(BASICS.diagnosticPromises)) {
      const b = clone();
      D(b).lecture.diagnostic[k] = !v;
      expect(rules(b), k).toContain(4);
    }
  });
  it('결과 문구 틀: score_template_ko 에 {correct}, recommend_template_ko 에 {units}', () => {
    const b1 = clone();
    D(b1).lecture.diagnostic.result_ko.score_template_ko = '맞힌 문제';
    expect(rules(b1)).toContain(1);
    const b2 = clone();
    delete D(b2).lecture.diagnostic.result_ko.not_ready_ko;
    expect(rules(b2)).toContain(1);
  });
  it('mastery_rule 과 review 값 검사(복습 기능이 생기면 쓸 자리)', () => {
    const b1 = clone();
    D(b1).mastery_rule.review.schedule_days = [14, 3];
    expect(rules(b1)).toContain(11);
    const b2 = clone();
    D(b2).mastery_rule.question_score_ratio = 1.5;
    expect(rules(b2)).toContain(11);
    const b3 = clone();
    D(b3).mastery_rule.steps_complete_excludes_kinds = ['nope'];
    expect(rules(b3)).toContain(11);
  });
  it('영상 없음, 줄별 풀이, 힌트 H1~H4, 긴 줄표, error_match 는 에러 종류 필요', () => {
    const b1 = clone();
    st(b1, 'F-P1-S02').video_segments = [{ start_s: 0, end_s: 10 }];
    expect(rules(b1)).toEqual(expect.arrayContaining([1, 5]));
    const b2 = clone();
    st(b2, 'F-P1-S02').code_line_notes_ko = [];
    expect(rules(b2)).toContain(9);
    const b3 = clone();
    D(b3).hints = D(b3).hints.filter((h) => h.hint_id !== 'F-P1-S02-H4');
    st(b3, 'F-P1-S02').hint_ids = st(b3, 'F-P1-S02').hint_ids.filter((x) => x !== 'F-P1-S02-H4');
    expect(rules(b3)).toContain(10);
    const b4 = clone();
    st(b4, 'F-P1-S02').meaning_ko = `실행했습니다${String.fromCharCode(0x2014)}끝`;
    expect(rules(b4)).toContain(7);
    const em = D(clone()).steps.find((s) => s.expected_check.type === 'error_match');
    const b5 = clone();
    st(b5, em.step_id).expected_check = { type: 'error_match' };
    expect(rules(b5)).toContain(1);
  });
  it('1편 선행 기초 단위(prereq_units)는 기초 단위 목록에 있어야', () => {
    const lectures = readBundle(resolvePaths()).lectureFiles;
    expect(checkPrereqUnits(lectures, D(base))).toEqual([]);
    const fake = [{ path: 'L99.json', data: { lecture: { lecture_id: 'L99', prereq_units: ['F-P1', 'F-X9'] } } }];
    expect(checkPrereqUnits(fake, D(base)).map((e) => e.rule)).toEqual([12]);
  });
});

describe('화면 데이터', () => {
  const site = buildBasics(base);
  it('단위는 단위 지도 순서, 여는 단위 = status written, 묶음은 id 머리말', () => {
    expect(site.units.map((u) => u.unit_id)).toEqual(BASICS.unitMap);
    expect(site.readyIds).toEqual(written(base));
    expect(site.groups.map((g) => g.unit_ids.length).reduce((a, b) => a + b, 0)).toBe(BASICS.unitMap.length);
    expect(Object.keys(site.steps).sort()).toEqual([...written(base)].sort());
    for (const p of planned(base)) expect(site.units.find((u) => u.unit_id === p).ready).toBe(false);
  });
  it('진단: 문구는 정본 result_ko·purpose_ko 그대로, 공개 칸에는 정답이 없다', () => {
    const dx = D(base).lecture.diagnostic;
    expect(site.diagnostic.result_ko).toEqual({
      score_template_ko: dx.result_ko.score_template_ko,
      recommend_template_ko: dx.result_ko.recommend_template_ko,
      always_add_ko: dx.result_ko.always_add_ko,
      not_ready_ko: dx.result_ko.not_ready_ko,
    });
    expect(site.diagnostic.purpose_ko).toBe(dx.purpose_ko);
    expect(site.diagnostic.questions.map((x) => x.question_id)).toEqual(dx.question_ids);
    for (const x of site.diagnostic.questions) {
      expect(x).not.toHaveProperty('answer_index');
      expect(x).not.toHaveProperty('answer_ko');
      expect(x).not.toHaveProperty('auto_grade');
    }
    expect(site.diagnostic.questions.filter((x) => x.dont_know_allowed).map((x) => x.question_id)).toEqual(
      D(base).questions.filter((x) => x.dont_know_allowed).map((x) => x.question_id),
    );
  });
  it('단위 문제 공개 칸에는 풀이가 없고, 풀이는 answers 에만', () => {
    for (const qs of Object.values(site.questions)) for (const x of qs) {
      expect(x).not.toHaveProperty('answer_ko');
      expect(x).not.toHaveProperty('auto_grade');
      expect(x).not.toHaveProperty('rubric');
    }
    expect(site.answers['F-P1-Q2'].answer_ko).toBe(q(base, 'F-P1-Q2').answer_ko);
    expect(site.answers['F-D1'].answer_index).toBe(q(base, 'F-D1').answer_index);
  });
  it('단계: unit_id 로 묶고 order 로 정렬, 단위 안 번호, 주소 S01, 영상 없음, 확인 문제는 after_step 단계에', () => {
    for (const uid of site.readyIds) {
      const raw = D(base).steps.filter((s) => s.unit_id === uid).sort((a, b) => a.order - b.order);
      expect(site.steps[uid].map((s) => s.step_id)).toEqual(raw.map((s) => s.step_id));
      expect(site.steps[uid].map((s) => s.order)).toEqual(raw.map((_, i) => i + 1));
      expect(site.steps[uid].map((s) => s.global_order)).toEqual(raw.map((s) => s.order));
      for (const s of site.steps[uid]) {
        expect(s.slug).toBe(s.step_id.split('-').pop());
        expect(s.video_segments).toEqual([]);
        expect(s.question_ids).toEqual(D(base).questions.filter((x) => x.after_step === s.step_id).map((x) => x.question_id));
      }
    }
  });
  it('read_first_ko·expected_output_example·figure 는 단계 데이터에 그대로', () => {
    const all = Object.values(site.steps).flat();
    const rf = all.find((s) => s.read_first_ko);
    expect(rf.read_first_ko).toBe(st(base, rf.step_id).read_first_ko);
    const ex = all.find((s) => s.expected_output_example);
    expect(ex.expected_output_example).toBe(st(base, ex.step_id).expected_output_example);
    const fig = all.find((s) => s.expected_check.figure);
    expect(fig.expected_check).toEqual(st(base, fig.step_id).expected_check);
    expect(fig.figure_label).toBe(BASICS.figureLabels[fig.expected_check.figure] ?? null);
  });
  it('고치는 단계(edits): 대상 셀 주소도 기초 주소, 기준 줄이 있는 바꾸기도 고친 뒤 셀을 만든다', () => {
    const all = Object.values(site.steps).flat().filter((s) => s.edit_view);
    expect(all.length).toBeGreaterThan(0);
    for (const s of all) {
      for (const t of s.edit_view.targets) {
        expect(t.slug).toBe(t.step_id.split('-').pop());
        expect(t.full.ok).toBe(true);
      }
    }
    const rep = all.find((s) => s.edit_view.blocks.some((b) => b.action === 'replace' && b.anchor_line));
    const anchor = rep.edit_view.blocks.find((b) => b.action === 'replace').anchor_line;
    expect(rep.edit_view.targets[0].full.lines.map((l) => l.text.trim())).not.toContain(anchor.trim());
  });
  it('익힘 판정 입력: 제외 종류(optional) 단계는 빼고, 문제는 max_points·must_pass, 스스로 해 보기는 통과 한도', () => {
    const ex = new Set(D(base).mastery_rule.steps_complete_excludes_kinds);
    for (const u of site.units.filter((x) => x.ready)) {
      expect(u.mastery.step_ids).toEqual(site.steps[u.unit_id].filter((s) => !ex.has(s.kind)).map((s) => s.step_id));
      expect(u.mastery.activity_step_ids).toEqual(site.steps[u.unit_id].map((s) => s.step_id));
      expect(u.mastery.questions.map((x) => x.question_id)).toEqual(unit(base, u.unit_id).question_ids);
      expect(u.mastery.rebuilds).toEqual(D(base).rebuild_tasks.filter((r) => r.unit_id === u.unit_id).map((r) => ({ rebuild_id: r.rebuild_id, max_hint_level_for_pass: r.max_hint_level_for_pass })));
    }
    expect(site.rule).toEqual({ steps_complete_ratio: D(base).mastery_rule.steps_complete_ratio, question_score_ratio: D(base).mastery_rule.question_score_ratio, must_pass_all: D(base).mastery_rule.must_pass_all });
  });
  it('스스로 해 보기: 과제 글·확인 기준·figure·힌트 단계, 힌트 본문은 hints JSON 에만', () => {
    for (const r of D(base).rebuild_tasks) {
      const pub = site.rebuild[r.unit_id].find((x) => x.rebuild_id === r.rebuild_id);
      expect(pub).toMatchObject({ task_ko: r.task_ko, test_ko: r.check.test_ko, figure: r.check.figure ?? null, max_hint_level_for_pass: r.max_hint_level_for_pass });
      expect(pub.hint_levels).toEqual(D(base).hints.filter((h) => h.target_id === r.rebuild_id).map((h) => h.level).sort());
      expect(site.hints[r.rebuild_id]?.length ?? 0).toBe(pub.hint_levels.length);
    }
    expect(JSON.stringify(site.rebuild)).not.toContain(D(base).hints.find((h) => h.target_id === 'F-P1-R1').text_ko);
  });
  it('module_pass_ko 는 화면 데이터에 넣지 않는다', () => {
    expect(JSON.stringify(site)).not.toContain('module_pass_ko');
    for (const line of D(base).mastery_rule.module_pass_ko ?? []) expect(JSON.stringify(site)).not.toContain(line);
  });
});

// ---- 교사 정본 F.json (v1.1) ----
describe('교사 정본 F.json', () => {
  const rb2 = readBasicsBundle(resolveBasicsPath({}, REPO_ROOT), REPO_ROOT);
  const d = rb2.file?.data;
  it('검사 오류 0, 1편 선행 기초 단위가 모두 있음', () => {
    expect(validateBasics(rb2).errors).toEqual([]);
    expect(checkPrereqUnits(readBundle(resolvePaths()).lectureFiles, d)).toEqual([]);
  });
  it('15단위(단위 지도 순서), written 은 내용 있음·planned 는 0건, 진단 5문제', () => {
    expect(d.lecture.units.map((u) => u.unit_id)).toEqual(BASICS.unitMap);
    for (const u of d.lecture.units) {
      const n = d.steps.filter((s) => s.unit_id === u.unit_id).length;
      if (u.status === 'written') expect(n, u.unit_id).toBeGreaterThan(0);
      else expect(n + d.questions.filter((x) => x.unit_id === u.unit_id).length + d.rebuild_tasks.filter((x) => x.unit_id === u.unit_id).length, u.unit_id).toBe(0);
    }
    expect(d.lecture.diagnostic.question_ids).toHaveLength(5);
  });
  it('화면에 여는 단위 = status written 전부', () => {
    expect(buildBasics(rb2).readyIds).toEqual(d.lecture.units.filter((u) => u.status === 'written').map((u) => u.unit_id));
  });
});
