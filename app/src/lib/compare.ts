// 붙여넣기 비교 (spec 4.3, HANDOFF 8절). 숫자 허용 오차는 설정 한 곳 + 단계 tolerance 우선.

import { config } from '../config';

export type Tolerance = number | { rel?: number; abs?: number };

export interface CompareOptions {
  tolerance?: Tolerance | null;
  outputVaries?: boolean;
}

export interface CompareResult {
  ok: boolean;
  reason?: 'empty' | 'line_count' | 'text' | 'number_format' | 'number_value';
  line?: number;
  expectedLine?: string;
  actualLine?: string;
}

const NUM_RE = /[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?/g;

export function normalizeOutput(text: string): string[] {
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/u, ''));
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (lines.length) lines[0] = lines[0].replace(/^\s+/u, '');
  return lines;
}

function tol(t: Tolerance | null | undefined): { rel: number; abs: number } {
  if (t == null) return { ...config.numericTolerance };
  if (typeof t === 'number') return { rel: t, abs: 0 };
  return { rel: t.rel ?? config.numericTolerance.rel, abs: t.abs ?? config.numericTolerance.abs };
}

export function numbersClose(a: number, b: number, t: { rel: number; abs: number }): boolean {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  return diff <= t.abs || diff <= t.rel * Math.max(Math.abs(a), Math.abs(b));
}

function skeleton(line: string): string {
  return line.replace(NUM_RE, '#');
}

function compareLine(exp: string, act: string, opts: CompareOptions): CompareResult['reason'] | null {
  if (exp === act) return null;
  if (skeleton(exp) !== skeleton(act)) return 'text';
  if (opts.outputVaries) return null;
  const en = exp.match(NUM_RE) ?? [];
  const an = act.match(NUM_RE) ?? [];
  const t = tol(opts.tolerance);
  for (let i = 0; i < en.length; i++) {
    const a = Number(en[i]);
    const b = Number(an[i]);
    if (!numbersClose(a, b, t)) return 'number_value';
    // 2 와 2.0 처럼 값은 같아도 모양이 다르면 알려 준다(파이썬 float 출력 확인용)
    if (en[i].includes('.') !== an[i].includes('.')) return 'number_format';
  }
  return null;
}

export function compareOutput(expected: string, actual: string, opts: CompareOptions = {}): CompareResult {
  const act = normalizeOutput(actual);
  if (act.length === 0) return { ok: false, reason: 'empty' };
  const exp = normalizeOutput(expected);
  const n = Math.max(exp.length, act.length);
  for (let i = 0; i < n; i++) {
    const e = exp[i];
    const a = act[i];
    if (e === undefined || a === undefined) {
      return { ok: false, reason: 'line_count', line: i + 1, expectedLine: e ?? '', actualLine: a ?? '' };
    }
    const r = compareLine(e, a, opts);
    if (r) return { ok: false, reason: r, line: i + 1, expectedLine: e, actualLine: a };
  }
  return { ok: true };
}

export function looksLikeError(text: string): boolean {
  return /Traceback|Error/.test(String(text ?? ''));
}

export function parseFirstNumber(text: string): number | null {
  const m = String(text ?? '').replace(/,/g, '').match(/[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?/);
  if (!m) return null;
  const v = Number(m[0]);
  return Number.isFinite(v) ? v : null;
}

export function checkValueRange(
  text: string,
  range: { min: number; max: number },
): { ok: boolean; value: number | null; reason?: 'empty' | 'no_number' | 'out_of_range' } {
  if (String(text ?? '').trim() === '') return { ok: false, value: null, reason: 'empty' };
  const v = parseFirstNumber(text);
  if (v == null) return { ok: false, value: null, reason: 'no_number' };
  if (v < range.min || v > range.max) return { ok: false, value: v, reason: 'out_of_range' };
  return { ok: true, value: v };
}

/** 비교 결과를 사람이 읽는 한 줄로 (spec 4.3 문구) */
export function compareMessageKo(r: CompareResult): string {
  if (r.ok) return '맞음: 보여야 하는 것과 같습니다.';
  switch (r.reason) {
    case 'empty':
      return '비교할 결과가 비어 있습니다.';
    case 'line_count':
      return r.actualLine === ''
        ? `${r.line}번째 줄이 내 결과에 없습니다. 예상: ${r.expectedLine}`
        : `내 결과에 ${r.line}번째 줄이 더 있습니다: ${r.actualLine}`;
    case 'number_format':
      return `${r.line}번째 줄의 숫자 모양이 다릅니다. 예상은 ${r.expectedLine}, 내 결과는 ${r.actualLine} 입니다.`;
    case 'number_value':
      return `${r.line}번째 줄의 숫자가 다릅니다. 예상은 ${r.expectedLine}, 내 결과는 ${r.actualLine} 입니다.`;
    default:
      return `${r.line}번째 줄이 다릅니다. 예상은 ${r.expectedLine}, 내 결과는 ${r.actualLine} 입니다.`;
  }
}
