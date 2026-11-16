// 30분 맛보기 계산 (spec 13.2, taster.md 3·4절). 화면이 없는 순수 함수와, taster_result 한 줄 저장 도우미.
// 저장 표 taster_result: 열쇠 (attempt_no, step_id), 칸 self_reported(similar|different), pasted_names_text,
// pasted_loss_start, pasted_loss_end, share_card_id, at (server/API.md 3절). 붙여 넣은 값은 앱이 확인하지 않은 값이다.
import { config } from '../config';

export const TASTER_TABLE = 'taster_result';
export type SelfReport = 'similar' | 'different';

const ONLY_AZ = /^[a-z]+$/;

export interface CleanNames {
  /** 저장·카드에 넣을 이름: 빈 줄·앞뒤 공백 빼고, a~z 만이고 maxChars 글자 이하인 줄만, 금칙어 빼고, 최대 maxNames 줄 */
  names: string[];
  /** names 를 줄바꿈으로 이은 글 (pasted_names_text 로 저장) */
  text: string;
  /** 뺀 줄 번호(빈 줄을 뺀 뒤 1부터): a~z 밖 글자가 있거나 maxChars 를 넘는 줄 → "모델 출력만 넣어 주세요".
   *  개인 정보를 잘못 붙여 넣은 경우를 생각해 자르지 않고 통째로 뺀다(P2 검수 권고 2) */
  flagged: number[];
  /** maxNames 를 넘어 버린 줄 수 */
  dropped: number;
  /** 금칙어라 뺀 이름 → "다시 실행" 권유 */
  blockedRemoved: string[];
}

export function cleanNames(
  raw: string,
  opts: { maxNames?: number; maxChars?: number; blocked?: string[] } = {},
): CleanNames {
  const maxNames = opts.maxNames ?? config.taste.maxNames;
  const maxChars = opts.maxChars ?? config.taste.maxNameChars;
  const blocked = new Set((opts.blocked ?? config.taste.blockedNames).map((b) => b.trim().toLowerCase()).filter(Boolean));
  const lines = String(raw ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const flagged: number[] = [];
  const valid: string[] = [];
  lines.forEach((l, i) => {
    if (!ONLY_AZ.test(l) || [...l].length > maxChars) flagged.push(i + 1);
    else valid.push(l);
  });
  const blockedRemoved = valid.filter((l) => blocked.has(l));
  const kept = valid.filter((l) => !blocked.has(l));
  const names = kept.slice(0, maxNames);
  return { names, text: names.join('\n'), flagged, dropped: Math.max(0, kept.length - maxNames), blockedRemoved };
}

/** 손실 칸(선택): 비우면 null, 0 이상 숫자(소수점은 점)만 */
export function parseLoss(raw: string | null | undefined): { ok: true; value: number | null } | { ok: false } {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false };
  const v = Number(s);
  return Number.isFinite(v) ? { ok: true, value: v } : { ok: false };
}

const outLines = (text: string | null | undefined) => {
  const s = String(text ?? '').replace(/\n+$/, '');
  return s === '' ? [] : s.split('\n');
};

/** "보여야 하는 것": 길면 앞 head 줄 + … + 끝 tail 줄 (한 줄만 숨기게 되면 접지 않는다) */
export function foldOutput(
  text: string | null | undefined,
  head = config.taste.outputHeadLines,
  tail = config.taste.outputTailLines,
): { lines: string[]; folded: boolean; total: number } {
  const lines = outLines(text);
  if (lines.length <= head + tail + 1) return { lines, folded: false, total: lines.length };
  return { lines: [...lines.slice(0, head), '…', ...lines.slice(lines.length - tail)], folded: true, total: lines.length };
}

/** 긴 셀이면 접을 앞부분 줄 수, 아니면 0 ("앞부분 10줄 보기") */
export function codeFold(lineCount: number, longCellLines = config.taste.longCellLines, head = config.taste.foldHeadLines): number {
  return lineCount > longCellLines ? Math.min(head, lineCount - 1) : 0;
}

/** 소수가 있는 출력에만 "환경에 따라 소수 셋째 자리가 조금 다를 수 있습니다" */
export const hasDecimal = (text: string | null | undefined) => /\d\.\d/.test(String(text ?? ''));

/** 교사 실행 출력의 손실 줄 "10 2.659" → {step, loss} */
export function parseLossLines(text: string | null | undefined): { step: number; loss: number }[] {
  return outLines(text)
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length === 2 && p.every((x) => x !== '' && Number.isFinite(Number(x))))
    .map(([a, b]) => ({ step: Number(a), loss: Number(b) }));
}

export const parseNameLines = (text: string | null | undefined) => outLines(text).map((l) => l.trim()).filter(Boolean);

/** 손실 꺾은선 그림 좌표 (인라인 SVG, 외부 차트 라이브러리 없음). y 는 손실이 클수록 위 */
export function lossChart(points: { step: number; loss: number }[], o: { width: number; height: number; pad: number }) {
  const xs = points.map((p) => p.step);
  const ys = points.map((p) => p.loss);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const sx = (x: number) => o.pad + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * (o.width - 2 * o.pad);
  const sy = (y: number) => o.pad + ((yMax - y) / Math.max(1e-9, yMax - yMin)) * (o.height - 2 * o.pad);
  const round = (v: number) => Math.round(v * 10) / 10;
  const dots = points.map((p) => ({ step: p.step, loss: p.loss, x: round(sx(p.step)), y: round(sy(p.loss)) }));
  return {
    dots,
    points: dots.map((d) => `${d.x},${d.y}`).join(' '),
    xMin,
    xMax,
    yMin,
    yMax,
    yTop: round(sy(yMax)),
    yBottom: round(sy(yMin)),
    xLeft: round(sx(xMin)),
    xRight: round(sx(xMax)),
  };
}

/** 정리 문구(T-S08 summary_ko): 마지막 문장 = 다음 길, 그 앞 = 오늘 한 일 */
export function splitSummary(summary: string | null | undefined): { today: string; next: string } {
  const parts = String(summary ?? '')
    .trim()
    .split(/(?<=다\.)\s+/)
    .filter(Boolean);
  if (parts.length <= 1) return { today: parts[0] ?? '', next: '' };
  return { today: parts.slice(0, -1).join(' '), next: parts[parts.length - 1] };
}

/** 지금 시도 번호: 이 계정 기록 중 가장 큰 attempt_no, 없으면 설정의 첫 번호 */
export function attemptOf(rows: { attempt_no?: unknown }[]): number {
  let n = 0;
  for (const r of rows) {
    const v = Number(r.attempt_no);
    if (Number.isInteger(v) && v > n) n = v;
  }
  return n || config.taste.firstAttemptNo;
}

/** 이 시도에서 직접 확인한 단계(similar), 다르게 나온 단계(different), 완료 여부 */
export function tasteStatus(rows: Record<string, any>[], attemptNo: number, requiredSteps: string[]) {
  const mine = rows.filter((r) => Number(r.attempt_no) === attemptNo);
  const confirmed = new Set(mine.filter((r) => r.self_reported === 'similar').map((r) => String(r.step_id)));
  const different = new Set(mine.filter((r) => r.self_reported === 'different').map((r) => String(r.step_id)));
  const missing = requiredSteps.filter((s) => !confirmed.has(s));
  return { confirmed, different, missing, complete: missing.length === 0 && requiredSteps.length > 0 };
}

export interface PatchStore {
  patch(table: string, key: Record<string, unknown>, changes: Record<string, unknown>): Promise<unknown>;
}

/** "직접 확인했어요 · 완료"(similar) / "다르게 나왔어요"(different). 같은 줄의 붙여 넣은 값은 그대로 둔다 */
export function saveSelfReport(store: PatchStore, p: { attemptNo: number; stepId: string; value: SelfReport; contentVersion: string; at: string }) {
  return store.patch(TASTER_TABLE, { attempt_no: p.attemptNo, step_id: p.stepId }, { self_reported: p.value, at: p.at, content_version: p.contentVersion });
}

/** 붙여 넣은 이름·손실(검증 안 된 값). 이름은 T-S07 출력이라 T-S07 줄에 둔다 */
export function saveNames(
  store: PatchStore,
  p: { attemptNo: number; stepId: string; namesText: string; lossStart: number | null; lossEnd: number | null; contentVersion: string },
) {
  return store.patch(
    TASTER_TABLE,
    { attempt_no: p.attemptNo, step_id: p.stepId },
    { pasted_names_text: p.namesText, pasted_loss_start: p.lossStart, pasted_loss_end: p.lossEnd, content_version: p.contentVersion },
  );
}
