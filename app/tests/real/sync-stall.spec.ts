// 실제 서버로 확인하는 동기화 멈춤(2026-11-18 운영 사고 "단계 2 마치기가 넘어가지 않고 '동기화 중'", 리뷰 B1·B2·H1·M1, QA S4a·S4b·S4c).
// 서버는 테스트가 임시 DB 로 127.0.0.1:8797 에 켜고 끈다. S4b·S4c 는 그 앞에 응답 본문을 멈추는 중계기(stall-proxy.mjs, 127.0.0.1:8798)를 둔다.
// 기대: "마치기"가 첫 받기 상한(config.firstPullMaxMs) + 여유 안에 넘어가고, 완료 기록이 서버에 done 으로 남으며, 멈춘 동안 표시에서 다시 시도할 수 있다.
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { LOCAL_HOST, REAL_TEST_PORT, REAL_TEST_PROXY_PORT } from '../../src/lib/api-target.mjs';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../src/config';
import { readManifest, type ManifestStep } from '../e2e/manifest-types';
import { LEGACY_L01, readArchive } from '../../src/lib/migrate/l01-v1_2';
import { startProxy } from './stall-proxy.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const REPO = path.resolve(APP, '..');
// 저장소 .venv 가 없는 작업 폴더(git worktree)에서는 Z2H_PYTHON 으로 그 파이썬을 준다
const PY = process.env.Z2H_PYTHON || path.join(REPO, '.venv/bin/python');
const BASE = `http://${LOCAL_HOST}:${REAL_TEST_PORT}`;
const PROXY_BASE = `http://${LOCAL_HOST}:${REAL_TEST_PROXY_PORT}`;
const ADVANCE_MAX_MS = config.firstPullMaxMs + 3_000;
const UNIT_BASE = '/basics/F-P1/';

type Row = Record<string, unknown>;
interface SentOp {
  op_id: string;
  table: string;
  key: Record<string, unknown>;
  data: Row;
  base_updated_at?: string;
}

let tmp = '';
let proc: ChildProcess | null = null;

async function startServer() {
  try {
    await fetch(`${BASE}/api/health`);
    throw new Error(`포트 ${REAL_TEST_PORT}을 이미 다른 프로그램이 쓰고 있습니다. 그 프로그램을 끄고 다시 돌리세요`);
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
      Z2H_PORT: String(REAL_TEST_PORT),
      Z2H_APP_DIST: path.join(APP, 'dist'),
      // 중계기 주소에서 연 화면의 쓰기도 받는다
      Z2H_EXTRA_ORIGINS: `${BASE},${PROXY_BASE}`,
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

test.beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'z2h-stall-'));
  await startServer();
});
test.afterEach(async () => {
  await stopServer();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const hydrated = (page: Page) => expect(page.locator('astro-island[ssr]')).toHaveCount(0);
const syncState = (page: Page, s: string) => page.getByTestId('sync-status').locator(`[data-state="${s}"]`);
const sorted = (steps: ManifestStep[]) => [...steps].sort((a, b) => a.order - b.order);

async function stepRow(page: Page, stepId: string): Promise<Row | undefined> {
  const r = await page.request.get(`${BASE}/api/state`);
  expect(r.status(), await r.text()).toBe(200);
  return ((await r.json()) as { tables: { step_progress?: Row[] } }).tables.step_progress?.find((x) => x.step_id === stepId);
}

/** 넘어간 시간을 결과에 남긴다(PR 본문의 "마치기가 넘어가는 데 걸린 시간") */
function note(info: TestInfo, ms: number) {
  info.annotations.push({ type: 'advance-ms', description: String(ms) });
  console.log(`STALL-ADVANCE ${info.project.name} ${info.title.split(' ')[0]} ${ms}ms`);
}

/**
 * 단계 i 화면에서 "마치기"를 누르고 다음 화면이 뜰 때까지 잰다(영상이 있는 단계는 먼저 "따라 하기 시작").
 * 확인 문제가 있으면 그 칸이 뜰 때까지를 재고, 그 화면의 다음 버튼으로 다음 단계로 간다
 */
async function finishStep(page: Page, base: string, steps: ManifestStep[], i: number): Promise<number> {
  const s = steps[i];
  const next = steps[i + 1];
  await expect(page.getByTestId('step-position')).toContainText(s.step_id);
  await hydrated(page);
  const start = page.getByTestId('start-practice');
  if ((await start.count()) > 0) await start.click();
  const t0 = Date.now();
  await page.getByTestId('finish-step').click();
  if (s.question_ids.length > 0) {
    await expect(page.locator('[data-phase="quiz"]')).toBeVisible({ timeout: ADVANCE_MAX_MS });
    const ms = Date.now() - t0;
    await page.getByTestId('next-step').click();
    await page.waitForURL((u) => u.pathname === base + next.slug + '/', { waitUntil: 'commit' });
    return ms;
  }
  await page.waitForURL((u) => u.pathname === base + next.slug + '/', { waitUntil: 'commit', timeout: ADVANCE_MAX_MS });
  return Date.now() - t0;
}

test('S4a 단계 2 화면의 첫 받기(GET /api/state)가 멈춰도 마치기가 상한 안에 넘어가고 완료가 서버에 남는다', async ({ page }, info) => {
  const steps = sorted((await readManifest(page)).basics.steps['F-P1']);
  const held: number[] = [];
  let hold = false;
  await page.goto(UNIT_BASE + steps[0].slug + '/');
  await expect(syncState(page, 'saved')).toBeVisible();
  // 다음 GET /api/state 하나(단계 2 화면의 첫 받기)에 답하지 않고 붙잡아 둔다
  await page.route(
    (u) => u.pathname === '/api/state',
    (route) => {
      if (hold && route.request().method() === 'GET') {
        hold = false;
        held.push(Date.now());
        return;
      }
      return route.continue();
    },
  );
  hold = true;
  await finishStep(page, UNIT_BASE, steps, 0);
  await expect.poll(() => held.length).toBe(1);
  const ms = await finishStep(page, UNIT_BASE, steps, 1);
  note(info, ms);
  expect(ms).toBeLessThan(ADVANCE_MAX_MS);
  await expect(syncState(page, 'saved')).toBeVisible();
  await expect.poll(async () => (await stepRow(page, steps[1].step_id))?.status).toBe('done');
});

/** S4b·S4c: 단계 2 화면의 첫 보내기 응답 본문을 중계기가 멈춘 채 마치기 → 다음 화면에서 다시 시도 → 완료가 서버에 */
async function bodyStall(page: Page, info: TestInfo, base: string, steps: ManifestStep[]) {
  const proxy = await startProxy({ port: REAL_TEST_PROXY_PORT, target: BASE });
  try {
    await page.goto(proxy.base + base + steps[0].slug + '/');
    await expect(syncState(page, 'saved')).toBeVisible();
    proxy.setHoldSync(true);
    const from = proxy.log.length;
    await finishStep(page, base, steps, 0);
    // 단계 2 화면은 GET /api/me 로 시작하고, 그 화면의 첫 보내기가 머리만 받고 멈춘다
    const step2Held = () => {
      const me = proxy.log.findIndex((e, k) => k >= from && e.method === 'GET' && e.path.startsWith('/api/me'));
      return me >= 0 && proxy.log.slice(me).some((e) => e.held);
    };
    await expect.poll(step2Held).toBe(true);
    const ms = await finishStep(page, base, steps, 1);
    note(info, ms);
    expect(ms).toBeLessThan(ADVANCE_MAX_MS);
    // 다음 화면의 첫 보내기도 멈춰 있다: 표시(동기화 중 또는 오프라인)를 누르면 다시 시도할 수 있다
    await page.getByTestId('sync-status').locator('[data-state="syncing"], [data-state="offline"]').click();
    const retry = page.getByRole('dialog', { name: '동기화 안내' }).getByRole('button', { name: '지금 다시 시도' });
    await expect(retry).toBeVisible();
    proxy.setHoldSync(false);
    await retry.click();
    await expect(syncState(page, 'saved')).toBeVisible();
    await expect.poll(async () => (await stepRow(page, steps[1].step_id))?.status).toBe('done');
    expect((await stepRow(page, steps[0].step_id))?.status).toBe('done');
  } finally {
    await proxy.close();
  }
}

test('S4b 단계 2 화면의 보내기 응답 본문이 멈춰도(기초 F-P1) 마치기가 넘어가고, 다시 시도 뒤 완료가 서버에 남는다', async ({ page }, info) => {
  await bodyStall(page, info, UNIT_BASE, sorted((await readManifest(page)).basics.steps['F-P1']));
});

test('S4c 단계 2 화면의 보내기 응답 본문이 멈춰도(1편 L01) 마치기가 넘어가고, 다시 시도 뒤 완료가 서버에 남는다', async ({ page }, info) => {
  const L = (await readManifest(page)).lectures[0];
  await bodyStall(page, info, `/lectures/${L.lecture_id}/`, sorted(L.steps));
});

/** 옛 1편(1.2판) 기기가 올린 행 */
const oldOp = (n: string, status: string) => ({
  op_id: `old-${n}`,
  table: 'step_progress',
  key: { step_id: `L01-S${n}` },
  data: { status, attempts: 1, started_at: '2026-11-10T09:00:00+09:00', done_at: status === 'done' ? '2026-11-10T10:00:00+09:00' : null, content_version: LEGACY_L01.contentVersions[0] },
  updated_at: '2026-11-10T10:00:00+09:00',
});

test('L 옛 1편 기록과 다른 기기 보관본이 있는 계정: 첫 받기가 멈춘 채 겹치는 단계를 열고 마쳐도, 멈춤을 푼 뒤 보관본은 그대로 자라고 옛 완료는 새 단계 완료로 보이지 않는다', async ({ page, browser }, info) => {
  const L = (await readManifest(page)).lectures[0];
  const steps = sorted(L.steps);
  const base = `/lectures/${L.lecture_id}/`;
  const i07 = steps.findIndex((x) => x.step_id === 'L01-S07');
  const s12 = steps.find((x) => x.step_id === 'L01-S12');
  expect(i07 >= 0 && !!s12, '1편에 S07·S12').toBe(true);
  if (!s12) return;
  const s07 = steps[i07];
  const created = await page.request.post(`${BASE}/api/dev-auth/accounts`, { data: { display_name: '옛 기록 멈춤 검사' } });
  expect(created.ok(), await created.text()).toBe(true);
  const APPLIED_AT = '2026-11-18T09:00:01+09:00';
  const otherArchive = {
    format: 1,
    lecture_id: 'L01',
    from_version: '1.2',
    to_version: 'claude-1.0',
    archived_at: '2026-11-18T09:00:00+09:00',
    applied_at: APPLIED_AT,
    rows: { step_progress: ['01', '02'].map((n) => ({ step_id: `L01-S${n}`, ...oldOp(n, 'done').data })), grade_result: [] },
    reset_steps: ['L01-S03'],
  };
  for (const [client, ops] of [
    ['old-device', [oldOp('07', 'done'), oldOp('12', 'done'), oldOp('04', 'in_progress')]],
    ['other-device', [{ op_id: 'other-archive', table: 'user_pref', key: { pref_key: LEGACY_L01.archiveKey }, data: { value: otherArchive }, updated_at: APPLIED_AT }]],
  ] as const) {
    const r = await page.request.post(`${BASE}/api/sync`, { data: { client_id: client, ops } });
    expect(r.status(), await r.text()).toBe(200);
    expect(((await r.json()) as { applied: string[] }).applied).toHaveLength(ops.length);
  }
  // S12·S07 화면의 받기는 응답 없이 멈춘다(상한으로 포기). 그다음 화면(S08)에서 실제로 받는다
  const stalledPages = [`${base}${s12.slug}/`, `${base}${s07.slug}/`];
  let held = 0;
  await page.route(
    (u) => u.pathname === '/api/state',
    (route) => {
      if (route.request().method() === 'GET' && stalledPages.includes(new URL(route.request().frame().url()).pathname)) {
        held++;
        return;
      }
      return route.continue();
    },
  );
  // 겹치는 단계 S12: 화면만 열고(이 기기에 단계 행이 생김) 마치지 않는다
  await page.goto(`${stalledPages[0]}#practice`);
  await expect(syncState(page, 'offline')).toBeVisible({ timeout: ADVANCE_MAX_MS });
  // 겹치는 단계 S07: 화면을 열고 마친다
  await page.goto(`${stalledPages[1]}#practice`);
  const ms = await finishStep(page, base, steps, i07);
  note(info, ms);
  expect(ms).toBeLessThan(ADVANCE_MAX_MS);
  await expect(syncState(page, 'saved')).toBeVisible();
  expect(held).toBeGreaterThanOrEqual(2);

  // 서버 보관본: 다른 기기 행·새로 시작함·applied_at 은 그대로이고, 이 기기가 모른 채 덮은 옛 S07·S12 원본이 더해진다
  const serverArchive = async () => {
    const r = await page.request.get(`${BASE}/api/state`);
    const pref = ((await r.json()) as { tables: { user_pref?: Row[] } }).tables.user_pref?.find((x) => x.pref_key === LEGACY_L01.archiveKey);
    return readArchive(pref?.value);
  };
  await expect
    .poll(async () => {
      const a = await serverArchive();
      return a && { ids: a.rows.step_progress.map((x) => String(x.step_id)), reset: [...a.reset_steps].sort(), applied_at: a.applied_at };
    })
    .toEqual({ ids: expect.arrayContaining(['L01-S01', 'L01-S02', 'L01-S07', 'L01-S12']), reset: ['L01-S03', 'L01-S07', 'L01-S12'], applied_at: APPLIED_AT });
  const originals = (await serverArchive())?.rows.step_progress
    .filter((x) => x.step_id === 'L01-S07' || x.step_id === 'L01-S12')
    .map((x) => [x.step_id, x.content_version, x.status])
    .sort();
  expect(originals).toEqual([
    ['L01-S07', LEGACY_L01.contentVersions[0], 'done'],
    ['L01-S12', LEGACY_L01.contentVersions[0], 'done'],
  ]);
  // 마친 S07 은 새 완료 시각으로 완료. 열기만 한 S12 는 서버가 옛 완료를 되살려도 이 기기·다른 기기 모두 미완료로 보인다
  expect(Date.parse(String((await stepRow(page, 'L01-S07'))?.done_at))).toBeGreaterThan(Date.parse('2026-11-18T00:00:00+09:00'));
  const overview = async (p: Page) => {
    await p.goto(BASE + base);
    await expect(syncState(p, 'saved')).toBeVisible();
    await hydrated(p);
    const done = (slug: string) => p.getByTestId('step-list').locator(`a[href="${base}${slug}/"] .st-done`);
    await expect(done(s07.slug)).toHaveCount(1);
    await expect(done(s12.slug)).toHaveCount(0);
  };
  await overview(page);
  const other = await browser.newContext({ viewport: page.viewportSize(), locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  try {
    await overview(await other.newPage());
  } finally {
    await other.close();
  }
});

test('M1 다른 기기가 쓴 예측이 있는 단계: 서버 행을 모른 채(첫 받기가 멈춘 채) 새 단계 행을 써도 서버의 예측이 남는다', async ({ page }) => {
  const steps = sorted((await readManifest(page)).basics.steps['F-P1']);
  const target = steps[1];
  const created = await page.request.post(`${BASE}/api/dev-auth/accounts`, { data: { display_name: '멈춤 검사' } });
  expect(created.ok(), await created.text()).toBe(true);
  const at = new Date(Date.now() - 60 * 60_000).toISOString();
  const seed = await page.request.post(`${BASE}/api/sync`, {
    data: {
      client_id: 'other-device',
      ops: [
        {
          op_id: 'other-' + target.step_id,
          table: 'step_progress',
          key: { step_id: target.step_id },
          data: { status: 'in_progress', attempts: 2, started_at: at, prediction: '다른 기기 예측', active_seconds_user: 300 },
          updated_at: at,
        },
      ],
    },
  });
  expect(seed.status(), await seed.text()).toBe(200);
  const sent: SentOp[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/sync' && r.method() === 'POST') sent.push(...((r.postDataJSON() as { ops: SentOp[] }).ops ?? []));
  });
  let hold = true;
  await page.route(
    (u) => u.pathname === '/api/state',
    (route) => {
      if (hold && route.request().method() === 'GET') {
        hold = false;
        return;
      }
      return route.continue();
    },
  );
  await page.goto(UNIT_BASE + target.slug + '/');
  // 상한 뒤 단계 화면이 서버 행을 모른 채(base 없음) 새 행을 써서 보낸다. 값이 없는 칸은 보내지 않는다
  await expect.poll(() => sent.some((o) => o.key.step_id === target.step_id), { timeout: ADVANCE_MAX_MS }).toBe(true);
  const op = sent.find((o) => o.key.step_id === target.step_id);
  expect(op?.base_updated_at).toBeUndefined();
  expect(Object.keys(op?.data ?? {})).not.toContain('prediction');
  expect(Object.keys(op?.data ?? {})).not.toContain('active_seconds_user');
  await expect(syncState(page, 'saved')).toBeVisible();
  expect(await stepRow(page, target.step_id)).toMatchObject({ prediction: '다른 기기 예측', active_seconds_user: 300 });
  await finishStep(page, UNIT_BASE, steps, 1);
  await expect.poll(async () => (await stepRow(page, target.step_id))?.status).toBe('done');
  expect(await stepRow(page, target.step_id)).toMatchObject({ prediction: '다른 기기 예측', active_seconds_user: 300 });
});
