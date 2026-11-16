// 실제 진도 서버(server/, python -m z2h_server)와 함께 도는 통합 검사.
// 서버는 테스트가 직접 켜고 끈다(임시 DB, 포트 8797, 127.0.0.1). 저장소 server/ 폴더에는 아무것도 쓰지 않는다.
// 실행: npm run build 뒤 npm run test:real
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/real',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/real',
  use: { baseURL: 'http://127.0.0.1:8797', trace: 'retain-on-failure', locale: 'ko-KR', timezoneId: 'Asia/Seoul' },
  projects: [
    { name: 'mobile-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
});
