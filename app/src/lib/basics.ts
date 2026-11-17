// 사전 기초 계산 (spec 8절, 정본 F.json lecture.diagnostic·recommend_rules·mastery_rule). 화면이 없는 순수 함수.
// - 진단은 추천만 한다(정본 hints·locks_anything false). 결과는 diagnostic_result 표에만 쓰고 익힘·배지 점수에 넣지 않는다.
// - "모르겠어요"(고르기는 정본 dont_know_index 보기, 직접 입력은 단추)는 감점 없이 오답으로 기록하고 추천에만 쓴다.
// - 추천(정본 recommend_rules): diagnostic = 틀리거나 모르겠어요인 문항의 recommend_units_if_wrong 을 합쳐 단위 순서로, always_first = 진단과 상관없이 늘.
// - 단위 익힘(✓ 완료, 정본 mastery_rule): 선택(optional)을 뺀 단계 전부 완료 + 확인 문제 점수 비율 이상(힌트 비율 반영)
//   + must_pass 문항 전부 정답 + 판정에 넣는 익힘 과제 통과(연 힌트가 max_hint_level_for_pass 이하. 정본 claude-1.1 은 판정에 넣는 과제가 없다).
import { bestQuestionScore, gradeQuestion, type GradableQuestion } from './grading';

import type { Row } from './sync/store';

export interface DiagQuestionRef {
  question_id: string;
  recommend_units_if_wrong: string[];
}

export interface DiagAnswer {
  question_id: string;
  is_correct: boolean;
  is_dont_know?: boolean;
  choice_index?: number | null;
  answer_text?: string;
}

const orderIndex = (unitOrder: string[]) => (id: string) => {
  const i = unitOrder.indexOf(id);
  return i < 0 ? unitOrder.length : i;
};

/** 추천 단위 (단위 지도 순서, 겹치면 한 번). 답이 없는 문항은 틀린 것으로 본다 */
export function recommendUnits(questions: DiagQuestionRef[], answers: DiagAnswer[], unitOrder: string[]): string[] {
  const out = new Set<string>();
  for (const q of questions) {
    const a = answers.find((x) => x.question_id === q.question_id);
    if (a?.is_correct) continue;
    for (const u of q.recommend_units_if_wrong ?? []) out.add(u);
  }
  const idx = orderIndex(unitOrder);
  return [...out].sort((a, b) => idx(a) - idx(b));
}

export function diagnosticSummary(questions: DiagQuestionRef[], answers: DiagAnswer[], unitOrder: string[]) {
  const correct = questions.filter((q) => answers.find((a) => a.question_id === q.question_id)?.is_correct).length;
  const units = recommendUnits(questions, answers, unitOrder);
  return { correct, total: questions.length, units };
}

/** 진단 한 문항 채점. 채점 규칙은 1편 확인 문제와 같은 grading.ts (choice, exact: 앞뒤 공백 무시) */
export function gradeDiagnostic(
  q: { type: string; choices?: string[] | null; dont_know_index?: number | null },
  key: { answer_index?: number | null; auto_grade: GradableQuestion['auto_grade'] | null },
  r: { choiceIndex?: number | null; text?: string; dontKnow?: boolean },
): { is_correct: boolean; is_dont_know: boolean } {
  if (r.dontKnow) return { is_correct: false, is_dont_know: true };
  const g = gradeQuestion(
    { type: q.type, max_points: 1, choices: q.choices ?? undefined, answer_index: key.answer_index ?? undefined, dont_know_index: q.dont_know_index ?? undefined, auto_grade: key.auto_grade ?? undefined },
    { text: r.text ?? '', choiceIndex: r.choiceIndex ?? undefined },
  );
  return { is_correct: g.is_correct, is_dont_know: g.is_dont_know };
}

/** 이 계정의 가장 늦은 진단 결과 (at, 없으면 updated_at 기준) */
export function latestDiagnostic(rows: Row[]): Row | null {
  const t = (r: Row) => Date.parse(String(r.at ?? r.updated_at ?? '')) || 0;
  return rows.length ? [...rows].sort((a, b) => t(a) - t(b))[rows.length - 1] : null;
}

// ---------------- 단위 익힘 ----------------

export interface BasicsRule {
  steps_complete_ratio: number;
  question_score_ratio: number;
}

/** 익힘 판정에 쓰는 단위 모양(화면 데이터). step_ids 는 제외 종류(optional)를 뺀 단계, activity_step_ids 는 모든 단계 */
export interface UnitMasteryRef {
  step_ids: string[];
  activity_step_ids?: string[];
  /** 그 단위의 모든 익힘 과제(판정에 넣지 않는 것 포함). 하나라도 하면 "● 지금" */
  activity_rebuild_ids?: string[];
  questions: { question_id: string; max_points: number; must_pass: boolean }[];
  rebuilds: { rebuild_id: string; max_hint_level_for_pass: number | null }[];
}

export type UnitStatus = 'done' | 'now' | 'todo';

export interface UnitMastery {
  status: UnitStatus;
  steps_done_ratio: number;
  question_score_ratio: number;
  steps_ok: boolean;
  score_ok: boolean;
  must_pass_ok: boolean;
  rebuild_ok: boolean;
}

/** "스스로 해 보기" 통과: 자기 확인했고, 연 힌트 최고 단계가 한도 이하(null 은 제한 없음) */
export function rebuildPasses(maxHintLevel: number, limit: number | null): boolean {
  return limit == null || maxHintLevel <= limit;
}

const round4 = (x: number) => Math.round(x * 10000) / 10000;

export function unitMastery(u: UnitMasteryRef, rule: BasicsRule, stepRows: Row[], attemptRows: Row[], rebuildRows: Row[]): UnitMastery {
  const done = (id: string) => stepRows.some((r) => r.step_id === id && (r.status === 'done' || r.status === 'skipped_optional'));
  const doneN = u.step_ids.filter(done).length;
  const steps_done_ratio = u.step_ids.length ? round4(doneN / u.step_ids.length) : 1;
  const steps_ok = steps_done_ratio >= rule.steps_complete_ratio;

  let got = 0;
  let total = 0;
  let must_pass_ok = true;
  for (const q of u.questions) {
    const atts = attemptRows.filter((a) => a.question_id === q.question_id);
    const best = bestQuestionScore(atts);
    if (!best.excluded) {
      got += best.points;
      total += q.max_points;
    }
    if (q.must_pass && !atts.some((a) => a.is_correct === true)) must_pass_ok = false;
  }
  const question_score_ratio = total ? round4(got / total) : 1;
  const score_ok = question_score_ratio >= rule.question_score_ratio;

  const rebuild_ok = u.rebuilds.every((r) =>
    rebuildRows.some((x) => x.rebuild_id === r.rebuild_id && x.passed === true && rebuildPasses(Number(x.max_hint_level ?? 0), r.max_hint_level_for_pass)),
  );

  const ids = new Set([...(u.activity_step_ids ?? u.step_ids)]);
  const qids = new Set(u.questions.map((q) => q.question_id));
  const rids = new Set(u.activity_rebuild_ids ?? u.rebuilds.map((r) => r.rebuild_id));
  const active = stepRows.some((r) => ids.has(r.step_id)) || attemptRows.some((a) => qids.has(a.question_id)) || rebuildRows.some((r) => rids.has(r.rebuild_id));
  const mastered = (ids.size > 0 || qids.size > 0) && steps_ok && score_ok && must_pass_ok && rebuild_ok;
  return {
    status: mastered ? 'done' : active ? 'now' : 'todo',
    steps_done_ratio,
    question_score_ratio,
    steps_ok,
    score_ok,
    must_pass_ok,
    rebuild_ok,
  };
}

export type RowKey = 'done' | 'now' | 'rec' | 'todo' | 'coming';

/** 목록 행 표시: ✓ 완료 / ● 지금 / 추천 이름(정본 recommend_rules label_ko) / ○ 아직 / 준비 중 (준비 중이어도 추천이면 "추천 이름 · 준비 중") */
export function unitRowState(ready: boolean, status: UnitStatus, recLabel: string | null): { key: RowKey; label: string } {
  if (!ready) return { key: 'coming', label: recLabel ? `${recLabel} · 준비 중` : '준비 중' };
  if (status === 'done') return { key: 'done', label: '✓ 완료' };
  if (status === 'now') return { key: 'now', label: '● 지금' };
  if (recLabel) return { key: 'rec', label: recLabel };
  return { key: 'todo', label: '○ 아직' };
}

/** 정본 추천 규칙 중 화면 목록에 쓰는 둘: 진단(diagnostic)과 처음이면 먼저(always_first) */
export interface RecommendLabels {
  diagnostic: { label_ko: string };
  always_first: { label_ko: string; units: string[] };
}

/** 단위 행의 추천 이름: 진단이 추천한 단위가 먼저(내 결과), 그다음 처음이면 먼저. 둘 다 아니면 null */
export function recommendLabelOf(unitId: string, diagUnits: string[], rec: RecommendLabels): string | null {
  if (diagUnits.includes(unitId)) return rec.diagnostic.label_ko;
  if (rec.always_first.units.includes(unitId)) return rec.always_first.label_ko;
  return null;
}

/** 단위 주소: 준비된(written) 단위는 그 단위 화면, 준비 중이면 기초 목록 */
export function unitHref(unitId: string, readyIds: string[] | Set<string> | null | undefined): string {
  const ready = readyIds instanceof Set ? readyIds.has(unitId) : (readyIds ?? []).includes(unitId);
  return ready ? `/basics/${unitId}/` : '/basics/';
}

/** 다음에 할 단위: 하던 단위 → 추천 단위 → 처음 안 끝난 단위 (준비된 단위만, 단위 지도 순서). 다 끝나면 null */
export function nextUnit(units: { unit_id: string; ready: boolean }[], statusOf: (id: string) => UnitStatus, recommended: string[]): string | null {
  const open = units.filter((u) => u.ready && statusOf(u.unit_id) !== 'done');
  return (
    open.find((u) => statusOf(u.unit_id) === 'now')?.unit_id ??
    open.find((u) => recommended.includes(u.unit_id))?.unit_id ??
    open[0]?.unit_id ??
    null
  );
}

/** 단위 id 인지 (홈의 "완료 단계"·이어서 하기는 강의 단계만 센다) */
export const isBasicsId = (id: unknown) => /^F-/.test(String(id ?? ''));
