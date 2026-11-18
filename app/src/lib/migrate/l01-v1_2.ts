// 옛 1편(1.2판, 26단계) 진도 → 지금 1편(claude-1.0, 58단계). 계획서 PR-10 변환 표(정본 책임자 승인 2026-11-18) + 그 답(새 S13 은 옛 S07 완료로).
// 기록에 판 이름 칸이 없다: 1편 content_version 은 정본 전체 해시(auto-<12자>)라 글자 하나만 고쳐도 바뀐다.
// 그래서 지금 판은 "옛 판이 아닌 것" 전부로 두고(모르는 판은 옮기지도 숨기지도 않음), 옛 판 행은 확실한 증거로만 가린다.
//   (가) content_version 이 git 기록의 1.2판 L01.json 들이 받은 값 중 하나
//   (나) 지금 판이 저장소에 처음 들어온 시각(c8e0ec6) 전에 마친·푼 기록: 그때는 지금 판이 없었다(판 칸이 지금 값으로 덮인 행도 잡힘).
//        단 이 빌드의 판 값(화면이 알려 줌)으로 쓴 기록은 기기 시계가 틀렸을 뿐이라 여기서 빼지 않는다
//   (다) 보관본의 옛 완료 시각을 그대로 가진 완료 행: 서버의 "완료 우선, 완료 시각 유지" 합치기가 옛 완료를 새 판 행에 되살린 것
// 이 파일은 저장하지 않는 순수 함수만. 기기 사본을 읽고 쓰는 쪽은 run.ts.
import type { Row } from '../sync/store';
import { newStepRow } from '../stepRow';

export const LEGACY_L01 = {
  lectureId: 'L01',
  fromVersion: '1.2',
  toVersion: 'claude-1.0',
  /** git 기록의 1.2판 L01.json 두 벌이 빌드에서 받은 content_version (tests/unit/legacyL01.test.ts 가 기록에서 다시 센다) */
  contentVersions: ['auto-e53838ca03f8', 'auto-6256adb2ec11'],
  /** c8e0ec6(지금 판을 넣은 커밋) 시각 */
  cutoff: '2026-11-17T19:14:11+09:00',
  /** 보관본 user_pref 열쇠. 값은 LegacyArchive */
  archiveKey: 'legacy_progress:L01:1.2',
  /** 옮겨 만든 완료 행의 content_version (지금 판 계열이라 옛 행으로 보지 않는다) */
  migratedContentVersion: 'L01-claude-1.0-from-1.2',
};

const CUTOFF_MS = Date.parse(LEGACY_L01.cutoff);

/** 1.2판 단계 26개 */
export const OLD_STEP_IDS = [
  'L01-S01', 'L01-S02', 'L01-S03', 'L01-S04', 'L01-S05', 'L01-S06', 'L01-S07', 'L01-S08', 'L01-S09', 'L01-S09b', 'L01-S10', 'L01-S10b', 'L01-S11',
  'L01-S11b', 'L01-S12', 'L01-S13', 'L01-S13b', 'L01-S13c', 'L01-S13d', 'L01-S13e', 'L01-S14', 'L01-S14b', 'L01-S14c', 'L01-S15', 'L01-S15b', 'L01-S16',
];

/** 표 한 줄: from 이 모두 완료면 to 가 모두 완료 */
export const STEP_MAP: { from: string[]; to: string[] }[] = [
  { from: ['L01-S01'], to: ['L01-S02', 'L01-S03'] },
  { from: ['L01-S02'], to: ['L01-S04'] },
  { from: ['L01-S03'], to: ['L01-S05', 'L01-S06'] },
  { from: ['L01-S04'], to: ['L01-S07', 'L01-S08'] },
  { from: ['L01-S05'], to: ['L01-S09', 'L01-S10', 'L01-S11'] },
  { from: ['L01-S06'], to: ['L01-S14'] },
  // 새 S13 은 계획서 표에서 "옛 단계 없음"이었으나 정본 책임자 답(2026-11-18)대로 옛 S07 에 붙인다
  { from: ['L01-S07'], to: ['L01-S13', 'L01-S15', 'L01-S16', 'L01-S17', 'L01-S18', 'L01-S19'] },
  { from: ['L01-S08'], to: ['L01-S20'] },
  { from: ['L01-S09b'], to: ['L01-S21', 'L01-S22'] },
  { from: ['L01-S09'], to: ['L01-S23', 'L01-S24'] },
  { from: ['L01-S10'], to: ['L01-S27'] },
  { from: ['L01-S10', 'L01-S10b'], to: ['L01-S28'] },
  { from: ['L01-S11'], to: ['L01-S30'] },
  { from: ['L01-S11b'], to: ['L01-S31', 'L01-S32'] },
  { from: ['L01-S12'], to: ['L01-S33', 'L01-S34'] },
  { from: ['L01-S13'], to: ['L01-S35'] },
  { from: ['L01-S13b'], to: ['L01-S36', 'L01-S38'] },
  { from: ['L01-S13c'], to: ['L01-S37'] },
  { from: ['L01-S13d'], to: ['L01-S39'] },
  { from: ['L01-S13e'], to: ['L01-S40', 'L01-S41'] },
  { from: ['L01-S14'], to: ['L01-S42', 'L01-S43'] },
  { from: ['L01-S14b'], to: ['L01-S44'] },
  { from: ['L01-S14c'], to: ['L01-S45', 'L01-S46', 'L01-S50'] },
  { from: ['L01-S15'], to: ['L01-S47', 'L01-S48', 'L01-S49'] },
  { from: ['L01-S15b'], to: ['L01-S51', 'L01-S52'] },
  { from: ['L01-S16'], to: ['L01-S53'] },
];

/** 옛 단계가 없어 늘 미완료로 두는 새 단계 */
export const UNMAPPED_NEW = ['L01-S01', 'L01-S12', 'L01-S25', 'L01-S26', 'L01-S29', 'L01-S54', 'L01-S55', 'L01-S56', 'L01-S57', 'L01-S58'];

/** 보관본(user_pref legacy_progress:L01:1.2 의 값). rows 는 기기 사본의 행 그대로 */
export interface LegacyArchive {
  format: number;
  lecture_id: string;
  from_version: string;
  to_version: string;
  archived_at: string;
  /** 표대로 새 완료를 만든 시각. 있으면 다시 옮기지 않는다 */
  applied_at: string | null;
  rows: { step_progress: Row[]; grade_result: Row[] };
  /**
   * 옛 행 위에서 지금 판 새 행을 한 번 만든 단계. 서버의 "완료 우선, 완료 시각 유지" 합치기가 그 행에 옛 완료(done, 옛 완료 시각)를 되살려 보내도
   * 그 행은 학습자가 지금 판에서 쓴 행이라 다시 새로 만들지 않고 이어 쓴다(예측·시도·시간을 지우지 않음). 화면에는 마치기 전까지 미완료로 보인다
   */
  reset_steps: string[];
}

export interface LegacyIndex {
  archive: LegacyArchive | null;
  /** 보관본의 옛 완료 행: 단계 id → 완료 시각(ms) */
  doneAt: Map<string, number>;
  /** 보관본의 reset_steps */
  resetSteps: Set<string>;
  /** 이 빌드의 content_version(화면이 알려 줌). 이 값으로 쓴 기록은 기기 시계와 상관없이 지금 판이다 */
  current: ReadonlySet<string>;
}

/** 옛 판 행인지 볼 표와 그 표의 열쇠 칸. 다른 표(기초·맛보기·배지 등)는 건드리지 않는다 */
const ID_FIELD: Record<string, string> = { step_progress: 'step_id', question_attempt: 'question_id', rebuild_attempt: 'rebuild_id', grade_result: 'check_id' };
/** 보관본에 복사하는 표: 열쇠가 같으면 뒤 기록이 옛 기록을 덮는 표(쌓이는 기록인 문항·익힘 시도는 덮이지 않아 그대로 남는다) */
type ArchivedTable = 'step_progress' | 'grade_result';
const ARCHIVED_TABLES: ArchivedTable[] = ['step_progress', 'grade_result'];

const isRowList = (v: unknown): v is Row[] => Array.isArray(v) && v.every((x) => !!x && typeof x === 'object' && !Array.isArray(x));

/** user_pref 값 → 보관본. 모양이 다르면 null(옮기지 않음) */
export function readArchive(value: unknown): LegacyArchive | null {
  if (!value || typeof value !== 'object' || !('rows' in value) || !('applied_at' in value) || !('archived_at' in value)) return null;
  const rows = value.rows;
  if (!rows || typeof rows !== 'object' || !('step_progress' in rows) || !isRowList(rows.step_progress)) return null;
  const grades = 'grade_result' in rows && isRowList(rows.grade_result) ? rows.grade_result : [];
  const applied = value.applied_at;
  const reset = 'reset_steps' in value && Array.isArray(value.reset_steps) ? value.reset_steps.filter((x): x is string => typeof x === 'string') : [];
  return {
    format: 1,
    lecture_id: LEGACY_L01.lectureId,
    from_version: LEGACY_L01.fromVersion,
    to_version: LEGACY_L01.toVersion,
    archived_at: String(value.archived_at),
    applied_at: typeof applied === 'string' ? applied : null,
    rows: { step_progress: rows.step_progress, grade_result: grades },
    reset_steps: reset,
  };
}

export function newArchive(now: string): LegacyArchive {
  return {
    format: 1,
    lecture_id: LEGACY_L01.lectureId,
    from_version: LEGACY_L01.fromVersion,
    to_version: LEGACY_L01.toVersion,
    archived_at: now,
    applied_at: null,
    rows: { step_progress: [], grade_result: [] },
    reset_steps: [],
  };
}

export function legacyIndexOf(archive: LegacyArchive | null, current: ReadonlySet<string> = new Set()): LegacyIndex {
  const doneAt = new Map<string, number>();
  for (const r of archive?.rows.step_progress ?? []) {
    const t = Date.parse(String(r.done_at ?? ''));
    if (r.status === 'done' && Number.isFinite(t)) doneAt.set(String(r.step_id), t);
  }
  return { archive, doneAt, resetSteps: new Set(archive?.reset_steps ?? []), current };
}

/** 보관본에 새로 찾은 옛 행만 더하고(이미 있는 행은 그대로), resetStep 이 있으면 "새로 시작함" 표시를 더한다 → 바뀐 수 */
export function mergeArchive(archive: LegacyArchive, found: Partial<Record<ArchivedTable, Row[]>>, resetStep?: string): { archive: LegacyArchive; added: number } {
  let added = 0;
  const rows = { step_progress: [...archive.rows.step_progress], grade_result: [...archive.rows.grade_result] };
  for (const table of ARCHIVED_TABLES) {
    const key = ID_FIELD[table];
    const have = new Set(rows[table].map((r) => String(r[key])));
    for (const r of found[table] ?? []) {
      if (have.has(String(r[key]))) continue;
      rows[table].push(r);
      have.add(String(r[key]));
      added++;
    }
  }
  const reset = resetStep && !archive.reset_steps.includes(resetStep) ? [...archive.reset_steps, resetStep] : archive.reset_steps;
  if (reset !== archive.reset_steps) added++;
  return { archive: { ...archive, rows, reset_steps: reset }, added };
}

/**
 * 그 기록이 옛 1.2판 1편 기록인가 (위 (가)(나)(다)).
 * (다)는 판 값과 상관없이 먼저 본다(되살아난 옛 완료는 이 빌드의 판 값을 달고 온다). (나)는 이 빌드의 판 값으로 쓴 기록에는 쓰지 않는다(기기 시계가 틀린 경우)
 */
export function isLegacyRow(table: string, row: Row, index: LegacyIndex): boolean {
  const field = ID_FIELD[table];
  if (!field) return false;
  const id = String(row[field] ?? '');
  if (!id.startsWith(`${LEGACY_L01.lectureId}-`)) return false;
  const cv = row.content_version;
  if (typeof cv === 'string' && LEGACY_L01.contentVersions.includes(cv)) return true;
  if (cv === LEGACY_L01.migratedContentVersion) return false;
  const when = table === 'step_progress' ? (row.done_at ?? (row.status === 'skipped_optional' ? row.started_at : null)) : row.at;
  const t = Date.parse(String(when ?? ''));
  if (table === 'step_progress' && row.status === 'done' && index.doneAt.get(id) === t) return true;
  if (typeof cv === 'string' && index.current.has(cv)) return false;
  return Number.isFinite(t) && t < CUTOFF_MS;
}

/**
 * 되살아난 행: 앱이 옛 행 위에서 지금 판 새 행을 한 번 만든 단계(reset_steps)의 지금 판 행인데, 서버 합치기로 옛 완료(done, 옛 완료 시각)가 붙어 옛 행으로 보이는 것.
 * 이 행은 학습자가 지금 판에서 쓴 값(예측·시도·시간)을 담고 있어 이어 쓰고, 화면에는 미완료로 보인다. 옛 판 원래 행(옛 판 content_version)은 아니다
 */
export function isRevivedRow(row: Row, index: LegacyIndex): boolean {
  const cv = row.content_version;
  return index.resetSteps.has(String(row.step_id)) && !(typeof cv === 'string' && LEGACY_L01.contentVersions.includes(cv)) && isLegacyRow('step_progress', row, index);
}

/** 화면·점수에 쓰는 모양: 옛 행은 없는 것(null), 되살아난 행은 미완료(완료 시각 없음)로, 나머지는 그대로 */
export function viewRow(table: string, row: Row, index: LegacyIndex): Row | null {
  if (!isLegacyRow(table, row, index)) return row;
  if (table === 'step_progress' && isRevivedRow(row, index)) return { ...row, status: 'in_progress', done_at: null };
  return null;
}

/** 보관본의 옛 완료로 완료가 되는 새 단계(표 순서) */
export function mappedDoneIds(archive: LegacyArchive): string[] {
  const done = new Set(archive.rows.step_progress.filter((r) => r.status === 'done').map((r) => String(r.step_id)));
  const out: string[] = [];
  for (const e of STEP_MAP) if (e.from.every((f) => done.has(f))) for (const t of e.to) if (!out.includes(t)) out.push(t);
  return out;
}

/** 새로 쓸 완료 행. 지금 판으로 이미 마친 단계는 쓰지 않는다. 옛 행 위에는 새 행으로 시작해 완료로 쓰고, 되살아난 행은 이어 써서 완료로 쓴다 */
export function planMigration(archive: LegacyArchive, currentRows: Row[], index: LegacyIndex, now: string): Row[] {
  const out: Row[] = [];
  for (const id of mappedDoneIds(archive)) {
    const cur = currentRows.find((r) => r.step_id === id);
    const view = cur ? viewRow('step_progress', cur, index) : null;
    if (view?.status === 'done') continue;
    const base = cur && view ? cur : newStepRow(id, LEGACY_L01.migratedContentVersion, now);
    out.push({ ...base, step_id: id, status: 'done', done_at: now, content_version: LEGACY_L01.migratedContentVersion });
  }
  return out;
}
