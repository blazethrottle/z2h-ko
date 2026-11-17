// 확인 문제 5유형: 맞는 답(answers.json 으로 계산)을 내면 맞음 + 풀이, 기록은 question_attempt
import { test, expect, manifest } from './fixtures';
import { answerQuestion, isRubric } from './helpers';

test('모든 확인 문제를 맞게 풀면 맞음과 풀이가 보이고 시도가 기록된다', async ({ page, api }) => {
  test.setTimeout(120_000);
  const m = await manifest(page);
  const L = m.lectures[0];
  const answers = await (await page.request.get(`/data/${L.lecture_id}/answers.json`)).json();
  for (const s of L.steps.filter((x: any) => x.question_ids.length)) {
    await page.goto(`/lectures/${L.lecture_id}/${s.slug}/#quiz`);
    for (const qid of s.question_ids) {
      const card = await answerQuestion(page, qid, answers[qid]);
      await expect(card.getByTestId(`result-${qid}`)).toContainText('맞음');
      await expect(card.getByTestId(`answer-${qid}`)).toBeVisible();
      await expect(card.getByTestId(`result-${qid}`)).toContainText('힌트 없이');
    }
  }
  const ids = L.questions.map((q: any) => q.question_id);
  await expect.poll(() => new Set(api.opsFor('question_attempt').map((o) => o.key.question_id))).toEqual(new Set(ids));
  for (const o of api.opsFor('question_attempt')) {
    expect(o.data.is_correct).toBe(true);
    expect(o.data.score_ratio).toBe(1);
    if (L.questions.find((q: any) => q.question_id === o.key.question_id).type === 'choice') expect(typeof o.data.choice_index).toBe('number');
  }
});

test('확인 문제 고르기의 모르겠어요(정본 dont_know_index 보기)는 감점 없이 오답 기록 + 풀이 공개', async ({ page, api }) => {
  const m = await manifest(page);
  // 1편과 기초 단위의 확인 문제 중 정본에 모르겠어요 보기 번호가 있는 고르기 문항(진단 5문제는 진단 화면이라 diagnostic-dontknow.spec 이 본다)
  const L = m.lectures[0];
  const B = m.basics;
  const found = [
    ...L.questions.map((q: any) => ({ q, path: `/lectures/${L.lecture_id}/${L.steps.find((s: any) => s.question_ids.includes(q.question_id))?.slug}/#quiz` })),
    ...B.ready_ids.flatMap((u: string) => (B.questions[u] ?? []).map((q: any) => ({ q, path: `/basics/${u}/${B.steps[u].find((s: any) => s.question_ids.includes(q.question_id))?.slug}/#quiz` }))),
  ].find((x: any) => x.q.type === 'choice' && x.q.dont_know_index != null);
  // 클로드 버전 정본(L01 claude-1.0, F claude-1.1)은 확인 문제에 모르겠어요 보기를 두지 않기로 했다(L01 _meta.decisions). 채점 규칙은 grading.test 가 늘 본다
  test.skip(!found, '정본 확인 문제(1편·기초)에 dont_know_index 가 있는 고르기 문항 없음');
  const q = found.q;
  await page.goto(found.path);
  const card = page.getByTestId(`question-${q.question_id}`);
  await card.getByRole('radio').nth(q.dont_know_index).click();
  await card.getByTestId(`submit-${q.question_id}`).click();
  await expect(card.getByTestId(`result-${q.question_id}`)).toContainText('모르겠어요를 골랐습니다');
  await expect(card.getByTestId(`answer-${q.question_id}`)).toBeVisible();
  await expect.poll(() => api.opsFor('question_attempt').find((o) => o.key.question_id === q.question_id)?.data.is_dont_know).toBe(true);
});

test('힌트가 있는 문제: 점수 문구, 시도 뒤 H2 열림, 80%로 계산', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  const answers = await (await page.request.get(`/data/${L.lecture_id}/answers.json`)).json();
  const q = L.questions.find((x: any) => x.type !== 'predict' && x.type !== 'choice' && x.hint_levels.includes(2));
  test.skip(!q, 'H2가 있는 문제 없음');
  const step = L.steps.find((s: any) => s.question_ids.includes(q.question_id));
  await page.goto(`/lectures/${L.lecture_id}/${step.slug}/#quiz`);
  const card = page.getByTestId(`question-${q.question_id}`);
  const ladder = card.getByTestId(`hints-${q.question_id}`);
  await expect(ladder).toContainText('이 힌트는 점수에 영향이 없습니다.');
  await ladder.getByTestId('open-hint-1').click();
  await expect(ladder).toContainText('이 힌트를 열면 이 문제는 80%로 계산됩니다.');
  await expect(ladder.getByTestId('hint-locked-2')).toContainText('답을 한 번 더 내면 열림');
  // 틀린 답 1회
  await card.locator('textarea, input.input').first().fill('잘 모르겠습니다');
  await card.getByTestId(`submit-${q.question_id}`).click();
  if (isRubric(answers[q.question_id])) {
    await card.getByRole('button', { name: '채점 확정' }).waitFor();
    const boxes = card.locator('input[type="checkbox"]');
    for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).uncheck();
    await card.getByRole('button', { name: '채점 확정' }).click();
  }
  await expect(card.getByTestId(`result-${q.question_id}`)).toContainText('다시');
  await expect(card.getByTestId(`answer-${q.question_id}`)).toHaveCount(0);
  await ladder.getByTestId('open-hint-2').click();
  await expect(ladder).toContainText('이 문제는 80%로 계산됩니다');
  await answerQuestion(page, q.question_id, answers[q.question_id]);
  await expect(card.getByTestId(`result-${q.question_id}`)).toContainText('80%로 계산');
  await expect
    .poll(() => api.opsFor('question_attempt').find((o) => o.key.question_id === q.question_id && o.data.is_correct)?.data.score_ratio)
    .toBe(0.8);
});
