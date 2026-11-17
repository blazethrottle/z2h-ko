// 단계 화면 "보여야 하는 것"의 확인 방식 (spec 4.3, 정본 expected_check·expected_error·expected_output_example·self_check_ko).
// - text: 붙여 넣은 출력과 글 비교(match exact 는 줄마다 같게, contains 는 기대한 줄 묶음이 출력 안에 차례로 있으면)
// - number: 붙여 넣은 출력의 첫 숫자가 범위 안
// - self: "같아요/달라요"로 스스로 확인(에러가 정상인 단계, 그림·출력 없는 단계, 비교할 수 없는 단계)
// 정본 출력 예가 있으면 그 출력 예가 통과하는 비교만 고른다(학습자가 맞게 해도 "다시"가 나오는 일이 없게).
// value_range 의 range_of tool 은 검사 도구 식(expr)의 범위라 셀 출력과 다를 수 있어, 출력 예로 확인될 때만 숫자 칸을 낸다.
import { checkValueRange, compareOutput, compareOutputContains, type CompareResult } from './compare';

export interface CheckSource {
  expected_check: { type: string; expected?: string; match?: string; min?: number; max?: number; range_of?: 'output' | 'tool' };
  expected_error?: string | null;
  expected_output_example?: string | null;
  self_check_ko?: string[] | null;
}

export type CheckPlan =
  | { kind: 'text'; expected: string; match: 'exact' | 'contains' }
  | { kind: 'number'; min: number; max: number }
  | { kind: 'self'; reason: 'error' | 'figure' | 'manual' };

export type CheckRun = { ok: boolean; compare?: CompareResult; value?: number | null; reason?: string };

export function runCheck(plan: CheckPlan, pasted: string): CheckRun {
  if (plan.kind === 'text') {
    const r = plan.match === 'contains' ? compareOutputContains(plan.expected, pasted) : compareOutput(plan.expected, pasted);
    return { ok: r.ok, compare: r };
  }
  if (plan.kind === 'number') {
    const r = checkValueRange(pasted, { min: plan.min, max: plan.max });
    return { ok: r.ok, value: r.value, reason: r.reason };
  }
  return { ok: false };
}

const hasExample = (s: CheckSource) => typeof s.expected_output_example === 'string' && s.expected_output_example.trim() !== '';

export function checkPlan(s: CheckSource): CheckPlan {
  const c = s.expected_check;
  const self = (): CheckPlan => ({ kind: 'self', reason: s.self_check_ko?.length ? 'figure' : 'manual' });
  if (s.expected_error) return { kind: 'self', reason: 'error' };
  if (c.type === 'output_match' && typeof c.expected === 'string' && c.expected.trim() !== '') {
    const plan: CheckPlan = { kind: 'text', expected: c.expected, match: c.match === 'contains' ? 'contains' : 'exact' };
    return !hasExample(s) || runCheck(plan, String(s.expected_output_example)).ok ? plan : self();
  }
  if (c.type === 'value_range' && typeof c.min === 'number' && typeof c.max === 'number') {
    const plan: CheckPlan = { kind: 'number', min: c.min, max: c.max };
    if (hasExample(s)) return runCheck(plan, String(s.expected_output_example)).ok ? plan : self();
    return c.range_of === 'tool' ? self() : plan;
  }
  return self();
}
