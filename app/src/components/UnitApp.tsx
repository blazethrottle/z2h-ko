// 사전 기초 단위 개요 /basics/F-P1/ (강의 개요 spec 2절과 같은 카드·목록 줄): 목표, 단계 목록·상태, 익힘 판정, 스스로 해 보기, 다음 단위.
// 단계 화면은 1편과 같은 StepApp(영상 없음)이다. 단위 익힘(✓ 완료)은 정본 mastery_rule 그대로(lib/basics.ts unitMastery):
// 선택(optional) 단계를 뺀 단계 전부 완료 + 확인 문제 점수 비율 이상 + must_pass 문항 전부 정답 + 그 단위 스스로 해 보기 통과.
// 스스로 해 보기(정본 rebuild_tasks): 과제 글·확인 기준 그대로, 힌트 사다리(1편과 같은 부품), "직접 확인했어요" 자기 확인.
// 연 힌트 최고 단계가 max_hint_level_for_pass 이하일 때만 통과(null 은 제한 없음). 기록은 rebuild_attempt(기존 재구성 기록 표).
// figure(그림 직접 확인)는 안내 문구에만 쓴다.
import { rebuildPasses, unitMastery, type BasicsRule, type UnitMasteryRef } from '../lib/basics';
import { emptyHintState, recordAttempt, type UnlockRule } from '../lib/hints';
import { STEP_DONE } from '../lib/progress';
import type { Runtime } from '../lib/runtime';
import type { Row } from '../lib/sync/store';
import { nowKst, uuid4 } from '../lib/time';
import { gated } from './Gate';
import HintLadder, { useHintState } from './HintLadder';
import { useRuntime, useTables } from './hooks';
import { IconCheck, IconCross } from './Icons';
import Inline from './Inline';

export interface RebuildPub {
  rebuild_id: string;
  title_ko: string;
  task_ko: string;
  test_ko: string | null;
  figure: string | null;
  figure_label: string | null;
  max_hint_level_for_pass: number | null;
  hint_levels: number[];
  hint_unlock: Record<number, UnlockRule>;
}

interface Props {
  lectureId: string;
  contentVersion: string;
  basicsReady: string[];
  unit: { unit_id: string; title_ko: string; group_label: string; used_in_ko: string | null; goal_ko: string; mastery_ko: string; mastery: UnitMasteryRef };
  rule: BasicsRule;
  steps: { step_id: string; slug: string; order: number; title_ko: string; meaning_ko: string; kind: string; question_ids: string[] }[];
  rebuild: RebuildPub[];
  next: { unit_id: string; title_ko: string } | null;
}

const pct = (x: number) => Math.round(x * 100);

function limitNoteKo(limit: number | null): string {
  if (limit == null) return '힌트를 열어도 통과로 칩니다.';
  if (limit === 0) return '힌트를 열지 않고 해야 통과로 칩니다.';
  return `힌트 ${limit}단계까지 열어도 통과로 칩니다.`;
}

function RebuildCard({ rt, lectureId, r, rows, contentVersion, basicsReady }: { rt: Runtime | null; lectureId: string; r: RebuildPub; rows: Row[]; contentVersion: string; basicsReady: string[] }) {
  const [hint, setHint] = useHintState(rt, r.rebuild_id);
  const mine = rows.filter((x) => x.rebuild_id === r.rebuild_id).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const passed = mine.some((x) => x.passed === true && rebuildPasses(Number(x.max_hint_level ?? 0), r.max_hint_level_for_pass));
  const last = mine[mine.length - 1] ?? null;
  const opened = hint?.opened ?? 0;
  const overLimit = !rebuildPasses(opened, r.max_hint_level_for_pass);

  const record = (passedNow: boolean, level: number) =>
    // 열쇠는 이 기기가 만든 attempt_id, 번호(attempt_no)는 서버가 매긴다(12.5절). 1편 재구성 기록과 같은 표. 지난 시도 행은 지우지 않고 쌓인다
    rt!.store.put('rebuild_attempt', { rebuild_id: r.rebuild_id, attempt_id: uuid4(), passed: passedNow, max_hint_level: level, at: nowKst(), content_version: contentVersion });

  const confirm = async () => {
    if (!rt || !hint) return;
    const ok = rebuildPasses(opened, r.max_hint_level_for_pass);
    await record(ok, opened);
    setHint((s) => recordAttempt(s, ok, Date.now()));
  };

  /** 힌트 없이 다시 해 보기: 이 기기의 힌트 상태만 비운다. 마지막 시도 뒤에 힌트를 더 열었다면 그 단계를 통과 아님 행으로 먼저 남긴다(연 힌트 최고 단계를 잃지 않게) */
  const restart = async () => {
    if (!rt || !hint) return;
    if (opened > Number(last?.max_hint_level ?? 0)) await record(false, opened);
    setHint(() => emptyHintState(Date.now()));
  };

  return (
    <section class={`card stack${passed ? '' : ' current'}`} aria-labelledby={`rb-${r.rebuild_id}`} data-testid={`rebuild-${r.rebuild_id}`}>
      <p class="kicker">스스로 해 보기</p>
      <h3 class="t3" id={`rb-${r.rebuild_id}`}>
        {r.title_ko}
      </h3>
      <p>
        <Inline text={r.task_ko} />
      </p>
      {r.test_ko && (
        <p class="small">
          <b>확인:</b> <Inline text={r.test_ko} />
        </p>
      )}
      {r.figure && <p class="small muted">그림{r.figure_label ? `(${r.figure_label})` : ''}은 앱이 판정하지 않습니다. 노트북에 나온 그림을 보고 직접 확인해 주세요.</p>}
      <p class="cap" data-testid={`rebuild-limit-${r.rebuild_id}`}>
        {limitNoteKo(r.max_hint_level_for_pass)}
      </p>
      {passed ? (
        <div class="result ok" role="status" data-testid={`rebuild-result-${r.rebuild_id}`}>
          <span class="sym">
            <IconCheck size={20} />
          </span>
          <p class="title">통과</p>
        </div>
      ) : (
        <>
          {last && last.passed === false && (
            <div class="result ng" role="status" data-testid={`rebuild-result-${r.rebuild_id}`}>
              <span class="sym">
                <IconCross size={20} />
              </span>
              <div class="stack-sm">
                <p class="title">다시</p>
                <p>힌트를 {Number(last.max_hint_level ?? 0)}단계까지 열어서 이번에는 통과로 치지 않습니다. {limitNoteKo(r.max_hint_level_for_pass)}</p>
              </div>
            </div>
          )}
          <div class="row">
            <button type="button" class="btn primary grow" onClick={confirm} disabled={!hint} data-testid={`rebuild-ok-${r.rebuild_id}`}>
              직접 확인했어요
            </button>
            <button type="button" class="btn" onClick={() => setHint((s) => recordAttempt(s, false, Date.now()))} disabled={!hint} data-testid={`rebuild-notyet-${r.rebuild_id}`}>
              아직 안 돼요
            </button>
          </div>
          {overLimit && last?.passed === false && (
            <button type="button" class="btn ghost" onClick={restart} data-testid={`rebuild-restart-${r.rebuild_id}`}>
              힌트 없이 다시 해 보기
            </button>
          )}
          {r.hint_levels.length > 0 && (
            <HintLadder
              rt={rt}
              lectureId={lectureId}
              targetId={r.rebuild_id}
              targetTitle={r.title_ko}
              ctx="rebuild"
              noteKo={limitNoteKo(r.max_hint_level_for_pass)}
              levels={r.hint_levels}
              unlock={r.hint_unlock}
              state={hint}
              setState={setHint}
              onOpened={() => {}}
              basicsReady={basicsReady}
            />
          )}
        </>
      )}
    </section>
  );
}

function UnitAppView(p: Props) {
  const rt = useRuntime();
  const t = useTables(rt, ['step_progress', 'question_attempt', 'rebuild_attempt']);
  const rows = t?.step_progress ?? [];
  const attempts = t?.question_attempt ?? [];
  const rebuildRows = t?.rebuild_attempt ?? [];
  const statusOf = (id: string) => rows.find((r) => r.step_id === id)?.status as string | undefined;
  const required = p.steps.filter((s) => p.unit.mastery.step_ids.includes(s.step_id));
  const doneCount = required.filter((s) => STEP_DONE.has(statusOf(s.step_id))).length;
  const current = required.find((s) => !STEP_DONE.has(statusOf(s.step_id))) ?? null;
  const m = t ? unitMastery(p.unit.mastery, p.rule, rows, attempts, rebuildRows) : null;
  const st = m?.status ?? 'todo';
  const base = `/basics/${p.unit.unit_id}/`;
  const two = (n: number) => String(n).padStart(2, '0');
  // 단계는 다 했는데 문제가 남았으면, 맞히지 못한 문제가 있는 단계의 확인 문제로 보낸다
  const openQuestionStep = p.steps.find((s) => s.question_ids.some((id) => !attempts.some((a) => a.question_id === id && a.is_correct === true)));

  return (
    <div class="stack">
      <header class="stack-sm">
        <p class="cap num">
          사전 기초 · {p.unit.group_label} · {p.unit.unit_id}
        </p>
        <h1 class="t1">{p.unit.title_ko}</h1>
        {p.unit.used_in_ko && <p class="small muted">주로 필요한 편: {p.unit.used_in_ko}</p>}
        <div class="row">
          <span class="badge num">{p.steps.length}단계</span>
          <span class="badge num">확인 문제 {p.unit.mastery.questions.length}개</span>
          <span class="badge num">스스로 해 보기 {p.rebuild.length}개</span>
          <span class={`badge${st === 'done' ? ' ok' : st === 'now' ? ' cur' : ''}`} data-testid="unit-status">
            {st === 'done' ? '✓ 완료' : st === 'now' ? '● 지금' : '○ 아직'}
          </span>
        </div>
        <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={doneCount} aria-label={`${p.unit.unit_id} 진도 ${required.length}단계 중 ${doneCount}단계 완료`}>
          <i style={`width:${pct(doneCount / Math.max(1, required.length))}%`} />
        </div>
        <p class="cap num">
          {doneCount} / {required.length} 단계{required.length < p.steps.length ? ` (선택 단계 ${p.steps.length - required.length}개 제외)` : ''}
        </p>
      </header>

      <section class="card stack-sm" aria-label="목표">
        <h2 class="t3">목표</h2>
        <p data-testid="unit-goal">
          <Inline text={p.unit.goal_ko} />
        </p>
      </section>

      <section class="card stack" aria-labelledby="unit-steps-h">
        <h2 class="t2" id="unit-steps-h">
          단계 목록
        </h2>
        <ol class="list" data-testid="unit-step-list">
          {p.steps.map((s) => {
            const status = statusOf(s.step_id);
            const isNow = current?.step_id === s.step_id;
            return (
              <li>
                <a class="lrow" href={`${base}${s.slug}/`} aria-current={isNow ? 'step' : undefined} data-testid={`unit-step-${s.step_id}`}>
                  <span class="no num">{two(s.order)}</span>
                  <span class="main">
                    <span class="semibold">
                      {s.title_ko}
                      {s.kind === 'optional' ? ' (선택)' : ''}
                    </span>
                    <span class="small muted" style="display:block">
                      <Inline text={s.meaning_ko} />
                    </span>
                  </span>
                  <span class="side small">
                    {status === 'done' ? (
                      <span class="st-done">✓ 완료</span>
                    ) : status === 'skipped_optional' ? (
                      <span class="st-todo">건너뜀 (선택)</span>
                    ) : isNow ? (
                      <span class="st-now">● 지금</span>
                    ) : (
                      <span class="st-todo">○ 아직</span>
                    )}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
        {current ? (
          <a class="btn primary block" href={`${base}${current.slug}/`} data-testid="unit-continue">
            {doneCount === 0 ? `단계 ${current.order}부터 시작하기` : `단계 ${current.order} 이어서 하기`}
          </a>
        ) : st !== 'done' && openQuestionStep ? (
          <a class="btn primary block" href={`${base}${openQuestionStep.slug}/#quiz`} data-testid="unit-continue">
            확인 문제 마저 풀기
          </a>
        ) : null}
      </section>

      <section class="card stack-sm" aria-label="익힘 기준">
        <h2 class="t3">익힘 기준</h2>
        <p data-testid="unit-mastery">
          <Inline text={p.unit.mastery_ko} />
        </p>
        {m && (
          <ul class="small num" data-testid="unit-mastery-check">
            <li>
              단계 완료: {pct(m.steps_done_ratio)}% (기준 {pct(p.rule.steps_complete_ratio)}%, 선택 단계 제외)
            </li>
            <li>
              확인 문제 점수: {pct(m.question_score_ratio)}% (기준 {pct(p.rule.question_score_ratio)}%, 힌트 비율 반영)
            </li>
            <li>{p.rule.must_pass_all ? '확인 문제 모두 한 번 이상 맞히기' : '꼭 맞혀야 하는 문제 맞히기'}: {m.must_pass_ok ? '통과' : '아직'}</li>
            <li>스스로 해 보기: {m.rebuild_ok ? '통과' : '아직'}</li>
          </ul>
        )}
      </section>

      {p.rebuild.map((r) => (
        <RebuildCard rt={rt} lectureId={p.lectureId} r={r} rows={rebuildRows} contentVersion={p.contentVersion} basicsReady={p.basicsReady} />
      ))}

      <p class="next" data-testid="unit-next">
        <b>다음:</b>{' '}
        {p.next ? (
          <a href={`/basics/${p.next.unit_id}/`}>
            {p.next.unit_id} · {p.next.title_ko}
          </a>
        ) : (
          <a href="/basics/">기초 단위 목록</a>
        )}
      </p>
    </div>
  );
}

/** 마운트 전에는 안의 버튼·입력칸이 눌리지 않게 감싼다(Gate.tsx) */
export default gated(UnitAppView, 'UnitApp');
