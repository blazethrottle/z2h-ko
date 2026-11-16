// 맛보기 콘텐츠 로더·검사 (교사 정본 taster.json + taster_outputs.json). 정본은 고치지 않고, 사본을 고쳐 실패 예를 만든다.
import { describe, expect, it } from 'vitest';
import { readTasterBundle, resolvePaths } from '../../src/lib/content/load.mjs';
import { buildTaster, tasterSlug, validateTaster } from '../../src/lib/content/taster.mjs';

const base = readTasterBundle(resolvePaths());
const clone = () => structuredClone(base);
const D = (b) => b.file.data;
const step = (b, id) => D(b).steps.find((s) => s.step_id === id);
const q = (b, id) => D(b).questions.find((x) => x.question_id === id);
const rules = (b) => validateTaster(b).errors.map((e) => e.rule);

describe('맛보기 정본은 통과', () => {
  it('오류 0, 단계·문항 수는 콘텐츠에서 센다', () => {
    const r = validateTaster(base);
    expect(r.errors).toEqual([]);
    expect(r.stats.steps).toBe(D(base).steps.length);
    expect(r.stats.questions).toBe(D(base).questions.length);
  });
  it('kind copy_run·read, cell_code_lines, code_alt_local, expected_output_example, aha_ko, summary_ko, minutes 를 받는다', () => {
    const kinds = new Set(D(base).steps.map((s) => s.kind));
    expect([...kinds].sort()).toEqual(['copy_run', 'read']);
    expect(D(base).steps.some((s) => s.code_alt_local)).toBe(true);
    expect(D(base).steps.some((s) => typeof s.summary_ko === 'string')).toBe(true);
  });
});

describe('검사 규칙마다 실패 예', () => {
  it('규칙 1: step_id 모양, 모르는 칸은 경고만', () => {
    const b1 = clone();
    step(b1, 'T-S02').step_id = 'T-2';
    expect(rules(b1)).toContain(1);
    const b2 = clone();
    step(b2, 'T-S02').new_field_x = 1;
    expect(rules(b2)).toEqual([]);
    expect(validateTaster(b2).warnings.some((w) => /모르는 칸 "new_field_x"/.test(w.message))).toBe(true);
    const b3 = clone();
    step(b3, 'T-S02').kind = 'code';
    expect(rules(b3)).toContain(1);
  });
  it('규칙 2: 줄별 풀이 개수 (셀 코드와 Colab 밖 대체 셀)', () => {
    const b1 = clone();
    step(b1, 'T-S04').code_line_notes_ko.pop();
    expect(rules(b1)).toContain(2);
    const b2 = clone();
    step(b2, 'T-S03').code_alt_local_line_notes_ko.pop();
    expect(rules(b2)).toContain(2);
  });
  it('규칙 3: cell_code_lines = 코드 줄 수, 새로 치는 코드 0줄', () => {
    const b1 = clone();
    step(b1, 'T-S06').cell_code_lines = 17;
    expect(rules(b1)).toContain(3);
    const b2 = clone();
    step(b2, 'T-S06').new_code_lines = 3;
    expect(rules(b2)).toContain(3);
  });
  it('규칙 4·12: 문항은 고르기, 답 번호 범위, scored false', () => {
    const b1 = clone();
    q(b1, 'T-Q01').answer_index = 9;
    expect(rules(b1)).toContain(4);
    const b2 = clone();
    q(b2, 'T-Q02').scored = true;
    expect(rules(b2)).toContain(12);
    const b3 = clone();
    D(b3).lecture.completion_rule.requires_steps.push('T-S09');
    expect(rules(b3)).toContain(12);
  });
  it('규칙 5: 맛보기 단계에 영상 구간이 있으면 실패 (D53)', () => {
    const b = clone();
    step(b, 'T-S02').video_segments = [{ start_s: 0, end_s: 10 }];
    expect(rules(b)).toContain(5);
  });
  it('규칙 6: after_step 이 없는 단계, 힌트 대상 없음', () => {
    const b1 = clone();
    q(b1, 'T-Q01').after_step = 'T-S09';
    expect(rules(b1)).toContain(6);
    const b2 = clone();
    D(b2).hints[0].target_id = 'T-S99';
    expect(rules(b2)).toContain(6);
  });
  it('규칙 7: 긴 줄표', () => {
    const b = clone();
    step(b, 'T-S02').aha_ko = `셀 하나 \u2014 명령 하나`;
    expect(rules(b)).toContain(7);
  });
  it('규칙 9: 단계 힌트 H1~H4', () => {
    const b = clone();
    D(b).hints = D(b).hints.filter((h) => h.hint_id !== 'T-S05-H3');
    expect(rules(b)).toContain(9);
  });
  it('규칙 11: 출력 예와 교사 실행 출력이 다르면 실패', () => {
    const b = clone();
    step(b, 'T-S06').expected_output_example = '0 3.800\n';
    expect(rules(b)).toContain(11);
    const b2 = clone();
    b2.outputsFile.data['T-S99'] = 'x';
    expect(rules(b2)).toContain(11);
  });
});

describe('화면 데이터', () => {
  const t = buildTaster(base);
  it('주소는 id 뒷부분, 순서는 order, 단계 수는 콘텐츠에서', () => {
    expect(tasterSlug('T-S01')).toBe('S01');
    expect(t.steps.map((s) => s.slug)).toEqual([...D(base).steps].sort((a, b) => a.order - b.order).map((s) => s.step_id.slice(2)));
    expect(t.total_minutes).toBe(D(base).steps.reduce((a, s) => a + s.minutes, 0));
  });
  it('풀이·힌트 본문은 단계·문항 데이터에 없고 따로 둔다', () => {
    const pub = JSON.stringify({ steps: t.steps, questions: t.questions });
    for (const x of D(base).questions) expect(pub.includes(x.answer_ko)).toBe(false);
    for (const h of D(base).hints) expect(pub.includes(h.text_ko)).toBe(false);
    expect(t.answers['T-Q02'].answer_index).toBe(q(base, 'T-Q02').answer_index);
    expect(t.hints['T-S06'].map((h) => h.level)).toEqual([1, 2, 3, 4]);
    expect(t.hints['T-S06'][3].expected_output).toBe(step(base, 'T-S06').expected_output_example);
  });
  it('확인 질문은 after_step 단계에 붙는다', () => {
    for (const x of D(base).questions) expect(t.steps.find((s) => s.step_id === x.after_step).question_ids).toContain(x.question_id);
  });
  it('교사 실행 출력은 그대로 (_ 로 시작하는 칸 제외)', () => {
    for (const [k, v] of Object.entries(base.outputsFile.data)) {
      if (k.startsWith('_')) expect(t.outputs[k]).toBeUndefined();
      else expect(t.outputs[k]).toBe(v);
    }
    expect(t.elapsed_s).toBe(base.outputsFile.data._elapsed_s);
  });
  it('노트북 파일이 없으면 받기 주소 없음', () => {
    const b = clone();
    b.notebookExists = false;
    expect(buildTaster(b).lecture.notebook.url).toBeNull();
    b.notebookExists = true;
    expect(buildTaster(b).lecture.notebook.url).toBe('/notebooks/taster/taster.ipynb');
  });
});
