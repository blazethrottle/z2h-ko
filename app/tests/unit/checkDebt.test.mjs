// 땜질 계수기(scripts/check-debt.mjs): 세는 법의 경계와 "늘면 실패 / 줄면 안내 / 같으면 통과".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { countText, scanDir, BASELINE_FILE } from '../../scripts/check-debt.mjs';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/check-debt.mjs');
const KINDS = ['setTimeout', 'useEffect', 'any', 'disable'];

const tmpDirs = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function fakeApp(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'z2h-debt-'));
  tmpDirs.push(root);
  for (const [rel, text] of Object.entries(files)) {
    const f = path.join(root, 'src', rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
  }
  return root;
}

function run(root, baseline) {
  const file = path.join(root, 'baseline.json');
  fs.writeFileSync(file, JSON.stringify(baseline));
  const r = spawnSync(process.execPath, [SCRIPT, '--src', path.join(root, 'src'), '--baseline', file], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout + r.stderr).trim() };
}

const lines = (text, file = 'a.tsx') => countText(text, file);

describe('세는 법', () => {
  it('setTimeout·useEffect 는 호출만 센다(import·typeof·속성 이름은 빼고, obj.setTimeout( 은 센다)', () => {
    const src = [
      "import { useEffect, useState } from 'preact/hooks';",
      'let t: ReturnType<typeof setTimeout> | null = null;',
      'type Timers = { setTimeout: (fn: () => void, ms: number) => unknown };',
      'useEffect(() => {',
      '  t = setTimeout(() => {}, 10);',
      '  this.timers.setTimeout (() => {}, 5);',
      '}, []);',
      'mySetTimeout(f); setTimeoutLater(f); useEffectish(f);',
    ].join('\n');
    const c = lines(src);
    expect(c.setTimeout).toEqual([5, 6]);
    expect(c.useEffect).toEqual([4]);
  });

  it('주석·문자열·템플릿 글자 안의 낱말은 세지 않고, ${} 안의 코드는 센다', () => {
    const src = [
      '// setTimeout(f) useEffect(f) : any',
      '/* setTimeout(f)',
      '   as any */',
      "const a = 'setTimeout(f) as any';",
      'const b = "useEffect(f): any";',
      "const c = 'it\\'s setTimeout(f)';",
      'const d = `setTimeout(f) ${setTimeout(g, 1)} as any`;',
      "const e = 'https://example.com'; setTimeout(h, 2);",
    ].join('\n');
    const c = lines(src, 'a.ts');
    expect(c.setTimeout).toEqual([7, 8]);
    expect(c.useEffect).toEqual([]);
    expect(c.any).toEqual([]);
  });

  it('any 는 타입으로 쓴 낱말 any 를 모두 센다(: any, as any, any[], Record<string, any>, <T = any>)', () => {
    const src = [
      'function f(x: any, y: any[]): Promise<any> {',
      '  const r = y as any;',
      '  const m: Record<string, any> = {};',
      '}',
      'function g<T = any>() {}',
      'const company = 1; const anywhere = company; const anyOf = 2;',
    ].join('\n');
    expect(lines(src, 'a.ts').any).toEqual([1, 1, 1, 2, 3, 5]);
  });

  it('검사 끄기 주석은 주석 안에서만 센다', () => {
    const src = [
      '// eslint-disable-next-line no-console',
      '/* eslint-disable */',
      '// @ts-ignore',
      '// @ts-expect-error 이유',
      '// @ts-nocheck',
      "const s = '@ts-ignore eslint-disable';",
    ].join('\n');
    expect(lines(src, 'a.ts').disable).toEqual([1, 2, 3, 4, 5]);
  });

  it('정규식 안의 따옴표·백틱이 뒤 줄을 문자열로 삼키지 않는다', () => {
    const src = ["const parts = s.split(/(`[^`\\n]+`)/g); const q = s.replace(/'/g, '');", 'setTimeout(f, 1);', 'const half = a / b; setTimeout(g, 2);'].join('\n');
    expect(lines(src, 'a.ts').setTimeout).toEqual([2, 3]);
  });

  it('화면 글의 작은따옴표 하나가 다음 줄을 삼키지 않는다(따옴표 문자열은 줄 끝에서 끊는다)', () => {
    const src = ["const v = <p>it's ok</p>;", 'setTimeout(f, 1);'].join('\n');
    expect(lines(src).setTimeout).toEqual([2]);
  });

  it('.astro: 머리말·<script> 코드는 세고 HTML 주석은 빼며, HTML 주석 안의 검사 끄기는 센다', () => {
    const src = [
      '---',
      'const rows: any[] = [];',
      '---',
      '<!-- setTimeout(f) as any -->',
      '<!-- eslint-disable -->',
      '<p>{rows.length}</p>',
      '<script is:inline>',
      '  setTimeout(function () {}, 1);',
      '</script>',
    ].join('\n');
    const c = lines(src, 'Page.astro');
    expect(c.any).toEqual([2]);
    expect(c.setTimeout).toEqual([8]);
    expect(c.disable).toEqual([5]);
  });

  it('폴더 아래 .ts·.tsx·.js·.mjs·.astro 만 읽는다(.css 는 뺀다)', () => {
    const root = fakeApp({
      'a.ts': 'setTimeout(f, 1);',
      'deep/b.tsx': 'useEffect(() => {}, []);',
      'c.mjs': 'const x = y; setTimeout(f, 2);',
      'd.astro': '---\nconst z: any = 1;\n---\n',
      'e.css': '.x { overflow-wrap: anywhere; } /* setTimeout( */',
      'f.js': 'setTimeout(f, 3);',
    });
    const found = scanDir(path.join(root, 'src'));
    expect(found.setTimeout.map((x) => x.file).sort()).toEqual(['src/a.ts', 'src/c.mjs', 'src/f.js']);
    expect(found.useEffect).toEqual([{ file: 'src/deep/b.tsx', line: 1 }]);
    expect(found.any).toEqual([{ file: 'src/d.astro', line: 2 }]);
  });
});

describe('기준값과 비교', () => {
  const files = {
    'a.tsx': ["import { useEffect } from 'preact/hooks';", 'useEffect(() => {', '  setTimeout(f, 1);', '}, []);', 'const x = y as any;'].join('\n'),
    'lib/b.ts': 'export const z: any = 1;',
  };
  const same = { setTimeout: 1, useEffect: 1, any: 2, disable: 0 };

  it('같으면 한 줄로 조용히 통과한다', () => {
    const r = run(fakeApp(files), same);
    expect(r.code).toBe(0);
    expect(r.out.split('\n')).toHaveLength(1);
    expect(r.out).toContain('통과');
  });

  it('늘면 종류·현재 수·기준값·위치를 알리고 종료 코드 1', () => {
    const r = run(fakeApp(files), { ...same, any: 1 });
    expect(r.code).toBe(1);
    expect(r.out).toContain('any');
    expect(r.out).toMatch(/현재 2.*기준값 1/);
    expect(r.out).toContain('src/a.tsx:5');
    expect(r.out).toContain('src/lib/b.ts:1');
    expect(r.out).not.toContain('통과');
  });

  it('검사 끄기 주석이 하나라도 생기면 실패한다', () => {
    const r = run(fakeApp({ ...files, 'c.ts': '// @ts-ignore\nconst q = 1;' }), same);
    expect(r.code).toBe(1);
    expect(r.out).toContain('src/c.ts:1');
  });

  it('줄면 통과하되 "기준값을 N으로 낮추세요"라고 안내한다', () => {
    const r = run(fakeApp(files), { ...same, useEffect: 3 });
    expect(r.code).toBe(0);
    expect(r.out).toContain('기준값을 1로 낮추세요');
  });

  it('조사는 숫자 읽는 소리를 따른다(0·3·6 으로 끝나면 "으로")', () => {
    const r = run(fakeApp({ 'a.ts': 'const q = 1;' }), { setTimeout: 2, useEffect: 0, any: 0, disable: 0 });
    expect(r.code).toBe(0);
    expect(r.out).toContain('기준값을 0으로 낮추세요');
  });

  it('하나는 늘고 하나는 줄면 실패한다(줄어든 쪽 안내도 함께)', () => {
    const r = run(fakeApp(files), { ...same, setTimeout: 0, useEffect: 3 });
    expect(r.code).toBe(1);
    expect(r.out).toContain('src/a.tsx:3');
    expect(r.out).toContain('기준값을 1로 낮추세요');
  });

  it('기준값 파일에 종류가 빠졌거나 숫자가 아니면 실패한다', () => {
    const r = run(fakeApp(files), { setTimeout: 1, useEffect: 1, any: 'many' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('기준값');
  });
});

describe('저장소 기준값 파일', () => {
  it('네 종류 모두 0 이상의 정수다', () => {
    const b = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    expect(Object.keys(b).sort()).toEqual([...KINDS].sort());
    for (const k of KINDS) expect(Number.isInteger(b[k]) && b[k] >= 0, k).toBe(true);
  });
});
