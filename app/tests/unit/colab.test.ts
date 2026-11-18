// Colab 바로 열기 주소(2026-11-18 결정: 실행 장소 Colab 고정). 공개 저장소의 커밋 하나에 고정한 주소만 쓴다:
// 브랜치(main)를 가리키면 노트북이 예고 없이 바뀐다. 커밋 값은 src/config.ts 한 곳, 그 커밋에 노트북이 실제로 있는지는 git 기록으로 본다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { colabOpenUrl, config } from '../../src/config';
import { NOTEBOOKS, TASTER } from '../../src/content-config.mjs';
import { APP_DIR, REPO_ROOT } from '../../src/lib/content/load.mjs';

const FORMAT = /^https:\/\/colab\.research\.google\.com\/github\/([\w.-]+\/[\w.-]+)\/blob\/([0-9a-f]{40})\/(notebooks\/[\w./-]+\.ipynb)$/;
const NOTEBOOK_PATHS = [TASTER.notebook, ...Object.values(NOTEBOOKS).map((n) => n.student)];

function* sourceFiles(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* sourceFiles(p);
    else if (/\.(ts|tsx|mjs|astro)$/.test(e.name)) yield p;
  }
}

describe('Colab 바로 열기 주소', () => {
  it('설정 한 곳: 공개 저장소 이름과 40자리 커밋', () => {
    expect(config.colab.repo).toBe('blazethrottle/z2h-ko');
    expect(config.colab.commit).toMatch(/^[0-9a-f]{40}$/);
  });
  it('주소는 커밋 고정 형식이고, 맛보기·1편 노트북 경로를 그대로 쓴다', () => {
    for (const nb of NOTEBOOK_PATHS) {
      const url = colabOpenUrl(nb);
      const m = url.match(FORMAT);
      expect(m, url).toBeTruthy();
      expect(m?.[1]).toBe(config.colab.repo);
      expect(m?.[2]).toBe(config.colab.commit);
      expect(m?.[3]).toBe(nb);
    }
    expect(colabOpenUrl('notebooks/taster/taster.ipynb')).toBe(
      'https://colab.research.google.com/github/blazethrottle/z2h-ko/blob/c8e0ec6a107e473de60b478ca608a96a89d40273/notebooks/taster/taster.ipynb',
    );
  });
  it('저장소의 notebooks/ 안 .ipynb 가 아니면 주소를 만들지 않는다', () => {
    for (const bad of ['README.md', '../notebooks/x.ipynb', 'notebooks/../x.ipynb', 'app/notebooks/x.ipynb', 'notebooks/x.py']) expect(() => colabOpenUrl(bad), bad).toThrow();
  });
  it('그 커밋에 맛보기·1편 노트북이 있다(git 기록)', () => {
    for (const nb of NOTEBOOK_PATHS) expect(() => execFileSync('git', ['-C', REPO_ROOT, 'cat-file', '-e', `${config.colab.commit}:${nb}`]), nb).not.toThrow();
  });
  it('앱 소스에 브랜치 이름을 가리키는 Colab·GitHub 주소가 없다', () => {
    const bad: string[] = [];
    for (const f of sourceFiles(path.join(APP_DIR, 'src')))
      fs.readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/\/(?:blob|tree)\/(?:main|master)\b/.test(line)) bad.push(`${path.relative(APP_DIR, f)}:${i + 1}`);
        });
    expect(bad).toEqual([]);
  });
});
