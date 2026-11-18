// 첫 받기 상한·오프라인으로 기다림을 푼 뒤에도 옛 1편(1.2판) 기록을 지킨다(2026-11-18 검수 꼭1, 재현 A·B).
// "상한으로 기다림을 푼 것"과 "서버 기록을 실제로 받은 것"은 다르다: 보관본 쓰기와 옛 1편과 번호가 겹치는 기록 보내기는 실제로 받은 뒤에만.
// 서버 합치기 자체(완료 우선 등)는 실서버 검사(tests/real/sync-stall.spec.ts)가 본다. 여기 가짜 서버는 받은 칸을 그대로 덮는다.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { LocalStore, type Row } from '../../src/lib/sync/store';
import { SyncManager, type Timers } from '../../src/lib/sync/manager';
import { keyOf, keyString } from '../../src/lib/sync/tables';
import type { FetchLike, SyncOp } from '../../src/lib/api';
import { config } from '../../src/config';
import { ensureStepRow, markStepDone } from '../../src/lib/progress';
import { LEGACY_L01, readArchive, viewRow } from '../../src/lib/migrate/l01-v1_2';
import { HOLD_KEY, flushLegacyHold, holdLocalLegacy, keepLegacyFromServer, legacyIndex, runL01Migration, setCurrentContentVersions, waitsForServerRead } from '../../src/lib/migrate/run';

const USER = '9c1d0000-0000-4000-8000-00000000abcd';
const OLD_CV = LEGACY_L01.contentVersions[0];
const NOW_CV = 'auto-now0000test';
const OLD_AT = '2026-11-10T10:00:00.000+09:00';
const ARCHIVE_KEY = { pref_key: LEGACY_L01.archiveKey };
let dbn = 0;
const newStore = () => LocalStore.open(`z2h-legacy-stall-${++dbn}`, USER);

function manualTimers() {
  let id = 0;
  const pending = new Map<number, { fn: () => void; ms: number }>();
  const timers: Timers = {
    setTimeout: (fn, ms) => {
      pending.set(++id, { fn, ms });
      return id;
    },
    clearTimeout: (h) => {
      pending.delete(h as number);
    },
  };
  return {
    timers,
    fire: (ms: number) => {
      for (const [k, p] of [...pending]) {
        if (p.ms === ms) {
          pending.delete(k);
          p.fn();
        }
      }
    },
  };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function eventually(cond: () => boolean | Promise<boolean>, ms = 2000): Promise<boolean> {
  for (let waited = 0; waited < ms; waited += 10) {
    if (await cond()) return true;
    await sleep(10);
  }
  return cond();
}
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
const oldRow = (n: string, status = 'done'): Row => ({
  step_id: `L01-S${n}`,
  status,
  attempts: 1,
  started_at: '2026-11-10T09:00:00.000+09:00',
  done_at: status === 'done' ? OLD_AT : null,
  content_version: OLD_CV,
  updated_at: OLD_AT,
});

/** 가짜 서버: 받은 op 의 칸을 그 행에 그대로 덮고(합치기 규칙 없음), 받기(GET)는 mode 가 정한다. 멈춘 받기는 요청이 끊기면 실패로 끝난다 */
function fakeServer(seed: Record<string, Row[]>) {
  const rows = new Map<string, { table: string; row: Row }>();
  for (const [table, list] of Object.entries(seed)) for (const r of list) rows.set(keyString(table, keyOf(table, r)), { table, row: r });
  const sent: SyncOp[] = [];
  const log: string[] = [];
  let gets = 0;
  let mode: (n: number) => 'ok' | 'stall' | 'fail' = () => 'ok';
  const fetch: FetchLike = async (url, init) => {
    log.push(`${init?.method ?? 'GET'} ${url.split('?')[0]}`);
    if (url.startsWith('/api/sync')) {
      const body = JSON.parse(String(init!.body)) as { ops: SyncOp[] };
      for (const op of body.ops) {
        sent.push(op);
        const ks = keyString(op.table, op.key);
        const prev = rows.get(ks)?.row ?? {};
        rows.set(ks, { table: op.table, row: { ...prev, ...op.key, ...op.data, updated_at: op.updated_at } });
      }
      return json({ applied: body.ops.map((o) => o.op_id), superseded: [], rejected: [], server_time: '2026-11-18T18:00:00+09:00' });
    }
    const m = mode(++gets);
    if (m === 'fail') throw new TypeError('Failed to fetch');
    if (m === 'stall') return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    const tables: Record<string, Row[]> = {};
    for (const { table, row } of rows.values()) (tables[table] ??= []).push(row);
    return json({ server_time: '2026-11-18T18:00:00+09:00', server_seq: 100 + gets, tables });
  };
  return {
    fetch,
    sent,
    log,
    setMode: (f: (n: number) => 'ok' | 'stall' | 'fail') => (mode = f),
    row: (table: string, key: Record<string, unknown>) => rows.get(keyString(table, key))?.row,
  };
}

/** runtime.ts 와 같은 연결: 옛 1편 번호 기록은 실제로 받은 뒤에 보내고, 합치기가 버린 서버 행 중 옛 행은 보관본으로, 동기화가 끝날 때마다 옮기기 */
async function device(srv: ReturnType<typeof fakeServer>, prepare?: (s: LocalStore) => Promise<void>) {
  setCurrentContentVersions([NOW_CV]);
  const s = await newStore();
  if (prepare) await prepare(s);
  s.holdBeforeRead = waitsForServerRead;
  const keepHeld = await holdLocalLegacy(s);
  const t = manualTimers();
  const m = new SyncManager(s, {
    fetch: srv.fetch,
    timers: t.timers,
    clientId: 'web-this',
    onSynced: () => void runL01Migration(s),
    onKeptServerRows: (rows) => keepLegacyFromServer(s, rows),
  });
  m.start();
  const kept = keepHeld();
  return { s, t, m, kept };
}
const stepOps = (srv: ReturnType<typeof fakeServer>, id: string) => srv.sent.filter((o) => o.table === 'step_progress' && o.key.step_id === id);
const archiveOps = (srv: ReturnType<typeof fakeServer>) => srv.sent.filter((o) => o.table === 'user_pref' && o.key.pref_key === LEGACY_L01.archiveKey);

/** 기다리는 동안 새 변경을 보내는 타이머(50ms)를 계속 돌린다 */
async function until(d: { t: ReturnType<typeof manualTimers> }, cond: () => boolean): Promise<boolean> {
  return eventually(() => {
    d.t.fire(50);
    return cond();
  });
}

for (const start of ['stall', 'offline'] as const) {
  /** 첫 받기는 멈추거나(상한) 실패하고(오프라인), 그다음 받기 하나도 실패한다. 그 뒤로는 받는다 */
  const firstGets = (srv: ReturnType<typeof fakeServer>, failing: number) =>
    srv.setMode((n) => (n === 1 ? (start === 'stall' ? 'stall' : 'fail') : n <= failing ? 'fail' : 'ok'));
  const giveUp = async (d: Awaited<ReturnType<typeof device>>, srv: ReturnType<typeof fakeServer>) => {
    expect(await eventually(() => srv.log.length >= 1)).toBe(true);
    if (start === 'stall') d.t.fire(config.firstPullMaxMs);
    expect(await eventually(() => d.m.state.display === 'offline')).toBe(true);
  };

  describe(`첫 받기를 ${start === 'stall' ? '상한으로 포기' : '오프라인으로 실패'}한 뒤의 옛 1편 기록`, () => {
    it('재현 A: 이 기기가 모르는 서버의 옛 S07 위에서 화면을 열어도, 실제로 받기 전에는 그 단계 기록을 보내지 않고, 받은 뒤 옛 행을 보관본에(새로 시작함 표시와) 넣는다', async () => {
      const srv = fakeServer({ step_progress: [oldRow('07')] });
      firstGets(srv, 2);
      const d = await device(srv);
      await giveUp(d, srv);
      await ensureStepRow(d.s, 'L01-S07', NOW_CV);
      expect(await until(d, () => srv.log.filter((l) => l.startsWith('GET')).length >= 2 && d.m.state.display === 'offline')).toBe(true);
      expect(stepOps(srv, 'L01-S07')).toEqual([]);
      expect(srv.row('step_progress', { step_id: 'L01-S07' })).toMatchObject({ content_version: OLD_CV, status: 'done' });
      await d.m.retryNow();
      expect(await until(d, () => archiveOps(srv).length > 0 && stepOps(srv, 'L01-S07').length > 0)).toBe(true);
      const archive = readArchive(srv.row('user_pref', ARCHIVE_KEY)?.value);
      expect(archive?.rows.step_progress.map((r) => [r.step_id, r.content_version, r.done_at])).toEqual([['L01-S07', OLD_CV, OLD_AT]]);
      expect(archive?.reset_steps).toEqual(['L01-S07']);
      // 서버가 "완료 우선"으로 옛 완료를 되살려 보내도(완료, 옛 완료 시각, 지금 판) 이 기기는 미완료로 본다
      await d.s.mergeServerRows({ step_progress: [{ ...oldRow('07'), content_version: NOW_CV, updated_at: '2026-11-18T18:00:01.000+09:00' }] });
      const view = viewRow('step_progress', (await d.s.get('step_progress', { step_id: 'L01-S07' }))!, await legacyIndex(d.s));
      expect(view?.status).toBe('in_progress');
      d.m.stop();
    });

    it('재현 A 마치기: 받기 전에도 마치기는 바로 끝나고(멈추지 않음), 그 기록은 받은 뒤에 보내며 옛 행은 보관본에 남는다', async () => {
      const srv = fakeServer({ step_progress: [oldRow('07')] });
      firstGets(srv, 2);
      const d = await device(srv);
      await giveUp(d, srv);
      const done = await markStepDone(d.s, 'L01-S07', NOW_CV);
      expect(done.status).toBe('done');
      expect(await until(d, () => srv.log.filter((l) => l.startsWith('GET')).length >= 2 && d.m.state.display === 'offline')).toBe(true);
      expect(stepOps(srv, 'L01-S07')).toEqual([]);
      await d.m.retryNow();
      expect(await until(d, () => stepOps(srv, 'L01-S07').some((o) => o.data.status === 'done') && archiveOps(srv).length > 0)).toBe(true);
      expect(readArchive(srv.row('user_pref', ARCHIVE_KEY)?.value)?.rows.step_progress.map((r) => r.step_id)).toEqual(['L01-S07']);
      d.m.stop();
    });

    it('재현 B: 다른 기기가 만든 서버 보관본(행·새로 시작함·applied_at)을, 이 기기의 옛 행 보관이 받기 전에 덮지 않고 받은 뒤 행 단위로 더한다', async () => {
      const other = {
        format: 1,
        lecture_id: 'L01',
        from_version: '1.2',
        to_version: 'claude-1.0',
        archived_at: '2026-11-18T09:00:00.000+09:00',
        applied_at: '2026-11-18T09:00:01.000+09:00',
        rows: { step_progress: [oldRow('01'), oldRow('02')], grade_result: [] },
        reset_steps: ['L01-S03'],
      };
      const srv = fakeServer({ user_pref: [{ pref_key: LEGACY_L01.archiveKey, value: other, updated_at: '2026-11-18T09:00:01.000+09:00' }] });
      firstGets(srv, 1);
      // 이 기기 사본: 예전에 받아 둔 옛 S05 하나. 서버 보관본은 아직 모른다
      const d = await device(srv, (s) => s.mergeServerRows({ step_progress: [oldRow('05')] }).then(() => undefined));
      await giveUp(d, srv);
      await d.m.retryNow();
      expect(await d.kept).toBe(1);
      expect(await until(d, () => archiveOps(srv).length > 0)).toBe(true);
      const a = readArchive(srv.row('user_pref', ARCHIVE_KEY)?.value);
      expect(a?.rows.step_progress.map((r) => r.step_id)).toEqual(['L01-S01', 'L01-S02', 'L01-S05']);
      expect(a?.reset_steps).toEqual(['L01-S03']);
      expect(a?.applied_at).toBe(other.applied_at);
      d.m.stop();
    });

    it('옛 기록이 없는 사용자: 받기 전에 쓴 1편 S01~S16 새 행은 받기가 성공한 그 동기화 안에서 "저장됨" 전에 서버로 나간다', async () => {
      const srv = fakeServer({});
      firstGets(srv, 1);
      const d = await device(srv);
      await giveUp(d, srv);
      await ensureStepRow(d.s, 'L01-S02', NOW_CV);
      await markStepDone(d.s, 'L01-S03', NOW_CV);
      expect(stepOps(srv, 'L01-S02')).toEqual([]);
      // 새 변경 타이머(50ms)는 돌리지 않는다: 받기 성공 뒤 미뤄 둔 기록을 보내는 길만 본다
      await d.m.retryNow();
      expect(d.m.state.display).toBe('saved');
      expect(stepOps(srv, 'L01-S02')).toHaveLength(1);
      expect(stepOps(srv, 'L01-S03').map((o) => o.data.status)).toEqual(['done']);
      expect(await d.s.queueSize()).toBe(0);
      d.m.stop();
    });

    it('이 기기가 서버 행을 아는(base 있는) 겹치는 번호 단계는 지금처럼 받기 전에도 바로 보낸다', async () => {
      const srv = fakeServer({});
      firstGets(srv, 2);
      const d = await device(srv, (s) =>
        s.mergeServerRows({ step_progress: [{ step_id: 'L01-S03', status: 'in_progress', content_version: NOW_CV, started_at: '2026-11-18T10:00:00.000+09:00', updated_at: '2026-11-18T10:00:00.000+09:00' }] }).then(() => undefined),
      );
      await giveUp(d, srv);
      await markStepDone(d.s, 'L01-S03', NOW_CV);
      expect(await until(d, () => stepOps(srv, 'L01-S03').some((o) => o.data.status === 'done'))).toBe(true);
      expect(stepOps(srv, 'L01-S03')[0].base_updated_at).toBe('2026-11-18T10:00:00.000+09:00');
      expect(srv.log.filter((l) => l.startsWith('GET')).length).toBeLessThanOrEqual(2);
      d.m.stop();
    });

    it('옛 기록이 없는 기초·1편 뒤쪽 단계(번호가 겹치지 않음)는 지금처럼 받기 전에도 바로 보낸다', async () => {
      const srv = fakeServer({});
      firstGets(srv, 2);
      const d = await device(srv);
      await giveUp(d, srv);
      await markStepDone(d.s, 'F-P1-S2', 'F-cv');
      await markStepDone(d.s, 'L01-S20', NOW_CV);
      expect(await until(d, () => stepOps(srv, 'F-P1-S2').length > 0 && stepOps(srv, 'L01-S20').length > 0)).toBe(true);
      // 실제 받기는 셋째 받기부터라 위 보내기는 모두 받기 전에 나갔다
      expect(srv.log.filter((l) => l.startsWith('GET')).length).toBeLessThanOrEqual(2);
      d.m.stop();
    });
  });
}

describe('대기함(이 기기에만 두는 옛 행·새로 시작함 표시)', () => {
  it('두 탭: 한 탭이 대기함을 보관본에 합치는 사이 다른 탭이 더한 옛 행·표시는 지워지지 않는다(합친 것만 뺀다)', async () => {
    setCurrentContentVersions([NOW_CV]);
    const name = `z2h-legacy-stall-tabs-${++dbn}`;
    const tabA = await LocalStore.open(name, USER);
    const tabB = await LocalStore.open(name, USER);
    await tabA.setUi(HOLD_KEY, { rows: { step_progress: [oldRow('05')], grade_result: [] }, reset_steps: ['L01-S05'] });
    // 탭 A 가 보관본을 쓰는 바로 그때 탭 B(다른 페이지, 같은 저장소)가 대기함에 옛 행과 표시를 더한다
    const put = tabA.put.bind(tabA);
    let added = false;
    tabA.put = async (table, row, at) => {
      if (!added && table === 'user_pref') {
        added = true;
        const cur = (await tabB.getUi<{ rows: { step_progress: Row[]; grade_result: Row[] }; reset_steps: string[] }>(HOLD_KEY))!;
        await tabB.setUi(HOLD_KEY, { rows: { ...cur.rows, step_progress: [...cur.rows.step_progress, oldRow('09')] }, reset_steps: [...cur.reset_steps, 'L01-S09'] });
      }
      return put(table, row, at);
    };
    expect(await flushLegacyHold(tabA)).toBe(2);
    expect(added).toBe(true);
    const left = await tabB.getUi<{ rows: { step_progress: Row[] }; reset_steps: string[] }>(HOLD_KEY);
    expect(left?.rows.step_progress.map((r) => r.step_id)).toEqual(['L01-S09']);
    expect(left?.reset_steps).toEqual(['L01-S09']);
    expect(await flushLegacyHold(tabB)).toBe(2);
    const idx = await legacyIndex(tabB);
    expect(idx.archive?.rows.step_progress.map((r) => r.step_id)).toEqual(['L01-S05', 'L01-S09']);
    expect(idx.archive?.reset_steps).toEqual(['L01-S05', 'L01-S09']);
  });

  it('이 기기 사본의 옛 행 위에 받기 전에 새 행을 쓰면 옛 행은 대기함에 남아 새로 고침(새 저장소 연결) 뒤에도 받은 뒤 보관본에 들어간다', async () => {
    setCurrentContentVersions([NOW_CV]);
    const name = `z2h-legacy-stall-reload-${++dbn}`;
    const s1 = await LocalStore.open(name, USER);
    await s1.mergeServerRows({ step_progress: [oldRow('12')] });
    s1.expectFirstPull();
    s1.continueWithoutPull();
    await ensureStepRow(s1, 'L01-S12', NOW_CV);
    expect((await legacyIndex(s1)).archive).toBeNull();
    // 새로 고침: 같은 이름의 저장소를 다시 연다. 서버 기록을 받은 뒤 대기함이 보관본에 합쳐진다
    const s2 = await LocalStore.open(name, USER);
    s2.expectFirstPull();
    const held = await holdLocalLegacy(s2);
    const kept = held();
    s2.markPulled();
    expect(await kept).toBe(2);
    const idx = await legacyIndex(s2);
    expect(idx.archive?.rows.step_progress.map((r) => [r.step_id, r.content_version])).toEqual([['L01-S12', OLD_CV]]);
    expect(idx.archive?.reset_steps).toEqual(['L01-S12']);
  });
});
