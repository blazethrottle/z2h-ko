// 실제 서버 통합 (P2): python -m z2h_server 하나로 앱을 열어 맛보기를 "직접 확인했어요"로 끝까지 넘기고,
// 끝 화면에 붙여 넣은 이름·손실이 실제 서버의 taster_result 에 저장되는지 본다.
// 서버는 테스트가 직접 켜고 끈다(임시 DB, 포트 8797, 127.0.0.1). 저장소 server/ 폴더에는 아무것도 쓰지 않는다.
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../src/config';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const REPO = path.resolve(APP, '..');
const PY = path.join(REPO, '.venv/bin/python');
const PORT = 8797;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = JSON.parse(fs.readFileSync(path.join(REPO, 'inputs/pedagogy/content/taster_outputs.json'), 'utf8'));

let tmp = '';
let proc: ChildProcess | null = null;

async function startServer() {
  try {
    await fetch(`${BASE}/api/health`);
    throw new Error(`포트 ${PORT}을 이미 다른 프로그램이 쓰고 있습니다. 그 프로그램을 끄고 다시 돌리세요`);
  } catch (e) {
    if (String(e).includes('포트')) throw e;
  }
  proc = spawn(PY, ['-m', 'z2h_server'], {
    cwd: tmp,
    env: {
      ...process.env,
      PYTHONPATH: path.join(REPO, 'server'),
      PYTHONDONTWRITEBYTECODE: '1',
      Z2H_DB_PATH: path.join(tmp, 'z2h.sqlite3'),
      Z2H_PORT: String(PORT),
      Z2H_APP_DIST: path.join(APP, 'dist'),
      Z2H_EXTRA_ORIGINS: BASE,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const me = proc;
  for (let i = 0; i < 60; i++) {
    if (me.exitCode !== null) throw new Error(`서버가 바로 꺼졌습니다(종료 코드 ${me.exitCode})`);
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      /* 켜지는 중 */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('서버가 켜지지 않았습니다');
}

async function stopServer() {
  if (!proc) return;
  const p = proc;
  proc = null;
  if (p.exitCode !== null || p.signalCode !== null) return;
  await new Promise<void>((r) => {
    const t = setTimeout(() => {
      p.kill('SIGKILL');
      r();
    }, 10_000);
    p.once('exit', () => {
      clearTimeout(t);
      r();
    });
    p.kill('SIGTERM');
  });
}

const hydrated = (page: Page) => expect(page.locator('astro-island[ssr]')).toHaveCount(0);
const syncState = (page: Page, s: string) => page.getByTestId('sync-status').locator(`[data-state="${s}"]`);

async function serverRows(page: Page) {
  const r = await page.request.get(`${BASE}/api/state`);
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()).tables.taster_result as any[];
}

test.beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'z2h-real-taste-'));
  await startServer();
});
test.afterEach(async () => {
  await stopServer();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('실제 서버: 맛보기를 끝까지 직접 확인하고 붙여 넣은 이름·손실이 taster_result 에 저장된다', async ({ page }) => {
  const m = await (await page.request.get(`${BASE}/data/manifest.json`)).json();
  const T = m.taster;
  const steps = [...T.steps].sort((a: any, b: any) => a.order - b.order);
  await page.goto(`${BASE}/taste/${steps[0].slug}/`);
  // 앱이 처음 열 때 개발용 계정을 스스로 만든다(가입·로그인 화면 없음). "저장됨"은 계정과 첫 확인 뒤에만 보인다
  await expect(syncState(page, 'saved')).toBeVisible();
  expect((await page.request.get(`${BASE}/api/me`)).status()).toBe(200);
  for (let i = 0; i < steps.length; i++) {
    await expect(page).toHaveURL(new RegExp(`/taste/${steps[i].slug}/$`));
    await hydrated(page);
    await page.getByTestId('taste-confirm').click();
    if (i < steps.length - 1) {
      await expect(page.getByTestId('taste-confirmed')).toBeVisible();
      await page.getByTestId('taste-next').click();
    }
  }
  await expect(page.getByTestId('taste-complete')).toBeVisible();

  const names: string = String(OUT[T.artifact_unlock_after]).trim();
  const card = page.getByTestId('taste-names-card');
  await card.getByTestId('taste-names').fill(names);
  await card.getByTestId('taste-loss-start').fill('3.839');
  await card.getByTestId('taste-loss-end').fill('2.472');
  await card.getByTestId('taste-save-names').click();
  await expect(card.getByTestId('taste-names-result')).toBeVisible();
  await expect(syncState(page, 'saved')).toBeVisible();

  await expect
    .poll(async () => (await serverRows(page)).filter((r) => r.self_reported === 'similar').map((r) => r.step_id).sort())
    .toEqual([...T.requires_steps].sort());
  await expect
    .poll(async () => {
      const r = (await serverRows(page)).find((x) => x.step_id === T.artifact_unlock_after);
      return r ? [r.attempt_no, r.pasted_names_text, r.pasted_loss_start, r.pasted_loss_end] : null;
    })
    .toEqual([config.taste.firstAttemptNo, names, 3.839, 2.472]);
  const rows = await serverRows(page);
  for (const r of rows) expect(r.at).toMatch(/\+09:00$/);
});
