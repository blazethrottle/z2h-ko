// 맛보기 첫 화면 /taste/ : 가입·로그인 없이 시작. 단계 목록(수는 콘텐츠에서 셈)과 이 기기·계정의 직접 확인 기록, 이어서 하기.
import Inline from './Inline';
import { TasteBar, tasteHref, useTaste, type TasteNav } from './TasteParts';
import { gated } from './Gate';

interface Props {
  title: string;
  promise: string;
  steps: TasteNav[];
  requiredSteps: string[];
  totalMinutes: number;
}

function TasteIntroView(p: Props) {
  const { status } = useTaste(p.requiredSteps);
  const total = p.steps.length;
  const nextUp = p.steps.find((s) => !status.confirmed.has(s.step_id)) ?? p.steps[total - 1];
  const started = status.confirmed.size > 0;
  return (
    <div class="stack">
      <header class="stack-sm">
        <p class="kicker">30분 맛보기 · 가입 없이</p>
        <h1 class="t1">{p.title}</h1>
        <p>
          <Inline text={p.promise} />
        </p>
        <p class="cap num" data-testid="taste-summary">
          {total}단계 · 약 {p.totalMinutes}분 · 영상 없이 무료 Colab에서 실행
        </p>
      </header>
      <TasteBar steps={p.steps} current={null} confirmed={status.confirmed} />
      <section class="card stack-sm" aria-label="맛보기 하는 법">
        <h2 class="t3">이렇게 합니다</h2>
        <ul class="small">
          <li>코드는 모두 붙여 넣고 실행만 합니다. 점수와 예측이 없습니다.</li>
          <li>줄마다 한국어 풀이가 붙어 있어 읽기만 하면 됩니다.</li>
          <li>앱은 Colab 화면을 읽지 못합니다. 단계마다 내 화면을 보고 "직접 확인했어요"를 누릅니다.</li>
          <li>Colab은 Google 로그인이 필요할 수 있습니다.</li>
        </ul>
      </section>
      <section class="card stack-sm" aria-labelledby="taste-steps-h">
        <h2 class="t3" id="taste-steps-h">
          {total}단계
        </h2>
        <ol class="taste-steps" data-testid="taste-steps">
          {p.steps.map((s) => {
            const done = status.confirmed.has(s.step_id);
            return (
              <li>
                <a class="lrow" href={tasteHref(s.slug)} aria-current={!done && s.step_id === nextUp.step_id && started ? 'step' : undefined}>
                  <span class="no num">{s.order}</span>
                  <span class="main">
                    {s.title_ko}
                    <span class="cap num"> · 약 {s.minutes}분</span>
                  </span>
                  <span class="side small">{done ? <span class="st-done">✓ 확인함</span> : <span class="st-todo">○ 아직</span>}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>
      <a class="btn primary block" href={tasteHref(nextUp.slug)} data-testid="taste-start">
        {started ? `이어서 하기 · ${nextUp.order} / ${total} ${nextUp.title_ko}` : `시작하기 · 1 / ${total} ${p.steps[0].title_ko}`}
      </a>
      <a class="btn block" href="/taste/precomputed/" data-testid="taste-precomputed-link">
        Colab을 못 여나요? 미리 계산한 결과 보기
      </a>
      <p class="cap">미리 계산한 결과만 본 것은 맛보기 완료로 기록하지 않습니다.</p>
    </div>
  );
}

/** 마운트 전에는 안의 버튼·입력칸이 눌리지 않게 감싼다(Gate.tsx) */
export default gated(TasteIntroView, 'TasteIntro');
