// 옛 1편 진도 옮기기를 기기 사본에서 실행한다(규칙과 표는 l01-v1_2.ts). 동기화가 한 번 끝날 때마다 불린다(runtime.ts).
// 1) 옛 행을 보관본(user_pref legacy_progress:L01:1.2)에 그대로 복사한다(지우지 않음). 2) 서버가 그 보관본을 받은 뒤에만 표대로 새 완료를 쓴다:
//    받기 전(옛 서버라 이 열쇠를 거절하는 등)에 새 완료로 서버의 옛 행을 덮으면 옛 기록이 서버에서 사라지기 때문. 3) 다 쓰면 보관본에 applied_at 을 남겨 다시 옮기지 않는다.
// 화면·점수는 visibleRows 로 옛 판 행을 뺀 행만 본다(hooks.ts useTables). 단계 화면이 옛 행 위에 새 행을 쓸 때도 먼저 보관본에 넣고,
// 그 단계를 "새로 시작함"(reset_steps)으로 표시해, 서버가 옛 완료를 되살려 보내도 다시 새로 만들지 않고 이어 쓴다(progress.ts).
// 보관본은 서버 기록을 실제로 받은 뒤에만 고친다(store.whenServerRead): 받은 보관본에 행 단위로 더해 써야 다른 기기가 넣은 행을 지우지 않는다.
// 첫 받기 상한·오프라인으로 기다림만 풀린 동안에는 (가) 보관할 옛 행과 "새로 시작함" 표시를 이 기기에만 두는 대기함(ui 저장, 새로 고침해도 남음)에 넣고,
// (나) 옛 1편과 번호가 겹치는 단계·채점 기록 가운데 이 기기가 서버 행을 모르는(base 없는) 것은 이 기기에 쓰되 보내지 않는다(waitsForServerRead). 실제로 받으면 그때 받은 서버 행 가운데
// 이 기기의 새 행에 밀려 사본에 못 들어간 옛 행을 먼저 대기함에 저장하고(keepLegacyFromServer), 같은 동기화 안에서 미뤄 둔 기록을 보낸 뒤,
// 동기화가 끝나면(runL01Migration) 대기함을 보관본에 합치고 합친 것만 뺀다. 옛 행은 보내기 전에 이미 대기함에 저장돼 있어 잃지 않는다.
import type { LocalStore, Row } from '../sync/store';
import type { KeptServerRow } from '../sync/manager';
import { nowKst } from '../time';
import { LEGACY_L01, OLD_STEP_IDS, isLegacyRow, legacyIndexOf, mergeArchive, newArchive, planMigration, readArchive, viewRow, type LegacyArchive, type LegacyIndex } from './l01-v1_2';

const ARCHIVE_KEY = { pref_key: LEGACY_L01.archiveKey };
/** 대기함 열쇠(store ui: 동기화하지 않는 이 기기 저장) */
export const HOLD_KEY = `legacy_hold:${LEGACY_L01.lectureId}:${LEGACY_L01.fromVersion}`;
/** 보관본에 복사하는 표(열쇠가 같으면 뒤 기록이 덮는 표) */
type ArchivedTable = 'step_progress' | 'grade_result';
const ID_FIELD: Record<ArchivedTable, string> = { step_progress: 'step_id', grade_result: 'check_id' };

// 이 빌드의 content_version(runtime.ts 가 화면의 meta 에서 읽어 넣는다). 비어 있으면 (나) 규칙을 모든 지금 판 계열 값에 쓴다
let currentVersions: ReadonlySet<string> = new Set();
export function setCurrentContentVersions(versions: Iterable<string>): void {
  currentVersions = new Set(versions);
}

export async function legacyIndex(store: LocalStore): Promise<LegacyIndex> {
  return legacyIndexOf(readArchive((await store.get('user_pref', ARCHIVE_KEY))?.value), currentVersions);
}

/** 화면·점수에 쓰는 행: 옛 1.2판 1편 행은 빼고, 되살아난 행은 미완료로(다른 표와 다른 편은 그대로) */
export function visibleRows(table: string, rows: Row[], index: LegacyIndex): Row[] {
  return rows.flatMap((r) => viewRow(table, r, index) ?? []);
}

/** 실제로 받기 전에는 보내지 않을 기록: 옛 1편과 번호가 겹치는 단계 행·1편 채점 결과(서버의 옛 행을 모른 채 덮지 않게). store.holdBeforeRead 에 넣는다 */
export function waitsForServerRead(table: string, key: Record<string, unknown>): boolean {
  if (table === 'step_progress') return OLD_STEP_IDS.includes(String(key.step_id));
  return table === 'grade_result' && String(key.check_id).startsWith(`${LEGACY_L01.lectureId}-`);
}

// 보관본 읽고-고치고-쓰기는 한 줄로 세운다: 옮기기(applied_at)와 단계 화면(새로 시작함 표시)이 동시에 쓰면 늦게 쓴 쪽이 앞의 것을 지운다.
// 실제 받기는 줄에 서기 전에 기다린다(받지 못한 사본 하나가 줄 전체를 막지 않게)
let archiveQueue: Promise<unknown> = Promise.resolve();
async function updateArchive<T>(store: LocalStore, now: () => string, fn: (cur: LegacyArchive) => { next: LegacyArchive | null; result: T }): Promise<T> {
  await store.whenServerRead();
  const run = archiveQueue.then(async () => {
    const { next, result } = fn((await legacyIndex(store)).archive ?? newArchive(now()));
    if (next) await store.put('user_pref', { ...ARCHIVE_KEY, value: next });
    return result;
  });
  archiveQueue = run.catch(() => undefined);
  return run;
}

/** 대기함: 실제로 받기 전에 찾은 옛 행과 "새로 시작함" 표시. 보관본과 같은 모양의 일부 */
interface LegacyHold {
  rows: { step_progress: Row[]; grade_result: Row[] };
  reset_steps: string[];
}
const emptyHold = (): LegacyHold => ({ rows: { step_progress: [], grade_result: [] }, reset_steps: [] });
// 대기함 읽고-고치고-쓰기도 한 줄로(실제 받기를 기다리지 않는다)
let holdQueue: Promise<unknown> = Promise.resolve();
function inHoldQueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = holdQueue.then(fn);
  holdQueue = run.catch(() => undefined);
  return run;
}

/** 옛 행과 "새로 시작함" 표시를 대기함에 더한다(이미 있는 행은 그대로). 실제로 받은 뒤 보관본에 합친다 */
function holdLegacy(store: LocalStore, found: Partial<Record<ArchivedTable, Row[]>>, resetSteps: string[] = []): Promise<void> {
  return inHoldQueue(async () => {
    await store.updateUi<LegacyHold>(HOLD_KEY, (stored) => {
      const cur = stored ?? emptyHold();
      const next: LegacyHold = { rows: { step_progress: [...cur.rows.step_progress], grade_result: [...cur.rows.grade_result] }, reset_steps: [...cur.reset_steps] };
      for (const table of ['step_progress', 'grade_result'] as const) {
        const have = new Set(next.rows[table].map((r) => String(r[ID_FIELD[table]])));
        for (const r of found[table] ?? []) if (!have.has(String(r[ID_FIELD[table]]))) next.rows[table].push(r);
      }
      for (const id of resetSteps) if (!next.reset_steps.includes(id)) next.reset_steps.push(id);
      return next;
    });
  });
}

/** 실제로 받은 뒤 대기함을 보관본에 합치고 비운다 → 보관본에 새로 들어간 수 */
export async function flushLegacyHold(store: LocalStore, now: () => string = nowKst): Promise<number> {
  await store.whenServerRead();
  return inHoldQueue(async () => {
    const hold = await store.getUi<LegacyHold>(HOLD_KEY);
    if (!hold || (!hold.rows.step_progress.length && !hold.rows.grade_result.length && !hold.reset_steps.length)) return 0;
    const added = await updateArchive(store, now, (cur) => {
      let acc = mergeArchive(cur, hold.rows);
      let n = acc.added;
      for (const id of hold.reset_steps) {
        acc = mergeArchive(acc.archive, {}, id);
        n += acc.added;
      }
      return { next: n ? acc.archive : null, result: n };
    });
    // 합친 것만 뺀다: 그 사이 다른 탭이 더한 옛 행·표시는 남아 다음에 합친다
    await store.updateUi<LegacyHold>(HOLD_KEY, (stored) => {
      const cur = stored ?? emptyHold();
      const merged = (table: ArchivedTable) => new Set(hold.rows[table].map((r) => String(r[ID_FIELD[table]])));
      const sp = merged('step_progress');
      const gr = merged('grade_result');
      return {
        rows: {
          step_progress: cur.rows.step_progress.filter((r) => !sp.has(String(r.step_id))),
          grade_result: cur.rows.grade_result.filter((r) => !gr.has(String(r.check_id))),
        },
        reset_steps: cur.reset_steps.filter((id) => !hold.reset_steps.includes(id)),
      };
    });
    return added;
  });
}

/**
 * 받기에서 이 기기의 못 보낸 변경에 밀려 사본에 못 들어간 서버 행 가운데 옛 판 행을 대기함에 넣는다(SyncManager onKeptServerRows).
 * 이 기기 새 행이 덮은 단계는 "새로 시작함"으로 표시해, 서버가 옛 완료를 되살려 보내도 미완료로 이어 쓴다
 */
export async function keepLegacyFromServer(store: LocalStore, kept: KeptServerRow[]): Promise<void> {
  const index = await legacyIndex(store);
  const found: { step_progress: Row[]; grade_result: Row[] } = { step_progress: [], grade_result: [] };
  const resets: string[] = [];
  for (const { table, row } of kept) {
    if (table !== 'step_progress' && table !== 'grade_result') continue;
    if (!isLegacyRow(table, row, index)) continue;
    found[table].push(row);
    if (table !== 'step_progress') continue;
    const mine = await store.get('step_progress', { step_id: row.step_id });
    if (mine && !isLegacyRow('step_progress', mine, index)) resets.push(String(row.step_id));
  }
  if (found.step_progress.length || found.grade_result.length) await holdLegacy(store, found, resets);
}

/** 옛 행을 보관본에 더한다(이미 있는 행은 그대로). resetStep: 그 단계에서 지금 판 새 행을 만든다는 표시 → 바뀐 수 */
export function keepLegacyRows(store: LocalStore, found: Partial<Record<ArchivedTable, Row[]>>, now: () => string = nowKst, resetStep?: string): Promise<number> {
  return updateArchive(store, now, (cur) => {
    const { archive, added } = mergeArchive(cur, found, resetStep);
    return { next: added ? archive : null, result: added };
  });
}

/** 같은 열쇠로 쓰기 전에(결과코드 붙여넣기 등) 덮일 옛 행을 보관본에 넣는다. 실제로 받기 전이면 대기함에 넣고 기다리지 않는다 */
export async function keepLegacyBeforeWrite(store: LocalStore, table: ArchivedTable, rows: Row[]): Promise<number> {
  await store.whenPulled();
  const index = await legacyIndex(store);
  const found: Row[] = [];
  for (const r of rows) {
    const cur = await store.get(table, { [ID_FIELD[table]]: r[ID_FIELD[table]] });
    if (cur && isLegacyRow(table, cur, index)) found.push(cur);
  }
  if (!found.length) return 0;
  const byTable = table === 'step_progress' ? { step_progress: found } : { grade_result: found };
  if (!store.serverRead) {
    await holdLegacy(store, byTable);
    return found.length;
  }
  return keepLegacyRows(store, byTable);
}

/** 단계 화면이 옛 행 위에 새 행을 쓰기 전에: 옛 행을 보관본에(실제로 받기 전이면 대기함에) 넣고 그 단계를 "새로 시작함"으로 */
export function keepLegacyStepRow(store: LocalStore, old: Row, stepId: string): Promise<unknown> {
  return store.serverRead ? keepLegacyRows(store, { step_progress: [old] }, nowKst, stepId) : holdLegacy(store, { step_progress: [old] }, [stepId]);
}

/**
 * 동기화를 시작하기 전에 이 기기 사본의 옛 행(옛 앱이 보내지 못한 변경 포함)을 대기함에 넣어 둔다. 돌려준 함수는 실제로 받은 뒤 대기함을 보관본에 합친다:
 * 그 변경이 서버에서 더 새 값에 밀리면 받기가 사본을 덮어 사라지기 때문
 */
export async function holdLocalLegacy(store: LocalStore): Promise<() => Promise<number>> {
  const index = await legacyIndex(store);
  const found = {
    step_progress: (await store.list('step_progress')).filter((r) => isLegacyRow('step_progress', r, index)),
    grade_result: (await store.list('grade_result')).filter((r) => isLegacyRow('grade_result', r, index)),
  };
  if (found.step_progress.length || found.grade_result.length) await holdLegacy(store, found);
  return () => flushLegacyHold(store);
}

let running: Promise<unknown> = Promise.resolve();

/** 실제로 받은 뒤, 한 번에 하나씩(동기화가 연달아 끝나도 겹치지 않게). 두 번 돌려도 같다 */
export async function runL01Migration(store: LocalStore, now: () => string = nowKst): Promise<{ archived: number; written: string[] }> {
  await store.whenServerRead();
  const run = running.then(() => migrateOnce(store, now));
  running = run.catch(() => undefined);
  return run;
}

async function migrateOnce(store: LocalStore, now: () => string): Promise<{ archived: number; written: string[] }> {
  const fromHold = await flushLegacyHold(store, now);
  const steps = await store.list('step_progress');
  const grades = await store.list('grade_result');
  const before = await legacyIndex(store);
  const found = {
    step_progress: steps.filter((r) => isLegacyRow('step_progress', r, before)),
    grade_result: grades.filter((r) => isLegacyRow('grade_result', r, before)),
  };
  const archived = fromHold + (found.step_progress.length || found.grade_result.length ? await keepLegacyRows(store, found, now) : 0);
  const index = await legacyIndex(store);
  const archive = index.archive;
  if (!archive || archive.applied_at) return { archived, written: [] };
  if (!(await store.serverHas('user_pref', ARCHIVE_KEY))) return { archived, written: [] };
  const at = now();
  const writes = planMigration(archive, steps, index, at);
  for (const w of writes) await store.put('step_progress', w);
  await updateArchive(store, now, (cur) => ({ next: cur.applied_at ? null : { ...cur, applied_at: at }, result: undefined }));
  return { archived, written: writes.map((w) => String(w.step_id)) };
}
