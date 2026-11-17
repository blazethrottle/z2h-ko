// 공개 전환 대비: API 주소·저장소 이름·로그인 길별 화면이 config.ts 한 곳에서 나오고, 값은 지금과 같다.
import { describe, expect, it } from 'vitest';
import { authScreen, config, isAuthProvider } from '../../src/config';
import { API_BASE, API_PATHS, parseAuthProvider } from '../../src/lib/api';
import { PENDING_DB, accountDbName, ensureAccount } from '../../src/lib/runtime';
import { API_TARGET, DEV_PORT, LOCAL_HOST, PREVIEW_PORT, REAL_TEST_PORT } from '../../src/lib/api-target.mjs';

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

describe('주소·저장소 이름 (값은 옮기기 전과 같다)', () => {
  it('API 는 같은 출처 상대 주소 /api, credentials same-origin', () => {
    expect(config.api).toEqual({ base: '/api', credentials: 'same-origin' });
    expect(API_BASE).toBe('/api');
    expect(Object.values(API_PATHS).every((p) => p.startsWith('/api/'))).toBe(true);
  });
  it('이 기기 저장소 이름이 바뀌지 않았다(바꾸면 저장된 기록을 못 읽는다)', () => {
    expect(config.storage).toEqual({
      accountKey: 'z2h.account',
      clientIdKey: 'z2h.client_id',
      videoCollapsedPrefix: 'z2h.video.collapsed',
      pendingDb: 'z2h-pending',
      accountDbPrefix: 'z2h-u-',
    });
    expect(PENDING_DB).toBe('z2h-pending');
    expect(accountDbName('abc')).toBe('z2h-u-abc');
  });
  it('node 쪽 주소·포트는 api-target.mjs 한 곳(127.0.0.1 만)', () => {
    expect(LOCAL_HOST).toBe('127.0.0.1');
    expect(API_TARGET).toBe('http://127.0.0.1:8787');
    expect([DEV_PORT, PREVIEW_PORT, REAL_TEST_PORT]).toEqual([4321, 4329, 8797]);
  });
});

describe('로그인 길별 화면 표 (config.auth)', () => {
  it('표의 열쇠만 auth_provider 로 받는다. 칸 없음·"none"·아직 없는 일반 로그인은 null → fallback 행', () => {
    for (const k of Object.keys(config.auth.screens)) {
      expect(isAuthProvider(k)).toBe(true);
      expect(parseAuthProvider(k)).toBe(k);
    }
    for (const v of [undefined, null, '', 'none', 'email_otp', 'google', 'toString', '__proto__']) expect(parseAuthProvider(v)).toBeNull();
    expect(config.auth.screens[config.auth.fallback]).toBeTruthy();
    expect(authScreen(null)).toBe(config.auth.screens[config.auth.fallback]);
  });
  it('지금 행: dev_local(개발용 부품, 개발용 로그인 시도), tailscale(맥미니 연결 안내 부품, 로그인 동작 없음)', () => {
    expect(authScreen('dev_local')).toMatchObject({ tag: '개발용', part: 'dev_accounts', devLogin: true, needAccountLabel: '계정을 골라 주세요' });
    expect(authScreen('tailscale')).toMatchObject({ tag: null, part: 'link_on_mac', devLogin: false, needAccountLabel: '계정 연결 필요' });
    for (const s of Object.values(config.auth.screens)) {
      expect(s.needAccountLabel).toBeTruthy();
      if (s.part !== 'dev_accounts') expect(s.signedIn && s.needAccount).toBeTruthy();
      for (const v of Object.values(s)) if (typeof v === 'string') expect(v.includes(String.fromCharCode(0x2014))).toBe(false);
    }
  });
  it('계정 정하기는 표의 devLogin 을 따른다: devLogin false 인 길의 401 이면 개발용 로그인을 부르지 않는다', async () => {
    for (const [provider, s] of Object.entries(config.auth.screens)) {
      const calls: string[] = [];
      const f = async (u: string) => {
        calls.push(u);
        return u === '/api/me' ? json({ ok: false, error: 'no_user', auth_provider: provider }, 401) : json({ ok: false, error: 'not_found' }, 404);
      };
      const r = await ensureAccount(f, null);
      expect(r.account).toBeNull();
      expect(calls.some((u) => u.startsWith('/api/dev-auth/'))).toBe(s.devLogin);
    }
  });
});
