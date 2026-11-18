// 배지와 편 도장 (spec 13.4, D31·D47, P3). 편 수·배지 수는 콘텐츠(manifest)와 규칙 파일(badge-rules.ts)에서 센다.
// 가짜 서버(fixtures.ts)의 serverTables 로 "다른 기기에서 올린 기록"을 만들어, 앱이 조건을 보고 user_badge 를 한 번만 쓰는지 본다.
import { test, expect, hydrated, manifest } from './fixtures';
import { STAGE_BADGES, TASTE_MARK } from '../../src/badge-rules';
import { lectureRefs, stageStatusKo } from '../../src/lib/badges';
import type { Page } from '@playwright/test';

// 지금 판(claude-1.0) 1편 기록이므로 그 판이 생긴 뒤 시각. 그 전 시각의 1편 기록은 옛 1.2판 기록으로 본다(src/lib/migrate)
const AT = '2026-11-18T01:00:00.000+09:00';
const EM_DASH = String.fromCharCode(0x2014);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** 01편 익힘 조건(단계 전부 완료, 문제 만점, 재구성 통과, 말하기 스스로 표시)을 채운 서버 행 */
export async function masteredRows(page: Page, L: any) {
  const answers = await (await page.request.get(`/data/${L.lecture_id}/answers.json`)).json();
  return {
    step_progress: L.steps.map((s: any) => ({ step_id: s.step_id, path_id: 'full', status: 'done', done_at: AT, max_hint_level: 0, attempts: 0, active_seconds_auto: 0, updated_at: AT })),
    question_attempt: L.questions.map((q: any, i: number) => ({
      question_id: q.question_id,
      attempt_id: uuid(i + 1),
      attempt_no: 1,
      is_correct: true,
      is_dont_know: false,
      env_issue: false,
      raw_points: answers[q.question_id].max_points,
      points_awarded: answers[q.question_id].max_points,
      score_ratio: 1,
      max_hint_level: 0,
      context: 'step',
      at: AT,
      updated_at: AT,
    })),
    rebuild_attempt: L.rebuild_ids.map((r: string, i: number) => ({ rebuild_id: r, attempt_id: uuid(100 + i), attempt_no: 1, passed: true, max_hint_level: 0, at: AT, updated_at: AT })),
    mastery_state: [{ target_id: L.lecture_id, state: 'in_progress', extra_checks_ok: true, updated_at: AT }],
  };
}

const rgb = (hex: string) => {
  const h = hex.trim().replace('#', '');
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
};
const tokenRgb = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n), name).then(rgb);

async function openBadges(page: Page) {
  await page.goto('/badges/');
  await hydrated(page);
  await expect(page.getByTestId('badges')).toHaveAttribute('data-loaded', 'true');
}

test('처음: 맛보기 완료 "아직", 단계 배지 4장 모두 아직(점선 원), 편 도장은 편 목록 수만큼 모두 아직, 안내 문구', async ({ page, api }) => {
  const m = await manifest(page);
  await openBadges(page);
  await expect(page.locator('h1')).toHaveText('내 배지');
  await expect(page.getByTestId('badge-note')).toHaveText('배지는 앱 안의 학습 기록이며 자격증이 아닙니다. 단계 배지는 누적 점검을 통과하면 받습니다.');
  const mark = page.getByTestId('taste-mark');
  await expect(mark).toHaveAttribute('data-state', 'todo');
  await expect(mark).toContainText(`${TASTE_MARK.name_ko} · 아직`);
  await expect(mark).toContainText('배지가 아닌 완료 표시');

  const stages = page.getByTestId('stage-badges').locator('li');
  await expect(stages).toHaveCount(STAGE_BADGES.length);
  const refs = lectureRefs(m.lecture_list.map((l: any) => ({ ...l, stamp_id: m.lectures.find((x: any) => x.lecture_id === l.lecture_id)?.stamp_id ?? null })));
  for (const b of STAGE_BADGES) {
    const li = page.locator(`li[data-badge="${b.badge_id}"]`);
    await expect(li).toHaveAttribute('data-state', 'todo');
    await expect(li).toContainText(b.name_ko);
    await expect(li).toContainText(b.condition_ko);
    await expect(page.getByTestId(`badge-status-${b.badge_id}`)).toHaveText(stageStatusKo(b, refs, []));
    await expect(li.locator('.bmark')).toHaveCSS('border-top-style', 'dashed');
    await expect(li.locator('.bmark')).toHaveAttribute('aria-label', `단계 ${b.no} 배지 아직`);
  }

  const stamps = page.getByTestId('stamps').locator('[role="img"]');
  await expect(stamps).toHaveCount(m.lecture_list.length);
  for (const [i, l] of m.lecture_list.entries()) {
    await expect(stamps.nth(i)).toHaveAttribute('aria-label', `${l.lecture_id.slice(1)}편 도장 아직`);
    await expect(stamps.nth(i)).toHaveCSS('border-top-style', 'dashed');
  }
  await expect(page.getByText('짧은 길을 골라도 받을 수 있습니다.', { exact: false })).toBeVisible();
  const body = await page.evaluate(() => document.body.innerText);
  expect(body).not.toMatch(/스트릭|연속 기록|순위|축하/);
  expect(body.includes(EM_DASH)).toBe(false);
  // 요약 경로 띠·"전체 길로 바꾸기"는 프로토타입 밖
  await expect(page.getByText('전체 길로 바꾸기')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(api.opsFor('user_badge')).toEqual([]);
});

test('01편 익힘 조건을 채우면: 개요에 "도장이 생겼습니다 · 보기" 한 줄, 배지 화면 01편 도장 받음, user_badge 는 한 번만', async ({ page, api }, info) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  api.serverTables = await masteredRows(page, L);
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  const notice = page.getByTestId('badge-notice');
  await expect(notice).toContainText('도장이 생겼습니다');
  await expect(notice.getByRole('link', { name: '보기' })).toHaveAttribute('href', '/badges/');
  await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toHaveCount(0);
  await expect.poll(() => api.opsFor('mastery_state').some((o) => o.data.state === 'mastered')).toBe(true);
  await expect.poll(() => api.opsFor('user_badge').length).toBe(1);
  const op = api.opsFor('user_badge')[0];
  expect(op.key).toEqual({ badge_id: L.stamp_id });
  expect(Object.keys(op.data).sort()).toEqual(['content_version', 'earned_at', 'evidence']);
  expect(op.data.evidence).toMatchObject({ source: 'mastery_state', target_id: L.lecture_id, state: 'mastered' });
  expect(op.data.earned_at).toMatch(/\+09:00$/);
  expect(op.data.content_version).toBe(L.content_version);

  await notice.getByRole('link', { name: '보기' }).click();
  await expect(page).toHaveURL(/\/badges\/$/);
  await hydrated(page);
  const mine = page.locator(`[data-stamp="${L.stamp_id}"]`);
  await expect(mine).toHaveAttribute('aria-label', `${L.lecture_id.slice(1)}편 도장 받음`);
  await expect(mine).toHaveCSS('border-top-style', 'solid');
  await expect(mine).toHaveCSS('border-top-color', await tokenRgb(page, '--accent'));
  await expect(mine).toHaveCSS('background-color', await tokenRgb(page, '--accent-tint'));
  await expect(page.getByTestId('stamps').locator('[data-state="earned"]')).toHaveCount(1);
  // 단계 배지는 누적 점검 없이는 받지 못한다
  await expect(page.getByTestId('stage-badges').locator('[data-state="earned"]')).toHaveCount(0);
  await expect(page.getByTestId('badge-status-BADGE-S1')).toContainText(`${L.lecture_id.slice(1)}편 익힘`);
  await page.screenshot({ path: `test-results/screens/${info.project.name}_badges_stamp.png`, fullPage: true });

  // 다시 열어도 새로 쓰지 않고, 알림 줄도 다시 뜨지 않는다
  await page.reload();
  await hydrated(page);
  await expect(page.locator(`[data-stamp="${L.stamp_id}"]`)).toHaveAttribute('data-state', 'earned');
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('badge-notice')).toHaveCount(0);
  expect(api.opsFor('user_badge')).toHaveLength(1);
  expect(api.opsFor('user_badge').some((o) => o.key.badge_id.startsWith('BADGE-'))).toBe(false);
});

test('맛보기를 모두 직접 확인했으면 맨 위 "✓ 맛보기 완료"(배지 아닌 표시), user_badge TASTER-DONE 1행', async ({ page, api }) => {
  const T = (await manifest(page)).taster;
  api.serverTables = { taster_result: T.requires_steps.map((s: string) => ({ attempt_no: 1, step_id: s, self_reported: 'similar', at: AT, updated_at: AT })) };
  await openBadges(page);
  const mark = page.getByTestId('taste-mark');
  await expect(mark).toHaveAttribute('data-state', 'earned');
  await expect(mark.locator('.badge.ok')).toHaveText(TASTE_MARK.name_ko);
  await expect(mark).toContainText('배지가 아닌 완료 표시');
  await expect.poll(() => api.opsFor('user_badge').map((o) => o.key.badge_id)).toEqual([TASTE_MARK.badge_id]);
  expect(api.opsFor('user_badge')[0].data.evidence).toMatchObject({ source: 'taster_result', rule_id: TASTE_MARK.badge_id, attempt_no: 1 });
  // 맛보기 완료는 배지가 아니라 단계 배지(첫 셀 완주)는 그대로 아직
  await expect(page.locator('li[data-badge="BADGE-S0"]')).toHaveAttribute('data-state', 'todo');
});

test('서버가 계산해 둔 단계 배지(누적 점검 통과)는 받음 모양: accent 실선 원 + "11월 16일 받음"', async ({ page, api }) => {
  api.serverTables = { user_badge: [{ badge_id: 'BADGE-S1', earned_at: '2026-11-16T21:00:00+09:00', evidence: { source: 'checkpoint_attempt', checkpoint_id: 'CP1' }, updated_at: AT }] };
  await openBadges(page);
  const li = page.locator('li[data-badge="BADGE-S1"]');
  await expect(li).toHaveAttribute('data-state', 'earned');
  await expect(li.locator('.bmark')).toHaveCSS('border-top-style', 'solid');
  await expect(li.locator('.bmark')).toHaveCSS('background-color', await tokenRgb(page, '--accent-tint'));
  await expect(li.locator('.bmark')).toHaveAttribute('aria-label', '단계 1 배지 받음');
  await expect(page.getByTestId('badge-status-BADGE-S1')).toHaveText('11월 16일 받음');
  await page.waitForLoadState('networkidle');
  expect(api.opsFor('user_badge')).toEqual([]);
});
