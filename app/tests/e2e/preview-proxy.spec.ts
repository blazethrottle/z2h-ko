// 자동 브라우저 검사용 preview 는 /api 를 진도 서버로 넘기지 않는다(Z2H_API_PROXY=off, playwright.config.ts).
// 그래서 맥미니에 진도 서버를 켜 둔 채 검사를 돌려도, 가짜 서버(page.route)를 벗어난 요청이 그 서버에 닿지 않는다.
import { test, expect } from '@playwright/test';

test('page.route 를 거치지 않는 /api 요청은 preview 에서 404 로 끝난다(프록시 꺼짐)', async ({ request }) => {
  for (const p of ['/api/health', '/api/me', '/api/dev-auth/accounts']) {
    const r = await request.get(p);
    expect(r.status(), `${p}: ${await r.text()}`).toBe(404);
  }
  const w = await request.post('/api/sync', { data: { client_id: 'x', ops: [] } });
  expect(w.status()).toBe(404);
});
