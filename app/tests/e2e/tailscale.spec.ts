// 폰에서 Tailscale serve 로 연 화면 (DESIGN.md 12.9절 1번, server/API.md 1절 계약).
// 로그인은 서버가 serve 의 접속자 정보로 정하고, 앱은 로그인 동작을 하지 않는다. 개발용 로그인(/api/dev-auth/*)은 늘 404.
// 학습 계정에 안 이어진 접속자는 기록 API 가 401 + auth_provider: "tailscale". 이어 주는 일은 맥미니에서 명령으로만.
import type { Page } from '@playwright/test';
import { test, expect, hydrated, manifest } from './fixtures';

const LINKED_NOTE = 'Tailscale 계정으로 접속 중입니다. 진도는 맥미니의 같은 학습 계정에 저장됩니다.';
const UNLINKED_NOTE = '이 Tailscale 계정은 아직 학습 계정에 이어져 있지 않습니다. 맥미니에서 연결한 뒤 새로 고침해 주세요.';
const ACC = { user_id: 'u-1-0000-4000-8000-000000000000', display_name: '학습 계정 1' };

/** 폭이 좁은 폰에서도 가로로 넘치지 않는다 */
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('이어진 Tailscale 계정: 설정에 개발용 계정 바꾸기·만들기가 없고 "접속 중" 한 줄, 기록은 그 학습 계정으로 간다', async ({ page, api }, info) => {
  api.authProvider = 'tailscale';
  api.accounts = [ACC];
  api.tailscaleUser = ACC.user_id;
  await page.goto('/settings/');
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  const acct = page.getByTestId('settings-account');
  await expect(acct.getByTestId('tailscale-note')).toHaveText(LINKED_NOTE);
  await expect(page.getByTestId('current-account')).toHaveText(ACC.display_name);
  await expect(acct).not.toContainText('개발용');
  await expect(acct.getByTestId('create-account')).toHaveCount(0);
  await expect(acct.getByLabel('새 계정 이름')).toHaveCount(0);
  await expect(acct.getByTestId('account-list')).toHaveCount(0);
  await expect(acct.getByRole('alert')).toHaveCount(0);
  await expect(acct.getByTestId('tailscale-unlinked')).toHaveCount(0);
  // 로그인 이름(이메일)은 서버도 주지 않고 화면에도 없다
  await expect(acct).not.toContainText('@');
  await expect(page.getByTestId('settings-sync')).toContainText('저장됨');
  await noOverflow(page);
  await page.screenshot({ path: `test-results/screens/${info.project.name}_settings_tailscale_linked.png`, fullPage: true });

  // 기록은 서버가 정한 학습 계정으로 올라가고, 앱은 계정을 만들지 않는다(홈에서 이번 주 실습 시간을 고쳐 기록 하나를 만든다)
  await page.goto('/home/');
  const week = page.getByTestId('week-time');
  await week.getByRole('button', { name: '이번 주 실습 시간 수정' }).click();
  await week.getByLabel('시간').fill('1');
  await week.getByLabel('분').fill('0');
  await week.getByRole('button', { name: '저장' }).click();
  await expect.poll(() => api.opsFor('user_pref').find((o) => String(o.key.pref_key).startsWith('practice_week:'))?.user_id).toBe(ACC.user_id);
  expect(api.accounts).toEqual([ACC]);
});

for (const meHasProvider of [true, false]) {
  test(`안 이어진 Tailscale 계정(/api/me 401 본문에 auth_provider ${meHasProvider ? '있음' : '없음, 기록 API 401 에만'}): 연결 안내, 만들기 버튼 없음, 학습은 이 기기에 두었다가 연결 뒤 새로 고침하면 올라간다`, async ({ page, api }, info) => {
    const m = await manifest(page);
    const L = m.lectures[0];
    const steps = [...L.steps].sort((a: any, b: any) => a.order - b.order);
    api.authProvider = 'tailscale';
    api.meUnauthorizedHasProvider = meHasProvider;
    api.accounts = [ACC];
    api.tailscaleUser = null;

    // 콘텐츠는 그대로 읽힌다
    await page.goto(`/lectures/${L.lecture_id}/${steps[0].slug}/#practice`);
    await hydrated(page);
    await expect(page.locator('main h1')).not.toBeEmpty();
    const st = page.getByTestId('sync-status').locator('[data-state="account"]');
    await expect(st).toHaveText('계정 연결 필요');
    await expect(st).toHaveAttribute('href', '/settings/#account');
    await expect(page.getByText('계정을 골라 주세요')).toHaveCount(0);
    await noOverflow(page);

    // 기록은 지금의 "계정 전 이 기기에 먼저 둠" 방식으로 남는다(서버는 401 이라 받지 않음)
    await page.getByTestId('finish-step').click();
    if (steps[0].question_ids.length) await expect(page.locator('[data-phase="quiz"]')).toBeVisible();
    else await page.waitForURL(steps[1] ? `**/lectures/${L.lecture_id}/${steps[1].slug}/` : `**/lectures/${L.lecture_id}/`);
    await expect(page.getByTestId('sync-status').locator('[data-state="account"]')).toHaveText('계정 연결 필요');
    expect(api.ops).toEqual([]);

    await page.goto('/settings/');
    const acct = page.getByTestId('settings-account');
    await expect(acct.getByTestId('tailscale-unlinked')).toHaveText(UNLINKED_NOTE);
    await expect(page.getByTestId('current-account')).toHaveText('없음');
    await expect(acct).not.toContainText('개발용');
    await expect(acct.getByTestId('create-account')).toHaveCount(0);
    await expect(acct.getByLabel('새 계정 이름')).toHaveCount(0);
    await expect(acct.getByTestId('account-list')).toHaveCount(0);
    await expect(acct.getByRole('alert')).toHaveCount(0);
    await expect(acct.getByTestId('tailscale-note')).toHaveCount(0);
    await expect(page.getByTestId('settings-sync')).toContainText('계정 연결 필요');
    await expect(page.getByText('계정을 골라 주세요')).toHaveCount(0);
    await noOverflow(page);
    await page.screenshot({ path: `test-results/screens/${info.project.name}_settings_tailscale_unlinked${meHasProvider ? '' : '_record401'}.png`, fullPage: true });
    expect(api.ops).toEqual([]);
    expect(api.accounts).toEqual([ACC]);

    // 맥미니에서 이어 준 뒤 새로 고침: 이 기기에 둔 학습이 그 학습 계정으로 올라간다
    api.tailscaleUser = ACC.user_id;
    await page.reload();
    await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
    await expect(acct.getByTestId('tailscale-note')).toHaveText(LINKED_NOTE);
    await expect(page.getByTestId('current-account')).toHaveText(ACC.display_name);
    await expect
      .poll(() => api.opsFor('step_progress').some((o) => o.key.step_id === steps[0].step_id && o.data.status === 'done' && o.user_id === ACC.user_id))
      .toBe(true);
    expect(api.accounts).toEqual([ACC]);
    await page.goto('/home/');
    await expect(page.getByTestId('done-count')).toHaveText('1');
  });
}

test('맥미니의 새 서버(auth_provider: dev_local)는 지금과 같다: 개발용 계정 만들기·바꾸기가 보이고 Tailscale 안내는 없다', async ({ page, api }) => {
  api.authProvider = 'dev_local';
  await page.goto('/settings/');
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  expect(api.accounts).toHaveLength(1);
  const acct = page.getByTestId('settings-account');
  await expect(acct).toContainText('개발용');
  await expect(acct.getByTestId('account-list').getByTestId('account-current')).toHaveText('사용 중');
  await expect(acct.getByTestId('create-account')).toBeVisible();
  await expect(acct.getByLabel('새 계정 이름')).toBeVisible();
  await expect(acct.getByTestId('tailscale-note')).toHaveCount(0);
  await expect(acct.getByTestId('tailscale-unlinked')).toHaveCount(0);
});

test('옛 서버(auth_provider 칸 없음)도 지금과 같다: 개발용 부분이 보이고, 막힌 개발용 로그인은 "계정을 골라 주세요"', async ({ page, api }) => {
  await page.goto('/settings/');
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  const acct = page.getByTestId('settings-account');
  await expect(acct).toContainText('개발용');
  await expect(acct.getByTestId('create-account')).toBeVisible();
  await expect(acct.getByTestId('tailscale-note')).toHaveCount(0);
  await expect(acct.getByTestId('tailscale-unlinked')).toHaveCount(0);

  await page.context().clearCookies();
  api.current = null;
  api.devAuthBlocked = true;
  await page.goto('/home/');
  await expect(page.getByTestId('sync-status').locator('[data-state="account"]')).toHaveText('계정을 골라 주세요');
  await page.goto('/settings/');
  await expect(acct.getByTestId('create-account')).toBeVisible();
  await expect(acct).toContainText('개발용');
  await expect(acct.getByTestId('tailscale-unlinked')).toHaveCount(0);
  await expect(page.getByTestId('settings-sync')).toContainText('계정을 골라 주세요');
});
