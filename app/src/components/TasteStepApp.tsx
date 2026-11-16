// 맛보기 단계 화면 /taste/S01/ ~ (spec 13.2, 목업 v2_taste_step). 영상 플레이어는 그리지 않는다(맛보기는 모두 영상 없음, D53).
// 단계 완료는 "직접 확인했어요 · 완료"(self_reported similar)로만 기록하고, "다르게 나왔어요"(different)는 힌트 1단계를 연다(D54).
import { useEffect, useState } from 'preact/hooks';
import { recordAttempt, openHint } from '../lib/hints';
import { answersUrl, fetchJsonOnce, hintsUrl } from '../lib/runtime';
import { hasDecimal, saveSelfReport, type SelfReport } from '../lib/taste';
import { nowKst } from '../lib/time';
import { useHintState } from './HintLadder';
import Inline from './Inline';
import { IconCheck, IconExternal } from './Icons';
import { TASTER_ID, TasteBar, TasteCode, TasteHints, TasteOutput, TasteQuestion, tasteHref, useTaste, type TasteNav, type TasteQuestionPub, type TasteStep } from './TasteParts';
import { gated } from './Gate';

export interface TasteNotebook {
  file: string;
  url: string | null;
}

interface Props {
  step: TasteStep;
  steps: TasteNav[];
  questions: TasteQuestionPub[];
  requiredSteps: string[];
  contentVersion: string;
  notebook: TasteNotebook;
  colabUrl: string | null;
}

export function NotebookCard({ notebook, colabUrl }: { notebook: TasteNotebook; colabUrl: string | null }) {
  return (
    <section class="card stack-sm" id="notebook" aria-label="맛보기 노트북 열기" data-testid="taste-notebook">
      <h2 class="t3">맛보기 노트북 열기</h2>
      {colabUrl ? (
        <a class="btn block" href={colabUrl} target="_blank" rel="noopener noreferrer" data-testid="taste-colab-open">
          Colab 맛보기 노트북 열기 <IconExternal />
        </a>
      ) : (
        <>
          <ol class="small">
            <li>아래 "맛보기 노트북 받기"로 {notebook.file} 파일을 내 기기에 저장합니다.</li>
            <li>
              <a href="https://colab.research.google.com/" target="_blank" rel="noopener noreferrer">
                colab.research.google.com
              </a>
              을 열고 파일 메뉴의 "노트북 업로드"에서 받은 파일을 고릅니다.
            </li>
            <li>오른쪽 위 "연결"을 누릅니다. 연결됨이 보이면 다음으로 갑니다.</li>
          </ol>
          {notebook.url ? (
            <a class="btn block" href={notebook.url} download={notebook.file} data-testid="taste-notebook-download">
              맛보기 노트북 받기
            </a>
          ) : (
            <p class="waiting" data-testid="taste-notebook-pending">
              노트북 준비 중
            </p>
          )}
        </>
      )}
      <p class="cap">Colab은 Google 로그인이 필요할 수 있습니다.</p>
      <a class="btn ghost" href="/taste/precomputed/" data-testid="taste-precomputed-link">
        Colab을 못 여나요? 미리 계산한 결과 보기
      </a>
    </section>
  );
}

function TasteStepAppView(p: Props) {
  const s = p.step;
  const { rt, loaded, attemptNo, status } = useTaste(p.requiredSteps);
  const [hint, setHint] = useHintState(rt, s.step_id);
  const [msg, setMsg] = useState<string | null>(null);
  const total = p.steps.length;
  const idx = p.steps.findIndex((x) => x.step_id === s.step_id);
  const prev = idx > 0 ? p.steps[idx - 1] : null;
  const next = idx >= 0 && idx < total - 1 ? p.steps[idx + 1] : null;
  const confirmed = status.confirmed.has(s.step_id);
  const different = status.different.has(s.step_id);
  const first = idx === 0;

  // 풀이·힌트 JSON은 화면에 그리지 않고 메모리에만 미리 받아 둔다(고르는 즉시 풀이가 보이게)
  useEffect(() => {
    const idle = (window as any).requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 300));
    idle(() => {
      if (p.questions.length) fetchJsonOnce(answersUrl(TASTER_ID)).catch(() => {});
      fetchJsonOnce(hintsUrl(TASTER_ID)).catch(() => {});
    });
  }, []);

  const report = async (value: SelfReport) => {
    if (!rt) return setMsg('이 브라우저에 저장하지 못했습니다. 잠시 뒤 다시 눌러 주세요.');
    await saveSelfReport(rt.store, { attemptNo, stepId: s.step_id, value, contentVersion: p.contentVersion, at: nowKst() });
  };
  const onConfirm = async () => {
    setMsg(null);
    await report('similar');
  };
  const onDifferent = async () => {
    setMsg(null);
    await report('different');
    setHint((h) => {
      const n = recordAttempt(h, false, Date.now());
      return n.opened === 0 ? openHint(n, 1, Date.now()) : n;
    });
    setMsg('힌트 1단계부터 열었습니다. 힌트를 보고 다시 실행해 보세요. 같아지면 "직접 확인했어요 · 완료"를 눌러 주세요.');
    setTimeout(() => document.getElementById('taste-hints')?.scrollIntoView({ block: 'nearest' }), 50);
  };

  const ex = s.expected_output_example ?? null;
  const nextHref = next ? tasteHref(next.slug) : '/taste/';

  return (
    <div class="stack" data-step={s.step_id}>
      <header class="stack-sm">
        <div class="tkick">
          <p class="kicker">30분 맛보기 · 가입 없이</p>
          <p class="cap num" data-testid="taste-position">
            {s.order} / {total} · 약 {s.minutes}분
          </p>
        </div>
        <TasteBar steps={p.steps} current={s.step_id} confirmed={status.confirmed} />
        <h1 class="t1">{s.title_ko}</h1>
        <p>
          <Inline text={s.input_ko} />
          {s.kind === 'copy_run' && ' 코드를 이해할 필요는 없고, 풀이를 읽기만 하면 됩니다.'}
        </p>
      </header>

      <div class="tgrid">
        <div class="stack">
          {first && <NotebookCard notebook={p.notebook} colabUrl={p.colabUrl} />}
          {s.code && (
            <TasteCode
              code={s.code}
              notes={s.code_line_notes_ko ?? []}
              heading="준비된 코드 · 붙여넣기만"
              note="맛보기 코드는 모두 붙여 넣고 실행만 합니다 · 점수와 예측 없음"
              testId="taste-code"
            />
          )}
          {s.code_alt_local && (
            <details class="card stack-sm" data-testid="taste-alt">
              <summary>Colab 밖에서 하려면 (맥미니 Jupyter 등)</summary>
              <TasteCode
                code={s.code_alt_local}
                notes={s.code_alt_local_line_notes_ko ?? []}
                heading="Colab 밖에서 쓸 대체 셀"
                note="Colab에서는 위 셀을 그대로 쓰면 됩니다"
                foldable={false}
              />
            </details>
          )}
          {!first &&
            (p.colabUrl ? (
              <a class="btn block" href={p.colabUrl} target="_blank" rel="noopener noreferrer">
                Colab 맛보기 노트북 다시 열기 <IconExternal />
              </a>
            ) : (
              <a class="btn block" href={`${tasteHref(p.steps[0].slug)}#notebook`}>
                맛보기 노트북 받기와 Colab 안내
              </a>
            ))}
        </div>

        <div class="stack">
          <section class={`card stack-sm${confirmed ? '' : ' current'}`} aria-label="보여야 하는 것" data-testid="taste-check">
            <h2 class="t3">보여야 하는 것</h2>
            {ex && <TasteOutput text={ex} />}
            <p>
              <Inline text={s.expected_ko} />
              {hasDecimal(ex) && ' 환경에 따라 소수 셋째 자리가 조금 다를 수 있습니다.'}
            </p>
            <p class="small" data-testid="taste-aha">
              <b>깨달음 한 줄:</b> <Inline text={s.aha_ko} />
            </p>
            <p class="label">내 Colab 화면도 이렇게 나왔나요?</p>
            <p class="cap">앱은 Colab 화면을 읽지 못합니다. 직접 보고 눌러 주세요.</p>
            {confirmed ? (
              <div class="stack-sm">
                <div class="result ok" role="status" data-testid="taste-confirmed">
                  <span class="sym">
                    <IconCheck size={20} />
                  </span>
                  <div>
                    <p class="title">직접 확인함</p>
                    <p>완료로 기록했습니다.</p>
                  </div>
                </div>
                <a class="btn primary block" href={nextHref} data-testid="taste-next">
                  {next ? `다음 단계 · ${next.order} / ${total} ${next.title_ko}` : '맛보기 처음으로'}
                </a>
                <button type="button" class="btn ghost" onClick={onDifferent} data-testid="taste-different">
                  다르게 나왔어요
                </button>
              </div>
            ) : (
              <div class="tconfirm">
                <button type="button" class="btn primary" onClick={onConfirm} disabled={!loaded} data-testid="taste-confirm">
                  직접 확인했어요 · 완료
                </button>
                <button type="button" class="btn" onClick={onDifferent} disabled={!loaded} data-testid="taste-different">
                  다르게 나왔어요
                </button>
              </div>
            )}
            <p class="cap">"다르게 나왔어요"를 누르면 1단계 힌트가 열립니다.</p>
            <div aria-live="polite">
              {msg && <p class="small" data-testid="taste-msg">{msg}</p>}
              {!msg && different && !confirmed && <p class="small">다르게 나왔다고 기록했습니다. 힌트를 보고 다시 실행해 보세요.</p>}
            </div>
          </section>

          {p.questions.map((q) => (
            <TasteQuestion rt={rt} q={q} />
          ))}

          {s.hint_levels.length > 0 && (
            <TasteHints
              rt={rt}
              targetId={s.step_id}
              title={s.title_ko}
              levels={s.hint_levels}
              unlock={s.hint_unlock}
              state={hint}
              setState={setHint}
              code={s.code}
              emphasize={different && !confirmed}
            />
          )}

          <p class="next">
            <b>다음:</b> <span>{next ? `${next.order} / ${total} · ${next.title_ko} (약 ${next.minutes}분)` : '맛보기 처음으로'}</span>
          </p>
          <div class="row">
            <a class="btn" href={prev ? tasteHref(prev.slug) : '/taste/'}>
              {prev ? '이전 단계' : '맛보기 처음으로'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 마운트 전에는 안의 버튼·입력칸이 눌리지 않게 감싼다(Gate.tsx) */
export default gated(TasteStepAppView, 'TasteStepApp');
