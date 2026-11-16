// 공유 카드 계산 (spec 13.5, D32·D42·D45·D54·D56, VALUE 2절 공유 원칙, taster.md 4절, 정본 L01 rewards.artifact).
// 화면이 없는 순수 함수만 둔다. 그리기는 src/lib/card-draw.ts(브라우저 canvas).
//
// 카드에 들어가는 글자는 두 가지뿐이다: 모델 출력(a~z 이름, 손실 숫자)과 고정 문구(정본·앱 문구).
// 그래서 카드 입력 객체는 열쇠 화이트리스트(CARD_INPUT_KEYS)로만 만든다. 이메일·실명·계정 이름·기기 정보·학습 시간·순위는
// 들어갈 칸이 없다. share_card.payload 에도 이 입력 객체만 저장한다.
// 공유: "X에 공유"는 X 글쓰기 창(intent)에 미리 채운 글만 넘긴다. 자동 게시·이미지 첨부·공개 주소 없음(D45, X4).
import { config } from '../config';

export type CardKind = 'ART-TASTER' | 'ART-L01';

/** 카드 입력 객체에 들어갈 수 있는 열쇠 (이 밖의 열쇠는 버린다) */
export const CARD_INPUT_KEYS = {
  'ART-TASTER': ['kind', 'names', 'loss_start', 'loss_end', 'taste_complete'],
  'ART-L01': ['kind', 'losses'],
} as const;

export interface TasterCardInput {
  kind: 'ART-TASTER';
  /** T-S07 출력에서 붙여 넣은 이름(a~z 만, 최대 maxNames 개) */
  names: string[];
  /** T-S06 첫·마지막 손실(선택, 붙여 넣은 값) */
  loss_start: number | null;
  loss_end: number | null;
  /** 맛보기 완료 표시를 받았는지 ("맛보기 완료" 부제·✓ 원) */
  taste_complete: boolean;
}

export interface L01CardInput {
  kind: 'ART-L01';
  /** S15b 출력에서 뽑은 손실 숫자(붙여 넣은 순서 그대로) */
  losses: number[];
}

export type CardInput = TasterCardInput | L01CardInput;

const ONLY_AZ = /^[a-z]+$/;
const lossNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/** 화이트리스트 열쇠만 남기고 값 모양을 확인한다. 모르는 종류면 null */
export function sanitizeCardInput(raw: unknown): CardInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === 'ART-TASTER') {
    const names = Array.isArray(r.names) ? r.names.filter((n): n is string => typeof n === 'string' && ONLY_AZ.test(n) && n.length <= config.taste.maxNameChars).slice(0, config.taste.maxNames) : [];
    return { kind: 'ART-TASTER', names, loss_start: lossNum(r.loss_start), loss_end: lossNum(r.loss_end), taste_complete: r.taste_complete === true };
  }
  if (r.kind === 'ART-L01') {
    const losses = Array.isArray(r.losses) ? r.losses.map(lossNum).filter((x): x is number => x != null).slice(0, config.shareCard.maxLossPoints) : [];
    return { kind: 'ART-L01', losses };
  }
  return null;
}

/** 카드가 그릴 수 있는지 (이름 1개 이상 / 손실 2개 이상) */
export function cardReady(c: CardInput | null): boolean {
  if (!c) return false;
  return c.kind === 'ART-TASTER' ? c.names.length > 0 : c.losses.length >= 2;
}

/** 한 이름 최대 글자 수를 넘으면 앞 글자 + … (spec 13.5) */
export function displayName(n: string, max = config.taste.maxNameChars): string {
  const chars = [...n];
  return chars.length <= max ? n : `${chars.slice(0, max).join('')}…`;
}

/** 숫자는 붙여 넣은 값 그대로 보인다(반올림으로 값을 바꾸지 않는다) */
export const numText = (n: number) => String(n);

/** S15b 출력 "0 4.8361…" 줄들 → 손실 숫자. "번호 손실" 모양이 아닌 줄은 세기만 하고 뺀다 */
export function parseLossLog(text: string | null | undefined, max = config.shareCard.maxLossPoints): { losses: number[]; skipped: number; dropped: number } {
  const re = /^\s*(\d+)\s+([+]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*$/;
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const all: number[] = [];
  let skipped = 0;
  for (const l of lines) {
    const m = l.match(re);
    const v = m ? Number(m[2]) : NaN;
    if (m && Number.isFinite(v)) all.push(v);
    else skipped++;
  }
  return { losses: all.slice(0, max), skipped, dropped: Math.max(0, all.length - max) };
}

/** 카드 고정 문구 (정본 문구를 페이지가 넘긴다) */
export interface TasterCardText {
  title_ko: string;
  credit_ko: string;
  humble_line_ko: string;
  disclaimer_ko: string;
  prefill_ko: string;
}
export interface L01CardText {
  title_ko: string;
  credit_ko: string;
  /** "01 micrograd" */
  lecture_label: string;
  /** 원 안 글자 "01" */
  mark: string;
  prefill_ko: string;
}

/** 앱 문구 (카드에 들어가는 앱 고정 글) */
export const CARD_COPY = {
  unofficial: ' (비공식)',
  tasteDone: '맛보기 완료',
  loss: '손실',
  arrow: '→',
  namesCaption: '내 모델 출력',
  chartCaption: (n: number) => `학습 반복 손실 ${n}줄 (붙여 넣은 값)`,
};

export interface CardSpec {
  kind: CardKind;
  /** 원: ✓(맛보기 완료) 또는 글자(편 번호). null 이면 원 없음 */
  mark: { type: 'check' } | { type: 'text'; text: string } | null;
  title: string;
  sub: string | null;
  box:
    | { type: 'names'; caption: string; names: string[]; foot: string }
    | { type: 'chart'; caption: string; losses: number[]; top: string; bottom: string };
  footTitle: string;
  footText: string;
}

const trimDot = (s: string) => s.replace(/[.。]\s*$/, '');

/** 입력 + 고정 문구 → 카드에 그릴 것 */
export function cardSpec(input: CardInput, text: TasterCardText | L01CardText): CardSpec {
  const app = config.shareCard.appName;
  if (input.kind === 'ART-TASTER') {
    const t = text as TasterCardText;
    const parts: string[] = [];
    if (input.taste_complete) parts.push(CARD_COPY.tasteDone);
    if (input.loss_start != null && input.loss_end != null) parts.push(`${CARD_COPY.loss} ${numText(input.loss_start)} ${CARD_COPY.arrow} ${numText(input.loss_end)}`);
    return {
      kind: input.kind,
      mark: input.taste_complete ? { type: 'check' } : null,
      title: t.title_ko,
      sub: parts.length ? parts.join(' · ') : null,
      box: { type: 'names', caption: CARD_COPY.namesCaption, names: input.names.map((n) => displayName(n)), foot: t.humble_line_ko },
      footTitle: app,
      footText: `${t.credit_ko}${CARD_COPY.unofficial} · ${trimDot(t.disclaimer_ko)}`,
    };
  }
  const t = text as L01CardText;
  const first = input.losses[0];
  const last = input.losses[input.losses.length - 1];
  return {
    kind: input.kind,
    mark: { type: 'text', text: t.mark },
    title: t.title_ko,
    sub: input.losses.length ? `${t.lecture_label} · ${CARD_COPY.loss} ${numText(first)} ${CARD_COPY.arrow} ${numText(last)}` : t.lecture_label,
    box: {
      type: 'chart',
      caption: CARD_COPY.chartCaption(input.losses.length),
      losses: input.losses,
      top: input.losses.length ? numText(Math.max(...input.losses)) : '',
      bottom: input.losses.length ? numText(Math.min(...input.losses)) : '',
    },
    footTitle: app,
    footText: `${t.credit_ko}${CARD_COPY.unofficial}`,
  };
}

/** 카드에 그리는 글 전부 (읽기 프로그램용 설명과 검사에 쓴다) */
export function cardStrings(s: CardSpec): string[] {
  const out = [s.title];
  if (s.mark?.type === 'text') out.push(s.mark.text);
  if (s.sub) out.push(s.sub);
  out.push(s.box.caption);
  if (s.box.type === 'names') out.push(...s.box.names, s.box.foot);
  else out.push(s.box.top, s.box.bottom);
  out.push(s.footTitle, s.footText);
  return out.filter((x) => x !== '');
}

/** "글 복사"의 사실 문장 (모델 결과물과 출처만, 개인 정보 없음) */
export function copyText(input: CardInput, text: TasterCardText | L01CardText): string {
  if (input.kind === 'ART-TASTER') {
    const t = text as TasterCardText;
    const loss = input.loss_start != null && input.loss_end != null ? ` ${CARD_COPY.loss} ${numText(input.loss_start)} ${CARD_COPY.arrow} ${numText(input.loss_end)}.` : '';
    const done = input.taste_complete ? `${config.shareCard.appShort}에서 맛보기를 마쳤습니다. ` : '';
    return `${done}내 컴퓨터가 지어낸 이름 ${input.names.length}개: ${input.names.join(', ')}.${loss} (${t.credit_ko}, 비공식)`;
  }
  const t = text as L01CardText;
  const first = input.losses[0];
  const last = input.losses[input.losses.length - 1];
  return `${config.shareCard.appShort} ${t.lecture_label}에서 작은 신경망을 학습시켰습니다. ${CARD_COPY.loss} ${numText(first)} ${CARD_COPY.arrow} ${numText(last)}. (${t.credit_ko}, 비공식)`;
}

/** X 글쓰기 창 주소: 미리 채운 글(text)만. 자동 게시·이미지·추적 매개변수 없음 */
export const X_INTENT_BASE = 'https://x.com/intent/post';
export function xIntentUrl(prefill: string): string {
  return `${X_INTENT_BASE}?text=${encodeURIComponent(prefill)}`;
}

/** 내려받을 PNG 파일 이름 (개인 정보 없음) */
export const cardFileName = (kind: CardKind) => `z2h-${kind.toLowerCase()}.png`;

/** share_id: 추측 불가 임의 값 (crypto.getRandomValues 16바이트 → 소문자 16진수 32자, server/API.md 3절 16~64자) */
export function newShareId(rand: (b: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const b = rand(new Uint8Array(16));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** share_card 행 (visibility 는 private 만, image_path 는 비움: 이미지는 기기에만) */
export function shareCardRow(input: CardInput, shareId: string, createdAt: string, contentVersion: string | null) {
  return {
    share_id: shareId,
    kind: input.kind,
    payload: input,
    image_path: null,
    visibility: 'private' as const,
    created_at: createdAt,
    revoked_at: null,
    content_version: contentVersion,
  };
}

/** 같은 입력으로 이미 만든 카드인지 (다시 열 때 새 행을 만들지 않는다) */
export function samePayload(row: Record<string, any> | null | undefined, input: CardInput): boolean {
  const a = payloadOf(row);
  return !!a && JSON.stringify(a) === JSON.stringify(input);
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** 행의 payload 를 카드 입력으로 (서버가 돌려준 모양도 받는다) */
export function payloadOf(row: Record<string, any> | null | undefined): CardInput | null {
  if (!row) return null;
  const p = typeof row.payload === 'string' ? safeJson(row.payload) : row.payload ?? (typeof row.payload_json === 'string' ? safeJson(row.payload_json) : row.payload_json);
  return sanitizeCardInput(p);
}
