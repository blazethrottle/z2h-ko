// P1 검수 잔여 2건 (P2에 추가):
// 1) 부품이 켜지기(마운트) 전에는 주요 버튼이 눌리지 않고(disabled + aria-busy, Gate.tsx), 켜진 뒤에는 눌린다.
// 2) 계정·첫 상태 확인이 끝나기 전에는 동기화 표시에 "저장됨"을 보이지 않는다(checking).
import type { Page, Route } from '@playwright/test';
import { test, expect, hydrated, manifest } from './fixtures';

/** 부품 스크립트(/_astro/*.js)를 붙잡아 두었다가 release() 로 풀어 준다 */
async function holdIslands(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const held: string[] = [];
  await page.route(/\/_astro\/.+\.js(\?.*)?$/, async (route: Route) => {
    held.push(route.request().url());
    await gate;
    await route.continue();
  });
  return { release, held };
}

const gates = (html: string) => html.match(/<fieldset[^>]*class="gate"[^>]*>/g) ?? [];

test('정적 HTML: 모든 부품이 disabled + aria-busy 로 그려진다', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const T = m.taster;
  const paths = ['/home/', '/settings/', `/lectures/${L.lecture_id}/`, `/lectures/${L.lecture_id}/${L.steps[0].slug}/`, '/taste/', `/taste/${T.steps[1].slug}/`, `/taste/${T.steps[T.steps.length - 1].slug}/`];
  for (const p of paths) {
    const html = await (await page.request.get(p)).text();
    const g = gates(html);
    expect(g.length, p).toBeGreaterThanOrEqual(2); // 동기화 표시 + 화면 부품
    for (const tag of g) {
      expect(tag, p).toMatch(/\sdisabled(=""|\s|>)/);
      expect(tag, p).toContain('aria-busy="true"');
    }
    // 동기화 표시는 정적 HTML 에서 "저장됨"이 아니라 확인 중
    expect(html, p).toMatch(/data-testid="sync-status"[\s\S]*?data-state="checking"/);
    expect(html, p).not.toMatch(/data-state="saved"/);
  }
});

test('맛보기 "직접 확인했어요 · 완료": 마운트 전에는 눌리지 않고, 마운트 뒤에는 눌린다', async ({ page, api }) => {
  const T = (await manifest(page)).taster;
  const s = T.steps[1];
  const hold = await holdIslands(page);
  await page.goto(`/taste/${s.slug}/`, { waitUntil: 'domcontentloaded' });
  const btn = page.getByTestId('taste-confirm');
  await expect(btn).toBeVisible();
  await expect(btn).toBeDisabled();
  await expect(page.locator('fieldset.gate[data-gate="TasteStepApp"]')).toHaveAttribute('aria-busy', 'true');
  const box = await btn.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await btn.click({ force: true });
  await page.getByTestId('taste-different').click({ force: true });
  expect(hold.held.length).toBeGreaterThan(0);
  hold.release();
  await hydrated(page);
  await expect(btn).toBeEnabled();
  await expect(page.locator('fieldset.gate[aria-busy]')).toHaveCount(0);
  // 마운트 전 클릭은 아무 일도 하지 않았다
  await expect(page.getByTestId('taste-confirmed')).toHaveCount(0);
  await expect(page.getByTestId('taste-hint-1')).toHaveCount(0);
  expect(api.opsFor('taster_result')).toEqual([]);
  await btn.click();
  await expect(page.getByTestId('taste-confirmed')).toBeVisible();
  await expect.poll(() => api.opsFor('taster_result').some((o) => o.key.step_id === s.step_id && o.data.self_reported === 'similar')).toBe(true);
});

test('1편 단계 "따라 하기 시작"·"마치기": 마운트 전에는 눌리지 않고, 마운트 뒤에는 눌린다', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const s = L.steps[0];
  const hold = await holdIslands(page);
  await page.goto(`/lectures/${L.lecture_id}/${s.slug}/`, { waitUntil: 'domcontentloaded' });
  const start = page.getByTestId('start-practice');
  await expect(start).toBeDisabled();
  await start.click({ force: true });
  hold.release();
  await hydrated(page);
  await expect(page.locator('[data-phase="segment"]')).toBeVisible();
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.locator('[data-phase="practice"]')).toBeVisible();
  await page.getByTestId('finish-step').click();
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.key.step_id === s.step_id && o.data.status === 'done')).toBe(true);
});

test('동기화 표시: 계정이 정해지기 전에는 "저장됨"이 아니라 확인 중, 계정이 생긴 뒤에 저장됨', async ({ page, api }) => {
  api.delayMs = 1_500; // 서버 응답을 늦춰 계정 만들기 전 구간을 길게 만든다
  await page.goto('/home/');
  await hydrated(page);
  const st = page.getByTestId('sync-status');
  await expect(st.locator('[data-state="checking"]')).toHaveCount(1);
  await expect(st.locator('[data-state="saved"]')).toHaveCount(0);
  expect(api.accounts).toHaveLength(0);
  await expect(st).not.toContainText('저장됨');
  await expect(st.locator('[data-state="saved"]')).toBeVisible({ timeout: 20_000 });
  // "저장됨"이 보이는 때에는 계정이 이미 있다 (따로 기다리지 않음)
  expect(api.accounts).toHaveLength(1);
});
