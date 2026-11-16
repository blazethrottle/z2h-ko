// 풀이 숨김: answer_ko와 H4 정답은 제출·열림 조건 전에는 화면 문서(DOM)와 페이지 HTML에 없다.
import { test, expect, manifest } from './fixtures';
import { answerQuestion, isRubric, wrongAttempt } from './helpers';

test('answer_ko는 제출 전 DOM·HTML에 없고, 제출 뒤에만 보인다', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const answers = await (await page.request.get(`/data/${L.lecture_id}/answers.json`)).json();
  const step = L.steps.find((s: any) => s.question_ids.length);
  test.skip(!step, '문제가 걸린 단계 없음');
  const html = await (await page.request.get(`/lectures/${L.lecture_id}/${step.slug}/`)).text();
  for (const q of step.question_ids) expect(html).not.toContain(answers[q].answer_ko);

  await page.goto(`/lectures/${L.lecture_id}/${step.slug}/#quiz`);
  const first = step.question_ids[0];
  await expect(page.getByTestId(`question-${first}`)).toBeVisible();
  const before = (await page.locator('body').textContent()) ?? '';
  for (const q of step.question_ids) expect(before).not.toContain(answers[q].answer_ko);

  const card = await answerQuestion(page, first, answers[first]);
  await expect(card.getByTestId(`result-${first}`)).toContainText('맞음');
  await expect(card.getByTestId(`answer-${first}`)).toContainText(answers[first].answer_ko.slice(0, 12));
  const after = (await page.locator('body').textContent()) ?? '';
  for (const q of step.question_ids.slice(1)) expect(after).not.toContain(answers[q].answer_ko);
  await expect.poll(() => api.opsFor('question_attempt').length).toBeGreaterThan(0);
});

test('H4 정답은 열림 조건(H3 뒤 시도 1회)을 채우고 열기 전에는 DOM에 없다', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const step = L.steps.find((s: any) => s.hint_levels.includes(4));
  test.skip(!step, 'H4가 있는 단계 없음');
  const hints = await (await page.request.get(`/data/${L.lecture_id}/hints.json`)).json();
  const h4 = hints[step.step_id].find((h: any) => h.level === 4);
  // 실습 단계의 H4 코드·풀이는 화면의 단계 코드와 겹칠 수 있다. 페이지에 없는, H4에만 있는 글을 표시로 고른다
  const html = await (await page.request.get(`/lectures/${L.lecture_id}/${step.slug}/`)).text();
  const candidates: string[] = [h4.why_ko, h4.text_ko, ...(h4.code_line_notes_ko ?? [])].filter((x: any) => typeof x === 'string' && x.length > 8);
  const h4Marker = candidates.map((c) => c.replace(/`/g, '')).find((c) => !html.includes(c) && !html.includes(c.slice(0, 20)));
  test.skip(!h4Marker, '이 단계의 H4에는 화면에 이미 보이는 내용만 있음');
  expect(html).not.toContain(h4Marker!);

  await page.goto(`/lectures/${L.lecture_id}/${step.slug}/#practice`);
  await page.getByTestId('dont-know').click();
  const ladder = page.getByTestId(`hints-${step.step_id}`);
  await ladder.getByTestId('open-hint-1').click();
  await expect(ladder.getByTestId(`hint-${step.step_id}-H1`)).toBeVisible();
  await expect(ladder.getByTestId('hint-locked-2')).toBeVisible();
  for (const lv of [2, 3, 4]) {
    await wrongAttempt(page, step.expected_check);
    if (lv === 4) expect(await page.locator('body').textContent()).not.toContain(h4Marker!);
    await ladder.getByTestId(`open-hint-${lv}`).click();
    await expect(ladder.getByTestId(`hint-${step.step_id}-H${lv}`)).toBeVisible();
  }
  await expect(ladder.getByTestId(`hint-${step.step_id}-H4`)).toContainText(h4Marker!);
  await expect(ladder).toContainText('이 단계 힌트 사용: 4 / 4');
  await wrongAttempt(page, step.expected_check);
  await ladder.getByTestId('open-hint-5').click();
  await expect(ladder.getByRole('button', { name: '메모 만들기' })).toBeVisible();
  await expect.poll(() => api.opsFor('step_progress').some((o) => o.key.step_id === step.step_id && o.data.max_hint_level === 5)).toBe(true);
});

test('확인 문제의 H4 정답은 시도 조건을 채워 열기 전에는 DOM에 없다', async ({ page }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const q = L.questions.find((x: any) => x.hint_levels.includes(4));
  test.skip(!q, 'H4가 있는 문제 없음');
  const answers = await (await page.request.get(`/data/${L.lecture_id}/answers.json`)).json();
  const hints = await (await page.request.get(`/data/${L.lecture_id}/hints.json`)).json();
  const h4 = hints[q.question_id].find((h: any) => h.level === 4);
  const marker = [h4.why_ko, h4.code, h4.text_ko].filter(Boolean).map((x: string) => x.split('\n')[0].replace(/`/g, '').trim()).find((x: string) => x.length > 6)!;
  const step = L.steps.find((s: any) => s.question_ids.includes(q.question_id));
  await page.goto(`/lectures/${L.lecture_id}/${step.slug}/#quiz`);
  const card = page.getByTestId(`question-${q.question_id}`);
  const ladder = card.getByTestId(`hints-${q.question_id}`);
  const wrong = async () => {
    await card.locator('textarea, input.input').first().fill('잘 모르겠습니다');
    await card.getByTestId(`submit-${q.question_id}`).click();
    if (isRubric(answers[q.question_id])) {
      await card.getByRole('button', { name: '채점 확정' }).waitFor();
      const boxes = card.locator('input[type="checkbox"]');
      for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).uncheck();
      await card.getByRole('button', { name: '채점 확정' }).click();
    }
    await expect(card.getByTestId(`result-${q.question_id}`)).toBeVisible();
  };
  await ladder.getByTestId('open-hint-1').click();
  for (const lv of [2, 3, 4]) {
    await wrong();
    if (lv === 4) {
      expect(await page.locator('body').textContent()).not.toContain(marker);
      await expect(ladder).toContainText('이 힌트를 열면 이 문제는 0%로 계산됩니다');
    }
    await ladder.getByTestId(`open-hint-${lv}`).click();
  }
  await expect(ladder.getByTestId(`hint-${q.question_id}-H4`)).toContainText(marker);
  await expect(card.getByTestId(`answer-${q.question_id}`)).toHaveCount(0);
});
