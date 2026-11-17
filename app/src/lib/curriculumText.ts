// 설계서 값(content/lectures.yaml = docs/CURRICULUM.md 에서 옮김)을 화면 글로 바꾸는 한 곳. 랜딩·홈·준비 중 편 안내가 같이 쓴다.

/** 편 범위 "01~03편" */
export function checkpointRangeKo(covers: readonly string[]): string {
  if (!covers.length) return '';
  return `${covers[0].slice(1)}~${covers[covers.length - 1].slice(1)}편`;
}

/** 누적 점검 머리 "누적 점검 1 (01~03편, 9문항)" */
export function checkpointHeadKo(cp: { checkpoint_id: string; covers: readonly string[]; question_count: number }): string {
  return `누적 점검 ${cp.checkpoint_id.slice(2)} (${checkpointRangeKo(cp.covers)}, ${cp.question_count}문항)`;
}

/** 설계서의 예상 분(추정 공식, 실측 아님)을 시간으로: 반올림, 최소 1시간, "추정" 표시 */
export function estimateHoursKo(minutes: number): string {
  return `약 ${Math.max(1, Math.round(minutes / 60))}시간(추정)`;
}
