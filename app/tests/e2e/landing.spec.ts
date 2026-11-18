// 랜딩 (spec 13.1, P2): 구역 7개, "예시 화면" 표시(D46), 주 CTA, 쓰지 않는 말 0(VALUE 5절), 긴 줄표 0, 44px, 채운 accent 버튼 한 뷰포트 1개.
import { test, expect, hydrated, manifest } from './fixtures';
import { findBanned } from '../../src/content/landing-banned.mjs';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { LANDING } from '../../src/content/landing.mjs';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import { checkpointRangeKo } from '../../src/lib/curriculumText';
import type { LectureList } from './manifest-types';

const LIST: LectureList = YAML.parse(fs.readFileSync(path.join(REPO_ROOT, 'content/lectures.yaml'), 'utf8'));

const EM_DASH = String.fromCharCode(0x2014);
type PathRow = (typeof LANDING.path.rows)[number];
const SECTIONS = ['landing-hero', 'landing-gains', 'landing-audience', 'landing-path', 'landing-support', 'landing-end', 'landing-footer'];

test('랜딩: 구역 7개, 예시 화면 표시, 문구·숫자의 출처, 쓰지 않는 말·긴 줄표 0', async ({ page, api }, info) => {
  const m = await manifest(page);
  await page.goto('/');
  await hydrated(page);
  await expect(page.getByTestId('sample-badge')).toContainText(LANDING.sample.label);
  await expect(page.getByTestId('sample-badge')).toContainText(LANDING.sample.note);
  for (const id of SECTIONS) await expect(page.getByTestId(id), id).toBeVisible();
  await expect(page.locator('h1')).toHaveText(LANDING.hero.promise);
  await expect(page.getByTestId('cta-taste')).toHaveAttribute('href', '/taste/');
  await expect(page.getByTestId('cta-taste-end')).toHaveAttribute('href', '/taste/');
  await expect(page.getByTestId('cta-home')).toHaveAttribute('href', '/home/');
  await expect(page.getByTestId('landing-gains').locator('.card')).toHaveCount(LANDING.gains.badges.length);
  await expect(page.getByTestId('landing-audience').locator('.card')).toHaveCount(LANDING.audience.items.length);
  await expect(page.getByTestId('landing-support').locator('.card')).toHaveCount(LANDING.support.cards.length);
  await expect(page.getByTestId('landing-footer')).toContainText('비공식 학습 가이드');
  await expect(page.getByTestId('landing-footer')).toContainText('관계나 보증이 없습니다');
  // 단계 수는 video-segments.json 에서 센 값 (하드코딩 아님)
  const counts: Record<string, number> = m.step_counts;
  const rows = LANDING.path.rows.filter((r): r is PathRow & { lecture_id: string } => Boolean(r.lecture_id));
  const total = rows.reduce((a, r) => a + (counts[r.lecture_id] ?? 0), 0);
  expect(total).toBeGreaterThan(0);
  await expect(page.getByTestId('landing-path-lead')).toContainText(`${rows.length}편, ${total}단계`);
  for (const r of rows) await expect(page.locator(`[data-lecture="${r.lecture_id}"]`)).toContainText(`${counts[r.lecture_id]}단계`);
  // 누적 점검 줄은 홈과 같은 출처(content/lectures.yaml = 설계서)에서 같은 함수로. 편별 시간은 없다(전체 시간 표시 안 함, guided-copy.spec.ts)
  for (const c of LIST.checkpoints) {
    const row = page.locator(`[data-checkpoint="${c.checkpoint_id}"]`);
    await expect(row).toContainText(`${c.items_ko} = ${c.question_count}문항`);
    await expect(row).toContainText(checkpointRangeKo(c.covers));
  }
  // 첫 화면 코드 줄은 맛보기 정본에서
  await expect(page.getByTestId('landing-code').locator('.r')).toHaveCount(LANDING.hero.code.lines.length);

  const text = await page.evaluate(() => document.body.innerText);
  expect(findBanned(text)).toEqual([]);
  expect(text.includes(EM_DASH)).toBe(false);
  expect(text).not.toMatch(/자료 대기/);
  expect(await page.evaluate(() => getComputedStyle(document.body).wordBreak)).toBe('keep-all');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByTestId('sync-status')).toHaveCount(0);
  await page.screenshot({ path: `test-results/screens/${info.project.name}_landing.png`, fullPage: true });
});

test('랜딩: 채운 accent 버튼은 한 뷰포트에 1개 이하', async ({ page, api }) => {
  await page.goto('/');
  const perView = await page.evaluate(async () => {
    const out: number[] = [];
    const H = window.innerHeight;
    const total = document.documentElement.scrollHeight;
    for (let y = 0; y < total; y += Math.floor(H / 3)) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      out.push(
        [...document.querySelectorAll('.btn.primary')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.bottom > 0 && r.top < H;
        }).length,
      );
    }
    return out;
  });
  expect(Math.max(...perView)).toBeLessThanOrEqual(1);
  expect(perView.filter((n) => n === 1).length).toBeGreaterThan(0);
});

test('랜딩: 누르는 곳 44px, 주 CTA 로 맛보기 첫 화면', async ({ page, api }) => {
  await page.goto('/');
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, a.btn, .iconbtn, .brand')]
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ t: (el.textContent || '').trim().slice(0, 30), r: el.getBoundingClientRect() }))
      .filter((x) => x.r.height < 44 || x.r.width < 44)
      .map((x) => `${x.t} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`),
  );
  expect(small).toEqual([]);
  await page.getByTestId('cta-taste').click();
  await expect(page).toHaveURL(/\/taste\/$/);
  await expect(page.getByTestId('taste-start')).toBeVisible();
});
