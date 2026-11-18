// 동기화 멈춤 수정 PR 스크린샷(docs/screenshots/fix-sync-stall/). npm run shots:fix-sync-stall (playwright.shots.config.ts)로만 돈다.
// 판정은 tests/e2e/sync-stall.spec.ts 가 하고 여기서는 그림만 남긴다. 계정은 가짜 서버(fixtures.ts)의 개발용 계정이다.
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, hydrated } from '../e2e/fixtures';
import { readManifest } from '../e2e/manifest-types';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import { config } from '../../src/config';

const DIR = path.join(REPO_ROOT, 'docs/screenshots/fix-sync-stall');
const width = (info: TestInfo) => (info.project.name.startsWith('mobile') ? '390' : '1280');
const file = (info: TestInfo, name: string) => path.join(DIR, `${width(info)}_${name}.png`);
const progress = (page: Page) => page.getByRole('region', { name: '진행' });

async function firstBasicsStep(page: Page) {
  const steps = [...(await readManifest(page)).basics.steps['F-P1']].sort((a, b) => a.order - b.order);
  return `/basics/F-P1/${steps[0].slug}/`;
}

test('A: 첫 받기가 멈춘 동안 마치기의 저장 중', async ({ page, api }, info) => {
  api.holdState = true;
  await page.goto(await firstBasicsStep(page));
  await hydrated(page);
  await page.getByTestId('finish-step').click();
  await expect(page.getByTestId('finish-step')).toHaveText('저장 중');
  await progress(page).screenshot({ path: file(info, 'finish_saving') });
});

test('B: 이 기기에 저장하지 못했을 때의 안내와 다시 누르기', async ({ page, api }, info) => {
  await page.clock.install();
  await page.goto(await firstBasicsStep(page));
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  await hydrated(page);
  await page.evaluate(async () => {
    const name = (await indexedDB.databases()).map((d) => d.name).find((n) => n?.startsWith('z2h-u-'));
    if (!name) throw new Error('계정 저장소가 없습니다');
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(name);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction(['rows', 'queue'], 'readwrite');
    const spin = () => {
      tx.objectStore('queue').count().onsuccess = spin;
    };
    spin();
  });
  await page.getByTestId('finish-step').click();
  await expect(page.getByTestId('finish-step')).toHaveText('저장 중');
  await page.clock.fastForward(config.saveMaxMs);
  await expect(page.getByTestId('save-failed')).toBeVisible();
  await progress(page).screenshot({ path: file(info, 'finish_save_failed') });
  expect(api.externalRequests).toEqual([]);
});

test('C: 동기화 중 표시를 눌렀을 때의 안내와 지금 다시 시도', async ({ page, api }, info) => {
  const L = (await readManifest(page)).lectures[0];
  const code = L.steps.find((x) => x.kind === 'code');
  await page.goto(`/lectures/${L.lecture_id}/${code?.slug}/#practice`);
  await hydrated(page);
  await expect.poll(() => api.opsFor('step_progress').length).toBeGreaterThan(0);
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  api.holdSync = true;
  await page.getByLabel('내 예측').fill('3.0');
  await page.getByRole('button', { name: '예측 저장하고 보기' }).click();
  await page.getByTestId('sync-status').locator('[data-state="syncing"]').click();
  await expect(page.getByRole('dialog', { name: '동기화 안내' })).toBeVisible();
  const vp = page.viewportSize() ?? { width: 1280, height: 900 };
  await page.screenshot({ path: file(info, 'syncing_retry'), clip: { x: 0, y: 0, width: vp.width, height: 320 } });
});
