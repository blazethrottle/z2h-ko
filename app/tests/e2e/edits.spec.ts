// 바뀐 줄만 보여 주기 (spec 4.2-1): 기준 줄 흐리게 + 넣을 줄 강조 + "전체 보기". rerun_first 안내.
import { test, expect, hydrated, manifest } from './fixtures';

test('앞 셀을 고치는 모든 단계는 바뀐 줄만 보이고, 전체 보기로 고친 뒤 셀 전체를 편다', async ({ page }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  // edits 가 있는 단계 수는 콘텐츠에서 센다
  const steps = L.steps.filter((x: any) => x.has_edits);
  test.skip(!steps.length, 'edits 가 있는 단계 없음');
  for (const s of steps) {
    await test.step(`${s.step_id} ${s.slug}`, async () => {
      await page.goto(`/lectures/${L.lecture_id}/${s.slug}/#practice`);
      const view = page.getByTestId('edits-view');
      await expect(view).toContainText('바뀐 줄만');
      await expect(view).toContainText('흐린 줄은 이미 있는 기준 줄입니다');
      await expect(view.getByTestId('edit-block').first()).toBeVisible();
      await expect(view.locator('.cl-row.new').first()).toBeVisible();
      await hydrated(page);
      await view.getByTestId('edits-full').click();
      await expect(view.getByTestId('edits-full')).toHaveAttribute('aria-expanded', 'true');
      await expect(view.getByTestId('edits-full-cell')).toBeVisible();
      await expect(view.getByTestId('edits-full-cell').locator('.cl-row.new').first()).toBeVisible();
      await expect(view).not.toContainText('전체 모습을 만들지 못했습니다');
    });
  }
  test.info().annotations.push({ type: 'edits 단계 수', description: String(steps.length) });
});

test('먼저 다시 실행할 칸이 있으면 안내와 그 단계 링크', async ({ page }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const s = L.steps.find((x: any) => x.rerun_first.length);
  test.skip(!s, 'rerun_first 가 있는 단계 없음');
  await page.goto(`/lectures/${L.lecture_id}/${s.slug}/#practice`);
  const note = page.getByTestId('rerun-first');
  await expect(note).toContainText('먼저 다시 실행');
  await expect(note.getByRole('link', { name: `${s.rerun_first[0]} 셀` })).toBeVisible();
});
