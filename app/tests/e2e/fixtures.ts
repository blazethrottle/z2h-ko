// 가짜 진도 서버(/api)와 외부 요청 감시. 영상(youtube-nocookie)은 빈 페이지로 대신 응답해 바깥으로 나가지 않게 한다.
import { test as base, expect, type Page } from '@playwright/test';
import { TABLE_KEYS } from '../../src/lib/sync/tables';

const SERVER_FIELDS = ['user_id', 'updated_at', 'server_updated_at', 'last_client_id', 'server_seq', 'attempt_no'];


export class MockApi {
  mode: 'up' | 'down' = 'up';
  delayMs = 0;
  ops: any[] = [];
  rejected: any[] = [];
  syncCalls = 0;
  externalRequests: string[] = [];
  consoleErrors: string[] = [];
  embedUrls: string[] = [];
  /** 계정(server/API.md 1절 흉내). 처음에는 계정이 없다 → 앱이 개발용 계정을 자동으로 만든다 */
  accounts: { user_id: string; display_name: string }[] = [];
  current: string | null = null;
  /** true 면 개발용 로그인이 막힌 서버(예: 터널 뒤)처럼 /api/dev-auth/* 가 404 */
  devAuthBlocked = false;
  forwardedHeaders: string[] = [];

  async attach(page: Page) {
    await page.route('**/api/**', async (route) => {
      if (this.mode === 'down') return route.abort('connectionrefused');
      if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
      if (this.mode === 'down') return route.abort('connectionrefused');
      const url = new URL(route.request().url());
      const now = new Date(Date.now() + 9 * 3600_000).toISOString().replace('Z', '+09:00');
      const method = route.request().method();
      const hdrs = route.request().headers();
      for (const h of ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip', 'forwarded']) if (hdrs[h]) this.forwardedHeaders.push(h);
      if (url.pathname.startsWith('/api/dev-auth/')) {
        if (this.devAuthBlocked) return route.fulfill({ status: 404, json: { ok: false, error: 'not_found' } });
        if (url.pathname === '/api/dev-auth/accounts' && method === 'GET') return route.fulfill({ json: { accounts: this.accounts, current_user_id: this.current } });
        if (url.pathname === '/api/dev-auth/accounts' && method === 'POST') {
          const body = route.request().postDataJSON() ?? {};
          const user = { user_id: `u-${this.accounts.length + 1}-0000-4000-8000-000000000000`, display_name: body.display_name ?? '이름 없음' };
          this.accounts.push(user);
          this.current = user.user_id;
          return route.fulfill({ json: { ok: true, user } });
        }
        if (url.pathname === '/api/dev-auth/login') {
          const user = this.accounts.find((a) => a.user_id === route.request().postDataJSON()?.user_id);
          if (!user) return route.fulfill({ status: 404, json: { ok: false, error: 'no_account' } });
          this.current = user.user_id;
          return route.fulfill({ json: { ok: true, user } });
        }
      }
      if (url.pathname === '/api/health') return route.fulfill({ json: { ok: true, server_time: now, schema_version: 'test' } });
      const me = this.accounts.find((a) => a.user_id === this.current);
      if (!me) return route.fulfill({ status: 401, json: { ok: false, error: 'no_user', message_ko: '먼저 계정을 고르거나 만들어 주세요' } });
      if (url.pathname === '/api/me') return route.fulfill({ json: { ok: true, user: me } });
      if (url.pathname === '/api/sync') {
        this.syncCalls++;
        const body = route.request().postDataJSON();
        // server/API.md 2절 모양을 흉내 낸다: data 에 서버 칸·열쇠 칸이 있으면 거절
        const applied: string[] = [];
        const rejected: { op_id: string; reason_ko: string }[] = [];
        for (const o of body.ops) {
          const keys = (TABLE_KEYS as Record<string, readonly string[]>)[o.table];
          const bad = !keys
            ? `모르는 표: ${o.table}`
            : Object.keys(o.key).sort().join() !== [...keys].sort().join()
              ? '열쇠 칸이 다릅니다'
              : Object.keys(o.data).find((k) => SERVER_FIELDS.includes(k) || keys.includes(k))
                ? `data 에 넣을 수 없는 칸: ${Object.keys(o.data).find((k) => SERVER_FIELDS.includes(k) || keys.includes(k))}`
                : !/[+-]\d\d:\d\d$/.test(o.updated_at)
                  ? '시간대 없는 시각'
                  : null;
          if (bad) {
            rejected.push({ op_id: o.op_id, reason_ko: bad });
            this.rejected.push({ ...o, reason_ko: bad });
          } else {
            applied.push(o.op_id);
            this.ops.push({ ...o, user_id: me.user_id });
          }
        }
        return route.fulfill({ json: { applied, superseded: [], rejected, server_time: now } });
      }
      if (url.pathname === '/api/state') {
        const since = url.searchParams.get('since');
        if (since != null && !/^\d+$/.test(since)) return route.fulfill({ status: 400, json: { ok: false, error: 'bad_since' } });
        return route.fulfill({ json: { server_time: now, server_seq: this.ops.length, tables: {} } });
      }
      return route.fulfill({ status: 404, json: {} });
    });
    await page.route(/youtube-nocookie\.com/, (route) => {
      this.embedUrls.push(route.request().url());
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>player</title><p>player</p>' });
    });
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(u.hostname) && !u.hostname.endsWith('youtube-nocookie.com')) {
        this.externalRequests.push(req.url());
      }
    });
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION_REFUSED|net::ERR_FAILED/.test(m.text())) this.consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => this.consoleErrors.push(String(e)));
  }

  opsFor(table: string) {
    return this.ops.filter((o) => o.table === table);
  }
}

export const test = base.extend<{ api: MockApi }>({
  api: async ({ page }, use) => {
    const api = new MockApi();
    await api.attach(page);
    await use(api);
    expect(api.externalRequests, '외부 요청이 없어야 합니다').toEqual([]);
    expect(api.consoleErrors, '페이지 오류가 없어야 합니다').toEqual([]);
    expect(api.rejected, '가짜 서버가 거절한 변경이 없어야 합니다').toEqual([]);
    expect(api.forwardedHeaders, '프록시 전달 머리말이 없어야 합니다').toEqual([]);
  },
});

export { expect };

export async function manifest(page: Page) {
  const r = await page.request.get('/data/manifest.json');
  expect(r.status()).toBe(200);
  return r.json();
}

export async function syncState(page: Page) {
  return page.getByTestId('sync-status').locator('[data-state]').getAttribute('data-state');
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;
