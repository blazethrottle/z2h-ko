// 동기화가 멈출 때의 화면(가짜 서버, 390px·1280px): 첫 받기가 멈추면 "마치기"가 '저장 중'을 보인 뒤 상한 안에 넘어가고,
// 이 기기 저장이 끝나지 않으면 안내 한 줄과 다시 누르기, '동기화 중' 표시에서도 다시 시도(누르는 곳 44px).
// 실제 서버와 응답 본문 멈춤은 tests/real/sync-stall.spec.ts.
import type { Page } from '@playwright/test';
import { test, expect, hydrated } from './fixtures';
import { readManifest, type ManifestStep } from './manifest-types';
import { config } from '../../src/config';

const ADVANCE_MAX_MS = config.firstPullMaxMs + 3_000;
const SAVE_FAILED = '이 기기에 저장하지 못했습니다. 다시 눌러 주세요.';

async function basicsSteps(page: Page): Promise<ManifestStep[]> {
  return [...(await readManifest(page)).basics.steps['F-P1']].sort((a, b) => a.order - b.order);
}
const stepUrl = (s: ManifestStep) => `/basics/F-P1/${s.slug}/`;

/** 마치기 뒤 다음 화면: 확인 문제가 있으면 그 칸, 없으면 다음 단계 주소 */
async function expectAdvanced(page: Page, s: ManifestStep, next: ManifestStep | undefined, timeout = ADVANCE_MAX_MS) {
  if (s.question_ids.length) await expect(page.locator('[data-phase="quiz"]')).toBeVisible({ timeout });
  else await page.waitForURL((u) => u.pathname === (next ? stepUrl(next) : '/basics/F-P1/'), { waitUntil: 'commit', timeout });
}

/** 다시 시도할 길: 동기화 표시(동기화 중·오프라인)를 누르면 안내와 "지금 다시 시도". 안내 카드는 화면 안에 다 들어온다 */
async function retryCard(page: Page) {
  const btn = page.getByTestId('sync-status').locator('[data-state="syncing"], [data-state="offline"]');
  await btn.click();
  const card = page.getByRole('dialog', { name: '동기화 안내' });
  const retry = card.getByRole('button', { name: '지금 다시 시도' });
  await expect(retry).toBeVisible();
  const box = await card.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box && box.x >= 0 && box.x + box.width <= width, `안내 카드가 화면 밖: ${JSON.stringify(box)} / 폭 ${width}`).toBe(true);
  return { btn, card, retry };
}

/** 이 기기 저장소(계정 IndexedDB)에 다른 연결이 쓰기를 쥐고 놓지 않게 한다. releaseStore 로 놓는다 */
async function holdStore(page: Page) {
  await page.evaluate(async () => {
    const name = (await indexedDB.databases()).map((d) => d.name).find((n) => n?.startsWith('z2h-u-'));
    if (!name) throw new Error('계정 저장소가 없습니다');
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(name);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const w = window as unknown as { __holdStore?: boolean };
    w.__holdStore = true;
    const tx = db.transaction(['rows', 'queue'], 'readwrite');
    const spin = () => {
      if (w.__holdStore) tx.objectStore('queue').count().onsuccess = spin;
    };
    spin();
  });
}
const releaseStore = (page: Page) => page.evaluate(() => ((window as unknown as { __holdStore?: boolean }).__holdStore = false));

test('첫 받기가 멈추면 마치기는 저장 중을 보이고 상한 안에 넘어가며, 완료 기록을 보내고 표시에서 다시 시도할 수 있다', async ({ page, api }) => {
  const steps = await basicsSteps(page);
  const [s, next] = steps;
  api.holdState = true;
  await page.goto(stepUrl(s));
  await hydrated(page);
  const finish = page.getByTestId('finish-step');
  const t0 = Date.now();
  await finish.click();
  await expect(finish).toHaveText('저장 중');
  await expect(finish).toBeDisabled();
  await expectAdvanced(page, s, next);
  expect(Date.now() - t0).toBeLessThan(ADVANCE_MAX_MS);
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.key.step_id === s.step_id && o.data.status === 'done')).toBe(true);
  await retryCard(page);
});

/** 이 기기 저장을 막은 채 누르고 상한을 넘겨 안내를 띄운다 */
async function failSave(page: Page, button: string, finishLabel: string) {
  await holdStore(page);
  await page.getByTestId(button).click();
  await expect(page.getByTestId('finish-step')).toHaveText('저장 중');
  await page.clock.fastForward(config.saveMaxMs);
  await expect(page.getByTestId('save-failed')).toHaveText(SAVE_FAILED);
  await expect(page.getByTestId('finish-step')).toBeEnabled();
  await expect(page.getByTestId('finish-step')).toHaveText(finishLabel);
}

test('이 기기 저장이 상한 안에 끝나지 않으면 안내 한 줄과 다시 누르기, 다시 누르면 안내가 사라지고 저장한 뒤 넘어간다', async ({ page, api }) => {
  const steps = await basicsSteps(page);
  const [s, next] = steps;
  await page.clock.install();
  await page.goto(stepUrl(s));
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  await hydrated(page);
  await failSave(page, 'finish-step', `단계 ${s.order} 마치기`);
  expect(page.url()).toContain(stepUrl(s));
  await page.getByTestId('finish-step').click();
  await expect(page.getByTestId('finish-step')).toHaveText('저장 중');
  await expect(page.getByTestId('save-failed')).toHaveCount(0);
  await releaseStore(page);
  await expectAdvanced(page, s, next);
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.key.step_id === s.step_id && o.data.status === 'done')).toBe(true);
});

/** 이 화면을 떠나기 시작하면 남는 표시(떠난 뒤 새 화면에서도 읽힌다) */
const watchLeave = (page: Page) => page.evaluate(() => addEventListener('beforeunload', () => sessionStorage.setItem('z2h-left', '1')));
const left = (page: Page) => page.evaluate(() => sessionStorage.getItem('z2h-left'));

test('상한 뒤에 저장이 끝나면(다시 누르지 않아도) "저장하지 못했습니다"만 지우고 화면은 그대로 둔다(입력 중에 넘어가지 않게). 다음으로를 누르면 넘어간다', async ({ page, api }) => {
  const steps = await basicsSteps(page);
  const [s, next] = steps;
  await page.clock.install();
  await page.goto(stepUrl(s));
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  await hydrated(page);
  await watchLeave(page);
  await failSave(page, 'finish-step', `단계 ${s.order} 마치기`);
  await releaseStore(page);
  await expect(page.getByTestId('save-failed')).toHaveCount(0);
  await expect(page.getByTestId('finish-step')).toHaveText(`단계 ${s.order} 다음으로`);
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.key.step_id === s.step_id && o.data.status === 'done')).toBe(true);
  expect(await left(page)).toBeNull();
  await expect(page.locator('[data-phase="practice"]')).toBeVisible();
  await page.getByTestId('finish-step').click();
  await expectAdvanced(page, s, next);
});

test('선택 단계 건너뛰기도 저장 중(두 버튼 잠금)·저장하지 못했을 때 안내를 보이고, 늦게 저장되면 안내만 지우고 화면은 그대로', async ({ page, api }) => {
  const L = (await readManifest(page)).lectures[0];
  const steps = [...L.steps].sort((a, b) => a.order - b.order);
  const i = steps.findIndex((x) => x.kind === 'optional');
  expect(i, '선택 단계').toBeGreaterThanOrEqual(0);
  const s = steps[i];
  await page.clock.install();
  await page.goto(`/lectures/${L.lecture_id}/${s.slug}/#practice`);
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  await hydrated(page);
  await watchLeave(page);
  await holdStore(page);
  await page.getByTestId('skip-optional').click();
  await expect(page.getByTestId('finish-step')).toHaveText('저장 중');
  await expect(page.getByTestId('finish-step')).toBeDisabled();
  await expect(page.getByTestId('skip-optional')).toBeDisabled();
  await page.clock.fastForward(config.saveMaxMs);
  await expect(page.getByTestId('save-failed')).toHaveText(SAVE_FAILED);
  await expect(page.getByTestId('skip-optional')).toBeEnabled();
  await releaseStore(page);
  await expect(page.getByTestId('save-failed')).toHaveCount(0);
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.key.step_id === s.step_id && o.data.status === 'skipped_optional')).toBe(true);
  expect(await left(page)).toBeNull();
  expect(new URL(page.url()).pathname).toBe(`/lectures/${L.lecture_id}/${s.slug}/`);
});

test("'동기화 중' 표시를 누르면 안내와 지금 다시 시도(44px)가 보이고, 누르면 새로 보내 저장됨", async ({ page, api }) => {
  const L = (await readManifest(page)).lectures[0];
  const code = L.steps.find((x) => x.kind === 'code');
  expect(code, '코드 단계').toBeTruthy();
  if (!code) return;
  await page.goto(`/lectures/${L.lecture_id}/${code.slug}/#practice`);
  await hydrated(page);
  // 화면을 열 때 쓰는 단계 행이 서버에 간 뒤 멈춘다(그 보내기까지 붙잡지 않게)
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.key.step_id === code.step_id)).toBe(true);
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  api.holdSync = true;
  await page.getByLabel('내 예측').fill('3.0');
  await page.getByRole('button', { name: '예측 저장하고 보기' }).click();
  await expect(page.getByTestId('sync-status').locator('[data-state="syncing"]')).toBeVisible();
  const { btn, card, retry } = await retryCard(page);
  await expect(card).toContainText('응답을 기다리고 있습니다');
  for (const el of [btn, retry]) expect((await el.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(api.held).toBeGreaterThan(0);
  api.holdSync = false;
  await retry.click();
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  expect(api.opsFor('step_progress').some((o) => o.key.step_id === code.step_id && o.data.prediction === '3.0')).toBe(true);
});
