// 홈 실습 시간 수정·되돌리기, 결과코드 붙여넣기, 설정 백업 내보내기
import fs from 'node:fs';
import { test, expect, manifest } from './fixtures';
import { encodeResultCodeForTest } from '../../src/lib/resultCode';

test('이번 주 실습 시간: 고친 값과 자동 값이 둘 다 남고, 되돌릴 수 있다', async ({ page, api }) => {
  await page.goto('/home/');
  const card = page.getByTestId('week-time');
  await card.getByRole('button', { name: '이번 주 실습 시간 수정' }).click();
  await card.getByLabel('시간').fill('2');
  await card.getByLabel('분').fill('30');
  await card.getByRole('button', { name: '저장' }).click();
  await expect(page.getByTestId('week-time-value')).toHaveText('2:30');
  await expect(card).toContainText('수정됨');
  await expect(card).toContainText('자동 0:00');
  await expect.poll(() => api.opsFor('user_pref').some((o) => /^practice_week:\d{4}-\d\d-\d\d$/.test(o.key.pref_key) && o.data.value?.edited_seconds === 9000)).toBe(true);
  await card.getByRole('button', { name: '이번 주 실습 시간 수정' }).click();
  await card.getByLabel('분').fill('75');
  await card.getByRole('button', { name: '저장' }).click();
  await expect(card).toContainText('분은 0~59');
  await card.getByRole('button', { name: '자동 기록으로 되돌리기' }).click();
  await expect(page.getByTestId('week-time-value')).toHaveText('0:00');
  await expect(card).not.toContainText('수정됨');
  await expect.poll(() => api.opsFor('user_pref').filter((o) => /^practice_week:/.test(o.key.pref_key)).map((o) => o.data.value).pop()).toBeNull();
});

test('결과코드: 맞는 코드는 반영, 글자가 바뀐 코드는 안내', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const checkId = L.steps.find((s: any) => s.check_id)?.check_id ?? `${L.lecture_id}-S01`;
  const rebuildId = L.rebuild_ids[0];
  // z2h_check.finish() 와 같은 모양 (server/API.md 4절)
  const code = encodeResultCodeForTest({ v: 1, l: L.lecture_id, p: [checkId, rebuildId], f: [], t: '2026-11-16T21:00:00+09:00' });
  const crc = code.split('.')[2];
  await page.goto(`/lectures/${L.lecture_id}/`);
  const box = page.getByTestId('result-code');
  const broken = code.slice(0, 10) + (code[10] === 'x' ? 'y' : 'x') + code.slice(11);
  await box.getByLabel('결과코드').fill(broken);
  await box.getByTestId('apply-result-code').click();
  await expect(box.getByTestId('result-code-status')).toContainText('코드가 잘렸거나 글자가 바뀌었습니다');
  await box.getByLabel('결과코드').fill(code);
  await box.getByTestId('apply-result-code').click();
  await expect(box.getByTestId('result-code-status')).toContainText('결과 2개를 반영했습니다');
  await expect.poll(() => api.opsFor('grade_result').map((o) => o.key.check_id).sort()).toEqual([checkId, rebuildId].sort());
  await expect.poll(() => api.opsFor('rebuild_attempt').map((o) => o.key)).toContainEqual({ rebuild_id: rebuildId, attempt_id: `rc-${crc}-${rebuildId}` });
  await expect(page.getByText('노트북 통과').first()).toBeVisible();
});

test('설정: 실행 장소 선택과 JSON 백업 내려받기', async ({ page, api }) => {
  await page.goto('/settings/');
  await page.getByRole('button', { name: /맥미니 Jupyter/ }).click();
  await expect(page.getByRole('button', { name: /맥미니 Jupyter/ })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => api.opsFor('user_pref').some((o) => o.key.pref_key === 'run_place' && o.data.value === 'jupyter')).toBe(true);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-local').click()]);
  expect(dl.suggestedFilename()).toMatch(/^z2h-backup-\d{8}\.json$/);
  const path = await dl.path();
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  expect(data.user_id).toBe(api.current);
  expect(data.tables.user_pref.some((r: any) => r.pref_key === 'run_place')).toBe(true);
});

test('이어서 하기: 마지막으로 멈춘 단계와 칸으로 간다 (user_pref resume)', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const s = L.steps[L.steps.length - 1];
  await page.goto(`/lectures/${L.lecture_id}/${s.slug}/`);
  await page.getByTestId('start-practice').click();
  await expect.poll(() => api.opsFor('user_pref').find((o) => o.key.pref_key === 'resume')?.data.value).toEqual({ step_id: s.step_id, phase: 'practice' });
  await page.goto('/home/');
  await expect(page.getByTestId('continue-link')).toHaveAttribute('href', `/lectures/${L.lecture_id}/${s.slug}/#practice`);
});

test('Colab 바로 열기 주소가 비어 있으면 "Colab에서 열기" 버튼이 없고 받기 + 올리기 안내가 보인다', async ({ page }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  await page.goto(`/lectures/${L.lecture_id}/`);
  await expect(page.getByRole('link', { name: /Colab에서 노트북 열기/ })).toHaveCount(0);
  await expect(page.locator('#notebook')).toContainText('노트북 업로드');
  const code = L.steps.find((x: any) => x.kind === 'code');
  await page.goto(`/lectures/${L.lecture_id}/${code.slug}/#practice`);
  await expect(page.getByRole('link', { name: /Colab에서 노트북 열기/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '노트북 받기와 Colab 안내' })).toBeVisible();
});
