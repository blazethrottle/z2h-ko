// 따라 하기: 예측 먼저, 붙여넣기 비교 3유형, 에러 읽기 도우미, 복사, 영상 임베드 주소
import { test, expect, manifest, isMobile } from './fixtures';

test('예측 전에는 보여야 하는 것이 가려지고, 모르겠어요를 누르면 열린다', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const code = L.steps.find((x: any) => x.kind === 'code');
  await page.goto(`/lectures/${L.lecture_id}/${code.slug}/#practice`);
  await expect(page.getByText('가려짐, 예측 뒤 열림')).toBeVisible();
  await expect(page.getByTestId('expected')).toHaveCount(0);
  await page.getByTestId('dont-know').click();
  await expect(page.getByTestId('expected')).toBeVisible();
  expect(api.externalRequests).toEqual([]);
});

test('예측을 저장하면 step_progress.prediction 으로 간다', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const s = L.steps.find((x: any) => x.kind === 'code');
  await page.goto(`/lectures/${L.lecture_id}/${s.slug}/#practice`);
  await page.getByLabel('내 예측').fill('포물선이 나올 것 같다');
  await page.getByRole('button', { name: '예측 저장하고 보기' }).click();
  await expect(page.getByText('포물선이 나올 것 같다')).toBeVisible();
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.data.prediction === '포물선이 나올 것 같다')).toBe(true);
});

test('글 비교(output_match): 같은 출력은 맞음, 다른 출력은 다시 + 볼 곳, 에러 글은 에러 읽기 도우미', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const s = L.steps.find((x: any) => x.check === 'text');
  test.skip(!s, '글 비교 단계 없음');
  await page.goto(`/lectures/${L.lecture_id}/${s.slug}/#practice`);
  await page.getByTestId('dont-know').click();
  await page.getByTestId('compare').click();
  await expect(page.getByTestId('check-result')).toContainText('비교할 결과가 비어 있습니다');
  const expected = (await page.getByTestId('expected-output').textContent())!;
  expect(expected).toBe(s.expected_text);
  await page.getByTestId('paste').fill(`  ${expected}  \n\n`);
  await page.getByTestId('compare').click();
  await expect(page.getByTestId('check-result')).toContainText('맞음');
  await page.getByTestId('paste').fill('zz 전혀 다른 출력');
  await page.getByTestId('compare').click();
  await expect(page.getByTestId('check-result')).toContainText('다시');
  await page.getByTestId('paste').fill("Traceback (most recent call last):\nTypeError: unsupported operand type(s) for +: 'int' and 'Value'");
  await page.getByTestId('compare').click();
  await expect(page.getByTestId('error-helper')).toContainText('맨 아래 줄의 에러 종류');
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.key.step_id === s.step_id && o.data.attempts >= 3)).toBe(true);
});

test('숫자 범위(value_range, 셀 출력의 숫자): 범위 안 숫자는 맞음', async ({ page }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const s = L.steps.find((x: any) => x.check === 'number');
  test.skip(!s, '숫자 범위 단계 없음');
  await page.goto(`/lectures/${L.lecture_id}/${s.slug}/#practice`);
  await page.getByTestId('dont-know').click();
  await page.getByTestId('paste').fill(String((s.expected_range.min + s.expected_range.max) / 2));
  await page.getByTestId('compare').click();
  await expect(page.getByTestId('check-result')).toContainText('맞음');
});

test('코드 복사, 줄별 풀이 펼치기, 긴 단계 표시', async ({ page }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const s = L.steps.find((x: any) => x.kind === 'code' && !x.has_edits && x.cells.length === 1);
  await page.goto(`/lectures/${L.lecture_id}/${s.slug}/#practice`);
  const block = page.getByTestId('step-code');
  await block.getByRole('button', { name: '복사' }).click();
  await expect(block.getByRole('button', { name: '복사됨' })).toBeVisible();
  const firstLine = block.locator('.cl-code').first();
  await firstLine.click();
  await expect(firstLine).toHaveAttribute('aria-expanded', 'true');
  await expect(block.locator('.cl-note').first()).toBeVisible();
});

test('영상: youtube-nocookie 주소, 자동 재생 없음, 자막 매개변수, 유튜브에서 열기 새 창', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const s = L.steps.find((x: any) => x.segments > 1) ?? L.steps[0];
  await page.goto(`/lectures/${L.lecture_id}/${s.slug}/`);
  const player = page.getByTestId('video-player');
  const iframe = player.locator('iframe');
  await expect(iframe).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]+\?start=\d+(&end=\d+)?&rel=0&playsinline=1&cc_load_policy=1&cc_lang_pref=ko&hl=ko$/);
  const src = (await iframe.getAttribute('src'))!;
  expect(src).not.toContain('autoplay');
  expect(await iframe.getAttribute('allow')).toBe('encrypted-media; picture-in-picture; fullscreen');
  await expect(player).toHaveAttribute('data-state', 'ready');
  const link = player.getByTestId('watch-link');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]+&t=\d+s$/);
  if (s.segments > 1) {
    await player.getByRole('button', { name: /구간 2/ }).click();
    await expect(iframe).not.toHaveAttribute('src', src);
  }
  // 실습 화면: 모바일은 접힘으로 시작, 데스크톱은 펼침
  await page.getByRole('button', { name: /따라 하기 시작/ }).click();
  await expect(page.getByTestId('video-player')).toHaveAttribute('data-state', isMobile(page) ? 'collapsed' : /ready|loading/);
  expect(api.embedUrls.every((u) => !u.includes('autoplay'))).toBe(true);
});
