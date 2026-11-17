// 익힘 판정 (DESIGN.md 12.7절, data-spec mastery_state, hints.md 3절).
// P1: 단계 완료 + 문제 점수(힌트 비율 반영) + 재구성 H2 이하를 계산. 말하기 질문은 스스로 표시.

import { bestQuestionScore } from './grading';

type Row = Record<string, any>;

export interface MasteryInput {
  stepIds: string[];
  questions: { question_id: string; max_points: number; must_pass: boolean }[];
  rebuildIds: string[];
  rule: { steps_complete_ratio: number; question_score_ratio: number; question_min_points?: number; rebuild_max_hint_level: number; extra_checks: string[] };
  stepRows: Row[];
  attemptRows: Row[];
  rebuildRows: Row[];
  extraChecks: Record<string, boolean>;
}

export interface MasteryResult {
  state: 'open' | 'in_progress' | 'almost' | 'mastered';
  steps_done_ratio: number;
  question_score_ratio: number;
  must_pass_ok: boolean;
  rebuild_ok: boolean;
  extra_checks_ok: boolean;
}

const round4 = (x: number) => Math.round(x * 10000) / 10000;

export function computeMastery(i: MasteryInput): MasteryResult {
  const statusOf = new Map(i.stepRows.map((r) => [r.step_id, r.status]));
  const doneCount = i.stepIds.filter((s) => ['done', 'skipped_optional'].includes(statusOf.get(s))).length;
  const steps_done_ratio = i.stepIds.length ? round4(doneCount / i.stepIds.length) : 0;

  let got = 0;
  let total = 0;
  let must_pass_ok = true;
  for (const q of i.questions) {
    const atts = i.attemptRows.filter((a) => a.question_id === q.question_id);
    const best = bestQuestionScore(atts);
    if (!best.excluded) {
      got += best.points;
      total += q.max_points;
    }
    if (q.must_pass && !atts.some((a) => a.is_correct === true)) must_pass_ok = false;
  }
  const question_score_ratio = total ? round4(got / total) : 0;

  let rebuild_ok = true;
  let rebuildPassedAnyHint = true;
  for (const id of i.rebuildIds) {
    const rows = i.rebuildRows.filter((r) => r.rebuild_id === id && r.passed === true);
    if (!rows.some((r) => Number(r.max_hint_level ?? 0) <= i.rule.rebuild_max_hint_level)) rebuild_ok = false;
    if (!rows.length) rebuildPassedAnyHint = false;
  }

  const extra_checks_ok = i.rule.extra_checks.every((k) => i.extraChecks[k] === true);
  const stepsOk = steps_done_ratio >= i.rule.steps_complete_ratio;
  // 정본 mastery_rule 에 최소 점수(question_min_points)가 있으면 비율과 함께 둘 다 넘어야 한다.
  const minPointsOk = i.rule.question_min_points == null || got >= i.rule.question_min_points;
  const scoreOk = question_score_ratio >= i.rule.question_score_ratio && minPointsOk && must_pass_ok;
  const anyActivity = i.stepRows.length > 0 || i.attemptRows.length > 0 || i.rebuildRows.length > 0;

  let state: MasteryResult['state'] = anyActivity ? 'in_progress' : 'open';
  if (stepsOk && scoreOk && rebuild_ok && extra_checks_ok) state = 'mastered';
  else if (stepsOk && scoreOk && !rebuild_ok && rebuildPassedAnyHint) state = 'almost';

  return { state, steps_done_ratio, question_score_ratio, must_pass_ok, rebuild_ok, extra_checks_ok };
}

export const MASTERY_LABEL: Record<string, string> = {
  locked: '잠김',
  open: '시작 전',
  in_progress: '진행 중',
  almost: '거의 익힘',
  mastered: '익힘',
  revisit: '다시 보기',
};
