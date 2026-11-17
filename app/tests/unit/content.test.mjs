import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_DIR, readBundle, resolvePaths } from '../../src/lib/content/load.mjs';
import { codeLines, hasPythonComment, validateBundle } from '../../src/lib/content/validate.mjs';
import { buildSite, reconstructCell, splitEdits } from '../../src/lib/content/build.mjs';

// 교사 정본 사본(git show origin/m0-setup:inputs/pedagogy/content/L01.json)으로 검사한다
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
const rules = (b) => validateBundle(b).errors.map((e) => e.rule);

describe('교사 정본 사본은 통과', () => {
  it('오류 0, 단계 수는 콘텐츠에서 센다', () => {
    const r = validateBundle(base);
    expect(r.errors).toEqual([]);
    expect(r.stats.steps).toBe(D(base).steps.length);
    expect(r.warnings.some((w) => /L01-S16: code 안에 # 주석/.test(w.message))).toBe(true); // 주석은 경고만
  });
  it('줄 수 세기·주석 찾기', () => {
    expect(codeLines('a\nb\n')).toBe(2);
    expect(hasPythonComment('x = 1  # 설명')).toBe(true);
    expect(hasPythonComment('print("#1번")')).toBe(false);
  });
});

describe('검사 규칙마다 실패 예', () => {
  it('규칙 1: step_id 모양, order 겹침, 모르는 칸은 경고만', () => {
    const b1 = clone();
    step(b1, 'L01-S04').step_id = 'L01-S4';
    expect(rules(b1)).toContain(1);
    const b2 = clone();
    step(b2, 'L01-S05').order = 4;
    expect(rules(b2)).toContain(1);
    const b3 = clone();
    step(b3, 'L01-S04').new_field_x = 1;
    expect(rules(b3)).toEqual([]);
    expect(validateBundle(b3).warnings.some((w) => /모르는 칸 "new_field_x"/.test(w.message))).toBe(true);
  });
  it('규칙 2: code 줄 수와 줄별 풀이 개수가 다르면 실패 (prepared_code 도)', () => {
    const b = clone();
    step(b, 'L01-S04').code_line_notes_ko.pop();
    expect(rules(b)).toContain(2);
    const b2 = clone();
    const prep = D(b2).steps.find((s) => s.prepared_code);
    prep.prepared_code_line_notes_ko.pop();
    expect(rules(b2)).toContain(2);
  });
  it('규칙 3: long_step ↔ new_code_lines, code = new + moved + 바꾸는 줄', () => {
    const b1 = clone();
    step(b1, 'L01-S04').long_step = false; // new 9
    expect(rules(b1)).toContain(3);
    const b2 = clone();
    step(b2, 'L01-S11b').moved_code_lines = 0; // code 15 = new 7 + moved 8
    expect(rules(b2)).toContain(3);
    const b3 = clone();
    step(b3, 'L01-S04').new_code_lines = 11;
    expect(rules(b3)).toContain(3);
  });
  it('규칙 4: choice 보기 1개, answer_index 범위 밖', () => {
    const b1 = clone();
    q(b1, 'L01-Q04').choices = ['하나'];
    expect(rules(b1)).toContain(4);
    const b2 = clone();
    q(b2, 'L01-Q04').answer_index = 9;
    expect(rules(b2)).toContain(4);
  });
  it('규칙 5: end_s 빠짐·null, start ≥ end, 영상 길이 초과, 정본과 다름, 빈 구간(영상 없는 단계 목록 밖)', () => {
    const b1 = clone();
    step(b1, 'L01-S04').video_segments = [{ start_s: 1149, end_s: null }];
    expect(rules(b1)).toContain(5);
    const b2 = clone();
    step(b2, 'L01-S04').video_segments = [{ start_s: 1149 }];
    b2.segments.steps['L01-S04'].video_segments = [{ start_s: 1149 }];
    expect(rules(b2)).toContain(5);
    const b3 = clone();
    step(b3, 'L01-S04').video_segments = [{ start_s: 1930, end_s: 1149 }];
    expect(rules(b3)).toContain(5);
    const b4 = clone();
    step(b4, 'L01-S04').video_segments = [{ start_s: 1149, end_s: 9999 }];
    b4.segments.steps['L01-S04'].video_segments = [{ start_s: 1149, end_s: 9999 }];
    expect(rules(b4)).toContain(5);
    const b5 = clone();
    step(b5, 'L01-S04').video_segments = [{ start_s: 1, end_s: 2 }];
    expect(rules(b5)).toContain(5); // video-segments.json 과 다름
    const b6 = clone();
    step(b6, 'L01-S04').video_segments = [];
    b6.segments.steps['L01-S04'].video_segments = [];
    expect(rules(b6)).toContain(5); // L01-S04 는 영상 없는 단계 목록에 없음
    const b7 = clone();
    delete b7.segments.steps['L01-S04'];
    expect(rules(b7)).toContain(5);
  });
  it('규칙 6: answer_ko·rubric 없음, id 중복, 없는 after_step·rerun_first·edits 대상·힌트 대상', () => {
    const b1 = clone();
    delete q(b1, 'L01-Q02').answer_ko;
    expect(rules(b1)).toContain(6);
    const b2 = clone();
    q(b2, 'L01-Q02').rubric = [];
    expect(rules(b2)).toContain(6);
    const b3 = clone();
    D(b3).questions.push(structuredClone(q(b3, 'L01-Q02')));
    expect(rules(b3)).toContain(6);
    const b4 = clone();
    q(b4, 'L01-Q02').after_step = 'L01-S99';
    expect(rules(b4)).toContain(6);
    const b5 = clone();
    step(b5, 'L01-S09b').rerun_first = ['L01-S98'];
    expect(rules(b5)).toContain(6);
    const b6 = clone();
    step(b6, 'L01-S05').edits[0].target_step = 'L01-S97';
    expect(rules(b6)).toContain(6);
    const b7 = clone();
    D(b7).hints[0].target_id = 'L01-S96';
    expect(rules(b7)).toContain(6);
  });
  it('규칙 7: 긴 줄표(U+2014)가 있으면 실패', () => {
    const b = clone();
    step(b, 'L01-S04').meaning_ko += ' \u2014 예';
    expect(rules(b)).toContain(7);
  });
  it('규칙 8: build-nanogpt 출처는 실패, LICENSE 없는 원본도 실패', () => {
    const b1 = clone();
    step(b1, 'L01-S04').code_origin = { repo: 'karpathy/build-nanogpt' };
    expect(rules(b1)).toContain(8);
    const b2 = clone();
    step(b2, 'L01-S04').code_origin = { repo: 'karpathy/micrograd' };
    b2.licenseFiles = ['Pretendard-OFL.txt'];
    expect(rules(b2)).toContain(8);
  });
  it('규칙 9: 코드 단계 H3 없음, 설명 문제 H4 없음, 예측 문제에 힌트', () => {
    const b1 = clone();
    D(b1).hints = D(b1).hints.filter((h) => h.hint_id !== 'L01-S04-H3' && h.hint_id !== 'L01-S04-H4');
    step(b1, 'L01-S04').hint_ids = ['L01-S04-H1', 'L01-S04-H2'];
    expect(rules(b1)).toContain(9);
    const b2 = clone();
    D(b2).hints = D(b2).hints.filter((h) => h.hint_id !== 'L01-Q02-H4');
    q(b2, 'L01-Q02').hint_ids = q(b2, 'L01-Q02').hint_ids.filter((x) => x !== 'L01-Q02-H4');
    expect(rules(b2)).toContain(9);
    const b3 = clone();
    D(b3).hints.push({ hint_id: 'L01-Q01-H1', target_id: 'L01-Q01', level: 1, text_ko: '질문' });
    expect(rules(b3)).toContain(9);
  });
  it('규칙 10: new_code_lines 0 단계는 long_step false (S16 정본은 통과, true면 실패)', () => {
    expect(step(base, 'L01-S16').new_code_lines).toBe(0);
    const b = clone();
    step(b, 'L01-S16').long_step = true;
    expect(rules(b)).toContain(10);
  });
});

describe('바뀐 줄만 보여 주기 (edits)', () => {
  const steps = D(base).steps;
  it('code 앞쪽 줄이 edits 순서대로 넣을 줄, 나머지는 새 셀', () => {
    const s05 = step(base, 'L01-S05');
    const { blocks, rest } = splitEdits(s05);
    expect(blocks[0].lines).toHaveLength(6);
    expect(blocks[0].lines[0]).toContain('def __add__');
    expect(rest.lines).toEqual(['print(Value(2.0) * Value(-3.0) + Value(10.0))']);
  });
  it('고친 뒤 셀 전체: 앞 단계 edits 를 차례로 적용하고 이번 줄을 표시', () => {
    const s10 = step(base, 'L01-S10');
    const rc = reconstructCell(steps, s10, 'L01-S04');
    expect(rc.ok).toBe(true);
    const text = rc.lines.map((l) => l.text);
    const i = text.findIndex((t) => t.trim() === 'self.grad = 0.0');
    expect(text[i + 1].trim()).toBe('self._backward = lambda: None');
    expect(rc.lines[i + 1].isNew).toBe(true);
    expect(text[text.length - 1]).toBe('Value(2.0)'); // 확인용 줄은 맨 아래 그대로
    expect(rc.lines.filter((l) => l.isNew)).toHaveLength(9);
  });
  it('replace: 막는 줄로 바뀐 두 줄을 찾는다 (S16 → S15b 셀)', () => {
    const rc = reconstructCell(steps, step(base, 'L01-S16'), 'L01-S15b');
    expect(rc.ok).toBe(true);
    expect(rc.lines.filter((l) => l.isNew).map((l) => l.text.trim())).toEqual(['# for p in n.parameters():', '#     p.grad = 0.0']);
  });
});

describe('빌드 결과', () => {
  it('공개 단계·문제에는 풀이·rubric·힌트 본문이 없고 answers·hints JSON 에만 있다. 문제는 after_step 단계에 붙는다', () => {
    const site = buildSite(base);
    const d = site.details.L01;
    const pub = JSON.stringify({ steps: d.steps, questions: d.questions });
    expect(pub).not.toContain('answer_ko');
    expect(pub).not.toContain('"rubric"');
    expect(pub).not.toContain(D(base).hints.find((h) => h.hint_id === 'L01-Q04-H4').text_ko);
    expect(d.answers['L01-Q04'].answer_index).toBe(q(base, 'L01-Q04').answer_index);
    expect(d.steps.find((s) => s.step_id === 'L01-S02').question_ids).toEqual(['L01-Q01', 'L01-Q02']);
    expect(d.hints['L01-S04'].find((h) => h.level === 4).code).toBe(step(base, 'L01-S04').code); // show_solution
    expect(d.hints['L01-Q04'].find((h) => h.level === 4).answer_ko).toBe(q(base, 'L01-Q04').answer_ko);
    expect(d.steps).toHaveLength(D(base).steps.length);
    expect(d.steps.find((s) => s.step_id === 'L01-S09b').rerun_first.map((x) => x.step_id)).toEqual(['L01-S09']);
    expect(d.lecture.content_version).toMatch(/^auto-[0-9a-f]{12}$/);
  });
});
