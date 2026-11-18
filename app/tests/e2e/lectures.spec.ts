// 1편 개요의 재구성 과제(정본 task_ko·확인 셀 check_code·통과 기준 pass_ko, 힌트 H4 는 정답 코드), 선택 단계 제외, 준비 코드 출처,
// 1편 확인 문제(예측·고르기)도 틀린 뒤 다시 풀어 힌트 다음 단계를 열 수 있음,
// 홈 10편 목록과 준비 중인 편의 설계 안내(content/lectures.yaml = docs/CURRICULUM.md 에서 옮긴 값). 문구는 정본·lectures.yaml 에서 읽는다.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { Page } from '@playwright/test';
import { test, expect, hydrated } from './fixtures';
import { openHintAfterAttempts } from './helpers';
import { readAnswers, readManifest, type FJson, type L01Json, type LectureList } from './manifest-types';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import { encodeResultCodeForTest } from '../../src/lib/resultCode';
import { checkpointHeadKo } from '../../src/lib/curriculumText';

const L01: L01Json = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/L01.json'), 'utf8'));
const F: FJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/F.json'), 'utf8'));
const LIST: LectureList = YAML.parse(fs.readFileSync(path.join(REPO_ROOT, 'content/lectures.yaml'), 'utf8'));
const plain = (t: string) => t.replace(/`/g, '');
/** 정답 코드에만 있는 줄(과제 글·확인 셀·통과 기준에 같은 글이 있으면 표시로 쓰지 않는다) */
const solutionMarker = (t: L01Json['rebuild_tasks'][number]) =>
  t.solution_code
    .split('\n')
    .map((x) => x.trim())
    .find((x) => x.length > 10 && ![t.task_ko, t.check_code, t.pass_ko].some((f) => f.includes(x))) ?? '';

test('1편 개요 재구성 과제: 과제 글·확인 셀(줄별 풀이)·통과 기준·확인 셀 출력, 정답 코드는 H4 를 열기 전에는 없다', async ({ page, api }) => {
  const L = (await readManifest(page)).lectures[0];
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  for (const t of L01.rebuild_tasks) {
    const card = page.getByTestId(`rebuild-${t.rebuild_id}`);
    await expect(card).toContainText(t.title_ko);
    await expect(card).toContainText(plain(t.task_ko));
    await expect(card.getByTestId(`rebuild-check-${t.rebuild_id}`).locator('.cl-row')).toHaveCount(t.check_code_line_notes_ko.length);
    await expect(card.getByTestId(`rebuild-pass-${t.rebuild_id}`)).toHaveText(`통과 기준: ${plain(t.pass_ko)}`);
    await expect(card.getByTestId(`rebuild-expected-${t.rebuild_id}`)).toHaveText(t.check.expected);
    await expect(card.getByTestId(`rebuild-state-${t.rebuild_id}`)).toHaveText('○ 아직');
  }
  const html = await (await page.request.get(`/lectures/${L.lecture_id}/`)).text();
  for (const t of L01.rebuild_tasks) expect(html, t.rebuild_id).not.toContain(solutionMarker(t));
  // 힌트: "아직 안 돼요"가 시도로 세어져 다음 단계가 열리고, H4 에서 정답 코드와 출처
  const t = L01.rebuild_tasks[0];
  const card = page.getByTestId(`rebuild-${t.rebuild_id}`);
  const ladder = card.getByTestId(`hints-${t.rebuild_id}`);
  const notYet = () => card.getByTestId(`rebuild-notyet-${t.rebuild_id}`).click();
  for (let lv = 1; lv <= 4; lv++) {
    if (lv === 4) expect(await page.locator('body').textContent()).not.toContain(solutionMarker(t));
    await openHintAfterAttempts(ladder, lv, notYet);
    await expect(ladder.getByTestId(`hint-${t.rebuild_id}-H${lv}`)).toBeVisible();
  }
  await expect(ladder.getByTestId(`hint-${t.rebuild_id}-H4`).locator('.codeblock')).toContainText(solutionMarker(t));
  await expect(ladder.getByTestId(`hint-${t.rebuild_id}-H4`)).toContainText(plain(t.solution_source_ko).slice(0, 20));
  expect(api.externalRequests).toEqual([]);
});

/** 1편 확인 문제 하나를 틀리게 낸다(예측은 엉뚱한 숫자, 고르기는 정답이 아닌 보기) */
async function submitWrong(page: Page, qid: string, type: string, answerIndex: number | null) {
  const card = page.getByTestId(`question-${qid}`);
  if (type === 'choice') await card.getByRole('radio').nth(answerIndex === 0 ? 1 : 0).click();
  else await card.locator('input.input').fill('987654321');
  await card.getByTestId(`submit-${qid}`).click();
  await expect(card.getByTestId(`result-${qid}`)).toContainText('다시');
}

test('1편 예측·고르기 문항: 틀리면 풀이가 열리고 "다시 풀기"로 다시 풀 수 있어, 잠금 글대로 답을 한 번 더 내면 H2 가 열린다', async ({ page, api }) => {
  const L = (await readManifest(page)).lectures[0];
  const answers = await readAnswers(page, L.lecture_id);
  for (const type of ['predict', 'choice'] as const) {
    const q = L.questions.find((x) => x.type === type && x.hint_levels.includes(2));
    expect(q, `${type} 문항(H2 있음)`).toBeTruthy();
    if (!q) continue;
    const step = L.steps.find((s) => s.question_ids.includes(q.question_id));
    await page.goto(`/lectures/${L.lecture_id}/${step?.slug}/#quiz`);
    await hydrated(page);
    const card = page.getByTestId(`question-${q.question_id}`);
    const ladder = card.getByTestId(`hints-${q.question_id}`);
    await ladder.getByTestId('open-hint-1').click();
    await expect(ladder.getByTestId('hint-locked-2')).toContainText('답을 한 번 더 내면 열림');
    await submitWrong(page, q.question_id, type, answers[q.question_id].answer_index);
    await expect(card.getByTestId(`answer-${q.question_id}`)).toBeVisible();
    await expect(ladder).toHaveCount(0);
    await card.getByTestId(`retry-${q.question_id}`).click();
    await expect(card.getByTestId(`answer-${q.question_id}`)).toHaveCount(0);
    await ladder.getByTestId('open-hint-2').click();
    await expect(ladder.getByTestId(`hint-${q.question_id}-H2`)).toBeVisible();
  }
  await expect.poll(() => api.opsFor('question_attempt').length).toBe(2);
});

test('1편 개요: 익힘의 단계 완료는 선택 단계를 뺀다, 편 도장 id 는 정본에 없으면 STAMP-L01', async ({ page }) => {
  const L = (await readManifest(page)).lectures[0];
  const optional = L.steps.filter((s) => s.kind === 'optional').length;
  expect(L.stamp_id).toBe('STAMP-L01');
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  if (optional) await expect(page.getByTestId('mastery')).toContainText(`선택 단계 ${optional}개 제외`);
  await expect(page.locator('main header').first()).toContainText(`실행 환경 ${L01.lecture.env.join(', ')}`);
});

test('1편 단계: 준비 코드 출처 한 줄', async ({ page }) => {
  const L = (await readManifest(page)).lectures[0];
  const s = L01.steps.find((x) => x.prepared_code && x.prepared_code_source_ko);
  expect(s, '정본 1편에 준비 코드 출처가 있는 단계').toBeTruthy();
  if (!s?.prepared_code_source_ko) return;
  const slug = L.steps.find((x) => x.step_id === s.step_id)?.slug;
  await page.goto(`/lectures/${L.lecture_id}/${slug}/#practice`);
  await hydrated(page);
  await page.getByText('준비 코드 보기').click();
  await expect(page.getByTestId('prepared-source')).toHaveText(plain(s.prepared_code_source_ko));
});

test('홈 10편 목록: 제목·단계 수·누적 점검 줄은 설계서 값(랜딩과 같은 함수), 잠금 문구 없음, 모든 편이 열리고 준비 중인 편은 설계 안내', async ({ page }) => {
  const m = await readManifest(page);
  await page.goto('/home/');
  await hydrated(page);
  for (const l of LIST.lectures) {
    const row = page.getByTestId(`home-lecture-${l.lecture_id}`);
    await expect(row).toContainText(l.title_ko);
    await expect(row).toHaveAttribute('href', `/lectures/${l.lecture_id}/`);
    if (!m.lecture_list.find((x) => x.lecture_id === l.lecture_id)?.available) await expect(row).toContainText(`준비 중 · ${l.plan.steps}단계`);
  }
  for (const c of LIST.checkpoints) await expect(page.locator('.cp-line', { hasText: checkpointHeadKo(c) })).toHaveCount(1);
  await expect(page.locator('.cp-line', { hasText: '열립니다' })).toHaveCount(0);
});

test('준비 중인 편 안내(02편): 설계서의 편 목표·선행 편·선행 기초(정본 F.json)·다리 안내와 카드 요지, 03편 뒤 누적 점검, 단계 화면은 없음', async ({ page }) => {
  const l = LIST.lectures.find((x) => x.lecture_id === 'L02');
  expect(l?.bridge).toBeTruthy();
  if (!l?.bridge) return;
  await page.goto('/lectures/L02/');
  await hydrated(page);
  const plan = page.getByTestId('lecture-plan');
  await expect(page.locator('h1')).toHaveText(l.title_ko);
  await expect(page.getByTestId('lecture-plan-pending')).toBeVisible();
  await expect(plan.locator('ol li')).toHaveCount(l.objectives.length);
  const prereq = page.getByTestId('lecture-plan-prereq');
  for (const u of F.lecture.lecture_prereq_units.L02) await expect(prereq.getByRole('link', { name: new RegExp(`^${u} `) })).toHaveAttribute('href', `/basics/${u}/`);
  await expect(prereq.getByRole('link', { name: /^01 / })).toHaveAttribute('href', '/lectures/L01/');
  const bridge = page.getByTestId('lecture-plan-bridge');
  await expect(bridge.getByTestId('lecture-plan-bridge-ko')).toHaveText(`다리: ${plain(l.bridge.bridge_ko)}`);
  for (const id of l.bridge.card_ids) await expect(bridge).toContainText(plain(LIST.bridge_cards.find((c) => c.card_id === id)?.summary_ko ?? id));
  await expect(page.getByTestId('lecture-plan-checkpoint')).toHaveCount(0);
  expect((await page.request.get('/lectures/L02/S01/')).status()).toBe(404);
  const cp = LIST.checkpoints[0];
  await page.goto(`/lectures/${cp.after_lecture}/`);
  await expect(page.getByTestId('lecture-plan-checkpoint')).toContainText(`${cp.question_count}문항`);
  await expect(page.getByTestId('lecture-plan-checkpoint')).toContainText('잠그지 않고');
});

test('결과코드: 이미 통과한 칸은 나중 결과코드의 다시(f)로 덮지 않고 알린다, 재구성 칸(정본 id)은 재구성 기록이 된다', async ({ page, api }) => {
  const L = (await readManifest(page)).lectures[0];
  const graded = L.steps.filter((s) => s.kind === 'code');
  const [a, b] = [graded[0].step_id, graded[1].step_id];
  // 지금 판(claude-1.0) 기록이므로 그 판이 생긴 뒤 시각(그 전 시각의 1편 기록은 옛 1.2판 기록으로 본다, src/lib/migrate)
  const AT = '2026-11-18T01:00:00+09:00';
  api.serverTables = { grade_result: [{ check_id: a, passed: true, message_ko: '', source: 'result_code', at: AT, updated_at: AT, server_seq: 1 }] };
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  const code = encodeResultCodeForTest({ v: 1, l: L.lecture_id, p: [b, L.rebuild_ids[0]], f: [a], t: '2026-11-18T02:00:00+09:00' });
  await page.getByTestId('result-code').locator('textarea').fill(code);
  await page.getByTestId('apply-result-code').click();
  await expect(page.getByTestId('result-code-status')).toContainText(`${a}: 다시(전에 통과해서 통과로 둠)`);
  await expect.poll(() => api.opsFor('grade_result').map((o) => o.key.check_id).sort()).toEqual([b, L.rebuild_ids[0]].sort());
  await expect.poll(() => api.opsFor('rebuild_attempt').map((o) => o.key.rebuild_id)).toEqual([L.rebuild_ids[0]]);
  await expect(page.getByTestId('step-list').locator('li').nth(L.steps.findIndex((s) => s.step_id === a))).toContainText('노트북 통과');
});
