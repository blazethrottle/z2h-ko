// 단계 화면의 "보여야 하는 것" 확인 방식(src/lib/checkPlan.ts): 붙여넣기 글 비교 / 숫자 범위 / 스스로 확인.
// 정본 출력 예(expected_output_example)를 붙여 넣으면 늘 통과해야 한다: 통과하지 못하는 비교는 화면에 내지 않고 스스로 확인으로 둔다.
// 검사 도구 식(expr)의 범위는 셀 출력이 아니라서, 출력 예로 확인할 수 없으면 붙여넣기 칸을 내지 않는다.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPlan, runCheck } from '../../src/lib/checkPlan';
import { APP_DIR, readBasicsBundle, readBundle, resolveBasicsPath, resolvePaths } from '../../src/lib/content/load.mjs';
import { buildBasics } from '../../src/lib/content/basics.mjs';
import { buildSite } from '../../src/lib/content/build.mjs';

const basics = buildBasics(readBasicsBundle(resolveBasicsPath({ Z2H_BASICS_FILE: path.join(APP_DIR, 'tests/fixtures/basics/F.json') })));
const site = buildSite(readBundle(resolvePaths({ Z2H_CONTENT_DIR: path.join(APP_DIR, 'tests/fixtures/pedagogy/content'), Z2H_EXTRAS_DIR: path.join(APP_DIR, 'tests/fixtures/extras') })));
const fSteps = Object.values(basics.steps).flat();
const lSteps = site.details.L01.steps;

describe('확인 방식 고르기', () => {
  it('에러가 나는 것이 정상인 단계(expected_error)는 스스로 확인', () => {
    expect(checkPlan({ expected_check: { type: 'output_match', expected: '' }, expected_error: 'NameError' })).toEqual({ kind: 'self', reason: 'error' });
  });
  it('출력이 정해진 단계는 글 비교(exact·contains)', () => {
    expect(checkPlan({ expected_check: { type: 'output_match', expected: '15', match: 'contains' }, expected_output_example: '15\n20' })).toEqual({ kind: 'text', expected: '15', match: 'contains' });
    expect(checkPlan({ expected_check: { type: 'output_match', expected: 'Value(data=2.0)' } })).toEqual({ kind: 'text', expected: 'Value(data=2.0)', match: 'exact' });
  });
  it('출력 예가 비교를 통과하지 못하면 스스로 확인', () => {
    expect(checkPlan({ expected_check: { type: 'output_match', expected: '15', match: 'exact' }, expected_output_example: '15\n20' })).toEqual({ kind: 'self', reason: 'manual' });
  });
  it('출력이 없거나 정해지지 않은 단계는 스스로 확인', () => {
    expect(checkPlan({ expected_check: { type: 'output_match' } })).toEqual({ kind: 'self', reason: 'manual' });
    expect(checkPlan({ expected_check: { type: 'manual' } })).toEqual({ kind: 'self', reason: 'manual' });
    expect(checkPlan({ expected_check: { type: 'manual' }, self_check_ko: ['그릇 모양'] })).toEqual({ kind: 'self', reason: 'figure' });
  });
  it('숫자 범위: 셀 출력의 범위면 숫자 칸, 검사 도구 식의 범위는 출력 예의 숫자가 범위 안일 때만', () => {
    expect(checkPlan({ expected_check: { type: 'value_range', min: 6, max: 6.01, range_of: 'output' } })).toEqual({ kind: 'number', min: 6, max: 6.01 });
    expect(checkPlan({ expected_check: { type: 'value_range', min: 20, max: 20, range_of: 'tool' }, expected_output_example: '20' })).toEqual({ kind: 'number', min: 20, max: 20 });
    expect(checkPlan({ expected_check: { type: 'value_range', min: 2, max: 2, range_of: 'tool' } })).toEqual({ kind: 'self', reason: 'manual' });
    expect(checkPlan({ expected_check: { type: 'value_range', min: 2, max: 2, range_of: 'tool' }, expected_output_example: 'tensor([1., 2.])' })).toEqual({ kind: 'self', reason: 'manual' });
  });
});

describe('정본 단계 전부: 화면에 내는 비교는 정본 출력 예를 붙여 넣으면 통과한다', () => {
  for (const [name, steps] of [
    ['기초', fSteps],
    ['1편', lSteps],
  ]) {
    it(name, () => {
      const bad = [];
      for (const s of steps) {
        const plan = checkPlan(s);
        if (plan.kind !== 'self' && s.expected_output_example != null && !runCheck(plan, s.expected_output_example).ok) bad.push(s.step_id);
      }
      expect(bad).toEqual([]);
    });
  }
  it('1편: 검사 도구 식으로만 정한 범위(출력 예 없음)는 붙여넣기 칸을 내지 않는다', () => {
    for (const s of lSteps.filter((x) => x.expected_check.type === 'value_range' && x.expected_check.range_of === 'tool')) expect(checkPlan(s).kind, s.step_id).toBe('self');
  });
  it('기초: 에러 단계는 모두 스스로 확인, 글 비교가 하나 이상 있다', () => {
    for (const s of fSteps.filter((x) => x.expected_error)) expect(checkPlan(s)).toEqual({ kind: 'self', reason: 'error' });
    expect(fSteps.some((s) => checkPlan(s).kind === 'text')).toBe(true);
  });
});

describe('비교 실행', () => {
  it('contains: 기대한 줄 묶음이 출력 안에 차례로 있으면 통과', () => {
    expect(runCheck({ kind: 'text', expected: '15', match: 'contains' }, '15\n20').ok).toBe(true);
    expect(runCheck({ kind: 'text', expected: 'b\nc', match: 'contains' }, 'a\nb\nc\nd').ok).toBe(true);
    expect(runCheck({ kind: 'text', expected: 'b\nd', match: 'contains' }, 'a\nb\nc\nd').ok).toBe(false);
    expect(runCheck({ kind: 'text', expected: '15', match: 'exact' }, '15\n20').ok).toBe(false);
  });
  it('숫자: 첫 숫자가 범위 안', () => {
    expect(runCheck({ kind: 'number', min: 6, max: 6.01 }, '6.005123').ok).toBe(true);
    expect(runCheck({ kind: 'number', min: 6, max: 6.01 }, '5.9').ok).toBe(false);
  });
});
