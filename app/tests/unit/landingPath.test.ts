// 랜딩 "수료까지의 길"과 홈 강의 목록의 누적 점검 줄·편별 시간은 같은 출처(content/lectures.yaml = docs/CURRICULUM.md 에서 옮긴 값)에서 나온다.
// 랜딩 문구 파일(landing.mjs)에는 편별 시간·문항 수를 적지 않는다(다시 어긋날 수 없게).
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { LANDING } from '../../src/content/landing.mjs';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import { checkpointHeadKo, checkpointRangeKo, estimateHoursKo } from '../../src/lib/curriculumText';
import { landingPathRows } from '../../src/lib/landingPath';

interface Cp {
  checkpoint_id: string;
  covers: string[];
  after_lecture: string;
  items_ko: string;
  question_count: number;
}
interface Lec {
  lecture_id: string;
  plan: { total_minutes: number };
}
const LIST: { lectures: Lec[]; checkpoints: Cp[] } = YAML.parse(fs.readFileSync(path.join(REPO_ROOT, 'content/lectures.yaml'), 'utf8'));
const F: { lecture: { units: { estimated_minutes: number }[] } } = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/F.json'), 'utf8'));
const basicsMinutes = F.lecture.units.reduce((a, u) => a + u.estimated_minutes, 0);
const rows = landingPathRows(LANDING.path.rows, { lectures: LIST.lectures, checkpoints: LIST.checkpoints, basicsMinutes, stepCounts: { L01: 58 } });

describe('랜딩 수료까지의 길: 누적 점검·편별 시간은 lectures.yaml 에서', () => {
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
  it('편 줄의 시간은 설계서 합계(분)를 시간으로 옮긴 추정, 사전 기초는 정본 단위 예상 분의 합', () => {
    for (const l of LIST.lectures) expect(rows.find((x) => x.lecture_id === l.lecture_id)?.meta, l.lecture_id).toContain(estimateHoursKo(l.plan.total_minutes));
    expect(rows[0].meta).toContain(estimateHoursKo(basicsMinutes));
    expect(rows.find((x) => x.lecture_id === 'L01')?.meta).toContain('58단계');
  });
  it('시간 글은 추정 표시를 단다', () => {
    expect(estimateHoursKo(811)).toBe('약 14시간(추정)');
    expect(estimateHoursKo(20)).toBe('약 1시간(추정)');
    expect(checkpointRangeKo(['L04', 'L05', 'L06'])).toBe('04~06편');
  });
});
