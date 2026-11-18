// 학습자 화면에 내지 않는 말(설계서·작업 메모) 검사와, 2~10편 준비 중 안내의 화면 글(content/lectures.yaml)이 설계서 메모를 빼기만 했는지.
// 화면 칸에서 뺀 원문은 같은 자리의 design_source 에 그대로 남고(설계서 docs/CURRICULUM.md 의 글과 같다), 화면 글은 그 원문에서 글자를 빼기만 한 것이다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { checkDist } from '../../scripts/check-copy.mjs';
import { LEARNER_BANNED, findLearnerBanned } from '../../src/content/learner-banned.mjs';
import { LANDING } from '../../src/content/landing.mjs';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';

const LIST = YAML.parse(fs.readFileSync(path.join(REPO_ROOT, 'content/lectures.yaml'), 'utf8'));
const CURRICULUM = fs.readFileSync(path.join(REPO_ROOT, 'docs/CURRICULUM.md'), 'utf8');

/** 화면에 나가는 칸: [어디, 글] (design_source 는 화면에 내지 않는 원문 보관 칸) */
function* screenFields() {
  for (const l of LIST.lectures) {
    yield [`${l.lecture_id}.title_ko`, l.title_ko];
    if (l.env_ko) yield [`${l.lecture_id}.env_ko`, l.env_ko];
    if (l.prereq_lectures_note_ko) yield [`${l.lecture_id}.prereq_lectures_note_ko`, l.prereq_lectures_note_ko];
    for (const o of l.objectives ?? []) yield [o.objective_id, o.text_ko];
    if (l.bridge) for (const k of ['jump_ko', 'new_ko', 'bridge_ko']) yield [`${l.lecture_id}.bridge.${k}`, l.bridge[k]];
  }
  for (const c of LIST.bridge_cards) yield [`${c.card_id}.summary_ko`, c.summary_ko];
  for (const c of LIST.checkpoints) yield [`${c.checkpoint_id}.items_ko`, c.items_ko];
}

/** design_source 가 있는 곳: [어디, 화면 글, 원문] */
function* preserved() {
  for (const l of LIST.lectures) {
    for (const [k, src] of Object.entries(l.design_source ?? {})) yield [`${l.lecture_id}.${k}`, l[k], src];
    for (const [k, src] of Object.entries(l.bridge?.design_source ?? {})) yield [`${l.lecture_id}.bridge.${k}`, l.bridge[k], src];
  }
  for (const c of LIST.bridge_cards) for (const [k, src] of Object.entries(c.design_source ?? {})) yield [`${c.card_id}.${k}`, c[k], src];
}

/** b 가 a 에서 글자를 빼기만 해서 만들 수 있는가(새 글자를 넣지 않음) */
function deletionOnly(source, shown) {
  let i = 0;
  for (const ch of source) if (ch === shown[i]) i++;
  return i === shown.length;
}

describe('학습자 화면 금지어 목록', () => {
  it('설계서 메모·내부 호칭을 잡는다', () => {
    const bad = ['얼큰이님 별도 승인 대상', '승인 대상입니다', '설치는 승인 뒤', '수 분 걸릴 수 있음, 미측정', '탑재 여부 미확인', '(research, 미측정)', '(Research: 27x27)', '설계서 2-1', '교사가 실행', 'PM 지시'];
    for (const s of bad) expect(findLearnerBanned(s), s).not.toEqual([]);
    expect(LEARNER_BANNED.length).toBeGreaterThanOrEqual(10);
  });
  it('주소의 research, 다른 낱말 속 PM, 설계(서가 아닌 말)는 잡지 않는다', () => {
    const ok = [
      "단추가 없으면 colab.research.google.com 에서 '새 노트북'을 만듭니다.",
      'https://colab.research.google.com/github/x/y',
      'npm run build',
      'NPM 패키지',
      '아래는 이 편의 설계입니다.',
      '승인',
    ];
    for (const s of ok) expect(findLearnerBanned(s), s).toEqual([]);
  });
  it('랜딩 금지어 목록(landing-banned.mjs)과 다른 파일이다', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'app/src/content/landing-banned.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(REPO_ROOT, 'app/src/content/learner-banned.mjs'))).toBe(true);
  });
});

/** 실행 장소 병기(2026-11-18 결정: Colab 고정) */
const RUN_PLACE = /맥미니|Jupyter|두 길|MPS|mps|내 맥/;

describe('준비 중 편 안내의 화면 글 (content/lectures.yaml)', () => {
  it('화면 칸에 학습자 화면 금지어가 없다', () => {
    const bad = [...screenFields()].flatMap(([at, s]) => findLearnerBanned(s).map((b) => `${at}: ${b.match}`));
    expect(bad).toEqual([]);
  });
  it('화면 칸에 실행 장소 병기(맥미니·Jupyter·두 길·mps)가 없다', () => {
    const bad = [...screenFields()].filter(([, s]) => RUN_PLACE.test(s)).map(([at, s]) => `${at}: ${s.match(RUN_PLACE)?.[0]}`);
    expect(bad).toEqual([]);
  });
  it('뺀 원문은 design_source 에 남아 있고, 설계서(docs/CURRICULUM.md)의 글 그대로다(굵게 표시 ** 는 옮길 때 뺀 곳이 있어 비교에서 뺀다)', () => {
    const all = [...preserved()];
    expect(all.length).toBe(13);
    const plain = (s) => s.replace(/\*\*/g, '');
    for (const [at, , src] of all) expect(plain(CURRICULUM).includes(plain(src)), at).toBe(true);
  });
  it('화면 글은 원문에서 글자를 빼기만 했다(새 문장을 짓지 않음), 원문에는 뺀 메모나 실행 장소 병기가 있다', () => {
    for (const [at, shown, src] of preserved()) {
      expect(shown, at).not.toBe(src);
      expect(deletionOnly(src, shown), at).toBe(true);
      expect(findLearnerBanned(src).length > 0 || RUN_PLACE.test(src), at).toBe(true);
    }
  });
});

describe('빌드 결과 학습자 화면 검사 (scripts/check-copy.mjs)', () => {
  const make = (files) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'z2h-learner-'));
    for (const [rel, html] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), html);
    }
    return dir;
  };
  const okLanding = `<p>${LANDING.sample.label} ${LANDING.sample.note}</p>`;
  it('랜딩과 강의 화면의 설계서 메모를 잡는다', () => {
    const d = make({ 'index.html': `${okLanding}<p>얼큰이님 별도 승인 대상</p>`, 'lectures/L02/index.html': '<p>두 길 모두(research, 미측정)</p>' });
    const r = checkDist(d);
    expect(r.problems.filter((p) => /학습자 화면에 내지 않는 말/.test(p) && p.includes('lectures/L02')).length).toBeGreaterThan(0);
    expect(r.problems.filter((p) => /학습자 화면에 내지 않는 말/.test(p) && p.includes('index.html') && !p.includes('lectures')).length).toBeGreaterThan(0);
    fs.rmSync(d, { recursive: true, force: true });
  });
  it('주소 속 research 는 통과', () => {
    const d = make({ 'index.html': okLanding, 'lectures/L01/S01/index.html': '<a href="https://colab.research.google.com/">colab.research.google.com</a>' });
    expect(checkDist(d).problems).toEqual([]);
    fs.rmSync(d, { recursive: true, force: true });
  });
});
