// 시각은 모두 +09:00(KST) 문자열 (data-spec 검수 규칙 5).

const KST_MS = 9 * 3600_000;

/** 2026-11-16T20:01:00.123+09:00 */
export function toKstIso(d: Date | number = Date.now()): string {
  const ms = typeof d === 'number' ? d : d.getTime();
  return new Date(ms + KST_MS).toISOString().replace('Z', '+09:00');
}

export const nowKst = () => toKstIso(Date.now());

/** KST 기준 그 주 월요일 날짜 'YYYY-MM-DD' */
export function weekStartKst(d: Date | number = Date.now()): string {
  const ms = typeof d === 'number' ? d : d.getTime();
  const k = new Date(ms + KST_MS);
  const dow = (k.getUTCDay() + 6) % 7; // 월=0
  const mon = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - dow));
  return mon.toISOString().slice(0, 10);
}

/** KST 주 시작 시각(ms) */
export function weekStartMs(d: Date | number = Date.now()): number {
  return Date.parse(`${weekStartKst(d)}T00:00:00+09:00`);
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
/** "11월 16일 (월)" */
export function formatDateKo(d: Date | number = Date.now()): string {
  const ms = typeof d === 'number' ? d : d.getTime();
  const k = new Date(ms + KST_MS);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 (${DOW[k.getUTCDay()]})`;
}

/** 초 → "2:25" (시:분) */
export function formatHM(totalS: number | null | undefined): string {
  if (totalS == null || !Number.isFinite(totalS)) return '–';
  const m = Math.floor(Math.max(0, totalS) / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

export function uuid4(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
