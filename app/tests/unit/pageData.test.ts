// 페이지 공통 계산(src/lib/pageData.ts): 노트북 파일 이름은 경로의 마지막 조각(split('/').pop() 과 같은 결과).
import { describe, expect, it } from 'vitest';
import { fileNameOf } from '../../src/lib/pageData';

describe('fileNameOf', () => {
  it('경로의 마지막 조각을 돌려준다(split("/").pop() 과 같다)', () => {
    for (const p of ['notebooks/L01/micrograd_student.ipynb', 'micrograd_student.ipynb', 'a/b/', '', '/x.ipynb']) expect(fileNameOf(p), p).toBe(p.split('/').pop());
  });
});
