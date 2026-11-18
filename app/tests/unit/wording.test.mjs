// 낡은 표기 막기(P7 검수 권고 4): 기초 F.json·1편 L01.json 은 이제 "교사 정본"이 아니라 "정본"이다(클로드 버전).
// 앱 소스에서 "교사"는 맛보기(taster.json·금칙어·교사 실행 출력) 이야기에만 쓴다. 맛보기 전용 파일(경로에 taste·taster·name-filter)은 통째로 뺀다.
// 화면 금지어 목록 파일(*-banned.mjs)은 막을 말을 적어 두는 곳이라, scripts/canon-colab-time.mjs 는 정본 책임자(교사)의 지시를 그대로 기록하는 정본 고치기 표라 뺀다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_DIR } from '../../src/lib/content/load.mjs';
import { formatReport } from '../../src/lib/content/validate.mjs';

const TASTER_FILE = /taste|taster|name-filter|-banned\.mjs$|scripts\/canon-colab-time\.mjs$/i;
const TASTER_LINE = /맛보기|taster|금칙어|blocklist/i;

function* files(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (/\.(ts|tsx|mjs|astro)$/.test(e.name)) yield p;
  }
}

describe('"교사" 표기는 맛보기에만', () => {
  it('app/src·app/scripts 에서 맛보기 밖 "교사" 0줄', () => {
    const bad = [];
    for (const root of ['src', 'scripts'])
      for (const f of files(path.join(APP_DIR, root))) {
        if (TASTER_FILE.test(path.relative(APP_DIR, f))) continue;
        fs.readFileSync(f, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (line.includes('교사') && !TASTER_LINE.test(line)) bad.push(`${path.relative(APP_DIR, f)}:${i + 1}`);
          });
      }
    expect(bad).toEqual([]);
  });
  it('빌드 로그 첫 줄은 "정본"', () => {
    const line = formatReport({ errors: [], warnings: [], stats: { lectures: 1, steps: 1, questions: 0, rebuild: 0, hints: 0 } }, 'content', 'x').split('\n')[0];
    expect(line).toContain('(정본 inputs/pedagogy/content)');
    expect(line).not.toContain('교사');
  });
});
