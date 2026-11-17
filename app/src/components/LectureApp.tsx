// 2 강의 개요 (spec 2절): 단계 목록·상태, 선행 기초 추천(정본 recommend_rules lecture_start: 아직 익히지 않은 단위만, 잠금 아님),
// 노트북 받기 + Colab 안내, 결과코드, 재구성 과제(정본 task_ko·확인 셀 check_code·통과 기준 pass_ko, 힌트 사다리 H4 에서 정답 코드), 익힘 판정.
// 익힘(mastered)이 되면 편 도장(user_badge, src/badge-rules.ts)을 저장하고 이 화면 안 한 줄로 알린다(spec 13.4). 도장 id 는 정본에 없으면 STAMP-{편}.
// 공유 결과물(정본 rewards.artifact)이 있으면 열리는 단계를 마친 뒤 "학습 기록 카드 만들기" 링크를 보인다(클로드 버전 L01 에는 없다).
// 익힘의 "단계 완료"는 선택(optional) 단계를 뺀다(docs/CURRICULUM.md 3-3, content-config MASTERY_EXCLUDED_KINDS).
import { useEffect } from 'preact/hooks';
import { config } from '../config';
import { MASTERY_EXCLUDED_KINDS } from '../content-config.mjs';
import { unitMastery, type BasicsRule, type UnitMasteryRef } from '../lib/basics';
import { recordAttempt, type UnlockRule } from '../lib/hints';
import { computeMastery, MASTERY_LABEL } from '../lib/mastery';
import { STEP_DONE } from '../lib/progress';
import { nowKst } from '../lib/time';
import { formatClock } from '../lib/video';
import CodeBlock from './CodeBlock';
import HintLadder, { useHintState } from './HintLadder';
import { useRuntime, useTables } from './hooks';
import { IconExternal } from './Icons';
import ResultCodePaste from './ResultCodePaste';
import Inline from './Inline';
import { gated } from './Gate';
import { BadgeNotice, useBadgeAwards } from './BadgeNotice';
import type { Runtime } from '../lib/runtime';
import type { Row } from '../lib/sync/store';

/** 1편 재구성 과제(화면). 정답 코드는 hints JSON 의 H4 에만 */
export interface LectureRebuildPub {
  rebuild_id: string;
  title_ko: string;
  task_ko: string | null;
  check_code: string | null;
  check_code_line_notes_ko: string[] | null;
  pass_ko: string | null;
  /** 확인 셀이 찍어야 하는 출력 */
  expected: string | null;
  reference: string | null;
  max_hint_level_for_pass: number;
  hint_levels: number[];
  hint_unlock: Record<number, UnlockRule>;
}

interface StepItem {
  step_id: string;
  slug: string;
  order: number;
  title_ko: string;
  meaning_ko: string;
  check_id?: string | null;
  kind: string;
}
interface Props {
  lectureId: string;
  lectureLabel: string;
  title: string;
  videoSeconds: number;
  studyHours: string | null;
  objectives: { objective_id: string; text_ko: string }[];
  /** 선행 기초 단위(정본 F.json lecture_prereq_units). href: 준비된 단위는 그 단위 화면, 아니면 기초 목록 */
  prereq: { unit_id: string; title_ko: string | null; href?: string }[];
  /** 정본 recommend_rules lecture_start 이름("이 편 전에 보면 좋아요") */
  prereqLabel: string;
  /** 선행 기초 단위의 익힘 판정 자료(아직 익히지 않은 단위만 다시 보여 준다) */
  basics: { units: { unit_id: string; ready: boolean; mastery: UnitMasteryRef }[]; rule: BasicsRule };
  /** 실행 환경(정본 lecture.env, 예 cpu) */
  env: string[];
  notebook: { name: string | null; url: string | null };
  rule: { steps_complete_ratio: number; question_score_ratio: number; question_min_points?: number; rebuild_max_hint_level: number; extra_checks: string[] };
  speak: { prompt_ko: string; rubric: string[] } | null;
  steps: StepItem[];
  questions: { question_id: string; max_points: number; must_pass: boolean }[];
  rebuild: LectureRebuildPub[];
  basicsReady: string[];
  contentVersion: string;
  /** 편 도장 id (정본 rewards.stamp.stamp_id, 없으면 STAMP-{편}) */
  stampId: string;
  /** 공유 결과물 (정본 rewards.artifact). 열리는 단계를 마치면 카드 만들기 링크 */
  artifact: { name_ko: string; unlock_step_id: string; unlock_label: string; href: string } | null;
}

/** 재구성 과제 한 조각: 과제 글, 확인 셀(붙여 넣어 실행), 통과 기준, 상태(결과코드로 들어온 기록), 힌트 사다리(연 단계가 결과코드 기록의 힌트 단계가 된다) */
function LectureRebuildCard({ rt, lectureId, r, rows, limit, basicsReady }: { rt: Runtime | null; lectureId: string; r: LectureRebuildPub; rows: Row[]; limit: number; basicsReady: string[] }) {
  const [hint, setHint] = useHintState(rt, r.rebuild_id);
  const mine = rows.filter((x) => x.rebuild_id === r.rebuild_id);
  const ok = mine.some((x) => x.passed && Number(x.max_hint_level ?? 0) <= limit);
  const noteKo = `힌트 ${r.max_hint_level_for_pass}단계까지 열어도 통과로 칩니다. 결과는 노트북 결과코드로 들어옵니다.`;
  return (
    <section class={`card stack${ok ? '' : ' current'}`} aria-labelledby={`rb-${r.rebuild_id}`} data-testid={`rebuild-${r.rebuild_id}`}>
      <div class="row">
        <p class="kicker grow">재구성 과제 · {r.rebuild_id}</p>
        <span class="side small" data-testid={`rebuild-state-${r.rebuild_id}`}>
          {ok ? <span class="st-done">✓ 통과</span> : mine.length ? <span class="st-now">다시</span> : <span class="st-todo">○ 아직</span>}
        </span>
      </div>
      <h3 class="t3" id={`rb-${r.rebuild_id}`}>
        {r.title_ko}
      </h3>
      {r.task_ko && (
        <p>
          <Inline text={r.task_ko} />
        </p>
      )}
      {r.check_code && <CodeBlock code={r.check_code} notes={r.check_code_line_notes_ko ?? []} heading="확인 셀 · 다 만든 뒤 붙여 넣어 실행 · 줄을 누르면 풀이" testId={`rebuild-check-${r.rebuild_id}`} />}
      {r.expected && (
        <div class="stack-sm">
          <p class="cap">확인 셀이 찍어야 하는 것</p>
          <pre class="out" data-testid={`rebuild-expected-${r.rebuild_id}`}>
            {r.expected}
          </pre>
        </div>
      )}
      {r.pass_ko && (
        <p class="small" data-testid={`rebuild-pass-${r.rebuild_id}`}>
          <b>통과 기준:</b> <Inline text={r.pass_ko} />
        </p>
      )}
      {r.reference && (
        <p class="cap">
          맞는지 대조할 곳: <Inline text={r.reference} />
        </p>
      )}
      {r.hint_levels.length > 0 && !ok && (
        <>
          {/* 노트북에서 확인 셀이 아직 통과하지 않을 때 누르면 시도 1회로 세어 다음 힌트가 열린다(기초 익힘 과제와 같은 규칙, hints.ts lockText rebuild) */}
          <button type="button" class="btn" onClick={() => setHint((s) => recordAttempt(s, false, Date.now()))} disabled={!hint} data-testid={`rebuild-notyet-${r.rebuild_id}`} style="align-self:flex-start">
            아직 안 돼요
          </button>
          <HintLadder rt={rt} lectureId={lectureId} targetId={r.rebuild_id} targetTitle={r.title_ko} ctx="rebuild" noteKo={noteKo} levels={r.hint_levels} unlock={r.hint_unlock} state={hint} setState={setHint} onOpened={() => {}} basicsReady={basicsReady} />
        </>
      )}
    </section>
  );
}

function LectureAppView(p: Props) {
  const rt = useRuntime();
  const t = useTables(rt, ['step_progress', 'question_attempt', 'rebuild_attempt', 'grade_result', 'user_pref', 'mastery_state']);
  const fresh = useBadgeAwards(rt, { stamps: [{ lecture_id: p.lectureId, mark: p.lectureId.slice(1), available: true, stamp_id: p.stampId, content_version: p.contentVersion }] });
  const rows = t?.step_progress ?? [];
  const statusOf = (id: string) => rows.find((r) => r.step_id === id)?.status as string | undefined;
  const ids = new Set(p.steps.map((s) => s.step_id));
  const doneCount = p.steps.filter((s) => STEP_DONE.has(statusOf(s.step_id))).length;
  const current = p.steps.find((s) => !STEP_DONE.has(statusOf(s.step_id))) ?? null;
  const grades = t?.grade_result ?? [];
  // 말하기 질문 스스로 표시는 mastery_state.extra_checks_ok(편별 행)에 저장한다 (PM 결정, 새 user_pref 키 없음)
  const savedMastery = (t?.mastery_state ?? []).find((r) => r.target_id === p.lectureId);
  const speakOk = savedMastery?.extra_checks_ok === true;
  const qids = new Set(p.questions.map((q) => q.question_id));
  const masteryStepIds = p.steps.filter((s) => !MASTERY_EXCLUDED_KINDS.includes(s.kind)).map((s) => s.step_id);
  // 선행 기초 중 아직 익히지 않은 단위만(정본 recommend_rules lecture_start). 기록을 읽기 전에는 전부 보인다
  const prereqTodo = p.prereq.filter((u) => {
    const bu = p.basics.units.find((x) => x.unit_id === u.unit_id);
    return !(t && bu?.ready && unitMastery(bu.mastery, p.basics.rule, t.step_progress ?? [], t.question_attempt ?? [], t.rebuild_attempt ?? []).status === 'done');
  });

  const m = t
    ? computeMastery({
        stepIds: masteryStepIds,
        questions: p.questions,
        rebuildIds: p.rebuild.map((r) => r.rebuild_id),
        rule: p.rule,
        stepRows: rows.filter((r) => ids.has(r.step_id)),
        attemptRows: (t.question_attempt ?? []).filter((a) => qids.has(a.question_id)),
        rebuildRows: t.rebuild_attempt ?? [],
        extraChecks: { speak_check: speakOk },
      })
    : null;

  // 익힘 상태가 바뀌면 mastery_state 에 저장
  useEffect(() => {
    if (!rt || !m || !t) return;
    const prev = (t.mastery_state ?? []).find((r) => r.target_id === p.lectureId);
    const same =
      prev &&
      prev.state === m.state &&
      prev.steps_done_ratio === m.steps_done_ratio &&
      prev.question_score_ratio === m.question_score_ratio &&
      prev.must_pass_ok === m.must_pass_ok &&
      prev.rebuild_ok === m.rebuild_ok &&
      prev.extra_checks_ok === m.extra_checks_ok;
    if (same || (!prev && m.state === 'open')) return;
    void rt.store.put('mastery_state', {
      target_id: p.lectureId,
      ...m,
      mastered_at: m.state === 'mastered' ? (prev?.mastered_at ?? nowKst()) : null,
    });
  }, [rt, m?.state, m?.steps_done_ratio, m?.question_score_ratio, m?.must_pass_ok, m?.rebuild_ok, m?.extra_checks_ok]);

  const pct = Math.round((doneCount / Math.max(1, p.steps.length)) * 100);
  const two = (n: number) => String(n).padStart(2, '0');

  return (
    <div class="stack">
      <header class="stack-sm">
        <p class="cap num">
          강의 {p.lectureId.slice(1)} · 영상 {formatClock(p.videoSeconds)}
          {p.studyHours ? ` · 학습 예상 ${p.studyHours}` : ''}
          {p.env.length > 0 ? ` · 실행 환경 ${p.env.join(', ')}` : ''}
        </p>
        <h1 class="t1">{p.title}</h1>
        <div class="row">
          <span class="badge num">{p.steps.length}단계</span>
          <span class="badge num">확인 문제 {p.questions.length}개</span>
          <span class="badge num">재구성 과제 {p.rebuild.length}조각</span>
          <span class="badge ok num">✓ {doneCount} 완료</span>
          {m && <span class="badge cur">{MASTERY_LABEL[m.state]}</span>}
        </div>
        <BadgeNotice awards={fresh} />
        <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.steps.length} aria-valuenow={doneCount} aria-label={`${p.lectureLabel} 진도 ${p.steps.length}단계 중 ${doneCount}단계 완료`}>
          <i style={`width:${pct}%`} />
        </div>
        <p class="cap num">
          {doneCount} / {p.steps.length} 단계
        </p>
        {prereqTodo.length > 0 && (
          <p class="small" data-testid="prereq">
            {p.prereqLabel}(추천, 잠금 아님):{' '}
            {prereqTodo.map((u, i) => (
              <>
                {i > 0 && ' · '}
                <a href={u.href ?? '/basics/'}>
                  {u.unit_id}
                  {u.title_ko ? ` ${u.title_ko}` : ''}
                </a>
              </>
            ))}
          </p>
        )}
        {current && (
          <p class="next">
            <b>다음:</b>{' '}
            <a href={`/lectures/${p.lectureId}/${current.slug}/`}>
              단계 {current.order} · {current.title_ko}
            </a>
          </p>
        )}
      </header>

      {p.objectives.length > 0 && (
        <details class="card">
          <summary class="label" style="min-height:44px;display:flex;align-items:center;cursor:pointer">학습 목표 {p.objectives.length}개</summary>
          <ol class="small">
            {p.objectives.map((o) => (
              <li>
                <Inline text={o.text_ko} />
              </li>
            ))}
          </ol>
        </details>
      )}

      <section class="card stack" aria-labelledby="steps-h">
        <h2 class="t2" id="steps-h">
          단계 목록
        </h2>
        <ol class="list" data-testid="step-list">
          {p.steps.map((s) => {
            const st = statusOf(s.step_id);
            const isNow = current?.step_id === s.step_id;
            const g = grades.find((x) => x.check_id === (s.check_id ?? s.step_id)) ?? null;
            return (
              <li>
                <a class="lrow" href={`/lectures/${p.lectureId}/${s.slug}/`} aria-current={isNow ? 'step' : undefined}>
                  <span class="no num">{two(s.order)}</span>
                  <span class="main">
                    <span class="semibold">{s.title_ko}</span>
                    <span class="small muted" style="display:block">
                      <Inline text={s.meaning_ko} />
                    </span>
                  </span>
                  <span class="side small">
                    {st === 'done' ? (
                      <span class="st-done">✓ 완료</span>
                    ) : st === 'skipped_optional' ? (
                      <span class="st-todo">건너뜀 (선택)</span>
                    ) : isNow ? (
                      <span class="st-now">● 지금</span>
                    ) : (
                      <span class="st-todo">○ 아직</span>
                    )}
                    {g && <span class={`badge ${g.passed ? 'ok' : 'ng'}`} style="display:flex;margin-top:4px">노트북 {g.passed ? '통과' : '다시'}</span>}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <section class="card stack-sm" id="notebook" aria-label="노트북 받기와 Colab 안내">
        <h2 class="t3">노트북 받기 · Colab에서 실행</h2>
        {config.colabOpenUrl && p.notebook.name ? (
          <a class="btn block" href={config.colabOpenUrl} target="_blank" rel="noopener noreferrer">
            Colab에서 노트북 열기 <IconExternal />
          </a>
        ) : (
          <>
            <ol class="small">
              <li>아래 "노트북 받기"로 {p.notebook.name ?? '노트북'} 파일을 내 기기에 저장합니다.</li>
              <li>
                <a href="https://colab.research.google.com/" target="_blank" rel="noopener noreferrer">
                  Google Colab
                </a>
                을 열고 파일 메뉴의 "노트북 업로드"에서 받은 파일을 고릅니다.
              </li>
              <li>단계 화면에 적힌 칸 이름(예: S04)을 찾아 코드를 붙여 넣고 실행합니다.</li>
              <li>마지막 칸의 finish()가 출력한 결과코드를 아래에 붙여 넣습니다.</li>
            </ol>
            {p.notebook.url ? (
              <a class="btn block" href={p.notebook.url} download={p.notebook.name ?? undefined} data-testid="notebook-download">
                노트북 받기
              </a>
            ) : (
              <p class="waiting" data-testid="notebook-pending">
                노트북 준비 중
              </p>
            )}
            <p class="cap">맥미니 Jupyter를 쓰면 받은 파일을 Jupyter에서 열면 됩니다(선택).</p>
          </>
        )}
      </section>

      <ResultCodePaste rt={rt} lectureId={p.lectureId} rebuildIds={p.rebuild.map((r) => r.rebuild_id)} grades={grades} />

      {p.artifact && (
        <section class="card stack-sm" aria-labelledby="artifact-h" data-testid="artifact">
          <h2 class="t3" id="artifact-h">
            {p.artifact.name_ko}
          </h2>
          {STEP_DONE.has(statusOf(p.artifact.unlock_step_id)) ? (
            <>
              <p class="small">노트북에서 나온 손실 줄을 붙여 넣으면 손실 꺾은선 카드를 만들 수 있습니다. 공유는 내가 직접 합니다.</p>
              <a class="btn block" href={p.artifact.href} data-testid="make-l01-card">
                학습 기록 카드 만들기
              </a>
            </>
          ) : (
            <p class="small" data-testid="artifact-locked">
              이 단계를 마치면 만들 수 있습니다: {p.artifact.unlock_label}
            </p>
          )}
        </section>
      )}

      <section class="card stack-sm" aria-label="핵심 재구성 과제와 익힘 판정">
        <h2 class="t3">핵심 재구성 과제 · 익힘 판정</h2>
        <p class="small">빈 노트북에서 아래 조각을 다시 만듭니다. 조각마다 힌트 {p.rule.rebuild_max_hint_level}단계 이하로 통과하면 됩니다. 결과는 노트북 결과코드로 들어옵니다.</p>
        {p.rebuild.map((r) => (
          <LectureRebuildCard rt={rt} lectureId={p.lectureId} r={r} rows={t?.rebuild_attempt ?? []} limit={p.rule.rebuild_max_hint_level} basicsReady={p.basicsReady} />
        ))}
        {m && (
          <ul class="small num" data-testid="mastery">
            <li>
              단계 완료: {Math.round(m.steps_done_ratio * 100)}% (기준 {Math.round(p.rule.steps_complete_ratio * 100)}%{masteryStepIds.length < p.steps.length ? `, 선택 단계 ${p.steps.length - masteryStepIds.length}개 제외` : ''})
            </li>
            <li>
              확인 문제 점수: {Math.round(m.question_score_ratio * 100)}% (기준 {Math.round(p.rule.question_score_ratio * 100)}%{p.rule.question_min_points != null ? `, ${p.rule.question_min_points}점 이상` : ''}, 힌트 비율 반영)
            </li>
            <li>재구성 과제: {m.rebuild_ok ? '통과' : '아직'}</li>
          </ul>
        )}
        {p.rule.extra_checks.includes('speak_check') && (
          <div class="stack-sm">
            <p class="label">말하기 질문 (스스로 표시)</p>
            {p.speak && <p class="small">{p.speak.prompt_ko}</p>}
            {p.speak && p.speak.rubric.length > 0 && (
              <ul class="small">
                {p.speak.rubric.map((r) => (
                  <li>{r}</li>
                ))}
              </ul>
            )}
            <label class="check-row">
              <input
                type="checkbox"
                checked={speakOk}
                disabled={!t}
                data-testid="speak-check"
                onChange={(e) => {
                  if (!rt || !t) return;
                  const on = (e.target as HTMLInputElement).checked;
                  const m2 = computeMastery({
                    stepIds: masteryStepIds,
                    questions: p.questions,
                    rebuildIds: p.rebuild.map((r) => r.rebuild_id),
                    rule: p.rule,
                    stepRows: rows.filter((r) => ids.has(r.step_id)),
                    attemptRows: (t.question_attempt ?? []).filter((a) => qids.has(a.question_id)),
                    rebuildRows: t.rebuild_attempt ?? [],
                    extraChecks: { speak_check: on },
                  });
                  void rt.store.put('mastery_state', { target_id: p.lectureId, ...m2, mastered_at: m2.state === 'mastered' ? (savedMastery?.mastered_at ?? nowKst()) : null });
                }}
              />
              <span>세 가지를 모두 넣어 말할 수 있습니다</span>
            </label>
          </div>
        )}
      </section>
    </div>
  );
}

/** 마운트 전에는 안의 버튼·입력칸이 눌리지 않게 감싼다(Gate.tsx) */
export default gated(LectureAppView, 'LectureApp');
