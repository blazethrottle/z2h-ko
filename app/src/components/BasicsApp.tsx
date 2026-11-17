// 8 사전 기초 진입 /basics/ (spec 8절, 목업 s8_basics): 진단 카드(정본 purpose_ko + "자동으로 건너뛰지 않음" 줄, 마지막 결과),
// 단위 목록 2개(파이썬 최소·수학 최소), 다음 줄. 행 상태: ✓ 완료(정본 mastery_rule 익힘) / ● 지금 / 추천 / ○ 아직 / 준비 중.
// 준비 중(planned) 단위는 누를 수 없다(링크 아님). 01편은 잠그지 않는다(D37, 정본 locks false).
import { nextUnit, unitRowState, type BasicsRule } from '../lib/basics';
import { DiagnosticResultBox, NO_SKIP_KO, summaryOf, useBasicsState, type BasicsUnitPub, type DiagQuestionPub, type ResultKo } from './BasicsParts';
import { gated } from './Gate';
import { useRuntime } from './hooks';
import Inline from './Inline';

interface Props {
  units: BasicsUnitPub[];
  groups: { id: string; label_ko: string; unit_ids: string[] }[];
  rule: BasicsRule;
  diagnostic: { title_ko: string; purpose_ko: string; result_ko: ResultKo; questions: DiagQuestionPub[] };
  /** 준비된 단위를 다 마쳤을 때 다음 줄 (강의 01) */
  afterAll: { href: string; label: string } | null;
}

const ROW_CLASS: Record<string, string> = { done: 'st-done', now: 'st-now', rec: 'st-now', todo: 'st-todo', coming: 'st-todo' };

function BasicsAppView(p: Props) {
  const rt = useRuntime();
  const { t, statusOf, latest } = useBasicsState(rt, p.units, p.rule);
  const order = p.units.map((u) => u.unit_id);
  const summary = summaryOf(latest, p.diagnostic.questions, order);
  const recommended = summary?.units ?? [];
  const n = p.diagnostic.questions.length;
  const next = t ? nextUnit(p.units, statusOf, recommended) : null;
  const nextU = next ? p.units.find((u) => u.unit_id === next) : null;

  return (
    <div class="stack">
      <section class="card stack" aria-label={p.diagnostic.title_ko} data-testid="diag-card">
        <p class="small">
          <b>{p.diagnostic.title_ko}</b> · <Inline text={p.diagnostic.purpose_ko} bold />
        </p>
        <p class="small" data-testid="diag-no-skip">
          {NO_SKIP_KO}
        </p>
        <a class="btn primary" href="/basics/diagnostic/" data-testid="diag-start" style="align-self:flex-start">
          {latest ? `진단 ${n}문제 다시 풀기` : `진단 ${n}문제 풀기`}
        </a>
        {summary && <DiagnosticResultBox summary={summary} resultKo={p.diagnostic.result_ko} units={p.units} statusOf={statusOf} />}
      </section>

      <div class="basics-lists">
        {p.groups.map((g) => {
          const us = g.unit_ids.map((id) => p.units.find((u) => u.unit_id === id)!).filter(Boolean);
          const doneN = us.filter((u) => statusOf(u.unit_id) === 'done').length;
          return (
            <section class="card stack-sm" aria-labelledby={`grp-${g.id}`} data-testid={`units-${g.id}`}>
              <div class="row">
                <h2 class="t3 grow" id={`grp-${g.id}`}>
                  {g.label_ko}
                </h2>
                <span class="cap num" data-testid={`units-${g.id}-count`}>
                  {doneN} / {us.length}
                </span>
              </div>
              <ul class="list">
                {us.map((u) => {
                  const st = unitRowState(u.ready, statusOf(u.unit_id), recommended.includes(u.unit_id));
                  const inner = (
                    <>
                      <span class={`no num unit${st.key === 'now' ? ' st-now' : ''}`}>{u.unit_id}</span>
                      <span class="main semibold">{u.title_ko}</span>
                      <span class={`side small ${ROW_CLASS[st.key]}${st.label.startsWith('추천') ? ' st-now' : ''}`} data-testid={`unit-state-${u.unit_id}`}>
                        {st.label}
                      </span>
                    </>
                  );
                  return (
                    <li>
                      {u.ready ? (
                        <a class="lrow" href={`/basics/${u.unit_id}/`} data-testid={`unit-${u.unit_id}`} data-state={st.key} aria-current={st.key === 'now' ? 'step' : undefined}>
                          {inner}
                        </a>
                      ) : (
                        <div class="lrow" data-testid={`unit-${u.unit_id}`} data-state={st.key}>
                          {inner}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {nextU ? (
        <p class="next" data-testid="basics-next">
          <b>다음:</b>{' '}
          <a href={`/basics/${nextU.unit_id}/`}>
            {nextU.unit_id} · {nextU.title_ko}
          </a>
        </p>
      ) : (
        t &&
        p.afterAll && (
          <p class="next" data-testid="basics-next">
            <b>다음:</b> <a href={p.afterAll.href}>{p.afterAll.label}</a>
          </p>
        )
      )}
    </div>
  );
}

/** 마운트 전에는 안의 버튼·입력칸이 눌리지 않게 감싼다(Gate.tsx) */
export default gated(BasicsAppView, 'BasicsApp');
