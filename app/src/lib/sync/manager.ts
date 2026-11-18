// 동기화: 대기열을 POST /api/sync 로 보내고, 표시를 저장됨 / 동기화 중(1초 넘을 때만) / 오프라인 으로 바꾼다.
// 재시도: 연결 복구 즉시, 그 밖에는 30초·1분·5분(그 뒤 5분마다). spec 0.6, DESIGN.md 12.5절.
// 서버가 401(no_user)이면 오프라인이 아니라 "계정을 골라 주세요"(account) 상태로 두고 onUnauthorized 를 부른다.
// 401 본문에 auth_provider: "tailscale" 이 있으면(폰, 학습 계정에 안 이어진 접속자) state.authProvider 에 남겨 화면이 안내를 바꾼다.
// 처음 상태는 checking: 계정과 첫 서버 확인(첫 flush)이 끝나기 전에는 "저장됨"을 보이지 않는다.
// 실행(보내기 → 받기)마다 세대 번호를 매겨, 첫 받기 상한(config.firstPullMaxMs)을 넘기거나 다시 시도·연결 복구가 오면 지금 실행을 버린다.
// 버린 실행은 요청이 끊기고 await 바로 뒤 검사에서 멈춘다(그때 이미 시작한 저장소 쓰기 하나는 끝까지 가지만 그 자체로 일관된다).
// 보낸 변경은 대기열에 남아 같은 op_id 로 다시 간다(서버는 한 번만 반영, server/API.md 2절).

import { config } from '../../config';
import { NetworkError, errorAuthProvider, getState, postSync, type AuthProvider, type FetchLike } from '../api';
import type { LocalStore } from './store';

export type SyncDisplay = 'checking' | 'saved' | 'syncing' | 'offline' | 'account';

export interface Timers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
}

/** 브라우저 타이머. 시험은 손으로 돌리는 타이머를 넣는다 */
export const systemTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface SyncState {
  display: SyncDisplay;
  pending: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  nextRetryInMs: number | null;
  rejected: { op_id: string; reason_ko: string }[];
  /** 401 본문이 알려 준 로그인 길. tailscale 이면 "Tailscale 계정이 학습 계정에 안 이어짐". 옛 401 이면 null */
  authProvider: AuthProvider | null;
}

export interface SyncOptions {
  fetch?: FetchLike;
  timers?: Timers;
  clientId: string;
  retryDelaysMs?: number[];
  indicatorDelayMs?: number;
  /** 첫 받기를 기다리는 상한. 기본 config.firstPullMaxMs */
  firstPullMaxMs?: number;
  batchSize?: number;
  /** 서버가 401(계정 없음)을 돌려줄 때 */
  onUnauthorized?: () => void;
  /** 보내기(와 받기)가 끝나 "저장됨"이 될 때마다. 기다리지 않는다 */
  onSynced?: () => void;
  /** 받기에서 사본에 넣지 못한 서버 행(이 기기의 못 보낸 변경이 더 늦음). 끝날 때까지 기다린 뒤 받은 번호를 올린다 */
  onKeptServerRows?: (rows: KeptServerRow[]) => Promise<unknown>;
}

/** 동기화 실행 한 번. settled 는 끝나거나 버려질 때 풀린다. ctrl 은 그 실행의 요청을 끊는다 */
interface Run {
  gen: number;
  ctrl: AbortController | null;
  settled: Promise<void>;
  resolve: () => void;
  reject: (e: unknown) => void;
}

/** 버린 실행이 다음 걸음에서 멈추게 던진다 */
class RunAbandoned extends Error {}

/** 받기에서 이 기기의 아직 못 보낸 변경을 지키느라 사본에 넣지 못한 서버 행 */
export interface KeptServerRow {
  table: string;
  row: Record<string, unknown>;
}

export class SyncManager {
  state: SyncState = { display: 'checking', pending: 0, lastSyncedAt: null, lastError: null, nextRetryInMs: null, rejected: [], authProvider: null };
  private listeners = new Set<(s: SyncState) => void>();
  private fetchImpl: FetchLike;
  private timers: Timers;
  private retryIdx = 0;
  private retryHandle: unknown = null;
  private indicatorHandle: unknown = null;
  /** 지금 세대. 실행을 시작하거나 버릴 때 올린다 */
  private gen = 0;
  private current: Run | null = null;
  private again = false;
  /** 받기 요청(다시 시도·재시도·연결 복구)이 아직 채워지지 않았다. 지금 실행에 합쳐진 요청도 잃지 않게 실행이 받기 직전에 본다 */
  private pullWanted = false;
  private awaitingFirstPull = true;
  private firstPullHandle: unknown = null;
  private kickHandle: unknown = null;
  private unsub: (() => void) | null = null;

  constructor(
    private store: LocalStore,
    private opts: SyncOptions,
  ) {
    store.expectFirstPull();
    this.fetchImpl = opts.fetch ?? ((u, i) => fetch(u, i));
    this.timers = opts.timers ?? systemTimers;
  }

  subscribe(fn: (s: SyncState) => void): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  /** 페이지마다 한 번: 연결 복구 감지, 변경 감지, 서버 상태 받기, 남은 대기열 보내기 */
  start(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.handleOnline());
    }
    this.unsub = this.store.subscribe((e) => {
      if (e.type === 'put') this.kick();
    });
    void this.store.queueSize().then((n) => this.set({ pending: n }));
    void this.retryNow();
  }

  stop(): void {
    this.unsub?.();
    if (this.retryHandle) this.timers.clearTimeout(this.retryHandle);
    if (this.firstPullHandle) this.timers.clearTimeout(this.firstPullHandle);
  }

  /** 변경이 연달아 들어오면 한 번에 보낸다 */
  private kick() {
    if (this.kickHandle) return;
    this.kickHandle = this.timers.setTimeout(() => {
      this.kickHandle = null;
      void this.flush();
    }, 50);
  }

  async handleOnline(): Promise<void> {
    this.retryIdx = 0;
    await this.retryNow();
  }

  /** "지금 다시 시도": 멈춰 있을 수 있는 지금 실행에 합치지 않고 버린 뒤 새로 보낸다 */
  async retryNow(): Promise<void> {
    if (this.retryHandle) {
      this.timers.clearTimeout(this.retryHandle);
      this.retryHandle = null;
    }
    this.abandon();
    await this.flush({ pull: true });
  }

  private beginBusy() {
    if (this.indicatorHandle) return;
    const delay = this.opts.indicatorDelayMs ?? config.syncingIndicatorDelayMs;
    this.indicatorHandle = this.timers.setTimeout(() => {
      this.indicatorHandle = null;
      if (this.current) this.set({ display: 'syncing' });
    }, delay);
  }

  private endBusy() {
    if (this.indicatorHandle) {
      this.timers.clearTimeout(this.indicatorHandle);
      this.indicatorHandle = null;
    }
  }

  private scheduleRetry() {
    const delays = this.opts.retryDelaysMs ?? config.retryDelaysMs;
    const ms = delays[Math.min(this.retryIdx, delays.length - 1)];
    this.retryIdx++;
    if (this.retryHandle) this.timers.clearTimeout(this.retryHandle);
    this.retryHandle = this.timers.setTimeout(() => {
      this.retryHandle = null;
      void this.flush({ pull: true });
    }, ms);
    this.set({ nextRetryInMs: ms });
  }

  /** 서버의 바뀐 기록을 받아 사본에 합친다 */
  async pull(): Promise<void> {
    await this.pullWith(undefined, () => undefined);
  }

  /** alive: await 바로 뒤에 불러, 그 사이 실행이 버려졌으면 멈춘다 */
  private async pullWith(signal: AbortSignal | undefined, alive: () => void): Promise<void> {
    const since = (await this.store.getMeta<number>('last_server_seq')) ?? null;
    alive();
    const res = await getState(this.fetchImpl, since, signal);
    alive();
    const kept: KeptServerRow[] = [];
    await this.store.mergeServerRows(res.tables as Record<string, Record<string, unknown>[]>, (table, row) => kept.push({ table, row }));
    alive();
    // 사본에 넣지 못한 서버 행(옛 판 기록일 수 있음)을 받은 번호를 올리기 전에 넘긴다: 실패하면 다음 받기에서 다시 받는다
    if (kept.length && this.opts.onKeptServerRows) {
      await this.opts.onKeptServerRows(kept);
      alive();
    }
    if (res.server_seq != null) {
      await this.store.setMeta('last_server_seq', res.server_seq);
      alive();
    }
  }

  async flush(o: { pull?: boolean } = {}): Promise<void> {
    if (o.pull) this.pullWanted = true;
    if (this.current) {
      this.again = true;
      return this.current.settled;
    }
    const run = this.begin();
    try {
      await run.settled;
    } finally {
      if (this.current === run) {
        this.current = null;
        this.endBusy();
      }
    }
    if (!this.current && this.again) {
      this.again = false;
      await this.flush();
    }
  }

  private begin(): Run {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const settled = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const run: Run = { gen: ++this.gen, ctrl, settled, resolve, reject };
    this.current = run;
    this.beginBusy();
    if (this.awaitingFirstPull && !this.firstPullHandle) {
      this.firstPullHandle = this.timers.setTimeout(() => this.giveUpFirstPull(), this.opts.firstPullMaxMs ?? config.firstPullMaxMs);
    }
    this.doFlush(run).then(run.resolve, run.reject);
    return run;
  }

  /** 지금 실행을 버린다: 세대를 올려 그 실행이 다음 걸음에서 멈추게 하고, 그 실행의 요청을 끊고, 그 실행을 기다리던 쪽을 풀어 준다 */
  private abandon(): void {
    const run = this.current;
    if (!run) return;
    this.gen++;
    this.current = null;
    this.again = false;
    // 버린 실행이 서버 기록을 받았는지 모른다
    this.pullWanted = true;
    this.endBusy();
    run.ctrl?.abort();
    run.resolve();
  }

  /** 첫 받기가 상한 안에 끝나지 않았다: 멈춘 실행을 버리고 이 기기 사본으로 계속한다(단계 쓰기가 기다림에서 풀리고, 쓴 것은 대기열에 남는다) */
  private giveUpFirstPull(): void {
    this.firstPullHandle = null;
    if (!this.awaitingFirstPull) return;
    const stalled = this.current !== null;
    this.abandon();
    this.stopWaitingFirstPull();
    this.store.continueWithoutPull();
    if (!stalled) return;
    this.set({ display: 'offline', lastError: '서버 응답이 늦습니다' });
    this.scheduleRetry();
  }

  private stopWaitingFirstPull(): void {
    this.awaitingFirstPull = false;
    if (this.firstPullHandle) {
      this.timers.clearTimeout(this.firstPullHandle);
      this.firstPullHandle = null;
    }
  }

  private async doFlush(run: Run): Promise<void> {
    const alive = () => {
      if (run.gen !== this.gen) throw new RunAbandoned();
    };
    const signal = run.ctrl?.signal;
    const batch = this.opts.batchSize ?? config.syncBatchSize;
    try {
      let needPull = false;
      for (;;) {
        for (;;) {
          const ops = await this.store.pendingOps(batch);
          alive();
          if (!ops.length) break;
          for (const op of ops) this.store.inflight.add(op.op_id);
          let res;
          try {
            res = await postSync(
              this.fetchImpl,
              {
                client_id: this.opts.clientId,
                ops: ops.map(({ op_id, table, key, data, updated_at, base_updated_at }) =>
                  base_updated_at ? { op_id, table, key, data, updated_at, base_updated_at } : { op_id, table, key, data, updated_at },
                ),
              },
              signal,
            );
            alive();
          } catch (e) {
            if (run.gen === this.gen) for (const op of ops) this.store.inflight.delete(op.op_id);
            throw e;
          }
          const done = [...res.applied, ...res.superseded, ...res.rejected.map((r) => r.op_id)];
          const appliedSet = new Set(res.applied);
          // 서버가 받은 변경은 대기열에서 지울 때까지 보내는 중으로 둔다: 그 사이 같은 행을 고쳐도 서버가 곧 가질 값을 안다(store.put)
          await this.store.removeOps(
            done,
            ops.filter((o) => appliedSet.has(o.op_id)),
          );
          alive();
          for (const op of ops) this.store.inflight.delete(op.op_id);
          if (res.rejected.length) {
            const log = [...this.state.rejected, ...res.rejected].slice(-50);
            this.set({ rejected: log });
            await this.store.setMeta('rejected_log', log);
            alive();
          }
          if (res.server_time) this.set({ lastSyncedAt: res.server_time });
          // 서버에 더 새 값이 있었으면 서버 값을 받아 화면을 맞춘다 (server/API.md 2절)
          if (res.superseded.length) needPull = true;
          if (!done.length) break; // 서버가 아무것도 받지 않았으면 같은 묶음을 계속 보내지 않는다
        }
        if (!needPull && !this.pullWanted) break;
        needPull = false;
        this.pullWanted = false;
        try {
          await this.pullWith(signal, alive);
        } catch (e) {
          this.pullWanted = true;
          throw e;
        }
        this.stopWaitingFirstPull();
        // 실제로 받았다. 받기 전이라 보내지 않고 둔 변경이 있으면 이 실행에서 마저 보낸다
        if (!this.store.markPulled()) break;
      }
      this.retryIdx = 0;
      const pending = await this.store.queueSize();
      alive();
      this.set({ display: 'saved', lastError: null, nextRetryInMs: null, pending });
      this.opts.onSynced?.();
    } catch (e) {
      if (run.gen !== this.gen) return; // 버린 실행: 상태·표시·기다림을 바꾸지 않는다
      // 받지 못했으면(오프라인·계정 없음) 이 기기 사본으로 계속한다
      this.stopWaitingFirstPull();
      this.store.continueWithoutPull();
      const pending = await this.store.queueSize();
      if (run.gen !== this.gen) return;
      if (e instanceof NetworkError && e.status === 401) {
        this.set({
          display: 'account',
          lastError: '계정이 없습니다',
          pending,
          authProvider: errorAuthProvider(e) ?? this.state.authProvider,
        });
        this.opts.onUnauthorized?.();
        return;
      }
      this.set({ display: 'offline', lastError: String((e as Error)?.message ?? e), pending });
      this.scheduleRetry();
    }
  }
}
