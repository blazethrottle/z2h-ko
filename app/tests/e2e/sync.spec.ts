// 서버를 끈 채 학습 → 오프라인 표시 → 서버를 켜고 다시 시도 → 동기화 중(1초 넘을 때) → 저장됨
import { test, expect, manifest, syncState } from './fixtures';

test('오프라인 → 동기화 중 → 저장됨, 대기열은 새로고침해도 남는다', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const s = L.steps[0];
  // 계정은 처음 열 때 만들어 둔다(마지막 계정을 이 기기가 기억). 그 뒤 서버가 꺼진다
  await page.goto(`/lectures/${L.lecture_id}/${s.slug}/#practice`);
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  api.mode = 'down';
  await page.getByTestId('finish-step').click();
  // 마치기 기록이 이 기기에 저장된 뒤에야 화면이 넘어간다(확인 문제 또는 다음 단계)
  await expect(page.locator('[data-phase="practice"]')).toHaveCount(0);
  const offline = page.getByTestId('sync-status').locator('[data-state="offline"]');
  await expect(offline).toBeVisible();
  await expect(offline).toContainText('오프라인');

  await page.reload();
  await expect(page.getByTestId('sync-status').locator('[data-state="offline"]')).toBeVisible();
  expect(api.opsFor('step_progress').some((o) => o.data.status === 'done')).toBe(false);

  api.mode = 'up';
  api.delayMs = 1800;
  await page.getByTestId('sync-status').locator('[data-state="offline"]').click();
  await expect(page.getByText('맥미니 서버에 연결하지 못했습니다')).toBeVisible();
  await page.getByRole('button', { name: '지금 다시 시도' }).click();
  await expect(page.getByTestId('sync-status').locator('[data-state="syncing"]')).toBeVisible();
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible({ timeout: 15_000 });
  const done = api.opsFor('step_progress').find((o) => o.key.step_id === s.step_id && o.data.status === 'done');
  expect(done, JSON.stringify(api.ops.map((o) => [o.table, o.key, o.data.status]))).toBeTruthy();
  expect(done.updated_at).toMatch(/\+09:00$/);
});

test('연결이 1초 안에 끝나면 동기화 중을 보이지 않는다', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const seen = new Set<string>();
  await page.exposeFunction('noteSync', (s: string) => seen.add(s));
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="sync-status"] [data-state]');
      if (el) (window as any).noteSync(el.getAttribute('data-state'));
    }).observe(document, { subtree: true, childList: true, attributes: true });
  });
  await page.goto(`/lectures/${L.lecture_id}/${L.steps[0].slug}/#practice`);
  await page.getByTestId('finish-step').click();
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.data.status === 'done')).toBe(true);
  expect(await syncState(page)).toBe('saved');
  expect([...seen]).not.toContain('syncing');
});
