// 고르기 문항 화살표 키: 선택과 함께 포커스도 옮긴다 (P2 검수 권고, WAI-ARIA radio group). 맛보기 확인 질문과 1편 고르기 문항 둘 다.
import { test, expect, hydrated, manifest } from './fixtures';
import type { Locator, Page } from '@playwright/test';

async function arrowWalk(page: Page, group: Locator) {
  const radios = group.getByRole('radio');
  const n = await radios.count();
  expect(n).toBeGreaterThanOrEqual(2);
  await radios.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(radios.first()).toHaveAttribute('aria-checked', 'true');
  await expect(radios.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(radios.nth(1)).toBeFocused();
  await expect(radios.nth(1)).toHaveAttribute('tabindex', '0');
  await expect(radios.first()).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('ArrowUp');
  await expect(radios.first()).toBeFocused();
  await expect(radios.first()).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(radios.nth(n - 1)).toBeFocused();
  await expect(radios.nth(n - 1)).toHaveAttribute('aria-checked', 'true');
}

test('맛보기 확인 질문: 화살표 키로 고르면 포커스도 함께 옮겨 간다', async ({ page, api }) => {
  const T = (await manifest(page)).taster;
  const q = T.questions[0];
  const step = T.steps.find((s: any) => s.step_id === q.after_step);
  await page.goto(`/taste/${step.slug}/`);
  await hydrated(page);
  await arrowWalk(page, page.getByTestId(`taste-q-${q.question_id}`).getByRole('radiogroup'));
});

test('1편 고르기 문항: 화살표 키로 고르면 포커스도 함께 옮겨 간다', async ({ page, api }) => {
  const L = (await manifest(page)).lectures[0];
  const q = L.questions.find((x: any) => x.type === 'choice' && x.after_step);
  test.skip(!q, '고르기 문항 없음');
  const step = L.steps.find((s: any) => s.step_id === q.after_step);
  await page.goto(`/lectures/${L.lecture_id}/${step.slug}/#quiz`);
  await hydrated(page);
  await expect(page.locator('[data-phase="quiz"]')).toBeVisible();
  await arrowWalk(page, page.getByTestId(`question-${q.question_id}`).getByRole('radiogroup'));
});
