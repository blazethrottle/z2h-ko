// 페이지마다 하나: 계정 확인 → 계정별 브라우저 저장소 + 동기화 관리자. 여러 부품(island)이 같은 것을 쓴다.
// 계정(D43·D44, server/API.md 1절): 처음 열 때 /api/me 로 확인하고, 없으면 로컬 개발용 계정을 자동으로 고르거나 만든다.
// 가입·로그인 화면(이메일·Google)은 만들지 않는다. 개발용 계정 바꾸기는 /settings/.
// 폰(Tailscale serve 경유)에서는 서버가 접속자 정보로 계정을 정하므로 앱은 로그인 동작을 하지 않는다(authProvider).

import { config } from '../config';
import {
  NetworkError,
  createDevAccount,
  errorAuthProvider,
  getMeWithProvider,
  listDevAccounts,
  loginDevAccount,
  type Account,
  type AuthProvider,
  type FetchLike,
} from './api';
import { LocalStore } from './sync/store';
import { SyncManager } from './sync/manager';
import { uuid4 } from './time';

export type AccountState = 'ok' | 'offline' | 'none';

export interface Runtime {
  store: LocalStore;
  sync: SyncManager;
  account: Account | null;
  accountState: AccountState;
  /** 서버가 알려 준 로그인 길(/api/me). 옛 서버거나 아직 모르면 null. 기록 API 401 이 알려 준 값은 sync.state.authProvider */
  authProvider: AuthProvider | null;
}

export interface EnsuredAccount {
  account: Account | null;
  state: AccountState;
  /** 서버가 알려 줄 때만 있다(옛 응답에는 칸 자체가 없다) */
  authProvider?: AuthProvider;
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
 * Tailscale 경유(폰): 로그인은 서버가 serve 의 접속자 정보로 정한다. /api/me 401 본문이 tailscale 이면
 * 학습 계정에 안 이어진 접속자라 개발용 로그인(그 길에서는 늘 404)을 부르지 않고 none. 이어 주는 일은 맥미니에서 명령으로만 한다.
 */
export async function ensureAccount(f: FetchLike, last: Account | null = readLastAccount()): Promise<EnsuredAccount> {
  const withProvider = (r: EnsuredAccount, p: AuthProvider | null): EnsuredAccount => (p ? { ...r, authProvider: p } : r);
  let provider: AuthProvider | null = null;
  try {
    const me = await getMeWithProvider(f);
    return withProvider({ account: me.user, state: 'ok' }, me.authProvider);
  } catch (e) {
    if (!(e instanceof NetworkError) || e.status !== 401) return { account: null, state: 'offline' };
    provider = errorAuthProvider(e);
    if (provider === 'tailscale') return { account: null, state: 'none', authProvider: provider };
  }
  try {
    const { accounts } = await listDevAccounts(f);
    const pick = accounts.find((a) => a.user_id === last?.user_id) ?? accounts[0];
    const account = pick ? { ...pick, ...(await loginDevAccount(f, pick.user_id)) } : await createDevAccount(f, `${config.devAccountName} 1`);
    return withProvider({ account, state: 'ok' }, provider);
  } catch (e) {
    return withProvider({ account: null, state: e instanceof NetworkError && e.status == null ? 'offline' : 'none' }, provider);
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
      return { store, sync, account, accountState: res.account ? 'ok' : res.state, authProvider: res.authProvider ?? null };
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
