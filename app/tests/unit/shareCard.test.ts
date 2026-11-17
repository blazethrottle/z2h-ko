// 공유 카드 계산(src/lib/share-card.ts): 카드 입력 열쇠 화이트리스트, 손실 줄 파싱, X 주소(자동 게시 매개변수 없음),
// share_id 길이·문자, 카드 글은 모델 출력과 고정 문구뿐, 크기 1200x675(D56).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import {
  CARD_COPY,
  CARD_INPUT_KEYS,
  cardFileName,
  cardReady,
  cardSpec,
  cardStrings,
  copyText,
  displayName,
  newShareId,
  parseLossLog,
  payloadOf,
  samePayload,
  sanitizeCardInput,
  shareCardRow,
  xIntentUrl,
  type CardInput,
  type L01CardText,
  type TasterCardInput,
  type TasterCardText,
} from '../../src/lib/share-card';

function asTaster(c: CardInput | null): TasterCardInput {
  if (c?.kind !== 'ART-TASTER') throw new Error(`맛보기 카드 입력이 아닙니다: ${JSON.stringify(c)}`);
  return c;
}

const TASTER = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/taster.json'), 'utf8'));
const L01 = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/L01.json'), 'utf8'));
const OUT = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/taster_outputs.json'), 'utf8'));
const TOKENS = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/design/tokens.json'), 'utf8'));
const CF = TASTER.lecture.artifact.card_fields;
const TT: TasterCardText = { ...CF, prefill_ko: TASTER.lecture.artifact.x_compose.prefill_ko };
const L1A = L01.lecture.rewards.artifact;
const LT: L01CardText = {
  title_ko: L1A.name_ko,
  credit_ko: 'Andrej Karpathy의 공개 강의 micrograd를 따라 만든 결과',
  lecture_label: '01 micrograd',
  mark: '01',
  prefill_ko: L1A.x_compose.prefill_ko,
};
const NAMES: string[] = OUT['T-S07'].trim().split('\n');
const PERSONAL = { email: 'me@mail.com', display_name: '홍길동', user_id: 'u-1', device: 'iPhone', active_seconds: 1234, rank: 1, created_at: '2026-11-17T00:00:00+09:00' };

describe('카드 크기와 토큰', () => {
  it('설정 1200x675 = tokens.json share-card = 정본 taster.json format.image (D56, 2026-11-17 정본 확정)', () => {
    expect([config.shareCard.width, config.shareCard.height]).toEqual([1200, 675]);
    expect([TOKENS['share-card'].width, TOKENS['share-card'].height]).toEqual([config.shareCard.width, config.shareCard.height]);
    const m = String(TASTER.lecture.artifact.format.image).match(/(\d+)\s*×\s*(\d+)/);
    expect(m && [Number(m[1]), Number(m[2])]).toEqual([config.shareCard.width, config.shareCard.height]);
  });
});

describe('카드 입력 열쇠 화이트리스트 (계정 이름·이메일이 들어갈 길 없음)', () => {
  it('열쇠 목록', () => {
    expect(CARD_INPUT_KEYS).toEqual({ 'ART-TASTER': ['kind', 'names', 'loss_start', 'loss_end', 'taste_complete'], 'ART-L01': ['kind', 'losses'] });
  });
  it('개인 정보 열쇠를 섞어 넣어도 화이트리스트 열쇠만 남는다', () => {
    const t = sanitizeCardInput({ kind: 'ART-TASTER', names: NAMES, loss_start: 3.839, loss_end: 2.472, taste_complete: true, ...PERSONAL })!;
    expect(Object.keys(t)).toEqual([...CARD_INPUT_KEYS['ART-TASTER']]);
    const long = sanitizeCardInput({ kind: 'ART-TASTER', names: ['abc', 'a'.repeat(21), 'a'.repeat(20)] })!;
    expect((long as any).names).toEqual(['abc', 'a'.repeat(20)]);
    const l = sanitizeCardInput({ kind: 'ART-L01', losses: [4.8, 0.05], ...PERSONAL })!;
    expect(Object.keys(l)).toEqual([...CARD_INPUT_KEYS['ART-L01']]);
    const all = JSON.stringify([t, l, cardSpec(t, TT), cardSpec(l, LT)]);
    for (const v of ['me@mail.com', '홍길동', 'u-1', 'iPhone', '1234']) expect(all).not.toContain(v);
  });
  it('이름은 a~z 만, 최대 10개. 숫자는 0 이상 유한한 값만. 모르는 종류는 null', () => {
    const t = sanitizeCardInput({ kind: 'ART-TASTER', names: ['gsli', '홍길동', 'Kenah', 'me@x.com', 42, ...NAMES], loss_start: -1, loss_end: 'x' }) as any;
    expect(t.names).toEqual(['gsli', ...NAMES].slice(0, config.taste.maxNames));
    expect([t.loss_start, t.loss_end, t.taste_complete]).toEqual([null, null, false]);
    expect(sanitizeCardInput({ kind: 'ART-L01', losses: [1, -2, Infinity, NaN, '3', 0] })).toEqual({ kind: 'ART-L01', losses: [1, 0] });
    expect(sanitizeCardInput({ kind: 'EMAIL', names: ['a'] })).toBeNull();
    expect(sanitizeCardInput(null)).toBeNull();
  });
  it('카드에 그리는 글은 모델 출력(a~z 이름, 숫자)과 고정 문구뿐', () => {
    const t = sanitizeCardInput({ kind: 'ART-TASTER', names: NAMES, loss_start: 3.839, loss_end: 2.472, taste_complete: true })!;
    const fixed = new Set([CF.title_ko, CF.humble_line_ko, CARD_COPY.namesCaption, config.shareCard.appName]);
    for (const s of cardStrings(cardSpec(t, TT))) {
      const ok =
        fixed.has(s) ||
        /^[a-z]+…?$/.test(s) ||
        s === `${CARD_COPY.tasteDone} · ${CARD_COPY.loss} 3.839 ${CARD_COPY.arrow} 2.472` ||
        s === `${CF.credit_ko}${CARD_COPY.unofficial} · ${CF.disclaimer_ko.replace(/\.$/, '')}`;
      expect(ok, s).toBe(true);
    }
    const l = sanitizeCardInput({ kind: 'ART-L01', losses: [4.8361, 1.2, 0.0412] })!;
    const fixedL = new Set([LT.title_ko, LT.mark, config.shareCard.appName, `${LT.credit_ko}${CARD_COPY.unofficial}`, CARD_COPY.chartCaption(3)]);
    for (const s of cardStrings(cardSpec(l, LT))) {
      const ok = fixedL.has(s) || /^\d+(\.\d+)?$/.test(s) || s === `${LT.lecture_label} · ${CARD_COPY.loss} 4.8361 ${CARD_COPY.arrow} 0.0412`;
      expect(ok, s).toBe(true);
    }
  });
});

describe('이름 카드 (ART-TASTER) 내용', () => {
  it('제목·출처·"첫 모델이라 아직 서툴러요"·실제 이름 안내는 정본 문구, 부제는 맛보기 완료 + 붙여 넣은 손실', () => {
    const s = cardSpec(sanitizeCardInput({ kind: 'ART-TASTER', names: NAMES, loss_start: 3.84, loss_end: 2.47, taste_complete: true })!, TT);
    expect(s.title).toBe('30분 만에 학습시킨 작은 AI가 지은 이름');
    expect(s.sub).toBe('맛보기 완료 · 손실 3.84 → 2.47');
    expect(s.mark).toEqual({ type: 'check' });
    expect(s.box).toMatchObject({ type: 'names', names: NAMES, foot: '첫 모델이라 아직 서툴러요' });
    expect(s.footText).toBe('Andrej Karpathy의 공개 강의(makemore)를 따라 만든 결과 (비공식) · 컴퓨터가 지어낸 이름이라 실제 사람 이름과 우연히 같을 수 있습니다');
    expect(s.footTitle).toBe(config.shareCard.appName);
  });
  it('손실을 안 넣었거나 맛보기 완료 전이면 그 부분을 빼고, 지어 넣지 않는다', () => {
    const a = cardSpec(sanitizeCardInput({ kind: 'ART-TASTER', names: ['gsli'], loss_start: null, loss_end: null, taste_complete: true })!, TT);
    expect(a.sub).toBe('맛보기 완료');
    const b = cardSpec(sanitizeCardInput({ kind: 'ART-TASTER', names: ['gsli'], loss_start: 3.84, loss_end: null, taste_complete: false })!, TT);
    expect(b.sub).toBeNull();
    expect(b.mark).toBeNull();
  });
  it('20글자를 넘는 이름은 앞 20글자 + …', () => {
    expect(displayName('abcdefghijklmnopqrstuvwxy')).toBe('abcdefghijklmnopqrst…');
    expect(displayName('abcdefghijklmnopqrst')).toBe('abcdefghijklmnopqrst');
  });
  it('이름 0개면 카드를 만들 수 없다', () => {
    expect(cardReady(sanitizeCardInput({ kind: 'ART-TASTER', names: [] }))).toBe(false);
    expect(cardReady(sanitizeCardInput({ kind: 'ART-TASTER', names: ['di'] }))).toBe(true);
    expect(cardReady(sanitizeCardInput({ kind: 'ART-L01', losses: [1] }))).toBe(false);
  });
});

describe('학습 기록 카드 (ART-L01): S15b 손실 줄 파싱', () => {
  const s15b = Array.from({ length: 20 }, (_, k) => `${k} ${(4.8 / (k + 1)).toFixed(6)}`).join('\n');
  it('"번호 손실" 20줄 → 손실 20개, 붙여 넣은 순서 그대로', () => {
    const r = parseLossLog(s15b);
    expect(r.losses).toHaveLength(20);
    expect(r.losses[0]).toBe(4.8);
    expect(r.losses[19]).toBe(Number((4.8 / 20).toFixed(6)));
    expect(r.skipped).toBe(0);
  });
  it('다른 줄은 빼고 센다, 지수 표기도 읽는다, 음수·글자는 손실로 받지 않는다', () => {
    const r = parseLossLog(`Value(data=1.0)\n0 4.5\n\n1 3.2e-1\n2 -0.5\nloss 0.1\n3 0.05`);
    expect(r.losses).toEqual([4.5, 0.32, 0.05]);
    expect(r.skipped).toBe(3);
  });
  it('숫자를 못 읽으면 0개 (카드 불가 안내)', () => {
    expect(parseLossLog('홍길동\nhello').losses).toEqual([]);
    expect(parseLossLog('').losses).toEqual([]);
  });
  it('최대 줄 수를 넘으면 앞부분만', () => {
    const many = Array.from({ length: config.shareCard.maxLossPoints + 5 }, (_, k) => `${k} 1.0`).join('\n');
    const r = parseLossLog(many);
    expect(r.losses).toHaveLength(config.shareCard.maxLossPoints);
    expect(r.dropped).toBe(5);
  });
  it('카드: 제목 = 정본 artifact 이름, 출처 + (비공식), 부제는 처음 → 마지막 손실', () => {
    const s = cardSpec(sanitizeCardInput({ kind: 'ART-L01', losses: parseLossLog(s15b).losses })!, LT);
    expect(s.title).toBe('내 micrograd 학습 기록 카드');
    expect(s.sub).toBe(`01 micrograd · 손실 4.8 → ${Number((4.8 / 20).toFixed(6))}`);
    expect(s.footText).toBe('Andrej Karpathy의 공개 강의 micrograd를 따라 만든 결과 (비공식)');
    expect(s.box.type).toBe('chart');
  });
});

describe('X에 공유 주소: 글쓰기 창만 연다', () => {
  it('x.com/intent/post 에 text 하나만 (자동 게시·이미지·url·via 매개변수 없음)', () => {
    for (const prefill of [TT.prefill_ko, LT.prefill_ko]) {
      const u = new URL(xIntentUrl(prefill));
      expect(u.protocol).toBe('https:');
      expect(u.host).toBe('x.com');
      expect(u.pathname).toBe('/intent/post');
      expect([...u.searchParams.keys()]).toEqual(['text']);
      expect(u.searchParams.get('text')).toBe(prefill);
    }
    expect(TASTER.lecture.artifact.x_compose.auto_post).toBe(false);
    expect(L1A.x_compose.auto_post).toBe(false);
  });
  it('미리 채우는 글은 정본 그대로이고 개인 정보가 없다', () => {
    expect(TT.prefill_ko).toBe('30분 만에 처음 학습시킨 작은 AI가 이름을 지었어요. 첫 모델이라 아직 서툴러요. (Andrej Karpathy의 공개 강의 makemore를 따라 만든 결과)');
    expect(xIntentUrl(TT.prefill_ko)).not.toMatch(/%40|email|user/i);
  });
});

describe('글 복사 (사실 문장)', () => {
  it('이름 카드: 맛보기 완료 + 이름 + 붙여 넣은 손실 + 출처, 개인 정보 없음', () => {
    const t = sanitizeCardInput({ kind: 'ART-TASTER', names: ['gsli', 'di'], loss_start: 3.84, loss_end: 2.47, taste_complete: true, ...PERSONAL })!;
    expect(copyText(t, TT)).toBe('Z2H에서 맛보기를 마쳤습니다. 내 컴퓨터가 지어낸 이름 2개: gsli, di. 손실 3.84 → 2.47. (Andrej Karpathy의 공개 강의(makemore)를 따라 만든 결과, 비공식)');
    const notDone = sanitizeCardInput({ kind: 'ART-TASTER', names: ['gsli'], loss_start: null, loss_end: null, taste_complete: false })!;
    expect(copyText(notDone, TT)).not.toContain('마쳤습니다');
  });
  it('학습 기록 카드: 처음 → 마지막 손실 + 출처', () => {
    const l = sanitizeCardInput({ kind: 'ART-L01', losses: [4.8, 0.5, 0.03] })!;
    expect(copyText(l, LT)).toBe('Z2H 01 micrograd에서 작은 신경망을 학습시켰습니다. 손실 4.8 → 0.03. (Andrej Karpathy의 공개 강의 micrograd를 따라 만든 결과, 비공식)');
  });
});

describe('share_card 기록', () => {
  it('share_id: crypto.getRandomValues 16바이트 → 소문자 16진수 32자 (API: 영문·숫자로 시작, 16~64자)', () => {
    let called = 0;
    const id = newShareId((b) => {
      called++;
      b.set(Array.from({ length: b.length }, (_, i) => (i * 37 + 11) % 256));
      return b;
    });
    expect(called).toBe(1);
    expect(id).toHaveLength(32);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{15,63}$/);
    const a = newShareId();
    const b = newShareId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
  it('행: visibility private, image_path 비움, payload = 화이트리스트 입력 그대로', () => {
    const input = asTaster(sanitizeCardInput({ kind: 'ART-TASTER', names: ['gsli'], loss_start: 3.84, loss_end: 2.47, taste_complete: true, ...PERSONAL }));
    const row = shareCardRow(input, 'a'.repeat(32), '2026-11-17T10:00:00+09:00', 'v1');
    expect(row).toEqual({
      share_id: 'a'.repeat(32),
      kind: 'ART-TASTER',
      payload: input,
      image_path: null,
      visibility: 'private',
      created_at: '2026-11-17T10:00:00+09:00',
      revoked_at: null,
      content_version: 'v1',
    });
    expect(samePayload(row, input)).toBe(true);
    expect(samePayload({ payload: JSON.stringify(input) }, input)).toBe(true);
    expect(samePayload({ payload_json: JSON.stringify(input) }, input)).toBe(true);
    expect(samePayload(row, { ...input, names: ['di'] })).toBe(false);
    expect(payloadOf({ payload: { ...input, email: 'x@y.z' } })).toEqual(input);
  });
  it('내려받을 파일 이름에 개인 정보가 없다', () => {
    expect(cardFileName('ART-TASTER')).toBe('z2h-art-taster.png');
    expect(cardFileName('ART-L01')).toBe('z2h-art-l01.png');
  });
});
