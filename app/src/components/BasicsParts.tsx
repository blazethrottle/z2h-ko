// 사전 기초 공통 부품: 진단 결과 상자(문구는 교사 정본 lecture.diagnostic.result_ko 그대로), 단위 익힘 상태 읽기, 화면 데이터 모양.
// 결과 상자는 기초 진입 화면 진단 카드와 진단 화면이 같이 쓴다. 건너뛰기 버튼은 두지 않는다(D24·D37, 정본 auto_skip false).
import { diagnosticSummary, fillTemplate, latestDiagnostic, notReadyTarget, splitUnitsTemplate, unitHref, unitMastery, type BasicsRule, type DiagAnswer, type UnitMasteryRef, type UnitStatus } from '../lib/basics';
import type { Runtime } from '../lib/runtime';
import type { Row } from '../lib/sync/store';
import { useTables } from './hooks';

/** spec 8절 진단 카드 문구(D37: 01편 잠금 없음). 화면 틀 문구라 정본이 아니라 디자인을 따른다 */
export const NO_SKIP_KO = '자동으로 건너뛰지 않음: 결과는 추천일 뿐이고, 강의 01은 언제든 열 수 있습니다.';

export interface BasicsUnitPub {
  unit_id: string;
  group: string;
  title_ko: string;
  ready: boolean;
  mastery: UnitMasteryRef;
}

export interface DiagQuestionPub {
  question_id: string;
  type: 'choice' | 'predict';
  prompt_ko: string;
  choices: string[] | null;
  recommend_units_if_wrong: string[];
  /** 직접 입력 문항에 "모르겠어요" 버튼을 둘지(정본 dont_know_allowed) */
  dont_know_allowed?: boolean;
}

/** 정본 lecture.diagnostic.result_ko (교사 글 그대로) */
export interface ResultKo {
  score_template_ko: string;
  recommend_template_ko: string;
  always_add_ko: string;
  not_ready_ko: string;
}

/** 저장된 진단 행(diagnostic_result)의 answers 를 읽는다(JSON 글자로 와도 받는다) */
export function rowAnswers(row: Row | null | undefined): DiagAnswer[] {
  if (!row) return [];
  let a: unknown = row.answers ?? row.answers_json ?? [];
  if (typeof a === 'string') {
    try {
      a = JSON.parse(a);
    } catch {
      a = [];
    }
  }
  return Array.isArray(a) ? (a as DiagAnswer[]) : [];
}

/** 결과에서 추천 단위: 저장할 때 계산한 recommended_units 가 아니라 지금 콘텐츠의 recommend_units_if_wrong 으로 다시 센다 */
export function summaryOf(row: Row | null, questions: DiagQuestionPub[], unitOrder: string[]) {
  return row ? diagnosticSummary(questions, rowAnswers(row), unitOrder) : null;
}

export function latestOf(rows: Row[] | undefined) {
  return latestDiagnostic(rows ?? []);
}

/** 이 계정의 기초 단위 익힘 상태와 진단 결과 (기록 표를 읽어 화면에서 계산, 정본 mastery_rule) */
export function useBasicsState(rt: Runtime | null, units: BasicsUnitPub[], rule: BasicsRule) {
  const t = useTables(rt, ['step_progress', 'question_attempt', 'rebuild_attempt', 'diagnostic_result']);
  const statusOf = (id: string): UnitStatus => {
    const u = units.find((x) => x.unit_id === id);
    return u && u.ready && t ? unitMastery(u.mastery, rule, t.step_progress ?? [], t.question_attempt ?? [], t.rebuild_attempt ?? []).status : 'todo';
  };
  return { t, statusOf, latest: latestOf(t?.diagnostic_result) };
}

/** 정본 문구: 점수(score_template_ko), 추천 단위 전체(recommend_template_ko, 단위 지도 순서, 준비 중 표시), 늘 붙는 문장(always_add_ko),
 *  준비 중 단위를 추천했으면 not_ready_ko + 준비된 단위로 가는 링크 */
export function DiagnosticResultBox({
  summary,
  resultKo,
  units,
  statusOf,
}: {
  summary: { correct: number; total: number; units: string[] };
  resultKo: ResultKo;
  units: { unit_id: string; title_ko: string; ready: boolean }[];
  statusOf: (id: string) => UnitStatus;
}) {
  const readyIds = units.filter((u) => u.ready).map((u) => u.unit_id);
  const [pre, post] = splitUnitsTemplate(resultKo.recommend_template_ko);
  const anyComing = summary.units.some((u) => !readyIds.includes(u));
  const target = anyComing ? notReadyTarget(units, statusOf, summary.units) : null;
  const targetUnit = target ? units.find((u) => u.unit_id === target) : null;
  return (
    // 진단은 합격·불합격이 아니라서 점수와 상관없이 중립 상자(맞음·다시 색과 기호를 쓰지 않는다)
    <section class="card sunken stack-sm" role="status" aria-label="진단 결과" data-testid="diag-result">
      <div class="stack-sm">
        <p class="label num" data-testid="diag-score">
          {fillTemplate(resultKo.score_template_ko, { correct: summary.correct, total: summary.total })}
        </p>
        {summary.units.length > 0 && (
          <p data-testid="diag-units">
            {pre}
            {summary.units.map((u, i) => (
              <>
                {i > 0 && ', '}
                {readyIds.includes(u) ? (
                  <a href={unitHref(u, readyIds)}>{u}</a>
                ) : (
                  <span data-testid={`diag-coming-${u}`}>
                    {u} (준비 중)
                  </span>
                )}
              </>
            ))}
            {post}
          </p>
        )}
        <p data-testid="diag-always">{resultKo.always_add_ko}</p>
        {anyComing && (
          <p class="small" data-testid="diag-not-ready">
            {resultKo.not_ready_ko}
            {targetUnit && (
              <>
                {' '}
                <a href={unitHref(targetUnit.unit_id, readyIds)} data-testid="diag-not-ready-link">
                  {targetUnit.unit_id} {targetUnit.title_ko}
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
