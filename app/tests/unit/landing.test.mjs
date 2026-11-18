// 랜딩 문구 파일과 쓰지 않는 말 목록 (VALUE 5절, D28, D46). 빌드 결과 검사는 scripts/check-copy.mjs, 화면 검사는 tests/e2e/landing.spec.ts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDist, visibleText } from '../../scripts/check-copy.mjs';
import { BANNED, findBanned } from '../../src/content/landing-banned.mjs';
import { LANDING, landingStrings } from '../../src/content/landing.mjs';
import { readTasterBundle, resolvePaths } from '../../src/lib/content/load.mjs';
import { strings } from '../../src/lib/content/validate.mjs';

describe('쓰지 않는 말 목록', () => {
  it('VALUE 5절의 피해야 할 말을 모두 잡는다', () => {
    const bad = [
      '30일 만에 AI 엔지니어',
      '취업 보장',
      '연봉 보장',
      '수익 보장',
      'Karpathy 공식 과정',
      'Karpathy 추천',
      '공동 제작',
      '강의 영상 제공',
      '영상 포함',
      'GPT-2를 그대로 재현',
      '나만의 ChatGPT 만들기',
      '수학 몰라도 됨',
      '공인 자격증',
      '인증서 발급',
      '100% 쉬움',
      '수강생 1,200명',
      '3,000명이 함께',
      '완주율 92%',
      '연속 5일째',
      '얼큰이님',
    ];
    for (const s of bad) expect(findBanned(s), s).not.toEqual([]);
  });
  it('같은 뜻의 변형도 잡는다 (P2 검수 권고)', () => {
    const variants = [
      'Karpathy가 추천',
      'Karpathy 님이 추천한 과정',
      'Andrej Karpathy가 직접 만든',
      'Karpathy가 만든 앱',
      '카파시 추천 강의',
      '카르파티 공식',
      '영상이 포함',
      '영상을 제공합니다',
      '영상까지 수록',
      '나만의 챗GPT',
      '나만의 챗 GPT 만들기',
      '나만의 챗지피티',
      '한 달 만에',
      '한 달 만에 AI 전문가',
      '두 달이면',
      '3개월이면 AI 엔지니어',
      '일주일 만에',
      'GPT-2를 완벽하게 재현',
      'GPT-2를 똑같이 재현',
      '수학은 몰라도',
      '수학 안 해도',
      '수료증 발급',
      '자격증을 따세요',
      '하나도 안 어려워요',
      '7일 연속',
      '순위',
    ];
    for (const s of variants) expect(findBanned(s), s).not.toEqual([]);
  });
  it('공유 카드·배지 화면의 정해진 문구는 막지 않는다', () => {
    const ok = [
      '30분 만에 학습시킨 작은 AI가 지은 이름',
      '목표 30분 만에 내 컴퓨터가 처음 보는 이름을 지어내는 것을 직접 봅니다.',
      'Andrej Karpathy의 공개 강의(makemore)를 따라 만든 결과 (비공식)',
      '이 코드는 Andrej Karpathy의 micrograd와 nn-zero-to-hero(MIT 라이선스)를 따라 만든 것입니다',
      '영상은 공식 YouTube 플레이어로만 보여 주고 다시 올리지 않습니다.',
      'GPT 제작자 (수료)',
      '배지는 앱 안의 학습 기록이며 자격증이 아닙니다. 단계 배지는 누적 점검을 통과하면 받습니다.',
      '짧은 길을 골라도 받을 수 있습니다.',
      '첫 모델이라 아직 서툴러요',
    ];
    for (const s of ok) expect(findBanned(s), s).toEqual([]);
  });
  it('부정하는 문장과 근거 있는 말은 막지 않는다', () => {
    const ok = [
      '배지는 앱 안의 학습 기록이며 자격증이 아닙니다.',
      '공식 YouTube 영상을 구간별로',
      '원본 규모 재현은 유료 GPU가 필요해 넣지 않았습니다.',
      '필요한 수학은 기초 모듈에서',
      '틀린 문제와 핵심 개념이 1·3·7·14·30일 간격으로 돌아옵니다.',
      '강의 저자와 관계나 보증이 없습니다.',
    ];
    for (const s of ok) expect(findBanned(s), s).toEqual([]);
    expect(BANNED.length).toBeGreaterThanOrEqual(9);
  });
});

describe('랜딩 문구 파일', () => {
  const all = [...landingStrings()];
  it('쓰지 않는 말 0, 긴 줄표 0', () => {
    for (const [at, s] of all) {
      expect(findBanned(s), at).toEqual([]);
      expect(s.includes('\u2014'), at).toBe(false);
    }
  });
  it('구역 7개의 글이 다 있다 (첫 화면, 얻는 것, 이런 분께, 길, 따라갈 수 있게, 끝 CTA, 바닥)', () => {
    expect(LANDING.hero.promise).toBeTruthy();
    expect(LANDING.gains.badges).toHaveLength(4);
    expect(LANDING.audience.items).toHaveLength(3);
    expect(LANDING.path.rows.filter((r) => r.checkpoint)).toHaveLength(3);
    expect(LANDING.support.cards).toHaveLength(6);
    expect(LANDING.end.title).toBeTruthy();
    expect(LANDING.footer.text).toMatch(/비공식 학습 가이드.*관계나 보증이 없습니다/);
  });
  it('"예시 화면" 표시 문구가 있다 (D46)', () => {
    expect(LANDING.sample.label).toBe('예시 화면');
    expect(LANDING.sample.note).toMatch(/공개 전 승인 대기/);
  });
  it('전체 시간은 쓰지 않는다: "이런 분께" 카드에 길별 시간 줄이 없고, 문구 파일에 "N시간"이 없다 (2026-11-18 결정)', () => {
    for (const a of LANDING.audience.items) expect(a, a.name).not.toHaveProperty('time');
    expect(LANDING.audience).not.toHaveProperty('timeLabel');
    for (const [at, s] of all) expect(/\d+\s*시간/.test(s), at).toBe(false);
  });
  it('실행 장소는 Colab 하나: 문구 파일에 "내 맥"·맥미니·Jupyter 가 없다 (2026-11-18 결정)', () => {
    for (const [at, s] of all) expect(/내 맥|맥미니|Jupyter/.test(s), at).toBe(false);
  });
  it('단계 수는 문구 파일에 적지 않는다 (빌드 때 셈)', () => {
    for (const r of LANDING.path.rows) expect(r).not.toHaveProperty('steps');
    expect(LANDING.path.lead).toMatch(/\{steps\}/);
    for (const [at, s] of all) expect(/\d+\s*단계/.test(s.replace(/4단계 힌트/, '')), at).toBe(false);
  });
  it('첫 화면 코드 줄은 맛보기 정본에 있는 줄이다', () => {
    const tb = readTasterBundle(resolvePaths());
    const st = tb.file.data.steps.find((s) => s.step_id === LANDING.hero.code.step_id);
    const n = st.code.split('\n').length;
    for (const i of LANDING.hero.code.lines) expect(i >= 1 && i <= n).toBe(true);
  });
  it('맛보기 정본 글에도 쓰지 않는 말이 없다', () => {
    const tb = readTasterBundle(resolvePaths());
    for (const [at, s] of strings(tb.file.data)) expect(findBanned(s), at).toEqual([]);
  });
});

describe('빌드 결과 문구 검사 (scripts/check-copy.mjs)', () => {
  const make = (files) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'z2h-copy-'));
    for (const [rel, html] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), html);
    }
    return dir;
  };
  const ok = `<p>${LANDING.sample.label} ${LANDING.sample.note}</p>`;
  it('화면 글만 본다 (script·태그 속성 제외)', () => {
    expect(visibleText('<script>"보장"</script><a title="보장">맛보기 &amp; 시작</a>').trim()).toBe('맛보기 & 시작');
  });
  it('쓰지 않는 말·긴 줄표·예시 화면 표시 빠짐을 잡는다', () => {
    const d1 = make({ 'index.html': `${ok}<p>취업 보장</p>`, 'taste/S01/index.html': `<p>a ${String.fromCharCode(0x2014)} b</p>` });
    const r1 = checkDist(d1);
    expect(r1.problems.some((p) => /쓰지 않는 말/.test(p))).toBe(true);
    expect(r1.problems.some((p) => /긴 줄표/.test(p))).toBe(true);
    const d2 = make({ 'index.html': '<p>소개</p>' });
    expect(checkDist(d2).problems.some((p) => /예시 화면/.test(p))).toBe(true);
    const d3 = make({ 'index.html': ok, 'taste/index.html': '<p>맛보기</p>' });
    expect(checkDist(d3)).toEqual({ files: 2, problems: [] });
    for (const d of [d1, d2, d3]) fs.rmSync(d, { recursive: true, force: true });
  });
});
