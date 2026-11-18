// node 쪽 주소·포트 한 곳: dev 프록시(astro.config.mjs), 자동 브라우저 검사(playwright*.config.ts, tests/real).
// 브라우저 코드는 이 값을 쓰지 않고 같은 출처의 상대 주소(src/config.ts config.api.base)를 쓴다.
// package.json 의 dev·preview 스크립트에는 포트 숫자가 글로 들어 있다(JSON 이라 여기서 읽지 못함). 포트를 바꾸면 그 두 줄도 같이 바꾼다.

/** 이 기기 안에서만 여는 주소. 서버·dev·preview 는 모두 여기에만 붙는다(공개 포트 개방 금지) */
export const LOCAL_HOST = '127.0.0.1';
/** 진도 서버 주소. dev 프록시와 문서가 이 값 하나를 본다 */
export const API_TARGET = `http://${LOCAL_HOST}:8787`;

/** dev 서버(astro dev) 포트. astro.config.mjs 의 server.port 와 package.json 의 dev 스크립트가 같은 값 */
export const DEV_PORT = 4321;
/** 빌드 결과 미리 보기(astro preview) 포트. 자동 브라우저 검사가 연다. package.json 의 preview 스크립트와 같은 값 */
export const PREVIEW_PORT = 4329;
/** 실서버 통합 검사(npm run test:real)가 켜는 진도 서버 포트(임시 DB) */
export const REAL_TEST_PORT = 8797;
/** 실서버 멈춤 검사(tests/real/sync-stall.spec.ts)가 진도 서버 앞에 켜는 중계기 포트 */
export const REAL_TEST_PROXY_PORT = 8798;
/** dev 서버 자기 주소. 이 Origin 에서 온 쓰기 요청만 프록시가 서버 주소로 바꿔 넘긴다 */
export const DEV_ORIGINS = [`http://127.0.0.1:${DEV_PORT}`, `http://localhost:${DEV_PORT}`];

/**
 * dev 프록시가 진도 서버로 넘길 Origin.
 * dev 서버 자기 주소에서 온 것만 서버 주소로 바꾸고, 다른 사이트의 Origin 은 그대로 넘겨 서버가 거부(403)하게 둔다.
 */
export function proxiedOrigin(origin) {
  if (origin == null) return origin;
  return DEV_ORIGINS.includes(String(origin)) ? API_TARGET : origin;
}
