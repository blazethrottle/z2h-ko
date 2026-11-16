import { useEffect, useState, useCallback, useRef } from 'preact/hooks';
import { getRuntime, type Runtime } from '../lib/runtime';
import type { Row } from '../lib/sync/store';
import type { SyncState } from '../lib/sync/manager';

export function useRuntime(): Runtime | null {
  const [rt, setRt] = useState<Runtime | null>(null);
  useEffect(() => {
    let alive = true;
    getRuntime()
      .then((r) => alive && setRt(r))
      .catch(() => {
        /* IndexedDB를 못 쓰는 브라우저: 화면은 그대로, 저장만 안 됨 */
      });
    return () => {
      alive = false;
    };
  }, []);
  return rt;
}

/** 여러 표의 행을 읽고, 바뀌면 다시 읽는다 */
export function useTables(rt: Runtime | null, tables: string[]): Record<string, Row[]> | null {
  const [data, setData] = useState<Record<string, Row[]> | null>(null);
  const key = tables.join(',');
  const load = useCallback(async () => {
    if (!rt) return;
    const out: Record<string, Row[]> = {};
    for (const t of tables) out[t] = await rt.store.list(t);
    setData(out);
  }, [rt, key]);
  useEffect(() => {
    if (!rt) return;
    void load();
    return rt.store.subscribe(() => void load());
  }, [rt, load]);
  return data;
}

export function useSyncState(rt: Runtime | null): SyncState | null {
  const [s, setS] = useState<SyncState | null>(null);
  useEffect(() => {
    if (!rt) return;
    return rt.sync.subscribe(setS);
  }, [rt]);
  return s;
}

/** 이 기기에만 두는 화면 상태. 저장해 둔 값을 늦게 읽어 와도, 그 사이 사용자가 바꾼 값을 덮지 않는다 */
export function useUiState<T>(rt: Runtime | null, key: string, initial: T): [T, (v: T) => void, boolean] {
  const [v, setV] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const touched = useRef(false);
  useEffect(() => {
    if (!rt) return;
    let alive = true;
    rt.store.getUi<T>(key).then((x) => {
      if (!alive) return;
      if (x !== undefined && !touched.current) setV(x);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [rt, key]);
  const set = useCallback(
    (nv: T) => {
      touched.current = true;
      setV(nv);
      void rt?.store.setUi(key, nv);
    },
    [rt, key],
  );
  return [v, set, ready];
}

export function useNow(intervalMs = 30_000): number {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const h = setInterval(() => setN(Date.now()), intervalMs);
    return () => clearInterval(h);
  }, [intervalMs]);
  return n;
}
