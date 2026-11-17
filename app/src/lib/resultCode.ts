// 결과코드 Z2H1.{base64url(JSON), 패딩 없음}.{crc32 8자리 16진수} (DESIGN.md 12.7절, server/API.md 4절).
// 비밀값이 아니고 위조를 막지 않는다. crc32는 가운데 base64url 글자의 UTF-8 바이트로 계산하며 오타·잘림을 잡는 용도.
// JSON: {"v":1,"l":"L01","p":[통과 check_id],"f":[실패 check_id],"t":"ISO+09:00"} 한 가지만 받는다.
// p·f 에 없는 check_id 는 "아직 안 함/건너뜀". message_ko 는 결과코드에 없다(로컬 Jupyter 의 /api/grade 본문에만).

export const RESULT_CODE_ERROR = '코드가 잘렸거나 글자가 바뀌었습니다';

let TABLE: Uint32Array | null = null;
function table(): Uint32Array {
  if (TABLE) return TABLE;
  TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    TABLE[n] = c >>> 0;
  }
  return TABLE;
}

export function crc32(bytes: Uint8Array): number {
  const t = table();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const hex8 = (n: number) => n.toString(16).padStart(8, '0');

function b64urlToBytes(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface ResultItem {
  check_id: string;
  passed: boolean;
  message_ko: string;
}

export interface ResultPayload {
  v: number;
  lecture_id: string;
  at: string;
  /** 코드 끝의 crc32 8자리 (같은 코드를 두 번 붙여 넣었는지 알아보는 데 쓴다) */
  crc: string;
  results: ResultItem[];
}

export type DecodeResult = { ok: true; data: ResultPayload } | { ok: false; error_ko: string };

export function decodeResultCode(input: string): DecodeResult {
  const fail = { ok: false as const, error_ko: RESULT_CODE_ERROR };
  const code = String(input ?? '').replace(/\s+/g, '');
  const parts = code.split('.');
  if (parts.length !== 3 || parts[0] !== 'Z2H1' || !/^[0-9a-fA-F]{8}$/.test(parts[2])) return fail;
  const [, body, crc] = parts;
  const bytes = b64urlToBytes(body);
  if (!bytes) return fail;
  if (hex8(crc32(new TextEncoder().encode(body))) !== crc.toLowerCase()) return fail;
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return fail;
  }
  if (!raw || typeof raw !== 'object') return fail;
  const obj = raw as Record<string, unknown>;
  if (obj.v !== 1 || typeof obj.l !== 'string' || typeof obj.t !== 'string' || !Array.isArray(obj.p) || !Array.isArray(obj.f)) return fail;
  if (![...obj.p, ...obj.f].every((x) => typeof x === 'string' && x)) return fail;
  const results: ResultItem[] = [
    ...(obj.p as string[]).map((id) => ({ check_id: id, passed: true, message_ko: '' })),
    ...(obj.f as string[]).map((id) => ({ check_id: id, passed: false, message_ko: '' })),
  ];
  return { ok: true, data: { v: 1, lecture_id: obj.l, at: obj.t, crc: crc.toLowerCase(), results } };
}

/** 테스트용 인코더 (z2h_check.finish 와 같은 규칙) */
export function encodeResultCodeForTest(payload: unknown): string {
  const body = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  return `Z2H1.${body}.${hex8(crc32(new TextEncoder().encode(body)))}`;
}

/** 결과코드 → 저장할 행. 재구성 조각(정본 rebuild_tasks 의 id)은 rebuild_attempt 행도 만든다 */
export function resultCodeToRows(
  data: ResultPayload,
  now: string,
  hintLevelOf: (id: string) => number,
  rebuildIds: readonly string[],
): {
  grade: { check_id: string; passed: boolean; message_ko: string; source: 'result_code'; at: string }[];
  rebuild: { rebuild_id: string; attempt_id: string; passed: boolean; max_hint_level: number; at: string }[];
} {
  const at = data.at || now;
  const grade = data.results.map((r) => ({ check_id: r.check_id, passed: r.passed, message_ko: r.message_ko, source: 'result_code' as const, at }));
  const rebuild = data.results
    .filter((r) => rebuildIds.includes(r.check_id))
    // attempt_id 를 결과코드에서 정해지는 값으로: 같은 코드를 두 번 붙여 넣어도 시도는 하나 (server/API.md 권장 모양)
    .map((r) => ({ rebuild_id: r.check_id, attempt_id: `rc-${data.crc}-${r.check_id}`, passed: r.passed, max_hint_level: hintLevelOf(r.check_id), at }));
  return { grade, rebuild };
}

/**
 * 한 번 통과한 칸은 나중 결과코드의 다시(f)로 덮지 않는다. 완성한 노트북을 처음부터 다시 돌리면 뒤 단계가 고친 앞 셀 때문에
 * 앞 단계 칸(S12, S30, S52 등)이 f 가 될 수 있어서다(p7-notebook 실측). 덮지 않은 칸은 keptPass 로 알려 화면에 한 줄 남긴다.
 */
export function keepPasses<T extends { check_id: string; passed: boolean }>(rows: T[], existing: readonly { check_id?: unknown; passed?: unknown }[]): { rows: T[]; keptPass: string[] } {
  const passed = new Set(existing.filter((e) => e.passed === true).map((e) => String(e.check_id)));
  const keptPass = rows.filter((r) => !r.passed && passed.has(r.check_id)).map((r) => r.check_id);
  return { rows: rows.filter((r) => !keptPass.includes(r.check_id)), keptPass };
}
