// 옛 1편 진도 옮기기를 기기 사본에서 실행한다(규칙과 표는 l01-v1_2.ts). 동기화가 한 번 끝날 때마다 불린다(runtime.ts).
// 1) 옛 행을 보관본(user_pref legacy_progress:L01:1.2)에 그대로 복사한다(지우지 않음). 2) 서버가 그 보관본을 받은 뒤에만 표대로 새 완료를 쓴다:
//    받기 전(옛 서버라 이 열쇠를 거절하는 등)에 새 완료로 서버의 옛 행을 덮으면 옛 기록이 서버에서 사라지기 때문. 3) 다 쓰면 보관본에 applied_at 을 남겨 다시 옮기지 않는다.
// 화면·점수는 visibleRows 로 옛 판 행을 뺀 행만 본다(hooks.ts useTables). 단계 화면이 옛 행 위에 새 행을 쓸 때도 먼저 보관본에 넣고,
// 그 단계를 "새로 시작함"(reset_steps)으로 표시해, 서버가 옛 완료를 되살려 보내도 다시 새로 만들지 않고 이어 쓴다(progress.ts).
// 보관본은 서버 기록을 처음 받은 뒤에만 고친다: 받은 보관본에 행 단위로 더해 써야 다른 기기가 넣은 행을 지우지 않는다.
import type { LocalStore, Row } from '../sync/store';
import { nowKst } from '../time';
import { LEGACY_L01, isLegacyRow, legacyIndexOf, mergeArchive, newArchive, planMigration, readArchive, viewRow, type LegacyArchive, type LegacyIndex } from './l01-v1_2';

const ARCHIVE_KEY = { pref_key: LEGACY_L01.archiveKey };
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

// 보관본 읽고-고치고-쓰기는 한 줄로 세운다: 옮기기(applied_at)와 단계 화면(새로 시작함 표시)이 동시에 쓰면 늦게 쓴 쪽이 앞의 것을 지운다
let archiveQueue: Promise<unknown> = Promise.resolve();
function updateArchive<T>(store: LocalStore, now: () => string, fn: (cur: LegacyArchive) => { next: LegacyArchive | null; result: T }): Promise<T> {
  const run = archiveQueue.then(async () => {
    await store.whenPulled();
    const { next, result } = fn((await legacyIndex(store)).archive ?? newArchive(now()));
    if (next) await store.put('user_pref', { ...ARCHIVE_KEY, value: next });
    return result;
  });
  archiveQueue = run.catch(() => undefined);
  return run;
}

/** 옛 행을 보관본에 더한다(이미 있는 행은 그대로). resetStep: 그 단계에서 지금 판 새 행을 만든다는 표시 → 바뀐 수 */
export function keepLegacyRows(store: LocalStore, found: Partial<Record<ArchivedTable, Row[]>>, now: () => string = nowKst, resetStep?: string): Promise<number> {
  return updateArchive(store, now, (cur) => {
    const { archive, added } = mergeArchive(cur, found, resetStep);
    return { next: added ? archive : null, result: added };
  });
}

/** 같은 열쇠로 쓰기 전에(결과코드 붙여넣기 등) 덮일 옛 행을 보관본에 넣는다 */
export async function keepLegacyBeforeWrite(store: LocalStore, table: ArchivedTable, rows: Row[]): Promise<number> {
  await store.whenPulled();
  const index = await legacyIndex(store);
  const found: Row[] = [];
  for (const r of rows) {
    const cur = await store.get(table, { [ID_FIELD[table]]: r[ID_FIELD[table]] });
    if (cur && isLegacyRow(table, cur, index)) found.push(cur);
  }
  if (!found.length) return 0;
  return keepLegacyRows(store, table === 'step_progress' ? { step_progress: found } : { grade_result: found });
}

/**
 * 동기화를 시작하기 전에 이 기기 사본의 옛 행(옛 앱이 보내지 못한 변경 포함)을 읽어 둔다. 돌려준 함수는 첫 받기 뒤 그 행을 보관본에 넣는다:
 * 그 변경이 서버에서 더 새 값에 밀리면 받기가 사본을 덮어 사라지기 때문
 */
export async function holdLocalLegacy(store: LocalStore): Promise<() => Promise<number>> {
  const index = await legacyIndex(store);
  const found = {
    step_progress: (await store.list('step_progress')).filter((r) => isLegacyRow('step_progress', r, index)),
    grade_result: (await store.list('grade_result')).filter((r) => isLegacyRow('grade_result', r, index)),
  };
  return () => (found.step_progress.length || found.grade_result.length ? keepLegacyRows(store, found) : Promise.resolve(0));
}

let running: Promise<unknown> = Promise.resolve();

/** 한 번에 하나씩(동기화가 연달아 끝나도 겹치지 않게). 두 번 돌려도 같다 */
export function runL01Migration(store: LocalStore, now: () => string = nowKst): Promise<{ archived: number; written: string[] }> {
  const run = running.then(() => migrateOnce(store, now));
  running = run.catch(() => undefined);
  return run;
}

async function migrateOnce(store: LocalStore, now: () => string): Promise<{ archived: number; written: string[] }> {
  const steps = await store.list('step_progress');
  const grades = await store.list('grade_result');
  const before = await legacyIndex(store);
  const found = {
    step_progress: steps.filter((r) => isLegacyRow('step_progress', r, before)),
    grade_result: grades.filter((r) => isLegacyRow('grade_result', r, before)),
  };
  const archived = found.step_progress.length || found.grade_result.length ? await keepLegacyRows(store, found, now) : 0;
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
