// 브라우저 저장: IndexedDB 대기열 + 마지막 상태 사본 (DESIGN.md 12.1·12.5절).
// 모든 변경은 먼저 rows(사본)와 queue(보낼 목록)에 같은 트랜잭션으로 들어간다.
// 계정마다 다른 DB를 쓴다(z2h-u-{user_id}). 계정을 아직 모를 때(첫 실행이 오프라인)는 z2h-pending 에 두었다가 계정이 정해지면 옮긴다.

import { openDB, type IDBPDatabase } from 'idb';
import { nowKst, uuid4 } from '../time';
import { SERVER_FIELDS, TABLE_KEYS, keyOf, keyString, type TableName } from './tables';
import type { SyncOp } from '../api';

export type Row = Record<string, any>;

interface RowRec {
  id: string;
  table: string;
  key: Record<string, unknown>;
  data: Row;
  updated_at: string;
  /** 이 행에 대해 서버가 가진 것으로 아는 updated_at (base_updated_at 으로 보냄) */
  base_at?: string | null;
}

export interface QueuedOp extends SyncOp {
  seq?: number;
  keyStr: string;
}

/** 서버로 보내는 data: 서버가 정하는 칸(user_id, updated_at, attempt_no 등)과 열쇠 칸은 뺀다 (server/API.md 3절) */
export function opData(table: string, row: Row): Row {
  const keyCols = new Set(TABLE_KEYS[table as TableName] ?? []);
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) if (!SERVER_FIELDS.has(k) && !keyCols.has(k)) out[k] = v;
  return out;
}

export type StoreEvent = { type: 'put' | 'merge' | 'queue'; table?: string };

export class LocalStore {
  /** 지금 서버로 보내는 중인 op_id (합치기 대상에서 뺀다) */
  readonly inflight = new Set<string>();
  private listeners = new Set<(e: StoreEvent) => void>();

  private constructor(
    private db: IDBPDatabase,
    /** 이 기기 사본의 행에 붙일 계정 id (계정을 모르면 null) */
    readonly userId: string | null,
  ) {}

  static async open(name: string, userId: string | null = null): Promise<LocalStore> {
    const db = await openDB(name, 1, {
      upgrade(d) {
        d.createObjectStore('rows', { keyPath: 'id' }).createIndex('table', 'table');
        const q = d.createObjectStore('queue', { keyPath: 'seq', autoIncrement: true });
        q.createIndex('keyStr', 'keyStr');
        q.createIndex('op_id', 'op_id', { unique: true });
        d.createObjectStore('meta', { keyPath: 'k' });
        d.createObjectStore('ui', { keyPath: 'k' });
      },
    });
    return new LocalStore(db, userId);
  }

  subscribe(fn: (e: StoreEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: StoreEvent) {
    for (const fn of this.listeners) {
      try {
        fn(e);
      } catch {
        /* 화면 오류가 저장을 막지 않게 */
      }
    }
  }

  /** 행 전체를 쓰고 대기열에 넣는다. 보내지 않은 같은 행 변경은 새 것 하나로 합친다 */
  async put(table: string, row: Row, updatedAt: string = nowKst()): Promise<Row> {
    const data: Row = { ...row, updated_at: updatedAt };
    if (this.userId) data.user_id = this.userId;
    else delete data.user_id;
    const key = keyOf(table, data);
    const ks = keyString(table, key);
    const tx = this.db.transaction(['rows', 'queue'], 'readwrite');
    const prev = (await tx.objectStore('rows').get(ks)) as RowRec | undefined;
    const base = prev?.base_at ?? null;
    await tx.objectStore('rows').put({ id: ks, table, key, data, updated_at: updatedAt, base_at: base } satisfies RowRec);
    let cur = await tx.objectStore('queue').index('keyStr').openCursor(IDBKeyRange.only(ks));
    while (cur) {
      if (!this.inflight.has(cur.value.op_id)) await cur.delete();
      cur = await cur.continue();
    }
    const op: QueuedOp = { op_id: uuid4(), table, key, keyStr: ks, data: opData(table, data), updated_at: updatedAt };
    if (base) op.base_updated_at = base;
    await tx.objectStore('queue').add(op);
    await tx.done;
    this.emit({ type: 'put', table });
    return data;
  }

  /** 있는 행에 바꿀 칸만 덮어써서 put */
  async patch(table: string, keyFields: Row, changes: Row): Promise<Row> {
    const prev = (await this.get(table, keyFields)) ?? {};
    return this.put(table, { ...prev, ...keyFields, ...changes });
  }

  async get(table: string, keyFields: Row): Promise<Row | undefined> {
    const rec = (await this.db.get('rows', keyString(table, keyOf(table, keyFields)))) as RowRec | undefined;
    return rec?.data;
  }

  async list(table: string): Promise<Row[]> {
    const recs = (await this.db.getAllFromIndex('rows', 'table', table)) as RowRec[];
    return recs.map((r) => r.data);
  }

  async pendingOps(limit: number): Promise<QueuedOp[]> {
    return (await this.db.getAll('queue', undefined, limit)) as QueuedOp[];
  }

  async queueSize(): Promise<number> {
    return this.db.count('queue');
  }

  /** 끝난 op 를 대기열에서 지운다. applied 인 op 는 서버가 그 updated_at 을 가졌으므로 다음 base 로 기억한다 */
  async removeOps(opIds: string[], applied: QueuedOp[] = []): Promise<void> {
    if (!opIds.length) return;
    const tx = this.db.transaction(['queue', 'rows'], 'readwrite');
    const idx = tx.objectStore('queue').index('op_id');
    for (const id of opIds) {
      const k = await idx.getKey(id);
      if (k !== undefined) await tx.objectStore('queue').delete(k);
    }
    for (const op of applied) {
      const rec = (await tx.objectStore('rows').get(op.keyStr)) as RowRec | undefined;
      if (rec) await tx.objectStore('rows').put({ ...rec, base_at: op.updated_at });
    }
    await tx.done;
    this.emit({ type: 'queue' });
  }

  /** 계정이 정해지기 전에 쌓인 사본·대기열을 이 계정 DB로 옮긴다 */
  async importFrom(other: LocalStore): Promise<number> {
    const recs = (await other.db.getAll('rows')) as RowRec[];
    const ops = (await other.db.getAll('queue')) as QueuedOp[];
    if (!recs.length && !ops.length) return 0;
    const tx = this.db.transaction(['rows', 'queue'], 'readwrite');
    for (const r of recs) await tx.objectStore('rows').put({ ...r, data: { ...r.data, ...(this.userId ? { user_id: this.userId } : {}) } });
    for (const { seq, ...op } of ops) await tx.objectStore('queue').add(op);
    await tx.done;
    const ctx = other.db.transaction(['rows', 'queue'], 'readwrite');
    await ctx.objectStore('rows').clear();
    await ctx.objectStore('queue').clear();
    await ctx.done;
    this.emit({ type: 'merge' });
    return recs.length + ops.length;
  }

  /** 서버 행을 사본에 합친다. 아직 못 보낸 내 변경이 더 늦으면 내 것을 둔다 */
  async mergeServerRows(tables: Record<string, Row[]>): Promise<number> {
    let n = 0;
    const tx = this.db.transaction(['rows', 'queue'], 'readwrite');
    for (const [table, rows] of Object.entries(tables)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        let key: Record<string, unknown>;
        try {
          key = keyOf(table, row);
        } catch {
          continue;
        }
        const ks = keyString(table, key);
        const local = (await tx.objectStore('rows').get(ks)) as RowRec | undefined;
        const pending = (await tx.objectStore('queue').index('keyStr').count(IDBKeyRange.only(ks))) > 0;
        const serverAt = String(row.updated_at ?? row.at ?? row.created_at ?? '');
        if (pending && local && (!serverAt || Date.parse(local.updated_at) >= Date.parse(serverAt))) {
          // 내 변경을 지키되, 서버가 가진 값의 시각은 기억해 둔다(다음 op 의 base_updated_at)
          await tx.objectStore('rows').put({ ...local, base_at: serverAt || local.base_at || null });
          continue;
        }
        await tx.objectStore('rows').put({ id: ks, table, key, data: row, updated_at: serverAt || local?.updated_at || '', base_at: serverAt || null } satisfies RowRec);
        n++;
      }
    }
    await tx.done;
    if (n) this.emit({ type: 'merge' });
    return n;
  }

  async getMeta<T = unknown>(k: string): Promise<T | undefined> {
    return ((await this.db.get('meta', k)) as { v: T } | undefined)?.v;
  }
  async setMeta(k: string, v: unknown): Promise<void> {
    await this.db.put('meta', { k, v });
  }

  /** 이 기기에만 두는 화면 상태(힌트 열람 시각 등). 동기화하지 않는다 */
  async getUi<T = unknown>(k: string): Promise<T | undefined> {
    return ((await this.db.get('ui', k)) as { v: T } | undefined)?.v;
  }
  async setUi(k: string, v: unknown): Promise<void> {
    await this.db.put('ui', { k, v });
  }

  async exportAll(): Promise<{ exported_at: string; user_id: string | null; tables: Record<string, Row[]>; pending_ops: QueuedOp[] }> {
    const recs = (await this.db.getAll('rows')) as RowRec[];
    const tables: Record<string, Row[]> = {};
    for (const r of recs) (tables[r.table] ??= []).push(r.data);
    return { exported_at: nowKst(), user_id: this.userId, tables, pending_ops: (await this.db.getAll('queue')) as QueuedOp[] };
  }
}
