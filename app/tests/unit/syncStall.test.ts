// 동기화가 멈출 때(2026-11-18 리뷰 B1·B2·H1·M1): 요청 시간 한도는 응답 본문까지, 첫 받기 상한 뒤 단계 쓰기가 풀림,
// 멈춘 실행은 버려지고 다시 시도·연결 복구·새 변경이 새 요청을 냄, 서버 행을 모르는 새 행은 빈 칸(null)을 보내지 않음.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStore } from '../../src/lib/sync/store';
import { SyncManager, type Timers } from '../../src/lib/sync/manager';
import { NetworkError, getState, postSync, type FetchLike } from '../../src/lib/api';
import { config } from '../../src/config';
import { markStepDone, saveWithin } from '../../src/lib/progress';
import { newStepRow } from '../../src/lib/stepRow';

const USER = '9c1d0000-0000-4000-8000-00000000abcd';
let dbn = 0;
const newStore = () => LocalStore.open(`z2h-stall-${++dbn}`, USER);

/** 손으로 돌리는 타이머: 등록된 콜백을 지연 시간과 함께 보관한다(tests/unit/sync.test.ts 와 같은 모양) */
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

/** 약속이 끝났는지 들여다본다 */
function track<T>(p: Promise<T>) {
  const t: { done: boolean; value?: T; error?: unknown } = { done: false };
  p.then(
    (v) => Object.assign(t, { done: true, value: v }),
    (e) => Object.assign(t, { done: true, error: e }),
  );
  return t;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 가짜 타이머를 쓰는 동안 약속 처리가 다 돌게 한 번 쉰다(setImmediate 는 가짜로 바꾸지 않는다) */
const macrotask = () => new Promise((r) => setImmediate(r));
/** 브라우저 저장소(fake-indexeddb) 일이 돌 시간을 주며 조건을 기다린다 */
async function eventually(cond: () => boolean, ms = 1500): Promise<boolean> {
  for (let waited = 0; waited < ms; waited += 10) {
    if (cond()) return true;
    await sleep(10);
  }
  return cond();
}

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
/** 응답 머리는 오고 본문은 끝나지 않는 응답. signal 을 주면 중단될 때 본문이 오류로 끝난다(브라우저 fetch 처럼) */
function headersThenStall(status = 200, signal?: AbortSignal | null): Response {
  const body = new ReadableStream({
    start(c) {
      signal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')));
    },
  });
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}
const never = () => new Promise<Response>(() => {});
/** 끊길 때까지 응답이 없는 요청(브라우저 fetch 처럼 끊기면 실패로 끝난다) */
const untilAborted = (init?: RequestInit) =>
  new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
/** 요청이 끊긴 뒤, 그 실패를 받은 실행이 끝날 때까지(약속 처리가 다 돌 때까지) 기다린다 */
async function afterAbort(signal: AbortSignal | null | undefined) {
  if (!signal) throw new Error('요청에 중단 신호가 없습니다');
  if (!signal.aborted) await new Promise((r) => signal.addEventListener('abort', r));
  await new Promise((r) => setImmediate(r));
}
type Call = { method: string; url: string; signal: AbortSignal | null | undefined; body: { ops?: { op_id: string; key: Record<string, unknown>; data: Record<string, unknown> }[] } | null };
function recorder(handler: (url: string, init: RequestInit | undefined, n: number) => Promise<Response>) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ method: init?.method ?? 'GET', url, signal: init?.signal, body: init?.body ? JSON.parse(String(init.body)) : null });
    return handler(url, init, calls.length);
  };
  return { fetch, calls, names: () => calls.map((c) => `${c.method} ${c.url.split('?')[0]}`) };
}
const appliedAll = (init?: RequestInit) => {
  const body = JSON.parse(String(init!.body));
  return json({ applied: body.ops.map((o: { op_id: string }) => o.op_id), superseded: [], rejected: [], server_time: '2026-11-18T17:00:00+09:00' });
};
const emptyState = () => json({ server_time: '2026-11-18T17:00:00+09:00', server_seq: 1, tables: {} });

describe('B2 요청 시간 한도는 응답 본문(오류 본문 포함)을 다 읽을 때까지', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  for (const [name, wired] of [
    ['중단 신호를 본문에 잇는 fetch', true],
    ['중단 신호를 무시하는 fetch', false],
  ] as const) {
    it(`머리(200)만 오고 본문이 멈추면 한도 뒤 NetworkError (${name})`, async () => {
      const f: FetchLike = async (_u, i) => headersThenStall(200, wired ? i?.signal : null);
      const p = track(postSync(f, { client_id: 'c1', ops: [] }));
      await vi.advanceTimersByTimeAsync(config.requestTimeoutMs - 1);
      await macrotask();
      expect(p.done).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      await macrotask();
      expect(p.error).toBeInstanceOf(NetworkError);
    });
  }

  it('오류 머리(500)만 오고 오류 본문이 멈춰도 한도 뒤 NetworkError', async () => {
    const f: FetchLike = async () => headersThenStall(500);
    const p = track(getState(f, null));
    await vi.advanceTimersByTimeAsync(config.requestTimeoutMs + 1);
    await macrotask();
    expect(p.error).toBeInstanceOf(NetworkError);
  });

  it('본문을 다 읽으면 남은 타이머가 없다', async () => {
    const res = await getState(async () => emptyState(), null);
    expect(res.server_seq).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('B1 첫 받기 상한: 첫 동기화가 멈춰도 단계 쓰기가 끝난다', () => {
  it('받기(GET)가 응답 없이 멈추면 상한 뒤 whenPulled 가 풀리고 markStepDone 이 끝나며 표시는 offline, 기록은 대기열에 남는다', async () => {
    const s = await newStore();
    const r = recorder(async () => never());
    const t = manualTimers();
    const m = new SyncManager(s, { fetch: r.fetch, timers: t.timers, clientId: 'c1' });
    const first = track(m.retryNow());
    expect(await eventually(() => r.calls.length === 1)).toBe(true);
    const done = track(markStepDone(s, 'F-P1-S02', 'v1'));
    await sleep(50);
    expect(done.done).toBe(false);
    t.fire(config.firstPullMaxMs);
    expect(await eventually(() => done.done)).toBe(true);
    expect(done.error).toBeUndefined();
    expect(first.done).toBe(true);
    expect(m.state.display).toBe('offline');
    expect((await s.get('step_progress', { step_id: 'F-P1-S02' }))?.status).toBe('done');
    expect(await s.queueSize()).toBe(1);
  });

  it('보내기(POST) 응답 본문이 멈춰도(단계 2 화면: 앞 단계 기록이 대기열에 있음) 상한 뒤 마치기가 끝나고 30초 뒤 다시 시도가 잡힌다', async () => {
    const s = await newStore();
    await s.put('step_progress', { step_id: 'F-P1-S01', status: 'done' });
    const r = recorder(async (u, i) => (u === '/api/sync' ? headersThenStall(200, i?.signal) : emptyState()));
    const t = manualTimers();
    const m = new SyncManager(s, { fetch: r.fetch, timers: t.timers, clientId: 'c1' });
    void m.retryNow();
    expect(await eventually(() => r.calls.length === 1)).toBe(true);
    const done = track(markStepDone(s, 'F-P1-S02', 'v1'));
    t.fire(config.syncingIndicatorDelayMs);
    expect(m.state.display).toBe('syncing');
    t.fire(config.firstPullMaxMs);
    expect(await eventually(() => done.done)).toBe(true);
    expect(m.state.display).toBe('offline');
    expect(t.delays()).toContain(config.retryDelaysMs[0]);
  });
});

describe('H1 멈춘 실행은 버리고, 다시 시도·연결 복구·새 변경은 새 실행을 시작한다', () => {
  async function stalledAfterCap() {
    const s = await newStore();
    await s.put('step_progress', { step_id: 'F-P1-S01', status: 'done' });
    let stall = true;
    const r = recorder(async (u, i) => (stall ? never() : u === '/api/sync' ? appliedAll(i) : emptyState()));
    const t = manualTimers();
    const m = new SyncManager(s, { fetch: r.fetch, timers: t.timers, clientId: 'c1' });
    m.start();
    expect(await eventually(() => r.calls.length === 1)).toBe(true);
    t.fire(config.firstPullMaxMs);
    expect(m.state.display).toBe('offline');
    return { s, r, t, m, unstall: () => (stall = false) };
  }

  it('다시 시도(retryNow)는 버린 실행에 합쳐지지 않고 새 요청을 내보낸다', async () => {
    const { r, m, unstall } = await stalledAfterCap();
    unstall();
    await m.retryNow();
    expect(r.names()).toEqual(['POST /api/sync', 'POST /api/sync', 'GET /api/state']);
    expect(m.state.display).toBe('saved');
  });

  it('연결 복구(online)도 새 요청을 내보낸다', async () => {
    const { r, m, unstall } = await stalledAfterCap();
    unstall();
    await m.handleOnline();
    expect(r.names()).toEqual(['POST /api/sync', 'POST /api/sync', 'GET /api/state']);
    expect(m.state.display).toBe('saved');
  });

  it('새 변경(put)도 새 요청을 내보내고, 버린 실행이 받지 못한 서버 기록은 그 실행에서 받는다', async () => {
    const { s, r, t, m, unstall } = await stalledAfterCap();
    unstall();
    const before = r.calls.length;
    await s.put('step_progress', { step_id: 'F-P1-S02', status: 'done' });
    t.fire(50);
    expect(await eventually(() => r.calls.length >= before + 2 && m.state.display === 'saved')).toBe(true);
    expect(r.names().slice(before)).toEqual(['POST /api/sync', 'GET /api/state']);
    m.stop();
  });

  it('지금 실행이 멈춰 있어도(상한 전) 다시 시도는 기다리지 않고 새 요청을 내보낸다', async () => {
    const s = await newStore();
    s.markPulled();
    await s.put('step_progress', { step_id: 'F-P1-S01', status: 'done' });
    let stall = true;
    const r = recorder(async (u, i) => (stall ? never() : u === '/api/sync' ? appliedAll(i) : emptyState()));
    const m = new SyncManager(s, { fetch: r.fetch, timers: manualTimers().timers, clientId: 'c1' });
    void m.flush();
    expect(await eventually(() => r.calls.length === 1)).toBe(true);
    stall = false;
    const again = track(m.retryNow());
    expect(await eventually(() => again.done)).toBe(true);
    expect(r.names()).toEqual(['POST /api/sync', 'POST /api/sync', 'GET /api/state']);
    expect(await s.queueSize()).toBe(0);
  });

  it('버린 실행이 늦게 끝나도 표시·상태·사본·받은 번호를 바꾸지 못한다(성공으로 끝나도)', async () => {
    const s = await newStore();
    let release!: (r: Response) => void;
    const late = new Promise<Response>((res) => (release = res));
    const r = recorder(async () => late);
    const t = manualTimers();
    const m = new SyncManager(s, { fetch: r.fetch, timers: t.timers, clientId: 'c1' });
    const seen: string[] = [];
    m.subscribe((st) => seen.push(st.display));
    void m.retryNow();
    expect(await eventually(() => r.calls.length === 1)).toBe(true);
    t.fire(config.firstPullMaxMs);
    expect(m.state.display).toBe('offline');
    const n = seen.length;
    await afterAbort(r.calls[0].signal);
    release(json({ server_time: '2026-11-18T17:00:00+09:00', server_seq: 9, tables: { step_progress: [{ step_id: 'L01-S09', status: 'done', updated_at: '2026-11-18T16:00:00+09:00' }] } }));
    await new Promise((res) => setImmediate(res));
    expect(seen.slice(n)).toEqual([]);
    expect(m.state).toMatchObject({ display: 'offline', lastSyncedAt: null });
    expect(await s.get('step_progress', { step_id: 'L01-S09' })).toBeUndefined();
    expect(await s.getMeta('last_server_seq')).toBeUndefined();
  });

  it('버린 실행이 늦게 실패해도 새 실행의 "저장됨"을 오프라인으로 바꾸거나 재시도를 잡지 못한다', async () => {
    const s = await newStore();
    s.markPulled();
    await s.put('step_progress', { step_id: 'F-P1-S01', status: 'done' });
    let fail!: (e: Error) => void;
    const r = recorder(async (u, i, n) => (n === 1 ? new Promise<Response>((_, rej) => (fail = rej)) : u === '/api/sync' ? appliedAll(i) : emptyState()));
    const t = manualTimers();
    const m = new SyncManager(s, { fetch: r.fetch, timers: t.timers, clientId: 'c1' });
    void m.flush();
    expect(await eventually(() => r.calls.length === 1)).toBe(true);
    await m.retryNow();
    expect(m.state.display).toBe('saved');
    await afterAbort(r.calls[0].signal);
    fail(new TypeError('Failed to fetch'));
    await new Promise((res) => setImmediate(res));
    expect(m.state.display).toBe('saved');
    expect(t.delays()).not.toContain(config.retryDelaysMs[0]);
  });

  it('R1 버린 실행의 요청은 끊는다: 멈춘 채 다시 시도를 다섯 번 눌러도 열린 요청은 하나뿐', async () => {
    const s = await newStore();
    const r = recorder(async (_u, i) => untilAborted(i));
    const m = new SyncManager(s, { fetch: r.fetch, timers: manualTimers().timers, clientId: 'c1' });
    m.start();
    expect(await eventually(() => r.calls.length === 1)).toBe(true);
    for (let k = 0; k < 5; k++) {
      void m.retryNow();
      expect(await eventually(() => r.calls.length === k + 2)).toBe(true);
    }
    expect(r.names()).toEqual(Array(6).fill('GET /api/state'));
    expect(r.calls.filter((c) => !c.signal?.aborted)).toHaveLength(1);
    m.stop();
  });

  it('R3 다시 시도로 버린 실행의 요청은 끊겨 있어, 뒤 실행이 실패해 보내는 중 표시를 지울 때 살아 있는 앞 요청이 없다', async () => {
    const s = await newStore();
    s.markPulled();
    await s.put('step_progress', { step_id: 'F-P1-S01', status: 'done' });
    const r = recorder(async (_u, i, n) => (n === 1 ? untilAborted(i) : Promise.reject(new TypeError('Failed to fetch'))));
    const m = new SyncManager(s, { fetch: r.fetch, timers: manualTimers().timers, clientId: 'c1' });
    void m.flush();
    expect(await eventually(() => r.calls.length === 1)).toBe(true);
    await m.retryNow();
    expect(r.names()).toEqual(['POST /api/sync', 'POST /api/sync']);
    expect(r.calls[0].signal?.aborted).toBe(true);
    expect(m.state.display).toBe('offline');
    expect(s.inflight.size).toBe(0);
  });

  it('받기 요청이 지금 실행에 합쳐져도(재시도 타이머 등) 받기를 잃지 않는다', async () => {
    const s = await newStore();
    s.markPulled();
    let open!: () => void;
    const gate = new Promise<void>((r) => (open = r));
    const r = recorder(async (u, i) => {
      if (u === '/api/sync') {
        await gate;
        return appliedAll(i);
      }
      return emptyState();
    });
    const m = new SyncManager(s, { fetch: r.fetch, timers: manualTimers().timers, clientId: 'c1' });
    await s.put('step_progress', { step_id: 'L01-S02', status: 'done' });
    const kick = m.flush();
    expect(await eventually(() => r.calls.length === 1)).toBe(true);
    const merged = m.flush({ pull: true });
    open();
    await Promise.all([kick, merged]);
    expect(await eventually(() => r.names().includes('GET /api/state'))).toBe(true);
    expect(r.names()).toEqual(['POST /api/sync', 'GET /api/state']);
  });
});

describe('M1 서버가 아직 모르는 새 행은 값이 없는(null) 칸을 보내지 않는다', () => {
  it('base 없는 새 단계 행: op 에 null 칸이 없다(서버의 예측·고친 실습 시간을 지우지 않게)', async () => {
    const s = await newStore();
    await s.put('step_progress', newStepRow('F-P1-S02', 'v1', '2026-11-18T17:00:00.000+09:00'));
    const [op] = await s.pendingOps(10);
    expect('base_updated_at' in op).toBe(false);
    expect(Object.entries(op.data).filter(([, v]) => v === null)).toEqual([]);
    expect(op.data).toMatchObject({ status: 'in_progress', attempts: 0, active_seconds_auto: 0, content_version: 'v1' });
  });

  it('서버가 아는 행(base 있음)에서 비운 값은 null 로 보낸다(실습 시간 되돌리기)', async () => {
    const s = await newStore();
    await s.mergeServerRows({
      step_progress: [{ step_id: 'F-P1-S02', status: 'in_progress', active_seconds_user: 120, prediction: '예측', updated_at: '2026-11-18T16:00:00.000+09:00' }],
      user_pref: [{ pref_key: 'practice_week:2026-11-16', value: { edited_seconds: 3900 }, updated_at: '2026-11-18T16:00:00.000+09:00' }],
    });
    await s.patch('step_progress', { step_id: 'F-P1-S02' }, { active_seconds_user: null });
    await s.put('user_pref', { pref_key: 'practice_week:2026-11-16', value: null });
    const ops = await s.pendingOps(10);
    expect(ops.map((o) => [o.table, o.base_updated_at, o.table === 'step_progress' ? o.data.active_seconds_user : o.data.value])).toEqual([
      ['step_progress', '2026-11-18T16:00:00.000+09:00', null],
      ['user_pref', '2026-11-18T16:00:00.000+09:00', null],
    ]);
    expect('active_seconds_user' in ops[0].data && 'value' in ops[1].data).toBe(true);
    expect(ops[0].data.prediction).toBe('예측');
  });

  it('보내는 중인 변경이 값을 실은 칸을 곧바로 비우면(서버가 곧 그 값을 가짐) null 을 보낸다', async () => {
    const s = await newStore();
    await s.put('user_pref', { pref_key: 'practice_week:2026-11-16', value: { edited_seconds: 7800 } });
    const [sent] = await s.pendingOps(10);
    s.inflight.add(sent.op_id);
    await s.put('user_pref', { pref_key: 'practice_week:2026-11-16', value: null });
    const ops = await s.pendingOps(10);
    expect(ops.map((o) => o.data)).toEqual([{ value: { edited_seconds: 7800 } }, { value: null }]);
  });

  it('버린 실행이 보내던 변경은 그 요청이 끊겨 실패한 뒤에도 보내는 중으로 남아, 그 사이 같은 칸을 비우면 null 을 보낸다(서버가 이미 받았을 수 있음)', async () => {
    const s = await newStore();
    await s.put('user_pref', { pref_key: 'practice_week:2026-11-16', value: { edited_seconds: 7800 } });
    const r = recorder(async (_u, i) => untilAborted(i));
    const t = manualTimers();
    const m = new SyncManager(s, { fetch: r.fetch, timers: t.timers, clientId: 'c1' });
    void m.retryNow();
    expect(await eventually(() => r.calls.length === 1)).toBe(true);
    t.fire(config.firstPullMaxMs);
    // 버려진 실행의 보내기가 실패로 끝난(그 실행의 catch 가 돈) 뒤에 같은 행을 고친다
    await afterAbort(r.calls[0].signal);
    await s.put('user_pref', { pref_key: 'practice_week:2026-11-16', value: null });
    const ops = await s.pendingOps(10);
    expect(ops.map((o) => o.data)).toEqual([{ value: { edited_seconds: 7800 } }, { value: null }]);
  });

  it('동기화 관리자는 서버가 받은 변경을 대기열에서 지운 뒤에야 보내는 중 표시를 푼다', async () => {
    const s = await newStore();
    s.markPulled();
    await s.put('user_pref', { pref_key: 'practice_week:2026-11-16', value: { edited_seconds: 7800 } });
    const [sent] = await s.pendingOps(10);
    const marks: boolean[] = [];
    const r = recorder(async (_u, i) => appliedAll(i));
    const m = new SyncManager(s, { fetch: r.fetch, timers: manualTimers().timers, clientId: 'c1' });
    s.subscribe((e) => {
      if (e.type === 'queue') marks.push(s.inflight.has(sent.op_id));
    });
    await m.flush();
    expect(marks).toEqual([true]);
    expect(s.inflight.size).toBe(0);
  });
});

describe('화면 저장 상한(saveWithin)', () => {
  it('상한 안에 끝나면 그 값, 넘으면 실패로 끝나고 타이머를 남기지 않는다', async () => {
    const t = manualTimers();
    expect(await saveWithin(Promise.resolve(7), config.saveMaxMs, t.timers)).toBe(7);
    expect(t.delays()).toEqual([]);
    const slow = track(saveWithin(new Promise(() => {}), config.saveMaxMs, t.timers));
    await sleep(0);
    expect(slow.done).toBe(false);
    t.fire(config.saveMaxMs);
    await sleep(0);
    expect(slow.error).toBeInstanceOf(Error);
  });
});
