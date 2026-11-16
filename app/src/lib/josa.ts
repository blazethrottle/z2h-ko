// 숫자 뒤 조사 (한국어 읽기: 일 이 삼 사 오 육 칠 팔 구, 0으로 끝나면 십·백·영)
export function numEulReul(n: number): string {
  return [2, 4, 5, 9].includes(Math.abs(n) % 10) ? '를' : '을';
}
export function numRo(n: number): string {
  return [0, 3, 6].includes(Math.abs(n) % 10) ? '으로' : '로';
}
