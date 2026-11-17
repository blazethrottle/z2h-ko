// P7 PR 스크린샷(docs/screenshots/p7/). npm run shots:p7 (playwright.shots.config.ts)로만 돈다. npm run test:e2e 에는 들어가지 않는다.
// 계정은 가짜 서버(fixtures.ts)가 만드는 개발용 계정이고 실명·이메일은 화면에 없다. 판정은 다른 spec 이 하고 여기서는 그림만 남긴다.
// 가짜 서버는 api 를 받을 때 붙는다: 받지 않으면 화면이 "오프라인"으로 찍힌다.
import path from 'node:path';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect, hydrated } from '../e2e/fixtures';
import { readAnswers, readManifest } from '../e2e/manifest-types';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';

const DIR = path.join(REPO_ROOT, 'docs/screenshots/p7');
const width = (info: TestInfo) => (info.project.name.startsWith('mobile') ? '390' : '1280');
const shot = async (page: Page, info: TestInfo, name: string, el?: Locator) => {
  const file = path.join(DIR, `${width(info)}_${name}.png`);
  // 부분 그림에는 화면에 고정된 위·아래 막대가 겹치지 않게 숨긴다
  if (el) await el.screenshot({ path: file, style: '.topbar, .tabbar { visibility: hidden !important; }' });
  else await page.screenshot({ path: file, fullPage: true });
};

test('기초: 목록, 단위 설명 카드, 기초 단계(실행 순서·새 셀 위치), 진단과 모르겠어요, 진단 결과', async ({ page, api }, info) => {
  const B = (await readManifest(page)).basics;
  await page.goto('/basics/');
  await hydrated(page);
  await shot(page, info, 'basics_list');
  const uid = B.ready_ids.find((u) => u === 'F-P3') ?? B.ready_ids[0];
  await page.goto(`/basics/${uid}/`);
  await hydrated(page);
  await shot(page, info, 'basics_unit_card', page.getByTestId('unit-card'));
  await shot(page, info, 'basics_unit');
  const all = B.ready_ids.flatMap((u) => (B.steps[u] ?? []).map((s) => ({ u, s })));
  const x = all.find((y) => y.s.run_plan.length && y.s.place_before) ?? all[0];
  await page.goto(`/basics/${x.u}/${x.s.slug}/`);
  await hydrated(page);
  await page.getByTestId('dont-know').click();
  await shot(page, info, 'basics_step');
  const answers = await readAnswers(page, B.lecture_id);
  const firstChoice = B.diagnostic.find((z) => z.type === 'choice');
  await page.goto('/basics/diagnostic/');
  await hydrated(page);
  for (const q of B.diagnostic) {
    const card = page.getByTestId(`diag-${q.question_id}`);
    // 첫 고르기 문항은 모르겠어요 보기, 나머지 고르기는 정답, 직접 입력은 모르겠어요 단추
    if (q.type === 'choice') await card.getByRole('radio').nth((q === firstChoice ? q.dont_know_index : answers[q.question_id].answer_index) ?? 0).click();
    else if (q.allow_dont_know) await card.getByTestId(`diag-dont-know-${q.question_id}`).click();
  }
  await shot(page, info, 'diag_dontknow');
  await page.getByTestId('diag-submit').click();
  await expect(page.getByTestId('diag-result')).toBeVisible();
  await expect(page.locator('[data-testid^="diag-measures-"]').first()).toBeVisible();
  await shot(page, info, 'diag_result');
  expect(api.externalRequests).toEqual([]);
});

test('1편: 개요, 셀 고치기 단계, 문항 5유형, 재구성 과제', async ({ page, api }, info) => {
  const L = (await readManifest(page)).lectures[0];
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  await shot(page, info, 'l01_overview');
  const rb = page.getByTestId(`rebuild-${L.rebuild_ids[0]}`);
  await rb.getByTestId('open-hint-1').click();
  await shot(page, info, 'l01_rebuild', rb);
  const edit = L.steps.find((s) => s.has_edits && s.edit_actions.includes('replace')) ?? L.steps.find((s) => s.has_edits);
  await page.goto(`/lectures/${L.lecture_id}/${edit?.slug}/#practice`);
  await hydrated(page);
  await page.getByTestId('dont-know').click();
  await shot(page, info, 'l01_step_edits');
  for (const type of ['predict', 'choice', 'explain', 'fix_bug', 'apply'] as const) {
    const q = L.questions.find((y) => y.type === type);
    if (!q) continue;
    const step = L.steps.find((s) => s.question_ids.includes(q.question_id));
    await page.goto(`/lectures/${L.lecture_id}/${step?.slug}/#quiz`);
    await hydrated(page);
    await shot(page, info, `l01_question_${type}`, page.getByTestId(`question-${q.question_id}`));
  }
  expect(api.externalRequests).toEqual([]);
});

test('홈의 10편 목록과 준비 중인 편 안내(02편), 랜딩 수료까지의 길', async ({ page, api }, info) => {
  await page.goto('/home/');
  await hydrated(page);
  await shot(page, info, 'home_lectures');
  await page.goto('/lectures/L02/');
  await hydrated(page);
  await shot(page, info, 'lecture_plan_L02');
  await page.goto('/');
  await shot(page, info, 'landing_path', page.getByTestId('landing-path'));
  expect(api.externalRequests).toEqual([]);
});
