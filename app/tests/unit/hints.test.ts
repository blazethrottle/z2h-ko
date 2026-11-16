import { describe, expect, it } from 'vitest';
import { canOpen, nextLevel, openHint, recordAttempt, emptyHintState, lockText, scoreNoteKo } from '../../src/lib/hints';

const t0 = Date.parse('2026-11-16T20:00:00+09:00');
const min = 60_000;

describe('힌트 사다리 열림 조건 (hints.md 2절, 시도 = 비교하기·제출)', () => {
  it('H1은 언제나 열린다', () => {
    const s = emptyHintState(t0);
    expect(nextLevel(s)).toBe(1);
    expect(canOpen(s, 1, t0)).toBe(true);
  });

  it('H2는 H1을 본 뒤 시도 1회가 있어야 열린다', () => {
    let s = openHint(emptyHintState(t0), 1, t0 + 1000);
    expect(canOpen(s, 2, t0 + 2000)).toBe(false);
    s = recordAttempt(s, false, t0 + 3000);
    expect(canOpen(s, 2, t0 + 4000)).toBe(true);
  });

  it('H1을 열기 전 시도는 H2 조건에 세지 않는다', () => {
    let s = recordAttempt(emptyHintState(t0), false, t0 + 500);
    s = openHint(s, 1, t0 + 1000);
    expect(canOpen(s, 2, t0 + 2000)).toBe(false);
  });

  it('H3은 H2 뒤 시도 1회 또는 같은 단계 15분', () => {
    let s = openHint(emptyHintState(t0), 1, t0);
    s = recordAttempt(s, false, t0 + 1000);
    s = openHint(s, 2, t0 + 2000);
    expect(canOpen(s, 3, t0 + 3000)).toBe(false);
    expect(canOpen(s, 3, t0 + 15 * min)).toBe(true);
    const s2 = recordAttempt(s, false, t0 + 4000);
    expect(canOpen(s2, 3, t0 + 5000)).toBe(true);
  });

  it('H4는 H3 뒤 시도 1회 또는 30분, 한 번에 다음 한 칸만', () => {
    let s = openHint(emptyHintState(t0), 1, t0);
    s = recordAttempt(s, false, t0 + 1);
    s = openHint(s, 2, t0 + 2);
    expect(canOpen(s, 4, t0 + 60 * min)).toBe(false);
    s = recordAttempt(s, false, t0 + 3);
    s = openHint(s, 3, t0 + 4);
    expect(canOpen(s, 4, t0 + 29 * min)).toBe(false);
    expect(canOpen(s, 4, t0 + 30 * min)).toBe(true);
  });

  it('HELP는 H4를 보고도 결과가 다를 때만', () => {
    let s = openHint(emptyHintState(t0), 1, t0);
    for (const lv of [2, 3, 4]) {
      s = recordAttempt(s, false, t0 + lv * 10);
      s = openHint(s, lv, t0 + lv * 10 + 1);
    }
    expect(canOpen(s, 5, t0 + 100)).toBe(false);
    expect(canOpen(recordAttempt(s, true, t0 + 200), 5, t0 + 300)).toBe(false);
    expect(canOpen(recordAttempt(s, false, t0 + 200), 5, t0 + 300)).toBe(true);
  });

  it('콘텐츠의 unlock 값이 기본값보다 우선한다', () => {
    let s = openHint(emptyHintState(t0), 1, t0);
    s = openHint(recordAttempt(s, false, t0 + 1), 2, t0 + 2);
    expect(canOpen(s, 3, t0 + 5 * min, { 3: { after_attempts: 1, after_minutes: 5 } })).toBe(true);
  });

  it('조건 글자와 점수 문구', () => {
    expect(lockText(3, 'question')).toBe('답을 한 번 더 내거나 15분 뒤 열림');
    expect(lockText(2, 'step')).toBe('결과를 한 번 더 비교하면 열림');
    expect(scoreNoteKo(2)).toBe('이 힌트를 열면 이 문제는 80%로 계산됩니다.');
    expect(scoreNoteKo(1)).toBe('이 힌트는 점수에 영향이 없습니다.');
  });
});
