import type { Page } from '@playwright/test';

/** answers.json 으로 맞는 답을 만든다(콘텐츠가 바뀌어도 같은 테스트를 쓰려고) */
export function correctResponse(a: any): { kind: 'choice'; index: number } | { kind: 'text'; text: string; checkAll: boolean } {
  const g = a.auto_grade ?? {};
  if (a.type === 'choice' || g.type === 'choice') return { kind: 'choice', index: a.answer_index };
  if (g.type === 'exact') return { kind: 'text', text: String(Array.isArray(g.value) ? g.value[0] : g.value), checkAll: false };
  if (g.type === 'numeric_range') return { kind: 'text', text: String((g.min + g.max) / 2), checkAll: false };
  if (g.type === 'keywords') {
    const fromRubric = (a.rubric ?? []).map((r: any) => r.keywords?.[0]).filter(Boolean);
    const fromGroups = (g.keywords ?? []).map((k: any) => (Array.isArray(k) ? k[0] : k));
    return { kind: 'text', text: [...fromRubric, ...fromGroups].join(' ') || '설명', checkAll: true };
  }
  return { kind: 'text', text: '내 설명입니다', checkAll: true };
}

/** 단계의 결과 확인을 일부러 틀리게 한 번 한다 (힌트 열림 조건용 시도 1회) */
export async function wrongAttempt(page: Page, checkType: string) {
  if (checkType === 'manual') await page.getByRole('button', { name: '달라요' }).click();
  else {
    await page.getByTestId('paste').fill(checkType === 'value_range' ? '987654321' : 'zz 전혀 다른 출력');
    await page.getByTestId('compare').click();
  }
}

export const isRubric = (a: any) => ['keywords', 'manual'].includes(a?.auto_grade?.type);

export async function answerQuestion(page: Page, qid: string, a: any) {
  const card = page.getByTestId(`question-${qid}`);
  const r = correctResponse(a);
  if (r.kind === 'choice') await card.getByRole('radio').nth(r.index).click();
  else await card.locator('textarea, input.input').first().fill(r.text);
  await card.getByTestId(`submit-${qid}`).click();
  if (isRubric(a)) {
    const confirm = card.getByRole('button', { name: '채점 확정' });
    await confirm.waitFor();
    const boxes = card.locator('input[type="checkbox"]');
    for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
    await confirm.click();
  }
  await card.getByTestId(`result-${qid}`).waitFor();
  return card;
}
