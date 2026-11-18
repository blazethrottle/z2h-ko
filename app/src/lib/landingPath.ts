// 랜딩 "수료까지의 길" 줄 만들기: 문구 파일(landing.mjs)의 이름·약속에 설계서 값(content/lectures.yaml)과 단계 수를 붙인다.
// 누적 점검 범위·문항 구성은 홈·준비 중 편 안내와 같은 출처, 같은 함수(curriculumText.ts)라서 서로 어긋나지 않는다.
// 전체 시간(편별 예상 시간, 사전 기초 합계)은 붙이지 않는다(2026-11-18 결정: 전체 시간 표시 안 함).
import { checkpointRangeKo } from './curriculumText';

export interface LandingPathRowSource {
  mark: string;
  name: string;
  promise: string;
  lecture_id?: string;
  checkpoint_id?: string;
  checkpoint?: boolean;
  basics?: boolean;
}

export interface LandingPathData {
  checkpoints: readonly { checkpoint_id: string; covers: readonly string[]; items_ko: string; question_count: number }[];
  /** 편별 단계 수(영상 구간 정본에서 센 값) */
  stepCounts: Record<string, number>;
}

export interface LandingPathRow {
  mark: string;
  name: string;
  promise: string;
  /** 이름 옆 한 줄: 편은 n단계, 누적 점검은 문항 구성 = n문항, 사전 기초는 없음 */
  meta: string;
  lecture_id: string | null;
  checkpoint_id: string | null;
  checkpoint: boolean;
}

export function landingPathRows(rows: readonly LandingPathRowSource[], d: LandingPathData): LandingPathRow[] {
  return rows.map((r) => {
    const base = { mark: r.mark, name: r.name, lecture_id: r.lecture_id ?? null, checkpoint_id: r.checkpoint_id ?? null, checkpoint: !!r.checkpoint };
    if (r.checkpoint_id) {
      const cp = d.checkpoints.find((c) => c.checkpoint_id === r.checkpoint_id);
      if (!cp) throw new Error(`랜딩 ${r.mark}: content/lectures.yaml checkpoints 에 ${r.checkpoint_id}가 없습니다`);
      return { ...base, promise: r.promise.replace('{range}', checkpointRangeKo(cp.covers)), meta: `${cp.items_ko} = ${cp.question_count}문항` };
    }
    const steps = r.lecture_id ? d.stepCounts[r.lecture_id] : undefined;
    return { ...base, promise: r.promise, meta: steps ? `${steps}단계` : '' };
  });
}
