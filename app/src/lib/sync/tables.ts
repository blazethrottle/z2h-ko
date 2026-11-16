// 앱이 동기화하는 표와 각 표의 열쇠(PK에서 user_id를 뺀 칸). DESIGN.md 12.5절 표별 열쇠, server/API.md 3절.
// 쌓이는 기록은 기기가 만든 UUID(attempt_id, note_id, session_id)가 열쇠이고, attempt_no 는 서버가 매긴다.

export const TABLE_KEYS = {
  step_progress: ['step_id'],
  question_attempt: ['question_id', 'attempt_id'],
  grade_result: ['check_id'],
  user_pref: ['pref_key'],
  study_session: ['session_id'],
  help_note: ['note_id'],
  mastery_state: ['target_id'],
  rebuild_attempt: ['rebuild_id', 'attempt_id'],
} as const;

export type TableName = keyof typeof TABLE_KEYS;

/** 서버가 정하는 칸: 이 기기 사본에는 두지만 op.data 로는 보내지 않는다 */
export const SERVER_FIELDS: ReadonlySet<string> = new Set(['user_id', 'updated_at', 'server_seq', 'server_updated_at', 'last_client_id', 'attempt_no']);

export function isTable(t: string): t is TableName {
  return Object.prototype.hasOwnProperty.call(TABLE_KEYS, t);
}

export function keyOf(table: string, data: Record<string, unknown>): Record<string, unknown> {
  if (!isTable(table)) throw new Error(`모르는 표: ${table}`);
  const key: Record<string, unknown> = {};
  for (const k of TABLE_KEYS[table]) {
    const v = data[k];
    if (v === undefined || v === null || v === '') throw new Error(`${table}.${k} 값이 없습니다`);
    key[k] = v;
  }
  return key;
}

export function keyString(table: string, key: Record<string, unknown>): string {
  if (!isTable(table)) throw new Error(`모르는 표: ${table}`);
  return `${table}|${TABLE_KEYS[table].map((k) => String(key[k])).join('|')}`;
}
