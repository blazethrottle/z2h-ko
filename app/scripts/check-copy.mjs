#!/usr/bin/env node
// 빌드 결과 문구 검사 (npm run build 마지막 단계). 랜딩·맛보기·배지·공유 카드 화면(dist)의 글에서
//  - 쓰지 않는 말(src/content/landing-banned.mjs, VALUE 5절·D28·spec 0.4) 0건
//  - 긴 줄표(U+2014) 0건
//  - 랜딩 "예시 화면 · 문구는 공개 전 승인 대기" 표시 있음(D46)
// 을 확인한다. 어기면 종료 코드 1(빌드 실패).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBanned } from '../src/content/landing-banned.mjs';
import { LANDING } from '../src/content/landing.mjs';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(APP, 'dist');

/** HTML → 화면 글 (script·style·태그·속성은 뺀다) */
export function visibleText(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

function htmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? htmlFiles(path.join(dir, e.name)) : e.name.endsWith('.html') ? [path.join(dir, e.name)] : []));
}

export function checkDist(dist = DIST) {
  const problems = [];
  const landing = path.join(dist, 'index.html');
  if (!fs.existsSync(landing)) problems.push('dist/index.html 이 없습니다(먼저 astro build)');
  const files = [landing, ...['taste', 'badges', 'share'].flatMap((d) => htmlFiles(path.join(dist, d)))].filter((f) => fs.existsSync(f));
  for (const f of files) {
    const text = visibleText(fs.readFileSync(f, 'utf8'));
    const rel = path.relative(APP, f);
    for (const b of findBanned(text)) problems.push(`${rel}: 쓰지 않는 말 "${b.match}" (${b.why})`);
    if (text.includes(String.fromCharCode(0x2014))) problems.push(`${rel}: 긴 줄표(U+2014)가 있습니다`);
    if (f === landing && !(text.includes(LANDING.sample.label) && text.includes(LANDING.sample.note)))
      problems.push(`${rel}: "${LANDING.sample.label} · ${LANDING.sample.note}" 표시가 없습니다(D46)`);
  }
  return { files: files.length, problems };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const r = checkDist();
  for (const p of r.problems) console.log(`  ✕ ${p}`);
  console.log(r.problems.length ? `문구 검사 실패: ${r.problems.length}건 (화면 ${r.files}개)` : `문구 검사 통과: 화면 ${r.files}개, 쓰지 않는 말·긴 줄표 0건`);
  process.exit(r.problems.length ? 1 : 0);
}
