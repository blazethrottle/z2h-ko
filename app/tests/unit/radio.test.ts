// 고르기 문항 화살표 키 (P2 검수 권고: 선택과 함께 포커스도 옮김). 화면 동작은 tests/e2e/radio.spec.ts.
import { describe, expect, it } from 'vitest';
import { nextRadioIndex } from '../../src/lib/radio';

describe('화살표 키로 옮겨 갈 보기', () => {
  it('아래·오른쪽은 다음, 위·왼쪽은 이전, 끝에서 처음으로 돈다', () => {
    expect(nextRadioIndex('ArrowDown', null, 4)).toBe(0);
    expect(nextRadioIndex('ArrowDown', 0, 4)).toBe(1);
    expect(nextRadioIndex('ArrowRight', 3, 4)).toBe(0);
    expect(nextRadioIndex('ArrowUp', 0, 4)).toBe(3);
    expect(nextRadioIndex('ArrowLeft', 2, 4)).toBe(1);
    expect(nextRadioIndex('ArrowUp', null, 4)).toBe(3);
  });
  it('Home·End, 다른 키는 null', () => {
    expect(nextRadioIndex('Home', 2, 4)).toBe(0);
    expect(nextRadioIndex('End', 0, 4)).toBe(3);
    expect(nextRadioIndex('Enter', 0, 4)).toBeNull();
    expect(nextRadioIndex('a', 0, 4)).toBeNull();
    expect(nextRadioIndex('ArrowDown', 0, 0)).toBeNull();
  });
});
