// dev 프록시의 Origin 바꾸기: dev 서버 자기 주소(4321)에서 온 것만 진도 서버 주소로 바꾸고, 그 밖은 그대로 넘긴다(서버가 거부).
import { describe, expect, it } from 'vitest';
import { API_TARGET, DEV_ORIGINS, DEV_PORT, proxiedOrigin } from '../../src/lib/api-target.mjs';

describe('dev 프록시 Origin', () => {
  it('dev 서버 주소는 127.0.0.1·localhost 두 가지, 포트는 dev 포트', () => {
    expect(DEV_ORIGINS).toEqual([`http://127.0.0.1:${DEV_PORT}`, `http://localhost:${DEV_PORT}`]);
    expect(API_TARGET.startsWith('http://127.0.0.1:')).toBe(true);
  });

  it('dev 서버 자기 주소에서 온 Origin 은 서버 주소로 바꾼다', () => {
    for (const o of DEV_ORIGINS) expect(proxiedOrigin(o)).toBe(API_TARGET);
  });

  it('다른 Origin 은 바꾸지 않는다(서버가 403 bad_origin 으로 거부하게)', () => {
    for (const o of [
      'https://evil.example',
      'http://127.0.0.1:4329',
      'http://localhost:3000',
      `http://192.168.0.10:${DEV_PORT}`,
      `https://127.0.0.1:${DEV_PORT}`,
      `http://127.0.0.1:${DEV_PORT}.evil.example`,
      'null',
    ])
      expect(proxiedOrigin(o)).toBe(o);
  });

  it('Origin 이 없으면 없는 채로 둔다', () => {
    expect(proxiedOrigin(undefined)).toBeUndefined();
    expect(proxiedOrigin(null)).toBeNull();
  });
});
