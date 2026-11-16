import { describe, expect, it } from 'vitest';
import { ensureAccount } from '../../src/lib/runtime';

type H = (url: string, init?: RequestInit) => Response | Promise<Response>;
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
function fake(h: H) {
  const calls: { url: string; method: string; body: any }[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null });
    return h(url, init);
  };
  return { fn, calls };
}
const A = { user_id: 'u-a', display_name: '개발용 계정 1' };
const B = { user_id: 'u-b', display_name: '개발용 계정 2' };

describe('계정 정하기 (server/API.md 1절, 로컬 개발용 로그인)', () => {
  it('세션이 있으면 /api/me 의 계정을 그대로 쓴다', async () => {
    const f = fake((u) => (u === '/api/me' ? json({ ok: true, user: A }) : json({}, 500)));
    expect(await ensureAccount(f.fn, null)).toEqual({ account: A, state: 'ok' });
    expect(f.calls.map((c) => c.url)).toEqual(['/api/me']);
  });

  it('계정이 하나도 없으면 개발용 계정을 새로 만든다', async () => {
    const f = fake((u, i) => {
      if (u === '/api/me') return json({ ok: false, error: 'no_user' }, 401);
      if (u === '/api/dev-auth/accounts' && (i?.method ?? 'GET') === 'GET') return json({ accounts: [], current_user_id: null });
      if (u === '/api/dev-auth/accounts') return json({ ok: true, user: A });
      return json({}, 500);
    });
    expect(await ensureAccount(f.fn, null)).toEqual({ account: A, state: 'ok' });
    expect(f.calls[2]).toMatchObject({ url: '/api/dev-auth/accounts', method: 'POST', body: { display_name: '개발용 계정 1' } });
  });

  it('계정이 있으면 마지막에 쓴 계정으로, 없으면 첫 계정으로 로그인한다', async () => {
    const mk = () =>
      fake((u, i) => {
        if (u === '/api/me') return json({ ok: false, error: 'no_user' }, 401);
        if (u === '/api/dev-auth/accounts') return json({ accounts: [A, B], current_user_id: null });
        if (u === '/api/dev-auth/login') return json({ ok: true, user: JSON.parse(String(i!.body)).user_id === 'u-b' ? B : A });
        return json({}, 500);
      });
    const f1 = mk();
    expect((await ensureAccount(f1.fn, B)).account?.user_id).toBe('u-b');
    expect(f1.calls[2].body).toEqual({ user_id: 'u-b' });
    const f2 = mk();
    expect((await ensureAccount(f2.fn, null)).account?.user_id).toBe('u-a');
  });

  it('서버에 닿지 못하면 offline, 개발용 로그인이 막혀 있으면(404) none', async () => {
    const down = fake(() => {
      throw new TypeError('Failed to fetch');
    });
    expect(await ensureAccount(down.fn, null)).toEqual({ account: null, state: 'offline' });
    const blocked = fake((u) => (u === '/api/me' ? json({ ok: false }, 401) : json({ ok: false, error: 'not_found' }, 404)));
    expect(await ensureAccount(blocked.fn, null)).toEqual({ account: null, state: 'none' });
  });
});
