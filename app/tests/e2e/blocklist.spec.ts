// 맛보기 이름 금칙어 (교사 정본 inputs/pedagogy/content/taster_blocklist.json): 걸린 줄은 저장·카드·서버로 가는 값에서 빠지고,
// 정본 안내(on_match_ko)가 보인다. 걸린 말 자체는 화면에 다시 보이지 않는다. 금칙어는 테스트에 적지 않고 정본에서 읽는다.
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, hydrated, manifest } from './fixtures';
import { NAMES_TXT, TASTER } from '../../src/content-config.mjs';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import { buildNameFilter, splitNameLines } from '../../src/lib/name-filter.mjs';

const BL = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content', TASTER.blocklistFile), 'utf8'));
const F = buildNameFilter(BL, splitNameLines(fs.readFileSync(path.join(REPO_ROOT, NAMES_TXT.path), 'utf8')));
const AT = '2026-11-16T09:00:00.000+09:00';
/** 걸리는 줄 2개(substring 이 든 가짜 이름, exact 와 같은 줄)와 허용되는 실제 이름 1개 */
const BAD = [`qx${F.substring[0]}qx`, F.exact.find((w) => !F.allow.includes(w))!];
const REAL_ALLOWED = F.allow[0];
const BAD_RE = new RegExp(BAD.join('|'));

async function taster(page: Page) {
  const T = (await manifest(page)).taster;
  T.steps.sort((a: any, b: any) => a.order - b.order);
  return T;
}

/** canvas 에 그린 글자를 모두 모은다 */
async function recordCanvasText(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__drawn = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t: string, ...rest: any[]) {
      w.__drawn.push(String(t));
      return (orig as any).call(this, t, ...rest);
    };
  });
}

test('끝 화면: 금칙어에 걸린 줄은 빼고 정본 안내를 보인다. 저장·카드·서버로 가는 값에 걸린 줄이 없다', async ({ page, api }, info) => {
  test.setTimeout(120_000);
  expect(F.message).not.toBe('');
  expect(REAL_ALLOWED).toBeTruthy();
  const T = await taster(page);
  const last = T.steps[T.steps.length - 1];
  api.serverTables = { taster_result: T.steps.slice(0, -1).map((s: any) => ({ attempt_no: 1, step_id: s.step_id, self_reported: 'similar', at: AT, updated_at: AT })) };
  await recordCanvasText(page);
  await page.goto(`/taste/${last.slug}/`);
  await hydrated(page);
  const card = page.getByTestId('taste-names-card');
  await card.getByTestId('taste-names').fill(['gsli', BAD[0], 'di', BAD[1], REAL_ALLOWED].join('\n'));
  await expect(card.getByTestId('taste-names-blocked')).toHaveText(F.message);
  // 기존 규칙(a~z 밖·20글자) 안내는 따로다. 걸린 줄은 그 안내에 줄 번호로도 들어가지 않는다
  await expect(card.getByTestId('taste-names-flag')).toHaveCount(0);
  await page.screenshot({ path: `test-results/screens/${info.project.name}_taste_names_blocked.png`, fullPage: true });
  await card.getByTestId('taste-save-names').click();
  await expect(card.getByTestId('taste-names-saved')).toHaveText(['gsli', 'di', REAL_ALLOWED].join('\n'));
  await expect
    .poll(() => api.opsFor('taster_result').filter((o) => o.data.pasted_names_text != null).pop()?.data.pasted_names_text)
    .toBe(['gsli', 'di', REAL_ALLOWED].join('\n'));
  for (const o of api.opsFor('taster_result')) expect(JSON.stringify(o)).not.toMatch(BAD_RE);
  // 저장 뒤 화면 어디에도 걸린 말이 없다(입력칸도 정리한 글로 바뀐다)
  await expect(card.getByTestId('taste-names')).toHaveValue(['gsli', 'di', REAL_ALLOWED].join('\n'));
  expect(await page.locator('main').innerText()).not.toMatch(BAD_RE);

  // 공유 카드: 카드 글·그린 글자·share_card 에도 없다
  await page.goto('/share/?card=ART-TASTER');
  await hydrated(page);
  await expect(page.getByTestId('card-view')).toHaveAttribute('data-drawn', 'true');
  await expect(page.getByTestId('card-text')).toContainText(REAL_ALLOWED);
  await expect(page.getByTestId('card-text')).not.toContainText(BAD[0]);
  expect((await page.evaluate(() => (window as any).__drawn as string[])).join('\n')).not.toMatch(BAD_RE);
  await expect.poll(() => api.opsFor('share_card').length).toBeGreaterThan(0);
  for (const o of api.opsFor('share_card')) {
    expect(JSON.stringify(o)).not.toMatch(BAD_RE);
    expect(o.data.payload?.names ?? JSON.parse(o.data.payload_json ?? '{}').names).toEqual(['gsli', 'di', REAL_ALLOWED]);
  }
});

test('공유 화면 방어: 다른 기기(옛 앱)가 걸린 줄을 저장해 두었어도 카드·share_card 에는 들어가지 않고 정본 안내를 보인다', async ({ page, api }) => {
  const T = await taster(page);
  api.serverTables = {
    taster_result: T.requires_steps.map((s: string) => ({
      attempt_no: 1,
      step_id: s,
      self_reported: 'similar',
      at: AT,
      updated_at: AT,
      ...(s === T.artifact_unlock_after ? { pasted_names_text: ['gsli', ...BAD, 'di'].join('\n'), pasted_loss_start: 3.839, pasted_loss_end: 2.472 } : {}),
    })),
  };
  await recordCanvasText(page);
  await page.goto('/share/?card=ART-TASTER');
  await hydrated(page);
  await expect(page.getByTestId('card-view')).toHaveAttribute('data-drawn', 'true');
  await expect(page.getByTestId('card-blocked')).toHaveText(F.message);
  await expect(page.getByTestId('card-text')).toContainText('gsli');
  expect(await page.locator('main').innerText()).not.toMatch(BAD_RE);
  expect((await page.evaluate(() => (window as any).__drawn as string[])).join('\n')).not.toMatch(BAD_RE);
  await expect.poll(() => api.opsFor('share_card').length).toBeGreaterThan(0);
  for (const o of api.opsFor('share_card')) expect(JSON.stringify(o)).not.toMatch(BAD_RE);
});
