import { test, expect, manifest } from './fixtures';
import { LANDING } from '../../src/content/landing.mjs';

// sync: false = 동기화 표시가 없는 화면(랜딩 위 막대, spec 13.1)
const PAGES: { path: string; heading: RegExp; sync?: boolean }[] = [
  { path: '/', heading: new RegExp(LANDING.hero.promise.slice(0, 12)), sync: false },
  { path: '/home/', heading: /어디서부터 시작할까요|이어서 하기/ },
  { path: '/basics/', heading: /사전 기초/ },
  { path: '/taste/', heading: /맛보기/ },
  { path: '/taste/precomputed/', heading: /미리 계산한 결과 보기/ },
  { path: '/badges/', heading: /배지/ },
  { path: '/share/', heading: /공유 카드/ },
  { path: '/review/', heading: /복습/ },
  { path: '/settings/', heading: /설정/ },
];

test.describe('주요 화면이 열린다', () => {
  for (const p of PAGES) {
    test(`${p.path}`, async ({ page, api }, info) => {
      const res = await page.goto(p.path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('h1').first()).toContainText(p.heading);
      if (p.sync === false) await expect(page.getByTestId('sync-status')).toHaveCount(0);
      else await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/screens/${info.project.name}${p.path.replace(/\//g, '_') || '_root'}.png`, fullPage: true });
      expect(api.syncCalls).toBeGreaterThanOrEqual(0);
    });
  }

  test('강의 개요와 모든 단계 화면', async ({ page, api }, info) => {
    const m = await manifest(page);
    const L = m.lectures[0];
    await page.goto(`/lectures/${L.lecture_id}/`);
    await expect(page.getByTestId('step-list').locator('li')).toHaveCount(L.steps.length);
    await expect(page.getByTestId('prereq')).toContainText('추천');
    await page.screenshot({ path: `test-results/screens/${info.project.name}_lecture.png`, fullPage: true });
    for (const s of L.steps) {
      const res = await page.goto(`/lectures/${L.lecture_id}/${s.slug}/`);
      expect(res?.status()).toBe(200);
      await expect(page.getByTestId('step-position')).toContainText(`단계 ${s.order} / ${L.steps.length} · ${s.step_id}`);
    }
    // 디자이너 검수용 그림 (판정은 위 검사로 하고, 그림은 참고)
    const s = L.steps.find((x: any) => x.question_ids.length && x.hint_levels.length) ?? L.steps[0];
    const shot = async (name: string) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, name).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/screens/${info.project.name}_step_${name}.png`, fullPage: true });
    };
    await page.goto(`/lectures/${L.lecture_id}/${s.slug}/`);
    await expect(page.getByTestId('video-player')).toHaveAttribute('data-state', 'ready');
    await shot('segment');
    await page.getByTestId('start-practice').click();
    await page.getByTestId('dont-know').click();
    await shot('practice');
    if (s.question_ids.length) {
      await page.goto(`/lectures/${L.lecture_id}/${s.slug}/#quiz`);
      await expect(page.locator('[data-phase="quiz"]')).toBeVisible();
      await shot('quiz');
    }
    expect(api.consoleErrors).toEqual([]);
  });

  test('누르는 곳은 44px 이상', async ({ page, api }) => {
    const m = await manifest(page);
    const L = m.lectures[0];
    for (const path of ['/home/', `/lectures/${L.lecture_id}/`, `/lectures/${L.lecture_id}/${L.steps[1].slug}/#practice`, '/settings/']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const small = await page.evaluate(() =>
        [...document.querySelectorAll('button, a.btn, .chip, .tabbar a, .topnav a, .iconbtn, .opt')]
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => ({ t: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), r: el.getBoundingClientRect() }))
          .filter((x) => x.r.height < 44 || x.r.width < 44)
          .map((x) => `${x.t} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`),
      );
      expect(small, path).toEqual([]);
    }
    expect(api.externalRequests).toEqual([]);
  });

  test('한국어 줄바꿈 keep-all, 긴 줄표 없음', async ({ page, api }) => {
    for (const p of ['/home/', '/settings/', '/']) {
      await page.goto(p);
      expect(await page.evaluate(() => getComputedStyle(document.body).wordBreak)).toBe('keep-all');
      expect(await page.evaluate(() => document.body.innerText.includes('\u2014'))).toBe(false);
    }
    expect(api.externalRequests).toEqual([]);
  });
});
