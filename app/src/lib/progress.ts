// 진도 기록 도우미. 모든 쓰기는 LocalStore(대기열)를 거친다.

import type { LocalStore, Row } from './sync/store';
import { nowKst, uuid4, weekStartKst, weekStartMs } from './time';
import { ActivityTracker } from './activity';
import { config } from '../config';

// 기록이 아직 없는 단계(status undefined)도 그대로 물어볼 수 있게 undefined 를 받는다
export const STEP_DONE: ReadonlySet<string | undefined> = new Set(['done', 'skipped_optional']);

/** 이번 주 실습 시간: 자동 = study_session(auto) 합, 홈에서 고친 값(user_pref practice_week:{주 시작일}.edited_seconds)이 있으면 그 값 */
export function weeklySeconds(
  sessions: { started_at?: string; active_seconds?: number; source?: string }[],
  userPref: { edited_seconds?: number | null } | null,
  now: number = Date.now(),
): { auto: number; user: number | null; shown: number } {
  const from = weekStartMs(now);
  const to = from + 7 * 86400_000;
  let auto = 0;
  for (const s of sessions) {
    if (s.source && s.source !== 'auto') continue;
    const t = Date.parse(String(s.started_at ?? ''));
    if (Number.isFinite(t) && t >= from && t < to) auto += Number(s.active_seconds ?? 0);
  }
  const user = userPref?.edited_seconds ?? null;
  return { auto, user, shown: user ?? auto };
}

// user_pref 키 (DESIGN.md 12.5: P1은 이 셋만)
export const PREF_RUN_PLACE = 'run_place';
export const PREF_RESUME = 'resume';
export const practicePrefKey = (now: number = Date.now()) => `practice_week:${weekStartKst(now)}`;

/** user_pref.value 는 JSON 값 그대로 (server/API.md: _json 칸은 이름에서 _json 을 떼고 값 그대로) */
export function parsePref<T = any>(row: Row | undefined): T | null {
  if (!row) return null;
  if ('value' in row) return (row.value ?? null) as T | null;
  if (typeof row.value_json === 'string') {
    try {
      return JSON.parse(row.value_json);
    } catch {
      return null;
    }
  }
  return (row.value_json ?? null) as T | null;
}

export async function setPref(store: LocalStore, key: string, value: unknown): Promise<void> {
  await store.put('user_pref', { pref_key: key, value });
}

export async function getPref<T = any>(store: LocalStore, key: string): Promise<T | null> {
  return parsePref<T>(await store.get('user_pref', { pref_key: key }));
}

// 같은 단계 행의 읽고-쓰기가 겹치면(화면을 열자마자 "마치기") 늦게 끝난 쓰기가 앞의 결과를 덮는다.
// 그래서 단계별로 한 줄로 세워 차례로 처리한다.
const stepLocks = new Map<string, Promise<unknown>>();
function withStepLock<T>(stepId: string, fn: () => Promise<T>): Promise<T> {
  const prev = stepLocks.get(stepId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  stepLocks.set(
    stepId,
    run.catch(() => undefined),
  );
  return run;
}

async function ensureRowUnlocked(store: LocalStore, stepId: string, contentVersion: string): Promise<Row> {
  const prev = await store.get('step_progress', { step_id: stepId });
  if (prev) return prev;
  return store.put('step_progress', {
    step_id: stepId,
    status: 'in_progress',
    max_hint_level: 0,
    attempts: 0,
    started_at: nowKst(),
    done_at: null,
    active_seconds_auto: 0,
    active_seconds_user: null,
    prediction: null,
    content_version: contentVersion,
  });
}

/** 단계 행이 없으면 만들고(in_progress), 있으면 그대로 둔다 */
export function ensureStepRow(store: LocalStore, stepId: string, contentVersion: string): Promise<Row> {
  return withStepLock(stepId, () => ensureRowUnlocked(store, stepId, contentVersion));
}

/** 바꿀 칸만 덮어쓴다. changes 가 함수면 지금 행을 보고 바꿀 칸을 정한다(시도 수 +1 등) */
export function patchStep(store: LocalStore, stepId: string, contentVersion: string, changes: Row | ((cur: Row) => Row | null)): Promise<Row> {
  return withStepLock(stepId, async () => {
    const cur = await ensureRowUnlocked(store, stepId, contentVersion);
    const ch = typeof changes === 'function' ? changes(cur) : changes;
    if (!ch) return cur;
    return store.put('step_progress', { ...cur, ...ch, step_id: stepId, content_version: contentVersion });
  });
}

export function markStepDone(store: LocalStore, stepId: string, contentVersion: string): Promise<Row> {
  return patchStep(store, stepId, contentVersion, (cur) => (cur.status === 'done' ? null : { status: 'done', done_at: nowKst() }));
}

/** 단계 화면에서 실습 시간을 세어 step_progress.active_seconds_auto 와 study_session 에 쌓는다 */
export function startStepTimer(store: LocalStore, stepId: string, contentVersion: string): () => void {
  if (typeof window === 'undefined') return () => {};
  const sessionId = uuid4();
  const startedAt = nowKst();
  let queue = Promise.resolve();
  const tracker = new ActivityTracker({
    now: () => Date.now(),
    isVisible: () => document.visibilityState === 'visible',
    idleLimitMs: config.idleLimitMs,
    flushEverySeconds: Math.round(config.activityFlushMs / 1000),
    onFlush: (delta) => {
      queue = queue.then(async () => {
        await patchStep(store, stepId, contentVersion, (cur) => ({ active_seconds_auto: Number(cur.active_seconds_auto ?? 0) + delta }));
        await store.put('study_session', {
          session_id: sessionId,
          target_id: stepId,
          started_at: startedAt,
          ended_at: nowKst(),
          active_seconds: tracker.totalSeconds,
          source: 'auto',
        });
      });
    },
  });
  return tracker.attach(window);
}
