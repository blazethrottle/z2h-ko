// 사전 기초(spec 8절, 교사 정본 F.json lecture.diagnostic·mastery_rule): 추천 계산, 진단 채점, 결과 문구 틀, 단위 익힘(mastery_rule), 목록 행 상태.
// 문구는 박지 않는다(정본 글은 콘텐츠 테스트·화면 테스트가 정본에서 읽어 비교). 여기서는 규칙과 구조만 본다.
import { describe, expect, it } from 'vitest';
import {
  diagnosticSummary,
  fillTemplate,
  gradeDiagnostic,
  latestDiagnostic,
  nextUnit,
  notReadyTarget,
  rebuildPasses,
  recommendUnits,
  splitUnitsTemplate,
  unitHref,
  unitMastery,
  unitRowState,
  type BasicsRule,
  type UnitMasteryRef,
} from '../../src/lib/basics';

const ORDER = ['F-P1', 'F-P2', 'F-P3', 'F-P4', 'F-P5', 'F-P6', 'F-P7', 'F-P8', 'F-P9', 'F-M1', 'F-M2', 'F-M3', 'F-M4', 'F-M5', 'F-M6'];
const READY = ['F-P1', 'F-P2', 'F-P3', 'F-P4', 'F-P5', 'F-P6', 'F-P7', 'F-P8', 'F-M1', 'F-M2', 'F-M6'];
const DIAG = [
  { question_id: 'F-D1', recommend_units_if_wrong: ['F-P1', 'F-P2'] },
  { question_id: 'F-D2', recommend_units_if_wrong: ['F-P3', 'F-P4'] },
  { question_id: 'F-D3', recommend_units_if_wrong: ['F-P5', 'F-P6'] },
  { question_id: 'F-D4', recommend_units_if_wrong: ['F-M1', 'F-M2'] },
  { question_id: 'F-D5', recommend_units_if_wrong: ['F-M3', 'F-M4'] },
];
const ans = (wrong: string[], dontKnow: string[] = []) =>
  DIAG.map((q) => ({
    question_id: q.question_id,
    is_correct: !wrong.includes(q.question_id) && !dontKnow.includes(q.question_id),
    is_dont_know: dontKnow.includes(q.question_id),
  }));

describe('추천 계산 (정본 recommend_rule: 틀리거나 모르겠어요인 문항의 recommend_units_if_wrong 을 합쳐 단위 지도 순서로)', () => {
  it('5개 다 맞으면 추천 단위 없음', () => {
    expect(diagnosticSummary(DIAG, ans([]), ORDER)).toEqual({ correct: 5, total: 5, units: [] });
  });
  it('일부 틀림: 모은 단위 전체를 단위 지도 순서로', () => {
    const s = diagnosticSummary(DIAG, ans(['F-D4', 'F-D2']), ORDER);
    expect(s.correct).toBe(3);
    expect(s.units).toEqual(['F-P3', 'F-P4', 'F-M1', 'F-M2']);
  });
  it('문항 순서와 상관없이 단위 지도 순서', () => {
    const s = diagnosticSummary([DIAG[3], DIAG[0]], [
      { question_id: 'F-D4', is_correct: false },
      { question_id: 'F-D1', is_correct: false },
    ], ORDER);
    expect(s.units).toEqual(['F-P1', 'F-P2', 'F-M1', 'F-M2']);
  });
  it('모르겠어요는 감점 없이 오답으로 기록되고 추천에 쓰인다', () => {
    const s = diagnosticSummary(DIAG, ans([], ['F-D3']), ORDER);
    expect(s.correct).toBe(4);
    expect(s.units).toEqual(['F-P5', 'F-P6']);
  });
  it('준비 중 단위도 추천에서 빼지 않는다', () => {
    expect(diagnosticSummary(DIAG, ans(['F-D5']), ORDER).units).toEqual(['F-M3', 'F-M4']);
  });
  it('겹치는 단위는 한 번만, 답이 없는 문항은 틀린 것으로 본다', () => {
    const qs = [...DIAG, { question_id: 'F-D9', recommend_units_if_wrong: ['F-P1'] }];
    expect(recommendUnits(qs, ans(['F-D1']), ORDER)).toEqual(['F-P1', 'F-P2']);
    expect(recommendUnits(DIAG.slice(0, 1), [], ORDER)).toEqual(['F-P1', 'F-P2']);
  });
});

describe('결과 문구 틀 (정본 result_ko 의 {correct}·{units})', () => {
  it('{이름}을 값으로, 모르는 이름은 그대로', () => {
    expect(fillTemplate('맞힌 문제 {correct}/5', { correct: 3 })).toBe('맞힌 문제 3/5');
    expect(fillTemplate('{a}와 {b}', { a: 1 })).toBe('1와 {b}');
  });
  it('{units} 앞뒤로 나눈다(단위는 화면에서 링크·준비 중과 함께)', () => {
    expect(splitUnitsTemplate('추천 시작 단위: {units}')).toEqual(['추천 시작 단위: ', '']);
    expect(splitUnitsTemplate('앞 {units} 뒤')).toEqual(['앞 ', ' 뒤']);
  });
});

describe('진단 채점 (힌트 없음, 모르겠어요는 오답 기록)', () => {
  const choice = { type: 'choice', choices: ['3', '5', '32', '모르겠어요'] };
  const choiceKey = { answer_index: 1, auto_grade: { type: 'choice' } };
  const exact = { type: 'predict', choices: null };
  const exactKey = { answer_index: null, auto_grade: { type: 'exact', value: '8' } };
  it('고르기: 정답 번호면 맞음, 다른 보기면 틀림, 모르겠어요는 틀림 + is_dont_know', () => {
    expect(gradeDiagnostic(choice, choiceKey, { choiceIndex: 1 })).toEqual({ is_correct: true, is_dont_know: false });
    expect(gradeDiagnostic(choice, choiceKey, { choiceIndex: 2 })).toEqual({ is_correct: false, is_dont_know: false });
    expect(gradeDiagnostic(choice, choiceKey, { choiceIndex: 3 })).toEqual({ is_correct: false, is_dont_know: true });
  });
  it('직접 입력 exact: 앞뒤 공백은 무시', () => {
    expect(gradeDiagnostic(exact, exactKey, { text: '8' }).is_correct).toBe(true);
    expect(gradeDiagnostic(exact, exactKey, { text: '  8 ' }).is_correct).toBe(true);
    expect(gradeDiagnostic(exact, exactKey, { text: '9' }).is_correct).toBe(false);
  });
  it('직접 입력의 모르겠어요 버튼(정본 dont_know_allowed)은 틀림 + is_dont_know', () => {
    expect(gradeDiagnostic(exact, exactKey, { dontKnow: true })).toEqual({ is_correct: false, is_dont_know: true });
  });
  it('마지막 진단 결과는 at 이 가장 늦은 행', () => {
    const rows = [
      { attempt_id: 'a', at: '2026-11-17T10:00:00+09:00' },
      { attempt_id: 'b', at: '2026-11-17T11:00:00+09:00' },
      { attempt_id: 'c', at: '2026-11-17T09:00:00+09:00' },
    ];
    expect(latestDiagnostic(rows)?.attempt_id).toBe('b');
    expect(latestDiagnostic([])).toBeNull();
  });
});

describe('단위 익힘 = 정본 mastery_rule (선택 단계 제외 단계 전부 + 점수 0.8 + must_pass 전부 + 스스로 해 보기 통과)', () => {
  const rule: BasicsRule = { steps_complete_ratio: 1, question_score_ratio: 0.8, must_pass_all: true };
  const u: UnitMasteryRef = {
    step_ids: ['F-P1-S01', 'F-P1-S02'],
    activity_step_ids: ['F-P1-S01', 'F-P1-S02', 'F-P1-S03'], // S03 은 선택 단계
    questions: [
      { question_id: 'F-P1-Q1', max_points: 1, must_pass: true },
      { question_id: 'F-P1-Q2', max_points: 1, must_pass: true },
    ],
    rebuilds: [{ rebuild_id: 'F-P1-R1', max_hint_level_for_pass: 1 }],
  };
  const done = (id: string, status = 'done') => ({ step_id: id, status });
  const att = (qid: string, ok: boolean, hint = 0) => ({ question_id: qid, is_correct: ok, points_awarded: ok ? [1, 1, 0.8, 0.5, 0][hint] : 0, max_hint_level: hint });
  const rb = (passed: boolean, hint: number) => ({ rebuild_id: 'F-P1-R1', passed, max_hint_level: hint });
  const allSteps = [done('F-P1-S01'), done('F-P1-S02')];
  const allQs = [att('F-P1-Q1', true), att('F-P1-Q2', true)];

  it('기록 없음 = 아직, 하나라도 하면 지금(선택 단계·문제·스스로 해 보기 포함)', () => {
    expect(unitMastery(u, rule, [], [], []).status).toBe('todo');
    expect(unitMastery(u, rule, [done('F-P1-S03', 'in_progress')], [], []).status).toBe('now');
    expect(unitMastery(u, rule, [], [att('F-P1-Q1', false)], []).status).toBe('now');
    expect(unitMastery(u, rule, [], [], [rb(false, 3)]).status).toBe('now');
  });
  it('전부 채우면 완료. 선택 단계는 안 해도 된다', () => {
    const m = unitMastery(u, rule, allSteps, allQs, [rb(true, 1)]);
    expect(m).toMatchObject({ status: 'done', steps_ok: true, score_ok: true, must_pass_ok: true, rebuild_ok: true, steps_done_ratio: 1, question_score_ratio: 1 });
  });
  it('단계 하나가 남으면 지금', () => {
    expect(unitMastery(u, rule, [done('F-P1-S01')], allQs, [rb(true, 0)]).status).toBe('now');
  });
  it('점수: 힌트 비율 반영, 0.8 미만이면 지금(맞혀도 H3 이상이면 점수가 깎인다)', () => {
    const m = unitMastery(u, rule, allSteps, [att('F-P1-Q1', true, 3), att('F-P1-Q2', true)], [rb(true, 0)]);
    expect(m.question_score_ratio).toBe(0.75);
    expect(m.score_ok).toBe(false);
    expect(m.must_pass_ok).toBe(true);
    expect(m.status).toBe('now');
    expect(unitMastery(u, rule, allSteps, [att('F-P1-Q1', true, 2), att('F-P1-Q2', true)], [rb(true, 0)]).status).toBe('done');
  });
  it('must_pass: 점수가 넘어도 한 문제라도 맞힌 적 없으면 지금. 틀린 뒤 다시 풀어 맞히면 완료', () => {
    const five: UnitMasteryRef = { ...u, questions: Array.from({ length: 5 }, (_, i) => ({ question_id: `F-P1-Q${i + 1}`, max_points: 1, must_pass: true })) };
    const four = [1, 2, 3, 4].map((i) => att(`F-P1-Q${i}`, true));
    const m = unitMastery(five, rule, allSteps, [...four, att('F-P1-Q5', false)], [rb(true, 0)]);
    expect(m.question_score_ratio).toBe(0.8);
    expect(m.must_pass_ok).toBe(false);
    expect(m.status).toBe('now');
    expect(unitMastery(five, rule, allSteps, [...four, att('F-P1-Q5', false), att('F-P1-Q5', true)], [rb(true, 0)]).status).toBe('done');
  });
  it('must_pass_all 이 false 면 must_pass 표시가 있는 문항만 본다', () => {
    const v: UnitMasteryRef = { ...u, questions: [{ question_id: 'F-P1-Q1', max_points: 1, must_pass: false }, ...Array.from({ length: 4 }, (_, i) => ({ question_id: `F-P1-Q${i + 2}`, max_points: 1, must_pass: false }))] };
    const qs = [2, 3, 4, 5].map((i) => att(`F-P1-Q${i}`, true));
    expect(unitMastery(v, { ...rule, must_pass_all: false }, allSteps, qs, [rb(true, 0)]).status).toBe('done');
    expect(unitMastery(v, rule, allSteps, qs, [rb(true, 0)]).status).toBe('now');
  });
  it('스스로 해 보기: 통과 기록이 있어야, 연 힌트가 한도를 넘으면 통과가 아니다', () => {
    expect(unitMastery(u, rule, allSteps, allQs, []).rebuild_ok).toBe(false);
    expect(unitMastery(u, rule, allSteps, allQs, [rb(false, 2)]).rebuild_ok).toBe(false);
    expect(unitMastery(u, rule, allSteps, allQs, [rb(true, 2)]).rebuild_ok).toBe(false); // 한도 1
    expect(unitMastery(u, rule, allSteps, allQs, [rb(false, 2), rb(true, 1)]).rebuild_ok).toBe(true);
  });
  it('통과 한도: null 은 제한 없음, 0 은 힌트 없이만', () => {
    expect(rebuildPasses(5, null)).toBe(true);
    expect(rebuildPasses(0, 0)).toBe(true);
    expect(rebuildPasses(1, 0)).toBe(false);
    expect(rebuildPasses(2, 2)).toBe(true);
    expect(rebuildPasses(3, 2)).toBe(false);
  });
  it('진단 문항 기록은 단위 점수에 들어가지 않는다', () => {
    const m = unitMastery(u, rule, allSteps, [...allQs, { question_id: 'F-D1', is_correct: false, points_awarded: 0 }], [rb(true, 0)]);
    expect(m.question_score_ratio).toBe(1);
    expect(m.status).toBe('done');
  });
});

describe('목록 행 상태 (✓ 완료 / ● 지금 / 추천 / ○ 아직 / 준비 중)', () => {
  it('완료와 지금이 추천보다 먼저', () => {
    expect(unitRowState(true, 'done', true)).toEqual({ key: 'done', label: '✓ 완료' });
    expect(unitRowState(true, 'now', true)).toEqual({ key: 'now', label: '● 지금' });
    expect(unitRowState(true, 'todo', true)).toEqual({ key: 'rec', label: '추천' });
    expect(unitRowState(true, 'todo', false)).toEqual({ key: 'todo', label: '○ 아직' });
  });
  it('준비 중 단위: 추천이면 추천을 그대로 보이고 준비 중을 붙인다', () => {
    expect(unitRowState(false, 'todo', false)).toEqual({ key: 'coming', label: '준비 중' });
    expect(unitRowState(false, 'todo', true)).toEqual({ key: 'coming', label: '추천 · 준비 중' });
  });
});

describe('주소, 다음 단위, 준비 중 안내 링크', () => {
  const units = ORDER.map((id) => ({ unit_id: id, ready: READY.includes(id) }));
  const st = (m: Record<string, 'done' | 'now'>) => (id: string) => m[id] ?? 'todo';
  it('준비된 단위는 단위 화면, 준비 중 단위는 기초 목록', () => {
    expect(unitHref('F-P5', READY)).toBe('/basics/F-P5/');
    expect(unitHref('F-P9', READY)).toBe('/basics/');
    expect(unitHref('F-M2', new Set(READY))).toBe('/basics/F-M2/');
  });
  it('다음: 하던 단위 → 추천 단위 → 처음 안 끝난 단위 (준비된 것만)', () => {
    expect(nextUnit(units, st({}), [])).toBe('F-P1');
    expect(nextUnit(units, st({ 'F-P1': 'done' }), [])).toBe('F-P2');
    expect(nextUnit(units, st({ 'F-P1': 'done' }), ['F-P9', 'F-M1'])).toBe('F-M1');
    expect(nextUnit(units, st({ 'F-P1': 'done', 'F-P6': 'now' }), ['F-M1'])).toBe('F-P6');
    expect(nextUnit(units, st(Object.fromEntries(READY.map((id) => [id, 'done'] as const))), [])).toBeNull();
  });
  it('준비 중 단위를 추천했을 때 링크: 준비된 추천 단위 → 없으면 준비된 단위 중 첫 안 끝난 단위', () => {
    expect(notReadyTarget(units, st({}), ['F-M3', 'F-M4'])).toBe('F-P1');
    expect(notReadyTarget(units, st({ 'F-P1': 'done' }), ['F-M3', 'F-M4'])).toBe('F-P2');
    expect(notReadyTarget(units, st({}), ['F-P9', 'F-M1'])).toBe('F-M1');
    expect(notReadyTarget(units, st({ 'F-M1': 'done' }), ['F-P9', 'F-M1'])).toBe('F-P1');
  });
});

describe('진단 결과 동기화 표', () => {
  it('diagnostic_result 열쇠는 기기가 만든 attempt_id (쌓이는 기록, 번호는 서버가 매김)', async () => {
    const { TABLE_KEYS } = await import('../../src/lib/sync/tables');
    const { opData } = await import('../../src/lib/sync/store');
    expect(TABLE_KEYS.diagnostic_result).toEqual(['attempt_id']);
    const data = opData('diagnostic_result', { attempt_id: 'a1', attempt_no: 3, user_id: 'u', answers: [], recommended_units: ['F-P3'], at: 'x', content_version: 'v' });
    expect(data).toEqual({ answers: [], recommended_units: ['F-P3'], at: 'x', content_version: 'v' });
  });
});

describe('글 조각 (Inline): 백틱은 인라인 코드, 줄바꿈은 살리고, 굵게는 켠 글만', () => {
  it('줄바꿈이 없으면 예전과 같은 조각', async () => {
    const { inlineParts } = await import('../../src/lib/inline');
    expect(inlineParts('셀 아래에 `안녕하세요`.')).toEqual([
      { kind: 'text', value: '셀 아래에 ' },
      { kind: 'code', value: '안녕하세요' },
      { kind: 'text', value: '.' },
    ]);
    expect(inlineParts(null)).toEqual([]);
  });
  it('줄바꿈은 br, 목록 줄은 글 그대로', async () => {
    const { inlineParts } = await import('../../src/lib/inline');
    expect(inlineParts('둘 중 하나:\n- Colab: `새 노트`')).toEqual([
      { kind: 'text', value: '둘 중 하나:' },
      { kind: 'br' },
      { kind: 'text', value: '- Colab: ' },
      { kind: 'code', value: '새 노트' },
    ]);
  });
  it('** 는 기본으로 글자 그대로(거듭제곱), bold 를 켜면 굵게. 백틱 안은 늘 코드', async () => {
    const { inlineParts } = await import('../../src/lib/inline');
    expect(inlineParts('(yout - ygt)**2 와 **추천만**')).toEqual([{ kind: 'text', value: '(yout - ygt)**2 와 **추천만**' }]);
    expect(inlineParts('볼지 **추천만** 합니다. `x**2`', { bold: true })).toEqual([
      { kind: 'text', value: '볼지 ' },
      { kind: 'strong', value: '추천만' },
      { kind: 'text', value: ' 합니다. ' },
      { kind: 'code', value: 'x**2' },
    ]);
  });
});
