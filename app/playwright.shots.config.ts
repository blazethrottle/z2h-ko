// PR 스크린샷 전용(npm run shots:p7). 자동 브라우저 검사(playwright.config.ts)와 같은 두 폭·같은 가짜 서버를 쓰고 tests/shots 만 돈다.
// 판정은 tests/e2e 가 하고, 여기서는 docs/screenshots/ 에 PNG 만 남긴다. npm run build 뒤에 돌린다.
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({ ...base, testDir: 'tests/shots', outputDir: 'test-results/shots' });
