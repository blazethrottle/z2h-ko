// 사전 기초 진단 5문제 /basics/diagnostic/ (spec 8절·5절 "기초 진단 F-D1~D5도 같은 고르기 카드", docs/CURRICULUM.md 2-3절, D24·D35·D37).
// - 정본 lecture.diagnostic 약속대로: 힌트 없음(hints false), 아무것도 잠그지 않음(locks_anything false). 추천만 하고 건너뛰기 버튼이 없다.
//   약속 값이 다르면 빌드 검사가 실패하므로(content/basics.mjs) 이 화면에는 잠금·건너뛰기·힌트 부품이 아예 없다.
// - 안내는 정본 rules_ko + spec 8절 "자동으로 건너뛰지 않음" 줄, 결과 문구는 정본 result_if_correct_ko·result_if_wrong_ko·recommend_rules 그대로.
//   문제가 재는 것(정본 measures_ko)은 답을 낸 뒤 결과 화면에만 보인다(풀기 전에 보이면 힌트가 되므로).
// - "모르겠어요"는 감점 없이 오답으로 기록하고 추천에만 쓴다. 고르기는 정본 dont_know_index 보기, 직접 입력은 정본 allow_dont_know 이면 "모르겠어요" 단추(F-D3).
//   이 버튼은 고르기 보기와 같은 모양(.opt, 눌리면 2px accent + accent-tint + "고름")으로 그리고, 누르면 입력칸이 잠기며
//   "모르겠어요로 기록" 안내가 뜬다. 다시 누르면 취소된다. 고르기 문항에서 "모르겠어요" 보기를 골라도 같은 안내가 뜬다(P6-A).
// - 진행: 다섯 문제가 한 화면에 있고 "결과 보기"는 늘 눌린다. 답한 문제 수를 버튼 위에 보이고, 빠진 문제 안내는
//   "결과 보기"를 한 번 누른 뒤부터 답할 때마다 바로 줄어든다(P6-A).
// - 정답(answer_index·채점 값)은 "결과 보기"를 누를 때 /data/F/answers.json 에서 불러온다(누르기 전에는 화면에 없음).
// - 결과는 diagnostic_result 한 행(쌓이는 기록)으로 저장되어 서버로 올라간다. 익힘·배지 계산에는 쓰지 않는다. 다시 풀 수 있다.
import { useEffect, useState } from 'preact/hooks';
import { diagnosticSummary, gradeDiagnostic, type DiagAnswer } from '../lib/basics';
import type { GradableQuestion } from '../lib/grading';
import { answersUrl, fetchJsonOnce } from '../lib/runtime';
import { nowKst, uuid4 } from '../lib/time';
import type { BasicsRule } from '../lib/basics';
import { DiagnosticResultBox, NO_SKIP_KO, rowAnswers, UnitLinks, useBasicsState, type BasicsUnitPub, type DiagnosticText, type DiagQuestionPub, type RecommendRules } from './BasicsParts';
import { gated } from './Gate';
import { useRuntime } from './hooks';
import { IconCross } from './Icons';
import Inline from './Inline';
import { ChoiceOptions } from './QuestionCard';

interface Props {
  lectureId: string;
  contentVersion: string;
  text: DiagnosticText;
  rules: RecommendRules;
  questions: DiagQuestionPub[];
  units: BasicsUnitPub[];
  rule: BasicsRule;
}

interface Key {
  answer_ko?: string | null;
  answer_index: number | null;
  choices: string[] | null;
  auto_grade: GradableQuestion['auto_grade'] | null;
  measures_ko?: string | null;
}

type Draft = { choice: number | null; text: string; dontKnow: boolean };
const blank = (): Draft => ({ choice: null, text: '', dontKnow: false });

/** "모르겠어요"를 골랐을 때 안내(직접 입력·고르기 같은 첫 문장, 취소하는 법만 다름) */
const DONT_KNOW_NOTE_KO = '모르겠어요로 기록합니다. 감점 없이 추천에만 씁니다.';
const DONT_KNOW_UNDO_KO = { text: '다시 누르면 취소하고 답을 적을 수 있습니다.', choice: '다른 보기를 고르면 바뀝니다.' };

function answerLine(q: DiagQuestionPub, k: Key | undefined): string | null {
  if (!k) return null;
  if (q.type === 'choice' && k.answer_index != null && q.choices) return `답: ${k.answer_index + 1}번 ${q.choices[k.answer_index]}`;
  const v = k.answer_ko ?? k.auto_grade?.value;
  return v != null ? `답: ${v}` : null;
}

function DiagnosticAppView(p: Props) {
  const rt = useRuntime();
  const { latest } = useBasicsState(rt, p.units, p.rule);
  const unitOrder = p.units.map((u) => u.unit_id);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(p.questions.map((q) => [q.question_id, blank()])));
  const [retake, setRetake] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /** "결과 보기"를 눌러 본 뒤에만 빠진 문제를 알린다(답할 때마다 바로 다시 센다) */
  const [tried, setTried] = useState(false);
  const [keys, setKeys] = useState<Record<string, Key> | null>(null);
  const [busy, setBusy] = useState(false);

  const showResult = !!latest && !retake;
  const answers = rowAnswers(latest);
  const summary = latest ? diagnosticSummary(p.questions, answers, unitOrder) : null;

  // 결과를 다시 열었을 때 문항별 답을 보이려고 정답 자료를 불러 둔다(결과가 있을 때만)
  useEffect(() => {
    if (!showResult || keys) return;
    fetchJsonOnce<Record<string, Key>>(answersUrl(p.lectureId))
      .then(setKeys)
      .catch(() => {});
  }, [showResult]);

  const set = (qid: string, d: Partial<Draft>) => setDrafts((all) => ({ ...all, [qid]: { ...all[qid], ...d } }));
  const answered = (q: DiagQuestionPub) => {
    const d = drafts[q.question_id];
    return d.dontKnow || (q.type === 'choice' ? d.choice != null : d.text.trim() !== '');
  };
  const missing = p.questions.filter((q) => !answered(q)).map((q) => q.question_id);
  const missingMsg = tried && missing.length ? `아직 답하지 않은 문제가 있습니다: ${missing.join(', ')}` : null;

  const submit = async () => {
    setMsg(null);
    setTried(true);
    if (missing.length) return;
    setBusy(true);
    try {
      const k = keys ?? (await fetchJsonOnce<Record<string, Key>>(answersUrl(p.lectureId)));
      setKeys(k);
      const rows: DiagAnswer[] = p.questions.map((q) => {
        const d = drafts[q.question_id];
        const g = gradeDiagnostic(q, k[q.question_id] ?? { answer_index: null, auto_grade: null }, { choiceIndex: d.choice, text: d.text, dontKnow: d.dontKnow });
        return {
          question_id: q.question_id,
          choice_index: q.type === 'choice' && !d.dontKnow ? d.choice : null,
          answer_text: d.dontKnow ? '모르겠어요' : q.type === 'choice' ? (q.choices?.[d.choice ?? -1] ?? '') : d.text.trim(),
          is_correct: g.is_correct,
          is_dont_know: g.is_dont_know,
        };
      });
      const s = diagnosticSummary(p.questions, rows, unitOrder);
      // 열쇠는 이 기기가 만든 attempt_id, 번호(attempt_no)는 서버가 도착 순서로 매긴다(12.5절)
      await rt?.store.put('diagnostic_result', {
        attempt_id: uuid4(),
        answers: rows,
        recommended_units: s.units,
        at: nowKst(),
        content_version: p.contentVersion,
      });
      setRetake(false);
      setTried(false);
      setDrafts(Object.fromEntries(p.questions.map((q) => [q.question_id, blank()])));
      window.scrollTo({ top: 0 });
    } catch {
      setMsg('채점 자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 눌러 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const intro = (
    <section class="card stack-sm" aria-label="진단 안내">
      <ul class="small" data-testid="diag-rules">
        {p.text.rules_ko.map((r) => (
          <li>
            <Inline text={r} />
          </li>
        ))}
      </ul>
      <p class="small" data-testid="diag-no-skip">
        {NO_SKIP_KO}
      </p>
    </section>
  );

  if (showResult && summary) {
    return (
      <div class="stack" data-testid="diag-view-result">
        {intro}
        <DiagnosticResultBox summary={summary} text={p.text} rules={p.rules} units={p.units} />
        <ol class="list" aria-label="문항별 결과" data-testid="diag-review">
          {p.questions.map((q) => {
            const a = answers.find((x) => x.question_id === q.question_id);
            const k = keys?.[q.question_id];
            const line = answerLine(q, k);
            return (
              <li class="lrow" data-testid={`diag-review-${q.question_id}`}>
                <span class="no num unit">{q.question_id}</span>
                <span class="main small">
                  {k?.measures_ko && (
                    <span class="cap" style="display:block" data-testid={`diag-measures-${q.question_id}`}>
                      재는 것: {k.measures_ko}
                    </span>
                  )}
                  <Inline text={q.prompt_ko} />
                  {a && (
                    <span class="muted" style="display:block">
                      내 답: {a.answer_text || '–'}
                      {line ? ` · ${line}` : ''}
                    </span>
                  )}
                  {a && (
                    <span style="display:block" data-testid={`diag-review-next-${q.question_id}`}>
                      {a.is_correct ? (
                        p.text.result_if_correct_ko
                      ) : (
                        <>
                          {p.text.result_if_wrong_ko} <UnitLinks ids={q.recommend_units_if_wrong} units={p.units} />
                        </>
                      )}
                    </span>
                  )}
                </span>
                <span class="side small">
                  {a?.is_correct ? (
                    <span class="st-done">✓ 맞음</span>
                  ) : a?.is_dont_know ? (
                    <span class="st-todo">모르겠어요</span>
                  ) : (
                    <span class="st-todo">
                      <IconCross /> 다시
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        <p class="small muted">모르겠어요는 감점 없이 기록만 하고, 추천을 고를 때만 씁니다. 진단 결과는 익힘·배지에 들어가지 않습니다.</p>
        <div class="row">
          <button
            type="button"
            class="btn"
            onClick={() => {
              setTried(false);
              setRetake(true);
            }}
            data-testid="diag-retake"
          >
            다시 풀기
          </button>
          <a class="btn primary grow" href="/basics/" data-testid="diag-to-list">
            기초 단위 목록으로
          </a>
        </div>
      </div>
    );
  }

  return (
    <div class="stack" data-testid="diag-view-form">
      {intro}
      <div class="diag-grid">
        {p.questions.map((q, i) => {
          const d = drafts[q.question_id];
          const choices = q.type === 'choice' ? q.choices : null;
          const dk = d.dontKnow || (choices != null && d.choice != null && d.choice === q.dont_know_index);
          return (
            <article class="card stack" data-testid={`diag-${q.question_id}`} aria-labelledby={`dh-${q.question_id}`}>
              <div class="row">
                <span class="badge cur">{q.type === 'choice' ? '고르기' : '직접 입력'}</span>
                <span class="cap num">
                  {i + 1} / {p.questions.length} · {q.question_id}
                </span>
              </div>
              <h2 class="t3" id={`dh-${q.question_id}`}>
                <Inline text={q.prompt_ko} />
              </h2>
              {q.code && <pre class="plain-code">{q.code.replace(/\n+$/, '')}</pre>}
              {choices ? (
                <ChoiceOptions labelledBy={`dh-${q.question_id}`} choices={choices} value={d.choice} locked={false} onChange={(c) => set(q.question_id, { choice: c, dontKnow: false })} />
              ) : (
                <div class="stack-sm">
                  <label class="field">
                    내 답
                    <input
                      class="input"
                      value={d.text}
                      disabled={d.dontKnow}
                      placeholder={d.dontKnow ? '모르겠어요로 기록함' : undefined}
                      onInput={(e) => set(q.question_id, { text: (e.target as HTMLInputElement).value })}
                      data-testid={`diag-input-${q.question_id}`}
                    />
                  </label>
                  {q.allow_dont_know && (
                    // 고르기 보기와 같은 모양의 켜고 끄는 단추(누르면 "고름", 다시 누르면 취소)
                    <button
                      type="button"
                      class="opt"
                      aria-pressed={d.dontKnow}
                      onClick={() => set(q.question_id, { dontKnow: !d.dontKnow, text: '' })}
                      data-testid={`diag-dont-know-${q.question_id}`}
                    >
                      <span class="on" aria-hidden="true">
                        ?
                      </span>
                      <span class="grow">모르겠어요</span>
                      {d.dontKnow && <span class="cap">고름</span>}
                    </button>
                  )}
                </div>
              )}
              {(choices || q.allow_dont_know) && (
                // 늘 있는 알림 칸(role=status): 모르겠어요를 고르면 글이 들어가 화면 읽기 프로그램도 읽는다. 비면 자리를 차지하지 않는다
                <p class="small diag-dk-note" role="status" data-testid={`diag-dk-note-${q.question_id}`}>
                  {dk ? `${DONT_KNOW_NOTE_KO} ${choices ? DONT_KNOW_UNDO_KO.choice : DONT_KNOW_UNDO_KO.text}` : ''}
                </p>
              )}
            </article>
          );
        })}
      </div>
      {(msg || missingMsg) && (
        <div class="result ng" role="status" data-testid="diag-msg">
          <span class="sym">
            <IconCross />
          </span>
          <p>{msg ?? missingMsg}</p>
        </div>
      )}
      {/* 알림(aria-live)은 두지 않는다: 누를 때 알림은 카드 안 안내 칸(role=status) 하나로 충분하다(P6-A 검수) */}
      <p class="cap num" data-testid="diag-progress">
        답한 문제 {p.questions.length - missing.length} / {p.questions.length}
      </p>
      <div class="row">
        {latest && (
          <button type="button" class="btn" onClick={() => setRetake(false)}>
            지난 결과 보기
          </button>
        )}
        <button type="button" class="btn primary grow" onClick={submit} disabled={busy} data-testid="diag-submit">
          결과 보기
        </button>
      </div>
      <p class="next">
        <b>다음:</b> <span>결과에 맞는 추천 시작 단위</span>
      </p>
    </div>
  );
}

/** 마운트 전에는 안의 버튼·입력칸이 눌리지 않게 감싼다(Gate.tsx) */
export default gated(DiagnosticAppView, 'DiagnosticApp');
