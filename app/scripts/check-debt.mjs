#!/usr/bin/env node
// 땜질 계수기(ratchet, CLAUDE.md 12 · docs/QUALITY_GUARDS_PLAN.md 1번). 아래 네 수가 debt-baseline.json 의 기준값보다 늘면 종료 코드 1, 줄면 기준값을 낮추라고 안내한다.
// 세는 법: src 아래 .ts·.tsx·.js·.mjs·.astro 등에서 주석·문자열(따옴표 문자열은 줄 끝에서 끊는다)·정규식을 뺀 코드의 setTimeout( 와 useEffect( 호출, 낱말 any 전부, 그리고 주석 안의 eslint-disable·@ts-ignore·@ts-expect-error·@ts-nocheck 를 나올 때마다 하나씩 센다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SRC = path.resolve(HERE, '..', 'src');
export const BASELINE_FILE = path.join(HERE, 'debt-baseline.json');

export const KINDS = ['setTimeout', 'useEffect', 'any', 'disable'];
const LABEL = { setTimeout: 'setTimeout 호출', useEffect: 'useEffect 호출', any: 'any 타입', disable: '검사 끄기 주석' };
const CODE_PATTERNS = { setTimeout: /\bsetTimeout\s*\(/g, useEffect: /\buseEffect\s*\(/g, any: /\bany\b/g };
const COMMENT_PATTERN = /eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck/g;
const SOURCE_EXT = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.astro']);

// "/" 가 나눗셈이 아니라 정규식의 시작일 수 있는 바로 앞 글자와 낱말
const REGEX_AFTER_CHAR = new Set([...'(,=:[!&|?{;+-*%~^>']);
const REGEX_AFTER_WORD = /\b(return|typeof|case|do|else|in|of|void|yield|await|delete|instanceof|new)$/;

/** 원문과 길이·줄바꿈이 같은 두 글: 코드만 남긴 것, 주석만 남긴 것 (나머지는 빈칸) */
export function splitCodeAndComments(text, file) {
  const n = text.length;
  const blank = (ch) => (ch === '\n' ? '\n' : ' ');
  const code = Array.from({ length: n }, (_, k) => blank(text[k]));
  const comments = code.slice();
  const html = file.endsWith('.astro');
  const templateDepth = [];
  let prev = '';
  let i = 0;

  const keepComment = (end) => {
    for (let k = i; k < end; k++) comments[k] = text[k];
    i = end;
  };
  const skipTemplateText = () => {
    while (i < n) {
      if (text[i] === '\\') i += 2;
      else if (text[i] === '`') return void i++;
      else if (text[i] === '$' && text[i + 1] === '{') {
        templateDepth.push(0);
        return void (i += 2);
      } else i++;
    }
  };
  const quotedEnd = (q) => {
    let k = i + 1;
    while (k < n && text[k] !== q && text[k] !== '\n') k += text[k] === '\\' ? 2 : 1;
    return text[k] === q ? k + 1 : k;
  };
  const regexEnd = () => {
    let k = i + 1;
    let inClass = false;
    while (k < n && text[k] !== '\n') {
      const c = text[k];
      if (c === '\\') k += 2;
      else if (c === '[') (inClass = true), k++;
      else if (c === ']') (inClass = false), k++;
      else if (c === '/' && !inClass) {
        k++;
        while (k < n && /[a-z]/i.test(text[k])) k++;
        return k;
      } else k++;
    }
    return -1;
  };
  const regexMayStart = () => {
    if (prev === '' || REGEX_AFTER_CHAR.has(prev)) return true;
    return /[\w$]/.test(prev) && REGEX_AFTER_WORD.test(text.slice(Math.max(0, i - 12), i).trimEnd());
  };

  while (i < n) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '/') {
      const e = text.indexOf('\n', i);
      keepComment(e < 0 ? n : e);
    } else if (ch === '/' && next === '*') {
      const e = text.indexOf('*/', i + 2);
      keepComment(e < 0 ? n : e + 2);
    } else if (html && text.startsWith('<!--', i)) {
      const e = text.indexOf('-->', i + 4);
      keepComment(e < 0 ? n : e + 3);
    } else if (ch === "'" || ch === '"') {
      i = quotedEnd(ch);
      prev = ch;
    } else if (ch === '`') {
      i++;
      skipTemplateText();
      prev = '`';
    } else if (ch === '/' && regexMayStart() && regexEnd() > 0) {
      i = regexEnd();
      prev = '/';
    } else if (ch === '}' && templateDepth.length && templateDepth.at(-1) === 0) {
      templateDepth.pop();
      i++;
      skipTemplateText();
      prev = '`';
    } else {
      if (templateDepth.length && ch === '{') templateDepth[templateDepth.length - 1]++;
      if (templateDepth.length && ch === '}') templateDepth[templateDepth.length - 1]--;
      code[i] = ch;
      if (!/\s/.test(ch)) prev = ch;
      i++;
    }
  }
  return { code: code.join(''), comments: comments.join('') };
}

function lineNumbers(text, re) {
  const out = [];
  let line = 1;
  let last = 0;
  for (const m of text.matchAll(re)) {
    for (let k = last; k < m.index; k++) if (text[k] === '\n') line++;
    last = m.index;
    out.push(line);
  }
  return out;
}

/** 한 파일 글에서 종류별로 나온 줄 번호 (한 줄에 두 번 나오면 두 번) */
export function countText(text, file) {
  const { code, comments } = splitCodeAndComments(String(text), file);
  const out = {};
  for (const [kind, re] of Object.entries(CODE_PATTERNS)) out[kind] = lineNumbers(code, re);
  out.disable = lineNumbers(comments, COMMENT_PATTERN);
  return out;
}

function sourceFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return sourceFiles(p);
      return SOURCE_EXT.has(path.extname(e.name)) ? [p] : [];
    });
}

/** 폴더 아래 소스 전체: 종류별 [{ file: 'src/…', line }] */
export function scanDir(dir = DEFAULT_SRC) {
  const found = Object.fromEntries(KINDS.map((k) => [k, []]));
  const base = path.dirname(dir);
  for (const f of sourceFiles(dir)) {
    const rel = path.relative(base, f).split(path.sep).join('/');
    const c = countText(fs.readFileSync(f, 'utf8'), f);
    for (const k of KINDS) for (const line of c[k]) found[k].push({ file: rel, line });
  }
  return found;
}

// 숫자를 읽은 소리의 끝(영·삼·육·십·백·천·만)에 받침이 있으면 "으로"
const towards = (n) => `${n}${/[036]$/.test(String(n)) ? '으로' : '로'}`;

/** 찾은 것과 기준값을 비교: { failed, lines } */
export function compare(found, baseline, baselineName = 'debt-baseline.json') {
  const bad = KINDS.filter((k) => !Number.isInteger(baseline?.[k]) || baseline[k] < 0);
  if (bad.length) return { failed: true, lines: [`땜질 계수기 실패: ${baselineName} 에 ${bad.join(', ')} 기준값이 없거나 0 이상의 정수가 아닙니다`] };

  const lines = [];
  const grew = KINDS.filter((k) => found[k].length > baseline[k]);
  const shrank = KINDS.filter((k) => found[k].length < baseline[k]);
  for (const k of grew) {
    lines.push(`✕ ${LABEL[k]}: 현재 ${found[k].length}, 기준값 ${baseline[k]} (${found[k].length - baseline[k]}곳 늘었습니다). 지금 있는 곳:`);
    for (const { file, line } of found[k]) lines.push(`    ${file}:${line}`);
  }
  for (const k of shrank)
    lines.push(`↓ ${LABEL[k]}: 현재 ${found[k].length}, 기준값 ${baseline[k]}. ${baselineName} 의 "${k}" 기준값을 ${towards(found[k].length)} 낮추세요`);

  const summary = KINDS.map((k) => `${LABEL[k]} ${found[k].length}`).join(' · ');
  if (grew.length) lines.push(`땜질 계수기 실패: 기준값보다 늘었습니다. 새 땜질을 넣지 말고 원인을 고치세요(CLAUDE.md 12)`);
  else if (shrank.length) lines.push(`땜질 계수기 통과: ${summary} (줄어든 만큼 기준값을 낮추세요)`);
  else lines.push(`땜질 계수기 통과: ${summary} (기준값과 같음)`);
  return { failed: grew.length > 0, lines };
}

function argValue(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? path.resolve(argv[i + 1]) : fallback;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const argv = process.argv.slice(2);
  const src = argValue(argv, '--src', DEFAULT_SRC);
  const baselineFile = argValue(argv, '--baseline', BASELINE_FILE);
  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  } catch (e) {
    console.log(`땜질 계수기 실패: 기준값 파일을 읽지 못했습니다(${path.basename(baselineFile)}: ${e.message})`);
    process.exit(1);
  }
  const r = compare(scanDir(src), baseline, path.basename(baselineFile));
  for (const l of r.lines) console.log(l);
  process.exit(r.failed ? 1 : 0);
}
