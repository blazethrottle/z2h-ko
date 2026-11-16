// 계정(D43·D44): 처음 열면 개발용 계정을 자동으로 만들고, 설정에서 바꾸고 만든다. 계정마다 기록이 따로다.
import { test, expect, hydrated, manifest } from './fixtures';

test('처음 열면 개발용 계정이 자동으로 생기고, 설정에 "개발용" 표시와 함께 보인다', async ({ page, api }) => {
  await page.goto('/settings/');
  // "저장됨"은 계정을 정하기 전에도 보이는 기본 표시라, 계정이 생길 때까지 따로 기다린다
  await expect.poll(() => api.accounts.length).toBe(1);
  await expect(page.getByTestId('current-account')).toHaveText(api.accounts[0].display_name);
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  expect(api.accounts).toHaveLength(1);
  const acct = page.getByTestId('settings-account');
  await expect(acct).toContainText('개발용');
  // 처음 연 기기: 계정이 생긴 뒤의 목록에 그 계정이 "사용 중", 바꾸기 버튼은 없다
  const list = page.getByTestId('account-list');
  await expect(list.getByTestId('account-current')).toHaveText('사용 중');
  await expect(list.getByRole('button', { name: '이 계정으로 바꾸기' })).toHaveCount(0);
  await expect(acct).toContainText('이메일·Google 로그인은 공개 승인 뒤에 넣습니다.');
  await expect(acct).not.toContainText(/X 로그인|X로 로그인/);
});

test('새 계정을 만들면 그 계정으로 바뀌고 기록이 따로다. 다시 바꾸면 처음 기록이 돌아온다', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const steps = [...L.steps].sort((a: any, b: any) => a.order - b.order);
  await page.goto(`/lectures/${L.lecture_id}/${steps[0].slug}/#practice`);
  await hydrated(page);
  await page.getByTestId('finish-step').click();
  // 문제가 없는 단계는 마치면 다음 단계로 스스로 넘어간다. 그 이동이 끝난 뒤에 다른 주소로 간다
  if (steps[0].question_ids.length) await expect(page.locator('[data-phase="quiz"]')).toBeVisible();
  else await page.waitForURL(steps[1] ? `**/lectures/${L.lecture_id}/${steps[1].slug}/` : `**/lectures/${L.lecture_id}/`);
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.data.status === 'done')).toBe(true);
  const first = api.current!;
  await page.goto('/home/');
  await expect(page.getByTestId('done-count')).toHaveText('1');

  await page.goto('/settings/');
  await hydrated(page);
  await page.getByLabel('새 계정 이름').fill('두 번째');
  await page.getByTestId('create-account').click();
  await expect(page.getByTestId('current-account')).toHaveText('두 번째');
  expect(api.current).not.toBe(first);
  await page.goto('/home/');
  await expect(page.getByTestId('done-count')).toHaveText('0');

  await page.goto('/settings/');
  const list = page.getByTestId('account-list');
  // 지금 계정 줄에 "사용 중"이 붙은 뒤에 누른다(바꾸기 버튼은 다른 계정 줄 하나에만 있다)
  await expect(list.locator('li', { hasText: '두 번째' }).getByTestId('account-current')).toHaveText('사용 중');
  await expect(list.getByRole('button', { name: '이 계정으로 바꾸기' })).toHaveCount(1);
  await list.getByRole('button', { name: '이 계정으로 바꾸기' }).click();
  await expect(page.getByTestId('current-account')).toHaveText(api.accounts[0].display_name);
  await page.goto('/home/');
  await expect(page.getByTestId('done-count')).toHaveText('1');
});

test('계정 목록이 계정 확인(/api/me)보다 먼저 와도, 처음 그릴 때부터 지금 계정에 "사용 중"이고 바꾸기 버튼은 다른 계정에만', async ({ page, api }) => {
  api.accounts = [
    { user_id: 'u-1-0000-4000-8000-000000000000', display_name: '첫째' },
    { user_id: 'u-2-0000-4000-8000-000000000000', display_name: '둘째' },
  ];
  api.current = api.accounts[1].user_id;
  api.meDelayMs = 2_000;
  await page.goto('/settings/');
  const list = page.getByTestId('account-list');
  await expect(list).toBeVisible();
  // 목록이 보인 바로 그 순간을 센다(기다리며 다시 세지 않는다): 모든 줄에 버튼을 그렸다가 고치면 여기서 걸린다
  expect(await list.getByRole('button', { name: '이 계정으로 바꾸기' }).count()).toBe(1);
  expect(await list.getByTestId('account-current').count()).toBe(1);
  await expect(list.locator('li', { hasText: '둘째' }).getByTestId('account-current')).toHaveText('사용 중');
  await expect(list.locator('li', { hasText: '첫째' }).getByRole('button', { name: '이 계정으로 바꾸기' })).toBeVisible();
  await expect(page.getByTestId('current-account')).toHaveText('둘째');
  await expect(list.getByRole('button', { name: '이 계정으로 바꾸기' })).toHaveCount(1);
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
  const steps = [...L.steps].sort((a: any, b: any) => a.order - b.order);
  api.mode = 'down';
  await page.goto(`/lectures/${L.lecture_id}/${steps[0].slug}/#practice`);
  await hydrated(page);
  await page.getByTestId('finish-step').click();
  // 문제가 없는 단계는 마치면 다음 단계로 스스로 넘어간다. 그 이동이 끝난 뒤에 다시 연다
  if (steps[0].question_ids.length) await expect(page.locator('[data-phase="quiz"]')).toBeVisible();
  else await page.waitForURL(steps[1] ? `**/lectures/${L.lecture_id}/${steps[1].slug}/` : `**/lectures/${L.lecture_id}/`);
  await expect(page.locator('[data-phase="practice"]')).toHaveCount(0);
  await expect(page.getByTestId('sync-status').locator('[data-state="offline"]')).toBeVisible();
  api.mode = 'up';
  await page.reload();
  await expect.poll(() => api.accounts.length).toBe(1);
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  expect(api.accounts).toHaveLength(1);
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.key.step_id === steps[0].step_id && o.data.status === 'done')).toBe(true);
});
