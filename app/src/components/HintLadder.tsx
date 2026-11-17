// 힌트 사다리 H1~H4 + 도움 요청 메모 (spec 6절, hints.md). 한 번에 다음 한 칸만.
// 힌트 본문(H4 정답 포함)은 /data/{편}/hints.json 에서 열 때 불러온다. 열기 전에는 화면 문서에 없다.
import { useEffect, useRef, useState } from 'preact/hooks';
import { canOpen, emptyHintState, lockText, scoreNoteKo, LEVEL_NAMES, STEP_HINT_NOTE, type HintState, type UnlockRule } from '../lib/hints';
import { unitHref } from '../lib/basics';
import { hintScoreRatio } from '../lib/grading';
import { fetchJsonOnce, hintsUrl, type Runtime } from '../lib/runtime';
import { nowKst, uuid4 } from '../lib/time';
import CodeBlock, { CopyButton } from './CodeBlock';
import { useNow } from './hooks';
import Inline from './Inline';

export interface HintRecord {
  hint_id: string;
  level: number;
  text_ko: string;
  code_with_blanks: string | null;
  /** H3 빈칸의 답(빈칸 순서대로)과 채운 뒤 나오는 출력 */
  blank_answers: string[] | null;
  blank_filled_output: string | null;
  /** H2 가 가리키는 기초 단위(또는 단계)와 그 단위 설명 카드 몇 번째 문장인지 */
  points_to: { unit_id: string; step_id: string | null; card_line: number | null } | null;
  /** H4(show_solution): 정답 코드와 줄별 풀이(단계 코드·문제 정답 코드·과제 정답 코드) */
  code: string | null;
  code_line_notes_ko: string[] | null;
  /** 문제의 H4: 풀이와 정답 코드의 출력 */
  answer_ko?: string | null;
  answer_output?: string | null;
  /** 과제의 H4: 정답 코드 출처 */
  source_ko?: string | null;
  why_ko: string | null;
}

/** H2 가 가리키는 곳의 주소와 이름: 단위(설명 카드 문장) 또는 단계. 내용이 준비되지 않은 단위는 기초 목록 */
export function pointHref(pt: NonNullable<HintRecord['points_to']>, basicsReady: string[] | undefined): { href: string; label: string } {
  const unitPage = unitHref(pt.unit_id, basicsReady);
  const ready = unitPage !== '/basics/';
  if (pt.step_id && ready) return { href: `${unitPage}${pt.step_id.split('-').pop()}/`, label: `기초 ${pt.step_id} 단계 다시 보기` };
  if (pt.card_line && ready) return { href: `${unitPage}#card-${pt.card_line}`, label: `기초 ${pt.unit_id} 설명 카드 ${pt.card_line}번째 문장 보기` };
  return { href: unitPage, label: `기초 ${pt.unit_id}로 돌아가 보기` };
}

/** 힌트 상태를 이 기기에 보관 (열람 시각·시도 기록은 동기화하지 않음, 최고 단계만 진도에 저장) */
export function useHintState(rt: Runtime | null, targetId: string): [HintState | null, (fn: (s: HintState) => HintState) => void] {
  const [s, setS] = useState<HintState | null>(null);
  const ref = useRef<HintState | null>(null);
  useEffect(() => {
    if (!rt) return;
    let alive = true;
    rt.store.getUi<HintState>(`hint:${targetId}`).then((v) => {
      if (!alive) return;
      const init = v ?? emptyHintState(Date.now());
      ref.current = init;
      setS(init);
      if (!v) void rt.store.setUi(`hint:${targetId}`, init);
    });
    return () => {
      alive = false;
    };
  }, [rt, targetId]);
  const update = (fn: (s: HintState) => HintState) => {
    const cur = ref.current ?? emptyHintState(Date.now());
    const next = fn(cur);
    ref.current = next;
    setS(next);
    void rt?.store.setUi(`hint:${targetId}`, next);
  };
  return [s, update];
}

interface Props {
  rt: Runtime | null;
  lectureId: string;
  targetId: string;
  targetTitle: string;
  ctx: 'step' | 'question' | 'rebuild';
  levels: number[];
  unlock: Record<number, UnlockRule>;
  state: HintState | null;
  setState: (fn: (s: HintState) => HintState) => void;
  onOpened: (level: number) => void;
  emphasize?: boolean;
  lastOutput?: string;
  runLocation?: string;
  /** 내용이 준비된 기초 단위 id. H2가 가리키는 단위가 여기 있으면 그 단위 화면으로, 없으면 기초 목록으로 잇는다(D24) */
  basicsReady?: string[];
  /** ctx rebuild: 머리 아래 안내 한 줄(통과 한도) */
  noteKo?: string;
}

export default function HintLadder(p: Props) {
  const now = useNow(30_000);
  const [hints, setHints] = useState<HintRecord[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const titleRefs = useRef<Record<number, HTMLElement | null>>({});
  const [focusLevel, setFocusLevel] = useState<number | null>(null);
  const s = p.state;
  const contentMax = p.levels.length ? Math.max(...p.levels) : 0;
  const maxLevel = p.levels.includes(4) ? 5 : contentMax;

  const load = async () => {
    try {
      const all = await fetchJsonOnce<Record<string, HintRecord[]>>(hintsUrl(p.lectureId));
      setHints(all[p.targetId] ?? []);
      setLoadErr(false);
      return true;
    } catch {
      setLoadErr(true);
      return false;
    }
  };

  useEffect(() => {
    if (s && s.opened > 0 && !hints) void load();
  }, [s?.opened]);

  useEffect(() => {
    if (focusLevel != null) titleRefs.current[focusLevel]?.focus();
  }, [focusLevel, hints]);

  if (!s || maxLevel === 0) return null;
  const next = s.opened + 1;
  const hasNext = next <= maxLevel;
  const openable = hasNext && canOpen(s, next, now, p.unlock);
  const shownLevel = Math.min(s.opened, contentMax);

  const open = async () => {
    if (!openable) return;
    if (!(await load())) return;
    p.setState((st) => (st.opened + 1 === next ? { ...st, opened: next, openedAt: { ...st.openedAt, [next]: Date.now() } } : st));
    p.onOpened(next);
    setFocusLevel(next);
  };

  const byLevel = new Map((hints ?? []).map((h) => [h.level, h]));

  return (
    <section class={`card stack${p.emphasize ? ' current' : ''}`} aria-label={p.ctx === 'question' ? '힌트' : '막혔나요? 힌트'} data-testid={`hints-${p.targetId}`}>
      <h2 class="t3">{p.ctx === 'question' ? '힌트' : '막혔나요?'}</h2>
      {p.ctx === 'step' && (
        <p class="small muted">
          힌트는 {contentMax}단계입니다. {STEP_HINT_NOTE}
        </p>
      )}
      {p.ctx === 'rebuild' && p.noteKo && (
        <p class="small muted">
          힌트는 {contentMax}단계입니다. {p.noteKo}
        </p>
      )}
      <div aria-live="polite" class="stack">
        {loadErr && (
          <div class="result ng" role="status">
            <p>힌트를 불러오지 못했습니다. 연결을 확인한 뒤 다시 눌러 주세요.</p>
          </div>
        )}
        {Array.from({ length: s.opened }, (_, i) => i + 1).map((lv) => {
          const h = byLevel.get(lv);
          return (
            <div class="hint-item stack-sm" data-testid={`hint-${p.targetId}-H${lv}`}>
              <h3 class="label" tabIndex={-1} ref={(el) => { titleRefs.current[lv] = el; }}>
                {lv === 5 ? '도움 요청 메모' : `${lv}단계 · ${LEVEL_NAMES[lv]}`}
              </h3>
              {h?.text_ko && (
                <p>
                  <Inline text={h.text_ko} />
                </p>
              )}
              {h?.points_to && (
                <a href={pointHref(h.points_to, p.basicsReady).href} class="small" data-testid={`hint-basics-${p.targetId}`}>
                  {pointHref(h.points_to, p.basicsReady).label}
                </a>
              )}
              {h?.code_with_blanks && <pre class="plain-code">{h.code_with_blanks.replace(/\n+$/, '')}</pre>}
              {h?.blank_answers && h.blank_answers.length > 0 && (
                <details class="small" data-testid={`hint-blanks-${p.targetId}`}>
                  <summary class="label" style="min-height:44px;display:flex;align-items:center;cursor:pointer">
                    빈칸 답 보기
                  </summary>
                  <ol>
                    {h.blank_answers.map((x) => (
                      <li>
                        <code class="inline">{x}</code>
                      </li>
                    ))}
                  </ol>
                  {h.blank_filled_output != null && (
                    <>
                      <p class="cap">채우고 실행하면 나오는 것</p>
                      <pre class="out">{h.blank_filled_output}</pre>
                    </>
                  )}
                </details>
              )}
              {lv === 4 && h?.code && <CodeBlock code={h.code} notes={h.code_line_notes_ko ?? []} heading={h.code_line_notes_ko?.length ? '정답 코드 · 줄을 누르면 풀이' : '정답 코드'} />}
              {lv === 4 && h?.answer_output && (
                <div class="stack-sm">
                  <p class="cap">정답 코드의 출력</p>
                  <pre class="out">{h.answer_output}</pre>
                </div>
              )}
              {lv === 4 && h?.source_ko && (
                <p class="cap">
                  <Inline text={h.source_ko} />
                </p>
              )}
              {lv === 4 && h?.answer_ko && (
                <div class="card sunken stack-sm">
                  <p class="label">풀이</p>
                  <p>
                    <Inline text={h.answer_ko} />
                  </p>
                </div>
              )}
              {lv === 4 && h?.why_ko && (
                <p class="small">
                  <Inline text={h.why_ko} />
                </p>
              )}
              {lv === 5 && <HelpMemo rt={p.rt} targetId={p.targetId} title={p.targetTitle} seen={[1, 2, 3, 4]} lastOutput={p.lastOutput} runLocation={p.runLocation} />}
            </div>
          );
        })}
      </div>
      {hasNext && (
        <div class="stack-sm">
          {p.ctx === 'question' && next <= 5 && <p class="cap">{scoreNoteKo(next)}</p>}
          {openable ? (
            <>
              <button type="button" class="btn block" onClick={open} data-testid={`open-hint-${next}`}>
                {next === 5 ? '도움 요청 메모 만들기' : `${next}단계 힌트 열기`}
              </button>
              {next > 1 && <p class="cap">지금 열 수 있습니다.</p>}
            </>
          ) : (
            <p class="hint-lock" data-testid={`hint-locked-${next}`}>
              <span>{next === 5 ? '도움 요청 메모' : `${next}단계 힌트`}</span>
              <span>{lockText(next, p.ctx, p.unlock)}</span>
            </p>
          )}
        </div>
      )}
      <p class="cap num">
        {p.ctx === 'step'
          ? `이 단계 힌트 사용: ${shownLevel} / ${contentMax}`
          : p.ctx === 'rebuild'
          ? `이 과제 힌트 사용: ${shownLevel} / ${contentMax}`
          : `이 문제 힌트: ${shownLevel} / ${contentMax}${s.opened >= 2 ? ` · 이 문제는 ${Math.round(hintScoreRatio(s.opened) * 100)}%로 계산됩니다` : ''}`}
      </p>
    </section>
  );
}

export function HelpMemo(p: { rt: Runtime | null; targetId: string; title: string; seen: number[]; lastOutput?: string; runLocation?: string }) {
  const [cell, setCell] = useState('');
  const [errLine, setErrLine] = useState(() => {
    const lines = String(p.lastOutput ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    return lines[lines.length - 1] ?? '';
  });
  const [torch, setTorch] = useState('');
  const [memo, setMemo] = useState<string | null>(null);
  const place = p.runLocation === 'jupyter' ? '맥미니 Jupyter' : 'Google Colab';

  const make = async () => {
    const text = [
      `편과 단계: ${p.targetId}`,
      `하려던 것: ${p.title}`,
      `내 셀 코드:\n${cell || '(비어 있음)'}`,
      `에러 마지막 줄 또는 보인 것: ${errLine || '(비어 있음)'}`,
      `환경: ${place}${torch ? `, torch ${torch}` : ''}`,
      `이미 본 힌트 단계: ${p.seen.join(', ')}`,
    ].join('\n');
    setMemo(text);
    await p.rt?.store.put('help_note', {
      note_id: uuid4(),
      target_id: p.targetId,
      goal_ko: p.title,
      last_cell_code: cell,
      error_last_line: errLine,
      env: { place: p.runLocation ?? 'colab', torch_version: torch || null },
      hints_seen: p.seen,
      created_at: nowKst(),
    });
  };

  return (
    <div class="stack-sm">
      <p class="small">
        정답을 넣어도 결과가 다르면 대개 설치나 장치 문제입니다. 내 코드, 에러 마지막 줄, 환경을 정리한 메모를 만듭니다. 이 화면에만 저장되고 자동으로 보내지 않습니다.
      </p>
      <label class="field">
        마지막으로 실행한 셀 코드
        <textarea class="input code-input" value={cell} onInput={(e) => setCell((e.target as HTMLTextAreaElement).value)} />
      </label>
      <label class="field">
        에러 마지막 줄 또는 보인 것
        <input class="input" value={errLine} onInput={(e) => setErrLine((e.target as HTMLInputElement).value)} />
      </label>
      <label class="field">
        torch 버전(아는 경우)
        <input class="input" value={torch} onInput={(e) => setTorch((e.target as HTMLInputElement).value)} />
      </label>
      <button type="button" class="btn" onClick={make}>
        메모 만들기
      </button>
      {memo && (
        <div class="stack-sm">
          <pre class="out">{memo}</pre>
          <CopyButton text={memo} />
        </div>
      )}
    </div>
  );
}
