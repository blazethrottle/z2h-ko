// 배지·도장 계산 (규칙은 src/badge-rules.ts 한 곳). 화면이 없는 순수 함수 + user_badge 저장 도우미.
// user_badge(server/API.md 3절): 열쇠 badge_id, 칸 earned_at, evidence(JSON: 근거 표·id·시각), content_version.
// 앱이 쓰는 것은 편 도장과 맛보기 완료 표시뿐이고, 같은 배지는 한 번만 쓴다(이미 행이 있으면 건너뜀).
// 단계 배지(BADGE-S0~S3)는 앱이 쓰지 않는다(D47: 서버가 누적 점검 통과 기록에서 계산).
import { STAGE_BADGES, STAMP_RULE, TASTE_MARK, type StageBadgeRule } from '../badge-rules';
import { MASTERY_LABEL } from './mastery';
import { attemptOf, tasteStatus } from './taste';
import { nowKst } from './time';

type Row = Record<string, any>;

export const BADGE_TABLE = 'user_badge';

/** 편 하나 (콘텐츠 편 목록에서 만든다. 편 수는 코드에 적지 않는다) */
export interface LectureRef {
  lecture_id: string;
  /** 화면 표시 번호 "01" */
  mark: string;
  /** 앱에 내용이 있는 편인지 (없으면 "준비 중") */
  available: boolean;
  stamp_id: string;
  content_version: string | null;
}

/** 이 화면이 보고 판정할 것 */
export interface AwardContext {
  stamps?: LectureRef[];
  taste?: { required_steps: string[]; content_version: string } | null;
}

export interface AwardRow {
  badge_id: string;
  earned_at: string;
  evidence: Record<string, unknown>;
  content_version: string | null;
}

export interface BadgeTables {
  mastery_state?: Row[];
  taster_result?: Row[];
  user_badge?: Row[];
}

/** 편 목록 → 도장 참조 (도장 id 는 정본 rewards.stamp.stamp_id, 없으면 STAMP-{편}) */
export function lectureRefs(
  lectures: { lecture_id: string; available: boolean; stamp_id?: string | null; content_version?: string | null }[],
): LectureRef[] {
  return lectures.map((l) => ({
    lecture_id: l.lecture_id,
    mark: l.lecture_id.replace(/^L/, ''),
    available: !!l.available,
    stamp_id: STAMP_RULE.idOf(l.lecture_id, l.stamp_id ?? null),
    content_version: l.content_version ?? null,
  }));
}

const latestAt = (rows: Row[]) =>
  rows
    .map((r) => String(r.at ?? r.updated_at ?? ''))
    .filter(Boolean)
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .pop() ?? null;

/** 조건이 채워졌는데 아직 user_badge 행이 없는 것 (순수 함수) */
export function dueAwards(ctx: AwardContext, t: BadgeTables, now: string = nowKst()): AwardRow[] {
  const have = new Set((t.user_badge ?? []).map((r) => String(r.badge_id)));
  const out: AwardRow[] = [];
  for (const l of ctx.stamps ?? []) {
    if (have.has(l.stamp_id)) continue;
    const m = (t.mastery_state ?? []).find((r) => r.target_id === l.lecture_id);
    if (m?.state !== 'mastered') continue;
    out.push({
      badge_id: l.stamp_id,
      earned_at: now,
      evidence: { source: 'mastery_state', target_id: l.lecture_id, state: 'mastered', at: m.mastered_at ?? m.updated_at ?? null },
      content_version: l.content_version,
    });
  }
  if (ctx.taste && ctx.taste.required_steps.length && !have.has(TASTE_MARK.badge_id)) {
    const rows = t.taster_result ?? [];
    const attemptNo = attemptOf(rows);
    const st = tasteStatus(rows, attemptNo, ctx.taste.required_steps);
    if (st.complete) {
      const mine = rows.filter((r) => Number(r.attempt_no) === attemptNo && ctx.taste!.required_steps.includes(String(r.step_id)));
      out.push({
        badge_id: TASTE_MARK.badge_id,
        earned_at: now,
        evidence: { source: 'taster_result', rule_id: TASTE_MARK.badge_id, attempt_no: attemptNo, steps: ctx.taste.required_steps.length, at: latestAt(mine) },
        content_version: ctx.taste.content_version,
      });
    }
  }
  return out;
}

export interface BadgeStore {
  list(table: string): Promise<Row[]>;
  get(table: string, key: Row): Promise<Row | undefined>;
  put(table: string, row: Row): Promise<Row>;
}

// 같은 페이지의 여러 부품이 동시에 판정해도 한 번만 쓰게 차례로 처리한다
let chain: Promise<unknown> = Promise.resolve();

/** 조건이 채워진 배지를 user_badge 로 저장(동기화 대기열). 새로 쓴 행만 돌려준다 */
export function awardBadges(store: BadgeStore, ctx: AwardContext, now: () => string = nowKst): Promise<AwardRow[]> {
  const run = chain.then(async () => {
    const t: BadgeTables = {
      mastery_state: ctx.stamps?.length ? await store.list('mastery_state') : [],
      taster_result: ctx.taste ? await store.list('taster_result') : [],
      user_badge: await store.list(BADGE_TABLE),
    };
    const due = dueAwards(ctx, t, now());
    const written: AwardRow[] = [];
    for (const a of due) {
      if (await store.get(BADGE_TABLE, { badge_id: a.badge_id })) continue;
      await store.put(BADGE_TABLE, { ...a });
      written.push(a);
    }
    return written;
  });
  chain = run.catch(() => undefined);
  return run;
}

/** 받은 날 "11월 16일 받음" (KST) */
export function earnedDateKo(iso: string | null | undefined): string {
  const ms = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(ms)) return '받음';
  const k = new Date(ms + 9 * 3600_000);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 받음`;
}

/** 편 상태 글: 익힘 / 진행 중 / 거의 익힘 / 시작 전 / 준비 중(앱에 내용 없음) */
export function lectureStateKo(l: LectureRef, mastery: Row[]): string {
  if (!l.available) return '준비 중';
  const st = mastery.find((r) => r.target_id === l.lecture_id)?.state;
  return MASTERY_LABEL[st ?? 'open'] ?? MASTERY_LABEL.open;
}

/**
 * 아직 받지 않은 단계 배지의 "남은 것" 글 (지어낸 진행률 없이 사실만). 예: "아직 · 01편 진행 중, 02·03편 준비 중".
 * 기초 모듈(00)은 화면이 아직 없어 그 사실만 적는다.
 */
export function stageStatusKo(rule: StageBadgeRule, lectures: LectureRef[], mastery: Row[]): string {
  if (!rule.covers.length) return '아직 · 기초 모듈 화면 준비 중';
  const groups: { label: string; marks: string[] }[] = [];
  for (const id of rule.covers) {
    const l = lectures.find((x) => x.lecture_id === id) ?? { lecture_id: id, mark: id.replace(/^L/, ''), available: false, stamp_id: '', content_version: null };
    const label = lectureStateKo(l, mastery);
    const g = groups.find((x) => x.label === label);
    if (g) g.marks.push(l.mark);
    else groups.push({ label, marks: [l.mark] });
  }
  return `아직 · ${groups.map((g) => `${g.marks.join('·')}편 ${g.label}`).join(', ')}`;
}

/** 화면이 그릴 단계 배지 목록 (받음 = user_badge 행이 있음) */
export function stageBadgeViews(userBadges: Row[], lectures: LectureRef[], mastery: Row[]) {
  return STAGE_BADGES.map((b) => {
    const row = userBadges.find((r) => r.badge_id === b.badge_id) ?? null;
    return { rule: b, earned: !!row, status: row ? earnedDateKo(row.earned_at) : stageStatusKo(b, lectures, mastery) };
  });
}
