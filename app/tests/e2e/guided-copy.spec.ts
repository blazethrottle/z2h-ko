// 안내형 길 1차(P9) A: 2~10편 준비 중 안내와 랜딩에 설계서 메모(학습자 화면 금지어)가 없고, 전체 시간(편별 예상 시간·기초 합계·길별 시간)이 없다.
// 금지어 목록은 src/content/learner-banned.mjs, 편 목록과 설계 규모는 content/lectures.yaml 에서 읽는다. 390·1280 두 폭(playwright.config.ts).
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { test, expect, hydrated } from './fixtures';
import { findLearnerBanned } from '../../src/content/learner-banned.mjs';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import type { LectureList } from './manifest-types';

const LIST: LectureList = YAML.parse(fs.readFileSync(path.join(REPO_ROOT, 'content/lectures.yaml'), 'utf8'));
const PENDING = LIST.lectures.filter((l) => l.lecture_id !== 'L01');
/** 설계서 예상 분을 편·기초 전체 시간으로 옮긴 글("약 9시간(추정)"). 실행 환경 줄의 학습 한 번 걸리는 시간("약 1~2시간")은 전체 시간이 아니라 남는다 */
const TOTAL_TIME = /시간\s*\(추정\)/;
const RUN_PLACE = /맥미니|Jupyter|두 길|MPS|mps|내 맥/;

test('준비 중 편 안내(02~10편): 설계서 메모와 편 전체 시간이 화면에도 HTML 에도 없다', async ({ page, api }) => {
  expect(PENDING.length).toBe(9);
  for (const l of PENDING) {
    await page.goto(`/lectures/${l.lecture_id}/`);
    await hydrated(page);
    await expect(page.getByTestId('lecture-plan')).toBeVisible();
    const text = await page.evaluate(() => document.body.innerText);
    expect(findLearnerBanned(text), l.lecture_id).toEqual([]);
    expect(text, l.lecture_id).not.toMatch(TOTAL_TIME);
    // 실행 장소는 Colab 하나(2026-11-18 결정): "두 길 모두"·맥미니 `mps` 병기 없음
    expect(text, l.lecture_id).not.toMatch(RUN_PLACE);
    await expect(page.getByTestId('lecture-plan-size'), l.lecture_id).not.toContainText('시간');
    // 설계 규모 배지는 단계·문항·재구성 수만 남는다
    if (l.plan) await expect(page.getByTestId('lecture-plan-size').locator('.badge'), l.lecture_id).toHaveCount(3);
    // 화면에 내지 않는 원문 보관 칸(design_source)도 HTML 에 실리지 않는다
    const html = await (await page.request.get(`/lectures/${l.lecture_id}/`)).text();
    expect(findLearnerBanned(html.replace(/https?:\/\/[^\s"'<>]+/g, ' ')), l.lecture_id).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, l.lecture_id).toBeLessThanOrEqual(0);
  }
  expect(api.externalRequests).toEqual([]);
});

test('준비 중 편 안내: 메모를 뺀 뒤에도 실행 환경·다리 줄은 남는다(빼기만 했고 칸을 지우지 않음)', async ({ page }) => {
  for (const l of PENDING) {
    await page.goto(`/lectures/${l.lecture_id}/`);
    await hydrated(page);
    const prereq = page.getByTestId('lecture-plan-prereq');
    if (l.env_ko) await expect(prereq, l.lecture_id).toContainText('실행 환경:');
    if (l.bridge) await expect(page.getByTestId('lecture-plan-bridge'), l.lecture_id).toContainText(l.bridge.jump_ko.replace(/`/g, ''));
  }
});

test('랜딩: 설계서 메모 0건, 전체 시간 0건(이런 분께 카드의 길별 시간, 수료까지의 길의 편별·기초 시간)', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  const text = await page.evaluate(() => document.body.innerText);
  expect(findLearnerBanned(text)).toEqual([]);
  // 랜딩에는 시간 숫자가 하나도 없다(길별 "약 40~60시간 · 주 4시간이면", 편별·기초 "약 N시간(추정)" 모두 뺌. 맛보기 "목표 30분"은 분)
  expect(text).not.toMatch(/\d+\s*시간/);
  // 실습 장소는 Colab 하나("Colab 또는 내 맥에서" → "Colab에서")
  expect(text).not.toMatch(RUN_PLACE);
  await expect(page.getByTestId('landing-support')).toContainText('실습은 무료 Colab에서.');
  await expect(page.getByTestId('landing-audience').locator('dt')).toHaveCount(3);
  for (const l of LIST.lectures) {
    const row = page.getByTestId('landing-path').locator(`[data-lecture="${l.lecture_id}"]`);
    await expect(row, l.lecture_id).toBeVisible();
    await expect(row, l.lecture_id).not.toContainText('시간');
  }
});
