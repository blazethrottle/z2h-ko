// 확인 문제 카드 (spec 5절). 풀이(answer_ko)·정답 코드(answer_code)·채점 값은 제출할 때 /data/{편}/answers.json 에서 불러오고,
// 제출 뒤(맞았거나, 예측·고르기이거나, "풀이 보기"를 눌렀을 때)에만 화면에 그린다.
// 입력 칸 이름은 정본 graded_on(output: 고친 코드를 실행해 나온 결과, answer_text: 답, rubric: 채점 기준으로 스스로)을 따른다.
// 힌트는 유형과 상관없이 정본에 있으면 보인다(클로드 버전은 예측 문제에도 H1~H4).
import { useEffect, useState } from 'preact/hooks';
import { gradeQuestion, scoreAttempt, scoreLineKo, bestQuestionScore, type GradableQuestion, type GradeResult, type RubricItem } from '../lib/grading';
import { recordAttempt } from '../lib/hints';
import { handleRadioKey } from '../lib/radio';
import { answersUrl, fetchJsonOnce, type Runtime } from '../lib/runtime';
import type { Row } from '../lib/sync/store';
import { nowKst, uuid4 } from '../lib/time';
import CodeBlock from './CodeBlock';
import HintLadder, { useHintState } from './HintLadder';
import Inline from './Inline';
import { useUiState } from './hooks';
import { IconCheck, IconCross, IconHalf } from './Icons';

export interface PublicQuestion {
  question_id: string;
  /** 이 문제를 내는 단계(정본 after_step) */
  after_step?: string | null;
  type: 'predict' | 'explain' | 'fix_bug' | 'apply' | 'choice';
  prompt_ko: string;
  code: string | null;
  choices: string[] | null;
  /** 고르기의 "모르겠어요" 보기 번호(정본 dont_know_index). 없으면 그런 보기가 없다 */
  dont_know_index?: number | null;
  max_points: number;
  must_pass: boolean;
  /** false 면 제출 없이 바로 풀이, 점수·복습 없음 (data-spec v1.2) */
  scored: boolean;
  grade_type: string;
  /** 입력 칸에 무엇을 쓰는지(정본 graded_on). null 이면 유형별 기본 */
  graded_on?: 'output' | 'answer_text' | 'rubric' | null;
  hint_levels: number[];
  hint_unlock: Record<number, { after_attempts?: number | null; after_minutes?: number | null }>;
}

interface AnswerData {
  answer_ko: string;
  auto_grade: GradableQuestion['auto_grade'];
  rubric: RubricItem[];
  answer_index: number | null;
  choices: string[] | null;
  max_points: number;
  type: string;
  answer_code?: string | null;
  answer_code_line_notes_ko?: string[] | null;
  answer_output?: string | null;
}

/** 입력 칸 이름: graded_on 이 있으면 그것, 없으면 유형별 */
function inputLabelKo(q: PublicQuestion): string {
  if (q.graded_on === 'output') return q.type === 'fix_bug' ? '고친 코드를 실행해 나온 결과' : '코드를 실행해 나온 결과';
  if (q.type === 'fix_bug' && q.graded_on !== 'answer_text') return '고칠 곳과 고친 코드';
  return '내 답';
}

const TYPE_LABEL: Record<string, string> = {
  choice: '고르기',
  predict: '결과 예측',
  explain: '내 말로 설명',
  fix_bug: '버그 고치기',
  apply: '적용하기',
};
const GRADE_LABEL: Record<string, string> = {
  choice: '보기 고르기로 채점',
  exact: '정확히 맞히기로 채점',
  numeric_range: '숫자 범위로 채점',
  keywords: '핵심어로 채점 · 고칠 수 있음',
  manual: '채점 기준을 스스로 확인',
};

/** 고르기 보기 목록 (spec 5절: radiogroup, 번호 원 + 글자, 고른 행 "고름"). 확인 문제와 기초 진단이 같이 쓴다 */
export function ChoiceOptions({
  labelledBy,
  choices,
  value,
  locked,
  onChange,
}: {
  labelledBy: string;
  choices: string[];
  value: number | null;
  locked: boolean;
  onChange: (i: number) => void;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} class="stack-sm">
      {choices.map((c, i) => (
        <button
          type="button"
          role="radio"
          class="opt"
          aria-checked={value === i}
          aria-disabled={locked}
          tabIndex={value === i || (value == null && i === 0) ? 0 : -1}
          onClick={() => !locked && onChange(i)}
          onKeyDown={(e) => {
            if (locked) return;
            handleRadioKey(e, value, choices.length, onChange);
          }}
        >
          <span class="on num">{i + 1}</span>
          <span class="grow">{c}</span>
          {value === i && <span class="cap">고름</span>}
        </button>
      ))}
    </div>
  );
}

function reasonKo(q: PublicQuestion, g: GradeResult): string {
  if (g.verdict === 'correct') return '';
  if (q.type === 'choice') return g.is_dont_know ? '모르겠어요를 골랐습니다. 감점 없이 기록만 합니다.' : '고른 보기가 답과 다릅니다.';
  switch (g.reason_code) {
    case 'no_number':
      return '숫자를 찾지 못했습니다. 숫자로 적어 주세요.';
    case 'out_of_range':
      return '적은 숫자가 맞는 범위 밖입니다.';
    case 'mismatch':
      return '적은 답이 맞는 답과 다릅니다.';
    default:
      return g.verdict === 'partial' ? '채점 기준 중 일부만 들어 있습니다.' : '채점 기준에 맞는 내용이 아직 없습니다.';
  }
}

export default function QuestionCard({
  rt,
  lectureId,
  q,
  attempts,
  basicsReady,
  allowRetry = false,
}: {
  rt: Runtime | null;
  lectureId: string;
  q: PublicQuestion;
  attempts: Row[];
  /** 힌트 H2의 기초 단위 링크용(준비된 단위 id) */
  basicsReady?: string[];
  /** 풀이가 열린 뒤에도 맞힌 기록이 없으면 "다시 풀기"를 보인다(사전 기초: 단위 완료가 "전부 정답"이라서) */
  allowRetry?: boolean;
}) {
  const [text, setText] = useState('');
  const [choice, setChoice] = useState<number | null>(null);
  const [phase, setPhase] = useState<'answer' | 'rubric'>('answer');
  const [checks, setChecks] = useState<boolean[]>([]);
  const [autoChecked, setAutoChecked] = useState<boolean[] | null>(null);
  const [answers, setAnswers] = useState<AnswerData | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [last, setLast] = useState<GradeResult | null>(null);
  const [revealed, setRevealed] = useUiState<boolean>(rt, `revealed:${q.question_id}`, false);
  const [hint, setHint] = useHintState(rt, q.question_id);

  const mine = attempts.filter((a) => a.question_id === q.question_id).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const lastRow = mine[mine.length - 1];
  const best = bestQuestionScore(mine);
  const bestRow = mine.find((a) => Number(a.points_awarded ?? 0) === best.points) ?? lastRow;
  const isRubric = q.grade_type === 'keywords' || q.grade_type === 'manual';
  const showHints = q.hint_levels.length > 0 && !revealed;

  const loadAnswers = async (): Promise<AnswerData | null> => {
    try {
      const all = await fetchJsonOnce<Record<string, AnswerData>>(answersUrl(lectureId));
      const a = all[q.question_id] ?? null;
      setAnswers(a);
      return a;
    } catch {
      setMsg('채점 자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 제출해 주세요.');
      return null;
    }
  };

  const gradable = (a: AnswerData) => ({
    type: q.type,
    max_points: q.max_points,
    choices: a.choices ?? undefined,
    answer_index: a.answer_index ?? undefined,
    dont_know_index: q.dont_know_index ?? undefined,
    auto_grade: a.auto_grade,
    rubric: a.rubric,
  });

  const record = async (g: GradeResult) => {
    const maxHint = hint?.opened ?? 0;
    const { score_ratio, points_awarded } = scoreAttempt(g.raw_points, maxHint);
    // 열쇠는 이 기기가 만든 attempt_id(UUID). attempt_no 는 서버가 도착 순서로 매긴다(12.5절)
    await rt?.store.put('question_attempt', {
      question_id: q.question_id,
      attempt_id: uuid4(),
      answer_text: q.type === 'choice' ? (answers?.choices?.[choice ?? -1] ?? '') : text,
      choice_index: q.type === 'choice' ? choice : null,
      is_dont_know: g.is_dont_know,
      is_correct: g.is_correct,
      raw_points: g.raw_points,
      max_hint_level: maxHint,
      score_ratio,
      points_awarded,
      env_issue: false,
      at: nowKst(),
    });
    setHint((s) => recordAttempt(s, g.is_correct, Date.now()));
    setLast(g);
    setPhase('answer');
    if (g.is_correct || q.type === 'predict' || q.type === 'choice') setRevealed(true);
  };

  const submit = async () => {
    setMsg(null);
    if (q.type === 'choice' && choice == null) return setMsg('보기를 하나 골라 주세요.');
    if (q.type !== 'choice' && !text.trim()) return setMsg('답을 적어 주세요.');
    const a = answers ?? (await loadAnswers());
    if (!a) return;
    const g = gradeQuestion(gradable(a), { text, choiceIndex: choice ?? undefined });
    if (isRubric) {
      const pre = g.autoChecked ?? a.rubric.map(() => false);
      setAutoChecked(q.grade_type === 'keywords' ? pre : null);
      setChecks(pre);
      setPhase('rubric');
      return;
    }
    await record(g);
  };

  const confirmRubric = async () => {
    if (!answers) return;
    await record(gradeQuestion(gradable(answers), { text, checked: checks }));
  };

  /** 다시 풀기: 풀이를 닫고(화면에서 뺀다) 답 칸을 비운다. 지난 시도 기록은 그대로 남는다 */
  const retry = () => {
    setRevealed(false);
    setText('');
    setChoice(null);
    setLast(null);
    setMsg(null);
    setPhase('answer');
  };

  const reveal = async () => {
    if (!answers && !(await loadAnswers())) return;
    setRevealed(true);
  };

  // 다시 열었을 때 풀이를 보여 줘야 하면 불러 둔다. 점수 없는 문항은 처음부터 풀이를 보인다
  useEffect(() => {
    if ((revealed || q.scored === false) && !answers) void loadAnswers();
  }, [revealed, rt]);

  if (q.scored === false) {
    return (
      <article class="card stack" data-testid={`question-${q.question_id}`}>
        <div class="row">
          <span class="badge">{TYPE_LABEL[q.type]}</span>
          <span class="cap num">{q.question_id}</span>
          <span class="cap">점수 없이 풀이만</span>
        </div>
        <h3 class="t3">
          <Inline text={q.prompt_ko} />
        </h3>
        {q.code && <pre class="plain-code">{q.code.replace(/\n+$/, '')}</pre>}
        {answers && (
          <section class="card sunken stack-sm" data-testid={`answer-${q.question_id}`} aria-label="풀이">
            <h4 class="label">풀이</h4>
            <p>
              <Inline text={answers.answer_ko} />
            </p>
          </section>
        )}
      </article>
    );
  }

  const shownGrade: GradeResult | null =
    last ??
    (lastRow
      ? {
          raw_points: Number(lastRow.raw_points ?? 0),
          max_points: q.max_points,
          verdict: lastRow.is_correct ? 'correct' : Number(lastRow.raw_points ?? 0) > 0 ? 'partial' : 'wrong',
          is_correct: !!lastRow.is_correct,
          is_dont_know: !!lastRow.is_dont_know,
        }
      : null);
  const locked = revealed;

  return (
    <article class="card stack" data-testid={`question-${q.question_id}`} aria-labelledby={`qh-${q.question_id}`}>
      <div class="row">
        <span class="badge cur">{TYPE_LABEL[q.type]}</span>
        <span class="cap num">{q.question_id}</span>
        <span class="cap">{GRADE_LABEL[q.grade_type] ?? ''}</span>
      </div>
      <h3 class="t3" id={`qh-${q.question_id}`}>
        <Inline text={q.prompt_ko} />
      </h3>
      {q.code && <pre class="plain-code">{q.code.replace(/\n+$/, '')}</pre>}

      {q.type === 'choice' && q.choices && <ChoiceOptions labelledBy={`qh-${q.question_id}`} choices={q.choices} value={choice} locked={locked} onChange={setChoice} />}
      {q.type === 'predict' && (
        <label class="field">
          {inputLabelKo(q)}
          <input class="input" value={text} disabled={locked} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
        </label>
      )}
      {(q.type === 'explain' || q.type === 'apply' || q.type === 'fix_bug') && (
        <label class="field">
          {inputLabelKo(q)}
          <textarea
            class={`input${q.type === 'fix_bug' || q.graded_on === 'output' ? ' code-input' : ''}`}
            value={text}
            disabled={locked}
            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
            data-testid={`answer-input-${q.question_id}`}
          />
        </label>
      )}

      {phase === 'rubric' && answers && (
        <fieldset class="stack-sm" style="border:0;padding:0;margin:0">
          <legend class="label">채점 기준: 내 설명에 들어 있는 것을 고르세요</legend>
          {autoChecked && <p class="cap">앱이 핵심어로 미리 고른 것입니다. 맞지 않으면 고쳐 주세요.</p>}
          {answers.rubric.map((r, i) => (
            <label class="check-row">
              <input
                type="checkbox"
                checked={!!checks[i]}
                onChange={(e) => {
                  const n = [...checks];
                  n[i] = (e.target as HTMLInputElement).checked;
                  setChecks(n);
                }}
              />
              <span>
                <Inline text={r.criterion_ko} />
              </span>
              <span class="pts">{r.point}점</span>
            </label>
          ))}
          <button type="button" class="btn" onClick={confirmRubric}>
            채점 확정
          </button>
        </fieldset>
      )}

      {phase === 'answer' && !locked && (
        <div class="row">
          <button type="button" class="btn" onClick={submit} data-testid={`submit-${q.question_id}`}>
            제출
          </button>
          {mine.length > 0 && (
            <button type="button" class="btn ghost" onClick={reveal}>
              풀이 보기
            </button>
          )}
        </div>
      )}
      {msg && (
        <div class="result ng" role="status">
          <span class="sym">
            <IconCross />
          </span>
          <p>{msg}</p>
        </div>
      )}

      {shownGrade && phase === 'answer' && (
        <div class={`result ${shownGrade.verdict === 'correct' ? 'ok' : shownGrade.verdict === 'partial' ? 'part' : 'ng'}`} role="status" data-testid={`result-${q.question_id}`}>
          <span class="sym">{shownGrade.verdict === 'correct' ? <IconCheck size={20} /> : shownGrade.verdict === 'partial' ? <IconHalf size={20} /> : <IconCross size={20} />}</span>
          <div class="stack-sm">
            <p class="title">{shownGrade.verdict === 'correct' ? '맞음' : shownGrade.verdict === 'partial' ? '절반 (흔들림)' : '다시'}</p>
            {shownGrade.verdict !== 'correct' && <p>{reasonKo(q, shownGrade)}</p>}
            {q.type === 'predict' && shownGrade.verdict !== 'correct' && <p class="small">예측 문제는 틀려도 풀이로 이어집니다.</p>}
            {bestRow && <p class="small num">{scoreLineKo(best.points, q.max_points, Number(bestRow.max_hint_level ?? 0))}</p>}
          </div>
        </div>
      )}

      {locked && answers && (
        <section class="card sunken stack-sm" data-testid={`answer-${q.question_id}`} aria-label="풀이">
          <h4 class="label">풀이</h4>
          <p>
            <Inline text={answers.answer_ko} />
          </p>
          {q.type === 'choice' && answers.answer_index != null && answers.choices && (
            <p class="small">
              답: {answers.answer_index + 1}번 {answers.choices[answers.answer_index]}
            </p>
          )}
          {answers.answer_code && (
            <CodeBlock
              code={answers.answer_code}
              notes={answers.answer_code_line_notes_ko ?? []}
              heading={answers.answer_code_line_notes_ko?.length ? '풀이 코드 · 줄을 누르면 풀이' : '풀이 코드'}
              testId={`answer-code-${q.question_id}`}
            />
          )}
          {answers.answer_output && (
            <div class="stack-sm">
              <p class="cap">풀이 코드의 출력</p>
              <pre class="out" data-testid={`answer-output-${q.question_id}`}>
                {answers.answer_output}
              </pre>
            </div>
          )}
          {answers.rubric?.length > 0 && (
            <ul class="small">
              {answers.rubric.map((r) => (
                <li>
                  <Inline text={r.criterion_ko} /> <span class="num muted">({r.point}점)</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {allowRetry && locked && !mine.some((a) => a.is_correct === true) && (
        <div class="stack-sm">
          <p class="small muted">아직 맞힌 기록이 없습니다. 풀이를 읽은 뒤 다시 풀 수 있습니다.</p>
          <button type="button" class="btn" onClick={retry} data-testid={`retry-${q.question_id}`}>
            다시 풀기
          </button>
        </div>
      )}

      {showHints && (
        <HintLadder
          rt={rt}
          lectureId={lectureId}
          targetId={q.question_id}
          targetTitle={q.prompt_ko}
          ctx="question"
          levels={q.hint_levels}
          unlock={q.hint_unlock}
          state={hint}
          setState={setHint}
          onOpened={() => {}}
          emphasize={shownGrade != null && shownGrade.verdict !== 'correct'}
          basicsReady={basicsReady}
        />
      )}
    </article>
  );
}
