// 진도 서버 주소. dev 프록시와 문서가 이 값 하나를 본다. 브라우저 코드는 같은 주소(상대 경로 /api)를 쓴다.
export const API_TARGET = 'http://127.0.0.1:8787';

/** dev 서버(astro dev) 포트. astro.config.mjs 의 server.port 와 package.json 의 dev 스크립트가 같은 값 */
export const DEV_PORT = 4321;
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
