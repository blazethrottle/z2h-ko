// 실제 서버 통합 (P3): python -m z2h_server 하나로 앱을 열어
// 1) 01편 익힘 조건을 채우면 user_badge(STAMP-L01)가 서버에 1행만 생기고, 다시 열어도 늘지 않는다.
// 2) 이름 카드를 만들면 share_card 가 visibility private, image_path 빈 채로 서버에 저장되고 taster_result.share_card_id 가 이어진다.
// 서버는 테스트가 직접 켜고 끈다(임시 DB, 포트 8797, 127.0.0.1). 저장소 server/ 폴더에는 아무것도 쓰지 않는다.
import { test, expect, type Page } from '@playwright/test';
import { LOCAL_HOST, REAL_TEST_PORT } from '../../src/lib/api-target.mjs';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_INPUT_KEYS } from '../../src/lib/share-card';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const REPO = path.resolve(APP, '..');
const PY = path.join(REPO, '.venv/bin/python');
const PORT = REAL_TEST_PORT;
const BASE = `http://${LOCAL_HOST}:${PORT}`;
const OUT = JSON.parse(fs.readFileSync(path.join(REPO, 'inputs/pedagogy/content/taster_outputs.json'), 'utf8'));
const AT = '2026-11-16T09:00:00.000+09:00';

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

async function serverTable(page: Page, table: string) {
  const r = await page.request.get(`${BASE}/api/state`);
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()).tables[table] as any[];
}

/** 다른 기기에서 올린 것처럼 서버에 기록을 넣는다(지금 계정 쿠키로 /api/sync) */
async function seed(page: Page, ops: { table: string; key: Record<string, unknown>; data: Record<string, unknown> }[]) {
  const body = { client_id: 'other-device', ops: ops.map((o, i) => ({ op_id: `seed-${Date.now()}-${i}`, ...o, updated_at: AT })) };
  const r = await page.request.post(`${BASE}/api/sync`, { data: body, headers: { Origin: BASE } });
  expect(r.status(), await r.text()).toBe(200);
  const j = await r.json();
  expect(j.rejected, JSON.stringify(j.rejected)).toEqual([]);
}

test.beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'z2h-real-badge-'));
  await startServer();
});
test.afterEach(async () => {
  await stopServer();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('실제 서버: 01편 익힘 조건을 채우면 user_badge(편 도장)가 서버에 1행, 다시 열어도 1행', async ({ page }) => {
  const m = await (await page.request.get(`${BASE}/data/manifest.json`)).json();
  const L = m.lectures[0];
  const answers = await (await page.request.get(`${BASE}/data/${L.lecture_id}/answers.json`)).json();
  await page.goto(`${BASE}/lectures/${L.lecture_id}/`);
  await expect(syncState(page, 'saved')).toBeVisible();
  expect(await serverTable(page, 'user_badge')).toEqual([]);

  await seed(page, [
    ...L.steps.map((s: any) => ({ table: 'step_progress', key: { step_id: s.step_id }, data: { path_id: 'full', status: 'done', done_at: AT } })),
    ...L.questions.map((q: any, i: number) => ({
      table: 'question_attempt',
      key: { question_id: q.question_id, attempt_id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` },
      data: { is_correct: true, is_dont_know: false, env_issue: false, raw_points: answers[q.question_id].max_points, points_awarded: answers[q.question_id].max_points, score_ratio: 1, max_hint_level: 0, context: 'step', at: AT },
    })),
    ...L.rebuild_ids.map((r: string, i: number) => ({
      table: 'rebuild_attempt',
      key: { rebuild_id: r, attempt_id: `00000000-0000-4000-8000-${String(100 + i).padStart(12, '0')}` },
      data: { passed: true, max_hint_level: 0, at: AT },
    })),
    { table: 'mastery_state', key: { target_id: L.lecture_id }, data: { state: 'in_progress', extra_checks_ok: true } },
  ]);

  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId('badge-notice')).toContainText('도장이 생겼습니다');
  await expect(syncState(page, 'saved')).toBeVisible();
  await expect.poll(async () => (await serverTable(page, 'user_badge')).map((r) => r.badge_id)).toEqual([L.stamp_id]);
  const [row] = await serverTable(page, 'user_badge');
  expect(row.earned_at).toMatch(/\+09:00$/);
  expect(row.evidence).toMatchObject({ source: 'mastery_state', target_id: L.lecture_id, state: 'mastered' });
  expect(row.content_version).toBe(L.content_version);
  expect((await serverTable(page, 'mastery_state')).find((r) => r.target_id === L.lecture_id)?.state).toBe('mastered');

  // 배지 화면에서도, 다시 열어도 1행 그대로 (받은 시각도 그대로)
  await page.goto(`${BASE}/badges/`);
  await hydrated(page);
  await expect(page.locator(`[data-stamp="${L.stamp_id}"]`)).toHaveAttribute('aria-label', `${L.lecture_id.slice(1)}편 도장 받음`);
  await expect(page.getByTestId('stage-badges').locator('[data-state="earned"]')).toHaveCount(0);
  await page.reload();
  await hydrated(page);
  await expect(syncState(page, 'saved')).toBeVisible();
  const after = await serverTable(page, 'user_badge');
  expect(after).toHaveLength(1);
  expect(after[0].earned_at).toBe(row.earned_at);
});

test('실제 서버: 이름 카드를 만들면 share_card 가 private·image_path 없음으로 저장되고 taster_result.share_card_id 가 이어진다', async ({ page }) => {
  const m = await (await page.request.get(`${BASE}/data/manifest.json`)).json();
  const T = m.taster;
  const names: string = String(OUT[T.artifact_unlock_after]).trim();
  await page.goto(`${BASE}/share/?card=ART-TASTER`);
  await expect(syncState(page, 'saved')).toBeVisible();
  await seed(
    page,
    T.requires_steps.map((s: string) => ({
      table: 'taster_result',
      key: { attempt_no: 1, step_id: s },
      data: { self_reported: 'similar', at: AT, ...(s === T.artifact_unlock_after ? { pasted_names_text: names, pasted_loss_start: 3.839, pasted_loss_end: 2.472 } : {}) },
    })),
  );
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId('card-view')).toHaveAttribute('data-drawn', 'true');
  await expect(syncState(page, 'saved')).toBeVisible();
  await expect.poll(async () => (await serverTable(page, 'share_card')).length).toBe(1);
  const [sc] = await serverTable(page, 'share_card');
  expect(sc.share_id).toMatch(/^[0-9a-f]{32}$/);
  expect(sc.kind).toBe('ART-TASTER');
  expect(sc.visibility).toBe('private');
  expect(sc.image_path).toBeNull();
  expect(sc.revoked_at).toBeNull();
  expect(Object.keys(sc.payload).sort()).toEqual([...CARD_INPUT_KEYS['ART-TASTER']].sort());
  expect(sc.payload.names).toEqual(names.split('\n'));
  expect(sc.created_at).toMatch(/\+09:00$/);
  await expect
    .poll(async () => (await serverTable(page, 'taster_result')).find((r) => r.step_id === T.artifact_unlock_after)?.share_card_id)
    .toBe(sc.share_id);
  // 서버 쪽 이미지 파일·공개 주소는 없다
  const r = await page.request.get(`${BASE}/share/${sc.share_id}/`);
  expect(r.status()).toBe(404);
  // 다시 열어도 같은 카드면 1행
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId('card-view')).toHaveAttribute('data-drawn', 'true');
  await expect(syncState(page, 'saved')).toBeVisible();
  expect(await serverTable(page, 'share_card')).toHaveLength(1);
});
