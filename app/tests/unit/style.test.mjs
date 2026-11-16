import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOKENS_CSS, TOKENS_JSON, tokensToCss } from '../../scripts/gen-tokens.mjs';

const SRC = path.resolve(path.dirname(TOKENS_CSS), '..');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

describe('디자인 토큰과 화면 글', () => {
  it('tokens.css 는 tokens.json 에서 만든 그대로다(어긋나면 npm run tokens)', () => {
    const t = JSON.parse(fs.readFileSync(TOKENS_JSON, 'utf8'));
    expect(fs.readFileSync(TOKENS_CSS, 'utf8')).toBe(tokensToCss(t));
  });

  it('토큰 파일 밖에서는 hex 색을 쓰지 않는다', () => {
    const offenders = walk(SRC)
      .filter((f) => /\.(css|tsx|ts|astro|mjs)$/.test(f) && f !== TOKENS_CSS)
      .filter((f) => /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/.test(fs.readFileSync(f, 'utf8').replace(/&#\d+;|#[A-Za-z_-]*main|href="#/g, '')));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('앱 소스에 긴 줄표(U+2014)가 없다', () => {
    const offenders = walk(SRC).filter((f) => fs.readFileSync(f, 'utf8').includes('\u2014'));
    expect(offenders).toEqual([]);
  });

  it('외부 글꼴 서버·CDN·분석 스크립트 주소가 없다', () => {
    const bad = /(fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com|googletagmanager|google-analytics|youtube\.com\/iframe_api)/;
    const offenders = walk(SRC).filter((f) => bad.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
