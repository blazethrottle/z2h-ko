// 옛 1편(1.2판, 26단계) 진도 옮기기 (계획서 PR-10, 교사 승인 2026-11-18). 옛 행은 지우지 않고 user_pref legacy_progress:L01:1.2 에 보관하고,
// 새 단계(claude-1.0)는 걸린 옛 단계가 모두 완료일 때만 완료로 만든다. 확인 문제·익힘 기록은 옮기지 않고 옛 판 행은 화면·점수에서 뺀다. 기초(F)는 옮기지 않는다.
// 표는 아래 EXPECTED 에 따로 적어(계획서 56~86행 + 교사 답: 새 S13 은 옛 S07) 앱의 표와 맞는지 본다.
import 'fake-indexeddb/auto';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalStore, type Row } from '../../src/lib/sync/store';
import { ensureStepRow, markStepDone, patchStep } from '../../src/lib/progress';
import { LEGACY_L01, OLD_STEP_IDS, STEP_MAP, UNMAPPED_NEW, isLegacyRow, mappedDoneIds, newArchive, planMigration, readArchive, viewRow, type LegacyArchive, type LegacyIndex } from '../../src/lib/migrate/l01-v1_2';
import { holdLocalLegacy, keepLegacyBeforeWrite, keepLegacyRows, legacyIndex, runL01Migration, visibleRows } from '../../src/lib/migrate/run';
import { unitMastery, type BasicsRule, type UnitMasteryRef } from '../../src/lib/basics';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';

const S = (n: string) => `L01-S${n}`;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => S(String(a + i).padStart(2, '0')));
/** 계획서 PR-10 변환 표(교사 승인) + 교사 답 "새 S13 은 옛 S07 완료로" */
const EXPECTED: { from: string[]; to: string[] }[] = [
  { from: [S('01')], to: [S('02'), S('03')] },
  { from: [S('02')], to: [S('04')] },
  { from: [S('03')], to: [S('05'), S('06')] },
  { from: [S('04')], to: [S('07'), S('08')] },
  { from: [S('05')], to: [S('09'), S('10'), S('11')] },
  { from: [S('06')], to: [S('14')] },
  { from: [S('07')], to: [S('13'), ...range(15, 19)] },
  { from: [S('08')], to: [S('20')] },
  { from: [S('09b')], to: [S('21'), S('22')] },
  { from: [S('09')], to: [S('23'), S('24')] },
  { from: [S('10')], to: [S('27')] },
  { from: [S('10'), S('10b')], to: [S('28')] },
  { from: [S('11')], to: [S('30')] },
  { from: [S('11b')], to: [S('31'), S('32')] },
  { from: [S('12')], to: [S('33'), S('34')] },
  { from: [S('13')], to: [S('35')] },
  { from: [S('13b')], to: [S('36'), S('38')] },
  { from: [S('13c')], to: [S('37')] },
  { from: [S('13d')], to: [S('39')] },
  { from: [S('13e')], to: [S('40'), S('41')] },
  { from: [S('14')], to: [S('42'), S('43')] },
  { from: [S('14b')], to: [S('44')] },
  { from: [S('14c')], to: [S('45'), S('46'), S('50')] },
  { from: [S('15')], to: [S('47'), S('48'), S('49')] },
  { from: [S('15b')], to: [S('51'), S('52')] },
  { from: [S('16')], to: [S('53')] },
];
const EXPECTED_UNMAPPED = [S('01'), S('12'), S('25'), S('26'), S('29'), ...range(54, 58)];

const OLD_CV = LEGACY_L01.contentVersions[1];
/** c8e0ec6 빌드(지금 판 계열)가 쓴 content_version */
const NOW_CV = 'auto-a7c826f27328';
/** 이 빌드의 1편 content_version 이라고 치는 값(화면이 meta 로 알려 줌) */
const BUILD_CV = 'auto-0000000000bb';
const OLD_AT = '2026-11-17T10:00:00+09:00';
const NEW_AT = '2026-11-18T09:00:00+09:00';
/** 서버에서 받은 옛 1.2판 단계 행 */
const oldRow = (id: string, status = 'done', extra: Row = {}): Row => ({
  step_id: id,
  status,
  max_hint_level: 1,
  attempts: 2,
  started_at: '2026-11-17T09:00:00+09:00',
  done_at: status === 'done' ? OLD_AT : null,
  active_seconds_auto: 120,
  active_seconds_user: null,
  prediction: '옛 예측',
  content_version: OLD_CV,
  updated_at: OLD_AT,
  server_seq: 1,
  ...extra,
});
const archiveOf = (rows: Row[]): LegacyArchive => ({ ...newArchive(NEW_AT), rows: { step_progress: rows, grade_result: [] } });
/** 보관본이 없는 기기의 색인 */
const noIndex = (): LegacyIndex => ({ archive: null, doneAt: new Map(), resetSteps: new Set(), current: new Set() });
const sorted = (xs: Iterable<string>) => [...xs].sort();

describe('변환 표 (모든 행 고정)', () => {
  it('앱의 표가 계획서 표 + 교사 답과 같다', () => {
    expect(STEP_MAP).toEqual(EXPECTED);
    expect(sorted(UNMAPPED_NEW)).toEqual(sorted(EXPECTED_UNMAPPED));
  });
  for (const row of EXPECTED) {
    it(`${row.from.join(' + ')} 만 완료 → ${row.to.join(', ')} 완료(다른 단계는 미완료)`, () => {
      const want = new Set(EXPECTED.filter((e) => e.from.every((f) => row.from.includes(f))).flatMap((e) => e.to));
      expect(sorted(mappedDoneIds(archiveOf(row.from.map((id) => oldRow(id)))))).toEqual(sorted(want));
    });
  }
  it('부분 완료면 미완료: 옛 S10b 만 완료면 새 S28 은 미완료, S10 만 완료면 S27 만', () => {
    expect(mappedDoneIds(archiveOf([oldRow(S('10b'))]))).toEqual([]);
    expect(mappedDoneIds(archiveOf([oldRow(S('10'))]))).toEqual([S('27')]);
    expect(sorted(mappedDoneIds(archiveOf([oldRow(S('10')), oldRow(S('10b'))])))).toEqual([S('27'), S('28')]);
  });
  it('옛 단계가 진행 중이거나 선택 건너뜀이면 완료로 치지 않는다', () => {
    expect(mappedDoneIds(archiveOf([oldRow(S('01'), 'in_progress'), oldRow(S('02'), 'skipped_optional')]))).toEqual([]);
  });
  it('옛 단계를 모두 마쳤어도 S01, S12, S25, S26, S29, S54~S58 은 미완료', () => {
    const all = mappedDoneIds(archiveOf(OLD_STEP_IDS.map((id) => oldRow(id))));
    for (const id of EXPECTED_UNMAPPED) expect(all, id).not.toContain(id);
    expect(all).toHaveLength(58 - EXPECTED_UNMAPPED.length);
  });
  it('표가 옛 26단계와 새 58단계를 빠짐없이 덮는다(정본·git 기록에서 읽음)', () => {
    const old = JSON.parse(execFileSync('git', ['-C', REPO_ROOT, 'show', '4c84f4d:inputs/pedagogy/content/L01.json'], { encoding: 'utf8', maxBuffer: 64 << 20 }));
    const cur = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/L01.json'), 'utf8'));
    expect(old._meta.version).toBe(LEGACY_L01.fromVersion);
    expect(cur._meta.version).toBe(LEGACY_L01.toVersion);
    expect(sorted(OLD_STEP_IDS)).toEqual(sorted(old.steps.map((s: { step_id: string }) => s.step_id)));
    const newIds: string[] = cur.steps.map((s: { step_id: string }) => s.step_id);
    for (const e of STEP_MAP) {
      for (const f of e.from) expect(OLD_STEP_IDS, f).toContain(f);
      for (const t of e.to) expect(newIds, t).toContain(t);
    }
    for (const id of OLD_STEP_IDS) expect(STEP_MAP.some((e) => e.from.includes(id)), id).toBe(true);
    for (const id of newIds) expect(STEP_MAP.some((e) => e.to.includes(id)) !== UNMAPPED_NEW.includes(id), id).toBe(true);
  });
  it('옛 판 content_version 목록은 git 기록의 1.2판 L01.json 들이 빌드에서 받은 값(auto-<해시>) 그대로, 지금 판은 들어 있지 않다', () => {
    const log = execFileSync('git', ['-C', REPO_ROOT, 'log', '--all', '--format=%H', '--', 'inputs/pedagogy/content/L01.json'], { encoding: 'utf8' }).trim().split('\n');
    const v12 = new Set<string>();
    for (const h of log) {
      let text: string;
      try {
        text = execFileSync('git', ['-C', REPO_ROOT, 'show', `${h}:inputs/pedagogy/content/L01.json`], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
      } catch {
        continue; // 그 커밋에서 지운 경우
      }
      const d = JSON.parse(text);
      if (d._meta?.version === LEGACY_L01.fromVersion) v12.add(`auto-${crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex').slice(0, 12)}`);
    }
    expect(sorted(LEGACY_L01.contentVersions)).toEqual(sorted(v12));
    const cur = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/L01.json'), 'utf8'));
    expect(LEGACY_L01.contentVersions).not.toContain(`auto-${crypto.createHash('sha256').update(JSON.stringify(cur)).digest('hex').slice(0, 12)}`);
  });
});

describe('옛 판 행 가르기', () => {
  const none = noIndex();
  it('옛 판 content_version 이면 옛 행, 지금 판 이름·옮긴 행은 아니다', () => {
    expect(isLegacyRow('step_progress', oldRow(S('03')), none)).toBe(true);
    expect(isLegacyRow('step_progress', { step_id: S('03'), status: 'done', done_at: NEW_AT, content_version: NOW_CV }, none)).toBe(false);
    expect(isLegacyRow('step_progress', { step_id: S('03'), status: 'done', done_at: NEW_AT, content_version: LEGACY_L01.migratedContentVersion }, none)).toBe(false);
  });
  it('정본 글자만 고쳐 content_version 해시가 바뀌어도 지금 판 진도는 그대로 보인다(모르는 판은 옮기지도 숨기지도 않음)', () => {
    const edited = { step_id: S('03'), status: 'done', done_at: NEW_AT, content_version: 'auto-0123456789ab' };
    expect(isLegacyRow('step_progress', edited, none)).toBe(false);
    expect(visibleRows('step_progress', [edited], noIndex())).toEqual([edited]);
  });
  it('지금 판이 생기기 전(c8e0ec6 커밋 시각)에 마친 기록은 판 칸이 지금 값으로 덮였어도 옛 행', () => {
    expect(isLegacyRow('step_progress', { step_id: S('04'), status: 'done', done_at: OLD_AT, content_version: NOW_CV }, none)).toBe(true);
    expect(isLegacyRow('question_attempt', { question_id: 'L01-Q01', attempt_id: 'a', at: OLD_AT }, none)).toBe(true);
    expect(isLegacyRow('question_attempt', { question_id: 'L01-Q01', attempt_id: 'b', at: NEW_AT }, none)).toBe(false);
    expect(isLegacyRow('grade_result', { check_id: S('04'), passed: true, at: OLD_AT }, none)).toBe(true);
    expect(isLegacyRow('rebuild_attempt', { rebuild_id: 'L01-R1', attempt_id: 'c', passed: true, at: OLD_AT }, none)).toBe(true);
  });
  it('보관본의 옛 완료 시각을 그대로 가진 완료 행(서버의 "완료 우선" 합치기로 되살아난 것)은 옛 행', () => {
    const idx = { ...noIndex(), doneAt: new Map([[S('20'), Date.parse('2026-11-17T20:00:00+09:00')]]) };
    const revived = { step_id: S('20'), status: 'done', done_at: '2026-11-17T11:00:00.000Z', content_version: NOW_CV };
    expect(isLegacyRow('step_progress', revived, idx)).toBe(true);
    expect(isLegacyRow('step_progress', { ...revived, done_at: NEW_AT }, idx)).toBe(false);
    // 이 빌드의 판 값이어도 보관본 완료 시각과 같으면 되살아난 옛 완료
    expect(isLegacyRow('step_progress', { ...revived, content_version: BUILD_CV }, { ...idx, current: new Set([BUILD_CV]) })).toBe(true);
  });
  it('이 빌드의 판(content_version)으로 쓴 기록은 기기 시계가 지금 판 커밋 전으로 틀려 있어도 옛 행이 아니다(다른 지금 판 계열 값은 시각 규칙 그대로)', () => {
    const idx = { ...noIndex(), current: new Set([BUILD_CV]) };
    const slowClock = { step_id: S('05'), status: 'done', done_at: OLD_AT, content_version: BUILD_CV };
    expect(isLegacyRow('step_progress', slowClock, idx)).toBe(false);
    expect(viewRow('step_progress', slowClock, idx)).toEqual(slowClock);
    expect(isLegacyRow('step_progress', { ...slowClock, content_version: NOW_CV }, idx)).toBe(true);
    expect(isLegacyRow('step_progress', { ...slowClock, content_version: LEGACY_L01.contentVersions[0] }, idx)).toBe(true);
  });
  it('기초(F)·맛보기 기록은 판과 상관없이 건드리지 않는다(B 에서 F.json 을 고쳐 기초 판 해시가 바뀌어도 단위 완료 그대로)', () => {
    const fRows = ['F-P1-S1', 'F-P1-S2'].map((id) => ({ step_id: id, status: 'done', done_at: OLD_AT, content_version: 'F-claude-1.1-000000000000' }));
    expect(visibleRows('step_progress', fRows, noIndex())).toEqual(fRows);
    expect(isLegacyRow('taster_result', { attempt_no: 1, step_id: 'T-S01', at: OLD_AT }, none)).toBe(false);
    const u: UnitMasteryRef = { step_ids: ['F-P1-S1', 'F-P1-S2'], questions: [], rebuilds: [] };
    const rule: BasicsRule = { steps_complete_ratio: 1, question_score_ratio: 0.8 };
    expect(unitMastery(u, rule, visibleRows('step_progress', fRows, noIndex()), [], []).steps_done_ratio).toBe(1);
  });
});

let dbn = 0;
const fresh = () => LocalStore.open(`legacy-${++dbn}`, 'u-1');
/** 대기열의 모든 op 를 서버가 받았다고 치기(받은 행의 base 시각이 생긴다) */
async function serverAccepts(s: LocalStore) {
  const ops = await s.pendingOps(1000);
  await s.removeOps(
    ops.map((o) => o.op_id),
    ops,
  );
  return ops;
}

describe('옮기기 실행 (기기 사본)', () => {
  const seed = [oldRow(S('01')), oldRow(S('03')), oldRow(S('04'), 'in_progress'), oldRow(S('07')), oldRow(S('09b')), oldRow(S('10')), oldRow(S('16'))];
  const want = sorted([S('02'), S('03'), S('05'), S('06'), S('13'), ...range(15, 19), S('21'), S('22'), S('27'), S('53')]);

  it('1) 옛 행을 보관본에 그대로 복사하고, 서버가 보관본을 받기 전에는 새 완료를 만들지 않는다', async () => {
    const s = await fresh();
    await s.mergeServerRows({ step_progress: seed });
    const r1 = await runL01Migration(s, () => NEW_AT);
    expect(r1).toEqual({ archived: seed.length, written: [] });
    const idx = await legacyIndex(s);
    expect(idx.archive?.rows.step_progress).toEqual(seed);
    expect(idx.archive?.applied_at).toBeNull();
    const ops = await s.pendingOps(100);
    expect(ops.map((o) => [o.table, o.key])).toEqual([['user_pref', { pref_key: LEGACY_L01.archiveKey }]]);
  });

  it('2) 서버가 보관본을 받은 뒤에는 표대로 새 완료를 만들고, 3) 두 번 돌려도 같다', async () => {
    const s = await fresh();
    await s.mergeServerRows({ step_progress: seed });
    await runL01Migration(s, () => NEW_AT);
    await serverAccepts(s);
    const r2 = await runL01Migration(s, () => NEW_AT);
    expect(sorted(r2.written)).toEqual(want);
    const ops = await serverAccepts(s);
    const stepOps = ops.filter((o) => o.table === 'step_progress');
    expect(sorted(stepOps.map((o) => String(o.key.step_id)))).toEqual(want);
    for (const o of stepOps) expect(o.data).toMatchObject({ status: 'done', done_at: NEW_AT, content_version: LEGACY_L01.migratedContentVersion });
    expect(readArchive(ops.find((o) => o.table === 'user_pref')?.data.value)?.applied_at).toBe(NEW_AT);
    // 두 번째, 세 번째 실행은 아무것도 쓰지 않는다
    expect(await runL01Migration(s, () => NEW_AT)).toEqual({ archived: 0, written: [] });
    expect(await runL01Migration(s, () => '2026-11-19T09:00:00+09:00')).toEqual({ archived: 0, written: [] });
    expect(await s.pendingOps(100)).toEqual([]);
    // 화면에 보이는 완료는 표대로만. 옛 행은 지우지 않았다(뜻이 다른 새 단계와 겹치지 않는 S09b·S16 등도 사본에 남음)
    const idx = await legacyIndex(s);
    const rows = await s.list('step_progress');
    const done = visibleRows('step_progress', rows, idx).filter((r) => r.status === 'done').map((r) => String(r.step_id));
    expect(sorted(done)).toEqual(want);
    for (const r of seed.filter((x) => !want.includes(x.step_id))) expect(rows.find((x) => x.step_id === r.step_id), r.step_id).toEqual(r);
    expect(idx.archive?.rows.step_progress).toEqual(seed);
  });

  it('옛 행이 없는 기기(새로 시작한 사람, 기초만 한 사람)는 아무것도 쓰지 않는다', async () => {
    const s = await fresh();
    await s.mergeServerRows({ step_progress: [{ step_id: 'F-P1-S1', status: 'done', done_at: OLD_AT, content_version: 'F-claude-1.1-x', updated_at: OLD_AT, server_seq: 1 }] });
    expect(await runL01Migration(s, () => NEW_AT)).toEqual({ archived: 0, written: [] });
    expect(await s.pendingOps(10)).toEqual([]);
  });

  it('다른 기기가 이미 옮겼으면(보관본 applied_at 있음) 다시 옮기지 않는다', async () => {
    const s = await fresh();
    const archive = { ...archiveOf(seed), applied_at: NEW_AT };
    const migrated = want.map((id) => ({ step_id: id, status: 'done', done_at: NEW_AT, content_version: LEGACY_L01.migratedContentVersion, updated_at: NEW_AT, server_seq: 2 }));
    await s.mergeServerRows({ step_progress: [...seed.filter((r) => !want.includes(r.step_id)), ...migrated], user_pref: [{ pref_key: LEGACY_L01.archiveKey, value: archive, updated_at: NEW_AT, server_seq: 3 }] });
    expect(await runL01Migration(s, () => '2026-11-19T09:00:00+09:00')).toEqual({ archived: 0, written: [] });
    const idx = await legacyIndex(s);
    expect(sorted(visibleRows('step_progress', await s.list('step_progress'), idx).filter((r) => r.status === 'done').map((r) => String(r.step_id)))).toEqual(want);
  });

  it('옛 완료 행이 있는 새 단계를 열면 새 행으로 시작하고(옛 행은 보관본에), 서버가 완료를 되살려 보내도 완료로 보이지 않으며, 마치면 그때 완료', async () => {
    const s = await fresh();
    await s.mergeServerRows({ step_progress: [oldRow(S('12'))] });
    const row = await ensureStepRow(s, S('12'), NOW_CV);
    expect(row).toMatchObject({ step_id: S('12'), status: 'in_progress', done_at: null, attempts: 0, max_hint_level: 0, prediction: null, content_version: NOW_CV });
    expect((await legacyIndex(s)).archive?.rows.step_progress).toEqual([oldRow(S('12'))]);
    // 옛 서버 합치기("완료 우선, 완료 시각 유지")가 되살린 행을 받았다
    await serverAccepts(s);
    await s.mergeServerRows({ step_progress: [{ ...row, status: 'done', done_at: OLD_AT, updated_at: NEW_AT, server_seq: 9 }] });
    let idx = await legacyIndex(s);
    // 되살아난 행은 내 지금 판 행이라 보이되 미완료로
    expect(visibleRows('step_progress', await s.list('step_progress'), idx).map((r) => [r.step_id, r.status, r.done_at])).toEqual([[S('12'), 'in_progress', null]]);
    await markStepDone(s, S('12'), NOW_CV);
    idx = await legacyIndex(s);
    const vis = visibleRows('step_progress', await s.list('step_progress'), idx);
    expect(vis.map((r) => [r.step_id, r.status])).toEqual([[S('12'), 'done']]);
    expect(Date.parse(String(vis[0].done_at))).toBeGreaterThan(Date.parse(LEGACY_L01.cutoff));
  });

  for (const [label, doneAt] of [
    ['지금 판 커밋 전에 마친 옛 행', OLD_AT],
    ['지금 판 커밋 뒤에 마친 옛 행(시각으로는 못 가림)', '2026-11-17T20:00:00+09:00'],
  ]) {
    it(`되살아난 행(${label}): 새 행 만들기는 한 번만, 그 뒤는 이어 쓰기라 예측·시도가 지워지지 않고 미완료로 보이며, 마치면 새 완료 시각`, async () => {
      const s = await fresh();
      const old = oldRow(S('12'), 'done', { done_at: doneAt, updated_at: doneAt });
      await s.mergeServerRows({ step_progress: [old] });
      // 1) 처음 열 때 한 번 새 행으로 시작(옛 행은 보관본에, 새로 시작한 단계로 표시)
      await ensureStepRow(s, S('12'), NOW_CV);
      let idx = await legacyIndex(s);
      expect([...idx.resetSteps]).toEqual([S('12')]);
      await patchStep(s, S('12'), NOW_CV, { prediction: '내 예측' });
      await serverAccepts(s);
      // 2) 서버의 "완료 우선, 완료 시각 유지" 합치기가 옛 완료를 되살려 돌려보냈다(예측은 내 것)
      const mine = await s.get('step_progress', { step_id: S('12') });
      await s.mergeServerRows({ step_progress: [{ ...mine, status: 'done', done_at: doneAt, attempts: 2, started_at: old.started_at, updated_at: NEW_AT, server_seq: 9 }] });
      // 3) 그 뒤 쓰기(실습 시간 등)는 이어 쓰기: 새 행을 다시 만들지 않고, 예측·시도를 지우지 않으며, 상태는 서버 값 그대로 보낸다(충돌 없음)
      for (let i = 0; i < 3; i++) await patchStep(s, S('12'), NOW_CV, (cur) => ({ active_seconds_auto: Number(cur.active_seconds_auto ?? 0) + 15 }));
      const ops = await serverAccepts(s);
      const stepOps = ops.filter((o) => o.table === 'step_progress');
      expect(stepOps.length).toBe(1);
      expect(stepOps[0].data).toMatchObject({ prediction: '내 예측', status: 'done', done_at: doneAt, attempts: 2 });
      expect(ops.filter((o) => o.table === 'user_pref')).toEqual([]);
      idx = await legacyIndex(s);
      expect(idx.archive?.rows.step_progress).toEqual([old]);
      // 4) 화면에는 예측이 있는 미완료 행으로 보인다
      const vis = visibleRows('step_progress', await s.list('step_progress'), idx);
      expect(vis.map((r) => [r.step_id, r.status, r.done_at, r.prediction])).toEqual([[S('12'), 'in_progress', null, '내 예측']]);
      // 5) 마치면 새 완료 시각으로 완료
      await markStepDone(s, S('12'), NOW_CV);
      const done = visibleRows('step_progress', await s.list('step_progress'), await legacyIndex(s));
      expect(done.map((r) => [r.step_id, r.status, r.prediction])).toEqual([[S('12'), 'done', '내 예측']]);
      expect(Date.parse(String(done[0].done_at))).toBeGreaterThan(Date.parse(doneAt));
    });
  }

  it('단계 화면이 서버 기록을 받기 전에 열려도 단계 행은 받은 뒤에 쓴다(옛 행을 못 보고 새 행을 써서 서버가 옛 완료를 되살리는 일이 없게)', async () => {
    const s = await fresh();
    s.expectFirstPull();
    const opened = ensureStepRow(s, S('12'), NOW_CV);
    await new Promise((r) => setImmediate(r));
    expect(await s.pendingOps(10)).toEqual([]);
    await s.mergeServerRows({ step_progress: [oldRow(S('12'), 'done', { done_at: '2026-11-17T20:00:00+09:00' })] });
    s.markPulled();
    expect(await opened).toMatchObject({ status: 'in_progress', content_version: NOW_CV });
    const idx = await legacyIndex(s);
    expect(idx.archive?.rows.step_progress.map((r: Row) => r.step_id)).toEqual([S('12')]);
    expect([...idx.resetSteps]).toEqual([S('12')]);
  });

  it('보관본을 동시에 고쳐도(옮기기의 applied_at 과 단계 화면의 새로 시작함 표시) 서로 지우지 않는다', async () => {
    const s = await fresh();
    await s.mergeServerRows({ step_progress: [oldRow(S('01')), oldRow(S('12'))] });
    await runL01Migration(s, () => NEW_AT);
    await serverAccepts(s);
    await Promise.all([runL01Migration(s, () => NEW_AT), ensureStepRow(s, S('12'), NOW_CV)]);
    // 새로 시작함 표시가 서버에 갈 때까지는 옮기기를 미루고(검수 1), 받은 뒤 옮긴다
    await serverAccepts(s);
    await Promise.all([runL01Migration(s, () => NEW_AT), ensureStepRow(s, S('12'), NOW_CV)]);
    const idx = await legacyIndex(s);
    expect(idx.archive?.applied_at).toBe(NEW_AT);
    expect([...idx.resetSteps]).toEqual([S('12')]);
  });

  it('(검수 1) 보관본에 옛 행을 새로 더한 뒤에는, 그 보관본을 서버가 받을 때까지 표대로 옮기지 않는다(한 번 받은 적이 있어도)', async () => {
    const s = await fresh();
    await s.mergeServerRows({ step_progress: [oldRow(S('16'))] });
    await runL01Migration(s, () => NEW_AT);
    await serverAccepts(s);
    expect(await s.serverHas('user_pref', { pref_key: LEGACY_L01.archiveKey })).toBe(true);
    // 표대로 옮기기 전에 다른 기기가 올린 옛 행이 하나 더 왔다
    await s.mergeServerRows({ step_progress: [oldRow(S('01'), 'done', { server_seq: 5 })] });
    await keepLegacyRows(s, { step_progress: [oldRow(S('01'), 'done', { server_seq: 5 })] }, () => NEW_AT);
    expect(await s.serverHas('user_pref', { pref_key: LEGACY_L01.archiveKey })).toBe(false);
    expect(await runL01Migration(s, () => NEW_AT)).toEqual({ archived: 0, written: [] });
    await serverAccepts(s);
    expect(sorted((await runL01Migration(s, () => NEW_AT)).written)).toEqual([S('02'), S('03'), S('53')]);
  });

  it('(검수 2) 결과코드로 쓰기 전에, 덮일 옛 결과(grade_result)를 보관본에 넣는다', async () => {
    const s = await fresh();
    const oldGrade = { check_id: S('04'), passed: true, message_ko: '', source: 'result_code', at: OLD_AT, content_version: null, updated_at: OLD_AT, server_seq: 2 };
    await s.mergeServerRows({ grade_result: [oldGrade] });
    await keepLegacyBeforeWrite(s, 'grade_result', [{ check_id: S('04'), passed: false, at: NEW_AT }, { check_id: S('05'), passed: true, at: NEW_AT }]);
    expect((await legacyIndex(s)).archive?.rows.grade_result).toEqual([oldGrade]);
  });

  it('(검수 3) 보내지 않은 옛 앱의 변경이 남은 기기: 동기화 전에 읽어 둔 옛 행을, 서버 값이 사본을 덮은 뒤에도 보관본에 넣는다', async () => {
    const s = await fresh();
    // 옛 1.2판 앱이 오프라인에서 쓴 완료(아직 보내지 않음)
    await s.put('step_progress', { step_id: S('07'), status: 'done', done_at: OLD_AT, content_version: OLD_CV }, OLD_AT);
    s.expectFirstPull();
    const keepHeld = await holdLocalLegacy(s);
    const kept = keepHeld();
    // 보냈더니 서버가 더 새 값으로 처리(superseded)하고, 받기가 사본을 서버 값으로 덮었다
    await serverAccepts(s);
    await s.mergeServerRows({ step_progress: [{ step_id: S('07'), status: 'in_progress', content_version: NOW_CV, updated_at: NEW_AT, server_seq: 7 }] });
    s.markPulled();
    expect(await kept).toBe(1);
    expect((await legacyIndex(s)).archive?.rows.step_progress.map((r: Row) => [r.step_id, r.status, r.content_version])).toEqual([[S('07'), 'done', OLD_CV]]);
  });

  it('(검수 4) 보관본은 서버에서 받은 보관본과 행 단위로 합쳐 쓴다(첫 받기를 기다린 뒤 고친다)', async () => {
    const s = await fresh();
    s.expectFirstPull();
    const adding = keepLegacyRows(s, { step_progress: [oldRow(S('01'))] }, () => NEW_AT);
    await new Promise((r) => setImmediate(r));
    await s.mergeServerRows({ user_pref: [{ pref_key: LEGACY_L01.archiveKey, value: archiveOf([oldRow(S('03'))]), updated_at: NEW_AT, server_seq: 3 }] });
    s.markPulled();
    expect(await adding).toBe(1);
    expect((await legacyIndex(s)).archive?.rows.step_progress.map((r: Row) => r.step_id)).toEqual([S('03'), S('01')]);
  });

  it('다른 기기: 보관본에 "새로 시작함" 표시가 있어도 그 기기의 사본이 옛 판 원래 행이면 한 번 새로 시작한다(옛 값을 이어 쓰지 않음)', async () => {
    const s = await fresh();
    const archive = { ...archiveOf([oldRow(S('12'))]), reset_steps: [S('12')] };
    await s.mergeServerRows({ step_progress: [oldRow(S('12'))], user_pref: [{ pref_key: LEGACY_L01.archiveKey, value: archive, updated_at: NEW_AT, server_seq: 3 }] });
    const row = await ensureStepRow(s, S('12'), NOW_CV);
    expect(row).toMatchObject({ status: 'in_progress', prediction: null, content_version: NOW_CV });
  });

  it('보관본을 만들 때 기존 보관본의 행은 그대로 두고 새로 찾은 옛 행만 더한다', async () => {
    const s = await fresh();
    await s.mergeServerRows({ user_pref: [{ pref_key: LEGACY_L01.archiveKey, value: archiveOf([oldRow(S('01'))]), updated_at: NEW_AT, server_seq: 3 }], step_progress: [oldRow(S('02'))] });
    await runL01Migration(s, () => NEW_AT);
    expect((await legacyIndex(s)).archive?.rows.step_progress.map((r: Row) => r.step_id)).toEqual([S('01'), S('02')]);
  });

  it('planMigration: 이미 지금 판으로 마친 새 단계는 다시 쓰지 않는다', () => {
    const cur = [{ step_id: S('02'), status: 'done', done_at: NEW_AT, content_version: NOW_CV }];
    const w = planMigration(archiveOf([oldRow(S('01'))]), cur, noIndex(), NEW_AT);
    expect(w.map((r) => r.step_id)).toEqual([S('03')]);
  });
});
