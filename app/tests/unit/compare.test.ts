import { describe, expect, it } from 'vitest';
import { compareOutput, checkValueRange, looksLikeError, parseFirstNumber } from '../../src/lib/compare';

describe('붙여넣기 비교 (output_match)', () => {
  it('앞뒤·줄 끝 공백과 줄바꿈 종류를 무시한다', () => {
    const r = compareOutput('Value(data=2.0)\n', '  Value(data=2.0)   \r\n\r\n');
    expect(r.ok).toBe(true);
  });

  it('여러 줄에서 첫 다른 줄을 알려 준다', () => {
    const r = compareOutput('a\nb\nc', 'a\nB\nc');
    expect(r.ok).toBe(false);
    expect(r.line).toBe(2);
    expect(r.expectedLine).toBe('b');
    expect(r.actualLine).toBe('B');
  });

  it('줄 수가 다르면 다르다고 한다', () => {
    const r = compareOutput('a\nb', 'a');
    expect(r.ok).toBe(false);
    expect(r.line).toBe(2);
    expect(r.actualLine).toBe('');
  });

  it('숫자는 상대 1e-4 허용 오차로 같다고 본다', () => {
    expect(compareOutput('grad 2.0000', 'grad 2.00001').ok).toBe(true);
    expect(compareOutput('x 6.881373587019543', 'x 6.8813735870').ok).toBe(true);
    expect(compareOutput('grad 2.0', 'grad 2.1').ok).toBe(false);
  });

  it('숫자 모양이 다르면(2 와 2.0) 다르다고 하되 이유를 숫자 모양으로 알려 준다', () => {
    const r = compareOutput('Value(data=2.0)', 'Value(data=2)');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('number_format');
  });

  it('단계 tolerance가 기본값보다 우선한다', () => {
    expect(compareOutput('loss 0.50', 'loss 0.52', { tolerance: { rel: 0.1 } }).ok).toBe(true);
    expect(compareOutput('loss 0.50', 'loss 0.52', { tolerance: 0.1 }).ok).toBe(true);
    expect(compareOutput('loss 0.50', 'loss 0.52').ok).toBe(false);
  });

  it('output_varies면 숫자 값은 보지 않고 글자 틀만 본다', () => {
    expect(compareOutput('loss 3.84\nloss 2.47', 'loss 3.91\nloss 2.50', { outputVaries: true }).ok).toBe(true);
    expect(compareOutput('loss 3.84', 'cost 3.84', { outputVaries: true }).ok).toBe(false);
  });

  it('빈 입력은 empty로 표시한다', () => {
    expect(compareOutput('a', '   \n ').reason).toBe('empty');
  });
});

describe('에러 글 알아보기', () => {
  it('Traceback 또는 Error가 있으면 에러로 본다', () => {
    expect(looksLikeError('Traceback (most recent call last):\n  ...')).toBe(true);
    expect(looksLikeError("TypeError: unsupported operand type(s) for +: 'int' and 'Value'")).toBe(true);
    expect(looksLikeError('Value(data=2.0)')).toBe(false);
  });
});

describe('value_range', () => {
  it('범위 안이면 맞음', () => {
    expect(checkValueRange('14.000300000063248', { min: 13.9, max: 14.1 }).ok).toBe(true);
    expect(checkValueRange('약 -3.0', { min: -3.01, max: -2.99 }).ok).toBe(true);
    expect(checkValueRange('15', { min: 13.9, max: 14.1 }).ok).toBe(false);
  });
  it('숫자가 없으면 no_number', () => {
    expect(checkValueRange('모름', { min: 0, max: 1 }).reason).toBe('no_number');
  });
  it('첫 숫자를 읽는다 (지수 표기 포함)', () => {
    expect(parseFirstNumber('값은 1e-3 입니다')).toBeCloseTo(0.001);
    expect(parseFirstNumber('-0.51')).toBe(-0.51);
    expect(parseFirstNumber('없음')).toBeNull();
  });
});
