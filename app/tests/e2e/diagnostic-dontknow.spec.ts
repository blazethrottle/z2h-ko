// 기초 진단 "모르겠어요" (P6-A, 2026-11-17 폰 증상: 직접 입력 문항 F-D3 에서 눌러도 반응이 없어 보임).
// 누르면 눈에 보이게 바뀌고(눌림 모양 + "모르겠어요로 기록" 안내), 답한 문제로 세어지며(빠진 문제 안내에서 빠짐),
// 다시 누르면 취소되어 입력칸을 다시 쓸 수 있다. 고르기 문항의 "모르겠어요" 보기와 모양·안내가 같다.
// 결과에는 감점 없이 "모르겠어요"로 기록된다. 정답 자료는 "결과 보기" 전에 받지 않는다.
// 두 폭(390px 폰·1280px 맥) 모두에서 돈다. 폰 폭에서는 클릭 대신 터치(tap)로 누른다.
import fs from 'node:fs';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect, hydrated, manifest } from './fixtures';
import { resolveBasicsPath } from '../../src/lib/content/load.mjs';

/** 교사 정본 F.json (빌드가 읽는 것과 같은 경로 규칙). 추천 단위 기대값은 앱 계산 함수가 아니라 여기서 직접 읽는다 */
const F = JSON.parse(fs.readFileSync(resolveBasicsPath().path, 'utf8'));
const recommendOf = (qid: string): string[] => F.questions.find((q: any) => q.question_id === qid).recommend_units_if_wrong;

const NOTE = '모르겠어요로 기록';

async function basicsData(page: Page) {
  const m = await manifest(page);
  const answers = await (await page.request.get(`/data/${m.basics.lecture_id}/answers.json`)).json();
  return { B: m.basics, answers };
}

/** 폰 폭은 터치, 맥 폭은 클릭 */
const press = (l: Locator, info: TestInfo) => (info.project.name.startsWith('mobile') ? l.tap() : l.click());

/** 눈에 보이는 모양(테두리·바탕·모서리·높이) */
const looks = (l: Locator) =>
  l.evaluate((el) => {
    const s = getComputedStyle(el);
    return { border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`, bg: s.backgroundColor, radius: s.borderTopLeftRadius, minH: s.minHeight };
  });

/** WCAG 대비(글자색 대 바탕색). rgb()/rgba() 글자만 받는다 */
function contrast(fg: string, bg: string): number {
  const lum = (c: string) => {
    const [r, g, b] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => {
      const x = Number(v) / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** 정답 자료(/data/F/answers.json) 요청을 센다(page.request 로 테스트가 받은 것은 세지 않는다) */
function watchAnswers(page: Page, lectureId: string) {
  const reqs: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === `/data/${lectureId}/answers.json`) reqs.push(r.url());
  });
  return reqs;
}

test('직접 입력 문항 모르겠어요: 누르면 눌림 모양·안내 문구, 답한 문제로 셈, 다시 누르면 취소되고 입력칸을 쓸 수 있음', async ({ page, api }, info) => {
  const { B } = await basicsData(page);
  const q = B.diagnostic.find((x: any) => x.type !== 'choice' && x.allow_dont_know);
  expect(q, '직접 입력 + 모르겠어요 문항(F-D3)이 정본에 있어야 합니다').toBeTruthy();
  const qid = q.question_id;
  const total = B.diagnostic.length;
  const answerReqs = watchAnswers(page, B.lecture_id);
  await page.goto('/basics/diagnostic/');
  await hydrated(page);

  const card = page.getByTestId(`diag-${qid}`);
  const btn = card.getByTestId(`diag-dont-know-${qid}`);
  const input = card.getByTestId(`diag-input-${qid}`);
  const msg = page.getByTestId('diag-msg');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await expect(card).not.toContainText(NOTE);
  const idle = await looks(btn);
  const inputIdle = await looks(input);

  // 먼저 아무것도 안 하고 결과 보기 → 빠진 문제 안내에 이 문항이 있다
  await page.getByTestId('diag-submit').click();
  await expect(msg).toContainText('아직 답하지 않은 문제가 있습니다');
  await expect(msg).toContainText(qid);

  // 1) 누르면: 눌림 상태 + 모양이 바뀜 + "고름" + 안내 문구, 입력칸은 잠기고 비어 있음
  await btn.scrollIntoViewIfNeeded();
  await press(btn, info);
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => looks(btn), '누른 뒤 모양이 바뀌어야 합니다').not.toEqual(idle);
  await expect(btn).toContainText('고름');
  const note = card.getByTestId(`diag-dk-note-${qid}`);
  await expect(note).toBeVisible();
  await expect(note).toContainText(NOTE);
  await expect(note).toContainText('다시 누르면');
  await expect(input).toBeDisabled();
  await expect(input).toHaveValue('');
  expect(await looks(input), '잠긴 입력칸은 잠긴 모양').not.toEqual(inputIdle);
  // 잠긴 칸의 흐린 안내 글("모르겠어요로 기록함")도 바탕과 4.5:1 이상
  const ph = await input.evaluate((el) => ({ fg: getComputedStyle(el, '::placeholder').color, op: getComputedStyle(el, '::placeholder').opacity, bg: getComputedStyle(el).backgroundColor }));
  expect(await input.getAttribute('placeholder')).toBeTruthy();
  expect(ph.op).toBe('1');
  expect(contrast(ph.fg, ph.bg), `안내 글 ${ph.fg} / 바탕 ${ph.bg}`).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: `test-results/screens/${info.project.name}_diag_dontknow_on.png`, fullPage: true });

  // 2) 진행: 답한 문제로 세고, 빠진 문제 안내에서 바로 빠진다(다른 문제는 남음)
  await expect(page.getByTestId('diag-progress')).toHaveText(`답한 문제 1 / ${total}`);
  // 한 번 누를 때 읽기 프로그램 알림이 겹치지 않게 진행 줄은 알림 칸이 아니다
  await expect(page.getByTestId('diag-progress')).not.toHaveAttribute('aria-live');
  await expect(page.getByTestId('diag-progress')).not.toHaveAttribute('role');
  await expect(msg).toContainText('아직 답하지 않은 문제가 있습니다');
  await expect(msg).not.toContainText(qid);

  // 3) 다시 누르면 취소: 모양·안내가 처음대로, 입력칸을 다시 쓸 수 있음
  await press(btn, info);
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => looks(btn)).toEqual(idle);
  await expect(btn).not.toContainText('고름');
  await expect(card).not.toContainText(NOTE);
  await expect(input).toBeEnabled();
  expect(await looks(input)).toEqual(inputIdle);
  await expect(page.getByTestId('diag-progress')).toHaveText(`답한 문제 0 / ${total}`);
  await expect(msg).toContainText(qid);
  await input.fill('7');
  await expect(input).toHaveValue('7');
  await expect(page.getByTestId('diag-progress')).toHaveText(`답한 문제 1 / ${total}`);
  await expect(msg).not.toContainText(qid);

  // 정답 자료는 아직 받지 않았다, 서버로 간 진단 기록도 없다
  await page.waitForLoadState('networkidle');
  expect(answerReqs, '결과 보기 전 정답 자료 요청').toEqual([]);
  expect(api.opsFor('diagnostic_result')).toEqual([]);
  // 건너뛰기 버튼 없음
  await expect(page.locator('main').getByRole('button', { name: /건너뛰/ })).toHaveCount(0);
});

test('고르기 문항의 모르겠어요 보기: 직접 입력 모르겠어요와 같은 눌림 모양·같은 안내, 다른 보기를 고르면 안내가 사라짐', async ({ page, api }, info) => {
  const { B } = await basicsData(page);
  const direct = B.diagnostic.find((x: any) => x.type !== 'choice' && x.allow_dont_know);
  const choiceQs = B.diagnostic.filter((x: any) => x.type === 'choice' && x.dont_know_index != null);
  expect(choiceQs.length, '모르겠어요 보기가 있는 고르기 문항').toBeGreaterThan(0);
  await page.goto('/basics/diagnostic/');
  await hydrated(page);

  // 직접 입력 문항을 누른 모양(기준)
  const dbtn = page.getByTestId(`diag-dont-know-${direct.question_id}`);
  await dbtn.scrollIntoViewIfNeeded();
  await press(dbtn, info);
  await expect(dbtn).toHaveAttribute('aria-pressed', 'true');
  const pressedLook = await looks(dbtn);
  const directNote = (await page.getByTestId(`diag-dk-note-${direct.question_id}`).innerText({ timeout: 5_000 })).split('.')[0];

  for (const q of choiceQs) {
    const qid = q.question_id;
    const card = page.getByTestId(`diag-${qid}`);
    const dk = q.dont_know_index;
    const other = q.choices.findIndex((_: string, i: number) => i !== dk);
    const opt = card.getByRole('radio').nth(dk);
    await opt.scrollIntoViewIfNeeded();
    await press(opt, info);
    await expect(opt).toHaveAttribute('aria-checked', 'true');
    await expect(opt).toContainText('고름');
    expect(await looks(opt), `${qid} 모르겠어요 보기와 ${direct.question_id} 모르겠어요의 눌림 모양`).toEqual(pressedLook);
    const note = card.getByTestId(`diag-dk-note-${qid}`);
    await expect(note).toBeVisible();
    await expect(note).toContainText(NOTE);
    await expect(note).toContainText(directNote);
    // 다른 보기를 고르면 모르겠어요 안내가 사라진다
    await press(card.getByRole('radio').nth(other), info);
    await expect(opt).toHaveAttribute('aria-checked', 'false');
    await expect(card).not.toContainText(NOTE);
  }
  expect(api.opsFor('diagnostic_result')).toEqual([]);
});

test('모르겠어요로 낸 결과: 문항별 결과에 "모르겠어요", 감점 없이 오답(맞음 아님), 추천에 들어감, 서버 기록 is_dont_know', async ({ page, api }, info) => {
  const { B, answers } = await basicsData(page);
  const direct = B.diagnostic.find((x: any) => x.type !== 'choice' && x.allow_dont_know);
  const choiceQ = B.diagnostic.find((x: any) => x.type === 'choice' && x.dont_know_index != null);
  const dkIds = [direct.question_id, choiceQ.question_id];
  const answerReqs = watchAnswers(page, B.lecture_id);
  await page.goto('/basics/diagnostic/');
  await hydrated(page);
  for (const q of B.diagnostic) {
    const card = page.getByTestId(`diag-${q.question_id}`);
    const a = answers[q.question_id];
    if (q.question_id === direct.question_id) {
      const b = card.getByTestId(`diag-dont-know-${q.question_id}`);
      await b.scrollIntoViewIfNeeded();
      await press(b, info);
    } else if (q.type === 'choice') {
      const i = q.question_id === choiceQ.question_id ? q.dont_know_index : a.answer_index;
      const o = card.getByRole('radio').nth(i);
      await o.scrollIntoViewIfNeeded();
      await press(o, info);
    } else {
      await card.getByTestId(`diag-input-${q.question_id}`).fill(String(a.auto_grade.value));
    }
  }
  await expect(page.getByTestId('diag-progress')).toHaveText(`답한 문제 ${B.diagnostic.length} / ${B.diagnostic.length}`);
  await expect(page.getByTestId('diag-msg')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(answerReqs, '결과 보기 전 정답 자료 요청').toEqual([]);
  await page.getByTestId('diag-submit').click();

  // 기대값: 맞힌 수는 모르겠어요 2문항을 뺀 수, 추천 단위는 정본 F.json 에서 그 두 문항의 recommend_units_if_wrong
  const total = B.diagnostic.length;
  const correct = total - dkIds.length;
  const recommended = new Set(dkIds.flatMap(recommendOf));
  const notRecommended = B.diagnostic.filter((q: any) => !dkIds.includes(q.question_id)).flatMap((q: any) => recommendOf(q.question_id)).filter((u: string) => !recommended.has(u));
  expect(recommended.size).toBeGreaterThan(0);
  await expect(page.getByTestId('diag-score')).toHaveText(`${correct} / ${total} 맞음`);
  for (const id of dkIds) {
    const row = page.getByTestId(`diag-review-${id}`);
    await expect(row).toContainText('내 답: 모르겠어요');
    await expect(row.locator('.side')).toHaveText('모르겠어요');
    await expect(row).not.toContainText('맞음');
  }
  for (const u of recommended) await expect(page.getByTestId('diag-units')).toContainText(u);
  for (const u of notRecommended) await expect(page.getByTestId('diag-units')).not.toContainText(u);
  await page.screenshot({ path: `test-results/screens/${info.project.name}_diag_dontknow_result.png`, fullPage: true });

  await expect.poll(() => api.opsFor('diagnostic_result').length).toBe(1);
  const got = api.opsFor('diagnostic_result')[0].data.answers;
  expect(got.find((a: any) => a.question_id === direct.question_id)).toMatchObject({ is_correct: false, is_dont_know: true, answer_text: '모르겠어요', choice_index: null });
  expect(got.find((a: any) => a.question_id === choiceQ.question_id)).toMatchObject({ is_correct: false, is_dont_know: true, answer_text: '모르겠어요' });
  // 진단은 확인 문제 기록(question_attempt)에 쓰지 않는다(익힘·배지 계산 밖)
  expect(api.opsFor('question_attempt').filter((o) => B.diagnostic.some((q: any) => q.question_id === o.key.question_id))).toEqual([]);
});
