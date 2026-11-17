// 사전 기초 공통 부품: 진단 결과 상자(문구는 정본 lecture.diagnostic·recommend_rules 그대로), 단위 익힘 상태 읽기, 화면 데이터 모양.
// 결과 상자는 기초 진입 화면 진단 카드와 진단 화면이 같이 쓴다. 건너뛰기 버튼은 두지 않는다(D24·D37, 정본 locks_anything false).
import { diagnosticSummary, latestDiagnostic, unitHref, unitMastery, type BasicsRule, type DiagAnswer, type UnitMasteryRef, type UnitStatus } from '../lib/basics';
import type { Runtime } from '../lib/runtime';
import type { Row } from '../lib/sync/store';
import { useTables } from './hooks';

/** spec 8절 진단 카드 문구(D37: 01편 잠금 없음). 화면 틀 문구라 정본이 아니라 디자인을 따른다 */
export const NO_SKIP_KO = '자동으로 건너뛰지 않음: 결과는 추천일 뿐이고, 강의 01은 언제든 열 수 있습니다.';

export interface BasicsUnitPub {
  unit_id: string;
  group: string | null;
  title_ko: string;
  ready: boolean;
  estimated_minutes: number;
  mastery: UnitMasteryRef;
}

export interface DiagQuestionPub {
  question_id: string;
  type: 'choice' | 'predict';
  prompt_ko: string;
  code: string | null;
  choices: string[] | null;
  recommend_units_if_wrong: string[];
  /** 고르기의 "모르겠어요" 보기 번호(정본 dont_know_index) */
  dont_know_index: number | null;
  /** 직접 입력 문항에 "모르겠어요" 단추를 둘지(정본 allow_dont_know) */
  allow_dont_know: boolean;
}

/** 정본 lecture.diagnostic 의 화면 글 */
export interface DiagnosticText {
  rules_ko: string[];
  result_if_correct_ko: string;
  result_if_wrong_ko: string;
}

/** 정본 recommend_rules 4개(처음이면 먼저, 진단, 편 시작, 막혔을 때)의 이름·설명. units 는 always_first 만 채워져 있다 */
export interface RecommendRule {
  label_ko: string;
  when_ko: string;
  units: string[];
}
export type RecommendRules = Record<'always_first' | 'diagnostic' | 'lecture_start' | 'stuck', RecommendRule>;

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

/** 이 계정의 기초 단위 익힘 상태와 진단 결과 (기록 표를 읽어 화면에서 계산, 정본 mastery_rule) */
export function useBasicsState(rt: Runtime | null, units: BasicsUnitPub[], rule: BasicsRule) {
  const t = useTables(rt, ['step_progress', 'question_attempt', 'rebuild_attempt', 'diagnostic_result']);
  const statusOf = (id: string): UnitStatus => {
    const u = units.find((x) => x.unit_id === id);
    return u && u.ready && t ? unitMastery(u.mastery, rule, t.step_progress ?? [], t.question_attempt ?? [], t.rebuild_attempt ?? []).status : 'todo';
  };
  return { t, statusOf, latest: latestDiagnostic(t?.diagnostic_result ?? []) };
}

/** 단위 링크 목록 "F-P2 변수, 숫자, 계산 · F-P3 …" (준비 중 단위는 링크 없이 "(준비 중)") */
export function UnitLinks({ ids, units, testId }: { ids: string[]; units: { unit_id: string; title_ko: string; ready: boolean }[]; testId?: string }) {
  const readyIds = units.filter((u) => u.ready).map((u) => u.unit_id);
  return (
    <span data-testid={testId}>
      {ids.map((id, i) => {
        const u = units.find((x) => x.unit_id === id);
        return (
          <>
            {i > 0 && ' · '}
            {u?.ready ? (
              <a href={unitHref(id, readyIds)}>
                {id} {u.title_ko}
              </a>
            ) : (
              <span data-testid={`diag-coming-${id}`}>
                {id} {u?.title_ko ?? ''} (준비 중)
              </span>
            )}
          </>
        );
      })}
    </span>
  );
}

/** 진단 결과: 맞힌 수, 틀리거나 모르겠어요인 문제의 추천 단위(정본 result_if_wrong_ko + 진단 규칙 이름), 다 맞으면 result_if_correct_ko, 처음이면 먼저(늘) */
export function DiagnosticResultBox({
  summary,
  text,
  rules,
  units,
}: {
  summary: { correct: number; total: number; units: string[] };
  text: DiagnosticText;
  rules: RecommendRules;
  units: { unit_id: string; title_ko: string; ready: boolean }[];
}) {
  return (
    // 진단은 합격·불합격이 아니라서 점수와 상관없이 중립 상자(맞음·다시 색과 기호를 쓰지 않는다)
    <section class="card sunken stack-sm" role="status" aria-label="진단 결과" data-testid="diag-result">
      <p class="label num" data-testid="diag-score">
        {summary.correct} / {summary.total} 맞음
      </p>
      {summary.units.length > 0 ? (
        <p data-testid="diag-units">
          <b>{rules.diagnostic.label_ko}:</b> {text.result_if_wrong_ko} <UnitLinks ids={summary.units} units={units} />
        </p>
      ) : (
        <p data-testid="diag-all-correct">{text.result_if_correct_ko}</p>
      )}
      <p data-testid="diag-always">
        <b>{rules.always_first.label_ko}:</b> <UnitLinks ids={rules.always_first.units} units={units} />
      </p>
    </section>
  );
}
