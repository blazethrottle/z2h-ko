import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { LocalStore } from '../../src/lib/sync/store';
import { SyncManager, type Timers } from '../../src/lib/sync/manager';
import { keyOf } from '../../src/lib/sync/tables';

const USER = '9c1d0000-0000-4000-8000-00000000abcd';
let dbn = 0;
const newStore = (user: string | null = USER) => LocalStore.open(`z2h-test-${++dbn}`, user);

/** 손으로 돌리는 타이머: 등록된 콜백을 지연 시간과 함께 보관한다 */
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
    delays: () => [...pending.values()].map((p) => p.ms),
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

type Handler = (url: string, init?: RequestInit) => Promise<Response>;
function fakeFetch(handler: Handler) {
  const calls: { url: string; body: any }[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    return handler(url, init);
  };
  return { fn, calls };
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const okSync: Handler = async (url, init) => {
  if (url.startsWith('/api/state')) return json({ server_time: '2026-11-16T21:00:00+09:00', tables: {} });
  const body = JSON.parse(String(init!.body));
  return json({ applied: body.ops.map((o: any) => o.op_id), superseded: [], rejected: [], server_time: '2026-11-16T21:00:01+09:00' });
};
const down: Handler = async () => {
  throw new TypeError('Failed to fetch');
};
const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle() {
  for (let i = 0; i < 20; i++) await tick();
}

describe('IndexedDB 대기열', () => {
  it('변경은 먼저 대기열에 들어가고 key·updated_at(+09:00)이 붙는다. data에는 서버 칸(user_id, updated_at)과 열쇠 칸이 없다', async () => {
    const s = await newStore();
    await s.put('step_progress', { step_id: 'L01-S04', status: 'in_progress' });
    const ops = await s.pendingOps(10);
    expect(ops).toHaveLength(1);
    expect(ops[0].table).toBe('step_progress');
    expect(ops[0].key).toEqual({ step_id: 'L01-S04' });
    expect(ops[0].data).toEqual({ status: 'in_progress' });
    expect(ops[0].updated_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}\+09:00$/);
    expect(ops[0].op_id).toMatch(/^[0-9a-f-]{36}$/);
    const row = await s.get('step_progress', { step_id: 'L01-S04' });
    expect(row?.status).toBe('in_progress');
    expect(row?.user_id).toBe(USER);
    expect(row?.updated_at).toBe(ops[0].updated_at);
  });

  it('attempt_no 는 서버가 매기므로 보내지 않는다', async () => {
    const s = await newStore();
    await s.put('question_attempt', { question_id: 'L01-Q03', attempt_id: 'a1', attempt_no: 3, is_correct: true });
    const [op] = await s.pendingOps(10);
    expect(op.key).toEqual({ question_id: 'L01-Q03', attempt_id: 'a1' });
    expect(op.data).toEqual({ is_correct: true });
  });

  it('같은 행의 보내지 않은 변경은 하나로 합친다', async () => {
    const s = await newStore();
    await s.put('step_progress', { step_id: 'L01-S04', status: 'in_progress' });
    await s.put('step_progress', { step_id: 'L01-S04', status: 'done' });
    const ops = await s.pendingOps(10);
    expect(ops).toHaveLength(1);
    expect(ops[0].data.status).toBe('done');
  });

  it('보내는 중인 변경은 합치지 않고 새로 쌓는다', async () => {
    const s = await newStore();
    await s.put('step_progress', { step_id: 'L01-S04', status: 'in_progress' });
    const [first] = await s.pendingOps(10);
    s.inflight.add(first.op_id);
    await s.put('step_progress', { step_id: 'L01-S04', status: 'done' });
    expect(await s.pendingOps(10)).toHaveLength(2);
  });

  it('표마다 key 칸이 정해져 있다', () => {
    expect(keyOf('question_attempt', { question_id: 'L01-Q03', attempt_id: 'a1', attempt_no: 2 })).toEqual({ question_id: 'L01-Q03', attempt_id: 'a1' });
    expect(keyOf('help_note', { note_id: 'n1', target_id: 'L01-S04' })).toEqual({ note_id: 'n1' });
    expect(keyOf('user_pref', { pref_key: 'run_place', value: 'colab' })).toEqual({ pref_key: 'run_place' });
    expect(() => keyOf('step_progress', { status: 'done' })).toThrow();
  });
});

describe('동기화 관리자', () => {
  it('성공하면 대기열이 비고 저장됨, 본문은 {client_id, ops}', async () => {
    const s = await newStore();
    const f = fakeFetch(okSync);
    const t = manualTimers();
    const m = new SyncManager(s, { fetch: f.fn, timers: t.timers, clientId: 'c1' });
    await s.put('step_progress', { step_id: 'L01-S01', status: 'done' });
    await m.flush();
    expect(await s.queueSize()).toBe(0);
    expect(m.state.display).toBe('saved');
    const syncCall = f.calls.find((c) => c.url === '/api/sync')!;
    expect(syncCall.body.client_id).toBe('c1');
    expect(syncCall.body.ops[0]).toMatchObject({ table: 'step_progress', key: { step_id: 'L01-S01' } });
  });

  it('연결이 안 되면 오프라인, 대기열 유지, 30초·1분·5분·5분 간격으로 다시 시도', async () => {
    const s = await newStore();
    const f = fakeFetch(down);
    const t = manualTimers();
    const m = new SyncManager(s, { fetch: f.fn, timers: t.timers, clientId: 'c1' });
    await s.put('step_progress', { step_id: 'L01-S01', status: 'done' });
    await m.flush();
    expect(m.state.display).toBe('offline');
    expect(await s.queueSize()).toBe(1);
    expect(t.delays()).toContain(30_000);
    t.fire(30_000);
    await settle();
    expect(t.delays()).toContain(60_000);
    t.fire(60_000);
    await settle();
    expect(t.delays()).toContain(300_000);
    t.fire(300_000);
    await settle();
    expect(t.delays()).toContain(300_000);
  });

  it('연결이 돌아오면(online) 바로 보내고 저장됨', async () => {
    const s = await newStore();
    let online = false;
    const f = fakeFetch((u, i) => (online ? okSync(u, i) : down(u, i)));
    const t = manualTimers();
    const m = new SyncManager(s, { fetch: f.fn, timers: t.timers, clientId: 'c1' });
    await s.put('question_attempt', { question_id: 'L01-Q03', attempt_id: 'a1', attempt_no: 1, is_correct: true });
    await m.flush();
    expect(m.state.display).toBe('offline');
    online = true;
    await m.handleOnline();
    expect(m.state.display).toBe('saved');
    expect(await s.queueSize()).toBe(0);
  });

  it('"동기화 중"은 1초 넘게 걸릴 때만 보인다: 오프라인 → 동기화 중 → 저장됨', async () => {
    const s = await newStore();
    let release!: () => void;
    let slow = false;
    const f = fakeFetch(async (u, i) => {
      if (!slow) return down(u, i);
      if (u === '/api/sync') await new Promise<void>((r) => (release = r));
      return okSync(u, i);
    });
    const t = manualTimers();
    const m = new SyncManager(s, { fetch: f.fn, timers: t.timers, clientId: 'c1' });
    const seen: string[] = [];
    m.subscribe((st) => {
      if (seen[seen.length - 1] !== st.display) seen.push(st.display);
    });
    await s.put('step_progress', { step_id: 'L01-S02', status: 'done' });
    await m.flush();
    slow = true;
    const p = m.retryNow();
    await settle();
    expect(m.state.display).toBe('offline');
    t.fire(1_000);
    expect(m.state.display).toBe('syncing');
    release();
    await p;
    expect(m.state.display).toBe('saved');
    expect(seen).toEqual(['saved', 'offline', 'syncing', 'saved']);
  });

  it('1초 안에 끝나면 동기화 중을 보이지 않는다', async () => {
    const s = await newStore();
    const f = fakeFetch(okSync);
    const t = manualTimers();
    const m = new SyncManager(s, { fetch: f.fn, timers: t.timers, clientId: 'c1' });
    const seen: string[] = [];
    m.subscribe((st) => seen.push(st.display));
    await s.put('step_progress', { step_id: 'L01-S02', status: 'done' });
    await m.flush();
    expect(seen).not.toContain('syncing');
  });

  it('서버가 거절한 변경은 대기열에서 빼고 기록해 둔다', async () => {
    const s = await newStore();
    const f = fakeFetch(async (url, init) => {
      const body = JSON.parse(String(init!.body));
      return json({ applied: [], superseded: [], rejected: [{ op_id: body.ops[0].op_id, reason_ko: '모르는 표' }], server_time: 'x' });
    });
    const m = new SyncManager(s, { fetch: f.fn, timers: manualTimers().timers, clientId: 'c1' });
    await s.put('user_pref', { pref_key: 'run_place', value: 'colab' });
    await m.flush();
    expect(await s.queueSize()).toBe(0);
    expect(m.state.rejected[0].reason_ko).toBe('모르는 표');
  });

  it('서버 상태를 받아 합치되, 아직 못 보낸 더 늦은 내 변경은 지킨다', async () => {
    const s = await newStore();
    await s.put('step_progress', { step_id: 'L01-S05', status: 'done' }, '2026-11-16T22:00:00.000+09:00');
    const f = fakeFetch(async (url) => {
      if (url.startsWith('/api/state'))
        return json({
          server_time: '2026-11-16T22:30:00+09:00',
          server_seq: 42,
          tables: {
            step_progress: [
              { user_id: USER, step_id: 'L01-S05', status: 'in_progress', updated_at: '2026-11-16T21:00:00.000+09:00' },
              { user_id: USER, step_id: 'L01-S06', status: 'done', updated_at: '2026-11-16T21:00:00.000+09:00' },
            ],
          },
        });
      return down(url);
    });
    const m = new SyncManager(s, { fetch: f.fn, timers: manualTimers().timers, clientId: 'c1' });
    await m.pull();
    expect((await s.get('step_progress', { step_id: 'L01-S05' }))?.status).toBe('done');
    expect((await s.get('step_progress', { step_id: 'L01-S06' }))?.status).toBe('done');
    expect(await s.getMeta('last_server_seq')).toBe(42);
    await m.pull();
    expect(f.calls[f.calls.length - 1].url).toBe('/api/state?since=42');
  });
});

describe('계정과 base_updated_at', () => {
  it('계정마다 다른 DB: 한 계정의 기록이 다른 계정 사본에 섞이지 않는다', async () => {
    const a = await LocalStore.open('z2h-u-acct-a', 'acct-a');
    const b = await LocalStore.open('z2h-u-acct-b', 'acct-b');
    await a.put('step_progress', { step_id: 'L01-S01', status: 'done' });
    expect((await a.get('step_progress', { step_id: 'L01-S01' }))?.user_id).toBe('acct-a');
    expect(await b.get('step_progress', { step_id: 'L01-S01' })).toBeUndefined();
    expect(await b.queueSize()).toBe(0);
  });

  it('계정이 정해지기 전(pending)에 쌓인 기록을 계정 DB로 옮기고 pending 은 비운다', async () => {
    const pending = await newStore(null);
    await pending.put('step_progress', { step_id: 'L01-S02', status: 'done' });
    expect((await pending.get('step_progress', { step_id: 'L01-S02' }))?.user_id).toBeUndefined();
    const acct = await newStore('acct-c');
    expect(await acct.importFrom(pending)).toBe(2);
    expect((await acct.get('step_progress', { step_id: 'L01-S02' }))?.user_id).toBe('acct-c');
    expect(await acct.queueSize()).toBe(1);
    expect(await pending.queueSize()).toBe(0);
  });

  it('서버에서 받은 행을 고치면 base_updated_at = 서버가 가진 updated_at, 반영된 뒤 다음 변경은 그 op 의 updated_at', async () => {
    const s = await newStore();
    await s.mergeServerRows({ step_progress: [{ step_id: 'L01-S03', status: 'in_progress', updated_at: '2026-11-16T20:00:00.000+09:00' }] });
    await s.put('step_progress', { step_id: 'L01-S03', status: 'done' }, '2026-11-16T21:00:00.000+09:00');
    const [op1] = await s.pendingOps(10);
    expect(op1.base_updated_at).toBe('2026-11-16T20:00:00.000+09:00');
    const f = fakeFetch(okSync);
    const m = new SyncManager(s, { fetch: f.fn, timers: manualTimers().timers, clientId: 'c1' });
    await m.flush();
    expect(f.calls.find((c) => c.url === '/api/sync')!.body.ops[0].base_updated_at).toBe('2026-11-16T20:00:00.000+09:00');
    await s.put('step_progress', { step_id: 'L01-S03', status: 'done', attempts: 1 }, '2026-11-16T22:00:00.000+09:00');
    const [op2] = await s.pendingOps(10);
    expect(op2.base_updated_at).toBe('2026-11-16T21:00:00.000+09:00');
  });

  it('처음 만든 행에는 base_updated_at 이 없다', async () => {
    const s = await newStore();
    await s.put('user_pref', { pref_key: 'run_place', value: 'colab' });
    const [op] = await s.pendingOps(10);
    expect('base_updated_at' in op).toBe(false);
  });

  it('서버가 401(계정 없음)이면 오프라인이 아니라 account 상태, 재시도 대신 onUnauthorized', async () => {
    const s = await newStore();
    const t = manualTimers();
    let called = 0;
    const f = fakeFetch(async () => json({ ok: false, error: 'no_user' }, 401));
    const m = new SyncManager(s, { fetch: f.fn, timers: t.timers, clientId: 'c1', onUnauthorized: () => called++ });
    await s.put('step_progress', { step_id: 'L01-S04', status: 'done' });
    await m.flush();
    expect(m.state.display).toBe('account');
    expect(called).toBe(1);
    expect(t.delays()).not.toContain(30_000);
    expect(await s.queueSize()).toBe(1);
  });
});
