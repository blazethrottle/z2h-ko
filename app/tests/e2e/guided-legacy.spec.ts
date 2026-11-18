// 안내형 길 1차(P9) C: 옛 1편(1.2판) 진도 옮기기(계획서 PR-10, 교사 승인). 옛 기록을 심은 기기 → 옛 행은 user_pref legacy_progress:L01:1.2 에 보관,
// 새 개요에서는 표(src/lib/migrate/l01-v1_2.ts)대로 걸린 옛 단계가 모두 완료인 새 단계만 완료, 홈·기초에 잘못된 완료 0. 다시 열어도·다른 기기에서도 같다.
// 기대 완료 목록은 화면 코드가 아니라 표 함수(mappedDoneIds)로 정본 표에서 계산한다. 가짜 계정·가짜 서버(fixtures.ts).
import type { Page } from '@playwright/test';
import { test, expect, hydrated } from './fixtures';
import { readManifest } from './manifest-types';
import { LEGACY_L01, mappedDoneIds, newArchive } from '../../src/lib/migrate/l01-v1_2';

const OLD_AT = '2026-11-17T10:00:00+09:00';
const NEW_AT = '2026-11-18T09:00:00+09:00';
const oldRow = (n: string, status = 'done') => ({
  step_id: `L01-S${n}`,
  status,
  max_hint_level: 1,
  attempts: 2,
  started_at: '2026-11-17T09:00:00+09:00',
  done_at: status === 'done' ? OLD_AT : null,
  active_seconds_auto: 60,
  active_seconds_user: null,
  prediction: null,
  content_version: LEGACY_L01.contentVersions[1],
  updated_at: OLD_AT,
  server_seq: 1,
});
/** 옛 기록: 01·03·07·09b·10·16 완료, 04 진행 중(10b 는 기록 없음 → 새 S28 미완료) */
const SEED = ['01', '03', '07', '09b', '10', '16'].map((n) => oldRow(n)).concat([oldRow('04', 'in_progress')]);
const WANT = mappedDoneIds({ ...newArchive(NEW_AT), rows: { step_progress: SEED, grade_result: [] } });
/** 옛 1.2판의 확인 문제 기록(같은 id 가 새 문제에도 있음): 점수에 들어가면 안 된다 */
const OLD_ATTEMPT = { question_id: 'L01-Q01', attempt_id: 'old-1', is_correct: true, raw_points: 1, points_awarded: 1, score_ratio: 1, max_hint_level: 0, at: OLD_AT, updated_at: OLD_AT, server_seq: 1 };

/** 강의 개요를 연다(서버 기록을 받아 "저장됨"이 될 때까지) */
async function openOverview(page: Page, lectureId: string, steps: { step_id: string }[]) {
  await page.goto(`/lectures/${lectureId}/`);
  await hydrated(page);
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  await expect(page.getByTestId('step-list').locator('li')).toHaveCount(steps.length);
}
/** 개요의 "✓ 완료" 단계 id. 목록을 한 번에 읽는다(다시 그리는 중에 반쯤 읽지 않게) */
const doneSnapshot = (page: Page, steps: { step_id: string }[]) =>
  page.getByTestId('step-list').evaluate((ol, ids) => [...ol.querySelectorAll(':scope > li')].flatMap((li, i) => ((li.textContent ?? '').includes('✓ 완료') ? [ids[i]] : [])).sort(), steps.map((s) => s.step_id));
/** 개요의 완료가 WANT 와 같아질 때까지 본다. 그 사이 한 번이라도 WANT 밖의 완료가 보이면 실패 */
async function expectOverviewDone(page: Page, lectureId: string, steps: { step_id: string }[]) {
  await openOverview(page, lectureId, steps);
  const extra = new Set<string>();
  await expect
    .poll(async () => {
      const done = await doneSnapshot(page, steps);
      for (const id of done) if (!WANT.includes(id)) extra.add(id);
      return done;
    })
    .toEqual([...WANT].sort());
  expect([...extra]).toEqual([]);
}

test('옛 기록을 심은 기기: 보관본에 옛 행 그대로, 새 개요는 표대로만 완료, 홈 완료 수·기초 완료 0, 다시 열어도 같은 결과', async ({ page, api }) => {
  // 01→02·03, 03→05·06, 07→13·15~19, 09b→21·22, 10→27, 16→53 (10b 없음 → 28 미완료)
  expect(WANT.length).toBe(14);
  api.serverTables = { step_progress: SEED, question_attempt: [OLD_ATTEMPT] };
  const L = (await readManifest(page)).lectures[0];
  await page.goto('/home/');
  await hydrated(page);
  // 1) 보관본 → 2) 서버가 받은 뒤 표대로 완료 → 3) applied_at
  await expect.poll(() => api.opsFor('user_pref').filter((o) => o.key.pref_key === LEGACY_L01.archiveKey).length).toBe(2);
  const archiveOps = api.opsFor('user_pref').filter((o) => o.key.pref_key === LEGACY_L01.archiveKey);
  const byId = (rows: { step_id: string }[]) => [...rows].sort((a, b) => a.step_id.localeCompare(b.step_id));
  expect(byId(archiveOps[0].data.value.rows.step_progress)).toEqual(byId(SEED));
  expect(archiveOps[0].data.value.applied_at).toBeNull();
  expect(archiveOps[1].data.value.applied_at).toEqual(expect.any(String));
  const stepOps = api.opsFor('step_progress');
  expect(stepOps.map((o) => o.key.step_id).sort()).toEqual([...WANT].sort());
  for (const o of stepOps) expect(o.data).toMatchObject({ status: 'done', content_version: LEGACY_L01.migratedContentVersion });

  await expect(page.getByTestId('done-count')).toHaveText(String(WANT.length));
  await expectOverviewDone(page, L.lecture_id, L.steps);
  // 옛 확인 문제 기록(같은 id L01-Q01 을 맞힘)은 점수에 없다
  await expect(page.getByTestId('mastery')).toContainText('확인 문제 점수: 0%');
  // 기초는 옮기지 않는다: 단위 완료 0
  await page.goto('/basics/');
  await hydrated(page);
  await expect(page.locator('main')).not.toContainText('✓ 완료');

  // 다시 열어도(한 번만 실행) 새 기록을 쓰지 않는다
  const before = api.ops.length;
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId('sync-status').locator('[data-state="saved"]')).toBeVisible();
  await expectOverviewDone(page, L.lecture_id, L.steps);
  expect(api.ops.slice(before).filter((o) => o.table === 'step_progress' || o.key.pref_key === LEGACY_L01.archiveKey)).toEqual([]);
});

test('화면이 이 빌드의 1편 판 값(content_version)을 알려 주고, 그 값으로 쓴 완료는 기기 시계가 지금 판 커밋 전으로 틀려 있어도 완료로 보인다', async ({ page, api }) => {
  const m: { lectures: { lecture_id: string; content_version: string }[] } = await (await page.request.get('/data/manifest.json')).json();
  const L = (await readManifest(page)).lectures[0];
  const cv = m.lectures[0].content_version;
  const AT = '2026-11-17T09:00:00+09:00';
  api.serverTables = { step_progress: [{ step_id: 'L01-S20', status: 'done', done_at: AT, started_at: AT, content_version: cv, updated_at: AT, server_seq: 1 }] };
  await openOverview(page, L.lecture_id, L.steps);
  const meta = await page.locator('meta[name="z2h-content-versions"]').getAttribute('content');
  expect((meta ?? '').split(' ')).toEqual(m.lectures.map((l) => l.content_version));
  await expect.poll(() => doneSnapshot(page, L.steps)).toEqual(['L01-S20']);
});

test('다른 기기(이미 옮긴 서버 기록을 받음): 같은 완료만 보이고 다시 옮기지 않는다', async ({ page, api }) => {
  const migrated = WANT.map((id, i) => ({ step_id: id, status: 'done', done_at: NEW_AT, content_version: LEGACY_L01.migratedContentVersion, updated_at: NEW_AT, server_seq: 10 + i }));
  const archive = { ...newArchive(NEW_AT), applied_at: NEW_AT, rows: { step_progress: SEED, grade_result: [] } };
  api.serverTables = {
    step_progress: [...SEED.filter((r) => !WANT.includes(r.step_id)), ...migrated],
    user_pref: [{ pref_key: LEGACY_L01.archiveKey, value: archive, updated_at: NEW_AT, server_seq: 9 }],
  };
  const L = (await readManifest(page)).lectures[0];
  await expectOverviewDone(page, L.lecture_id, L.steps);
  await page.goto('/home/');
  await hydrated(page);
  await expect(page.getByTestId('done-count')).toHaveText(String(WANT.length));
  expect(api.opsFor('step_progress')).toEqual([]);
  expect(api.opsFor('user_pref').filter((o) => o.key.pref_key === LEGACY_L01.archiveKey)).toEqual([]);
});

test('한 기기만 보관하고 아직 옮기지 못한 서버 기록(applied_at 없음)을 받은 기기: 그 기기가 표대로 옮긴다, 옮기기 전에도 옛 완료는 보이지 않는다', async ({ page, api }) => {
  const archive = { ...newArchive(NEW_AT), rows: { step_progress: SEED, grade_result: [] } };
  api.serverTables = { step_progress: SEED, user_pref: [{ pref_key: LEGACY_L01.archiveKey, value: archive, updated_at: NEW_AT, server_seq: 9 }] };
  const L = (await readManifest(page)).lectures[0];
  await expectOverviewDone(page, L.lecture_id, L.steps);
  await expect.poll(() => api.opsFor('step_progress').map((o) => o.key.step_id).sort()).toEqual([...WANT].sort());
});

test('옛 완료 행이 있는데 표로는 미완료인 새 단계(S01): 열어도 완료로 보이지 않고, 마치면 그때 완료', async ({ page, api }) => {
  api.serverTables = { step_progress: SEED };
  const L = (await readManifest(page)).lectures[0];
  const s01 = L.steps.find((s) => s.step_id === 'L01-S01');
  expect(s01).toBeTruthy();
  expect(WANT).not.toContain('L01-S01');
  // 먼저 서버 기록(옛 행)을 받아 둔 기기에서
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  await expect.poll(() => api.opsFor('step_progress').length).toBe(WANT.length);
  await expect(page.getByTestId('step-list').locator('li').first()).not.toContainText('✓ 완료');
  await page.goto(`/lectures/${L.lecture_id}/${s01?.slug}/#practice`);
  await hydrated(page);
  await expect.poll(() => api.opsFor('step_progress').filter((o) => o.key.step_id === 'L01-S01').map((o) => o.data.status)).toEqual(['in_progress']);
  await page.getByTestId('finish-step').click();
  await expect.poll(() => api.opsFor('step_progress').filter((o) => o.key.step_id === 'L01-S01').map((o) => o.data.status)).toEqual(['in_progress', 'done']);
  const doneOp = api.opsFor('step_progress').filter((o) => o.key.step_id === 'L01-S01')[1];
  expect(Date.parse(doneOp.data.done_at)).toBeGreaterThan(Date.parse(LEGACY_L01.cutoff));
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  await expect(page.getByTestId('step-list').locator('li').first()).toContainText('✓ 완료');
  // 옛 S01 행은 보관본에 그대로
  const archive = api.opsFor('user_pref').filter((o) => o.key.pref_key === LEGACY_L01.archiveKey)[0];
  expect(archive.data.value.rows.step_progress.find((r: { step_id: string }) => r.step_id === 'L01-S01')).toEqual(SEED[0]);
});
