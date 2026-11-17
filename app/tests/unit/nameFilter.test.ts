// 맛보기 이름 금칙어 (교사 정본 inputs/pedagogy/content/taster_blocklist.json, 2026-11-17).
// 금칙어는 테스트에 늘어놓지 않고 정본 파일에서 읽는다. names.txt 는 third_party/makemore/names.txt (karpathy/makemore, MIT).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAMES_TXT, TASTER } from '../../src/content-config.mjs';
import { REPO_ROOT, readTasterBundle, resolvePaths } from '../../src/lib/content/load.mjs';
import { buildTaster, validateTaster } from '../../src/lib/content/taster.mjs';
import { buildNameFilter, hitsBlocklist, isBlockedName, normalizeName, onMatchMessage, splitNameLines } from '../../src/lib/name-filter.mjs';
import { cleanNames } from '../../src/lib/taste';
import { sanitizeCardInput, type TasterCardInput } from '../../src/lib/share-card';

const CANON_DIR = path.join(REPO_ROOT, 'inputs/pedagogy/content');
const BL = JSON.parse(fs.readFileSync(path.join(CANON_DIR, TASTER.blocklistFile), 'utf8'));
const REAL: string[] = splitNameLines(fs.readFileSync(path.join(REPO_ROOT, NAMES_TXT.path), 'utf8'));
const F = buildNameFilter(BL, REAL);
const ALLOW = new Set(F.allow);
const REAL_SET = new Set(REAL);
/** names.txt 에 없는 가짜 이름: 앞뒤에 실제 이름에 잘 없는 글자를 붙인다 */
const fake = (w: string) => `qx${w}qx`;

describe('names.txt (karpathy/makemore, 저장소 사본)', () => {
  it(`줄 수는 ${NAMES_TXT.count.toLocaleString('en-US')}개이고 모두 a~z`, () => {
    expect(REAL).toHaveLength(NAMES_TXT.count);
    expect(REAL.every((n) => /^[a-z]+$/.test(n))).toBe(true);
  });
});

describe('정본 normalize: 소문자로 바꾼 뒤 a~z 만', () => {
  it('대문자·숫자·기호·공백·한글을 정리한다', () => {
    expect(normalizeName('  Ab-C d9_é한 ')).toBe('abcd');
    expect(normalizeName('')).toBe('');
    expect(normalizeName(null as any)).toBe('');
  });
});

describe('허용 목록 (실제 이름인데 금칙어에 걸리는 이름만 싣는다)', () => {
  it('(b) 허용 목록 개수 = 교사 대조 숫자(allow_rule 글의 "실제 이름 N개")', () => {
    const teacher = Number(String(BL.allow_rule).match(/실제 이름 (\d+)개/)?.[1]);
    // 보고용 출력
    console.log(`허용 목록 ${F.allow.length}개: ${F.allow.join(', ')}`);
    expect(F.allow.length).toBe(teacher);
    // 하나하나가 names.txt 의 이름이고, 허용이 없으면 목록에 걸린다
    for (const n of F.allow) {
      expect(REAL_SET.has(n)).toBe(true);
      expect(hitsBlocklist(n, F)).toBe(true);
    }
    // 그 밖의 실제 이름은 목록에 걸리지 않는다(그래서 3만 개를 싣지 않아도 결과가 같다)
    expect(REAL.filter((n) => hitsBlocklist(n, F) && !ALLOW.has(n))).toEqual([]);
    expect(F.allow.length).toBeLessThan(100);
  });

  it('(a) names.txt 3만 2,033개 전부 하나도 걸리지 않는다(실제 파일)', () => {
    const hit = REAL.filter((n) => isBlockedName(n, F));
    expect(hit).toEqual([]);
    // 앱의 정리 함수로도 같다(10줄씩 넣어 본다)
    let blocked = 0;
    for (let i = 0; i < REAL.length; i += 10) blocked += cleanNames(REAL.slice(i, i + 10).join('\n'), { filter: F }).blocked;
    expect(blocked).toBe(0);
  });
});

describe('금칙어 규칙 (정본 rule)', () => {
  it('(c) exact 는 줄 전체가 같을 때만: 정본 notes 의 실제 이름(cassandra 등)과 exact 단어가 "들어만 있는" 가짜 이름은 통과', () => {
    const noted = String(BL.rule).match(/예: ([a-z, ]+)\)/)![1].split(',').map((s) => s.trim());
    expect(noted.length).toBeGreaterThanOrEqual(3);
    const noAllow = { ...F, allow: [] };
    for (const n of noted) {
      expect(isBlockedName(n, F), n).toBe(false);
      // 허용 목록이 없어도 exact 는 줄 전체 일치만 보므로 통과
      expect(isBlockedName(n, noAllow), n).toBe(false);
    }
    for (const w of F.exact) {
      const f = fake(w);
      if (F.substring.some((s) => f.includes(s))) continue; // substring 단어가 우연히 생긴 경우는 이 검사에서 뺀다
      expect(REAL_SET.has(f)).toBe(false);
      expect(isBlockedName(f, F), f).toBe(false);
      expect(isBlockedName(f, noAllow), f).toBe(false);
    }
  });

  it('(c) exact 와 같은 줄은 빠진다(실제 이름이라 허용된 것은 둔다)', () => {
    for (const w of F.exact) expect(isBlockedName(w, F), w).toBe(!ALLOW.has(w));
  });

  it('(d) substring 단어가 들어 있으면 빠진다(가짜 이름). 실제 이름이라 허용된 것은 둔다', () => {
    for (const w of F.substring) {
      expect(isBlockedName(w, F), w).toBe(!ALLOW.has(w));
      expect(isBlockedName(fake(w), F), fake(w)).toBe(true);
      expect(isBlockedName(`a${w}`, F), `a${w}`).toBe(!ALLOW.has(`a${w}`));
    }
    // substring 때문에 허용된 실제 이름도 글자가 붙으면(가짜 이름) 빠진다
    for (const n of F.allow.filter((x) => F.substring.some((s) => x.includes(s)))) expect(isBlockedName(`${n}qx`, F), `${n}qx`).toBe(true);
  });

  it('(e) 대소문자: 금칙어 검사는 정본 normalize 뒤에 한다. 앱의 줄 정리에서는 기존 규칙(a~z 밖 글자 → 빼기)이 먼저', () => {
    const w = F.substring[0];
    const mixed = fake(w).toUpperCase();
    expect(isBlockedName(mixed, F)).toBe(true);
    expect(isBlockedName(` ${fake(w)}! `, F)).toBe(true);
    // 대문자 줄은 기존 규칙으로 먼저 빠지고("모델 출력만 넣어 주세요"), 금칙어 수로는 세지 않는다
    const r = cleanNames(['gsli', mixed, fake(w), 'di'].join('\n'), { filter: F });
    expect(r.flagged).toEqual([2]);
    expect(r.blocked).toBe(1);
    expect(r.names).toEqual(['gsli', 'di']);
    // 20글자를 넘는 줄도 기존 규칙이 먼저
    const long = cleanNames(`${fake(w)}${'a'.repeat(30)}`, { filter: F });
    expect(long.flagged).toEqual([1]);
    expect(long.blocked).toBe(0);
  });

  it('줄 정리: 걸린 줄은 저장 글(text)·이름 목록에 없고, 걸린 말 자체는 돌려주지 않는다(개수만)', () => {
    const bad = [fake(F.substring[1]), F.exact.find((w) => !ALLOW.has(w))!];
    const r = cleanNames(['gsli', ...bad, 'di'].join('\n'), { filter: F });
    expect(r.names).toEqual(['gsli', 'di']);
    expect(r.text).toBe('gsli\ndi');
    expect(r.blocked).toBe(2);
    expect(JSON.stringify(r)).not.toMatch(new RegExp(bad.join('|')));
    // 10줄 제한은 걸린 줄을 뺀 뒤에 센다
    const many = cleanNames([...bad, ...Array.from({ length: 10 }, (_, i) => `n${'a'.repeat(i + 1)}`)].join('\n'), { filter: F });
    expect(many.names).toHaveLength(10);
    expect(many.dropped).toBe(0);
  });

  it('카드 입력 방어(sanitizeCardInput)에도 같은 규칙: 그리기 직전에 한 번 더 걸러진다', () => {
    const bad = fake(F.substring[2]);
    const input = sanitizeCardInput({ kind: 'ART-TASTER', names: ['gsli', bad, F.allow[0] ?? 'di'], loss_start: 3.8, loss_end: 2.4, taste_complete: true }, F) as TasterCardInput;
    expect(input.names).toEqual(['gsli', F.allow[0] ?? 'di']);
    // 필터 없이 부르면 지금 모양 검사만(옛 행과 비교할 때 쓴다)
    expect((sanitizeCardInput({ kind: 'ART-TASTER', names: ['gsli', bad] }) as TasterCardInput).names).toEqual(['gsli', bad]);
  });

  it('안내 문구는 정본 on_match_ko 의 따옴표 안 글 그대로', () => {
    expect(F.message).toBe(String(BL.on_match_ko).match(/'([^']+)'/)![1]);
    expect(onMatchMessage("그 줄을 빼고 '이름을 뺐어요'를 보여 줍니다.")).toBe('이름을 뺐어요');
    expect(onMatchMessage('따옴표 없음')).toBeNull();
  });
});

describe('(g) 목록은 빌드 때 정본 파일에서 읽는다(앱 소스에 박지 않음)', () => {
  it('정본 파일이 바뀌면 빌드 결과(buildTaster 의 nameFilter)가 새 목록을 쓴다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'z2h-blocklist-'));
    try {
      for (const f of [TASTER.file, TASTER.outputsFile]) fs.copyFileSync(path.join(CANON_DIR, f), path.join(dir, f));
      const word = 'zqxvw';
      fs.writeFileSync(path.join(dir, TASTER.blocklistFile), JSON.stringify({ ...BL, exact: [...BL.exact, word], on_match_ko: "'새 안내'를 보입니다" }));
      const tb = readTasterBundle({ ...resolvePaths(), tasterDir: dir });
      const report = validateTaster(tb);
      expect(report.errors).toEqual([]);
      const nf = buildTaster(tb).nameFilter;
      expect(nf.exact).toContain(word);
      expect(nf.message).toBe('새 안내');
      expect(isBlockedName(word, nf)).toBe(true);
      // 지금 정본으로 만든 필터에는 없다
      expect(isBlockedName(word, F)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('정본 파일이 없거나 모양이 틀리면 콘텐츠 검사가 빌드를 멈춘다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'z2h-blocklist-'));
    try {
      for (const f of [TASTER.file, TASTER.outputsFile]) fs.copyFileSync(path.join(CANON_DIR, f), path.join(dir, f));
      expect(validateTaster(readTasterBundle({ ...resolvePaths(), tasterDir: dir })).errors.some((e: any) => e.file.endsWith(TASTER.blocklistFile))).toBe(true);
      fs.writeFileSync(path.join(dir, TASTER.blocklistFile), JSON.stringify({ ...BL, exact: 'ass', on_match_ko: '따옴표 없음' }));
      const errs = validateTaster(readTasterBundle({ ...resolvePaths(), tasterDir: dir })).errors.map((e: any) => e.message).join('\n');
      expect(errs).toMatch(/exact/);
      expect(errs).toMatch(/on_match_ko/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('앱 소스(app/src)에 금칙어 목록이 글자로 들어 있지 않다', () => {
    const SRC = path.join(REPO_ROOT, 'app/src');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx|mjs|js|astro|json|ya?ml)$/.test(e.name)) files.push(p);
      }
    };
    walk(SRC);
    const words = [...BL.exact, ...BL.substring].map((w: string) => w.toLowerCase());
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      const quoted = words.filter((w) => text.includes(`'${w}'`) || text.includes(`"${w}"`));
      expect(quoted, path.relative(REPO_ROOT, f)).toEqual([]);
    }
  });
});
