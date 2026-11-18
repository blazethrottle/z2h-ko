// 랜딩 "수료까지의 길"과 홈 강의 목록의 누적 점검 줄은 같은 출처(content/lectures.yaml = docs/CURRICULUM.md 에서 옮긴 값)에서 나온다.
// 전체 시간(편별 예상 시간·사전 기초 합계)은 보이지 않는다(2026-11-18 결정: 전체 시간 표시 안 함). 단계 수는 영상 구간 정본에서 센다.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { LANDING } from '../../src/content/landing.mjs';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import { checkpointHeadKo, checkpointRangeKo } from '../../src/lib/curriculumText';
import { landingPathRows } from '../../src/lib/landingPath';

interface Cp {
  checkpoint_id: string;
  covers: string[];
  after_lecture: string;
  items_ko: string;
  question_count: number;
}
const LIST: { checkpoints: Cp[] } = YAML.parse(fs.readFileSync(path.join(REPO_ROOT, 'content/lectures.yaml'), 'utf8'));
const rows = landingPathRows(LANDING.path.rows, { checkpoints: LIST.checkpoints, stepCounts: { L01: 58 } });
const TIME = /\d+\s*시간|추정/;

describe('랜딩 수료까지의 길: 누적 점검은 lectures.yaml 에서, 시간은 없다', () => {
  it('문구 파일에는 편별 시간·문항 수 숫자가 없다', () => {
    for (const r of LANDING.path.rows) {
      expect(r, r.mark).not.toHaveProperty('hours');
      expect(r, r.mark).not.toHaveProperty('questions');
    }
  });
  it('누적 점검 줄: 문항 수·범위·구성은 설계서 값(홈과 같은 함수)', () => {
    for (const cp of LIST.checkpoints) {
      const r = rows.find((x) => x.mark === cp.checkpoint_id);
      expect(r, cp.checkpoint_id).toBeTruthy();
      expect(r?.meta).toContain(`${cp.question_count}문항`);
      expect(r?.meta).toContain(cp.items_ko);
      expect(r?.promise).toContain(checkpointRangeKo(cp.covers));
      expect(checkpointHeadKo(cp)).toBe(`누적 점검 ${cp.checkpoint_id.slice(2)} (${checkpointRangeKo(cp.covers)}, ${cp.question_count}문항)`);
    }
  });
  it('편 줄은 단계 수만, 사전 기초 줄은 덧붙임 없음(편별 시간·기초 합계 시간 없음)', () => {
    expect(rows.find((x) => x.lecture_id === 'L01')?.meta).toBe('58단계');
    for (const r of rows) expect(r.meta, r.mark).not.toMatch(TIME);
    expect(rows[0].meta).toBe('');
    expect(checkpointRangeKo(['L04', 'L05', 'L06'])).toBe('04~06편');
  });
});
