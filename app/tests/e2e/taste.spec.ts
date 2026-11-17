// 30분 맛보기 (spec 13.2, P2): 단계 수는 manifest(콘텐츠)에서 읽는다. 가짜 서버(/api)는 fixtures.ts.
import fs from 'node:fs';
import path from 'node:path';
import { test, expect, hydrated, manifest } from './fixtures';
import { config } from '../../src/config';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import { codeFold } from '../../src/lib/taste';
import type { Page } from '@playwright/test';

const EM_DASH = String.fromCharCode(0x2014);
const OUT: Record<string, any> = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/taster_outputs.json'), 'utf8'));
const plain = (s: string) => s.replace(/`/g, '');

async function taster(page: Page) {
  const T = (await manifest(page)).taster;
  T.steps.sort((a: any, b: any) => a.order - b.order);
  return T;
}

async function confirmStep(page: Page, slug: string) {
  await page.goto(`/taste/${slug}/`);
  await hydrated(page);
  await page.getByTestId('taste-confirm').click();
}

test('맛보기: 첫 화면에서 시작해 모든 단계를 "직접 확인했어요"로 넘기면 맛보기 완료, taster_result 대기열로 간다', async ({ page, api }) => {
  test.setTimeout(120_000);
  const T = await taster(page);
  const steps = T.steps;
  await page.goto('/taste/');
  await hydrated(page);
  await expect(page.getByTestId('taste-steps').locator('li')).toHaveCount(steps.length);
  await expect(page.getByTestId('taste-summary')).toContainText(`${steps.length}단계 · 약 ${T.total_minutes}분`);
  await page.getByTestId('taste-start').click();
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    await expect(page).toHaveURL(new RegExp(`/taste/${s.slug}/$`));
    await expect(page.getByTestId('taste-position')).toContainText(`${s.order} / ${steps.length}`);
    await expect(page.locator('iframe')).toHaveCount(0);
    await hydrated(page);
    await page.getByTestId('taste-confirm').click();
    if (i < steps.length - 1) {
      await expect(page.getByTestId('taste-confirmed')).toBeVisible();
      await page.getByTestId('taste-next').click();
    }
  }
  await expect(page.getByTestId('taste-complete')).toHaveText('맛보기 완료');
  await expect(page.locator('h1')).toContainText('내 컴퓨터가 처음 보는 이름을 지어냈습니다');
  await expect(page.getByTestId('taste-all-confirmed')).toContainText(`${T.requires_steps.length}단계 모두 직접 확인함`);
  await expect(page.getByTestId('taste-next-paths').getByRole('link')).toHaveText(['진단 5문제 풀기', '00 사전 기초', /^01 /]);
  await expect(page.getByTestId('taste-signup-later')).toHaveText('가입은 준비 중입니다.');
  await expect
    .poll(() => [...new Set(api.opsFor('taster_result').filter((o) => o.data.self_reported === 'similar').map((o) => o.key.step_id))].sort())
    .toEqual([...T.requires_steps].sort());
  // 맛보기 완료 표시(배지 아님)는 user_badge TASTER-DONE 한 행
  await expect.poll(() => api.opsFor('user_badge').map((o) => o.key.badge_id)).toEqual(['TASTER-DONE']);
  for (const o of api.opsFor('taster_result')) {
    expect(o.key.attempt_no).toBe(config.taste.firstAttemptNo);
    expect(o.data.user_id).toBeUndefined();
    expect(o.data.at).toMatch(/\+09:00$/);
  }
  // 첫 화면은 이어서 하기 대신 확인한 단계를 보여 준다
  await page.goto('/taste/');
  await hydrated(page);
  await expect(page.getByTestId('taste-steps').locator('.st-done')).toHaveCount(steps.length);
  expect(api.embedUrls).toEqual([]);
});

test('"다르게 나왔어요"는 힌트 1단계를 열고 different 로 기록, 한 번 더 누르면 2단계를 열 수 있다 (점수 없음)', async ({ page, api }) => {
  const T = await taster(page);
  const s = T.steps.find((x: any) => x.kind === 'copy_run' && x.hint_levels.length >= 2);
  const hints = await (await page.request.get('/data/TASTER/hints.json')).json();
  await page.goto(`/taste/${s.slug}/`);
  await hydrated(page);
  expect(await page.content()).not.toContain(hints[s.step_id][0].text_ko);
  await expect(page.getByTestId('taste-hint-1')).toHaveCount(0);
  await page.getByTestId('taste-different').click();
  await expect(page.getByTestId('taste-hint-1')).toContainText(plain(hints[s.step_id][0].text_ko));
  await expect(page.getByTestId('taste-hint-1')).toContainText(`1단계 · ${hints[s.step_id][0].role_ko}`);
  await expect(page.getByTestId('taste-msg')).toContainText('힌트 1단계부터 열었습니다');
  await expect(page.getByTestId('taste-hint-locked-2')).toContainText('다르게 나왔어요');
  await page.getByTestId('taste-different').click();
  await page.getByTestId('taste-open-hint-2').click();
  await expect(page.getByTestId('taste-hint-2')).toContainText(plain(hints[s.step_id][1].text_ko));
  await expect(page.getByTestId(`taste-hints-${s.step_id}`)).toContainText('점수가 없습니다');
  await expect.poll(() => api.opsFor('taster_result').some((o) => o.key.step_id === s.step_id && o.data.self_reported === 'different')).toBe(true);
  // 다시 확인하면 similar 로 바뀐다
  await page.getByTestId('taste-confirm').click();
  await expect(page.getByTestId('taste-confirmed')).toBeVisible();
  await expect.poll(() => api.opsFor('taster_result').filter((o) => o.key.step_id === s.step_id).pop()?.data.self_reported).toBe('similar');
});

test('확인 질문: 고르는 즉시 풀이, 제출 단추 없음, 고르기 전에는 풀이가 화면에 없음, 기록·점수 없음', async ({ page, api }) => {
  const T = await taster(page);
  const answers = await (await page.request.get('/data/TASTER/answers.json')).json();
  expect(T.questions.length).toBeGreaterThan(0);
  for (const q of T.questions) {
    const s = T.steps.find((x: any) => x.step_id === q.after_step);
    await page.goto(`/taste/${s.slug}/`);
    await hydrated(page);
    const card = page.getByTestId(`taste-q-${q.question_id}`);
    await expect(card).toContainText('확인 질문 · 점수 없음');
    await expect(card).toContainText('안 풀어도 완료에 지장이 없습니다');
    await expect(card.getByRole('button', { name: /제출/ })).toHaveCount(0);
    await expect(card.getByRole('radio')).toHaveCount(q.choices);
    const a = answers[q.question_id];
    expect(await page.content()).not.toContain(a.answer_ko);
    await card.getByRole('radio').nth(a.answer_index).click();
    const box = card.getByTestId(`taste-answer-${q.question_id}`);
    await expect(box).toContainText(plain(a.answer_ko));
    await expect(box).toContainText('맞음');
    const wrong = a.answer_index === 0 ? 1 : 0;
    await card.getByRole('radio').nth(wrong).click();
    await expect(box).toContainText(`답: ${a.answer_index + 1}번`);
  }
  await page.waitForLoadState('networkidle');
  expect(api.opsFor('question_attempt')).toEqual([]);
});

test('끝 화면: 이름 카드는 앞 단계 확인 뒤 열리고, 붙여 넣은 이름(10줄·20글자 정리)과 손실이 taster_result 대기열로 간다', async ({ page, api }, info) => {
  test.setTimeout(120_000);
  const T = await taster(page);
  const last = T.steps[T.steps.length - 1];
  // 확인 전: 잠김, 맛보기 완료 표시 없음
  await page.goto(`/taste/${last.slug}/`);
  await hydrated(page);
  await expect(page.getByTestId('taste-names-locked')).toBeVisible();
  await expect(page.getByTestId('taste-complete')).toHaveCount(0);
  await expect(page.getByTestId('taste-missing').locator('li')).toHaveCount(T.steps.length - 1);

  for (const s of T.steps.slice(0, -1)) {
    await confirmStep(page, s.slug);
    await expect(page.getByTestId('taste-confirmed')).toBeVisible();
  }
  await page.goto(`/taste/${last.slug}/`);
  await hydrated(page);
  const card = page.getByTestId('taste-names-card');
  await expect(card).toContainText('첫 모델이라 아직 서툴러요');
  await expect(card).toContainText('이름, 주소, 전화번호 같은 개인 정보는 넣지 마세요');
  await expect(card.getByTestId('taste-card-after-save')).toContainText('이름을 저장하면 이름 카드를 만들 수 있습니다');
  await expect(card.getByTestId('taste-make-card')).toHaveCount(0);
  await expect(card.getByTestId('taste-names')).toHaveCSS('font-family', /JetBrains Mono/);

  const ten: string[] = OUT[T.artifact_unlock_after].trim().split('\n');
  const long = 'abcdefghijklmnopqrstuvwxyz';
  await card.getByTestId('taste-names').fill([long, ...ten, 'extra'].join('\n'));
  await expect(card.getByTestId('taste-names-flag')).toContainText('모델 출력만 넣어 주세요');
  await card.getByTestId('taste-loss-start').fill('약 3.8');
  await card.getByTestId('taste-save-names').click();
  await expect(card.getByTestId('taste-names-result')).toContainText('숫자만');
  await card.getByTestId('taste-loss-start').fill('3.839');
  await card.getByTestId('taste-loss-end').fill('2.472');
  await card.getByTestId('taste-save-names').click();
  await expect(card.getByTestId('taste-names-result')).toContainText(`이름 ${config.taste.maxNames}개`);
  // 20글자 넘는 줄은 자르지 않고 뺀다(P2 검수 권고 2)
  const want = ten.slice(0, config.taste.maxNames).join('\n');
  await expect(card.getByTestId('taste-names-saved')).toHaveText(want);
  await expect(card.getByTestId('taste-make-card')).toHaveText('이름 카드 만들기');
  await expect(card.getByTestId('taste-make-card')).toHaveAttribute('href', '/share/?card=ART-TASTER');
  await expect
    .poll(() => {
      const o = api.opsFor('taster_result').filter((x) => x.key.step_id === T.artifact_unlock_after && x.data.pasted_names_text != null).pop();
      return o ? [o.data.pasted_names_text, o.data.pasted_loss_start, o.data.pasted_loss_end, o.data.self_reported] : null;
    })
    .toEqual([want, 3.839, 2.472, 'similar']);

  // 마지막 단계까지 확인하면 맛보기 완료
  await page.getByTestId('taste-confirm').click();
  await expect(page.getByTestId('taste-complete')).toBeVisible();
  // 다시 열면 저장한 값이 칸에 남아 있다
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId('taste-names')).toHaveValue(want);
  await expect(page.getByTestId('taste-loss-end')).toHaveValue('2.472');
  await page.screenshot({ path: `test-results/screens/${info.project.name}_taste_done_complete.png`, fullPage: true });
});

test('미리 계산한 결과: 교사 실행 출력만, 손실 그림 데이터 = taster_outputs.json, 완료로 기록하지 않음', async ({ page, api }, info) => {
  const T = await taster(page);
  await page.goto('/taste/');
  await page.getByTestId('taste-precomputed-link').click();
  await expect(page).toHaveURL(/\/taste\/precomputed\/$/);
  await expect(page.locator('h1')).toHaveText('미리 계산한 결과 보기');
  await expect(page.getByTestId('precomputed-note')).toHaveText('교사가 실제로 실행한 결과입니다(2026-11-16, PyTorch CPU). 직접 실행하면 숫자가 조금 다를 수 있습니다.');
  for (const [k, v] of Object.entries(OUT)) {
    if (k.startsWith('_')) continue;
    const sec = page.getByTestId(`precomputed-${k}`);
    await expect(sec).toBeVisible();
    const lines = String(v).replace(/\n+$/, '').split('\n');
    const list = sec.getByTestId(`names-${k}`);
    if (await list.count()) await expect(list.locator('li')).toHaveText(lines);
    else await expect(sec.getByTestId(`out-${k}`)).toHaveText(lines.join('\n'));
  }
  const names = page.locator('[data-testid^="names-"]');
  await expect(names).toHaveCount(2);
  const pts = JSON.parse((await page.getByTestId('loss-chart').getAttribute('data-points')) ?? '[]');
  expect(pts).toEqual(String(OUT['T-S06']).trim().split('\n').map((l) => l.split(' ').map(Number)));
  await expect(page.locator('svg.chart circle')).toHaveCount(pts.length);
  await expect(page.locator('svg.chart polyline')).toHaveCount(1);
  await page.screenshot({ path: `test-results/screens/${info.project.name}_taste_precomputed.png`, fullPage: true });
  await page.waitForLoadState('networkidle');
  expect(api.opsFor('taster_result')).toEqual([]);
  expect(T.steps.length).toBeGreaterThan(0);
});

test('첫 단계: Colab 바로 열기 주소가 없으면 버튼을 숨기고 받기 + 올리기 안내, 미리 계산 화면 링크', async ({ page, api }) => {
  const T = await taster(page);
  await page.goto(`/taste/${T.steps[0].slug}/`);
  await hydrated(page);
  const nb = page.getByTestId('taste-notebook');
  expect(config.taste.colabOpenUrl).toBeNull();
  await expect(nb.getByTestId('taste-colab-open')).toHaveCount(0);
  await expect(nb).toContainText('colab.research.google.com');
  await expect(nb).toContainText('Colab은 Google 로그인이 필요할 수 있습니다.');
  // 정본 문구는 그대로 두고 그 아래 앱 문구 한 줄 (P2 검수 권고)
  const tsteps = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/taster.json'), 'utf8')).steps;
  await expect(page.locator('main header')).toContainText(plain(tsteps[0].input_ko));
  await expect(page.getByTestId('taste-open-note')).toHaveText('지금은 노트북을 받아 Colab에 올려서 엽니다(아래 안내).');
  await expect(nb.getByTestId('taste-precomputed-link')).toHaveAttribute('href', '/taste/precomputed/');
  if (T.notebook_available) {
    const href = await nb.getByTestId('taste-notebook-download').getAttribute('href');
    expect(href).toBe('/notebooks/taster/taster.ipynb');
    const r = await page.request.get(href!);
    expect(r.status()).toBe(200);
    expect(JSON.parse(await r.text())).toHaveProperty('cells');
  } else {
    await expect(nb.getByTestId('taste-notebook-pending')).toHaveText('노트북 준비 중');
  }
});

test('긴 셀은 앞부분을 접고 펼칠 수 있다, 줄별 풀이는 펼친 채, 복사는 셀 전체', async ({ page, api }) => {
  const T = await taster(page);
  const longest = [...T.steps].sort((a: any, b: any) => b.cell_code_lines - a.cell_code_lines)[0];
  test.skip(codeFold(longest.cell_code_lines) === 0, '긴 셀이 없음');
  await page.goto(`/taste/${longest.slug}/`);
  await hydrated(page);
  const code = page.getByTestId('taste-code');
  const fold = code.getByTestId('taste-fold');
  const rows = code.getByTestId('taste-code-lines').locator('.cl-row');
  const before = await rows.count();
  await expect(fold).toHaveText(`앞부분 ${config.taste.foldHeadLines}줄 보기`);
  await fold.click();
  await expect(rows).toHaveCount(before + config.taste.foldHeadLines);
  await expect(code.locator('.cl-note').first()).toBeVisible();
  await code.getByRole('button', { name: /복사/ }).first().click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip.split('\n')).toHaveLength(before + config.taste.foldHeadLines);
});

test('맛보기 화면: 누르는 곳 44px, 긴 줄표 0, keep-all, 가로 넘침 없음, 영상 iframe 0', async ({ page, api }, info) => {
  test.setTimeout(120_000);
  const T = await taster(page);
  for (const p of ['/taste/', ...T.steps.map((s: any) => `/taste/${s.slug}/`), '/taste/precomputed/']) {
    await page.goto(p);
    await hydrated(page);
    await page.waitForLoadState('networkidle');
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('button, a.btn, .chip, .iconbtn, .opt, a.lrow, summary')]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => ({ t: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), r: el.getBoundingClientRect() }))
        .filter((x) => x.r.height < 44 || x.r.width < 44)
        .map((x) => `${x.t} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`),
    );
    expect(small, p).toEqual([]);
    expect(await page.evaluate((em) => document.body.innerText.includes(em), EM_DASH), p).toBe(false);
    expect(await page.evaluate(() => getComputedStyle(document.body).wordBreak)).toBe('keep-all');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.screenshot({ path: `test-results/screens/${info.project.name}_taste${p.replace(/\//g, '_')}.png`, fullPage: true });
  }
  expect(api.embedUrls).toEqual([]);
});

test('계정이 없는 첫 실행(서버 꺼짐)에도 이 기기에 먼저 저장하고, 계정이 생기면 올린다 (P1 방식)', async ({ page, api }) => {
  const T = await taster(page);
  const s = T.steps[1];
  api.mode = 'down';
  await page.goto(`/taste/${s.slug}/`);
  await hydrated(page);
  await page.getByTestId('taste-confirm').click();
  await expect(page.getByTestId('taste-confirmed')).toBeVisible();
  expect(api.opsFor('taster_result')).toEqual([]);
  expect(api.accounts).toHaveLength(0);
  api.mode = 'up';
  await page.reload();
  await hydrated(page);
  await expect.poll(() => api.opsFor('taster_result').map((o) => [o.key.step_id, o.data.self_reported])).toContainEqual([s.step_id, 'similar']);
  expect(api.accounts).toHaveLength(1);
  await expect(page.getByTestId('taste-confirmed')).toBeVisible();
});

test('이름 붙여 넣기 안전: 한글·전화번호·이메일·대문자·20글자 넘는 줄은 저장·카드에서 빠지고, 남은 이름이 0개면 저장하지 않는다', async ({ page, api }) => {
  test.setTimeout(120_000);
  const T = await taster(page);
  const last = T.steps[T.steps.length - 1];
  // 앞 단계 확인은 서버에 이미 있는 기록으로 둔다(다른 기기에서 확인한 것처럼)
  const at = '2026-11-16T09:00:00.000+09:00';
  api.serverTables = { taster_result: T.steps.slice(0, -1).map((s: any) => ({ attempt_no: 1, step_id: s.step_id, self_reported: 'similar', at, updated_at: at })) };
  await page.goto(`/taste/${last.slug}/`);
  await hydrated(page);
  const card = page.getByTestId('taste-names-card');
  await card.getByTestId('taste-names').fill(['홍길동', '010-1234-5678', 'me@mail.example'].join('\n'));
  await expect(card.getByTestId('taste-names-flag')).toContainText('1, 2, 3번째 줄');
  await expect(card.getByTestId('taste-names-none')).toContainText('남은 이름이 없습니다');
  await card.getByTestId('taste-save-names').click();
  await expect(card.getByTestId('taste-names-result')).toContainText('저장하지 않았습니다');
  await page.waitForLoadState('networkidle');
  expect(api.opsFor('taster_result').some((o) => o.data.pasted_names_text != null)).toBe(false);

  await card.getByTestId('taste-names').fill(['gsli', '홍길동', 'Kenah', 'abcdefghijklmnopqrstu', 'di', 'me@mail.example'].join('\n'));
  await expect(card.getByTestId('taste-names-flag')).toContainText('2, 3, 4, 6번째 줄');
  await card.getByTestId('taste-save-names').click();
  await expect(card.getByTestId('taste-names-saved')).toHaveText('gsli\ndi');
  await expect
    .poll(() => api.opsFor('taster_result').filter((o) => o.data.pasted_names_text != null).pop()?.data.pasted_names_text)
    .toBe('gsli\ndi');
  for (const o of api.opsFor('taster_result')) expect(JSON.stringify(o.data)).not.toMatch(/홍길동|010-|mail\.example|Kenah/);
});

test('단계 화면 아래 코드 출처 한 줄: 맛보기는 makemore·nn-zero-to-hero, 1편은 micrograd·nn-zero-to-hero (MIT)', async ({ page, api }) => {
  const m = await manifest(page);
  const T = m.taster;
  await page.goto(`/taste/${T.steps[1].slug}/`);
  const tc = page.getByTestId('code-credit');
  await expect(tc).toContainText('이 코드는 Andrej Karpathy의 makemore와 nn-zero-to-hero(MIT 라이선스)를 따라 만든 것입니다');
  await expect(tc.getByRole('link')).toHaveCount(2);
  await expect(tc.getByRole('link').first()).toHaveAttribute('href', 'https://github.com/karpathy/makemore');
  const L = m.lectures[0];
  await page.goto(`/lectures/${L.lecture_id}/${L.steps[0].slug}/`);
  const lc = page.getByTestId('code-credit');
  await expect(lc).toContainText('이 코드는 Andrej Karpathy의 micrograd와 nn-zero-to-hero(MIT 라이선스)를 따라 만든 것입니다');
  await expect(lc.getByRole('link').first()).toHaveAttribute('href', 'https://github.com/karpathy/micrograd');
  await expect(lc.getByRole('link').nth(1)).toHaveAttribute('href', 'https://github.com/karpathy/nn-zero-to-hero');
  for (const a of await lc.getByRole('link').all()) await expect(a).toHaveAttribute('rel', /noopener/);
});
