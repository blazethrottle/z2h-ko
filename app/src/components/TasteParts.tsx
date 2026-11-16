// 30분 맛보기 공통 부품 (spec 13.2): 진도 읽기, 8칸 막대, 준비된 코드 블록, 보여야 하는 것 출력, 확인 질문, 힌트 사다리.
// 맛보기는 점수·예측이 없고 영상도 없다(D41·D53). 단계 완료는 "직접 확인했어요" 자기 확인으로만 기록한다(D54).
import { useEffect, useRef, useState } from 'preact/hooks';
import { canOpen, openHint, type HintState, type UnlockRule } from '../lib/hints';
import { fetchJsonOnce, answersUrl, hintsUrl, type Runtime } from '../lib/runtime';
import { attemptOf, codeFold, foldOutput, tasteStatus } from '../lib/taste';
import { CopyButton, highlight, splitLines } from './CodeBlock';
import { HelpMemo } from './HintLadder';
import Inline from './Inline';
import { useNow, useRuntime, useTables, useUiState } from './hooks';
import { IconCheck } from './Icons';

export const TASTER_ID = 'TASTER';

export interface TasteNav {
  step_id: string;
  slug: string;
  order: number;
  title_ko: string;
  minutes: number;
}

export interface TasteStep extends TasteNav {
  kind: 'copy_run' | 'read';
  input_ko: string;
  code: string | null;
  code_line_notes_ko: string[] | null;
  code_alt_local?: string | null;
  code_alt_local_line_notes_ko?: string[] | null;
  expected_ko: string;
  expected_output_example?: string | null;
  aha_ko: string;
  summary_ko?: string | null;
  hint_levels: number[];
  hint_unlock: Record<number, UnlockRule>;
  question_ids: string[];
}

export interface TasteQuestionPub {
  question_id: string;
  prompt_ko: string;
  code: string | null;
  choices: string[] | null;
  hint_levels: number[];
}

export const tasteHref = (slug: string) => `/taste/${slug}/`;

/** 이 계정(또는 계정 전 이 기기)의 taster_result 를 읽어 지금 시도의 진도를 낸다 */
export function useTaste(requiredSteps: string[]) {
  const rt = useRuntime();
  const t = useTables(rt, ['taster_result']);
  const rows = t?.taster_result ?? [];
  const attemptNo = attemptOf(rows);
  const status = tasteStatus(rows, attemptNo, requiredSteps);
  return { rt, rows, loaded: t != null, attemptNo, status };
}

/** 8칸 막대: 확인한 칸 correct, 지금 칸 accent, 남은 칸 paper-sunken. 숫자 글자는 따로 늘 함께 보인다 */
export function TasteBar({ steps, current, confirmed }: { steps: TasteNav[]; current: string | null; confirmed: Set<string> }) {
  return (
    <div class="tbar" aria-hidden="true" data-testid="taste-bar">
      {steps.map((s) => (
        <i class={s.step_id === current ? 'now' : confirmed.has(s.step_id) ? 'done' : ''} data-step={s.step_id} />
      ))}
    </div>
  );
}

/** 준비된 코드 블록 (D41, spec 13.2): 붙여 넣기만, 줄별 풀이는 펼친 채, 긴 셀은 앞부분을 접는다. 복사는 셀 전체 */
export function TasteCode({
  code,
  notes,
  heading,
  note,
  testId,
  foldable = true,
}: {
  code: string;
  notes: string[];
  heading: string;
  note: string;
  testId?: string;
  foldable?: boolean;
}) {
  const lines = splitLines(code);
  const fold = foldable ? codeFold(lines.length) : 0;
  const [showHead, setShowHead] = useState(false);
  const start = fold && !showHead ? fold : 0;
  return (
    <section class="tcode" aria-label={heading} data-testid={testId}>
      <div class="tcode-head">
        <div class="grow stack-sm">
          <h2 class="label">{heading}</h2>
          <p class="cap">
            {note}
            {fold > 0 && ` · 셀 ${lines.length}줄 중 앞 ${fold}줄은 "앞부분 ${fold}줄 보기"`}
          </p>
        </div>
        <CopyButton text={lines.join('\n')} />
      </div>
      {fold > 0 && (
        <div class="tcode-fold">
          <button type="button" class="btn block" aria-expanded={showHead} onClick={() => setShowHead(!showHead)} data-testid="taste-fold">
            {showHead ? `앞부분 ${fold}줄 접기` : `앞부분 ${fold}줄 보기`}
          </button>
        </div>
      )}
      <div class="codeblock tcb">
        <div class="cl-cols" aria-hidden="true">
          <span>코드</span>
          <span>한국어 풀이</span>
        </div>
        <div data-testid={testId ? `${testId}-lines` : undefined}>
          {lines.map((ln, i) =>
            i < start ? null : (
              <div class="cl-row open">
                <div class="cl-code static">
                  <span class="ln">{i + 1}</span>
                  <code>{highlight(ln)}</code>
                </div>
                <div class="cl-note">
                  <Inline text={notes[i] ?? ''} />
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

/** "보여야 하는 것" 출력 예: 길면 앞 3줄 + … + 끝 2줄, 전체 보기 */
export function TasteOutput({ text }: { text: string }) {
  const f = foldOutput(text);
  const [all, setAll] = useState(false);
  const full = splitLines(text);
  return (
    <div class="stack-sm">
      <pre class="out" data-testid="taste-expected">
        {(all ? full : f.lines).join('\n')}
      </pre>
      {f.folded && (
        <button type="button" class="btn ghost sm" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? '줄여 보기' : `출력 전체 보기 (${f.total}줄)`}
        </button>
      )}
    </div>
  );
}

interface TasteAnswer {
  answer_ko: string;
  answer_index: number | null;
  choices: string[] | null;
}

/** 확인 질문 (scored: false): 고르는 즉시 풀이, 제출 단추 없음, 점수·복습 없음. 고른 번호는 이 기기에만 둔다 */
export function TasteQuestion({ rt, q }: { rt: Runtime | null; q: TasteQuestionPub }) {
  const [pick, setPick] = useUiState<number | null>(rt, `taste-q:${q.question_id}`, null);
  const [ans, setAns] = useState<TasteAnswer | null>(null);
  const [err, setErr] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const load = async () => {
    try {
      const all = await fetchJsonOnce<Record<string, TasteAnswer>>(answersUrl(TASTER_ID));
      setAns(all[q.question_id] ?? null);
      setErr(false);
    } catch {
      setErr(true);
    }
  };
  useEffect(() => {
    if (pick != null && !ans) void load();
  }, [pick]);
  const choices = q.choices ?? [];
  const hid = `tq-${q.question_id}`;
  const correct = ans != null && pick === ans.answer_index;
  const showHint = async () => {
    try {
      const all = await fetchJsonOnce<Record<string, { level: number; text_ko: string }[]>>(hintsUrl(TASTER_ID));
      setHint(all[q.question_id]?.find((h) => h.level === 1)?.text_ko ?? null);
    } catch {
      setErr(true);
    }
  };
  return (
    <section class="card stack-sm" aria-labelledby={hid} data-testid={`taste-q-${q.question_id}`}>
      <h2 class="t3">확인 질문 · 점수 없음</h2>
      <p id={hid}>
        <Inline text={q.prompt_ko} />
      </p>
      {q.code && <pre class="plain-code">{q.code.replace(/\n+$/, '')}</pre>}
      <div role="radiogroup" aria-labelledby={hid} class="stack-sm">
        {choices.map((c, i) => (
          <button
            type="button"
            role="radio"
            class="opt"
            aria-checked={pick === i}
            tabIndex={pick === i || (pick == null && i === 0) ? 0 : -1}
            onClick={() => {
              setPick(i);
              void load();
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') setPick(((pick ?? -1) + 1) % choices.length);
              if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') setPick(((pick ?? 0) - 1 + choices.length) % choices.length);
            }}
          >
            <span class="on num">{i + 1}</span>
            <span class="grow">{c}</span>
            {pick === i && <span class="cap">고름</span>}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {pick != null && ans && (
          <div class={`result ${correct ? 'ok' : 'part'}`} role="status" data-testid={`taste-answer-${q.question_id}`}>
            {correct && (
              <span class="sym">
                <IconCheck size={20} />
              </span>
            )}
            <div class="stack-sm">
              <p class="title">{correct ? '맞음 · 풀이' : '풀이'}</p>
              <p>
                <Inline text={ans.answer_ko} />
              </p>
              {!correct && ans.answer_index != null && ans.choices && (
                <p class="small">
                  답: {ans.answer_index + 1}번 {ans.choices[ans.answer_index]}
                </p>
              )}
            </div>
          </div>
        )}
        {err && <p class="small">풀이를 불러오지 못했습니다. 연결을 확인한 뒤 다시 골라 주세요.</p>}
      </div>
      {pick == null && q.hint_levels.includes(1) && (
        hint ? (
          <p class="small">
            <b>힌트:</b> <Inline text={hint} />
          </p>
        ) : (
          <button type="button" class="btn ghost sm" onClick={showHint}>
            힌트 보기
          </button>
        )
      )}
      <p class="cap">맛보기 질문은 점수 없이 바로 풀이를 보여 줍니다. 안 풀어도 완료에 지장이 없습니다.</p>
    </section>
  );
}

interface TasteHintRecord {
  level: number;
  role_ko: string | null;
  text_ko: string;
  expected_output: string | null;
}

const ROLE_FALLBACK: Record<number, string> = { 1: '질문', 2: '짚어 주기', 3: '처음 상태로 되돌리기', 4: '예상 출력 전체와 HELP' };
const DIFF = '"다르게 나왔어요"';

export function tasteLockText(level: number, unlock: Record<number, UnlockRule>): string {
  if (level === 5) return `그래도 다르면 ${DIFF}를 한 번 더 누르면 열림`;
  const mins = unlock[level]?.after_minutes ?? (level === 3 ? 15 : level === 4 ? 30 : null);
  return mins != null ? `다시 실행해 보고 ${DIFF}를 한 번 더 누르거나 ${mins}분 뒤 열림` : `다시 실행해 보고 ${DIFF}를 한 번 더 누르면 열림`;
}

/**
 * 맛보기 힌트 사다리 (taster.md: H1 질문, H2 짚어 주기, H3 처음 상태로 되돌리기, H4 예상 출력 전체와 HELP).
 * 점수 없음. 열림 조건은 hints.md 2절(콘텐츠 unlock)이고, 맛보기의 "시도 1회"는 "다르게 나왔어요" 한 번이다.
 */
export function TasteHints({
  rt,
  targetId,
  title,
  levels,
  unlock,
  state,
  setState,
  code,
  emphasize,
}: {
  rt: Runtime | null;
  targetId: string;
  title: string;
  levels: number[];
  unlock: Record<number, UnlockRule>;
  state: HintState | null;
  setState: (fn: (s: HintState) => HintState) => void;
  code?: string | null;
  emphasize?: boolean;
}) {
  const now = useNow(30_000);
  const [hints, setHints] = useState<TasteHintRecord[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const titles = useRef<Record<number, HTMLElement | null>>({});
  const [focusLevel, setFocusLevel] = useState<number | null>(null);
  const contentMax = levels.length ? Math.max(...levels) : 0;
  const maxLevel = levels.includes(4) ? 5 : contentMax;

  const load = async () => {
    try {
      const all = await fetchJsonOnce<Record<string, TasteHintRecord[]>>(hintsUrl(TASTER_ID));
      setHints(all[targetId] ?? []);
      setLoadErr(false);
      return true;
    } catch {
      setLoadErr(true);
      return false;
    }
  };
  useEffect(() => {
    if (state && state.opened > 0 && !hints) void load();
  }, [state?.opened]);
  useEffect(() => {
    if (focusLevel != null) titles.current[focusLevel]?.focus();
  }, [focusLevel, hints]);

  if (!state || maxLevel === 0) return null;
  const next = state.opened + 1;
  const hasNext = next <= maxLevel;
  const openable = hasNext && canOpen(state, next, now, unlock);
  const byLevel = new Map((hints ?? []).map((h) => [h.level, h]));
  const open = async () => {
    if (!openable || !(await load())) return;
    setState((s) => openHint(s, next, Date.now()));
    setFocusLevel(next);
  };

  return (
    <section class={`card stack${emphasize ? ' current' : ''}`} id="taste-hints" aria-label="막혔나요? 힌트" data-testid={`taste-hints-${targetId}`}>
      <h2 class="t3">막혔나요?</h2>
      <p class="small muted">힌트는 4단계이고, 맛보기는 점수가 없습니다. {DIFF}를 누르면 1단계가 열립니다.</p>
      <div aria-live="polite" class="stack">
        {loadErr && (
          <div class="result ng" role="status">
            <p>힌트를 불러오지 못했습니다. 연결을 확인한 뒤 다시 눌러 주세요.</p>
          </div>
        )}
        {Array.from({ length: state.opened }, (_, i) => i + 1).map((lv) => {
          const h = byLevel.get(lv);
          return (
            <div class="hint-item stack-sm" data-testid={`taste-hint-${lv}`}>
              <h3 class="label" tabIndex={-1} ref={(el) => (titles.current[lv] = el)}>
                {lv === 5 ? '도움 요청 메모' : `${lv}단계 · ${h?.role_ko ?? ROLE_FALLBACK[lv]}`}
              </h3>
              {h?.text_ko && (
                <p>
                  <Inline text={h.text_ko} />
                </p>
              )}
              {lv === 3 && code && <CopyButton text={splitLines(code).join('\n')} label="원래 코드 복사" />}
              {lv === 4 && h?.expected_output && (
                <>
                  <p class="cap">예상 출력 전체</p>
                  <pre class="out">{h.expected_output.replace(/\n+$/, '')}</pre>
                </>
              )}
              {lv === 5 && <HelpMemo rt={rt} targetId={targetId} title={title} seen={[1, 2, 3, 4]} runLocation="colab" />}
            </div>
          );
        })}
      </div>
      {hasNext &&
        (openable ? (
          <button type="button" class="btn block" onClick={open} data-testid={`taste-open-hint-${next}`}>
            {next === 5 ? '도움 요청 메모 만들기' : `${next}단계 힌트 열기`}
          </button>
        ) : (
          <p class="hint-lock" data-testid={`taste-hint-locked-${next}`}>
            <span>{next === 5 ? '도움 요청 메모' : `${next}단계 힌트`}</span>
            <span>{tasteLockText(next, unlock)}</span>
          </p>
        ))}
      <p class="cap num">이 단계 힌트 사용: {Math.min(state.opened, 4)} / 4</p>
    </section>
  );
}
