import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_DIR, readBundle, resolvePaths } from '../../src/lib/content/load.mjs';
import { codeLines, hasPythonComment, validateBundle } from '../../src/lib/content/validate.mjs';
import { buildSite, reconstructCell, resolveRunPlan, splitCells, splitEdits } from '../../src/lib/content/build.mjs';

// 교사 정본 사본(tests/fixtures/pedagogy, P7 에 클로드 버전 L01.json 에서 다시 뽑음)으로 검사한다
const base = readBundle(
  resolvePaths({
    Z2H_CONTENT_DIR: path.join(APP_DIR, 'tests/fixtures/pedagogy/content'),
    Z2H_EXTRAS_DIR: path.join(APP_DIR, 'tests/fixtures/extras'),
  }),
);
const clone = () => structuredClone(base);
const D = (b) => b.lectureFiles[0].data;
const step = (b, id) => D(b).steps.find((s) => s.step_id === id);
const q = (b, id) => D(b).questions.find((x) => x.question_id === id);
const rb = (b, id) => D(b).rebuild_tasks.find((x) => x.rebuild_id === id);
const rules = (b) => validateBundle(b).errors.map((e) => e.rule);
// 시험에 쓸 단계·문항은 칸 모양으로 고른다(id 를 외우지 않음)
const S0 = D(base).steps;
const LONG = S0.find((s) => s.long_step && !(s.edits ?? []).length).step_id;
const PLAIN = S0.find((s) => s.kind === 'code' && !s.long_step && !(s.edits ?? []).length && !s.prepared_code).step_id;
const EDIT = S0.find((s) => (s.edits ?? []).length && (s.rerun_first ?? []).length).step_id;
const ZERO = S0.find((s) => s.kind === 'code' && s.new_code_lines === 0).step_id;
const CHOICE = D(base).questions.find((x) => x.type === 'choice').question_id;
const EXPLAIN = D(base).questions.find((x) => x.type === 'explain').question_id;
const R1 = D(base).rebuild_tasks[0].rebuild_id;

describe('교사 정본 사본은 통과', () => {
  it('오류 0, 단계·문항·재구성·힌트 수는 콘텐츠에서 센다', () => {
    const r = validateBundle(base);
    expect(r.errors).toEqual([]);
    expect(r.stats).toMatchObject({ steps: D(base).steps.length, questions: D(base).questions.length, rebuild: D(base).rebuild_tasks.length, hints: D(base).hints.length });
  });
  it('줄 수 세기·주석 찾기', () => {
    expect(codeLines('a\nb\n')).toBe(2);
    expect(hasPythonComment('x = 1  # 설명')).toBe(true);
    expect(hasPythonComment('print("#1번")')).toBe(false);
  });
});

describe('검사 규칙마다 실패 예', () => {
  it('규칙 1: step_id 모양, order 겹침, 모르는 칸은 경고만, output_match 는 expected 가 있어야', () => {
    const b1 = clone();
    step(b1, PLAIN).step_id = 'L01-S4';
    expect(rules(b1)).toContain(1);
    const b2 = clone();
    D(b2).steps[1].order = D(b2).steps[0].order;
    expect(rules(b2)).toContain(1);
    const b3 = clone();
    step(b3, PLAIN).new_field_x = 1;
    expect(rules(b3)).toEqual([]);
    expect(validateBundle(b3).warnings.some((w) => /모르는 칸 "new_field_x"/.test(w.message))).toBe(true);
    const b4 = clone();
    D(b4).steps.find((s) => s.expected_check.type === 'output_match').expected_check = { type: 'output_match' };
    expect(rules(b4)).toContain(1);
  });
  it('규칙 2: code·prepared_code·확인 셀(check_code) 줄 수와 줄별 풀이 개수가 다르면 실패', () => {
    const b = clone();
    step(b, PLAIN).code_line_notes_ko.pop();
    expect(rules(b)).toContain(2);
    const b2 = clone();
    D(b2).steps.find((s) => s.prepared_code).prepared_code_line_notes_ko.pop();
    expect(rules(b2)).toContain(2);
    const b3 = clone();
    rb(b3, R1).check_code_line_notes_ko.pop();
    expect(rules(b3)).toContain(2);
  });
  it('규칙 3: long_step ↔ new_code_lines, code = new + moved + 바꾸는 줄, 셀 줄 수 합', () => {
    const b1 = clone();
    step(b1, LONG).long_step = false;
    expect(rules(b1)).toContain(3);
    const b2 = clone();
    const moved = D(b2).steps.find((s) => s.moved_code_lines > 0);
    moved.moved_code_lines = 0;
    expect(rules(b2)).toContain(3);
    const b3 = clone();
    step(b3, PLAIN).new_code_lines = 11;
    expect(rules(b3)).toContain(3);
    const b4 = clone();
    step(b4, PLAIN).cell_line_counts = [codeLines(step(b4, PLAIN).code) + 1];
    expect(rules(b4)).toContain(3);
  });
  it('규칙 4: choice 보기 1개, answer_index 범위 밖, 모르겠어요 보기 번호가 정답', () => {
    const b1 = clone();
    q(b1, CHOICE).choices = ['하나'];
    expect(rules(b1)).toContain(4);
    const b2 = clone();
    q(b2, CHOICE).answer_index = 9;
    expect(rules(b2)).toContain(4);
    const b3 = clone();
    q(b3, CHOICE).dont_know_index = q(b3, CHOICE).answer_index;
    expect(rules(b3)).toContain(4);
  });
  it('규칙 5: end_s 빠짐·null, start ≥ end, 영상 길이 초과, 정본과 다름, 빈 구간(영상 없는 단계 목록 밖)', () => {
    const b1 = clone();
    step(b1, PLAIN).video_segments = [{ start_s: 1149, end_s: null }];
    expect(rules(b1)).toContain(5);
    const b2 = clone();
    step(b2, PLAIN).video_segments = [{ start_s: 1149 }];
    b2.segments.steps[PLAIN].video_segments = [{ start_s: 1149 }];
    expect(rules(b2)).toContain(5);
    const b3 = clone();
    step(b3, PLAIN).video_segments = [{ start_s: 1930, end_s: 1149 }];
    expect(rules(b3)).toContain(5);
    const b4 = clone();
    step(b4, PLAIN).video_segments = [{ start_s: 1149, end_s: 9999 }];
    b4.segments.steps[PLAIN].video_segments = [{ start_s: 1149, end_s: 9999 }];
    expect(rules(b4)).toContain(5);
    const b5 = clone();
    step(b5, PLAIN).video_segments = [{ start_s: 1, end_s: 2 }];
    expect(rules(b5)).toContain(5); // video-segments.json 과 다름
    const b6 = clone();
    step(b6, PLAIN).video_segments = [];
    b6.segments.steps[PLAIN].video_segments = [];
    expect(rules(b6)).toContain(5); // 영상 없는 단계 목록에 없음
    const b7 = clone();
    delete b7.segments.steps[PLAIN];
    expect(rules(b7)).toContain(5);
  });
  it('규칙 6: answer_ko·rubric 없음, id 중복, 없는 after_step·rerun_first·edits 대상·힌트 대상·셀 위치, 기준 줄 못 찾음, 과제 글·통과 기준 없음', () => {
    const b1 = clone();
    delete q(b1, CHOICE).answer_ko;
    expect(rules(b1)).toContain(6);
    const b2 = clone();
    q(b2, CHOICE).rubric = [];
    expect(rules(b2)).toContain(6);
    const b3 = clone();
    D(b3).questions.push(structuredClone(q(b3, CHOICE)));
    expect(rules(b3)).toContain(6);
    const b4 = clone();
    q(b4, CHOICE).after_step = 'L01-S99';
    expect(rules(b4)).toContain(6);
    const b5 = clone();
    step(b5, EDIT).rerun_first = ['L01-S98'];
    expect(rules(b5)).toContain(6);
    const b6 = clone();
    step(b6, EDIT).edits[0].target_step = 'L01-S97';
    expect(rules(b6)).toContain(6);
    const b7 = clone();
    D(b7).hints[0].target_id = 'L01-S96';
    expect(rules(b7)).toContain(6);
    const b8 = clone();
    step(b8, PLAIN).place_before = 'L01-S95';
    expect(rules(b8)).toContain(6);
    const b9 = clone();
    const withAnchor = D(b9).steps.find((s) => (s.edits ?? []).some((e) => e.anchor_line));
    withAnchor.edits.find((e) => e.anchor_line).anchor_line = '이런 줄은 없다';
    expect(rules(b9)).toContain(6);
    const b10 = clone();
    rb(b10, R1).pass_ko = '';
    expect(rules(b10)).toContain(6);
    const b11 = clone();
    rb(b11, R1).task_ko = null;
    expect(rules(b11)).toContain(6);
  });
  it('규칙 7: 긴 줄표(U+2014)가 있으면 실패', () => {
    const b = clone();
    step(b, PLAIN).meaning_ko += ' \u2014 예';
    expect(rules(b)).toContain(7);
  });
  it('규칙 8: build-nanogpt 출처는 실패, LICENSE 없는 원본도 실패', () => {
    const b1 = clone();
    step(b1, PLAIN).code_origin = { repo: 'karpathy/build-nanogpt' };
    expect(rules(b1)).toContain(8);
    const b2 = clone();
    step(b2, PLAIN).code_origin = { repo: 'karpathy/micrograd' };
    b2.licenseFiles = ['Pretendard-OFL.txt'];
    expect(rules(b2)).toContain(8);
  });
  it('규칙 9: 코드 단계 H3 없음, 설명 문제 H4 없음, 힌트가 있는 재구성 과제 H4 없음', () => {
    const b1 = clone();
    D(b1).hints = D(b1).hints.filter((h) => h.hint_id !== `${PLAIN}-H3` && h.hint_id !== `${PLAIN}-H4`);
    step(b1, PLAIN).hint_ids = [`${PLAIN}-H1`, `${PLAIN}-H2`];
    expect(rules(b1)).toContain(9);
    const b2 = clone();
    D(b2).hints = D(b2).hints.filter((h) => h.hint_id !== `${EXPLAIN}-H4`);
    q(b2, EXPLAIN).hint_ids = q(b2, EXPLAIN).hint_ids.filter((x) => x !== `${EXPLAIN}-H4`);
    expect(rules(b2)).toContain(9);
    const b3 = clone();
    D(b3).hints = D(b3).hints.filter((h) => h.hint_id !== `${R1}-H4`);
    expect(rules(b3)).toContain(9);
  });
  it('규칙 10: new_code_lines 0 단계는 long_step false (정본은 통과, true면 실패)', () => {
    expect(step(base, ZERO).new_code_lines).toBe(0);
    const b = clone();
    step(b, ZERO).long_step = true;
    expect(rules(b)).toContain(10);
  });
});

describe('바뀐 줄만 보여 주기 (edits)', () => {
  const steps = D(base).steps;
  it('code 앞쪽 줄이 edits 순서대로 넣을 줄, 나머지는 새 셀', () => {
    const s = step(base, EDIT);
    const { blocks, rest } = splitEdits(s);
    const lines = s.code.replace(/\n+$/, '').split('\n');
    let at = 0;
    for (const [i, e] of s.edits.entries()) {
      expect(blocks[i].lines).toEqual(lines.slice(at, at + e.line_count));
      at += e.line_count;
    }
    expect(rest.lines).toEqual(lines.slice(at));
  });
  it('고친 뒤 셀 전체: 앞 단계 edits 를 차례로 적용하고 이번 줄만 새 줄로 표시, 바꾸기는 기준 줄을 없앤다', () => {
    for (const s of steps.filter((x) => (x.edits ?? []).length)) {
      for (const t of new Set(s.edits.map((e) => e.target_step))) {
        const rc = reconstructCell(steps, s, t);
        expect(rc.ok, `${s.step_id} → ${t}`).toBe(true);
        const mine = s.edits.filter((e) => e.target_step === t).reduce((a, e) => a + e.line_count, 0);
        expect(rc.lines.filter((l) => l.isNew), s.step_id).toHaveLength(mine);
        for (const e of s.edits.filter((x) => x.target_step === t && x.action === 'replace'))
          expect(rc.lines.map((l) => l.text.trim()), s.step_id).not.toContain(e.anchor_line.trim());
      }
    }
  });
});

describe('셀 나누기·실행 순서·셀 위치', () => {
  it('새 셀은 cell_line_counts 대로 나눈다(칸이 없으면 셀 하나)', () => {
    const fake = { step_id: 'L01-S90', code: 'a\nb\nc\nd\ne', code_line_notes_ko: ['1', '2', '3', '4', '5'], cell_line_counts: [3, 2], edits: [] };
    expect(splitCells(fake)).toEqual([
      { lines: ['a', 'b', 'c'], notes: ['1', '2', '3'] },
      { lines: ['d', 'e'], notes: ['4', '5'] },
    ]);
    expect(splitCells({ ...fake, cell_line_counts: undefined })).toEqual([{ lines: ['a', 'b', 'c', 'd', 'e'], notes: ['1', '2', '3', '4', '5'] }]);
    expect(splitCells({ ...fake, code: 'x\na', code_line_notes_ko: ['넣는 줄', '새 줄'], cell_line_counts: [1], edits: [{ line_count: 1 }] })).toEqual([{ lines: ['a'], notes: ['새 줄'] }]);
  });
  it('run_plan 은 화면 줄로 풀린다(앞 단계 셀은 주소와 제목)', () => {
    const steps = [{ step_id: 'F-P1-S2', title_ko: '셀 B' }];
    expect(resolveRunPlan(['restart', 'new:1', 'cell:F-P1-S2:1', 'run_all'], steps, (id) => id.split('-').pop())).toEqual([
      { kind: 'restart' },
      { kind: 'new', n: 1 },
      { kind: 'cell', n: 1, step_id: 'F-P1-S2', slug: 'S2', title_ko: '셀 B' },
      { kind: 'run_all' },
    ]);
    expect(resolveRunPlan(null, steps, String)).toBeNull();
  });
});

describe('빌드 결과', () => {
  it('공개 단계·문제·재구성에는 풀이·rubric·힌트 본문·정답 코드가 없고 answers·hints JSON 에만 있다. 문제는 after_step 단계에 붙는다', () => {
    const site = buildSite(base);
    const d = site.details.L01;
    const pub = JSON.stringify({ steps: d.steps, questions: d.questions, rebuild: d.rebuild });
    expect(pub).not.toContain('answer_ko');
    expect(pub).not.toContain('"rubric"');
    expect(pub).not.toContain('solution_code');
    expect(pub).not.toContain(D(base).hints.find((h) => h.hint_id === `${CHOICE}-H4`).text_ko);
    expect(d.answers[CHOICE].answer_index).toBe(q(base, CHOICE).answer_index);
    for (const s of d.steps) expect(s.question_ids).toEqual(D(base).questions.filter((x) => x.after_step === s.step_id).map((x) => x.question_id));
    expect(d.hints[PLAIN].find((h) => h.level === 4).code).toBe(step(base, PLAIN).code); // show_solution
    expect(d.hints[CHOICE].find((h) => h.level === 4).answer_ko).toBe(q(base, CHOICE).answer_ko);
    expect(d.hints[R1].find((h) => h.level === 4).code).toBe(rb(base, R1).solution_code); // 과제 H4 = 정답 코드
    expect(d.hints[R1].find((h) => h.level === 4).source_ko).toBe(rb(base, R1).solution_source_ko);
    expect(d.steps).toHaveLength(D(base).steps.length);
    expect(d.steps.find((s) => s.step_id === EDIT).rerun_first.map((x) => x.step_id)).toEqual(step(base, EDIT).rerun_first);
    expect(d.lecture.content_version).toMatch(/^auto-[0-9a-f]{12}$/);
  });
  it('재구성 과제 화면 칸: 과제 글, 확인 셀과 줄별 풀이, 통과 기준, 확인 셀 출력, 힌트 단계', () => {
    const d = buildSite(base).details.L01;
    for (const t of D(base).rebuild_tasks) {
      expect(d.rebuild.find((x) => x.rebuild_id === t.rebuild_id)).toMatchObject({
        task_ko: t.task_ko,
        check_code: t.check_code,
        check_code_line_notes_ko: t.check_code_line_notes_ko,
        pass_ko: t.pass_ko,
        expected: t.check.expected,
        max_hint_level_for_pass: t.max_hint_level_for_pass,
        hint_levels: D(base).hints.filter((h) => h.target_id === t.rebuild_id).map((h) => h.level).sort(),
      });
    }
  });
  it('검사 도구 칸(expr)은 단계 데이터에 없고, 비교에 쓰는 칸만 남는다', () => {
    const d = buildSite(base).details.L01;
    for (const s of d.steps) expect(Object.keys(s.expected_check).every((k) => ['type', 'expected', 'match', 'min', 'max', 'range_of'].includes(k)), s.step_id).toBe(true);
  });
  it('H2 힌트가 글로 가리키는 기초 단위는 points_to 로 (1편 정본에는 points_to_id 칸이 없다)', () => {
    const d = buildSite(base).details.L01;
    const h2 = D(base).hints.find((h) => h.level === 2 && /F-[PM]\d+/.test(h.text_ko));
    expect(d.hints[h2.target_id].find((h) => h.level === 2).points_to).toEqual({ unit_id: h2.text_ko.match(/F-[PM]\d+/)[0], step_id: null, card_line: null });
  });
});

describe('화면 데이터 화이트리스트: 묶음 안에 모르는 칸이 와도 페이지 데이터에 싣지 않는다', () => {
  it('lecture.objectives, 단계 edits, 힌트 unlock 의 모르는 칸', () => {
    const b = clone();
    D(b).lecture.objectives[0].secret_x = 'zz-objective';
    step(b, EDIT).edits[0].secret_x = 'zz-edit';
    D(b).hints.find((h) => h.target_id === PLAIN && h.level === 2).unlock.secret_x = 'zz-unlock';
    const d = buildSite(b).details.L01;
    const page = JSON.stringify({ lecture: d.lecture, steps: d.steps, questions: d.questions, rebuild: d.rebuild });
    expect(page).not.toContain('secret_x');
    expect(d.lecture.objectives[0]).toEqual({ objective_id: D(base).lecture.objectives[0].objective_id, text_ko: D(base).lecture.objectives[0].text_ko });
  });
});
