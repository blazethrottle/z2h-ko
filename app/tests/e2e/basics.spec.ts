// 사전 기초 (spec 8절, D24·D35·D37, 교사 정본 F.json v1.1): 진입 화면, 진단 5문제 → 결과(정본 result_ko 문구, 추천만, 건너뛰기 없음),
// 단위 하나 처음부터 끝까지(단계·확인 문제·스스로 해 보기 → mastery_rule ✓ 완료), 준비 중(planned) 단위는 링크 아님, 새로 고침 뒤 유지,
// 서버 동기화(다른 기기 결과 받기), 풀이는 제출 전 DOM에 없음, 01편 잠금 없음, 그림·에러 단계는 직접 확인, 통과 한도 넘은 힌트.
// 콘텐츠 수·id·문구는 /data/manifest.json 의 basics(빌드가 읽은 F.json)에서 읽는다(문구를 박지 않는다).
import type { Page } from '@playwright/test';
import { test, expect, hydrated, manifest } from './fixtures';
import { answerQuestion } from './helpers';
import { diagnosticSummary, fillTemplate, notReadyTarget, splitUnitsTemplate, unitRowState } from '../../src/lib/basics';
import { NO_SKIP_KO } from '../../src/components/BasicsParts';

async function basicsData(page: Page) {
  const m = await manifest(page);
  const answers = await (await page.request.get(`/data/${m.basics.lecture_id}/answers.json`)).json();
  return { m, B: m.basics, answers };
}

/** 진단 응답 계획: 정답 / 틀린 보기 / 모르겠어요 */
type Plan = Record<string, 'right' | 'wrong' | 'dontknow'>;

async function solveDiagnostic(page: Page, B: any, answers: any, plan: Plan) {
  await hydrated(page);
  for (const q of B.diagnostic) {
    const card = page.getByTestId(`diag-${q.question_id}`);
    const how = plan[q.question_id] ?? 'right';
    const a = answers[q.question_id];
    if (q.type === 'choice') {
      const dk = q.choices.findIndex((c: string) => /모르겠어요/.test(c));
      const wrong = q.choices.findIndex((c: string, i: number) => i !== a.answer_index && !/모르겠어요/.test(c));
      await card.getByRole('radio').nth(how === 'right' ? a.answer_index : how === 'dontknow' ? dk : wrong).click();
    } else if (how === 'dontknow' && q.dont_know_allowed) {
      await card.getByTestId(`diag-dont-know-${q.question_id}`).click();
    } else {
      const v = String(a.auto_grade.value);
      await card.getByTestId(`diag-input-${q.question_id}`).fill(how === 'right' ? `  ${v} ` : `${v}${v}9`);
    }
  }
}

/** 계획대로 풀었을 때 기대 결과 (앱과 같은 계산 함수) */
function expected(B: any, plan: Plan) {
  const rows = B.diagnostic.map((q: any) => ({ question_id: q.question_id, is_correct: (plan[q.question_id] ?? 'right') === 'right', is_dont_know: plan[q.question_id] === 'dontknow' }));
  return diagnosticSummary(B.diagnostic, rows, B.unit_order);
}
const scoreText = (B: any, s: ReturnType<typeof expected>) => fillTemplate(B.result_ko.score_template_ko, { correct: s.correct, total: s.total });
const unitsText = (B: any, s: ReturnType<typeof expected>) => {
  const [pre, post] = splitUnitsTemplate(B.result_ko.recommend_template_ko);
  return `${pre}${s.units.map((u) => (B.ready_ids.includes(u) ? u : `${u} (준비 중)`)).join(', ')}${post}`;
};
const plain = (t: string) => t.replace(/\*\*/g, '');

test('진입 화면: 머리(정본 글), 진단 카드, 단위 목록 2개, 준비 중(planned) 단위는 링크 아님', async ({ page, api }, info) => {
  const { B } = await basicsData(page);
  await page.goto('/basics/');
  await hydrated(page);
  const py = B.units.filter((u: any) => u.group === 'python').length;
  const ma = B.units.filter((u: any) => u.group === 'math').length;
  await expect(page.locator('.kicker').first()).toHaveText('강의 전에 권장');
  await expect(page.locator('h1')).toHaveText(`사전 기초: 파이썬 ${py}단위 · 수학 ${ma}단위`);
  await expect(page.getByTestId('basics-intro')).not.toBeEmpty();
  await expect(page.getByTestId('diag-no-skip')).toHaveText(NO_SKIP_KO);
  await expect(page.getByTestId('diag-start')).toHaveAttribute('href', '/basics/diagnostic/');
  await expect(page.getByText('자료 대기')).toHaveCount(0);
  await expect(page.getByTestId('diag-result')).toHaveCount(0);
  await expect(page.getByTestId('units-python').locator('li')).toHaveCount(py);
  await expect(page.getByTestId('units-math').locator('li')).toHaveCount(ma);
  for (const u of B.units) {
    const row = page.getByTestId(`unit-${u.unit_id}`);
    expect(u.ready).toBe(u.status === 'written');
    if (u.ready) {
      await expect(row).toHaveAttribute('href', `/basics/${u.unit_id}/`);
      await expect(page.getByTestId(`unit-state-${u.unit_id}`)).toHaveText('○ 아직');
    } else {
      expect(await row.evaluate((el) => el.tagName)).not.toBe('A');
      await expect(row.locator('a')).toHaveCount(0);
      await expect(page.getByTestId(`unit-state-${u.unit_id}`)).toHaveText('준비 중');
      expect((await page.request.get(`/basics/${u.unit_id}/`)).status(), `${u.unit_id} 준비 중 단위는 화면이 없다`).toBe(404);
    }
  }
  await expect(page.getByTestId('basics-next')).toContainText(B.ready_ids[0]);
  // 화면 본문에 건너뛰기 버튼·링크가 없다(머리의 "본문으로 건너뛰기"는 접근성 링크라 본문 밖)
  await expect(page.locator('main').getByRole('button', { name: /건너뛰/ })).toHaveCount(0);
  await expect(page.locator('main').getByRole('link', { name: /건너뛰/ })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `test-results/screens/${info.project.name}_basics.png`, fullPage: true });
  // 목록을 보기만 해서는 학습 기록이 생기지 않는다(동기화 표시는 저장됨, 서버로 간 변경 0건)
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  expect(api.ops).toEqual([]);
});

test('진단: 정답은 결과 보기 전 DOM에 없고, 일부 틀림·모르겠어요 → 정본 문구(점수·추천 단위·늘 붙는 문장·준비 중 안내), 건너뛰기 없음, 서버로 저장', async ({ page, api }, info) => {
  const { m, B, answers } = await basicsData(page);
  // 정답 자료(/data/F/answers.json)는 "결과 보기"를 누르기 전에는 이 화면이 받지 않는다(네트워크로 확인)
  const answerReqs: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === `/data/${B.lecture_id}/answers.json`) answerReqs.push(r.url());
  });
  await page.goto('/basics/diagnostic/');
  await expect(page.getByTestId('diag-no-skip')).toHaveText(NO_SKIP_KO);
  await expect(page.getByTestId('diag-result')).toHaveCount(0);
  await expect(page.getByTestId('diag-review')).toHaveCount(0);
  const html = await (await page.request.get('/basics/diagnostic/')).text();
  expect(html).not.toContain('answer_index');
  expect(html).not.toContain('auto_grade');
  await expect(page.locator('[data-testid^="hints-"]')).toHaveCount(0);

  const ids = B.diagnostic.map((q: any) => q.question_id);
  const choiceIds = B.diagnostic.filter((q: any) => q.type === 'choice').map((q: any) => q.question_id);
  const direct = B.diagnostic.find((q: any) => q.type !== 'choice' && q.dont_know_allowed);
  // 준비 중 단위를 추천하는 문항(예: F-D5 → F-M3·F-M4)도 하나 틀린다
  const comingQ = B.diagnostic.find((q: any) => q.recommend_units_if_wrong.some((u: string) => !B.ready_ids.includes(u)));
  const plan: Plan = { [choiceIds[1]]: 'wrong', ...(direct ? { [direct.question_id]: 'dontknow' } : {}), ...(comingQ ? { [comingQ.question_id]: 'wrong' } : {}) };
  await hydrated(page);
  await page.getByTestId('diag-submit').click();
  await expect(page.getByTestId('diag-msg')).toContainText('아직 답하지 않은 문제가 있습니다');
  await solveDiagnostic(page, B, answers, plan);
  await page.waitForLoadState('networkidle');
  expect(answerReqs, '결과 보기 전 정답 자료 요청').toEqual([]);
  await page.getByTestId('diag-submit').click();
  await expect.poll(() => answerReqs.length).toBeGreaterThan(0);

  const s = expected(B, plan);
  await expect(page.getByTestId('diag-score')).toHaveText(scoreText(B, s));
  // 진단은 합격·불합격이 아니라 점수와 상관없이 중립 상자(맞음·다시 색과 기호 없음)
  await expect(page.getByTestId('diag-result')).not.toHaveClass(/\bresult\b/);
  await expect(page.getByTestId('diag-result').locator('svg')).toHaveCount(0);
  await expect(page.getByTestId('diag-units')).toHaveText(unitsText(B, s));
  await expect(page.getByTestId('diag-always')).toHaveText(B.result_ko.always_add_ko);
  await expect(page.getByTestId('diag-review').locator('li')).toHaveCount(ids.length);
  if (comingQ) {
    await expect(page.getByTestId('diag-not-ready')).toContainText(B.result_ko.not_ready_ko);
    const target = notReadyTarget(B.units, () => 'todo', s.units);
    await expect(page.getByTestId('diag-not-ready-link')).toHaveAttribute('href', `/basics/${target}/`);
  }
  await expect(page.locator('main').getByRole('button', { name: /건너뛰/ })).toHaveCount(0);
  await expect(page.locator('main').getByRole('link', { name: /건너뛰|강의 01/ })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `test-results/screens/${info.project.name}_basics_diag_result.png`, fullPage: true });

  // 서버로 간 기록: diagnostic_result 한 행(열쇠 attempt_id, 번호는 서버가 매김), question_attempt 에는 진단을 쓰지 않는다
  await expect.poll(() => api.opsFor('diagnostic_result').length).toBe(1);
  const op = api.opsFor('diagnostic_result')[0];
  expect(Object.keys(op.key)).toEqual(['attempt_id']);
  expect(op.data.attempt_no).toBeUndefined();
  expect(op.data.user_id).toBeUndefined();
  expect(op.data.at).toMatch(/\+09:00$/);
  expect(op.data.recommended_units).toEqual(s.units);
  expect(op.data.answers.map((a: any) => a.question_id)).toEqual(ids);
  if (direct) expect(op.data.answers.find((a: any) => a.question_id === direct.question_id)).toMatchObject({ is_correct: false, is_dont_know: true });
  expect(api.opsFor('question_attempt').filter((o) => ids.includes(o.key.question_id))).toEqual([]);

  // 기초 목록: 결과가 진단 카드에, 모은 단위 전체에 "추천"(준비 중이면 "추천 · 준비 중")
  await page.goto('/basics/');
  await hydrated(page);
  await expect(page.getByTestId('diag-score')).toHaveText(scoreText(B, s));
  await expect(page.getByTestId('diag-start')).toContainText('다시 풀기');
  for (const u of B.units) await expect(page.getByTestId(`unit-state-${u.unit_id}`)).toHaveText(unitRowState(u.ready, 'todo', s.units.includes(u.unit_id)).label);
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId('diag-score')).toHaveText(scoreText(B, s));

  // 01편은 잠기지 않는다
  const L = m.lectures[0];
  for (const path of [`/lectures/${L.lecture_id}/`, `/lectures/${L.lecture_id}/${L.steps[0].slug}/`]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByText(/잠김|잠겨|먼저 기초/)).toHaveCount(0);
  }
});

test('진단 다시 풀기: 다 맞으면 추천 줄 없이 늘 붙는 문장만', async ({ page, api }) => {
  const { B, answers } = await basicsData(page);
  await page.goto('/basics/diagnostic/');
  const first: Plan = Object.fromEntries(B.diagnostic.map((q: any) => [q.question_id, 'wrong']));
  await solveDiagnostic(page, B, answers, first);
  await page.getByTestId('diag-submit').click();
  await expect(page.getByTestId('diag-score')).toHaveText(scoreText(B, expected(B, first)));
  await page.getByTestId('diag-retake').click();
  await expect(page.getByTestId('diag-view-form')).toBeVisible();
  await expect(page.getByTestId('diag-result')).toHaveCount(0);
  await solveDiagnostic(page, B, answers, {});
  await page.getByTestId('diag-submit').click();
  await expect(page.getByTestId('diag-score')).toHaveText(scoreText(B, expected(B, {})));
  await expect(page.getByTestId('diag-units')).toHaveCount(0);
  await expect(page.getByTestId('diag-not-ready')).toHaveCount(0);
  await expect(page.getByTestId('diag-always')).toHaveText(B.result_ko.always_add_ko);
  await expect.poll(() => api.opsFor('diagnostic_result').length).toBe(2);
  expect(new Set(api.opsFor('diagnostic_result').map((o) => o.key.attempt_id)).size).toBe(2);
});

test('서버 동기화: 다른 기기에서 푼 진단 결과가 이 기기 기초 화면에 보인다', async ({ page, api }) => {
  const { B } = await basicsData(page);
  const plan: Plan = { [B.diagnostic[0].question_id]: 'wrong' };
  const s = expected(B, plan);
  api.serverTables = {
    diagnostic_result: [
      {
        attempt_id: 'other-device-attempt-1',
        attempt_no: 1,
        answers: B.diagnostic.map((q: any) => ({ question_id: q.question_id, choice_index: null, answer_text: '', is_correct: !(q.question_id in plan), is_dont_know: false })),
        recommended_units: s.units,
        at: '2026-11-17T10:00:00+09:00',
        updated_at: '2026-11-17T10:00:00+09:00',
        server_seq: 1,
        content_version: B.content_version,
      },
    ],
  };
  await page.goto('/basics/');
  await expect(page.getByTestId('diag-score')).toHaveText(scoreText(B, s));
  for (const u of s.units) await expect(page.getByTestId(`unit-state-${u}`)).toContainText('추천');
});

test('단위 하나 처음부터 끝까지: 영상 없음, 단계·선택 단계·확인 문제(풀이는 제출 뒤)·스스로 해 보기 → ✓ 완료, 서버로 저장', async ({ page, api }, info) => {
  test.setTimeout(180_000);
  const { B, answers } = await basicsData(page);
  const uid = B.ready_ids[0];
  const u = B.units.find((x: any) => x.unit_id === uid);
  const steps = B.steps[uid];
  await page.goto(`/basics/${uid}/`);
  await hydrated(page);
  await expect(page.getByTestId('unit-status')).toHaveText('○ 아직');
  await expect(page.getByTestId('unit-goal')).not.toBeEmpty();
  await expect(page.getByTestId('unit-mastery')).not.toBeEmpty();
  await expect(page.getByTestId('unit-step-list').locator('li')).toHaveCount(steps.length);
  for (const r of B.rebuild[uid]) await expect(page.getByTestId(`rebuild-${r.rebuild_id}`)).toBeVisible();
  await page.screenshot({ path: `test-results/screens/${info.project.name}_basics_unit.png`, fullPage: true });
  await page.getByTestId('unit-continue').click();

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    await expect(page).toHaveURL(new RegExp(`/basics/${uid}/${s.slug}/`));
    await expect(page.getByTestId('step-position')).toContainText(`기초 ${uid} · 단계 ${s.order} / ${steps.length} · ${s.step_id}`);
    await hydrated(page);
    await expect(page.locator('[data-phase="practice"]')).toBeVisible();
    await expect(page.getByTestId('video-player')).toHaveCount(0);
    await expect(page.getByText('영상 보기')).toHaveCount(0);
    await expect(page.getByText('노트북 받기와 Colab 안내')).toHaveCount(0);
    await expect(page.getByTestId('read-first')).toHaveCount(s.read_first ? 1 : 0);
    if (i === 0) await page.screenshot({ path: `test-results/screens/${info.project.name}_basics_step.png`, fullPage: true });
    if (s.kind === 'optional') {
      await page.getByTestId('skip-optional').click();
      continue;
    }
    await page.getByTestId('finish-step').click();
    if (s.question_ids.length) {
      await expect(page.locator('[data-phase="quiz"]')).toBeVisible();
      for (const qid of s.question_ids) {
        const card = page.getByTestId(`question-${qid}`);
        await expect(card.getByTestId(`answer-${qid}`)).toHaveCount(0);
        await answerQuestion(page, qid, answers[qid]);
        await expect(card.getByTestId(`result-${qid}`)).toContainText('맞음');
      }
      await page.getByTestId('next-step').click();
    }
  }
  await expect(page).toHaveURL(new RegExp(`/basics/${uid}/$`));
  await hydrated(page);
  // 단계·문제만으로는 아직: 스스로 해 보기가 남았다
  await expect(page.getByTestId('unit-status')).toHaveText(B.rebuild[uid].length ? '● 지금' : '✓ 완료');
  for (const r of B.rebuild[uid]) {
    await page.getByTestId(`rebuild-ok-${r.rebuild_id}`).click();
    await expect(page.getByTestId(`rebuild-result-${r.rebuild_id}`)).toContainText('통과');
  }
  await expect(page.getByTestId('unit-status')).toHaveText('✓ 완료');
  await expect.poll(() => api.opsFor('step_progress').filter((o) => o.data.status === 'done').map((o) => o.key.step_id)).toEqual(expect.arrayContaining(u.mastery.step_ids));
  await expect.poll(() => new Set(api.opsFor('question_attempt').filter((o) => o.data.is_correct).map((o) => o.key.question_id))).toEqual(new Set(u.mastery.questions.map((x: any) => x.question_id)));
  await expect.poll(() => api.opsFor('rebuild_attempt').map((o) => [o.key.rebuild_id, o.data.passed, o.data.max_hint_level])).toEqual(B.rebuild[uid].map((r: any) => [r.rebuild_id, true, 0]));
  for (const o of api.opsFor('rebuild_attempt')) {
    expect(Object.keys(o.key).sort()).toEqual(['attempt_id', 'rebuild_id']);
    expect(o.data.attempt_no).toBeUndefined();
  }
  await page.goto('/basics/');
  await hydrated(page);
  await expect(page.getByTestId(`unit-state-${uid}`)).toHaveText('✓ 완료');
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId(`unit-state-${uid}`)).toHaveText('✓ 완료');
  // 홈의 완료 단계는 강의 단계만 센다, 기초 카드는 단위 완료 수
  await page.goto('/home/');
  await hydrated(page);
  await expect(page.getByTestId('done-count')).toHaveText('0');
  await expect(page.getByTestId('home-basics-done')).toHaveText(`1 / ${B.units.length} 단위 완료`);
});

test('스스로 해 보기: 한도보다 높은 힌트를 열면 통과 아님, 더 연 힌트도 기록, 힌트 없이 다시 하면 통과(지난 시도 행은 남음)', async ({ page, api }) => {
  const { B } = await basicsData(page);
  const all = B.ready_ids.flatMap((uid: string) => B.rebuild[uid].map((r: any) => ({ ...r, uid })));
  const r = all.find((x: any) => x.max_hint_level_for_pass != null && x.hint_levels.includes(x.max_hint_level_for_pass + 2));
  test.skip(!r, '통과 한도보다 2단계 높은 힌트가 있는 과제 없음');
  const L = r.max_hint_level_for_pass;
  const rows = () => api.opsFor('rebuild_attempt').filter((o) => o.key.rebuild_id === r.rebuild_id);
  await page.goto(`/basics/${r.uid}/`);
  await hydrated(page);
  const card = page.getByTestId(`rebuild-${r.rebuild_id}`);
  const ladder = card.getByTestId(`hints-${r.rebuild_id}`);
  for (let lv = 1; lv <= L + 1; lv++) {
    if (lv > 1) await card.getByTestId(`rebuild-notyet-${r.rebuild_id}`).click();
    await ladder.getByTestId(`open-hint-${lv}`).click();
    await expect(ladder.getByTestId(`hint-${r.rebuild_id}-H${lv}`)).toBeVisible();
  }
  // 1) 한도 + 1 단계까지 열고 확인 → 통과 아님 (행: passed false, 힌트 L+1)
  await card.getByTestId(`rebuild-ok-${r.rebuild_id}`).click();
  await expect(card.getByTestId(`rebuild-result-${r.rebuild_id}`)).toContainText('다시');
  await expect.poll(() => rows().map((o) => [o.data.passed, o.data.max_hint_level])).toEqual([[false, L + 1]]);
  // 2) 한 단계 더 열고 다시 해 보기 → 더 연 단계(L+2)도 통과 아님 행으로 남고, 이 기기의 힌트 사용은 0으로
  await ladder.getByTestId(`open-hint-${L + 2}`).click();
  await expect(ladder.getByTestId(`hint-${r.rebuild_id}-H${L + 2}`)).toBeVisible();
  await card.getByTestId(`rebuild-restart-${r.rebuild_id}`).click();
  await expect(ladder).toContainText('이 과제 힌트 사용: 0 / 4');
  await expect.poll(() => rows().map((o) => [o.data.passed, o.data.max_hint_level])).toEqual([
    [false, L + 1],
    [false, L + 2],
  ]);
  // 3) 힌트 없이 확인 → 통과 (행: passed true, 힌트 0). 지난 시도 행은 지워지지 않고 셋 다 남는다
  await card.getByTestId(`rebuild-ok-${r.rebuild_id}`).click();
  await expect(card.getByTestId(`rebuild-result-${r.rebuild_id}`)).toContainText('통과');
  await expect.poll(() => rows().map((o) => [o.data.passed, o.data.max_hint_level])).toEqual([
    [false, L + 1],
    [false, L + 2],
    [true, 0],
  ]);
  expect(new Set(rows().map((o) => o.key.attempt_id)).size).toBe(3);
  await expect(page.getByTestId('unit-mastery-check')).toContainText('스스로 해 보기: 통과');
  // 새로 고침 뒤에도 통과(이 기기 사본), 다른 단계·문제는 남아 있어 단위는 아직 완료 아님
  await page.reload();
  await hydrated(page);
  await expect(card.getByTestId(`rebuild-result-${r.rebuild_id}`)).toContainText('통과');
  await expect(page.getByTestId('unit-status')).toHaveText('● 지금');
});

test('확인 문제를 틀리면 풀이 뒤 다시 풀기: 다시 푼 점수·상태, 지난 시도 기록이 남음, 하나만 해도 ● 지금', async ({ page, api }) => {
  const { B, answers } = await basicsData(page);
  const isExactPredict = (q: string) => answers[q].type === 'predict' && answers[q].auto_grade.type === 'exact';
  const uid = B.ready_ids.find((id: string) => B.steps[id].some((s: any) => s.question_ids.some(isExactPredict)));
  test.skip(!uid, '정확히 맞히기 예측 문제가 있는 단위 없음');
  const u = B.units.find((x: any) => x.unit_id === uid);
  const step = B.steps[uid].find((s: any) => s.question_ids.some(isExactPredict));
  const qid = step.question_ids.find(isExactPredict);
  const rows = () => api.opsFor('question_attempt').filter((o) => o.key.question_id === qid);
  await page.goto(`/basics/${uid}/${step.slug}/#quiz`);
  await hydrated(page);
  const card = page.getByTestId(`question-${qid}`);
  await card.locator('input.input').fill('전혀 다른 답 zz');
  await card.getByTestId(`submit-${qid}`).click();
  await expect(card.getByTestId(`result-${qid}`)).toContainText('다시');
  await expect(card.getByTestId(`result-${qid}`)).toContainText(`점수 0 / ${answers[qid].max_points} · 힌트 없이`);
  await expect(card.getByTestId(`answer-${qid}`)).toBeVisible(); // 예측 문제는 제출하면 풀이가 열린다(시도 행만으로 열람을 알 수 있음)
  await card.getByTestId(`retry-${qid}`).click();
  await expect(card.getByTestId(`answer-${qid}`)).toHaveCount(0);
  await answerQuestion(page, qid, answers[qid]);
  await expect(card.getByTestId(`result-${qid}`)).toContainText('맞음');
  await expect(card.getByTestId(`result-${qid}`)).toContainText(`점수 ${answers[qid].max_points} / ${answers[qid].max_points} · 힌트 없이`);
  // 지난 시도(틀림, 0점)는 지워지지 않고 서버로 간 행이 둘(서로 다른 attempt_id)
  await expect.poll(() => rows().map((o) => [o.data.is_correct, o.data.raw_points, o.data.points_awarded, o.data.max_hint_level])).toEqual([
    [false, 0, 0, 0],
    [true, answers[qid].max_points, answers[qid].max_points, 0],
  ]);
  expect(new Set(rows().map((o) => o.key.attempt_id)).size).toBe(2);
  expect(rows()[0].data.answer_text).toBe('전혀 다른 답 zz');
  // 새로 고침 뒤에도 가장 좋은 점수가 보인다
  await page.reload();
  await hydrated(page);
  await expect(card.getByTestId(`result-${qid}`)).toContainText(`점수 ${answers[qid].max_points} / ${answers[qid].max_points}`);
  // 단위 화면: 이 문제 하나만 맞힌 점수 비율, 아직 맞히지 않은 문제가 남아 상태는 ● 지금
  const total = u.mastery.questions.reduce((a: number, x: any) => a + x.max_points, 0);
  await page.goto(`/basics/${uid}/`);
  await hydrated(page);
  await expect(page.getByTestId('unit-mastery-check')).toContainText(`확인 문제 점수: ${Math.round((answers[qid].max_points / total) * 100)}%`);
  await expect(page.getByTestId('unit-status')).toHaveText('● 지금');
  await page.goto('/basics/');
  await hydrated(page);
  await expect(page.getByTestId(`unit-state-${uid}`)).toHaveText('● 지금');
});

test('읽기 단계(kind read): 실행 안내·예측 칸·결과 비교·코드 상자 없이 교사 글 세 칸과 완료 버튼만, 마치면 완료', async ({ page, api }) => {
  const { B } = await basicsData(page);
  const reads = B.ready_ids.flatMap((uid: string) => B.steps[uid].filter((s: any) => s.kind === 'read').map((s: any) => ({ uid, s })));
  // 검수가 짚은 두 화면이 읽기 단계로 들어 있어야 한다
  for (const id of ['F-P1-S01', 'F-M2-S01']) expect(reads.map((x: any) => x.s.step_id)).toContain(id);
  for (const { uid, s } of reads) {
    await test.step(s.step_id, async () => {
      await page.goto(`/basics/${uid}/${s.slug}/`);
      await hydrated(page);
      await expect(page.locator('[data-phase="practice"]')).toBeVisible();
      await expect(page.getByTestId('run-place')).toHaveCount(0);
      await expect(page.getByText('어디서 실행하나요')).toHaveCount(0);
      await expect(page.getByTestId('run-new-cell')).toHaveCount(0);
      await expect(page.getByTestId('prediction')).toHaveCount(0);
      await expect(page.getByTestId('dont-know')).toHaveCount(0);
      await expect(page.getByTestId('paste')).toHaveCount(0);
      await expect(page.getByTestId('compare')).toHaveCount(0);
      await expect(page.getByTestId('self-ok')).toHaveCount(0);
      await expect(page.getByTestId('step-code')).toHaveCount(0);
      await expect(page.locator('.codeblock')).toHaveCount(0);
      await expect(page.getByText('가려짐, 예측 뒤 열림')).toHaveCount(0);
      const cells = page.locator('ol.cells > li');
      await expect(cells).toHaveCount(3);
      for (let i = 0; i < 3; i++) await expect(cells.nth(i).locator('p')).not.toBeEmpty();
      await page.getByTestId('finish-step').click();
      await expect.poll(() => api.opsFor('step_progress').some((o) => o.key.step_id === s.step_id && o.data.status === 'done')).toBe(true);
    });
  }
});

test('기초 고치는 단계: 넣기는 "기준 줄 아래에 넣음", 바꾸기는 "바꾸기 전 줄을 바꿈" 안내', async ({ page }) => {
  const { B } = await basicsData(page);
  const edits = B.ready_ids.flatMap((uid: string) => B.steps[uid].filter((s: any) => s.has_edits).map((s: any) => ({ uid, s })));
  test.skip(!edits.length, 'edits 단계 없음');
  for (const { uid, s } of edits) {
    await page.goto(`/basics/${uid}/${s.slug}/`);
    const view = page.getByTestId('edits-view');
    await expect(view.getByTestId('edits-note-insert')).toHaveCount(s.edit_actions.includes('insert') ? 1 : 0);
    await expect(view.getByTestId('edits-note-replace')).toHaveCount(s.edit_actions.includes('replace') ? 1 : 0);
    if (!s.edit_actions.includes('insert')) await expect(view).not.toContainText('그 바로 아래에');
  }
});

test('직접 확인 단계: 에러가 정상인 단계(error_match)는 에러 종류를, 그림 단계(figure)는 "직접 확인했어요"', async ({ page }) => {
  const { B } = await basicsData(page);
  const find = (pred: (s: any) => boolean) => {
    for (const uid of B.ready_ids) for (const s of B.steps[uid]) if (pred(s)) return { uid, s };
    return null;
  };
  const em = find((s) => s.expected_check === 'error_match');
  const fig = find((s) => s.expected_check === 'manual' && s.figure);
  test.skip(!em && !fig, 'error_match·figure 단계가 없음');
  if (em) {
    await page.goto(`/basics/${em.uid}/${em.s.slug}/`);
    await hydrated(page);
    await page.getByTestId('dont-know').click();
    await expect(page.getByTestId('error-expected')).toContainText(em.s.error_type);
    await expect(page.getByTestId('paste')).toHaveCount(0);
    await page.getByTestId('self-ok').click();
    await expect(page.getByTestId('check-result')).toContainText('맞음');
  }
  if (fig) {
    await page.goto(`/basics/${fig.uid}/${fig.s.slug}/`);
    await hydrated(page);
    await page.getByTestId('dont-know').click();
    await expect(page.getByTestId('figure-note')).toBeVisible();
    await expect(page.getByTestId('self-ok')).toHaveText('직접 확인했어요');
    await page.getByTestId('self-ok').click();
    await expect(page.getByTestId('check-result')).toContainText('맞음');
  }
  // 출력 예(expected_output_example)는 보여야 하는 것 아래 코드 글꼴로
  const ex = find((s) => !!s.output_example);
  if (ex) {
    await page.goto(`/basics/${ex.uid}/${ex.s.slug}/`);
    await hydrated(page);
    await page.getByTestId('dont-know').click();
    await expect(page.getByTestId('expected-output-example')).toHaveText(ex.s.output_example);
  }
});

test('1편에서 기초로: 개요 추천 줄·홈 기초 카드·힌트 H2 링크는 준비된 단위 화면으로', async ({ page, api }) => {
  const { m, B } = await basicsData(page);
  const L = m.lectures[0];
  await page.goto(`/lectures/${L.lecture_id}/`);
  const prereq = page.getByTestId('prereq').locator('a');
  const n = await prereq.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const uid = ((await prereq.nth(i).textContent()) ?? '').match(/F-[PM]\d+/)![0];
    await expect(prereq.nth(i)).toHaveAttribute('href', B.ready_ids.includes(uid) ? `/basics/${uid}/` : '/basics/');
  }
  await page.goto('/home/');
  await hydrated(page);
  await expect(page.getByTestId('home-basics-done')).toHaveText(`0 / ${B.units.length} 단위 완료`);
  const hints = await (await page.request.get(`/data/${L.lecture_id}/hints.json`)).json();
  const step = L.steps.find((s: any) => (hints[s.step_id] ?? []).some((h: any) => h.level === 2 && /F-[PM]\d+/.test(h.text_ko)));
  test.skip(!step, 'H2가 기초 단위를 가리키는 1편 단계 없음');
  const uid = hints[step.step_id].find((h: any) => h.level === 2).text_ko.match(/F-[PM]\d+/)[0];
  await page.goto(`/lectures/${L.lecture_id}/${step.slug}/#practice`);
  await hydrated(page);
  await page.getByTestId('dont-know').click();
  const ladder = page.getByTestId(`hints-${step.step_id}`);
  await ladder.getByTestId('open-hint-1').click();
  if (step.expected_check === 'manual') await page.getByRole('button', { name: '달라요' }).click();
  else {
    await page.getByTestId('paste').fill(step.expected_check === 'value_range' ? '987654321' : 'zz 전혀 다른 출력');
    await page.getByTestId('compare').click();
  }
  await ladder.getByTestId('open-hint-2').click();
  await expect(ladder.getByTestId(`hint-basics-${step.step_id}`)).toHaveAttribute('href', B.ready_ids.includes(uid) ? `/basics/${uid}/` : '/basics/');
});

test('기초 화면 누르는 곳은 44px 이상', async ({ page, api }) => {
  const { B } = await basicsData(page);
  const uid = B.ready_ids[0];
  for (const path of ['/basics/', '/basics/diagnostic/', `/basics/${uid}/`, `/basics/${uid}/${B.steps[uid][0].slug}/`]) {
    await page.goto(path);
    await hydrated(page);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('button, a.btn, .chip, .tabbar a, .topnav a, .iconbtn, .opt')]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => ({ t: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), r: el.getBoundingClientRect() }))
        .filter((x) => x.r.height < 44 || x.r.width < 44)
        .map((x) => `${x.t} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`),
    );
    expect(small, path).toEqual([]);
  }
  expect(api.externalRequests).toEqual([]);
});
