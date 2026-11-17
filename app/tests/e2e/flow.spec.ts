// 1편 단계를 처음부터 끝까지 넘긴다 (P1 완료 기준). 콘텐츠가 몇 단계든 manifest 순서대로.
import { test, expect, hydrated, manifest } from './fixtures';

test('모든 단계를 처음부터 끝까지 넘기고, 진도가 서버로 간다', async ({ page, api }) => {
  test.setTimeout(180_000);
  const m = await manifest(page);
  const L = m.lectures[0];
  const steps = [...L.steps].sort((a: any, b: any) => a.order - b.order);
  await page.goto(`/lectures/${L.lecture_id}/${steps[0].slug}/`);
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    await expect(page).toHaveURL(new RegExp(`/lectures/${L.lecture_id}/${s.slug}/`));
    await expect(page.getByTestId('step-position')).toContainText(s.step_id);
    await hydrated(page);
    await page.getByTestId('start-practice').click();
    await page.getByTestId('finish-step').click();
    if (s.question_ids.length) {
      await expect(page.locator('[data-phase="quiz"]')).toBeVisible();
      await page.getByTestId('next-step').click();
    }
  }
  await expect(page).toHaveURL(new RegExp(`/lectures/${L.lecture_id}/$`));
  await expect(page.getByTestId('step-list').locator('.st-done')).toHaveCount(steps.length);
  await expect.poll(() => api.opsFor('step_progress').filter((o) => o.data.status === 'done').map((o) => o.key.step_id)).toEqual(
    expect.arrayContaining(steps.map((s: any) => s.step_id)),
  );
  // 계정은 앱이 자동으로 만든 개발용 계정 하나. data 에 user_id 를 넣지 않고(server/API.md), 이 기기 사본은 계정별 DB 에 그 계정 id 로 둔다
  expect(api.accounts).toHaveLength(1);
  for (const o of api.ops) expect(o.data.user_id).toBeUndefined();
  const USER_ID = api.current!;
  const local = await page.evaluate(async (uid) => {
    const req = indexedDB.open(`z2h-u-${uid}`);
    const db: IDBDatabase = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const all: any[] = await new Promise((r) => {
      const g = db.transaction('rows').objectStore('rows').getAll();
      g.onsuccess = () => r(g.result);
    });
    return [...new Set(all.map((x) => x.data.user_id))];
  }, USER_ID);
  expect(local).toEqual([USER_ID]);
  await page.goto('/home/');
  await expect(page.getByTestId('done-count')).toHaveText(String(steps.length));
});
