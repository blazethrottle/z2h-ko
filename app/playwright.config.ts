// 자동 브라우저 검사: 390px(폰)·1280px(맥) 두 폭. 빌드된 app/dist 를 astro preview(127.0.0.1)로 연다.
// /api 는 테스트 안의 가짜 서버(tests/e2e/fixtures.ts)가 받는다.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL: 'http://127.0.0.1:4329',
    trace: 'retain-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },
  projects: [
    { name: 'mobile-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    // --ignore-lock: Astro 7은 자동 실행 환경에서 preview를 뒤로 돌리는데, 테스트는 앞에서 돌아야 끝날 때 함께 꺼진다
    command: 'ASTRO_TELEMETRY_DISABLED=1 npx astro preview --host 127.0.0.1 --port 4329 --ignore-lock',
    url: 'http://127.0.0.1:4329/home/',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
