// 공유 카드 미리 보기 /share/ (spec 13.5, 목업 v2_badges 오른쪽, D32·D42·D45·D54·D56, VALUE 2절 공유 원칙).
// 카드 2종: ?card=ART-TASTER(맛보기 이름 카드, 기본) / ?card=ART-L01(01편 학습 기록 카드).
// - 카드에는 모델 출력(a~z 이름, 손실 숫자)과 고정 문구만. 입력은 화이트리스트 객체(src/lib/share-card.ts)로만 만든다.
// - "이미지 저장"은 PNG 를 내 기기에 내려받기만 한다(서버에 올리지 않음). "글 복사"는 사실 문장.
// - "X에 공유"는 X 글쓰기 창(intent)을 새 창으로 열기만 한다. 자동 게시 API·공개 공유 주소·공개 카드 페이지 없음(X4).
// - 카드를 만들면 share_card(visibility private, image_path 비움) 행을 동기화로 저장하고, 이름 카드는 taster_result.share_card_id 를 잇는다.
import { useEffect, useRef, useState } from 'preact/hooks';
import { TASTE_MARK } from '../badge-rules';
import { config } from '../config';
import { drawCard, readCardTheme, savePng, waitCardFonts } from '../lib/card-draw';
import {
  cardFileName,
  cardReady,
  cardSpec,
  cardStrings,
  copyText,
  newShareId,
  parseLossLog,
  payloadOf,
  samePayload,
  sanitizeCardInput,
  shareCardRow,
  xIntentUrl,
  type CardInput,
  type CardKind,
  type L01CardText,
  type TasterCardText,
} from '../lib/share-card';
import { attemptOf, cleanNames, tasteStatus, TASTER_TABLE } from '../lib/taste';
import type { Runtime } from '../lib/runtime';
import type { Row } from '../lib/sync/store';
import { nowKst } from '../lib/time';
import { useRuntime, useTables } from './hooks';
import { IconExternal } from './Icons';
import { gated } from './Gate';

interface StepRef {
  step_id: string;
  href: string;
  label: string;
}

interface Props {
  taster: (TasterCardText & { content_version: string; required_steps: string[]; unlock_after: string; names_step: StepRef; name_ko: string }) | null;
  l01: (L01CardText & { content_version: string; unlock_step: StepRef; name_ko: string }) | null;
}


const createdAtOf = (r: Row) => String(r.created_at ?? r.updated_at ?? '');
const latestOfKind = (rows: Row[], kind: CardKind) =>
  rows
    .filter((r) => r.kind === kind && r.visibility !== 'public')
    .sort((a, b) => Date.parse(createdAtOf(a)) - Date.parse(createdAtOf(b)))
    .pop() ?? null;

// 같은 입력으로 카드 행을 두 번 만들지 않게(화면이 여러 번 다시 그려져도) 진행 중인 것을 기억한다
const creating = new Map<string, Promise<string>>();

/** 같은 입력의 카드 행이 있으면 그 id, 없으면 새로 만든다 */
async function recordCard(rt: Runtime, input: CardInput, contentVersion: string, preferId: string | null): Promise<string> {
  const key = JSON.stringify(input);
  const running = creating.get(key);
  if (running) return running;
  const p = (async () => {
    const rows = await rt.store.list('share_card');
    const pref = preferId ? rows.find((r) => r.share_id === preferId) : null;
    const same = pref && samePayload(pref, input) ? pref : rows.find((r) => r.kind === input.kind && samePayload(r, input));
    if (same) return String(same.share_id);
    const row = shareCardRow(input, newShareId(), nowKst(), contentVersion);
    await rt.store.put('share_card', row);
    return row.share_id;
  })();
  creating.set(key, p);
  try {
    return await p;
  } finally {
    creating.delete(key);
  }
}

function ShareAppView(p: Props) {
  const rt = useRuntime();
  const t = useTables(rt, [TASTER_TABLE, 'share_card', 'user_badge', 'step_progress']);
  const [kind, setKind] = useState<CardKind>('ART-TASTER');
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('card');
    if (q === 'ART-L01' || q === 'ART-TASTER') setKind(q);
  }, []);

  const kinds: { kind: CardKind; label: string }[] = [
    { kind: 'ART-TASTER', label: p.taster ? `${p.taster.name_ko} (맛보기)` : '이름 카드' },
    { kind: 'ART-L01', label: p.l01 ? `${p.l01.name_ko} (${p.l01.mark}편)` : '학습 기록 카드' },
  ];

  return (
    <div class="stack" data-testid="share" data-kind={kind} data-loaded={t ? 'true' : 'false'}>
      <h1 class="t1">공유 카드</h1>
      <nav class="row" aria-label="카드 종류" data-testid="card-kinds">
        {kinds.map((k) => (
          <a
            class="chip"
            href={`/share/?card=${k.kind}`}
            aria-current={kind === k.kind ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              setKind(k.kind);
              history.replaceState(null, '', `/share/?card=${k.kind}`);
            }}
          >
            {k.label}
          </a>
        ))}
      </nav>
      {kind === 'ART-TASTER' ? (
        p.taster ? <TasterCard p={p.taster} rt={rt} t={t} /> : <p class="waiting">자료 대기</p>
      ) : p.l01 ? (
        <L01Card p={p.l01} rt={rt} t={t} />
      ) : (
        <p class="waiting">자료 대기</p>
      )}
    </div>
  );
}

function TasterCard({ p, rt, t }: { p: NonNullable<Props['taster']>; rt: Runtime | null; t: Record<string, Row[]> | null }) {
  const rows = t?.[TASTER_TABLE] ?? [];
  const attemptNo = attemptOf(rows);
  const st = tasteStatus(rows, attemptNo, p.required_steps);
  const saved = rows.find((r) => Number(r.attempt_no) === attemptNo && r.step_id === p.unlock_after) ?? null;
  const clean = cleanNames(String(saved?.pasted_names_text ?? ''));
  const done = st.complete || (t?.user_badge ?? []).some((r) => r.badge_id === TASTE_MARK.badge_id);
  const input = sanitizeCardInput({
    kind: 'ART-TASTER',
    names: clean.names,
    loss_start: saved?.pasted_loss_start ?? null,
    loss_end: saved?.pasted_loss_end ?? null,
    taste_complete: done,
  });
  const ready = cardReady(input);

  const onDrawn = async () => {
    if (!rt || !input || !saved) return;
    const id = await recordCard(rt, input, p.content_version, saved.share_card_id ?? null);
    if (saved.share_card_id !== id) await rt.store.patch(TASTER_TABLE, { attempt_no: attemptNo, step_id: p.unlock_after }, { share_card_id: id });
  };

  return (
    <section class="card stack share-panel" aria-labelledby="share-h" data-testid="share-taster">
      <h2 class="t2" id="share-h">
        공유 카드 미리 보기
      </h2>
      {!t ? (
        <p class="small muted">불러오는 중입니다</p>
      ) : !ready ? (
        <div class="stack-sm" data-testid="card-need-input">
          <p class="small">
            카드에 넣을 이름이 아직 없습니다. 맛보기 끝 화면에서 Colab의 {p.unlock_after} 출력(이름)을 붙여 넣고 저장하면 여기서 카드를 만듭니다.
          </p>
          {saved?.pasted_names_text && <p class="small">저장한 글에 모델 출력(a~z 이름)이 없습니다. 모델 출력만 넣어 주세요.</p>}
          <a class="btn" href={p.names_step.href} data-testid="to-names">
            {p.names_step.label} 열기
          </a>
        </div>
      ) : (
        <>
          {clean.blockedRemoved.length > 0 && (
            <p class="small" data-testid="card-blocked">
              카드에 넣지 않는 이름이 있어 뺐습니다. 셀을 다시 실행해 새 이름을 받아 보세요.
            </p>
          )}
          <CardView input={input!} text={p} contentVersion={p.content_version} onDrawn={onDrawn} />
        </>
      )}
      {!ready && <SharePolicy ready={false} />}
    </section>
  );
}

function L01Card({ p, rt, t }: { p: NonNullable<Props['l01']>; rt: Runtime | null; t: Record<string, Row[]> | null }) {
  const unlocked = (t?.step_progress ?? []).some((r) => r.step_id === p.unlock_step.step_id && r.status === 'done');
  const latest = latestOfKind(t?.share_card ?? [], 'ART-L01');
  const [made, setMade] = useState<CardInput | null>(null);
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const current = made ?? payloadOf(latest);
  const ready = cardReady(current);

  const make = async () => {
    setMsg(null);
    const r = parseLossLog(paste);
    if (r.losses.length < 2) {
      return setMsg(`숫자를 읽지 못했습니다. 노트북 ${p.unlock_step.label} 셀의 출력 줄("0 4.83…"처럼 번호와 손실)을 그대로 복사해 붙여 넣어 주세요.`);
    }
    const input = sanitizeCardInput({ kind: 'ART-L01', losses: r.losses });
    if (!input || !cardReady(input)) return setMsg('숫자를 읽지 못했습니다. 출력 줄을 그대로 붙여 넣어 주세요.');
    setMade(input);
    const notes = [`손실 ${r.losses.length}줄을 읽었습니다.`];
    if (r.skipped) notes.push(`번호와 손실이 아닌 ${r.skipped}줄은 뺐습니다.`);
    if (r.dropped) notes.push(`앞 ${r.losses.length}줄까지만 씁니다.`);
    setMsg(notes.join(' '));
  };
  const onDrawn = async () => {
    if (!rt || !current) return;
    await recordCard(rt, current, p.content_version, latest?.share_id ?? null);
  };

  return (
    <section class="card stack share-panel" aria-labelledby="share-h" data-testid="share-l01">
      <h2 class="t2" id="share-h">
        공유 카드 미리 보기
      </h2>
      {!t ? (
        <p class="small muted">불러오는 중입니다</p>
      ) : !unlocked ? (
        <div class="stack-sm" data-testid="card-locked">
          <p class="small">이 단계를 마치면 만들 수 있습니다: {p.unlock_step.label}</p>
          <a class="btn" href={p.unlock_step.href}>
            {p.unlock_step.label} 열기
          </a>
        </div>
      ) : (
        <div class="stack-sm">
          <label class="field">
            {p.unlock_step.label} 출력(손실 줄) 붙여 넣기
            <textarea class="input code-input" value={paste} onInput={(e) => setPaste((e.target as HTMLTextAreaElement).value)} data-testid="loss-paste" />
          </label>
          <p class="cap">붙여 넣은 숫자만으로 손실 꺾은선을 그립니다. 앱은 노트북을 읽지 못하고, 숫자를 지어 넣지 않습니다. 계산 그래프 그림은 원하면 저장한 이미지와 함께 직접 첨부해 주세요.</p>
          <button type="button" class="btn block" onClick={make} data-testid="make-card">
            카드 만들기
          </button>
          <div aria-live="polite">
            {msg && (
              <p class="small" data-testid="card-msg">
                {msg}
              </p>
            )}
          </div>
        </div>
      )}
      {unlocked && ready ? <CardView input={current!} text={p} contentVersion={p.content_version} onDrawn={onDrawn} /> : <SharePolicy ready={false} />}
    </section>
  );
}

/** 카드 그림 + 버튼 3개 + 안내 */
function CardView({ input, text, onDrawn }: { input: CardInput; text: TasterCardText | L01CardText; contentVersion: string; onDrawn: () => Promise<void> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const spec = cardSpec(input, text);
  const key = JSON.stringify(input);

  useEffect(() => {
    let alive = true;
    (async () => {
      const theme = readCardTheme();
      await waitCardFonts(theme);
      if (!alive || !canvas.current) return;
      drawCard(canvas.current, spec, theme);
      setDrawn(key);
      await onDrawn();
    })().catch(() => alive && setMsg('카드를 그리지 못했습니다. 새로 고침해 주세요.'));
    return () => {
      alive = false;
    };
  }, [key]);

  const save = async () => {
    if (!canvas.current || drawn !== key) return;
    await savePng(canvas.current, cardFileName(input.kind));
    setMsg('이미지를 내려받았습니다. 이미지는 이 기기에만 있고 서버에 올리지 않습니다.');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText(input, text));
      setMsg('글을 복사했습니다.');
    } catch {
      setMsg('이 브라우저에서는 복사하지 못했습니다.');
    }
  };

  return (
    <div class="stack" data-testid="card-view" data-drawn={drawn === key ? 'true' : 'false'}>
      <figure class="card-figure">
        <canvas ref={canvas} width={config.shareCard.width} height={config.shareCard.height} class="share-canvas" role="img" aria-label="공유 카드 미리 보기" aria-describedby="card-text" data-testid="card-canvas" />
        <figcaption class="sr-only" id="card-text" data-testid="card-text">
          {cardStrings(spec).join(' / ')}
        </figcaption>
      </figure>
      <SharePolicy ready={drawn === key} onSave={save} onCopy={copy} xUrl={xIntentUrl(text.prefill_ko)} />
      <div aria-live="polite">
        {msg && (
          <p class="small" data-testid="share-msg">
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}

/** 넣는 것·넣지 않는 것 안내 + 이미지 저장 · 글 복사 · X에 공유 (카드가 없으면 잠금과 이유) */
function SharePolicy({ ready, onSave, onCopy, xUrl }: { ready: boolean; onSave?: () => void; onCopy?: () => void; xUrl?: string }) {
  return (
    <div class="stack-sm" data-testid="share-actions">
      <p class="small" data-testid="share-privacy">
        카드에는 모델이 만든 결과물과 학습 숫자만 들어갑니다. 이메일, 실명, 기기 정보, 학습 시간은 넣지 않습니다.
      </p>
      <div class="grid2 share-btns">
        <button type="button" class="btn" disabled={!ready} onClick={onSave} data-testid="save-image">
          이미지 저장
        </button>
        <button type="button" class="btn" disabled={!ready} onClick={onCopy} data-testid="copy-text">
          글 복사
        </button>
      </div>
      {ready && xUrl ? (
        <a class="btn primary block" href={xUrl} target="_blank" rel="noopener noreferrer" aria-describedby="x-attach" data-testid="share-x">
          X에 공유 <IconExternal />
        </a>
      ) : (
        <button type="button" class="btn primary block" disabled aria-describedby="x-attach" data-testid="share-x">
          X에 공유
        </button>
      )}
      <p class="small semibold" id="x-attach" data-testid="x-attach">
        저장한 이미지를 첨부해 주세요
      </p>
      <p class="cap">X 글쓰기 창에는 이미지가 자동으로 붙지 않습니다.</p>
      <p class="cap">X에 공유를 누르면 X의 글쓰기 창이 열리고, 올리기는 내가 직접 누릅니다. 이 앱은 자동으로 올리지 않습니다.</p>
      {!ready && <p class="cap">카드를 만든 뒤 쓸 수 있습니다.</p>}
    </div>
  );
}

/** 마운트 전에는 안의 버튼·입력칸이 눌리지 않게 감싼다(Gate.tsx) */
export default gated(ShareAppView, 'ShareApp');
