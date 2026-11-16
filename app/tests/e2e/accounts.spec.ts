// 계정(D43·D44): 처음 열면 개발용 계정을 자동으로 만들고, 설정에서 바꾸고 만든다. 계정마다 기록이 따로다.
import { test, expect, manifest } from './fixtures';

test('처음 열면 개발용 계정이 자동으로 생기고, 설정에 "개발용" 표시와 함께 보인다', async ({ page, api }) => {
  await page.goto('/settings/');
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  expect(api.accounts).toHaveLength(1);
  const acct = page.getByTestId('settings-account');
  await expect(acct).toContainText('개발용');
  await expect(page.getByTestId('current-account')).toHaveText(api.accounts[0].display_name);
  await expect(acct).toContainText('이메일·Google 로그인은 공개 승인 뒤에 넣습니다.');
  await expect(acct).not.toContainText(/X 로그인|X로 로그인/);
});

test('새 계정을 만들면 그 계정으로 바뀌고 기록이 따로다. 다시 바꾸면 처음 기록이 돌아온다', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  await page.goto(`/lectures/${L.lecture_id}/${L.steps[0].slug}/#practice`);
  await page.getByTestId('finish-step').click();
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.data.status === 'done')).toBe(true);
  const first = api.current!;
  await page.goto('/home/');
  await expect(page.getByTestId('done-count')).toHaveText('1');

  await page.goto('/settings/');
  await page.getByLabel('새 계정 이름').fill('두 번째');
  await page.getByTestId('create-account').click();
  await expect(page.getByTestId('current-account')).toHaveText('두 번째');
  expect(api.current).not.toBe(first);
  await page.goto('/home/');
  await expect(page.getByTestId('done-count')).toHaveText('0');

  await page.goto('/settings/');
  await page.getByTestId('account-list').getByRole('button', { name: '이 계정으로 바꾸기' }).click();
  await expect(page.getByTestId('current-account')).toHaveText(api.accounts[0].display_name);
  await page.goto('/home/');
  await expect(page.getByTestId('done-count')).toHaveText('1');
});

test('개발용 로그인이 막힌 서버(401·404)면 오프라인이 아니라 "계정을 골라 주세요"', async ({ page, api }) => {
  api.devAuthBlocked = true;
  await page.goto('/home/');
  const st = page.getByTestId('sync-status').locator('[data-state="account"]');
  await expect(st).toBeVisible();
  await expect(st).toHaveText('계정을 골라 주세요');
  await expect(page.getByTestId('sync-status').locator('[data-state="offline"]')).toHaveCount(0);
});

test('처음부터 서버 없이 한 학습은 계정이 정해지면 그 계정으로 옮겨져 올라간다', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  api.mode = 'down';
  await page.goto(`/lectures/${L.lecture_id}/${L.steps[0].slug}/#practice`);
  await page.getByTestId('finish-step').click();
  await expect(page.locator('[data-phase="practice"]')).toHaveCount(0);
  await expect(page.getByTestId('sync-status').locator('[data-state="offline"]')).toBeVisible();
  api.mode = 'up';
  await page.reload();
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  expect(api.accounts).toHaveLength(1);
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.key.step_id === L.steps[0].step_id && o.data.status === 'done')).toBe(true);
});
