// 공유 카드 (spec 13.5, D32·D42·D45·D54·D56, P3): canvas 로 그린 PNG 1200x675 내려받기, 카드 글은 모델 출력과 고정 문구뿐,
// "X에 공유"는 x.com/intent 주소만 새 창으로(실제 요청은 가로채 바깥으로 나가지 않음), share_card 는 private 로 대기열에.
import fs from 'node:fs';
import path from 'node:path';
import { test, expect, hydrated, manifest } from './fixtures';
import { config } from '../../src/config';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import { CARD_INPUT_KEYS } from '../../src/lib/share-card';
import type { Page } from '@playwright/test';

const AT = '2026-11-16T09:00:00.000+09:00';
const EM_DASH = String.fromCharCode(0x2014);
const OUT: Record<string, any> = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/taster_outputs.json'), 'utf8'));
const TASTER = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/taster.json'), 'utf8'));
const L01 = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/L01.json'), 'utf8'));
const NAMES: string[] = String(OUT['T-S07']).trim().split('\n');
/** 계정 이름에 실명·이메일처럼 보이는 글을 넣어 두고, 카드에 들어가지 않는지 본다 */
const SECRET_NAME = '홍길동 me@mail.example';

/** canvas 에 그린 글자를 모두 모은다(카드에 들어가는 글 검사용) */
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
const drawnText = (page: Page) => page.evaluate(() => (window as any).__drawn as string[]);

/** PNG 머리(IHDR)에서 폭·높이 */
function pngSize(file: string) {
  const b = fs.readFileSync(file);
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function useSecretAccount(api: any) {
  api.accounts = [{ user_id: 'u-9-0000-4000-8000-000000000000', display_name: SECRET_NAME }];
  api.current = api.accounts[0].user_id;
}

function tasterRows(T: any, opts: { names?: string; complete?: boolean } = {}) {
  const steps: string[] = opts.complete === false ? T.requires_steps.filter((s: string) => s !== T.requires_steps[T.requires_steps.length - 1]) : T.requires_steps;
  return steps.map((s) => ({
    attempt_no: 1,
    step_id: s,
    self_reported: 'similar',
    at: AT,
    updated_at: AT,
    ...(s === T.artifact_unlock_after ? { pasted_names_text: opts.names ?? NAMES.join('\n'), pasted_loss_start: 3.839, pasted_loss_end: 2.472 } : {}),
  }));
}

async function waitDrawn(page: Page) {
  await expect(page.getByTestId('card-view')).toHaveAttribute('data-drawn', 'true');
}

test('이름 카드: 붙여 넣은 이름으로 1200x675 카드, 글은 모델 출력과 고정 문구뿐, 계정 이름·이메일 없음, share_card private 1행', async ({ page, api }, info) => {
  const T = (await manifest(page)).taster;
  useSecretAccount(api);
  api.serverTables = { taster_result: tasterRows(T) };
  await recordCanvasText(page);
  await page.goto('/share/?card=ART-TASTER');
  await hydrated(page);
  await waitDrawn(page);
  const canvas = page.getByTestId('card-canvas');
  await expect(canvas).toHaveAttribute('width', String(config.shareCard.width));
  await expect(canvas).toHaveAttribute('height', String(config.shareCard.height));

  // 카드 글: 정본 제목·이름·"첫 모델이라 아직 서툴러요"·출처(비공식)·실제 이름 안내
  const cf = TASTER.lecture.artifact.card_fields;
  const text = page.getByTestId('card-text');
  await expect(text).toContainText(cf.title_ko);
  await expect(text).toContainText('맛보기 완료 · 손실 3.839 → 2.472');
  for (const n of NAMES) await expect(text).toContainText(n);
  await expect(text).toContainText(cf.humble_line_ko);
  await expect(text).toContainText(`${cf.credit_ko} (비공식)`);
  await expect(text).toContainText(cf.disclaimer_ko.replace(/\.$/, ''));
  const drawn = await drawnText(page);
  expect(drawn.length).toBeGreaterThan(NAMES.length);
  const allowed = [cf.title_ko, '맛보기 완료 · 손실 3.839 → 2.472', '내 모델 출력', cf.humble_line_ko, config.shareCard.appName, `${cf.credit_ko} (비공식) · ${cf.disclaimer_ko.replace(/\.$/, '')}`].join('\n');
  for (const s of drawn) {
    expect(/^[a-z]+…?$/.test(s) || allowed.includes(s), `카드에 그린 글: ${s}`).toBe(true);
    expect(s).not.toMatch(/홍길동|@|mail|개발용|u-9/);
  }

  // 기록: share_card private, image_path 비움, payload 는 화이트리스트 열쇠만, taster_result.share_card_id 연결
  await expect.poll(() => api.opsFor('share_card').length).toBe(1);
  const sc = api.opsFor('share_card')[0];
  expect(sc.key.share_id).toMatch(/^[0-9a-f]{32}$/);
  expect(sc.data).toMatchObject({ kind: 'ART-TASTER', visibility: 'private' });
  // 서버가 모르는 새 행이라 빈 칸(null)은 싣지 않는다: 서버가 새 행의 빈 칸으로 둔다(store.ts unknownRowData, 실서버 확인은 badges-share-real.spec.ts)
  expect(sc.data).not.toHaveProperty('image_path');
  expect(sc.data).not.toHaveProperty('revoked_at');
  expect(Object.keys(sc.data.payload)).toEqual([...CARD_INPUT_KEYS['ART-TASTER']]);
  expect(sc.data.payload).toEqual({ kind: 'ART-TASTER', names: NAMES, loss_start: 3.839, loss_end: 2.472, taste_complete: true });
  expect(JSON.stringify(sc.data)).not.toMatch(/홍길동|mail\.example/);
  await expect
    .poll(() => api.opsFor('taster_result').find((o) => o.key.step_id === T.artifact_unlock_after && o.data.share_card_id)?.data.share_card_id)
    .toBe(sc.key.share_id);

  // 이미지 저장: PNG 를 내 기기로만(다운로드 이벤트), 1200x675
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-image').click()]);
  expect(dl.suggestedFilename()).toBe('z2h-art-taster.png');
  const file = path.join(info.outputDir, 'card.png');
  await dl.saveAs(file);
  expect(pngSize(file)).toEqual({ width: config.shareCard.width, height: config.shareCard.height });
  await expect(page.getByTestId('share-msg')).toContainText('서버에 올리지 않습니다');

  // 글 복사: 사실 문장, 개인 정보 없음
  await page.getByTestId('copy-text').click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('Z2H에서 맛보기를 마쳤습니다.');
  expect(clip).toContain(NAMES.join(', '));
  expect(clip).not.toMatch(/홍길동|@/);

  // 다시 열어도 같은 카드면 새 행을 만들지 않는다
  await page.reload();
  await hydrated(page);
  await waitDrawn(page);
  await page.waitForLoadState('networkidle');
  expect(api.opsFor('share_card')).toHaveLength(1);
  await page.screenshot({ path: `test-results/screens/${info.project.name}_share_taster.png`, fullPage: true });
  // 카드 그림만 따로 (디자이너 검수용)
  fs.copyFileSync(file, `test-results/screens/${info.project.name}_card_taster.png`);
});

test('"X에 공유": 새 창으로 x.com/intent/post?text=(정본 미리 채운 글)만 연다. 자동 게시 매개변수 없음, 실제 요청은 가로챈다', async ({ page, api, context }) => {
  const T = (await manifest(page)).taster;
  api.serverTables = { taster_result: tasterRows(T) };
  const xHits: string[] = [];
  await context.route(/^https:\/\/(?:x|twitter)\.com\//, (route) => {
    xHits.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>x</title>' });
  });
  await page.goto('/share/?card=ART-TASTER');
  await hydrated(page);
  await waitDrawn(page);
  const x = page.getByTestId('share-x');
  await expect(x).toHaveAttribute('target', '_blank');
  await expect(x).toHaveAttribute('rel', /noopener/);
  await expect(x).toHaveAttribute('aria-describedby', 'x-attach');
  await expect(page.locator('#x-attach')).toHaveText('저장한 이미지를 첨부해 주세요');
  await expect(page.getByText('X 글쓰기 창에는 이미지가 자동으로 붙지 않습니다.')).toBeVisible();
  await expect(page.getByText('X에 공유를 누르면 X의 글쓰기 창이 열리고, 올리기는 내가 직접 누릅니다. 이 앱은 자동으로 올리지 않습니다.')).toBeVisible();
  await expect(page.getByTestId('share-privacy')).toHaveText('카드에는 모델이 만든 결과물과 학습 숫자만 들어갑니다. 이메일, 실명, 기기 정보, 학습 시간은 넣지 않습니다.');
  const href = (await x.getAttribute('href'))!;
  const u = new URL(href);
  expect(`${u.origin}${u.pathname}`).toBe('https://x.com/intent/post');
  expect([...u.searchParams.keys()]).toEqual(['text']);
  expect(u.searchParams.get('text')).toBe(TASTER.lecture.artifact.x_compose.prefill_ko);
  const [popup] = await Promise.all([page.waitForEvent('popup'), x.click()]);
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  expect(xHits).toEqual([href]);
  await popup.close();
  // 이 앱은 x.com 으로 다른 요청(게시 API 등)을 보내지 않았다
  expect(api.externalRequests).toEqual([]);
});

test('이름 카드: 이름이 없으면 카드 대신 맛보기 끝 화면 안내, 버튼은 잠김', async ({ page, api }) => {
  const T = (await manifest(page)).taster;
  api.serverTables = { taster_result: tasterRows(T, { names: '홍길동\n010-1234-5678' }) };
  await page.goto('/share/');
  await hydrated(page);
  await expect(page.getByTestId('share-taster')).toBeVisible();
  await expect(page.getByTestId('card-need-input')).toContainText('모델 출력만 넣어 주세요');
  await expect(page.getByTestId('card-canvas')).toHaveCount(0);
  await expect(page.getByTestId('save-image')).toBeDisabled();
  await expect(page.getByTestId('copy-text')).toBeDisabled();
  await expect(page.getByTestId('share-x')).toBeDisabled();
  await expect(page.locator('#x-attach')).toHaveText('저장한 이미지를 첨부해 주세요');
  const last = T.steps.sort((a: any, b: any) => a.order - b.order)[T.steps.length - 1];
  await expect(page.getByTestId('to-names')).toHaveAttribute('href', `/taste/${last.slug}/#names-h`);
  await page.waitForLoadState('networkidle');
  expect(api.opsFor('share_card')).toEqual([]);
});

test('정본 01편에 공유 결과물(rewards.artifact)이 없으면 01편 카드를 지어내지 않는다: 공유 화면은 맛보기 카드만, 개요에 카드 칸 없음', async ({ page, api }) => {
  test.skip(!!L01.lecture.rewards?.artifact, '정본 L01 에 rewards.artifact 가 있음');
  const m = await manifest(page);
  const L = m.lectures[0];
  await page.goto('/share/?card=ART-L01');
  await hydrated(page);
  await expect(page.getByTestId('card-kinds').locator('a')).toHaveCount(1);
  await expect(page.getByTestId('share')).toHaveAttribute('data-kind', 'ART-TASTER');
  await expect(page.getByTestId('share-l01')).toHaveCount(0);
  await expect(page.getByText('자료 대기')).toHaveCount(0);
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  await expect(page.getByTestId('artifact')).toHaveCount(0);
  await expect(page.getByTestId('make-l01-card')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(api.opsFor('share_card')).toEqual([]);
});

test('학습 기록 카드(01편): 정본 artifact.unlock 단계를 마치기 전에는 잠김 (공유 화면·개요 둘 다)', async ({ page, api }) => {
  test.skip(!L01.lecture.rewards?.artifact, '정본 L01 에 rewards.artifact 없음(클로드 버전): 위 테스트가 카드가 없는 것을 확인');
  const m = await manifest(page);
  const L = m.lectures[0];
  const unlock = String(L01.lecture.rewards.artifact.unlock).match(/L\d{2}-S\w+/)![0];
  const unlockStep = L.steps.find((s: any) => s.step_id === unlock);
  await page.goto('/share/?card=ART-L01');
  await hydrated(page);
  await expect(page.getByTestId('share')).toHaveAttribute('data-kind', 'ART-L01');
  await expect(page.getByTestId('card-locked')).toContainText(`단계 ${unlockStep.order}`);
  await expect(page.getByTestId('loss-paste')).toHaveCount(0);
  await expect(page.getByTestId('save-image')).toBeDisabled();
  await expect(page.getByTestId('share-x')).toBeDisabled();
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  await expect(page.getByTestId('artifact-locked')).toContainText(`단계 ${unlockStep.order}`);
  await expect(page.getByTestId('make-l01-card')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(api.opsFor('share_card')).toEqual([]);
});

test('학습 기록 카드(01편): 정본 artifact.unlock 단계를 마친 뒤 개요에 링크, 붙여 넣은 손실 줄만으로 꺾은선, 숫자 못 읽으면 안내, PNG 1200x675', async ({ page, api }, info) => {
  test.skip(!L01.lecture.rewards?.artifact, '정본 L01 에 rewards.artifact 없음(클로드 버전)');
  const m = await manifest(page);
  const L = m.lectures[0];
  const unlock = String(L01.lecture.rewards.artifact.unlock).match(/L\d{2}-S\w+/)![0];
  api.serverTables = { step_progress: [{ step_id: unlock, path_id: 'full', status: 'done', done_at: AT, updated_at: AT }] };
  await page.goto(`/lectures/${L.lecture_id}/`);
  await hydrated(page);
  const link = page.getByTestId('make-l01-card');
  await expect(link).toHaveText('학습 기록 카드 만들기');
  await expect(link).toHaveAttribute('href', `/share/?card=${L.artifact_id}`);
  await link.click();
  await expect(page).toHaveURL(/\/share\/\?card=ART-L01$/);
  await hydrated(page);
  const paste = page.getByTestId('loss-paste');
  await paste.fill('홍길동\nhello world');
  await page.getByTestId('make-card').click();
  await expect(page.getByTestId('card-msg')).toContainText('숫자를 읽지 못했습니다');
  await expect(page.getByTestId('card-canvas')).toHaveCount(0);

  const losses = Array.from({ length: 20 }, (_, k) => Number((4.8 / (k + 1) ** 1.5).toFixed(6)));
  await paste.fill(['Value(data=1.0)', ...losses.map((v, k) => `${k} ${v}`)].join('\n'));
  await page.getByTestId('make-card').click();
  await expect(page.getByTestId('card-msg')).toContainText('손실 20줄을 읽었습니다. 번호와 손실이 아닌 1줄은 뺐습니다.');
  await waitDrawn(page);
  const art = L01.lecture.rewards.artifact;
  await expect(page.getByTestId('card-text')).toContainText(art.name_ko);
  await expect(page.getByTestId('card-text')).toContainText(`손실 ${losses[0]} → ${losses[19]}`);
  await expect(page.getByTestId('card-text')).toContainText('Andrej Karpathy의 공개 강의 micrograd를 따라 만든 결과 (비공식)');
  await expect.poll(() => api.opsFor('share_card').length).toBe(1);
  const sc = api.opsFor('share_card')[0];
  expect(sc.data).toMatchObject({ kind: 'ART-L01', visibility: 'private', image_path: null });
  expect(sc.data.payload).toEqual({ kind: 'ART-L01', losses });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-image').click()]);
  const file = path.join(info.outputDir, 'l01.png');
  await dl.saveAs(file);
  expect(pngSize(file)).toEqual({ width: config.shareCard.width, height: config.shareCard.height });
  const u = new URL((await page.getByTestId('share-x').getAttribute('href'))!);
  expect([...u.searchParams.keys()]).toEqual(['text']);
  expect(u.searchParams.get('text')).toBe(art.x_compose.prefill_ko);
  // 다시 열면 저장한 카드가 그대로 보인다(새 행 없음)
  await page.reload();
  await hydrated(page);
  await waitDrawn(page);
  await page.waitForLoadState('networkidle');
  expect(api.opsFor('share_card')).toHaveLength(1);
  await page.screenshot({ path: `test-results/screens/${info.project.name}_share_l01.png`, fullPage: true });
  fs.copyFileSync(file, `test-results/screens/${info.project.name}_card_l01.png`);
});

test('배지·공유 화면: 누르는 곳 44px, 긴 줄표 0, keep-all, 가로 넘침 없음', async ({ page, api }) => {
  const T = (await manifest(page)).taster;
  api.serverTables = { taster_result: tasterRows(T) };
  for (const p of ['/badges/', '/share/?card=ART-TASTER', '/share/?card=ART-L01']) {
    await page.goto(p);
    await hydrated(page);
    if (p.includes('TASTER')) await waitDrawn(page);
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
  }
});
