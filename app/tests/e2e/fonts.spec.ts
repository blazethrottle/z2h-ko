// 글꼴 검사 (HANDOFF 4절, DESIGN.md 8절): 스크린샷이 아니라 document.fonts 상태, 요소별 computed 값, 파일 요청 200으로 판정.
import { test, expect, manifest } from './fixtures';

const FILES = ['Pretendard-Regular.woff2', 'Pretendard-Medium.woff2', 'Pretendard-SemiBold.woff2', 'Pretendard-Bold.woff2', 'JetBrainsMono-Variable.woff2'];

test('글꼴 5개 파일이 각각 200으로 오고 document.fonts가 모두 loaded', async ({ page, api }) => {
  const statuses = new Map<string, number>();
  page.on('response', (r) => {
    const name = r.url().split('/fonts/')[1];
    if (name) statuses.set(name, r.status());
  });
  const m = await manifest(page);
  const L = m.lectures[0];
  await page.goto(`/lectures/${L.lecture_id}/${L.steps[1].slug}/#practice`);
  await page.waitForFunction(() => document.fonts.status === 'loaded' && [...document.fonts].every((f) => f.status === 'loaded'));
  const faces = await page.evaluate(() => [...document.fonts].map((f) => `${f.family.replace(/"/g, '')} ${f.weight} ${f.status}`));
  expect(faces.sort()).toEqual(['JetBrains Mono 100 800 loaded', 'Pretendard 400 loaded', 'Pretendard 500 loaded', 'Pretendard 600 loaded', 'Pretendard 700 loaded']);
  for (const f of FILES) expect(statuses.get(f), f).toBe(200);
  for (const w of [400, 500, 600, 700]) expect(await page.evaluate((w) => document.fonts.check(`${w} 16px Pretendard`), w)).toBe(true);
  expect(api.externalRequests).toEqual([]);
});

test('굵기 400·500·600·700 요소의 computed font-weight와 글꼴, button·input·textarea·code 글꼴 지정', async ({ page, api }) => {
  const m = await manifest(page);
  const L = m.lectures[0];
  await page.goto(`/lectures/${L.lecture_id}/${L.steps[1].slug}/#practice`);
  const inputFamily = await page.getByLabel('내 예측').evaluate((el) => getComputedStyle(el).fontFamily);
  await page.getByTestId('dont-know').click();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  const probe = await page.evaluate(() => {
    const pick = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { weight: cs.fontWeight, family: cs.fontFamily };
    };
    return {
      body: pick('.cells .cell p'),
      caption: pick('.cap'),
      button: pick('button.btn'),
      title: pick('h1.t1'),
      code: pick('.cl-code code'),
      textarea: pick('textarea') ?? pick('input.input'),
      input: { weight: '', family: '' },
    };
  });
  expect(probe.body?.weight).toBe('400');
  expect(probe.caption?.weight).toBe('500');
  expect(probe.button?.weight).toBe('600');
  expect(probe.title?.weight).toBe('700');
  for (const k of ['body', 'caption', 'button', 'title'] as const) expect(probe[k]?.family, k).toMatch(/^"?Pretendard"?/);
  expect(inputFamily, 'input').toMatch(/^"?Pretendard"?/);
  expect(probe.code?.family).toMatch(/^"?JetBrains Mono"?/);
  expect(probe.textarea?.family).toMatch(/^"?(JetBrains Mono|Pretendard)"?/);
  expect(api.externalRequests).toEqual([]);
});
