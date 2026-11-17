// 힌트 사다리 열림 조건 (hints.md 2절, decisions C4: 앱 안 "비교하기"·"제출" = 시도 1회).
// 상태는 순수 데이터라 저장·복원이 쉽다.

export interface HintState {
  /** 지금까지 연 가장 높은 단계. 0 = 안 엶, 5 = HELP */
  opened: number;
  /** 단계별 연 시각(ms) */
  openedAt: Record<number, number>;
  /** 시도 기록(ms, 결과가 맞았는지) */
  attempts: { at: number; ok: boolean }[];
  /** 같은 단계(문제)를 처음 연 시각(ms). 15분·30분 조건 기준 */
  startedAt: number;
}

export interface UnlockRule {
  after_attempts?: number | null;
  after_minutes?: number | null;
}

export const DEFAULT_UNLOCK: Record<number, { after_attempts: number; after_minutes: number | null }> = {
  1: { after_attempts: 0, after_minutes: null },
  2: { after_attempts: 1, after_minutes: null },
  3: { after_attempts: 1, after_minutes: 15 },
  4: { after_attempts: 1, after_minutes: 30 },
};

export function emptyHintState(startedAt: number): HintState {
  return { opened: 0, openedAt: {}, attempts: [], startedAt };
}

export function nextLevel(s: HintState): number {
  return Math.min(5, s.opened + 1);
}

export function recordAttempt(s: HintState, ok: boolean, at: number): HintState {
  return { ...s, attempts: [...s.attempts, { at, ok }] };
}

export function openHint(s: HintState, level: number, at: number): HintState {
  if (level !== s.opened + 1) return s;
  return { ...s, opened: level, openedAt: { ...s.openedAt, [level]: at } };
}

function attemptsAfter(s: HintState, t: number | undefined): { at: number; ok: boolean }[] {
  if (t == null) return [];
  return s.attempts.filter((a) => a.at > t);
}

export function canOpen(s: HintState, level: number, now: number, overrides: Record<number, UnlockRule> = {}): boolean {
  if (level !== s.opened + 1) return false;
  if (level === 1) return true;
  if (level === 5) return attemptsAfter(s, s.openedAt[4]).some((a) => !a.ok);
  const rule = { ...DEFAULT_UNLOCK[level], ...(overrides[level] ?? {}) };
  const needAttempts = rule.after_attempts ?? 0;
  const byAttempts = needAttempts <= 0 || attemptsAfter(s, s.openedAt[level - 1]).length >= needAttempts;
  if (byAttempts) return true;
  const mins = rule.after_minutes;
  if (mins != null && now - s.startedAt >= mins * 60_000) return true;
  return false;
}

export type HintContext = 'step' | 'question';

/** 잠긴 칸 오른쪽 조건 글자 (spec 6절) */
export function lockText(level: number, ctx: HintContext, overrides: Record<number, UnlockRule> = {}): string {
  if (level === 5) return '정답을 넣고도 결과가 다르면 열림';
  const rule = { ...DEFAULT_UNLOCK[level], ...(overrides[level] ?? {}) };
  const act = ctx === 'step' ? '결과를 한 번 더 비교하' : '답을 한 번 더 내';
  if (rule.after_minutes != null) return `${act}거나 ${rule.after_minutes}분 뒤 열림`;
  return `${act}면 열림`;
}

/** 확인 문제 힌트 버튼 위 점수 문구 (spec 6절, D26) */
export function scoreNoteKo(level: number): string {
  switch (level) {
    case 1:
      return '이 힌트는 점수에 영향이 없습니다.';
    case 2:
      return '이 힌트를 열면 이 문제는 80%로 계산됩니다.';
    case 3:
      return '이 힌트를 열면 이 문제는 50%로 계산되고, 다음 복습에 다시 나옵니다.';
    case 4:
      return '이 힌트를 열면 이 문제는 0%로 계산됩니다. 완료는 인정되고, 내일 비슷한 새 문제로 다시 해 볼 수 있습니다.';
    default:
      return '도움 요청 메모는 점수에 들어가지 않습니다. 환경 문제였다면 점수 계산에서 뺍니다.';
  }
}

export const STEP_HINT_NOTE = '실습 단계는 점수가 없어서 힌트를 열어도 완료로 셉니다.';

export const LEVEL_NAMES: Record<number, string> = {
  1: '질문으로 생각하기',
  2: '개념과 위치 짚기',
  3: '빈칸 코드',
  4: '정답과 줄별 풀이',
  5: '도움 요청 메모',
};
