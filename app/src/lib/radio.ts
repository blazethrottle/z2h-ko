// 고르기 문항(role="radiogroup") 화살표 키: 선택과 함께 포커스도 옮긴다(WAI-ARIA radio group 패턴, P2 검수 권고).
// 아래·오른쪽 = 다음, 위·왼쪽 = 이전(끝에서 처음으로 돈다). Home·End = 처음·끝.

/** 누른 키로 옮겨 갈 보기 번호. 화살표·Home·End 가 아니면 null */
export function nextRadioIndex(key: string, current: number | null, count: number): number | null {
  if (count <= 0) return null;
  if (key === 'ArrowDown' || key === 'ArrowRight') return ((current ?? -1) + 1) % count;
  if (key === 'ArrowUp' || key === 'ArrowLeft') return ((current ?? 0) - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/** keydown 처리: 선택(select)을 바꾸고 같은 묶음의 그 보기 버튼으로 포커스를 옮긴다. 처리했으면 true */
export function handleRadioKey(e: KeyboardEvent, current: number | null, count: number, select: (i: number) => void): boolean {
  const n = nextRadioIndex(e.key, current, count);
  if (n == null) return false;
  e.preventDefault();
  select(n);
  const group = (e.currentTarget as HTMLElement | null)?.closest('[role="radiogroup"]');
  const target = group?.querySelectorAll<HTMLElement>('[role="radio"]')[n];
  target?.focus();
  return true;
}
