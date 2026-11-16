// 폰에서 Tailscale serve 로 연 화면 (DESIGN.md 12.9절 1번, server/API.md 1절 계약):
// /api/me 의 auth_provider("dev_local" | "tailscale"), 학습 계정에 안 이어진 접속자의 401 본문 auth_provider: "tailscale".
// 칸이 없는 옛 응답은 지금과 똑같이 동작해야 한다.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { NetworkError, errorAuthProvider, getMe, parseAuthProvider } from '../../src/lib/api';
import { ensureAccount } from '../../src/lib/runtime';
import { LocalStore } from '../../src/lib/sync/store';
import { SyncManager, type Timers } from '../../src/lib/sync/manager';

type H = (url: string, init?: RequestInit) => Response | Promise<Response>;
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
function fake(h: H) {
  const calls: { url: string; method: string }[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET' });
    return h(url, init);
  };
  return { fn, calls };
}
const A = { user_id: 'u-a', display_name: '학습 계정 1' };
const NOT_LINKED = { ok: false, error: 'no_user', message_ko: '먼저 계정을 고르거나 만들어 주세요', auth_provider: 'tailscale' };
const timers: Timers = { setTimeout: () => 0, clearTimeout: () => {} };
let dbn = 0;

describe('auth_provider 읽기', () => {
  it('아는 값만 받는다(dev_local, tailscale). 그 밖은 null', () => {
    expect(parseAuthProvider('tailscale')).toBe('tailscale');
    expect(parseAuthProvider('dev_local')).toBe('dev_local');
    for (const v of [undefined, null, '', 'none', 'TAILSCALE', 1, {}]) expect(parseAuthProvider(v)).toBeNull();
  });

  it('오류 응답 본문을 NetworkError 에 담아 auth_provider 를 꺼낸다. JSON 이 아닌 본문은 null', async () => {
    const e1 = await getMe(fake(() => json(NOT_LINKED, 401)).fn).catch((e) => e);
    expect(e1).toBeInstanceOf(NetworkError);
    expect(e1.status).toBe(401);
    expect(errorAuthProvider(e1)).toBe('tailscale');
    const e2 = await getMe(fake(() => json({ ok: false, error: 'no_user' }, 401)).fn).catch((e) => e);
    expect(e2.status).toBe(401);
    expect(errorAuthProvider(e2)).toBeNull();
    const e3 = await getMe(fake(() => new Response('<html>not found</html>', { status: 404 })).fn).catch((e) => e);
    expect(e3.status).toBe(404);
    expect(errorAuthProvider(e3)).toBeNull();
    expect(errorAuthProvider(new Error('x'))).toBeNull();
  });
});

describe('계정 정하기: Tailscale 경유', () => {
  it('이어진 접속자: /api/me 의 계정을 그대로 쓰고 authProvider 는 tailscale (맨 위 칸)', async () => {
    const f = fake((u) => (u === '/api/me' ? json({ ok: true, user: A, auth_provider: 'tailscale' }) : json({}, 500)));
    expect(await ensureAccount(f.fn, null)).toEqual({ account: A, state: 'ok', authProvider: 'tailscale' });
    expect(f.calls.map((c) => c.url)).toEqual(['/api/me']);
  });

  it('auth_provider 가 user 안에 있어도 읽는다', async () => {
    const f = fake(() => json({ ok: true, user: { ...A, auth_provider: 'tailscale' } }));
    expect((await ensureAccount(f.fn, null)).authProvider).toBe('tailscale');
  });

  it('맥미니(127.0.0.1)의 새 서버: dev_local', async () => {
    const f = fake(() => json({ ok: true, user: A, auth_provider: 'dev_local' }));
    expect(await ensureAccount(f.fn, null)).toEqual({ account: A, state: 'ok', authProvider: 'dev_local' });
  });

  it('새 서버의 개발용 401(auth_provider: dev_local)은 지금처럼 개발용 계정을 고르거나 만든다', async () => {
    const f = fake((u) => {
      if (u === '/api/me') return json({ ok: false, error: 'no_user', auth_provider: 'dev_local' }, 401);
      if (u === '/api/dev-auth/accounts') return json({ accounts: [A], current_user_id: null });
      if (u === '/api/dev-auth/login') return json({ ok: true, user: A });
      return json({}, 500);
    });
    expect(await ensureAccount(f.fn, null)).toEqual({ account: A, state: 'ok', authProvider: 'dev_local' });
    expect(f.calls.map((c) => c.url)).toEqual(['/api/me', '/api/dev-auth/accounts', '/api/dev-auth/login']);
  });

  it('로그인 수단이 꺼진 서버(401 auth_provider: none)는 모르는 값으로 보고 지금처럼 none', async () => {
    const f = fake((u) => (u === '/api/me' ? json({ ok: false, error: 'no_user', auth_provider: 'none' }, 401) : json({ ok: false, error: 'not_found' }, 404)));
    expect(await ensureAccount(f.fn, null)).toEqual({ account: null, state: 'none' });
  });

  it('안 이어진 접속자(/api/me 401 에 tailscale): 계정 없음, 개발용 로그인을 부르지 않는다(만들기도 없음)', async () => {
    const f = fake((u) => (u === '/api/me' ? json(NOT_LINKED, 401) : json({ ok: false, error: 'not_found' }, 404)));
    expect(await ensureAccount(f.fn, A)).toEqual({ account: null, state: 'none', authProvider: 'tailscale' });
    expect(f.calls.map((c) => c.url)).toEqual(['/api/me']);
  });

  it('/api/me 401 에 칸이 없고 개발용 로그인이 404 이면 지금처럼 none (어느 길인지는 기록 API 401 이 알려 준다)', async () => {
    const f = fake((u) => (u === '/api/me' ? json({ ok: false, error: 'no_user' }, 401) : json({ ok: false, error: 'not_found' }, 404)));
    const r = await ensureAccount(f.fn, null);
    expect(r).toEqual({ account: null, state: 'none' });
    expect('authProvider' in r).toBe(false);
    expect(f.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('옛 응답(auth_provider 없음)에는 authProvider 칸 자체가 없다', async () => {
    const f = fake(() => json({ ok: true, user: A }));
    const r = await ensureAccount(f.fn, null);
    expect(r).toEqual({ account: A, state: 'ok' });
    expect('authProvider' in r).toBe(false);
  });
});

describe('동기화: 기록 API 의 401 본문', () => {
  it('auth_provider: tailscale 이면 account 상태 + authProvider tailscale, 기록은 이 기기 대기열에 남는다', async () => {
    const s = await LocalStore.open(`z2h-ts-${++dbn}`, null);
    let called = 0;
    const f = fake(() => json(NOT_LINKED, 401));
    const m = new SyncManager(s, { fetch: f.fn, timers, clientId: 'c1', onUnauthorized: () => called++ });
    expect(m.state.authProvider).toBeNull();
    await s.put('step_progress', { step_id: 'L01-S04', status: 'done' });
    await m.flush();
    expect(m.state.display).toBe('account');
    expect(m.state.authProvider).toBe('tailscale');
    expect(called).toBe(1);
    expect(await s.queueSize()).toBe(1);
  });

  it('옛 401(칸 없음)이면 authProvider 는 null 그대로', async () => {
    const s = await LocalStore.open(`z2h-ts-${++dbn}`, null);
    const m = new SyncManager(s, { fetch: fake(() => json({ ok: false, error: 'no_user' }, 401)).fn, timers, clientId: 'c1' });
    await m.retryNow();
    expect(m.state.display).toBe('account');
    expect(m.state.authProvider).toBeNull();
  });
});
