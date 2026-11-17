// 배지와 편 도장 /badges/ (spec 13.4, 목업 v2_badges 왼쪽, D31·D47). 규칙은 src/badge-rules.ts 한 곳.
// - 맨 위 "맛보기 완료" 표시(배지 아님). 단계 배지 4장(받음: accent 원 / 아직: 점선 원). 편 도장은 편 목록(콘텐츠)에서 센다.
// - 단계 배지는 누적 점검 통과로 받는다(D47). 부여 계산은 아직 없다(누적 점검을 만들 때 정함). 프로토타입에는 누적 점검 화면이 없어 "아직"과 남은 것(사실)만 보인다.
// - 요약 경로 띠·"전체 길로 바꾸기"는 만들지 않는다(path_id full 고정, 프로토타입 밖). 스트릭·순위·폭죽 없음.
import { STAGE_BADGES, TASTE_MARK } from '../badge-rules';
import { lectureRefs, stageBadgeViews } from '../lib/badges';
import { useBadgeAwards } from './BadgeNotice';
import { useRuntime, useTables } from './hooks';
import { IconCheck } from './Icons';
import { gated } from './Gate';

interface Props {
  lectures: { lecture_id: string; available: boolean; stamp_id: string | null; content_version: string | null }[];
  taste: { required_steps: string[]; content_version: string } | null;
}

function BadgesAppView(p: Props) {
  const rt = useRuntime();
  const refs = lectureRefs(p.lectures);
  // 이 화면에서도 조건을 보고 받는다(다른 기기에서 익힌 편 등). 새로 생긴 것은 아래 칸 모양이 바뀌는 것으로 보인다
  useBadgeAwards(rt, { stamps: refs, taste: p.taste });
  const t = useTables(rt, ['user_badge', 'mastery_state']);
  const owned = t?.user_badge ?? [];
  const mastery = t?.mastery_state ?? [];
  const has = (id: string) => owned.some((r) => r.badge_id === id);
  const tasteDone = has(TASTE_MARK.badge_id);
  const stages = stageBadgeViews(owned, refs, mastery);

  return (
    <div class="stack" data-loaded={t ? 'true' : 'false'} data-testid="badges">
      <header class="stack-sm">
        <h1 class="t1">내 배지</h1>
        <p class="small muted" data-testid="badge-note">
          배지는 앱 안의 학습 기록이며 자격증이 아닙니다. 단계 배지는 누적 점검을 통과하면 받습니다.
        </p>
      </header>

      <p class="row" data-testid="taste-mark" data-state={tasteDone ? 'earned' : 'todo'}>
        {tasteDone ? (
          <span class="badge ok">
            <IconCheck size={14} /> {TASTE_MARK.name_ko}
          </span>
        ) : (
          <span class="badge">{TASTE_MARK.name_ko} · 아직</span>
        )}
        <span class="cap">{TASTE_MARK.note_ko}</span>
      </p>

      <section class="stack-sm" aria-labelledby="stage-h">
        <h2 class="t3" id="stage-h">
          단계 배지 {STAGE_BADGES.length}장
        </h2>
        <ul class="bgrid" data-testid="stage-badges">
          {stages.map((v) => (
            <li class={`bd${v.earned ? '' : ' no'}`} data-badge={v.rule.badge_id} data-state={v.earned ? 'earned' : 'todo'}>
              <span class="bmark num" role="img" aria-label={`단계 ${v.rule.no} 배지 ${v.earned ? '받음' : '아직'}`}>
                {v.rule.no}
              </span>
              <div class="stack-sm grow">
                <b class="bname">{v.rule.name_ko}</b>
                <span class="cap">{v.rule.condition_ko}</span>
                <span class="cap num" data-testid={`badge-status-${v.rule.badge_id}`}>
                  {v.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section class="stack-sm" aria-labelledby="stamp-h">
        <h2 class="t3" id="stamp-h">
          편 도장
        </h2>
        <p class="small muted">편을 익힐 때마다 그 편 도장을 받습니다. 짧은 길을 골라도 받을 수 있습니다.</p>
        <ul class="stamps" data-testid="stamps">
          {refs.map((l) => {
            const on = has(l.stamp_id);
            return (
              <li>
                <span class={`stamp num${on ? ' on' : ''}`} role="img" aria-label={`${l.mark}편 도장 ${on ? '받음' : '아직'}`} data-stamp={l.stamp_id} data-state={on ? 'earned' : 'todo'}>
                  {l.mark}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div class="row">
        <a class="btn" href="/share/" data-testid="to-share">
          공유 카드 만들기
        </a>
      </div>
    </div>
  );
}

/** 마운트 전에는 안의 버튼·입력칸이 눌리지 않게 감싼다(Gate.tsx) */
export default gated(BadgesAppView, 'BadgesApp');
