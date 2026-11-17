// 확인 문제 채점 (spec 5절, data-spec question, hints.md 3절).
// 채점 방식: choice, exact, numeric_range, keywords, manual.

import { parseFirstNumber } from './compare';

export interface RubricItem {
  point: number;
  criterion_ko: string;
  keywords?: string[];
}

export interface GradableQuestion {
  type: string;
  max_points?: number;
  choices?: string[];
  answer_index?: number;
  /** "모르겠어요" 보기 번호(정본 진단 문항). 고르면 감점 없이 오답으로 기록 */
  dont_know_index?: number;
  auto_grade?: {
    type: string;
    value?: string | number | (string | number)[];
    /** 같은 답의 다른 표기 */
    accept?: string[];
    min?: number;
    max?: number;
    keywords?: (string | string[])[];
  };
  rubric?: RubricItem[];
}

export interface Response {
  text?: string;
  choiceIndex?: number;
  /** 채점 기준 체크(사용자가 고른 것). 주면 keywords 자동 체크보다 우선 */
  checked?: boolean[];
}

export type Verdict = 'correct' | 'partial' | 'wrong';

export interface GradeResult {
  raw_points: number;
  max_points: number;
  verdict: Verdict;
  is_correct: boolean;
  is_dont_know: boolean;
  /** keywords 방식에서 앱이 미리 고른 채점 기준 */
  autoChecked?: boolean[];
  reason_code?: 'no_number' | 'out_of_range' | 'mismatch' | 'not_chosen' | 'rubric';
}

export function normalizeAnswer(s: string): string {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[`'"“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.。]+$/u, '')
    .toLowerCase();
}

function asNumber(s: string): number | null {
  const t = s.trim();
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

function exactMatch(answer: string, value: string | number): boolean {
  const a = normalizeAnswer(answer);
  const b = normalizeAnswer(String(value));
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na != null && nb != null) return Math.abs(na - nb) <= 1e-9 * Math.max(1, Math.abs(nb));
  return a === b;
}

function containsKeyword(text: string, kw: string): boolean {
  return normalizeAnswer(text).includes(normalizeAnswer(kw));
}

function verdictOf(raw: number, max: number): Verdict {
  if (raw >= max - 1e-9) return 'correct';
  if (raw > 1e-9) return 'partial';
  return 'wrong';
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function gradeQuestion(q: GradableQuestion, r: Response): GradeResult {
  const max = q.max_points ?? 1;
  const kind = q.auto_grade?.type ?? (q.type === 'choice' ? 'choice' : 'manual');
  const text = r.text ?? '';
  const done = (raw: number, extra: Partial<GradeResult> = {}): GradeResult => {
    const rr = round2(Math.min(max, Math.max(0, raw)));
    const v = verdictOf(rr, max);
    return { raw_points: rr, max_points: max, verdict: v, is_correct: v === 'correct', is_dont_know: false, ...extra };
  };

  if (kind === 'choice') {
    const idx = r.choiceIndex;
    if (idx == null || idx < 0) return done(0, { reason_code: 'not_chosen' });
    const dontKnow = q.dont_know_index != null && idx === q.dont_know_index;
    return done(idx === q.answer_index ? max : 0, { is_dont_know: dontKnow, reason_code: idx === q.answer_index ? undefined : 'mismatch' });
  }

  if (kind === 'exact') {
    const v = q.auto_grade?.value;
    const values = [...(Array.isArray(v) ? v : v == null ? [] : [v]), ...(q.auto_grade?.accept ?? [])];
    const ok = values.some((x) => exactMatch(text, x));
    return done(ok ? max : 0, { reason_code: ok ? undefined : 'mismatch' });
  }

  if (kind === 'numeric_range') {
    const n = parseFirstNumber(text);
    if (n == null) return done(0, { reason_code: 'no_number' });
    const lo = q.auto_grade?.min ?? -Infinity;
    const hi = q.auto_grade?.max ?? Infinity;
    const ok = n >= lo && n <= hi;
    return done(ok ? max : 0, { reason_code: ok ? undefined : 'out_of_range' });
  }

  const rubric = q.rubric ?? [];
  const sumChecked = (checked: boolean[]) => rubric.reduce((acc, it, i) => acc + (checked[i] ? it.point : 0), 0);

  if (kind === 'keywords') {
    const hasRubricKw = rubric.some((it) => it.keywords && it.keywords.length);
    if (hasRubricKw || r.checked) {
      const auto = rubric.map((it) => !!it.keywords?.some((k) => containsKeyword(text, k)));
      const used = r.checked ?? auto;
      return done(sumChecked(used), { autoChecked: auto, reason_code: 'rubric' });
    }
    const groups = (q.auto_grade?.keywords ?? []).map((g) => (Array.isArray(g) ? g : [g]));
    if (!groups.length) return done(0, { reason_code: 'rubric' });
    const hit = groups.filter((g) => g.some((k) => containsKeyword(text, k))).length;
    return done((max * hit) / groups.length, { reason_code: 'rubric' });
  }

  // manual: 사용자가 고른 채점 기준의 합
  return done(sumChecked(r.checked ?? []), { reason_code: 'rubric' });
}

/** 가장 높이 쓴 힌트 단계 → 점수 비율. 5 = HELP */
export function hintScoreRatio(maxHintLevel: number): number {
  if (maxHintLevel <= 1) return 1;
  if (maxHintLevel === 2) return 0.8;
  if (maxHintLevel === 3) return 0.5;
  return 0;
}

export function scoreAttempt(rawPoints: number, maxHintLevel: number): { score_ratio: number; points_awarded: number } {
  const score_ratio = hintScoreRatio(maxHintLevel);
  return { score_ratio, points_awarded: round2(rawPoints * score_ratio) };
}

/** 문제 하나의 점수: 시도 중 가장 높은 points_awarded. HELP + env_issue면 분모에서 뺀다 */
export function bestQuestionScore(
  attempts: { points_awarded?: number | null; max_hint_level?: number | null; env_issue?: boolean | null }[],
): { points: number; excluded: boolean } {
  if (!attempts.length) return { points: 0, excluded: false };
  const points = Math.max(...attempts.map((a) => Number(a.points_awarded ?? 0)));
  const excluded = points === 0 && attempts.some((a) => (a.max_hint_level ?? 0) >= 5 && a.env_issue === true);
  return { points, excluded };
}

/** 점수 줄: "점수 0.8 / 1 · 힌트 2단계 · 80%로 계산" */
export function scoreLineKo(points: number, max: number, maxHintLevel: number): string {
  const p = `점수 ${round2(points)} / ${max}`;
  if (maxHintLevel <= 0) return `${p} · 힌트 없이`;
  if (maxHintLevel >= 5) return `${p} · 도움 요청 · 0%로 계산`;
  return `${p} · 힌트 ${maxHintLevel}단계 · ${Math.round(hintScoreRatio(maxHintLevel) * 100)}%로 계산`;
}
