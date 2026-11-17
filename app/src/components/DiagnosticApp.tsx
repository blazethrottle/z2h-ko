// 사전 기초 진단 5문제 /basics/diagnostic/ (spec 8절·5절 "기초 진단 F-D1~D5도 같은 고르기 카드", 00-foundations.md 진단 절, D24·D35·D37).
// - 정본 lecture.diagnostic 약속대로: 추천만(recommend_only), 잠금 없음(locks), 자동 건너뛰기 없음(auto_skip), 힌트 없음(uses_hints).
//   약속 값이 다르면 빌드 검사가 실패하므로(content/basics.mjs) 이 화면에는 잠금·건너뛰기·힌트 부품이 아예 없다.
// - 안내는 정본 purpose_ko + spec 8절 "자동으로 건너뛰지 않음" 줄, 결과 문구는 정본 result_ko 그대로.
// - "모르겠어요"는 감점 없이 오답으로 기록하고 추천에만 쓴다. 직접 입력 문항은 정본 dont_know_allowed 이면 "모르겠어요" 버튼을 둔다(F-D3).
// - 정답(answer_index·채점 값)은 "결과 보기"를 누를 때 /data/F/answers.json 에서 불러온다(누르기 전에는 화면에 없음).
// - 결과는 diagnostic_result 한 행(쌓이는 기록)으로 저장되어 서버로 올라간다. 익힘·배지 계산에는 쓰지 않는다. 다시 풀 수 있다.
import { useEffect, useState } from 'preact/hooks';
import { diagnosticSummary, gradeDiagnostic, type DiagAnswer } from '../lib/basics';
import { answersUrl, fetchJsonOnce } from '../lib/runtime';
import { nowKst, uuid4 } from '../lib/time';
import type { BasicsRule } from '../lib/basics';
import { DiagnosticResultBox, NO_SKIP_KO, rowAnswers, useBasicsState, type BasicsUnitPub, type DiagQuestionPub, type ResultKo } from './BasicsParts';
import { gated } from './Gate';
import { useRuntime } from './hooks';
import { IconCross } from './Icons';
import Inline from './Inline';
import { ChoiceOptions } from './QuestionCard';

interface Props {
  lectureId: string;
  contentVersion: string;
  purposeKo: string;
  resultKo: ResultKo;
  questions: DiagQuestionPub[];
  units: BasicsUnitPub[];
  rule: BasicsRule;
}

interface Key {
  answer_ko?: string | null;
  answer_index: number | null;
  choices: string[] | null;
  auto_grade: any;
}

type Draft = { choice: number | null; text: string; dontKnow: boolean };
const blank = (): Draft => ({ choice: null, text: '', dontKnow: false });

function answerLine(q: DiagQuestionPub, k: Key | undefined): string | null {
  if (!k) return null;
  if (q.type === 'choice' && k.answer_index != null && q.choices) return `답: ${k.answer_index + 1}번 ${q.choices[k.answer_index]}`;
  const v = k.answer_ko ?? k.auto_grade?.value;
  return v != null ? `답: ${v}` : null;
}

function DiagnosticAppView(p: Props) {
  const rt = useRuntime();
  const { statusOf, latest } = useBasicsState(rt, p.units, p.rule);
  const unitOrder = p.units.map((u) => u.unit_id);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(p.questions.map((q) => [q.question_id, blank()])));
  const [retake, setRetake] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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

  const submit = async () => {
    setMsg(null);
    const missing = p.questions.filter((q) => !answered(q)).map((q) => q.question_id);
    if (missing.length) return setMsg(`아직 답하지 않은 문제가 있습니다: ${missing.join(', ')}`);
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
      <p class="small" data-testid="diag-purpose">
        <Inline text={p.purposeKo} bold />
      </p>
      <p class="small" data-testid="diag-no-skip">
        {NO_SKIP_KO}
      </p>
    </section>
  );

  if (showResult && summary) {
    return (
      <div class="stack" data-testid="diag-view-result">
        {intro}
        <DiagnosticResultBox summary={summary} resultKo={p.resultKo} units={p.units} statusOf={statusOf} />
        <ol class="list" aria-label="문항별 결과" data-testid="diag-review">
          {p.questions.map((q) => {
            const a = answers.find((x) => x.question_id === q.question_id);
            const line = answerLine(q, keys?.[q.question_id]);
            return (
              <li class="lrow" data-testid={`diag-review-${q.question_id}`}>
                <span class="no num unit">{q.question_id}</span>
                <span class="main small">
                  <Inline text={q.prompt_ko} />
                  {a && (
                    <span class="muted" style="display:block">
                      내 답: {a.answer_text || '–'}
                      {line ? ` · ${line}` : ''}
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
          <button type="button" class="btn" onClick={() => setRetake(true)} data-testid="diag-retake">
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
              {q.type === 'choice' && q.choices ? (
                <ChoiceOptions labelledBy={`dh-${q.question_id}`} choices={q.choices} value={d.choice} locked={false} onChange={(c) => set(q.question_id, { choice: c, dontKnow: false })} />
              ) : (
                <div class="stack-sm">
                  <label class="field">
                    내 답
                    <input
                      class="input"
                      value={d.text}
                      disabled={d.dontKnow}
                      onInput={(e) => set(q.question_id, { text: (e.target as HTMLInputElement).value })}
                      data-testid={`diag-input-${q.question_id}`}
                    />
                  </label>
                  {q.dont_know_allowed && (
                    <button
                      type="button"
                      class="btn"
                      aria-pressed={d.dontKnow}
                      onClick={() => set(q.question_id, { dontKnow: !d.dontKnow, text: '' })}
                      data-testid={`diag-dont-know-${q.question_id}`}
                    >
                      모르겠어요
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {msg && (
        <div class="result ng" role="status" data-testid="diag-msg">
          <span class="sym">
            <IconCross />
          </span>
          <p>{msg}</p>
        </div>
      )}
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
