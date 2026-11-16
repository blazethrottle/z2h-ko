#!/usr/bin/env node
// inputs/design/tokens.json → app/src/styles/tokens.css (HANDOFF 3절 이름 그대로).
// 부품은 hex를 직접 쓰지 않고 이 변수만 쓴다. tokens.json 이 바뀌면 다시 돌린다: npm run tokens
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TOKENS_JSON = path.resolve(HERE, '../../inputs/design/tokens.json');
export const TOKENS_CSS = path.resolve(HERE, '../src/styles/tokens.css');

export function tokensToCss(t) {
  const lines = ['/* 자동 생성: scripts/gen-tokens.mjs ← inputs/design/tokens.json. 손으로 고치지 않는다 */', ':root {'];
  for (const group of Object.values(t.color)) {
    for (const [name, v] of Object.entries(group)) lines.push(`  --${name}: ${v.value};`);
  }
  lines.push(`  --font-ui: ${t.font.family.ui.value};`);
  lines.push(`  --font-code: ${t.font.family.code.value};`);
  for (const [k, v] of Object.entries(t.font.weight)) lines.push(`  --weight-${k}: ${v};`);
  for (const [name, v] of Object.entries(t.type)) {
    lines.push(`  --type-${name}-size: ${v.size}px;`);
    lines.push(`  --type-${name}-lh: ${v.lineHeight};`);
    lines.push(`  --type-${name}-weight: ${v.weight};`);
  }
  for (const [k, v] of Object.entries(t.space)) lines.push(`  --space-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(t.radius)) lines.push(`  --radius-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(t.size)) lines.push(`  --${k}: ${v}px;`);
  lines.push(`  --motion-duration: ${t.motion.duration};`);
  lines.push(`  --motion-easing: ${t.motion.easing};`);
  // 공유 카드 1200x675 전용 크기 (spec 13.5). canvas 가 이 변수를 읽어 그린다. lineHeight 는 단위 없음
  for (const [k, v] of Object.entries(t['share-card'] ?? {})) {
    if (k.startsWith('$')) continue;
    const name = k.replace(/-lineHeight$/, '-lh');
    lines.push(`  --share-card-${name}: ${/lineHeight$/.test(k) ? v : `${v}px`};`);
  }
  lines.push('}', '');
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t = JSON.parse(fs.readFileSync(TOKENS_JSON, 'utf8'));
  fs.writeFileSync(TOKENS_CSS, tokensToCss(t));
  console.log(`썼음: ${path.relative(process.cwd(), TOKENS_CSS)}`);
}
