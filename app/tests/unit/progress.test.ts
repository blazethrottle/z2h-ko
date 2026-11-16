import { describe, expect, it } from 'vitest';
import { ActivityTracker } from '../../src/lib/activity';
import { computeMastery } from '../../src/lib/mastery';
import { weeklySeconds } from '../../src/lib/progress';
import { formatHM, toKstIso, weekStartKst } from '../../src/lib/time';

describe('실습 시간 자동 측정', () => {
  function setup() {
    let now = 0;
    let visible = true;
    const flushed: number[] = [];
    const t = new ActivityTracker({
      now: () => now,
      isVisible: () => visible,
      idleLimitMs: 5 * 60_000,
      flushEverySeconds: 15,
      onFlush: (d) => flushed.push(d),
    });
    return {
      t,
      flushed,
      advance: (s: number) => {
        for (let i = 0; i < s; i++) {
          now += 1000;
          t.tick();
        }
      },
      setVisible: (v: boolean) => (visible = v),
      input: () => t.noteInput(),
    };
  }

  it('화면이 보이고 마지막 입력이 5분 안이면 1초씩 센다', () => {
    const s = setup();
    s.input();
    s.advance(30);
    expect(s.t.totalSeconds).toBe(30);
    expect(s.flushed).toEqual([15, 15]);
  });

  it('탭이 숨겨지면 세지 않는다', () => {
    const s = setup();
    s.input();
    s.setVisible(false);
    s.advance(10);
    expect(s.t.totalSeconds).toBe(0);
  });

  it('5분 동안 입력이 없으면 멈추고, 입력이 오면 다시 센다', () => {
    const s = setup();
    s.input();
    s.advance(400);
    expect(s.t.totalSeconds).toBe(300);
    s.input();
    s.advance(5);
    expect(s.t.totalSeconds).toBe(305);
    s.t.flush();
    expect(s.flushed.reduce((a, b) => a + b, 0)).toBe(305);
  });
});

describe('이번 주 실습 시간', () => {
  const now = Date.parse('2026-11-18T12:00:00+09:00'); // 수요일
  it('이번 주(월요일 0시 KST부터) 자동 기록 합, 고친 값이 있으면 고친 값', () => {
    const sessions = [
      { started_at: '2026-11-16T09:00:00.000+09:00', active_seconds: 600, source: 'auto' },
      { started_at: '2026-11-15T23:00:00.000+09:00', active_seconds: 999, source: 'auto' },
      { started_at: '2026-11-17T10:00:00.000+09:00', active_seconds: 300, source: 'auto' },
    ];
    expect(weekStartKst(now)).toBe('2026-11-16');
    expect(weeklySeconds(sessions, null, now)).toEqual({ auto: 900, user: null, shown: 900 });
    expect(weeklySeconds(sessions, { edited_seconds: 7200 }, now)).toEqual({ auto: 900, user: 7200, shown: 7200 });
    // 자동 기록으로 되돌리기 = edited_seconds null
    expect(weeklySeconds(sessions, { edited_seconds: null }, now)).toEqual({ auto: 900, user: null, shown: 900 });
    expect(formatHM(9000)).toBe('2:30');
    expect(toKstIso(Date.parse('2026-11-16T00:00:00Z'))).toBe('2026-11-16T09:00:00.000+09:00');
  });
});

describe('익힘 판정 (12.7절: 단계 완료 + 문제 80% + 재구성 H2 이하)', () => {
  const rule = { steps_complete_ratio: 1, question_score_ratio: 0.8, rebuild_max_hint_level: 2, extra_checks: [] as string[] };
  const questions = [
    { question_id: 'Q1', max_points: 1, must_pass: true },
    { question_id: 'Q2', max_points: 1, must_pass: false },
  ];
  const stepIds = ['S1', 'S2'];
  const done = stepIds.map((s) => ({ step_id: s, status: 'done' }));

  it('아무것도 안 했으면 open', () => {
    expect(computeMastery({ stepIds, questions, rebuildIds: ['R1'], rule, stepRows: [], attemptRows: [], rebuildRows: [], extraChecks: {} }).state).toBe('open');
  });

  it('세 조건을 다 채우면 mastered', () => {
    const m = computeMastery({
      stepIds,
      questions,
      rebuildIds: ['R1'],
      rule,
      stepRows: done,
      attemptRows: [
        { question_id: 'Q1', is_correct: true, points_awarded: 1 },
        { question_id: 'Q2', is_correct: true, points_awarded: 0.8, max_hint_level: 2 },
      ],
      rebuildRows: [{ rebuild_id: 'R1', passed: true, max_hint_level: 1 }],
      extraChecks: {},
    });
    expect(m).toMatchObject({ state: 'mastered', steps_done_ratio: 1, question_score_ratio: 0.9, must_pass_ok: true, rebuild_ok: true });
  });

  it('최소 점수(question_min_points)가 있으면 비율을 넘어도 점수가 모자라면 mastered 가 아니다', () => {
    const input = {
      stepIds,
      questions,
      rebuildIds: ['R1'],
      stepRows: done,
      attemptRows: [
        { question_id: 'Q1', is_correct: true, points_awarded: 1 },
        { question_id: 'Q2', is_correct: true, points_awarded: 0.8, max_hint_level: 2 },
      ],
      rebuildRows: [{ rebuild_id: 'R1', passed: true, max_hint_level: 1 }],
      extraChecks: {},
    };
    expect(computeMastery({ ...input, rule: { ...rule, question_min_points: 1.9 } }).state).not.toBe('mastered');
    expect(computeMastery({ ...input, rule: { ...rule, question_min_points: 1.8 } }).state).toBe('mastered');
  });

  it('재구성을 H3 이상으로만 통과했으면 almost', () => {
    const m = computeMastery({
      stepIds,
      questions,
      rebuildIds: ['R1'],
      rule,
      stepRows: done,
      attemptRows: [
        { question_id: 'Q1', is_correct: true, points_awarded: 1 },
        { question_id: 'Q2', is_correct: true, points_awarded: 1 },
      ],
      rebuildRows: [{ rebuild_id: 'R1', passed: true, max_hint_level: 3 }],
      extraChecks: {},
    });
    expect(m.state).toBe('almost');
    expect(m.rebuild_ok).toBe(false);
  });

  it('점수가 80% 아래면 in_progress, must_pass 문제를 못 맞히면 must_pass_ok false', () => {
    const m = computeMastery({
      stepIds,
      questions,
      rebuildIds: [],
      rule,
      stepRows: done,
      attemptRows: [{ question_id: 'Q2', is_correct: true, points_awarded: 1 }],
      rebuildRows: [],
      extraChecks: {},
    });
    expect(m.state).toBe('in_progress');
    expect(m.question_score_ratio).toBe(0.5);
    expect(m.must_pass_ok).toBe(false);
  });

  it('말하기 질문(extra_checks)은 스스로 표시한 값으로', () => {
    const r2 = { ...rule, extra_checks: ['speak_check'] };
    const args = {
      stepIds,
      questions: [{ question_id: 'Q1', max_points: 1, must_pass: false }],
      rebuildIds: [],
      rule: r2,
      stepRows: done,
      attemptRows: [{ question_id: 'Q1', is_correct: true, points_awarded: 1 }],
      rebuildRows: [],
    };
    expect(computeMastery({ ...args, extraChecks: {} }).extra_checks_ok).toBe(false);
    expect(computeMastery({ ...args, extraChecks: { speak_check: true } }).state).toBe('mastered');
  });
});
