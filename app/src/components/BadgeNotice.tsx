// 배지·도장 받기: 조건이 채워지면 user_badge 행을 동기화 대기열로 저장한다(규칙 src/badge-rules.ts, 계산 src/lib/badges.ts).
// 받는 순간 알림은 그 화면 안 한 줄("배지가 생겼습니다 · 보기")뿐이다. 팝업·효과음·폭죽 없음(spec 13.4).
// 맛보기 완료 표시는 배지가 아니라 알림 줄을 띄우지 않는다(맛보기 끝 화면에 이미 "맛보기 완료"가 보인다).
import { useEffect, useState } from 'preact/hooks';
import { TASTE_MARK } from '../badge-rules';
import { awardBadges, dueAwards, type AwardContext, type AwardRow } from '../lib/badges';
import type { Runtime } from '../lib/runtime';
import { useTables } from './hooks';

/** 이 화면이 판정할 배지를 보고, 조건이 채워졌는데 행이 없으면 저장한다. 이 화면에서 새로 생긴 것만 돌려준다 */
export function useBadgeAwards(rt: Runtime | null, ctx: AwardContext): AwardRow[] {
  const t = useTables(rt, ['mastery_state', 'taster_result', 'user_badge']);
  const [fresh, setFresh] = useState<AwardRow[]>([]);
  const dueKey = t ? dueAwards(ctx, t).map((d) => d.badge_id).join(',') : '';
  useEffect(() => {
    if (!rt || !dueKey) return;
    let alive = true;
    void awardBadges(rt.store, ctx).then((w) => {
      if (alive && w.length) setFresh((f) => [...f, ...w]);
    });
    return () => {
      alive = false;
    };
  }, [rt, dueKey]);
  return fresh;
}

/** "도장이 생겼습니다 · 보기" / "배지가 생겼습니다 · 보기" 한 줄 */
export function BadgeNotice({ awards }: { awards: AwardRow[] }) {
  const shown = awards.filter((a) => a.badge_id !== TASTE_MARK.badge_id);
  if (!shown.length) return null;
  const stampOnly = shown.every((a) => a.badge_id.startsWith('STAMP-'));
  return (
    <p class="next got" role="status" data-testid="badge-notice">
      <b>{stampOnly ? '도장이 생겼습니다' : '배지가 생겼습니다'}</b>
      <span aria-hidden="true">·</span>
      <a class="btn ghost sm" href="/badges/">
        보기
      </a>
    </p>
  );
}
