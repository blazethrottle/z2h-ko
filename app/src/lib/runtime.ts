// 페이지마다 하나: 계정 확인 → 계정별 브라우저 저장소 + 동기화 관리자. 여러 부품(island)이 같은 것을 쓴다.
// 계정(D43·D44, server/API.md 1절): 처음 열 때 /api/me 로 확인하고, 없으면 로컬 개발용 계정을 자동으로 고르거나 만든다.
// 가입·로그인 화면(이메일·Google)은 만들지 않는다. 개발용 계정 바꾸기는 /settings/.

import { config } from '../config';
import { NetworkError, createDevAccount, getMe, listDevAccounts, loginDevAccount, type Account, type FetchLike } from './api';
import { LocalStore } from './sync/store';
import { SyncManager } from './sync/manager';
import { uuid4 } from './time';

export type AccountState = 'ok' | 'offline' | 'none';

export interface Runtime {
  store: LocalStore;
  sync: SyncManager;
  account: Account | null;
  accountState: AccountState;
}

const ACCOUNT_KEY = 'z2h.account';
const CLIENT_KEY = 'z2h.client_id';
export const PENDING_DB = 'z2h-pending';
export const accountDbName = (userId: string) => `z2h-u-${userId}`;

export function readLastAccount(): Account | null {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(ACCOUNT_KEY) ?? 'null');
    return v && typeof v.user_id === 'string' ? v : null;
  } catch {
    return null;
  }
}
export function rememberAccount(a: Account | null) {
  if (a) globalThis.localStorage?.setItem(ACCOUNT_KEY, JSON.stringify({ user_id: a.user_id, display_name: a.display_name ?? null }));
  else globalThis.localStorage?.removeItem(ACCOUNT_KEY);
}

/**
 * 지금 계정을 정한다. 있으면 그대로, 없으면(401) 개발용 계정 목록에서 마지막에 쓴 계정 → 첫 계정 → 새로 만들기 순.
 * 서버에 닿지 못하면 offline, 개발용 로그인이 막혀 있으면(예: 터널) none.
 */
export async function ensureAccount(f: FetchLike, last: Account | null = readLastAccount()): Promise<{ account: Account | null; state: AccountState }> {
  try {
    return { account: await getMe(f), state: 'ok' };
  } catch (e) {
    if (!(e instanceof NetworkError) || e.status !== 401) return { account: null, state: 'offline' };
  }
  try {
    const { accounts } = await listDevAccounts(f);
    const pick = accounts.find((a) => a.user_id === last?.user_id) ?? accounts[0];
    const account = pick ? { ...pick, ...(await loginDevAccount(f, pick.user_id)) } : await createDevAccount(f, `${config.devAccountName} 1`);
    return { account, state: 'ok' };
  } catch (e) {
    return { account: null, state: e instanceof NetworkError && e.status == null ? 'offline' : 'none' };
  }
}

function clientId(): string {
  let id = globalThis.localStorage?.getItem(CLIENT_KEY);
  if (!id) {
    id = `web-${uuid4()}`;
    globalThis.localStorage?.setItem(CLIENT_KEY, id);
  }
  return id;
}

let rt: Promise<Runtime> | null = null;

export function getRuntime(): Promise<Runtime> {
  if (!rt) {
    rt = (async () => {
      const f: FetchLike = (u, i) => fetch(u, i);
      const res = await ensureAccount(f);
      if (res.account) rememberAccount(res.account);
      // 서버에 닿지 못하면 마지막으로 쓴 계정의 사본으로 계속 학습한다
      const account = res.account ?? (res.state === 'offline' ? readLastAccount() : null);
      const store = await LocalStore.open(account ? accountDbName(account.user_id) : PENDING_DB, account?.user_id ?? null);
      if (account) {
        const pending = await LocalStore.open(PENDING_DB, null);
        await store.importFrom(pending);
      }
      let lastRecover = 0;
      const sync: SyncManager = new SyncManager(store, {
        clientId: clientId(),
        onUnauthorized: () => {
          // 세션이 끊겼거나 처음 계정이 없던 경우: 30초에 한 번만 계정을 다시 정해 본다
          if (Date.now() - lastRecover < 30_000) return;
          lastRecover = Date.now();
          void ensureAccount(f).then((r) => {
            if (!r.account) return;
            rememberAccount(r.account);
            if (r.account.user_id === account?.user_id) void sync.retryNow();
            else location.reload(); // 다른 계정이 되면 그 계정의 사본으로 다시 연다
          });
        },
      });
      sync.start();
      return { store, sync, account, accountState: res.account ? 'ok' : res.state };
    })();
  }
  return rt;
}

/** 개발용 계정 바꾸기·만들기 뒤에는 그 계정의 사본으로 다시 연다 */
export async function switchDevAccount(userId: string): Promise<void> {
  const a = await loginDevAccount((u, i) => fetch(u, i), userId);
  rememberAccount(a);
  location.reload();
}
export async function createAndUseDevAccount(name: string): Promise<void> {
  const a = await createDevAccount((u, i) => fetch(u, i), name);
  rememberAccount(a);
  location.reload();
}

/** 늦게 불러오는 정적 JSON (풀이·힌트). 같은 주소는 한 번만 받는다 */
const jsonCache = new Map<string, Promise<any>>();
export function fetchJsonOnce<T = any>(url: string): Promise<T> {
  let p = jsonCache.get(url);
  if (!p) {
    p = fetch(url, { credentials: 'same-origin' }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => jsonCache.delete(url));
    jsonCache.set(url, p);
  }
  return p;
}

export const answersUrl = (lectureId: string) => `/data/${lectureId}/answers.json`;
export const hintsUrl = (lectureId: string) => `/data/${lectureId}/hints.json`;
