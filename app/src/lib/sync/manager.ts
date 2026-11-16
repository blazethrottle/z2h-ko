// 동기화: 대기열을 POST /api/sync 로 보내고, 표시를 저장됨 / 동기화 중(1초 넘을 때만) / 오프라인 으로 바꾼다.
// 재시도: 연결 복구 즉시, 그 밖에는 30초·1분·5분(그 뒤 5분마다). spec 0.6, DESIGN.md 12.5절.
// 서버가 401(no_user)이면 오프라인이 아니라 "계정을 골라 주세요"(account) 상태로 두고 onUnauthorized 를 부른다.

import { config } from '../../config';
import { NetworkError, getState, postSync, type FetchLike } from '../api';
import type { LocalStore } from './store';

export type SyncDisplay = 'saved' | 'syncing' | 'offline' | 'account';

export interface Timers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
}

export interface SyncState {
  display: SyncDisplay;
  pending: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  nextRetryInMs: number | null;
  rejected: { op_id: string; reason_ko: string }[];
}

export interface SyncOptions {
  fetch?: FetchLike;
  timers?: Timers;
  clientId: string;
  retryDelaysMs?: number[];
  indicatorDelayMs?: number;
  batchSize?: number;
  /** 서버가 401(계정 없음)을 돌려줄 때 */
  onUnauthorized?: () => void;
}

export class SyncManager {
  state: SyncState = { display: 'saved', pending: 0, lastSyncedAt: null, lastError: null, nextRetryInMs: null, rejected: [] };
  private listeners = new Set<(s: SyncState) => void>();
  private fetchImpl: FetchLike;
  private timers: Timers;
  private retryIdx = 0;
  private retryHandle: unknown = null;
  private indicatorHandle: unknown = null;
  private running: Promise<void> | null = null;
  private again = false;
  private kickHandle: unknown = null;
  private unsub: (() => void) | null = null;

  constructor(
    private store: LocalStore,
    private opts: SyncOptions,
  ) {
    this.fetchImpl = opts.fetch ?? ((u, i) => fetch(u, i));
    this.timers = opts.timers ?? {
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    };
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

  /** "지금 다시 시도" */
  async retryNow(): Promise<void> {
    if (this.retryHandle) {
      this.timers.clearTimeout(this.retryHandle);
      this.retryHandle = null;
    }
    await this.flush({ pull: true });
  }

  private beginBusy() {
    if (this.indicatorHandle) return;
    const delay = this.opts.indicatorDelayMs ?? config.syncingIndicatorDelayMs;
    this.indicatorHandle = this.timers.setTimeout(() => {
      this.indicatorHandle = null;
      if (this.running) this.set({ display: 'syncing' });
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
    const since = (await this.store.getMeta<number>('last_server_seq')) ?? null;
    const res = await getState(this.fetchImpl, since);
    await this.store.mergeServerRows(res.tables as Record<string, Record<string, unknown>[]>);
    if (res.server_seq != null) await this.store.setMeta('last_server_seq', res.server_seq);
  }

  async flush(o: { pull?: boolean } = {}): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.doFlush(!!o.pull);
    try {
      await this.running;
    } finally {
      this.running = null;
      this.endBusy();
    }
    if (this.again) {
      this.again = false;
      await this.flush();
    }
  }

  private async doFlush(withPull: boolean): Promise<void> {
    this.beginBusy();
    const batch = this.opts.batchSize ?? config.syncBatchSize;
    try {
      let needPull = withPull;
      for (;;) {
        const ops = await this.store.pendingOps(batch);
        if (!ops.length) break;
        for (const op of ops) this.store.inflight.add(op.op_id);
        let res;
        try {
          res = await postSync(this.fetchImpl, {
            client_id: this.opts.clientId,
            ops: ops.map(({ op_id, table, key, data, updated_at, base_updated_at }) =>
              base_updated_at ? { op_id, table, key, data, updated_at, base_updated_at } : { op_id, table, key, data, updated_at },
            ),
          });
        } finally {
          for (const op of ops) this.store.inflight.delete(op.op_id);
        }
        const done = [...res.applied, ...res.superseded, ...res.rejected.map((r) => r.op_id)];
        const appliedSet = new Set(res.applied);
        await this.store.removeOps(
          done,
          ops.filter((o) => appliedSet.has(o.op_id)),
        );
        if (res.rejected.length) {
          const log = [...this.state.rejected, ...res.rejected].slice(-50);
          this.set({ rejected: log });
          await this.store.setMeta('rejected_log', log);
        }
        if (res.server_time) this.set({ lastSyncedAt: res.server_time });
        // 서버에 더 새 값이 있었으면 서버 값을 받아 화면을 맞춘다 (server/API.md 2절)
        if (res.superseded.length) needPull = true;
        if (!done.length) break; // 서버가 아무것도 받지 않았으면 같은 묶음을 계속 보내지 않는다
      }
      if (needPull) await this.pull();
      this.retryIdx = 0;
      this.set({ display: 'saved', lastError: null, nextRetryInMs: null, pending: await this.store.queueSize() });
    } catch (e) {
      if (e instanceof NetworkError && e.status === 401) {
        this.set({ display: 'account', lastError: '계정이 없습니다', pending: await this.store.queueSize() });
        this.opts.onUnauthorized?.();
        return;
      }
      this.set({ display: 'offline', lastError: String((e as Error)?.message ?? e), pending: await this.store.queueSize() });
      this.scheduleRetry();
    }
  }
}
