// P9 PR 스크린샷(docs/screenshots/p9/). npm run shots:p9 (playwright.shots.config.ts)로만 돈다. npm run test:e2e 에는 들어가지 않는다.
// 판정은 tests/e2e/guided-*.spec.ts 가 하고 여기서는 그림만 남긴다. 계정은 가짜 서버(fixtures.ts)의 개발용 계정이고 실명·이메일은 화면에 없다.
import path from 'node:path';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect, hydrated } from '../e2e/fixtures';
import { readManifest } from '../e2e/manifest-types';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import { LEGACY_L01 } from '../../src/lib/migrate/l01-v1_2';

const DIR = path.join(REPO_ROOT, 'docs/screenshots/p9');
const width = (info: TestInfo) => (info.project.name.startsWith('mobile') ? '390' : '1280');
const shot = async (page: Page, info: TestInfo, name: string, el?: Locator) => {
  const file = path.join(DIR, `${width(info)}_${name}.png`);
  if (el) await el.screenshot({ path: file, style: '.topbar, .tabbar { visibility: hidden !important; }' });
  else await page.screenshot({ path: file, fullPage: true });
};

test('A: 준비 중 편 안내(설계서 메모·편 전체 시간 없음), 랜딩 이런 분께·수료까지의 길(시간 없음)', async ({ page, api }, info) => {
  for (const lid of ['L02', 'L10']) {
    await page.goto(`/lectures/${lid}/`);
    await hydrated(page);
    await shot(page, info, `lecture_plan_${lid}`);
  }
  await page.goto('/');
  await hydrated(page);
  await shot(page, info, 'landing_audience', page.getByTestId('landing-audience'));
  await shot(page, info, 'landing_path', page.getByTestId('landing-path'));
  await shot(page, info, 'landing_support', page.getByTestId('landing-support'));
  expect(api.externalRequests).toEqual([]);
});

test('B: 단계 화면의 Colab 안내, 1편 개요 노트북 칸, 설정, 맛보기 첫 단계, 기초 F-P1', async ({ page, api }, info) => {
  const m = await readManifest(page);
  const L = m.lectures[0];
  const code = L.steps.find((s) => s.kind === 'code');
  await page.goto(`/lectures/${L.lecture_id}/${code?.slug}/#practice`);
  await hydrated(page);
  await shot(page, info, 'step_run_place', page.getByTestId('run-place'));
  await shot(page, info, 'step_practice');
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  await shot(page, info, 'l01_notebook', page.locator('#notebook'));
  await page.goto('/settings/');
  await hydrated(page);
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  await shot(page, info, 'settings');
  const taste: { slug: string }[] = (await (await page.request.get('/data/manifest.json')).json()).taster.steps;
  await page.goto(`/taste/${taste[0].slug}/`);
  await hydrated(page);
  await shot(page, info, 'taste_first_notebook', page.getByTestId('taste-notebook'));
  await page.goto('/basics/');
  await hydrated(page);
  await shot(page, info, 'basics_list');
  await page.goto('/basics/F-P1/');
  await hydrated(page);
  await shot(page, info, 'basics_F-P1');
  const s1 = m.basics.steps['F-P1'][0];
  await page.goto(`/basics/F-P1/${s1.slug}/`);
  await hydrated(page);
  await shot(page, info, 'basics_F-P1_S1');
  expect(api.externalRequests).toEqual([]);
});

test('C: 옛 1편 기록(1.2판)을 심은 가짜 기기 → 옮긴 뒤 새 개요(표대로만 완료)', async ({ page, api }, info) => {
  const AT = '2026-11-17T10:00:00+09:00';
  api.serverTables = {
    step_progress: ['01', '03', '07', '09b', '10', '16'].map((n) => ({ step_id: `L01-S${n}`, status: 'done', done_at: AT, started_at: AT, content_version: LEGACY_L01.contentVersions[1], updated_at: AT, server_seq: 1 })),
  };
  const L = (await readManifest(page)).lectures[0];
  await page.goto('/home/');
  await hydrated(page);
  await expect.poll(() => api.opsFor('user_pref').filter((o) => o.key.pref_key === LEGACY_L01.archiveKey).length).toBe(2);
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  await expect(page.getByTestId('step-list').locator('.st-done')).toHaveCount(14);
  await shot(page, info, 'l01_overview_migrated', page.getByTestId('step-list'));
  await page.goto('/home/');
  await hydrated(page);
  await shot(page, info, 'home_after_migration');
});
