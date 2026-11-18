#!/usr/bin/env node
// 빌드 결과 문구 검사 (npm run build 마지막 단계). 화면(dist)의 글에서
//  - 랜딩·맛보기·배지·공유 카드·사전 기초: 쓰지 않는 말(src/content/landing-banned.mjs, VALUE 5절·D28·spec 0.4) 0건, 긴 줄표(U+2014) 0건
//  - 랜딩·강의 화면: 학습자 화면에 내지 않는 말(src/content/learner-banned.mjs: 설계서·작업 메모, 내부 호칭) 0건.
//    빌드 결과(서버가 그린 글)만 본다: 2~10편 준비 중 안내 전부, 1편 개요·단계 화면은 처음 그린 부분(단계는 영상 칸)뿐이고
//    따라 하기·확인 문제 칸처럼 브라우저가 나중에 그리는 글(예: 준비 코드 출처)은 여기서 보지 못한다
//  - 랜딩 "예시 화면 · 문구는 공개 전 승인 대기" 표시 있음(D46)
// 을 확인한다. 어기면 종료 코드 1(빌드 실패).
// 학습자 화면 금지어를 기초·맛보기·설정 화면에 넓히지 않는 이유: 정본 F.json 의 글("설계서 2-1")과 맛보기·설정의 앱 문구("교사", "승인 뒤")가
// 아직 걸린다(그 정본 글은 이번 정리 목록 밖이라 고치지 않음). 그 글이 정리되면 HTML_LEARNER_DIRS 에 더한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBanned } from '../src/content/landing-banned.mjs';
import { findLearnerBanned } from '../src/content/learner-banned.mjs';
import { LANDING } from '../src/content/landing.mjs';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(APP, 'dist');
const HTML_COPY_DIRS = ['taste', 'badges', 'share', 'basics'];
const HTML_LEARNER_DIRS = ['lectures'];

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
  const under = (dirs) => dirs.flatMap((d) => htmlFiles(path.join(dist, d)));
  const copyFiles = [landing, ...under(HTML_COPY_DIRS)].filter((f) => fs.existsSync(f));
  const learnerFiles = [landing, ...under(HTML_LEARNER_DIRS)].filter((f) => fs.existsSync(f));
  const text = new Map();
  const textOf = (f) => (text.has(f) ? text.get(f) : text.set(f, visibleText(fs.readFileSync(f, 'utf8'))).get(f));
  for (const f of copyFiles) {
    const t = textOf(f);
    const rel = path.relative(APP, f);
    for (const b of findBanned(t)) problems.push(`${rel}: 쓰지 않는 말 "${b.match}" (${b.why})`);
    if (t.includes(String.fromCharCode(0x2014))) problems.push(`${rel}: 긴 줄표(U+2014)가 있습니다`);
    if (f === landing && !(t.includes(LANDING.sample.label) && t.includes(LANDING.sample.note)))
      problems.push(`${rel}: "${LANDING.sample.label} · ${LANDING.sample.note}" 표시가 없습니다(D46)`);
  }
  for (const f of learnerFiles) {
    const rel = path.relative(APP, f);
    for (const b of findLearnerBanned(textOf(f))) problems.push(`${rel}: 학습자 화면에 내지 않는 말 "${b.match}" (${b.why})`);
  }
  return { files: new Set([...copyFiles, ...learnerFiles]).size, problems };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const r = checkDist();
  for (const p of r.problems) console.log(`  ✕ ${p}`);
  console.log(r.problems.length ? `문구 검사 실패: ${r.problems.length}건 (화면 ${r.files}개)` : `문구 검사 통과: 화면 ${r.files}개, 쓰지 않는 말·학습자 화면 금지어·긴 줄표 0건`);
  process.exit(r.problems.length ? 1 : 0);
}
