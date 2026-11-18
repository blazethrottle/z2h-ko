// 실제 서버 통합 (P5 사전 기초): python -m z2h_server 하나로 앱을 열어 진단 5문제를 풀고 기초 단위 단계·문제를 하면,
// 실제 서버의 diagnostic_result(answers·recommended_units JSON, attempt_no 는 서버가 매김)·step_progress·question_attempt·rebuild_attempt 에 저장되고,
// 다른 기기(새 브라우저)에서 같은 계정으로 열면 진단 결과와 단위 상태가 보인다.
// 서버는 테스트가 직접 켜고 끈다(임시 DB, 포트 8797, 127.0.0.1). 저장소 server/ 폴더와 켜 둔 진도 서버(8787)는 쓰지 않는다.
import { test, expect, type Page } from '@playwright/test';
import { LOCAL_HOST, REAL_TEST_PORT } from '../../src/lib/api-target.mjs';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnosticSummary } from '../../src/lib/basics';
import { answerQuestion } from '../e2e/helpers';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const REPO = path.resolve(APP, '..');
// 저장소 .venv 가 없는 작업 폴더(git worktree)에서는 Z2H_PYTHON 으로 그 파이썬을 준다
const PY = process.env.Z2H_PYTHON || path.join(REPO, '.venv/bin/python');
const PORT = REAL_TEST_PORT;
const BASE = `http://${LOCAL_HOST}:${PORT}`;

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

async function serverTables(page: Page) {
  const r = await page.request.get(`${BASE}/api/state`);
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()).tables as Record<string, any[]>;
}

test.beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'z2h-real-basics-'));
  await startServer();
});
test.afterEach(async () => {
  await stopServer();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('실제 서버: 진단 결과와 기초 단위 기록이 저장되고, 다른 기기에서 같은 계정으로 보인다', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const m = await (await page.request.get(`${BASE}/data/manifest.json`)).json();
  const B = m.basics;
  const answers = await (await page.request.get(`${BASE}/data/${B.lecture_id}/answers.json`)).json();

  // 1) 진단: 첫 고르기 문항만 틀리게
  await page.goto(`${BASE}/basics/diagnostic/`);
  await expect(syncState(page, 'saved')).toBeVisible();
  await hydrated(page);
  const wrongId = B.diagnostic.find((q: any) => q.type === 'choice').question_id;
  for (const q of B.diagnostic) {
    const card = page.getByTestId(`diag-${q.question_id}`);
    const a = answers[q.question_id];
    if (q.type === 'choice') {
      const wrong = q.choices.findIndex((_: string, i: number) => i !== a.answer_index && i !== q.dont_know_index);
      await card.getByRole('radio').nth(q.question_id === wrongId ? wrong : a.answer_index).click();
    } else await card.getByTestId(`diag-input-${q.question_id}`).fill(String(a.auto_grade.value));
  }
  await page.getByTestId('diag-submit').click();
  const s = diagnosticSummary(
    B.diagnostic,
    B.diagnostic.map((q: any) => ({ question_id: q.question_id, is_correct: q.question_id !== wrongId })),
    B.unit_order,
  );
  const scoreText = `${s.correct} / ${s.total} 맞음`;
  await expect(page.getByTestId('diag-score')).toHaveText(scoreText);
  await expect(syncState(page, 'saved')).toBeVisible();
  await expect.poll(async () => (await serverTables(page)).diagnostic_result?.length ?? 0).toBe(1);
  const row = (await serverTables(page)).diagnostic_result[0];
  expect(row.attempt_no).toBe(1);
  expect(row.recommended_units).toEqual(s.units);
  expect(row.answers.map((a: any) => a.question_id)).toEqual(B.diagnostic.map((q: any) => q.question_id));
  expect(row.at).toMatch(/\+09:00$/);

  // 2) 첫 준비된 단위: 확인 문제가 있는 단계까지 마치고 문제 하나를 맞힌다
  const uid = B.ready_ids[0];
  const step = B.steps[uid].find((x: any) => x.question_ids.length);
  await page.goto(`${BASE}/basics/${uid}/${step.slug}/`);
  await hydrated(page);
  await page.getByTestId('finish-step').click();
  await expect(page.locator('[data-phase="quiz"]')).toBeVisible();
  const qid = step.question_ids[0];
  // 맞는 답 내기는 자동 브라우저 테스트와 같은 도우미(고르기·직접 입력·채점 기준 모두)
  const card = await answerQuestion(page, qid, answers[qid]);
  await expect(card.getByTestId(`result-${qid}`)).toContainText('맞음');
  await expect(syncState(page, 'saved')).toBeVisible();
  await expect
    .poll(async () => {
      const t = await serverTables(page);
      return [
        (t.step_progress ?? []).some((r) => r.step_id === step.step_id && r.status === 'done'),
        (t.question_attempt ?? []).some((r) => r.question_id === qid && r.is_correct === true),
      ];
    })
    .toEqual([true, true]);

  // 2-1) 익힘 과제: "직접 확인했어요" → rebuild_attempt(1편 재구성 기록과 같은 표, attempt_no 는 서버가 매김)
  const r = B.rebuild[uid][0];
  await page.goto(`${BASE}/basics/${uid}/`);
  await hydrated(page);
  await page.getByTestId(`rebuild-ok-${r.rebuild_id}`).click();
  await expect(page.getByTestId(`rebuild-result-${r.rebuild_id}`)).toContainText('통과');
  await expect(syncState(page, 'saved')).toBeVisible();
  await expect
    .poll(async () => ((await serverTables(page)).rebuild_attempt ?? []).map((x) => [x.rebuild_id, x.passed, x.max_hint_level, x.attempt_no]))
    .toEqual([[r.rebuild_id, true, 0, 1]]);

  // 3) 다른 기기: 새 브라우저(쿠키·IndexedDB 없음)가 같은 개발용 계정으로 열면 서버에서 받아 보인다
  const other = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const p2 = await other.newPage();
  await p2.goto(`${BASE}/basics/`);
  await expect(syncState(p2, 'saved')).toBeVisible();
  await expect(p2.getByTestId('diag-score')).toHaveText(scoreText);
  await expect(p2.getByTestId(`unit-state-${uid}`)).toHaveText('● 지금');
  await other.close();
});
