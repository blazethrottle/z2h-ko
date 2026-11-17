// 단계 화면: 3 강의 구간 → 4 따라 하기 → 5 확인 문제, 6 힌트 사다리 (spec 3~6절).
// 사전 기초 단계(/basics/F-P1/S02/)도 같은 화면을 쓴다: 영상이 없으면(videoId null) 구간 칸 없이 따라 하기부터,
// 주소 머리(basePath)·개요 이름(overviewLabel)을 바꾸고, 노트북 안내 대신 "새 셀에 붙여 넣고 실행" 한 줄(notebookGuide false).
import { useEffect, useState } from 'preact/hooks';
import { config } from '../config';
import { checkValueRange, compareMessageKo, compareOutput, looksLikeError } from '../lib/compare';
import { recordAttempt } from '../lib/hints';
import { ensureStepRow, markStepDone, parsePref, patchStep, PREF_RESUME, PREF_RUN_PLACE, setPref, startStepTimer, STEP_DONE } from '../lib/progress';
import type { Segment } from '../lib/video';
import { numEulReul, numRo } from '../lib/josa';
import { answersUrl, fetchJsonOnce, hintsUrl } from '../lib/runtime';
import CodeBlock from './CodeBlock';
import EditsView, { type EditView } from './EditsView';
import Inline from './Inline';
import HintLadder, { useHintState } from './HintLadder';
import { useRuntime, useTables, useUiState } from './hooks';
import { IconCheck, IconCross, IconExternal } from './Icons';
import QuestionCard, { type PublicQuestion } from './QuestionCard';
import VideoPlayer from './VideoPlayer';
import { gated } from './Gate';

export interface PublicStep {
  step_id: string;
  slug: string;
  order: number;
  title_ko: string;
  long_step: boolean;
  new_code_lines: number;
  prepared_code: string | null;
  prepared_code_line_notes_ko?: string[] | null;
  kind: string;
  input_ko: string;
  code: string | null;
  code_line_notes_ko: string[] | null;
  expected_ko: string;
  expected_check: {
    type: 'manual' | 'output_match' | 'value_range' | 'error_match';
    min?: number;
    max?: number;
    value?: string;
    values?: Record<string, number | string> | null;
    target?: string | null;
    /** error_match: 에러가 나는 것이 정상인 단계의 에러 종류(예 NameError). 확인은 manual 처럼 스스로 (사전 기초 F-P7) */
    error_type?: string;
    /** manual 의 그림 직접 확인(사전 기초). 안내 문구에만 쓰고 채점에 쓰지 않는다 */
    figure?: string | null;
  };
  /** "실행 전 먼저 읽기" 상자(코드 위, 사전 기초) */
  read_first_ko?: string | null;
  /** 보여야 하는 것 아래 출력 예(코드 글꼴, 사전 기초) */
  expected_output_example?: string | null;
  /** figure 의 한국어 이름(content-config BASICS.figureLabels). 없으면 이름 없이 안내 */
  figure_label?: string | null;
  video_chapter_ko?: string | null;
  edit_view?: EditView | null;
  rerun_first?: { step_id: string; slug: string; title_ko: string }[];
  output_varies?: boolean;
  tolerance?: number | { rel?: number; abs?: number } | null;
  mismatch_hints_ko?: string[] | null;
  meaning_ko: string;
  summary_ko?: string[] | null;
  concept_ko?: { term: string; plain: string } | null;
  notebook_cell?: string | null;
  video_segments: Segment[];
  hint_levels: number[];
  hint_unlock: Record<number, { after_attempts?: number | null; after_minutes?: number | null }>;
  question_ids: string[];
}

export interface StepNav {
  step_id: string;
  slug: string;
  order: number;
  title_ko: string;
  video_segments: Segment[];
}

interface Props {
  lectureId: string;
  lectureLabel: string;
  /** null 이면 영상이 없는 묶음(사전 기초): 구간 칸과 플레이어를 그리지 않는다 */
  videoId: string | null;
  videoUrl: string | null;
  contentVersion: string;
  notebookName: string | null;
  step: PublicStep;
  steps: StepNav[];
  questions: PublicQuestion[];
  /** 내용이 준비된 기초 단위 id (힌트 H2의 "기초 F-xx로 돌아가 보기" 링크) */
  basicsReady?: string[];
  /** 단계 주소 머리. 기본 /lectures/{편}/ */
  basePath?: string;
  /** 단계 목록 화면 이름. 기본 "강의 개요" */
  overviewLabel?: string;
  /** false 면 노트북 받기 안내 대신 "새 셀에 붙여 넣고 실행" 한 줄 (사전 기초) */
  notebookGuide?: boolean;
  /** false 면 홈 "이어서 하기" 위치(user_pref resume)를 바꾸지 않는다 (사전 기초) */
  trackResume?: boolean;
  /** 확인 문제에서 풀이가 열린 뒤에도 맞힌 기록이 없으면 "다시 풀기" (사전 기초) */
  questionRetry?: boolean;
}

type Phase = 'segment' | 'practice' | 'quiz';
type CheckResult = { ok: boolean; kind: 'compare' | 'error' | 'empty'; message?: string };

const ERROR_STEPS = ['맨 아래 줄의 에러 종류', '그 줄의 설명', '위로 올라가 내 셀의 몇째 줄인지(---->  표시)', '그 줄의 변수 값을 print로 확인'];

function StepAppView(p: Props) {
  const rt = useRuntime();
  const t = useTables(rt, ['step_progress', 'question_attempt', 'user_pref']);
  const s = p.step;
  const total = p.steps.length;
  const idx = p.steps.findIndex((x) => x.step_id === s.step_id);
  const prev = idx > 0 ? p.steps[idx - 1] : null;
  const next = idx >= 0 && idx < total - 1 ? p.steps[idx + 1] : null;
  const hasQuiz = p.questions.length > 0;
  const hasVideo = !!p.videoId;
  const firstPhase: Phase = hasVideo ? 'segment' : 'practice';
  const base = p.basePath ?? `/lectures/${p.lectureId}/`;
  const overview = p.overviewLabel ?? '강의 개요';
  const isOptional = s.kind === 'optional';
  // 읽기 단계(kind read, 코드 없음, 사전 기초): 교사 글 세 칸과 완료 버튼만. 실행 안내·예측 칸·결과 비교·코드 상자를 그리지 않는다(1편에는 읽기 단계가 없다)
  const isRead = s.kind === 'read';

  const [phase, setPhaseRaw] = useState<Phase>(firstPhase);
  const [hint, setHint] = useHintState(rt, s.step_id);
  const [predOpen, setPredOpen] = useUiState<boolean>(rt, `pred:${s.step_id}`, false);
  const [prediction, setPrediction] = useState('');
  const [pasted, setPasted] = useState('');
  const [check, setCheck] = useState<CheckResult | null>(null);

  const rows = t?.step_progress ?? [];
  const myRow = rows.find((r) => r.step_id === s.step_id);
  const statusOf = (id: string) => rows.find((r) => r.step_id === id)?.status;
  const runPref = parsePref<string>((t?.user_pref ?? []).find((r) => r.pref_key === PREF_RUN_PLACE));
  const runLocation = runPref === 'jupyter' ? 'jupyter' : 'colab';
  const savedPrediction = myRow?.prediction ?? null;
  const revealed = predOpen || savedPrediction != null || isRead;

  useEffect(() => {
    const fromHash = () => {
      const h = (location.hash || '').replace('#', '');
      setPhaseRaw(h === 'practice' || (h === 'quiz' && hasQuiz) ? (h as Phase) : firstPhase);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  // 풀이·힌트 JSON은 화면에 그리지 않고 메모리에만 미리 받아 둔다(서버가 잠깐 끊겨도 제출·힌트가 되게)
  useEffect(() => {
    const idle = (window as any).requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 500));
    idle(() => {
      fetchJsonOnce(answersUrl(p.lectureId)).catch(() => {});
      fetchJsonOnce(hintsUrl(p.lectureId)).catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (!rt) return;
    void ensureStepRow(rt.store, s.step_id, p.contentVersion);
    return startStepTimer(rt.store, s.step_id, p.contentVersion);
  }, [rt]);

  const setPhase = (ph: Phase) => {
    setPhaseRaw(ph);
    if (rt && p.trackResume !== false) void setPref(rt.store, PREF_RESUME, { step_id: s.step_id, phase: ph });
    history.replaceState(null, '', ph === firstPhase ? location.pathname : `#${ph}`);
    window.scrollTo({ top: 0 });
  };

  const stepHref = (x: StepNav) => `${base}${x.slug}/`;
  const cell = s.notebook_cell || s.step_id;
  const prevNotDone = prev && rows.length > 0 && !STEP_DONE.has(statusOf(prev.step_id));

  const doCheck = async (ok: boolean, res: CheckResult) => {
    setCheck(res);
    if (!rt) return;
    setHint((h) => recordAttempt(h, ok, Date.now()));
    await patchStep(rt.store, s.step_id, p.contentVersion, (cur) => ({ attempts: Number(cur.attempts ?? 0) + 1 }));
  };

  const onCompare = () => {
    if (!pasted.trim()) return setCheck({ ok: false, kind: 'empty' });
    if (looksLikeError(pasted)) return void doCheck(false, { ok: false, kind: 'error' });
    if (s.expected_check.type === 'output_match') {
      const r = compareOutput(s.expected_check.value ?? '', pasted, { tolerance: s.tolerance ?? null, outputVaries: !!s.output_varies });
      void doCheck(r.ok, { ok: r.ok, kind: 'compare', message: compareMessageKo(r) });
    } else if (s.expected_check.type === 'value_range') {
      const r = checkValueRange(pasted, { min: s.expected_check.min ?? -Infinity, max: s.expected_check.max ?? Infinity });
      const msg = r.ok
        ? '맞음: 보여야 하는 것과 같습니다.'
        : r.reason === 'no_number'
          ? '숫자를 찾지 못했습니다. 출력된 숫자를 그대로 붙여 넣어 주세요.'
          : `내 값 ${r.value} 이(가) 맞는 범위(${s.expected_check.min}~${s.expected_check.max}) 밖입니다.`;
      void doCheck(r.ok, { ok: r.ok, kind: 'compare', message: msg });
    }
  };

  const finish = async () => {
    if (rt) await markStepDone(rt.store, s.step_id, p.contentVersion);
    if (hasQuiz) setPhase('quiz');
    else location.href = next ? stepHref(next) : base;
  };

  /** 선택 단계 건너뛰기 (spec 10절): status skipped_optional, 언제든 다시 할 수 있다 */
  const skipOptional = async () => {
    if (rt) await patchStep(rt.store, s.step_id, p.contentVersion, (cur) => (STEP_DONE.has(cur.status) ? null : { status: 'skipped_optional' }));
    location.href = next ? stepHref(next) : base;
  };

  const onHintOpened = async (level: number) => {
    if (!rt) return;
    await patchStep(rt.store, s.step_id, p.contentVersion, (cur) => (level > Number(cur.max_hint_level ?? 0) ? { max_hint_level: level } : null));
  };

  const header = (
    <header class="stack-sm">
      <p class="cap num" data-testid="step-position">
        {p.lectureLabel} · 단계 {s.order} / {total} · {s.step_id}
        {phase === 'practice' ? ' · 따라 하기' : phase === 'quiz' ? ' · 확인 문제' : ''}
      </p>
      <h1 class="t1">
        {s.title_ko} {s.long_step && <span class="badge">(긴 단계)</span>} {isOptional && <span class="badge">선택</span>}
      </h1>
      {prevNotDone && (
        <p class="small muted" data-testid="skip-notice">
          앞 단계 {prev!.order}{numEulReul(prev!.order)} 아직 안 했습니다. 그대로 진행해도 됩니다.
        </p>
      )}
      <ol class="stepper" aria-label="이 단계 안 순서">
        {([...(hasVideo ? ['segment'] : []), 'practice', ...(hasQuiz ? ['quiz'] : [])] as Phase[]).map((ph, i) => (
          <li>
            <button type="button" aria-current={phase === ph ? 'step' : undefined} onClick={() => setPhase(ph)}>
              <span class="num">{i + 1}</span> {ph === 'segment' ? '영상 보기' : ph === 'practice' ? '따라 하기' : '확인 문제'}
            </button>
          </li>
        ))}
      </ol>
    </header>
  );

  const player = (context: 'segment' | 'practice') => (
    <VideoPlayer
      videoId={p.videoId ?? ''}
      videoUrl={p.videoUrl ?? ''}
      title={s.title_ko}
      segments={s.video_segments}
      lectureSteps={p.steps}
      order={s.order}
      context={context}
      showCaptionNote={context === 'segment'}
    />
  );

  const nextLine = (label: string) => (
    <p class="next">
      <b>다음:</b> <span>{label}</span>
    </p>
  );

  if (phase === 'segment' && hasVideo) {
    return (
      <div class="stack" data-phase="segment">
        {header}
        {player('segment')}
        <p>
          <b>이 단계에서 하는 일:</b> <Inline text={s.input_ko} />
        </p>
        {s.summary_ko && s.summary_ko.length > 0 && (
          <section class="card stack-sm" aria-label="세 줄 요약">
            <h2 class="t3">구간 요약</h2>
            <ol>
              {s.summary_ko.map((x) => (
                <li>
                  <Inline text={x} />
                </li>
              ))}
            </ol>
          </section>
        )}
        {s.concept_ko && (
          <section class="card stack-sm" aria-label="새 개념">
            <h2 class="t3">새 개념</h2>
            <p>
              <code class="inline">{s.concept_ko.term}</code> <Inline text={s.concept_ko.plain} />
            </p>
          </section>
        )}
        <button type="button" class="btn primary block" onClick={() => setPhase('practice')} data-testid="start-practice">
          따라 하기 시작
        </button>
        {nextLine(`따라 하기${s.code ? ` · 코드 ${s.code_line_notes_ko?.length ?? 0}줄` : ''}`)}
      </div>
    );
  }

  if (phase === 'quiz') {
    return (
      <div class="stack" data-phase="quiz">
        {header}
        <p class="small muted">답을 내면 풀이가 열립니다.</p>
        {p.questions.map((q) => (
          <QuestionCard rt={rt} lectureId={p.lectureId} q={q} attempts={t?.question_attempt ?? []} runLocation={runLocation} basicsReady={p.basicsReady} allowRetry={p.questionRetry} />
        ))}
        {nextLine(next ? `단계 ${next.order} · ${next.title_ko}` : `${overview}로 돌아가기`)}
        <div class="row">
          <button type="button" class="btn" onClick={() => setPhase('practice')}>
            이전
          </button>
          <a class="btn primary grow" href={next ? stepHref(next) : base} data-testid="next-step">
            {next ? `단계 ${next.order}${numRo(next.order)}` : `${overview}로`}
          </a>
        </div>
      </div>
    );
  }

  const done = STEP_DONE.has(myRow?.status);
  const nb = p.notebookName ?? '1편 노트북';
  return (
    <div class="stack" data-phase="practice">
      {header}
      <ol class="cells" aria-label="이 단계의 세 칸">
        <li class={`cell${!revealed ? ' now' : ''}`}>
          <h3>
            <span class="n">1</span>입력할 것
          </h3>
          <p>
            <Inline text={s.input_ko} />
          </p>
        </li>
        <li class={`cell${revealed && !check?.ok ? ' now' : ''}`}>
          <h3>
            <span class="n">2</span>보여야 하는 것
          </h3>
          {revealed ? (
            <p>
              <Inline text={s.expected_ko} />
            </p>
          ) : (
            <p class="muted">가려짐, 예측 뒤 열림</p>
          )}
        </li>
        <li class={`cell${check?.ok ? ' now' : ''}`}>
          <h3>
            <span class="n">3</span>그 뜻
          </h3>
          <p>
            <Inline text={s.meaning_ko} />
          </p>
        </li>
      </ol>

      <div class="practice">
        <div class="pmain">
          {s.long_step && <p class="band num">코드 {s.code_line_notes_ko?.length ?? 0}줄 · 긴 단계 · 나누면 뜻이 깨져 한 번에 봅니다</p>}
          {!isRead && (
            <section class="card stack-sm" aria-label="어디서 실행하나요" data-testid="run-place">
              <h2 class="t3">어디서 실행하나요</h2>
              <div class="row" role="group" aria-label="실행 장소">
                {(['colab', 'jupyter'] as const).map((loc) => (
                  <button type="button" class="chip" aria-pressed={runLocation === loc} onClick={() => rt && setPref(rt.store, PREF_RUN_PLACE, loc)}>
                    {loc === 'colab' ? 'Google Colab' : '맥미니 Jupyter'}
                  </button>
                ))}
              </div>
              {p.notebookGuide === false ? (
                <p class="small" data-testid="run-new-cell">
                  {runLocation === 'colab' ? 'Colab' : '맥미니 Jupyter'} 노트북의 새 셀에 붙여 넣은 뒤 실행(Shift+Enter)을 누르세요.
                </p>
              ) : (
                <p class="small">
                  {runLocation === 'colab' ? 'Colab' : '맥미니 Jupyter'}에서 노트북 <b>{nb}</b>를 열고 <b>{cell}</b> 칸에 붙여 넣은 뒤 실행(Shift+Enter)을 누르세요.
                </p>
              )}
              {p.notebookGuide === false ? null : config.colabOpenUrl && p.notebookName && runLocation === 'colab' ? (
                <a class="btn block" href={config.colabOpenUrl} target="_blank" rel="noopener noreferrer">
                  Colab에서 노트북 열기 <IconExternal />
                </a>
              ) : (
                <a class="btn block" href={`/lectures/${p.lectureId}/#notebook`}>
                  노트북 받기와 Colab 안내
                </a>
              )}
            </section>
          )}

          {s.prepared_code && (
            <details class="card">
              <summary class="label" style="min-height:44px;display:flex;align-items:center;cursor:pointer">준비 코드 보기 (붙여 넣기만, 외울 필요 없음)</summary>
              <CodeBlock code={s.prepared_code} notes={s.prepared_code_line_notes_ko ?? []} heading="준비 코드 · 줄을 누르면 풀이" />
            </details>
          )}
          {s.rerun_first && s.rerun_first.length > 0 && (
            <p class="band" data-testid="rerun-first">
              <b>먼저 다시 실행:</b>{' '}
              {s.rerun_first.map((r, i) => (
                <>
                  {i > 0 && ' · '}
                  <a href={`${base}${r.slug}/#practice`}>{r.step_id} 셀</a>
                </>
              ))}{' '}
              (고친 클래스로 상자를 새로 만들기 위해서입니다)
            </p>
          )}
          {s.read_first_ko && (
            <section class="card sunken stack-sm" aria-label="실행 전 먼저 읽기" data-testid="read-first">
              <h2 class="label">실행 전 먼저 읽기</h2>
              <p>
                <Inline text={s.read_first_ko} />
              </p>
            </section>
          )}
          {s.edit_view ? (
            <EditsView view={s.edit_view} />
          ) : (
            s.code && (
              <CodeBlock code={s.code} notes={s.code_line_notes_ko ?? []} heading={`1 · 입력할 것: 코드 ${s.code_line_notes_ko?.length ?? 0}줄 · 줄을 누르면 풀이`} testId="step-code" />
            )
          )}

          {!isRead && (
            <section class="card stack" aria-label="보여야 하는 것">
              <h2 class="t3">2 · 보여야 하는 것</h2>
              {!revealed ? (
                <div class="stack-sm" data-testid="prediction">
                  <p class="small">실행 전에 무엇이 나올지 적어 보세요. 점수에 들어가지 않습니다.</p>
                  <input class="input" aria-label="내 예측" value={prediction} onInput={(e) => setPrediction((e.target as HTMLInputElement).value)} />
                  <div class="row">
                    <button type="button" class="btn" onClick={() => setPredOpen(true)} data-testid="dont-know">
                      모르겠어요
                    </button>
                    <button
                      type="button"
                      class="btn"
                      onClick={async () => {
                        if (rt && prediction.trim()) await patchStep(rt.store, s.step_id, p.contentVersion, { prediction: prediction.trim() });
                        setPredOpen(true);
                      }}
                    >
                      예측 저장하고 보기
                    </button>
                  </div>
                </div>
              ) : (
                <div class="stack-sm">
                  {savedPrediction && (
                    <p class="small">
                      <span class="badge">내 예측</span> {savedPrediction} <span class="cap">실행 전에 적어 둔 것</span>
                    </p>
                  )}
                  {s.expected_check.type === 'output_match' && s.expected_check.value && s.expected_output_example == null ? (
                    <pre class="out" data-testid="expected">
                      {s.expected_check.value}
                    </pre>
                  ) : (
                    <p class="out text-out" data-testid="expected">
                      <Inline text={s.expected_ko} />
                    </p>
                  )}
                  {s.expected_output_example != null && s.expected_output_example !== '' && (
                    <div class="stack-sm">
                      <p class="cap">출력 예</p>
                      <pre class="out" data-testid="expected-output-example">
                        {s.expected_output_example}
                      </pre>
                    </div>
                  )}
                  {s.expected_check.type === 'error_match' && (
                    <p class="band" data-testid="error-expected">
                      에러가 나는 것이 정상인 단계입니다. 출력 맨 아래 줄에 <code class="inline">{s.expected_check.error_type}</code>가 보이면 맞습니다.
                    </p>
                  )}
                  {s.expected_check.type === 'manual' && s.expected_check.figure && (
                    <p class="small" data-testid="figure-note">
                      그림{s.figure_label ? `(${s.figure_label})` : ''}은 앱이 판정하지 않습니다. 노트북에 나온 그림을 보고 직접 확인해 주세요.
                    </p>
                  )}
                  {s.expected_check.type === 'manual' && s.expected_check.values && (
                    <ul class="out" data-testid="expected-values" style="list-style:none">
                      {Object.entries(s.expected_check.values).map(([k, v]) => (
                        <li>
                          {k} = {String(v)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.expected_check.type === 'value_range' && (
                    <p class="cap num">
                      맞는 범위{s.expected_check.target ? `(${s.expected_check.target})` : ''}: {s.expected_check.min} ~ {s.expected_check.max}
                    </p>
                  )}
                  {s.output_varies && <p class="cap">실행할 때마다 숫자가 조금 다를 수 있어 글자 모양만 비교합니다.</p>}
                  {s.expected_check.type === 'manual' || s.expected_check.type === 'error_match' ? (
                    <div class="stack-sm">
                      <p class="label">내 화면도 이렇게 나왔나요?</p>
                      <div class="row">
                        <button type="button" class="btn" onClick={() => void doCheck(true, { ok: true, kind: 'compare', message: '맞음: 보여야 하는 것과 같습니다.' })} data-testid="self-ok">
                          {s.expected_check.type === 'manual' && s.expected_check.figure ? '직접 확인했어요' : '같아요'}
                        </button>
                        <button
                          type="button"
                          class="btn"
                          onClick={() => void doCheck(false, { ok: false, kind: 'compare', message: '다르게 나왔다면 오른쪽(모바일은 아래) 힌트를 열어 보세요.' })}
                        >
                          달라요
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div class="stack-sm">
                      <label class="field">
                        {s.expected_check.type === 'value_range' ? '내 결과 숫자' : '내 결과 붙여넣기'}
                        {s.expected_check.type === 'value_range' ? (
                          <input class="input code-input" value={pasted} onInput={(e) => setPasted((e.target as HTMLInputElement).value)} data-testid="paste" />
                        ) : (
                          <textarea class="input code-input" value={pasted} onInput={(e) => setPasted((e.target as HTMLTextAreaElement).value)} data-testid="paste" />
                        )}
                      </label>
                      <button type="button" class="btn block" onClick={onCompare} data-testid="compare">
                        {s.expected_check.type === 'value_range' ? '확인' : '비교하기'}
                      </button>
                    </div>
                  )}
                  {check && <CheckBox check={check} hints={s.mismatch_hints_ko ?? []} />}
                </div>
              )}
            </section>
          )}

          {!isRead && (
            <section class={`card stack-sm${check?.ok ? ' current' : ''}`} aria-label="그 뜻">
              <h2 class="t3">3 · 그 뜻</h2>
              <p>
                <Inline text={s.meaning_ko} />
              </p>
            </section>
          )}
          {isRead && (
            <p class="small muted" data-testid="read-step-note">
              읽기 단계입니다. 세 칸을 읽고 "단계 {s.order} 마치기"를 누르면 완료됩니다.
            </p>
          )}
        </div>

        <div class="pside">
          {hasVideo && <div class="pslot-video">{player('practice')}</div>}
          {s.hint_levels.length > 0 && (
            <HintLadder
              rt={rt}
              lectureId={p.lectureId}
              targetId={s.step_id}
              targetTitle={s.title_ko}
              ctx="step"
              levels={s.hint_levels}
              unlock={s.hint_unlock}
              state={hint}
              setState={setHint}
              onOpened={onHintOpened}
              emphasize={!!check && !check.ok}
              lastOutput={pasted}
              runLocation={runLocation}
              basicsReady={p.basicsReady}
            />
          )}
          <section class="card stack-sm" aria-label="진행">
            <p class="cap num">
              단계 {s.order} / {total} · {p.lectureLabel}
            </p>
            <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={s.order} aria-label={`${total}단계 중 ${s.order}단계`}>
              <i style={`width:${Math.round((s.order / Math.max(1, total)) * 100)}%`} />
            </div>
            {nextLine(hasQuiz ? `확인 문제 ${p.questions.length}개` : next ? `단계 ${next.order} · ${next.title_ko}` : overview)}
            <div class="row">
              {prev ? (
                <a class="btn" href={stepHref(prev)}>
                  이전
                </a>
              ) : hasVideo ? (
                <button type="button" class="btn" onClick={() => setPhase('segment')}>
                  이전
                </button>
              ) : (
                <a class="btn" href={base}>
                  이전
                </a>
              )}
              <button type="button" class="btn primary grow" onClick={finish} data-testid="finish-step">
                {done ? `단계 ${s.order} 다음으로` : `단계 ${s.order} 마치기`}
              </button>
            </div>
            {isOptional && !done && (
              <div class="stack-sm" data-testid="optional-step">
                <p class="small muted">선택 단계입니다. 하지 않아도 이 단위를 익힐 수 있고, 건너뛴 뒤에도 언제든 다시 할 수 있습니다.</p>
                <button type="button" class="btn" onClick={skipOptional} data-testid="skip-optional">
                  건너뛰기 (선택)
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function CheckBox({ check, hints }: { check: CheckResult; hints: string[] }) {
  if (check.kind === 'empty') {
    return (
      <div class="result ng" role="status" data-testid="check-result">
        <span class="sym">
          <IconCross size={20} />
        </span>
        <div class="stack-sm">
          <p class="title">비교할 결과가 비어 있습니다</p>
          <p>노트북에서 실행한 뒤 출력 칸의 글자를 복사해 붙여 넣어 주세요.</p>
        </div>
      </div>
    );
  }
  if (check.kind === 'error') {
    return (
      <div class="card sunken stack-sm" role="status" data-testid="error-helper">
        <p class="label">에러 읽기 도우미</p>
        <p class="small">에러가 났습니다. 아래 순서로 읽어 보세요. 이것은 힌트 사용으로 세지 않습니다.</p>
        <ol class="small">
          {ERROR_STEPS.map((x) => (
            <li>{x}</li>
          ))}
        </ol>
      </div>
    );
  }
  return (
    <div class={`result ${check.ok ? 'ok' : 'ng'}`} role="status" data-testid="check-result">
      <span class="sym">{check.ok ? <IconCheck size={20} /> : <IconCross size={20} />}</span>
      <div class="stack-sm">
        <p class="title">{check.ok ? '맞음' : '다시'}</p>
        <p>{check.ok ? '보여야 하는 것과 같습니다.' : check.message?.replace(/^맞음: /, '')}</p>
        {!check.ok && hints.length > 0 && (
          <ul class="small">
            {hints.map((h) => (
              <li>
                볼 곳: <Inline text={h} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** 마운트 전에는 안의 버튼·입력칸이 눌리지 않게 감싼다(Gate.tsx) */
export default gated(StepAppView, 'StepApp');
