// 안내형 길 1차(P9) B: 실행 장소 Colab 고정(2026-11-18 결정). 단계·설정·힌트·맛보기에 실행 장소 고르기(칩)와 맥미니 Jupyter 병기가 없고,
// "Colab에서 열기" 단추는 공개 저장소의 커밋 고정 주소(src/config.ts colabOpenUrl). 저장된 run_place=jupyter 값은 지우지 않고 무시한다.
// 정본 F.json·L01.json·taster.json 의 문구 정리(scripts/canon-colab-time.mjs)가 화면에 보이고, 맥미니·Jupyter·MPS·"고른 길" 글은
// 그 스크립트의 "그대로 둔 곳(KEPT)" 글에만 있다(기초·1편·맛보기 화면 전부).
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, hydrated } from './fixtures';
import { readManifest } from './manifest-types';
import { colabOpenUrl, config } from '../../src/config';
import { NOTEBOOKS, TASTER } from '../../src/content-config.mjs';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import { visibleText } from '../../scripts/check-copy.mjs';
import { CANON_EDITS, KEPT, RUN_PLACE_WORDS, TOTAL_TIME_WORDS, valueAt } from '../../scripts/canon-colab-time.mjs';

const FORMAT = /^https:\/\/colab\.research\.google\.com\/github\/blazethrottle\/z2h-ko\/blob\/[0-9a-f]{40}\/notebooks\/[\w./-]+\.ipynb$/;
const readCanon = (file: string) => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'));
const F_FILE = 'inputs/pedagogy/content/F.json';
const F = readCanon(F_FILE);
const plain = (t: string) => t.replace(/`/g, '').replace(/\s+/g, ' ').trim();
const bodyText = async (page: Page) => plain(await page.evaluate(() => document.body.innerText));

/** 빈칸·백틱을 지운 글(화면의 태그 사이 빈칸·코드 줄 나눔과 상관없이 비교) */
const squash = (t: string) => t.replace(/[`\s]/g, '');
const SQUASHED_WORDS = new RegExp(RUN_PLACE_WORDS.source.replace(/ /g, ''), 'g');
/** 그대로 둔 곳의 글(코드는 줄마다). 긴 글부터 */
const KEPT_TEXTS = KEPT.flatMap((k: { file: string; path: (string | number)[]; kind: string }) => {
  const v = String(valueAt(readCanon(k.file), k.path));
  return k.kind === 'code' ? v.split('\n') : [v];
})
  .map(squash)
  .filter(Boolean)
  .sort((a: string, b: string) => b.length - a.length);
/** 화면 글에서 그대로 둔 곳의 글을 지운 뒤에도 맥미니·Jupyter·MPS·고른 길이 남는가 */
function strayRunPlace(text: string): string[] {
  let t = squash(text);
  for (const s of KEPT_TEXTS) t = t.split(s).join('|');
  return t.match(SQUASHED_WORDS) ?? [];
}
/** F.json 표의 칸 중 단위 index·단계 id 로 고른 것 */
const F_EDITS: { id: string; path: (string | number)[] }[] = CANON_EDITS.find((c: { file: string }) => c.file === F_FILE)?.edits ?? [];

test('1편 단계·개요: 실행 장소 칩 없음, Colab 한 곳 안내, "Colab에서 노트북 열기"는 커밋 고정 주소', async ({ page, api }) => {
  const L = (await readManifest(page)).lectures[0];
  const nb = NOTEBOOKS[L.lecture_id as keyof typeof NOTEBOOKS].student;
  const code = L.steps.find((s) => s.kind === 'code');
  expect(code).toBeTruthy();
  await page.goto(`/lectures/${L.lecture_id}/${code?.slug}/#practice`);
  await hydrated(page);
  const run = page.getByTestId('run-place');
  await expect(run).toBeVisible();
  await expect(run.locator('.chip')).toHaveCount(0);
  await expect(page.getByRole('group', { name: '실행 장소' })).toHaveCount(0);
  await expect(run).toContainText('Colab');
  const open = run.getByRole('link', { name: /Colab에서 노트북 열기/ });
  await expect(open).toHaveAttribute('href', colabOpenUrl(nb));
  expect(await open.getAttribute('href')).toMatch(FORMAT);
  expect(await open.getAttribute('href')).toContain(`/blob/${config.colab.commit}/`);
  await expect(run).not.toContainText('Jupyter');
  expect(strayRunPlace(await bodyText(page))).toEqual([]);

  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  const card = page.locator('#notebook');
  await expect(card.getByRole('link', { name: /Colab에서 노트북 열기/ })).toHaveAttribute('href', colabOpenUrl(nb));
  await expect(card).not.toContainText('Jupyter');
  expect(api.externalRequests).toEqual([]);
});

test('저장된 run_place=jupyter 는 지우지 않고 무시: 화면은 Colab 안내, run_place 기록을 새로 쓰지 않는다', async ({ page, api }) => {
  const AT = '2026-11-17T10:00:00+09:00';
  api.serverTables = { user_pref: [{ pref_key: 'run_place', value: 'jupyter', updated_at: AT, server_seq: 1 }] };
  const L = (await readManifest(page)).lectures[0];
  const code = L.steps.find((s) => s.kind === 'code');
  await page.goto(`/lectures/${L.lecture_id}/${code?.slug}/#practice`);
  await hydrated(page);
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  await expect(page.getByTestId('run-place')).toContainText('Colab');
  await expect(page.getByTestId('run-place')).not.toContainText('Jupyter');
  expect(strayRunPlace(await bodyText(page))).toEqual([]);
  await page.goto('/settings/');
  await hydrated(page);
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  // 이 기기 사본에도 그대로 남아 있다(설정의 "이 기기 기록을 JSON으로 내려받기")
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-local').click()]);
  const backup = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  expect(backup.tables.user_pref.find((r: { pref_key: string }) => r.pref_key === 'run_place')?.value).toBe('jupyter');
  expect(api.opsFor('user_pref').filter((o) => o.key.pref_key === 'run_place')).toEqual([]);
});

test('설정: 실행 장소 칸이 없다', async ({ page }) => {
  await page.goto('/settings/');
  await hydrated(page);
  await expect(page.getByTestId('settings-account')).toBeVisible();
  await expect(page.getByRole('region', { name: '실행 장소' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: '실행 장소' })).toHaveCount(0);
  const text = await bodyText(page);
  expect(text).not.toContain('실행 장소');
  expect(text).not.toContain('Jupyter');
});

test('맛보기: 첫 단계 "Colab 맛보기 노트북 열기"는 커밋 고정 주소, 맥미니 대체 셀 접기 없음, 맛보기 화면 어디에도 맥미니·Jupyter 없음', async ({ page }) => {
  const steps: { slug: string }[] = (await (await page.request.get('/data/manifest.json')).json()).taster.steps;
  await page.goto(`/taste/${steps[0].slug}/`);
  await hydrated(page);
  const open = page.getByTestId('taste-colab-open');
  await expect(open).toHaveAttribute('href', colabOpenUrl(TASTER.notebook));
  expect(await open.getAttribute('href')).toMatch(FORMAT);
  await expect(page.getByTestId('taste-open-note')).toHaveCount(0);
  for (const s of steps) {
    await page.goto(`/taste/${s.slug}/`);
    await hydrated(page);
    await expect(page.getByTestId('taste-alt'), s.slug).toHaveCount(0);
    expect(strayRunPlace(await bodyText(page)), s.slug).toEqual([]);
  }
});

test('기초 F-P1: 제목 "노트북 다루기(Colab)"·고친 정본 글이 보이고, 맥미니·Jupyter·MPS 는 표 밖에 남은 정본 글에만 있다', async ({ page }) => {
  const B = (await readManifest(page)).basics;
  const unitIndex = F.lecture.units.findIndex((u: { unit_id: string }) => u.unit_id === 'F-P1');
  const unit = F.lecture.units[unitIndex];
  expect(unit.title_ko).toBe('노트북 다루기(Colab)');
  await page.goto('/basics/F-P1/');
  await hydrated(page);
  await expect(page.locator('main h1')).toContainText(unit.title_ko);
  const unitText = await bodyText(page);
  expect(unitText).not.toMatch(/MPS|mps/);
  for (const x of F_EDITS.filter((y) => y.path[0] === 'lecture' && y.path[1] === 'units' && y.path[2] === unitIndex)) expect(unitText, x.id).toContain(plain(valueAt(F, x.path)));
  expect(strayRunPlace(unitText)).toEqual([]);
  for (const s of B.steps['F-P1']) {
    await page.goto(`/basics/F-P1/${s.slug}/`);
    await hydrated(page);
    await expect(page.getByTestId('run-place').locator('.chip'), s.step_id).toHaveCount(0);
    const text = await bodyText(page);
    expect(strayRunPlace(text), s.step_id).toEqual([]);
    for (const x of F_EDITS.filter((y) => y.path[0] === 'steps' && F.steps[Number(y.path[1])].step_id === s.step_id && y.path[2] !== 'expected_ko'))
      expect(text, x.id).toContain(plain(valueAt(F, x.path)));
  }
});

test('기초 목록: 첫 화면 글에 전체 시간(15단위 합계·처음 두 단위 합계)이 없고, 단위별 "약 N분"은 그대로', async ({ page }) => {
  await page.goto('/basics/');
  await hydrated(page);
  const text = await bodyText(page);
  expect(text).not.toMatch(TOTAL_TIME_WORDS);
  expect(strayRunPlace(text)).toEqual([]);
  for (const u of F.lecture.units) expect(text, u.unit_id).toContain(`약 ${u.estimated_minutes}분`);
});

test('기초·1편·맛보기 모든 화면(서버가 그린 글): 맥미니·Jupyter·MPS·고른 길은 그대로 둔 곳의 글에만, 전체 시간 없음', async ({ page }) => {
  test.setTimeout(120_000);
  const m = await readManifest(page);
  const L = m.lectures[0];
  const taster: { slug: string }[] = (await (await page.request.get('/data/manifest.json')).json()).taster.steps;
  const urls = [
    '/basics/',
    ...m.basics.ready_ids.flatMap((u) => [`/basics/${u}/`, ...(m.basics.steps[u] ?? []).map((s) => `/basics/${u}/${s.slug}/`)]),
    `/lectures/${L.lecture_id}/`,
    ...L.steps.map((s) => `/lectures/${L.lecture_id}/${s.slug}/`),
    '/taste/',
    ...taster.map((s) => `/taste/${s.slug}/`),
  ];
  const bad: string[] = [];
  for (const u of urls) {
    const text = visibleText(await (await page.request.get(u)).text());
    for (const w of strayRunPlace(text)) bad.push(`${u}: ${w}`);
    if (TOTAL_TIME_WORDS.test(text.replace(/영상\s*\d+\s*시간\s*\d+\s*분/g, ''))) bad.push(`${u}: 전체 시간 ${text.match(TOTAL_TIME_WORDS)?.[0]}`);
  }
  expect(urls.length).toBeGreaterThan(120);
  expect(bad).toEqual([]);
  // 늦게 받는 힌트·풀이(JSON)에도 그대로 둔 곳 밖의 실행 장소 낱말이 없다
  for (const id of ['F', L.lecture_id, 'TASTER']) {
    for (const kind of ['hints', 'answers']) {
      const r = await page.request.get(`/data/${id}/${kind}.json`);
      expect(strayRunPlace(await r.text()), `${id} ${kind}`).toEqual([]);
    }
  }
});

test('1편 S02 따라 하기: 정본에서 뺀 실행 장소 문장이 없고, 남은 것은 준비 코드와 그 출력 설명(그대로 둔 곳)뿐', async ({ page }) => {
  const L = (await readManifest(page)).lectures[0];
  const s02 = L.steps.find((s) => s.step_id === 'L01-S02');
  await page.goto(`/lectures/${L.lecture_id}/${s02?.slug}/#practice`);
  await hydrated(page);
  await page.getByTestId('dont-know').click();
  const text = await bodyText(page);
  expect(text).not.toContain('어느 쪽에서든');
  expect(strayRunPlace(text)).toEqual([]);
});
