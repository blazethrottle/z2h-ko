// 맛보기 끝 화면 = 마지막 단계(T-S08 정리와 다음 길) (spec 13.2, 목업 v2_taste_done).
// "맛보기 완료"는 배지가 아니라 표시다(VALUE 2절). 필요한 단계를 이 시도에서 모두 "직접 확인했어요"로 누르면 보인다.
// 이름 붙여 넣기 카드: T-S07 출력(이름)과 첫·마지막 손실(선택)을 붙여 넣어 taster_result(T-S07 줄)에 저장한다. 앱이 확인하지 않은 값이다.
// a~z 밖 글자가 있거나 20글자 넘는 줄은 저장·카드에서 뺀다(개인 정보를 붙여 넣는 경우 대비, P2 검수 권고 2).
// 저장한 뒤 "이름 카드 만들기"로 공유 카드 화면(/share/?card=ART-TASTER)에 간다. 가입·로그인 화면은 없다(자리 문구 한 줄).
// 맛보기 완료가 되면 완료 표시(user_badge TASTER-DONE, 배지 아님)를 저장한다(src/badge-rules.ts).
import { useEffect, useState } from 'preact/hooks';
import { config } from '../config';
import { openHint, recordAttempt } from '../lib/hints';
import { cleanNames, parseLoss, saveNames, saveSelfReport, splitSummary, type SelfReport } from '../lib/taste';
import { nowKst } from '../lib/time';
import { useHintState } from './HintLadder';
import Inline from './Inline';
import { IconCheck } from './Icons';
import { TasteBar, TasteHints, tasteHref, useTaste, type TasteNav, type TasteStep } from './TasteParts';
import { gated } from './Gate';
import { useBadgeAwards } from './BadgeNotice';

export interface TasteArtifact {
  name_ko: string;
  unlock_after: string;
  humble_line_ko: string;
  disclaimer_ko: string;
}

interface Props {
  step: TasteStep;
  steps: TasteNav[];
  requiredSteps: string[];
  contentVersion: string;
  artifact: TasteArtifact | null;
  links: { diagnostic: string; basics: string; lecture: string; lectureLabel: string };
}

function TasteDoneAppView(p: Props) {
  const s = p.step;
  const { rt, rows, loaded, attemptNo, status } = useTaste(p.requiredSteps);
  useBadgeAwards(rt, { taste: { required_steps: p.requiredSteps, content_version: p.contentVersion } });
  const [hint, setHint] = useHintState(rt, s.step_id);
  const total = p.steps.length;
  const confirmed = status.confirmed.has(s.step_id);
  const different = status.different.has(s.step_id);
  const sum = splitSummary(s.summary_ko);
  const missing = p.steps.filter((x) => p.requiredSteps.includes(x.step_id) && !status.confirmed.has(x.step_id));
  const idx = p.steps.findIndex((x) => x.step_id === s.step_id);
  const prev = idx > 0 ? p.steps[idx - 1] : null;

  const report = async (value: SelfReport) => {
    if (!rt) return;
    await saveSelfReport(rt.store, { attemptNo, stepId: s.step_id, value, contentVersion: p.contentVersion, at: nowKst() });
  };
  const onDifferent = async () => {
    await report('different');
    setHint((h) => {
      const n = recordAttempt(h, false, Date.now());
      return n.opened === 0 ? openHint(n, 1, Date.now()) : n;
    });
  };

  return (
    <div class="stack" data-step={s.step_id}>
      <div class="tkick">
        <p class="kicker">30분 맛보기 · 가입 없이</p>
        <p class="cap num" data-testid="taste-position">
          {s.order} / {total} · 약 {s.minutes}분
        </p>
      </div>
      <TasteBar steps={p.steps} current={status.complete ? null : s.step_id} confirmed={status.confirmed} />

      <div class="taste-done">
        <section class="card current stack" aria-labelledby="taste-done-h" data-testid="taste-done">
          <p class="kicker num">
            맛보기 {s.order} / {total} · 정리
          </p>
          {status.complete ? (
            <>
              <h1 class="t1 taste-title" id="taste-done-h">
                <IconCheck size={26} /> 내 컴퓨터가 처음 보는 이름을 지어냈습니다
              </h1>
              <p class="row">
                <span class="badge ok" data-testid="taste-complete">
                  맛보기 완료
                </span>
                <span class="cap">배지가 아닌 완료 표시입니다.</span>
              </p>
            </>
          ) : (
            <h1 class="t1" id="taste-done-h">
              {s.title_ko}
            </h1>
          )}
          <h2 class="t3">오늘 한 일</h2>
          <p>
            <Inline text={sum.today} />
          </p>
          {status.complete ? (
            <p class="cap num" data-testid="taste-all-confirmed">
              {p.requiredSteps.length}단계 모두 직접 확인함 · 앱은 Colab 결과를 읽지 못해 완료는 내가 누른 "직접 확인했어요"로 기록합니다.
            </p>
          ) : (
            <div class="stack-sm" data-testid="taste-not-done">
              <p class="cap num">
                {status.confirmed.size} / {p.requiredSteps.length}단계 직접 확인함 · 앱은 Colab 결과를 읽지 못해 완료는 내가 누른 "직접 확인했어요"로 기록합니다.
              </p>
              {missing.filter((x) => x.step_id !== s.step_id).length > 0 && (
                <div class="stack-sm">
                  <p class="small">아직 직접 확인하지 않은 단계</p>
                  <ul class="small" data-testid="taste-missing">
                    {missing
                      .filter((x) => x.step_id !== s.step_id)
                      .map((x) => (
                        <li>
                          <a class="tlink" href={tasteHref(x.slug)}>
                            {x.order} / {total} {x.title_ko}
                          </a>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {!confirmed && (
                <>
                  <p class="label">이 화면에 정리 문구와 다음 길 단추가 보이나요?</p>
                  <div class="tconfirm">
                    <button
                      type="button"
                      class="btn primary"
                      disabled={!loaded}
                      onClick={() => void report('similar')}
                      data-testid="taste-confirm"
                    >
                      직접 확인했어요 · 완료
                    </button>
                    <button type="button" class="btn" disabled={!loaded} onClick={onDifferent} data-testid="taste-different">
                      다르게 나왔어요
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {sum.next && (
            <>
              <h2 class="t3">다음 길</h2>
              <p>
                <Inline text={sum.next} />
              </p>
            </>
          )}
          <div class="row" data-testid="taste-next-paths">
            <a class="btn" href={p.links.diagnostic}>
              진단 5문제 풀기
            </a>
            <a class="btn" href={p.links.basics}>
              00 사전 기초
            </a>
            <a class="btn" href={p.links.lecture}>
              {p.links.lectureLabel}
            </a>
          </div>
          <p class="cap">02편은 01편 뒤에 열립니다.</p>
          <p class="cap">진단 결과와 상관없이 00과 01편은 열려 있습니다.</p>
          <p class="cap" data-testid="taste-signup-later">
            가입은 준비 중입니다.
          </p>
        </section>

        <div class="stack">
          {p.artifact && <NamesCard {...p} rows={rows} attemptNo={attemptNo} unlocked={status.confirmed.has(p.artifact.unlock_after)} rt={rt} />}
          {s.hint_levels.length > 0 && (hint?.opened ?? 0) > 0 && (
            <TasteHints rt={rt} targetId={s.step_id} title={s.title_ko} levels={s.hint_levels} unlock={s.hint_unlock} state={hint} setState={setHint} emphasize={different} />
          )}
          {!status.complete && s.hint_levels.length > 0 && (hint?.opened ?? 0) === 0 && (
            <p class="cap">화면이 이상하면 "다르게 나왔어요"를 누르면 힌트가 열립니다.</p>
          )}
          {prev && (
            <div class="row">
              <a class="btn" href={tasteHref(prev.slug)}>
                이전 단계
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NamesCard(p: Props & { rows: Record<string, any>[]; attemptNo: number; unlocked: boolean; rt: ReturnType<typeof useTaste>['rt'] }) {
  const a = p.artifact!;
  const unlockStep = p.steps.find((x) => x.step_id === a.unlock_after);
  const saved = p.rows.find((r) => Number(r.attempt_no) === p.attemptNo && r.step_id === a.unlock_after);
  const [names, setNames] = useState('');
  const [lossStart, setLossStart] = useState('');
  const [lossEnd, setLossEnd] = useState('');
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 저장해 둔 값이 있으면 칸을 채운다(처음 한 번)
  useEffect(() => {
    if (touched || !saved) return;
    if (saved.pasted_names_text) setNames(String(saved.pasted_names_text));
    if (saved.pasted_loss_start != null) setLossStart(String(saved.pasted_loss_start));
    if (saved.pasted_loss_end != null) setLossEnd(String(saved.pasted_loss_end));
  }, [saved?.pasted_names_text, saved?.pasted_loss_start, saved?.pasted_loss_end]);

  const clean = cleanNames(names);
  const savedText = saved?.pasted_names_text ?? null;

  const save = async () => {
    setMsg(null);
    if (!clean.names.length)
      return setMsg({
        ok: false,
        text: clean.flagged.length || clean.blockedRemoved.length
          ? '남은 이름이 없어 저장하지 않았습니다. 모델 출력만 넣어 주세요. 카드도 만들 수 없습니다.'
          : '붙여 넣은 이름이 없습니다. Colab의 출력 칸에서 이름 줄을 복사해 붙여 넣어 주세요.',
      });
    const ls = parseLoss(lossStart);
    const le = parseLoss(lossEnd);
    if (!ls.ok || !le.ok) return setMsg({ ok: false, text: '손실 칸에는 숫자만 넣어 주세요 (예: 3.84). 비워 두어도 됩니다.' });
    if (!p.rt) return setMsg({ ok: false, text: '이 브라우저에 저장하지 못했습니다. 잠시 뒤 다시 눌러 주세요.' });
    await saveNames(p.rt.store, {
      attemptNo: p.attemptNo,
      stepId: a.unlock_after,
      namesText: clean.text,
      lossStart: ls.value,
      lossEnd: le.value,
      contentVersion: p.contentVersion,
    });
    setNames(clean.text);
    setTouched(true);
    setMsg({ ok: true, text: `이름 ${clean.names.length}개를 이 기기에 저장했고, 연결되면 서버로 보냅니다. 붙여 넣은 값은 앱이 확인하지 않은 값입니다.` });
  };

  return (
    <section class="card stack-sm" aria-labelledby="names-h" data-testid="taste-names-card">
      <h2 class="t3" id="names-h">
        {a.name_ko} 만들기
      </h2>
      {!p.unlocked ? (
        <p class="small" data-testid="taste-names-locked">
          {unlockStep ? (
            <>
              <a class="tlink" href={tasteHref(unlockStep.slug)}>
                {unlockStep.order} / {p.steps.length} {unlockStep.title_ko}
              </a>
              를 "직접 확인했어요"로 마치면 만들 수 있습니다.
            </>
          ) : (
            '앞 단계를 마치면 만들 수 있습니다.'
          )}
        </p>
      ) : (
        <>
          <p class="small">
            Colab의 {a.unlock_after} 출력(이름 {config.taste.maxNames}줄)을 복사해 붙여 넣으세요. 앱은 Colab을 읽지 못해 붙여 넣은 글로만 카드를 만듭니다.
          </p>
          <label class="field">
            이름 {config.taste.maxNames}줄 붙여 넣기
            <textarea
              class="input code-input"
              value={names}
              onInput={(e) => {
                setTouched(true);
                setNames((e.target as HTMLTextAreaElement).value);
              }}
              data-testid="taste-names"
            />
          </label>
          <div class="grid2 stats">
            <label class="field">
              첫 손실 (선택)
              <input
                class="input"
                inputMode="decimal"
                value={lossStart}
                onInput={(e) => {
                  setTouched(true);
                  setLossStart((e.target as HTMLInputElement).value);
                }}
                data-testid="taste-loss-start"
              />
            </label>
            <label class="field">
              마지막 손실 (선택)
              <input
                class="input"
                inputMode="decimal"
                value={lossEnd}
                onInput={(e) => {
                  setTouched(true);
                  setLossEnd((e.target as HTMLInputElement).value);
                }}
                data-testid="taste-loss-end"
              />
            </label>
          </div>
          <p class="semibold" data-testid="taste-humble">
            {a.humble_line_ko}
          </p>
          <p class="cap">이름, 주소, 전화번호 같은 개인 정보는 넣지 마세요.</p>
          <div aria-live="polite" class="stack-sm">
            {clean.flagged.length > 0 && (
              <p class="small" data-testid="taste-names-flag">
                모델 출력만 넣어 주세요. a~z 이외 글자가 있거나 {config.taste.maxNameChars}글자가 넘는 줄은 저장하지 않고 카드에도 넣지 않습니다: {clean.flagged.join(', ')}번째 줄
              </p>
            )}
            {clean.dropped > 0 && <p class="small">이름은 {config.taste.maxNames}줄까지만 저장합니다. 뒤 {clean.dropped}줄은 넣지 않습니다.</p>}
            {clean.blockedRemoved.length > 0 && (
              <p class="small" data-testid="taste-names-blocked">
                카드에 넣지 않는 이름이 있어 뺐습니다. 셀을 다시 실행해 새 이름을 받아 보세요.
              </p>
            )}
            {names.trim() !== '' && clean.names.length === 0 && (
              <p class="small" data-testid="taste-names-none">
                남은 이름이 없습니다. 이대로는 저장하거나 카드를 만들 수 없습니다.
              </p>
            )}
          </div>
          <p class="cap">
            a~z 이외 글자나 {config.taste.maxNameChars}글자가 넘는 줄은 "모델 출력만 넣어 주세요"라고 알리고 저장·카드에서 뺍니다. {a.disclaimer_ko}
          </p>
          <button type="button" class="btn block" onClick={save} data-testid="taste-save-names">
            저장
          </button>
          <div aria-live="polite">
            {msg && (
              <div class={`result ${msg.ok ? 'ok' : 'ng'}`} role="status" data-testid="taste-names-result">
                <p>{msg.text}</p>
              </div>
            )}
          </div>
          {savedText && (
            <div class="stack-sm">
              <p class="cap">저장한 이름 (검증 안 된 값)</p>
              <pre class="out" data-testid="taste-names-saved">
                {String(savedText)}
              </pre>
            </div>
          )}
          {savedText ? (
            <a class="btn block" href="/share/?card=ART-TASTER" data-testid="taste-make-card">
              이름 카드 만들기
            </a>
          ) : (
            <p class="cap" data-testid="taste-card-after-save">
              이름을 저장하면 이름 카드를 만들 수 있습니다.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** 마운트 전에는 안의 버튼·입력칸이 눌리지 않게 감싼다(Gate.tsx) */
export default gated(TasteDoneAppView, 'TasteDoneApp');
