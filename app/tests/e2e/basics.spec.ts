// 사전 기초 (spec 8절, D24·D35·D37, 교사 정본 F.json 클로드 버전): 진입 화면, 진단 5문제 → 결과(정본 rules_ko·result_if_*·recommend_rules 문구, 추천만, 건너뛰기 없음),
// 단위 하나 처음부터 끝까지(설명 카드 → 단계·확인 문제 → mastery_rule ✓ 완료, 익힘 과제는 판정 밖), 새로 고침 뒤 유지,
// 서버 동기화(다른 기기 결과 받기), 풀이·재는 것은 제출 전 DOM에 없음, 01편 잠금 없음, 에러·그림 단계는 직접 확인, 통과 한도 넘은 힌트.
// 콘텐츠 수·id 는 /data/manifest.json 의 basics(빌드가 읽은 F.json)에서, 문구는 정본 F.json 에서 읽는다(문구를 박지 않는다).
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, hydrated, manifest } from './fixtures';
import { answerQuestion, openHintAfterAttempts, wrongAttempt } from './helpers';
import { diagnosticSummary, nextUnit, recommendLabelOf, unitRowState } from '../../src/lib/basics';
import { NO_SKIP_KO } from '../../src/components/BasicsParts';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';

const F = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/F.json'), 'utf8'));
const DX = F.lecture.diagnostic;
const plainText = (t: string) => t.replace(/`/g, '');

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
      const wrong = q.choices.findIndex((_: string, i: number) => i !== a.answer_index && i !== q.dont_know_index);
      await card.getByRole('radio').nth(how === 'right' ? a.answer_index : how === 'dontknow' ? q.dont_know_index : wrong).click();
    } else if (how === 'dontknow' && q.allow_dont_know) {
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
const scoreText = (s: ReturnType<typeof expected>) => `${s.correct} / ${s.total} 맞음`;
const unitList = (B: any, ids: string[]) => ids.map((id) => `${id} ${B.units.find((u: any) => u.unit_id === id).title_ko}`).join(' · ');

test('진입 화면: 머리(정본 intro_ko), 진단 카드(정본 rules_ko), 추천 규칙, 단위 목록 2개(예상 시간, 처음이면 먼저), 준비 중 단위는 링크 아님', async ({ page, api }, info) => {
  const { B } = await basicsData(page);
  await page.goto('/basics/');
  await hydrated(page);
  const py = B.units.filter((u: any) => u.group === 'python').length;
  const ma = B.units.filter((u: any) => u.group === 'math').length;
  await expect(page.locator('.kicker').first()).toHaveText('강의 전에 권장');
  await expect(page.locator('h1')).toHaveText(`사전 기초: 파이썬 ${py}단위 · 수학 ${ma}단위`);
  await expect(page.getByTestId('basics-intro').locator('p')).toHaveCount(F.lecture.intro_ko.length);
  await expect(page.getByTestId('basics-intro').locator('p').first()).toHaveText(plainText(F.lecture.intro_ko[0]));
  await expect(page.getByTestId('diag-rules').locator('li')).toHaveText(DX.rules_ko.map(plainText));
  await expect(page.getByTestId('diag-no-skip')).toHaveText(NO_SKIP_KO);
  await expect(page.getByTestId('diag-start')).toHaveAttribute('href', '/basics/diagnostic/');
  await expect(page.getByTestId('diag-result')).toHaveCount(0);
  await page.getByTestId('recommend-rules').locator('summary').click();
  for (const r of F.lecture.recommend_rules) await expect(page.getByTestId('recommend-rules')).toContainText(r.label_ko);
  await expect(page.getByTestId('units-python').locator('li')).toHaveCount(py);
  await expect(page.getByTestId('units-math').locator('li')).toHaveCount(ma);
  for (const u of B.units) {
    const row = page.getByTestId(`unit-${u.unit_id}`);
    expect(u.ready).toBe(u.status !== 'planned');
    await expect(row).toContainText(`약 ${u.estimated_minutes}분`);
    if (u.ready) {
      await expect(row).toHaveAttribute('href', `/basics/${u.unit_id}/`);
      await expect(page.getByTestId(`unit-state-${u.unit_id}`)).toHaveText(unitRowState(true, 'todo', recommendLabelOf(u.unit_id, [], B.recommend)).label);
    } else {
      expect(await row.evaluate((el) => el.tagName)).not.toBe('A');
      await expect(page.getByTestId(`unit-state-${u.unit_id}`)).toContainText('준비 중');
    }
  }
  // 처음이면 먼저(정본 always_first) 단위는 진단 전에도 그 이름으로 보인다
  for (const id of B.recommend.always_first.units) await expect(page.getByTestId(`unit-state-${id}`)).toHaveText(B.recommend.always_first.label_ko);
  const next = nextUnit(B.units, () => 'todo', B.recommend.always_first.units);
  await expect(page.getByTestId('basics-next')).toContainText(next!);
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

test('진단: 문제 코드가 보이고, 정답·재는 것은 결과 보기 전 DOM에 없고, 일부 틀림·모르겠어요 → 정본 문구(점수·추천 단위·처음이면 먼저), 건너뛰기 없음, 서버로 저장', async ({ page, api }, info) => {
  const { m, B, answers } = await basicsData(page);
  // 정답 자료(/data/F/answers.json)는 "결과 보기"를 누르기 전에는 이 화면이 받지 않는다(네트워크로 확인)
  const answerReqs: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === `/data/${B.lecture_id}/answers.json`) answerReqs.push(r.url());
  });
  await page.goto('/basics/diagnostic/');
  await expect(page.getByTestId('diag-no-skip')).toHaveText(NO_SKIP_KO);
  await expect(page.getByTestId('diag-rules').locator('li')).toHaveText(DX.rules_ko.map(plainText));
  await expect(page.getByTestId('diag-result')).toHaveCount(0);
  await expect(page.getByTestId('diag-review')).toHaveCount(0);
  const html = await (await page.request.get('/basics/diagnostic/')).text();
  expect(html).not.toContain('answer_index');
  expect(html).not.toContain('auto_grade');
  for (const q of F.questions.filter((x: any) => x.unit_id === 'F-DIAG')) {
    expect(html, q.question_id).not.toContain(q.measures_ko);
    expect(html, q.question_id).not.toContain(q.answer_ko);
    if (q.code) await expect(page.getByTestId(`diag-${q.question_id}`).locator('pre')).toHaveText(q.code.replace(/\n+$/, ''));
  }
  await expect(page.locator('[data-testid^="hints-"]')).toHaveCount(0);

  const ids = B.diagnostic.map((q: any) => q.question_id);
  const choiceIds = B.diagnostic.filter((q: any) => q.type === 'choice').map((q: any) => q.question_id);
  const direct = B.diagnostic.find((q: any) => q.type !== 'choice' && q.allow_dont_know);
  const plan: Plan = { [choiceIds[1]]: 'wrong', [choiceIds[2]]: 'dontknow', ...(direct ? { [direct.question_id]: 'dontknow' } : {}) };
  await hydrated(page);
  await page.getByTestId('diag-submit').click();
  await expect(page.getByTestId('diag-msg')).toContainText('아직 답하지 않은 문제가 있습니다');
  await solveDiagnostic(page, B, answers, plan);
  await page.waitForLoadState('networkidle');
  expect(answerReqs, '결과 보기 전 정답 자료 요청').toEqual([]);
  await page.getByTestId('diag-submit').click();
  await expect.poll(() => answerReqs.length).toBeGreaterThan(0);

  const s = expected(B, plan);
  await expect(page.getByTestId('diag-score')).toHaveText(scoreText(s));
  // 진단은 합격·불합격이 아니라 점수와 상관없이 중립 상자(맞음·다시 색과 기호 없음)
  await expect(page.getByTestId('diag-result')).not.toHaveClass(/\bresult\b/);
  await expect(page.getByTestId('diag-result').locator('svg')).toHaveCount(0);
  await expect(page.getByTestId('diag-units')).toHaveText(`${B.recommend.diagnostic.label_ko}: ${DX.result_if_wrong_ko} ${unitList(B, s.units)}`);
  await expect(page.getByTestId('diag-always')).toHaveText(`${B.recommend.always_first.label_ko}: ${unitList(B, B.recommend.always_first.units)}`);
  await expect(page.getByTestId('diag-review').locator('li')).toHaveCount(ids.length);
  for (const q of F.questions.filter((x: any) => x.unit_id === 'F-DIAG')) {
    await expect(page.getByTestId(`diag-measures-${q.question_id}`)).toHaveText(`재는 것: ${q.measures_ko}`);
    const right = (plan[q.question_id] ?? 'right') === 'right';
    await expect(page.getByTestId(`diag-review-next-${q.question_id}`)).toHaveText(right ? DX.result_if_correct_ko : `${DX.result_if_wrong_ko} ${unitList(B, q.recommend_units_if_wrong)}`);
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
  const dkQ = B.diagnostic.find((q: any) => q.question_id === choiceIds[2]);
  expect(op.data.answers.find((a: any) => a.question_id === choiceIds[2])).toMatchObject({ is_correct: false, is_dont_know: true, choice_index: dkQ.dont_know_index, answer_text: dkQ.choices[dkQ.dont_know_index] });
  if (direct) expect(op.data.answers.find((a: any) => a.question_id === direct.question_id)).toMatchObject({ is_correct: false, is_dont_know: true });
  expect(api.opsFor('question_attempt').filter((o) => ids.includes(o.key.question_id))).toEqual([]);

  // 기초 목록: 결과가 진단 카드에, 진단이 모은 단위에 진단 규칙 이름, 나머지 처음이면 먼저 단위에 그 이름
  await page.goto('/basics/');
  await hydrated(page);
  await expect(page.getByTestId('diag-score')).toHaveText(scoreText(s));
  await expect(page.getByTestId('diag-start')).toContainText('다시 풀기');
  for (const u of B.units) await expect(page.getByTestId(`unit-state-${u.unit_id}`)).toHaveText(unitRowState(u.ready, 'todo', recommendLabelOf(u.unit_id, s.units, B.recommend)).label);
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId('diag-score')).toHaveText(scoreText(s));

  // 01편은 잠기지 않는다
  const L = m.lectures[0];
  for (const path of [`/lectures/${L.lecture_id}/`, `/lectures/${L.lecture_id}/${L.steps[0].slug}/`]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByText(/잠김|잠겨|먼저 기초/)).toHaveCount(0);
  }
});

test('진단 다시 풀기: 다 맞으면 추천 단위 줄 대신 정본 result_if_correct_ko, 처음이면 먼저는 늘', async ({ page, api }) => {
  const { B, answers } = await basicsData(page);
  await page.goto('/basics/diagnostic/');
  const first: Plan = Object.fromEntries(B.diagnostic.map((q: any) => [q.question_id, 'wrong']));
  await solveDiagnostic(page, B, answers, first);
  await page.getByTestId('diag-submit').click();
  await expect(page.getByTestId('diag-score')).toHaveText(scoreText(expected(B, first)));
  await page.getByTestId('diag-retake').click();
  await expect(page.getByTestId('diag-view-form')).toBeVisible();
  await expect(page.getByTestId('diag-result')).toHaveCount(0);
  await solveDiagnostic(page, B, answers, {});
  await page.getByTestId('diag-submit').click();
  await expect(page.getByTestId('diag-score')).toHaveText(scoreText(expected(B, {})));
  await expect(page.getByTestId('diag-units')).toHaveCount(0);
  await expect(page.getByTestId('diag-all-correct')).toHaveText(DX.result_if_correct_ko);
  await expect(page.getByTestId('diag-always')).toContainText(B.recommend.always_first.label_ko);
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
  await expect(page.getByTestId('diag-score')).toHaveText(scoreText(s));
  for (const u of s.units) await expect(page.getByTestId(`unit-state-${u}`)).toHaveText(B.recommend.diagnostic.label_ko);
});

test('단위 하나 처음부터 끝까지: 설명 카드, 영상 없음, 단계·확인 문제(풀이는 제출 뒤) → ✓ 완료(익힘 과제는 판정 밖), 서버로 저장', async ({ page, api }, info) => {
  test.setTimeout(180_000);
  const { B, answers } = await basicsData(page);
  const uid = B.ready_ids[0];
  const u = B.units.find((x: any) => x.unit_id === uid);
  const src = F.lecture.units.find((x: any) => x.unit_id === uid);
  const steps = B.steps[uid];
  await page.goto(`/basics/${uid}/`);
  await hydrated(page);
  await expect(page.getByTestId('unit-status')).toHaveText('○ 아직');
  await expect(page.getByTestId('unit-goal')).toHaveText(plainText(src.goal_ko));
  await expect(page.getByTestId('unit-analogy')).toHaveText(`비유: ${plainText(src.analogy_ko)}`);
  await expect(page.getByTestId('unit-card-lines').locator('li')).toHaveCount(src.card_ko.length);
  await expect(page.getByTestId('unit-card-lines').locator('li').first()).toHaveText(plainText(src.card_ko[0]));
  await expect(page.getByTestId('unit-minutes')).toHaveText(`약 ${src.estimated_minutes}분`);
  await expect(page.getByTestId('unit-needed-by')).toContainText(src.needed_by_lectures.map((l: string) => l.slice(1)).join(', '));
  await expect(page.getByTestId('unit-mastery')).toHaveText(plainText(F.mastery_rule.note_ko));
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
        if (answers[qid].answer_code) await expect(card.getByTestId(`answer-code-${qid}`)).toBeVisible();
      }
      await page.getByTestId('next-step').click();
    }
  }
  await expect(page).toHaveURL(new RegExp(`/basics/${uid}/$`));
  await hydrated(page);
  // 판정에 넣는 익힘 과제가 없으면(정본 rebuild_required false) 단계·문제만으로 완료
  await expect(page.getByTestId('unit-status')).toHaveText(u.mastery.rebuilds.length ? '● 지금' : '✓ 완료');
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

test('익힘 과제: 과제 글·출력 예·스스로 확인할 것, 한도보다 높은 힌트를 열면 통과 아님, 힌트 없이 다시 하면 통과, H4 는 정답 코드', async ({ page, api }) => {
  const { B } = await basicsData(page);
  const all = B.ready_ids.flatMap((uid: string) => B.rebuild[uid].map((r: any) => ({ ...r, uid })));
  const r = all.find((x: any) => x.max_hint_level_for_pass != null && x.hint_levels.includes(x.max_hint_level_for_pass + 2));
  test.skip(!r, '통과 한도보다 2단계 높은 힌트가 있는 과제 없음');
  const src = F.rebuild_tasks.find((x: any) => x.rebuild_id === r.rebuild_id);
  const L = r.max_hint_level_for_pass;
  const rows = () => api.opsFor('rebuild_attempt').filter((o) => o.key.rebuild_id === r.rebuild_id);
  await page.goto(`/basics/${r.uid}/`);
  await hydrated(page);
  const card = page.getByTestId(`rebuild-${r.rebuild_id}`);
  await expect(card).toContainText(plainText(src.prompt_ko));
  await expect(card.getByTestId(`rebuild-output-${r.rebuild_id}`)).toHaveText(src.expected_output_example);
  await expect(card.getByTestId(`rebuild-self-check-${r.rebuild_id}`).locator('li')).toHaveCount(src.self_check_ko.length);
  // 정답 코드는 H4 를 열기 전에는 화면에 없다
  expect(await page.locator('body').textContent()).not.toContain(src.solution_code.split('\n')[1]);
  const ladder = card.getByTestId(`hints-${r.rebuild_id}`);
  const notYet = () => card.getByTestId(`rebuild-notyet-${r.rebuild_id}`).click();
  for (let lv = 1; lv <= L + 1; lv++) {
    await openHintAfterAttempts(ladder, lv, notYet);
    await expect(ladder.getByTestId(`hint-${r.rebuild_id}-H${lv}`)).toBeVisible();
  }
  // 1) 한도 + 1 단계까지 열고 확인 → 통과 아님 (행: passed false, 힌트 L+1)
  await card.getByTestId(`rebuild-ok-${r.rebuild_id}`).click();
  await expect(card.getByTestId(`rebuild-result-${r.rebuild_id}`)).toContainText('다시');
  await expect.poll(() => rows().map((o) => [o.data.passed, o.data.max_hint_level])).toEqual([[false, L + 1]]);
  // 2) 한 단계 더 열고(L+2 = H4 면 정답 코드) 다시 해 보기 → 더 연 단계도 통과 아님 행으로 남고, 이 기기의 힌트 사용은 0으로
  await openHintAfterAttempts(ladder, L + 2, notYet);
  await expect(ladder.getByTestId(`hint-${r.rebuild_id}-H${L + 2}`)).toBeVisible();
  if (L + 2 === 4) await expect(ladder.getByTestId(`hint-${r.rebuild_id}-H4`).locator('.codeblock')).toContainText(src.solution_code.split('\n')[0].trim());
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

test('읽기 단계(kind read, 1편 S01 등): 실행 안내·예측 칸·결과 비교·코드 상자 없이 교사 글 세 칸과 완료 버튼만, 마치면 완료', async ({ page, api }) => {
  const { m, B } = await basicsData(page);
  const L = m.lectures[0];
  const reads = [
    ...B.ready_ids.flatMap((uid: string) => B.steps[uid].filter((s: any) => s.kind === 'read').map((s: any) => ({ path: `/basics/${uid}/${s.slug}/`, s }))),
    ...L.steps.filter((s: any) => s.kind === 'read').map((s: any) => ({ path: `/lectures/${L.lecture_id}/${s.slug}/#practice`, s })),
  ];
  test.skip(!reads.length, '읽기 단계 없음');
  for (const { path: to, s } of reads) {
    await test.step(s.step_id, async () => {
      await page.goto(to);
      await hydrated(page);
      await expect(page.locator('[data-phase="practice"]')).toBeVisible();
      await expect(page.getByTestId('run-place')).toHaveCount(0);
      await expect(page.getByTestId('prediction')).toHaveCount(0);
      await expect(page.getByTestId('paste')).toHaveCount(0);
      await expect(page.getByTestId('compare')).toHaveCount(0);
      await expect(page.getByTestId('self-ok')).toHaveCount(0);
      await expect(page.locator('.codeblock')).toHaveCount(0);
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
    await expect(page.getByTestId('rerun-first')).toHaveCount(s.rerun_first.length ? 1 : 0);
  }
});

test('기초 단계 새 칸: 셀 나누기, 실행 순서, 새 셀 위치, 먼저 다시 시작, 에러가 정상인 단계, 스스로 확인할 것, 출력 예로 비교', async ({ page }) => {
  const { B } = await basicsData(page);
  const all = B.ready_ids.flatMap((uid: string) => B.steps[uid].map((s: any) => ({ uid, s })));
  const find = (pred: (s: any) => boolean) => all.find((x: any) => pred(x.s)) ?? null;
  const open = async (x: any) => {
    await page.goto(`/basics/${x.uid}/${x.s.slug}/`);
    await hydrated(page);
  };
  const multi = find((s) => s.cells.length > 1 && !s.has_edits);
  if (multi) {
    await open(multi);
    // 기초 실습 단계 힌트는 정본에 있는 단계 수만큼(클로드 버전 H1~H2): 안내 글과 사용 수도 그 수로
    const ladder = page.getByTestId(`hints-${multi.s.step_id}`);
    await expect(ladder).toContainText(`힌트는 ${multi.s.hint_levels.length}단계입니다`);
    await expect(ladder).toContainText(`이 단계 힌트 사용: 0 / ${multi.s.hint_levels.length}`);
    for (let i = 0; i < multi.s.cells.length; i++) await expect(page.getByTestId(`step-code-cell-${i + 1}`).locator('.cl-row')).toHaveCount(multi.s.cells[i]);
  }
  const plan = find((s) => s.run_plan.length > 0 && !!s.place_before);
  if (plan) {
    await open(plan);
    await expect(page.getByTestId('run-plan').locator('li')).toHaveCount(plan.s.run_plan.length);
    await expect(page.getByTestId('place-before')).toContainText(plan.s.place_before);
  }
  const restart = find((s) => s.restart_first);
  if (restart) {
    await open(restart);
    await expect(page.getByTestId('restart-first')).toBeVisible();
    await expect(page.getByTestId('run-plan')).toContainText('다시 시작');
  }
  const err = find((s) => !!s.expected_error);
  test.skip(!multi && !plan && !restart && !err, '새 칸이 있는 단계 없음');
  if (err) {
    await open(err);
    await page.getByTestId('dont-know').click();
    await expect(page.getByTestId('error-expected')).toContainText(err.s.expected_error);
    await expect(page.getByTestId('paste')).toHaveCount(0);
    await page.getByTestId('self-ok').click();
    await expect(page.getByTestId('check-result')).toContainText('맞음');
  }
  const fig = find((s) => s.self_check > 0 && s.check === 'self');
  if (fig) {
    await open(fig);
    await page.getByTestId('dont-know').click();
    await expect(page.getByTestId('self-check-list').locator('li')).toHaveCount(fig.s.self_check);
    await expect(page.getByTestId('self-ok')).toHaveText('직접 확인했어요');
  }
  // 글 비교·숫자 범위 단계는 정본 출력 예를 그대로 붙여 넣으면 맞음
  for (const kind of ['text', 'number']) {
    const x = find((s) => s.check === kind && !!s.output_example);
    if (!x) continue;
    await open(x);
    await page.getByTestId('dont-know').click();
    await expect(page.getByTestId('expected-output-example')).toHaveText(x.s.output_example);
    await page.getByTestId('paste').fill(x.s.output_example);
    await page.getByTestId('compare').click();
    await expect(page.getByTestId('check-result'), x.s.step_id).toContainText('맞음');
  }
});

test('1편에서 기초로: 개요 추천 줄(정본 lecture_start 이름)·홈 기초 카드·힌트 H2 링크(설명 카드 문장까지)', async ({ page, api }) => {
  const { m, B } = await basicsData(page);
  const L = m.lectures[0];
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  await expect(page.getByTestId('prereq')).toContainText(B.recommend.lecture_start.label_ko);
  const prereq = page.getByTestId('prereq').locator('a');
  await expect(prereq).toHaveCount(B.lecture_prereq[L.lecture_id].length);
  for (const [i, uid] of B.lecture_prereq[L.lecture_id].entries()) await expect(prereq.nth(i)).toHaveAttribute('href', B.ready_ids.includes(uid) ? `/basics/${uid}/` : '/basics/');
  await page.goto('/home/');
  await hydrated(page);
  await expect(page.getByTestId('home-basics-done')).toHaveText(`0 / ${B.units.length} 단위 완료`);
  // 1편 단계 H2: 글 속 단위로 링크(1편 정본에는 points_to_id 칸이 없다)
  const hints = await (await page.request.get(`/data/${L.lecture_id}/hints.json`)).json();
  const step = L.steps.find((s: any) => (hints[s.step_id] ?? []).some((h: any) => h.level === 2 && h.points_to));
  test.skip(!step, 'H2가 기초 단위를 가리키는 1편 단계 없음');
  const uid = hints[step.step_id].find((h: any) => h.level === 2).points_to.unit_id;
  await page.goto(`/lectures/${L.lecture_id}/${step.slug}/#practice`);
  await hydrated(page);
  await page.getByTestId('dont-know').click();
  const ladder = page.getByTestId(`hints-${step.step_id}`);
  await ladder.getByTestId('open-hint-1').click();
  await wrongAttempt(page, step.check);
  await ladder.getByTestId('open-hint-2').click();
  await expect(ladder.getByTestId(`hint-basics-${step.step_id}`)).toHaveAttribute('href', B.ready_ids.includes(uid) ? `/basics/${uid}/` : '/basics/');
  // 기초 단계 H2: 정본 points_to_card_line 이 있으면 그 단위 설명 카드 문장으로
  const fh = await (await page.request.get(`/data/${B.lecture_id}/hints.json`)).json();
  const fx = B.ready_ids.flatMap((u: string) => B.steps[u].map((s: any) => ({ u, s }))).find((x: any) => (fh[x.s.step_id] ?? []).some((h: any) => h.level === 2 && h.points_to?.card_line));
  if (fx) {
    const pt = fh[fx.s.step_id].find((h: any) => h.level === 2).points_to;
    await page.goto(`/basics/${fx.u}/${fx.s.slug}/`);
    await hydrated(page);
    await page.getByTestId('dont-know').click();
    const fl = page.getByTestId(`hints-${fx.s.step_id}`);
    await fl.getByTestId('open-hint-1').click();
    await wrongAttempt(page, fx.s.check);
    await fl.getByTestId('open-hint-2').click();
    const link = fl.getByTestId(`hint-basics-${fx.s.step_id}`);
    await expect(link).toHaveAttribute('href', `/basics/${pt.unit_id}/#card-${pt.card_line}`);
    await link.click();
    await expect(page.locator(`#card-${pt.card_line}`)).toBeVisible();
  }
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
