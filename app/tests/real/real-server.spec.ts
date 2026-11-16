// 실제 서버 통합 (P1 완료 기준): python -m z2h_server 하나로 앱을 열어 모든 단계를 넘기고,
// 서버를 끈 채 단계 완료·문제 풀이 → 서버를 켜면 기록이 올라가며 표시가 오프라인 → 저장됨.
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../src/config';
import { formatHM, weekStartKst } from '../../src/lib/time';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const REPO = path.resolve(APP, '..');
const PY = path.join(REPO, '.venv/bin/python');
const PORT = 8797;
const BASE = `http://127.0.0.1:${PORT}`;

let tmp = '';
let proc: ChildProcess | null = null;

async function portBusy() {
  try {
    await fetch(`${BASE}/api/health`);
    return true;
  } catch {
    return false;
  }
}

async function startServer() {
  if (await portBusy()) throw new Error(`포트 ${PORT}을 이미 다른 프로그램이 쓰고 있습니다. 그 프로그램을 끄고 다시 돌리세요`);
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
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
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

async function serverState(page: Page) {
  const r = await page.request.get(`${BASE}/api/state`);
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()) as { tables: Record<string, any[]> };
}

/** 앱이 처음 열 때 개발용 계정을 스스로 만들 때까지 기다린다 (server/API.md 1절, PM 결정 B) */
async function appAccount(page: Page) {
  // "저장됨"은 계정을 정하기 전에도 보이는 기본 표시라, /api/me 가 계정을 돌려줄 때까지 따로 기다린다
  await expect.poll(async () => (await page.request.get(`${BASE}/api/me`)).status()).toBe(200);
  await expect(syncState(page, 'saved')).toBeVisible();
  const r = await page.request.get(`${BASE}/api/me`);
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()).user as { user_id: string; display_name: string };
}

/** client:load 부품이 모두 살아날 때까지 기다린다(그 전 클릭은 버려진다). tests/e2e/fixtures.ts 의 hydrated 와 같다 */
const hydrated = (page: Page) => expect(page.locator('astro-island[ssr]')).toHaveCount(0);

const syncState = (page: Page, s: string) => page.getByTestId('sync-status').locator(`[data-state="${s}"]`);

test.beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'z2h-real-'));
  await startServer();
});
test.afterEach(async () => {
  await stopServer();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('실제 서버: 모든 단계를 처음부터 끝까지 넘기면 서버에 done으로 남는다', async ({ page }) => {
  const m = await (await page.request.get('/data/manifest.json')).json();
  const L = m.lectures[0];
  const steps = [...L.steps].sort((a: any, b: any) => a.order - b.order);
  await page.goto(`/lectures/${L.lecture_id}/${steps[0].slug}/`);
  await appAccount(page);
  for (const s of steps) {
    await expect(page.getByTestId('step-position')).toContainText(s.step_id);
    await hydrated(page);
    await page.getByTestId('start-practice').click();
    await page.getByTestId('finish-step').click();
    if (s.question_ids.length) await page.getByTestId('next-step').click();
  }
  await expect(page.getByTestId('step-list').locator('.st-done')).toHaveCount(steps.length);
  await expect(syncState(page, 'saved')).toBeVisible();
  await expect
    .poll(async () => (await serverState(page)).tables.step_progress.filter((r) => r.status === 'done').length)
    .toBe(steps.length);
});

test('실제 서버: 꺼진 동안 한 학습이 켜진 뒤 올라가고, 표시가 오프라인 → 저장됨 (동기화 중 1초 규칙은 tests/e2e/sync.spec.ts)', async ({ page }) => {
  const m = await (await page.request.get('/data/manifest.json')).json();
  const L = m.lectures[0];
  const answers = await (await page.request.get(`/data/${L.lecture_id}/answers.json`)).json();
  const step = L.steps.find((s: any) => s.question_ids.some((q: string) => answers[q].auto_grade.type === 'choice' || answers[q].auto_grade.type === 'exact'));
  test.skip(!step, '자동 채점 문제가 걸린 단계 없음');
  const qid = step.question_ids.find((q: string) => ['choice', 'exact'].includes(answers[q].auto_grade.type));

  await page.goto(`/lectures/${L.lecture_id}/${step.slug}/#practice`);
  await appAccount(page);
  await page.waitForLoadState('networkidle'); // 풀이 JSON 을 메모리에 받아 둔 뒤

  await stopServer();
  await page.getByTestId('finish-step').click();
  const card = page.getByTestId(`question-${qid}`);
  const a = answers[qid];
  if (a.auto_grade.type === 'choice') await card.getByRole('radio').nth(a.answer_index).click();
  else await card.locator('input.input, textarea').first().fill(String(Array.isArray(a.auto_grade.value) ? a.auto_grade.value[0] : a.auto_grade.value));
  await card.getByTestId(`submit-${qid}`).click();
  await expect(card.getByTestId(`result-${qid}`)).toContainText('맞음');
  await expect(syncState(page, 'offline')).toBeVisible();
  expect((await fetch(`${BASE}/api/health`).catch(() => null))?.ok ?? false).toBe(false);

  await startServer();
  await syncState(page, 'offline').click();
  await page.getByRole('button', { name: '지금 다시 시도' }).click();
  await expect(syncState(page, 'saved')).toBeVisible();
  const st = await serverState(page);
  expect(st.tables.step_progress.find((r) => r.step_id === step.step_id)?.status).toBe('done');
  const att = st.tables.question_attempt.find((r) => r.question_id === qid);
  expect(att?.is_correct).toBe(true);
  if (a.auto_grade.type === 'choice') expect(att?.choice_index).toBe(a.answer_index);
});

test('실제 서버: 실습 시간 고친 값과 실행 장소가 서버에 남는다', async ({ page }) => {
  await page.goto('/home/');
  await appAccount(page);
  const card = page.getByTestId('week-time');
  await card.getByRole('button', { name: '이번 주 실습 시간 수정' }).click();
  await card.getByLabel('시간').fill('1');
  await card.getByLabel('분').fill('5');
  await card.getByRole('button', { name: '저장' }).click();
  await expect(page.getByTestId('week-time-value')).toHaveText('1:05');
  await page.goto('/settings/');
  await page.getByRole('button', { name: /맥미니 Jupyter/ }).click();
  await expect
    .poll(async () => {
      const prefs = (await serverState(page)).tables.user_pref;
      return {
        week: prefs.find((r) => String(r.pref_key).startsWith('practice_week:'))?.value?.edited_seconds,
        run: prefs.find((r) => r.pref_key === 'run_place')?.value,
      };
    })
    .toEqual({ week: 3900, run: 'jupyter' });
  await expect(syncState(page, 'saved')).toBeVisible();
});

test('실제 서버: 단계 화면의 실습 시간이 자동으로 서버에 쌓이고, 홈에서 고친 값과 "자동 기록으로 되돌리기"가 서버에 남는다', async ({ page }) => {
  const m = await (await page.request.get('/data/manifest.json')).json();
  const L = m.lectures[0];
  const step = [...L.steps].sort((a: any, b: any) => a.order - b.order)[0];
  const flushS = Math.round(config.activityFlushMs / 1000);

  // 가짜 시계: 시간은 그대로 흐르고, runFor 로 앞당기면 1초 타이머가 그만큼 돈다(실제로 기다리지 않는다).
  // 1분 넘게 앞당겨 홈의 시:분 표시가 0:00 이 아니게 한다
  await page.clock.install();
  await page.goto(`/lectures/${L.lecture_id}/${step.slug}/#practice`);
  await appAccount(page);
  await page.mouse.move(10, 10);
  const ranS = Math.ceil(61 / flushS) * flushS + 1;
  await page.clock.runFor(ranS * 1000);

  // 자동 값: step_progress.active_seconds_auto 와 study_session(auto) 이 서버에 0 보다 크게 저장.
  // 시계는 그 뒤에도 흐르므로 같은 값인 순간(한 번 보낸 뒤)을 기다리고, 앞당긴 만큼 이상인지 본다
  const autoOnServer = async () => {
    const st = await serverState(page);
    const sp = st.tables.step_progress.find((r) => r.step_id === step.step_id);
    const ss = st.tables.study_session.filter((r) => r.target_id === step.step_id && r.source === 'auto');
    return { auto: Number(sp?.active_seconds_auto ?? 0), sessions: ss.length, sessionSeconds: ss.reduce((a, r) => a + Number(r.active_seconds ?? 0), 0) };
  };
  await expect
    .poll(async () => {
      const a = await autoOnServer();
      return a.sessions === 1 && a.auto === a.sessionSeconds && a.auto >= ranS - 1 - ((ranS - 1) % flushS);
    })
    .toBe(true);

  // 홈: 자동 값(이번 주 study_session 합)이 보이고, 고친 값이 서버의 practice_week:{주 시작일} 에 저장
  await page.goto('/home/');
  await appAccount(page);
  const weekKey = `practice_week:${weekStartKst(await page.evaluate(() => Date.now()))}`;
  const value = page.getByTestId('week-time-value');
  // 단계 화면을 떠날 때 남은 초도 보낸다. 서버 값과 홈 표시가 같아질 때까지 기다린다
  const homeShowsServerAuto = async () => {
    const a = await autoOnServer();
    return a.auto === a.sessionSeconds && formatHM(a.sessionSeconds) === (await value.textContent());
  };
  await expect.poll(homeShowsServerAuto).toBe(true);
  const auto1 = await autoOnServer();
  expect(auto1.auto).toBeGreaterThan(0);
  expect(await value.textContent()).not.toBe('0:00');
  const card = page.getByTestId('week-time');
  await card.getByRole('button', { name: '이번 주 실습 시간 수정' }).click();
  await card.getByLabel('시간').fill('2');
  await card.getByLabel('분').fill('10');
  await card.getByRole('button', { name: '저장' }).click();
  await expect(value).toHaveText('2:10');
  await expect(card).toContainText('수정됨');
  const weekPref = async () => (await serverState(page)).tables.user_pref.find((r) => r.pref_key === weekKey);
  await expect.poll(async () => (await weekPref())?.value?.edited_seconds).toBe(2 * 3600 + 10 * 60);

  // 자동 기록으로 되돌리기: 서버의 그 주 값이 비고(null), 화면은 자동 값으로 돌아온다. 자동 값은 그대로 남는다
  await card.getByRole('button', { name: '이번 주 실습 시간 수정' }).click();
  await card.getByRole('button', { name: '자동 기록으로 되돌리기' }).click();
  await expect(value).not.toHaveText('2:10');
  await expect(card).not.toContainText('수정됨');
  await expect.poll(homeShowsServerAuto).toBe(true);
  await expect
    .poll(async () => {
      const r = await weekPref();
      return r ? { has: true, value: r.value ?? null } : { has: false, value: 'missing' };
    })
    .toEqual({ has: true, value: null });
  const auto2 = await autoOnServer();
  expect(auto2.auto).toBeGreaterThanOrEqual(auto1.auto);
  expect(auto2.sessions).toBe(1);
  await expect(syncState(page, 'saved')).toBeVisible();
});

test('실제 서버: 처음 열면 개발용 계정이 생기고, 설정에서 새 계정으로 바꾸면 기록이 따로다', async ({ page }) => {
  expect((await page.request.get(`${BASE}/api/state`)).status()).toBe(401); // 계정 없이는 기록 API 401
  await page.goto('/home/');
  const first = await appAccount(page);
  await page.goto('/settings/');
  await page.getByRole('button', { name: /맥미니 Jupyter/ }).click();
  await expect.poll(async () => (await serverState(page)).tables.user_pref.find((r) => r.pref_key === 'run_place')?.value).toBe('jupyter');
  await page.getByLabel('새 계정 이름').fill('둘째');
  await page.getByTestId('create-account').click();
  await expect(page.getByTestId('current-account')).toHaveText('둘째');
  const second = await appAccount(page);
  expect(second.user_id).not.toBe(first.user_id);
  expect((await serverState(page)).tables.user_pref.find((r) => r.pref_key === 'run_place')).toBeUndefined();
  const list = await (await page.request.get(`${BASE}/api/dev-auth/accounts`)).json();
  expect(list.accounts.map((a: any) => a.user_id).sort()).toEqual([first.user_id, second.user_id].sort());
});
