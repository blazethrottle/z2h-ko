import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { crc32, decodeResultCode, encodeResultCodeForTest, keepPasses, resultCodeToRows } from '../../src/lib/resultCode';

const REPO = path.resolve(__dirname, '../../..');
// 서버 server/tests/test_result_code.py 의 GOLDEN_CODE (= server/API.md 4절 예시)
const SERVER_GOLDEN =
  'Z2H1.eyJ2IjoxLCJsIjoiTDAxIiwicCI6WyJMMDEtUzA0IiwiTDAxLVMxMWIiXSwiZiI6WyJMMDEtUzEyIl0sInQiOiIyMDI2LTExLTIwVDIxOjAwOjAwKzA5OjAwIn0.e00a6ba9';
// 채점 패키지 z2h_check (README.md, encode_result_code 예시)
const CHECK_GOLDEN =
  'Z2H1.eyJ2IjoxLCJsIjoiTDAxIiwicCI6WyJMMDEtUzExYiJdLCJmIjpbIkwwMS1SMiJdLCJ0IjoiMjAyNi0xMS0xNlQyMTowMDowMCswOTowMCJ9.32dccd52';

/** 다른 작업 폴더의 기준값 파일이 있으면 같은 값을 쓰는지 확인(읽기만) */
function readIf(rel: string): string | null {
  try {
    return fs.readFileSync(path.join(REPO, rel), 'utf8');
  } catch {
    return null;
  }
}

describe('결과코드 Z2H1.{base64url(JSON)}.{crc32 8자리} (DESIGN.md 12.7)', () => {
  it('crc32 표준값', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('서버 기준값을 푼다: 통과 2, 실패 1', () => {
    const r = decodeResultCode(SERVER_GOLDEN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({ v: 1, lecture_id: 'L01', at: '2026-11-20T21:00:00+09:00', crc: 'e00a6ba9' });
    expect(r.data.results.map((x) => [x.check_id, x.passed])).toEqual([
      ['L01-S04', true],
      ['L01-S11b', true],
      ['L01-S12', false],
    ]);
  });

  it('채점 패키지 기준값을 푼다', () => {
    const r = decodeResultCode(CHECK_GOLDEN);
    expect(r.ok && r.data.results.map((x) => [x.check_id, x.passed])).toEqual([
      ['L01-S11b', true],
      ['L01-R2', false],
    ]);
  });

  it('세 곳이 같은 규칙: 우리 인코더가 두 기준값을 그대로 만든다', () => {
    expect(encodeResultCodeForTest({ v: 1, l: 'L01', p: ['L01-S04', 'L01-S11b'], f: ['L01-S12'], t: '2026-11-20T21:00:00+09:00' })).toBe(SERVER_GOLDEN);
    expect(encodeResultCodeForTest({ v: 1, l: 'L01', p: ['L01-S11b'], f: ['L01-R2'], t: '2026-11-16T21:00:00+09:00' })).toBe(CHECK_GOLDEN);
  });

  it('기준값이 서버 테스트·채점 패키지 문서에 그대로 있다(파일이 있을 때)', () => {
    const server = readIf('server/tests/test_result_code.py');
    if (server) expect(server.replace(/"\s*\n\s*"/g, '')).toContain(SERVER_GOLDEN);
    const check = readIf('z2h_check/README.md');
    if (check) expect(check).toContain(CHECK_GOLDEN);
  });

  it('앞뒤 공백·줄바꿈이 섞여도 받는다', () => {
    expect(decodeResultCode(`  ${SERVER_GOLDEN.slice(0, 30)}\n${SERVER_GOLDEN.slice(30)}  `).ok).toBe(true);
  });

  it('글자 하나가 바뀌면 "코드가 잘렸거나 글자가 바뀌었습니다"', () => {
    const i = 20;
    const flipped = SERVER_GOLDEN.slice(0, i) + (SERVER_GOLDEN[i] === 'A' ? 'B' : 'A') + SERVER_GOLDEN.slice(i + 1);
    const r = decodeResultCode(flipped);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_ko).toBe('코드가 잘렸거나 글자가 바뀌었습니다');
  });

  it('다른 모양은 받지 않는다: 잘림, 머리말, v≠1, results 모양, JSON 원문 바이트 crc', () => {
    const resultsShape = encodeResultCodeForTest({ lecture_id: 'L01', t: 'x', results: [{ check_id: 'L01-S01', passed: true }] });
    const json = JSON.stringify({ v: 1, l: 'L01', p: ['L01-S01'], f: [], t: '2026-11-16T21:00:00+09:00' });
    const body = Buffer.from(json).toString('base64url');
    const jsonCrc = `Z2H1.${body}.${crc32(new TextEncoder().encode(json)).toString(16).padStart(8, '0')}`;
    for (const bad of [
      SERVER_GOLDEN.slice(0, -3),
      SERVER_GOLDEN.replace('Z2H1', 'Z2H2'),
      encodeResultCodeForTest({ v: 2, l: 'L01', p: [], f: [], t: 'x' }),
      resultsShape,
      jsonCrc,
      '',
    ]) {
      expect(decodeResultCode(bad).ok, bad).toBe(false);
    }
  });

  it('grade_result 행(at = 코드의 t)과 재구성 조각 rebuild_attempt 행(attempt_id = rc-{crc}-{id})', () => {
    const r = decodeResultCode(CHECK_GOLDEN);
    if (!r.ok) throw new Error('decode');
    const rows = resultCodeToRows(r.data, '2026-11-16T22:00:00.000+09:00', (id) => (id === 'L01-R2' ? 2 : 0), ['L01-R1', 'L01-R2', 'L01-R3']);
    expect(rows.grade).toEqual([
      { check_id: 'L01-S11b', passed: true, message_ko: '', source: 'result_code', at: '2026-11-16T21:00:00+09:00' },
      { check_id: 'L01-R2', passed: false, message_ko: '', source: 'result_code', at: '2026-11-16T21:00:00+09:00' },
    ]);
    expect(rows.rebuild).toEqual([{ rebuild_id: 'L01-R2', attempt_id: 'rc-32dccd52-L01-R2', passed: false, max_hint_level: 2, at: '2026-11-16T21:00:00+09:00' }]);
  });
});

describe('재구성 조각인지는 정본 rebuild_tasks 의 id 로 안다(모양으로 짐작하지 않음)', () => {
  const L01 = JSON.parse(fs.readFileSync(path.join(REPO, 'inputs/pedagogy/content/L01.json'), 'utf8'));
  const rebuildIds: string[] = L01.rebuild_tasks.map((t: { rebuild_id: string }) => t.rebuild_id);
  it('정본 목록에 있는 id 만 rebuild_attempt 행이 된다', () => {
    const code = encodeResultCodeForTest({ v: 1, l: 'L01', p: [rebuildIds[0], 'L01-R9'], f: [], t: '2026-11-17T10:00:00+09:00' });
    const r = decodeResultCode(code);
    if (!r.ok) throw new Error('decode');
    const rows = resultCodeToRows(r.data, '2026-11-17T10:00:00+09:00', () => 0, rebuildIds);
    expect(rows.grade.map((g) => g.check_id)).toEqual([rebuildIds[0], 'L01-R9']);
    expect(rows.rebuild.map((x) => x.rebuild_id)).toEqual([rebuildIds[0]]);
  });
});

describe('한 번 통과한 칸은 나중 결과코드의 다시(f)로 덮지 않는다(완성한 노트북을 처음부터 다시 돌리면 앞 단계 칸이 f 가 될 수 있음, p7-notebook 실측)', () => {
  const at = '2026-11-17T12:00:00+09:00';
  const row = (check_id: string, passed: boolean) => ({ check_id, passed, message_ko: '', source: 'result_code' as const, at });
  it('통과 기록이 있는 칸의 f 는 저장하지 않고 따로 알린다. 통과·처음 보는 칸·전에 다시였던 칸은 그대로 저장', () => {
    const existing = [{ check_id: 'L01-S12', passed: true }, { check_id: 'L01-S13', passed: false }];
    const r = keepPasses([row('L01-S12', false), row('L01-S13', false), row('L01-S14', false), row('L01-S30', true)], existing);
    expect(r.rows.map((x) => [x.check_id, x.passed])).toEqual([
      ['L01-S13', false],
      ['L01-S14', false],
      ['L01-S30', true],
    ]);
    expect(r.keptPass).toEqual(['L01-S12']);
  });
});
