// 진도 서버 API 주소와 요청 모양을 한 곳에 모은다 (DESIGN.md 12.5절 표가 계약).
// 서버 작업자의 server/API.md 와 다르면 이 파일만 고친다. 기준 주소·credentials 는 config.api(공개 전환 때 바꿀 곳).

import { config, isAuthProvider, type AuthProvider } from '../config';

export type { AuthProvider };

export const API_BASE = config.api.base;

export const API_PATHS = {
  health: `${API_BASE}/health`,
  state: `${API_BASE}/state`,
  sync: `${API_BASE}/sync`,
  resultCode: `${API_BASE}/result-code`,
  grade: `${API_BASE}/grade`,
  export: `${API_BASE}/export`,
  me: `${API_BASE}/me`,
  devAccounts: `${API_BASE}/dev-auth/accounts`,
  devLogin: `${API_BASE}/dev-auth/login`,
  devLogout: `${API_BASE}/dev-auth/logout`,
} as const;

/** 계정 (server/API.md 1절). 지금은 로컬 개발용 로그인뿐(127.0.0.1 전용) */
export interface Account {
  user_id: string;
  display_name: string | null;
  path_id?: string;
  locale?: string;
  created_at?: string;
}

export interface SyncOp {
  op_id: string;
  table: string;
  key: Record<string, unknown>;
  data: Record<string, unknown>;
  updated_at: string;
  /** 고치기 전에 이 기기가 알던 서버 쪽 updated_at. 같으면 서버가 충돌로 기록하지 않는다 */
  base_updated_at?: string;
}

export interface SyncRequest {
  client_id: string;
  ops: SyncOp[];
}

export interface SyncResponse {
  applied: string[];
  superseded: string[];
  rejected: { op_id: string; reason_ko: string }[];
  server_time: string;
}

export interface StateResponse {
  server_time: string;
  /** 서버 반영 번호. 다음 요청의 since 로 그대로 쓴다(DESIGN.md 12.5) */
  server_seq: number | null;
  tables: Record<string, Record<string, unknown>[]>;
}

/**
 * 서버가 알려 주는 로그인 길(server/API.md 1절). /api/me 성공 응답과 401 본문에 온다.
 * 받는 값은 config.auth.screens 표에 있는 것만(dev_local, tailscale). 칸이 없거나 표에 없는 값("none" 등)은 null 로 두고
 * 화면은 표의 fallback 행(지금과 같은 동작)을 쓴다
 */
export function parseAuthProvider(v: unknown): AuthProvider | null {
  return isAuthProvider(v) ? v : null;
}

export class NetworkError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    /** 오류 응답의 JSON 본문(읽지 못하면 null) */
    readonly body: unknown = null,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

/** 오류 응답 본문의 auth_provider. 없거나 모르는 값이면 null */
export function errorAuthProvider(e: unknown): AuthProvider | null {
  if (!(e instanceof NetworkError) || !e.body || typeof e.body !== 'object') return null;
  return parseAuthProvider((e.body as { auth_provider?: unknown }).auth_provider);
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function requestJson<T>(fetchImpl: FetchLike, url: string, init: RequestInit = {}): Promise<T> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), config.requestTimeoutMs) : null;
  let res: Response;
  try {
    res = await fetchImpl(url, { ...init, signal: ctrl?.signal, credentials: config.api.credentials });
  } catch (e) {
    throw new NetworkError(String((e as Error)?.message ?? e));
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* JSON 이 아닌 오류 본문 */
    }
    throw new NetworkError(`HTTP ${res.status}`, res.status, body);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new NetworkError('응답을 읽지 못했습니다', res.status);
  }
}

export function postSync(fetchImpl: FetchLike, body: SyncRequest): Promise<SyncResponse> {
  return requestJson<SyncResponse>(fetchImpl, API_PATHS.sync, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => ({
    applied: Array.isArray(r?.applied) ? r.applied : [],
    superseded: Array.isArray(r?.superseded) ? r.superseded : [],
    rejected: Array.isArray(r?.rejected) ? r.rejected : [],
    server_time: String(r?.server_time ?? ''),
  }));
}

export function getState(fetchImpl: FetchLike, since: number | null): Promise<StateResponse> {
  const url = since != null ? `${API_PATHS.state}?since=${encodeURIComponent(String(since))}` : API_PATHS.state;
  return requestJson<StateResponse>(fetchImpl, url).then((r) => ({
    server_time: String(r?.server_time ?? ''),
    server_seq: Number.isInteger(r?.server_seq) ? (r.server_seq as number) : null,
    tables: r && typeof r.tables === 'object' && r.tables ? r.tables : {},
  }));
}

const postJson = <T>(f: FetchLike, url: string, body: unknown) =>
  requestJson<T>(f, url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });

export async function getMe(f: FetchLike): Promise<Account> {
  return (await getMeWithProvider(f)).user;
}
/** /api/me 와 로그인 길. auth_provider 는 맨 위 칸을 먼저 보고, 없으면 user 안을 본다(옛 응답은 null) */
export async function getMeWithProvider(f: FetchLike): Promise<{ user: Account; authProvider: AuthProvider | null }> {
  const r = await requestJson<{ user: Account; auth_provider?: unknown }>(f, API_PATHS.me);
  const inUser = r?.user && typeof r.user === 'object' ? (r.user as { auth_provider?: unknown }).auth_provider : undefined;
  return { user: r.user, authProvider: parseAuthProvider(r?.auth_provider) ?? parseAuthProvider(inUser) };
}
export function listDevAccounts(f: FetchLike): Promise<{ accounts: Account[]; current_user_id: string | null }> {
  return requestJson(f, API_PATHS.devAccounts).then((r: any) => ({ accounts: Array.isArray(r?.accounts) ? r.accounts : [], current_user_id: r?.current_user_id ?? null }));
}
export async function createDevAccount(f: FetchLike, displayName: string): Promise<Account> {
  return (await postJson<{ user: Account }>(f, API_PATHS.devAccounts, { display_name: displayName })).user;
}
export async function loginDevAccount(f: FetchLike, userId: string): Promise<Account> {
  const r = await postJson<{ user?: Account }>(f, API_PATHS.devLogin, { user_id: userId });
  return r.user ?? { user_id: userId, display_name: null };
}

export function getHealth(fetchImpl: FetchLike): Promise<{ ok: boolean; server_time: string; schema_version: string }> {
  return requestJson(fetchImpl, API_PATHS.health);
}
