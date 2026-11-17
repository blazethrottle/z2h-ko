// 칸 분류(src/lib/content/fields.mjs)와 새는 곳 검사 (P7, 정본 F.json·L01.json 클로드 버전).
// 1) 정본에 있는 칸은 하나도 빠짐없이 분류되어 있어야 한다(칸을 버리지 않는다: 새 칸이 생기면 이 테스트가 먼저 깨진다).
// 2) 검사용 칸(check)은 어떤 화면 데이터에도 없다. 늦게 받는 칸(late: 풀이·정답·빈칸 답)은 페이지 데이터에 없고 answers·hints JSON 에만 있다.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIELD_CLASS, classOf, fieldPaths } from '../../src/lib/content/fields.mjs';
import { APP_DIR, readBasicsBundle, readBundle, resolveBasicsPath, resolvePaths } from '../../src/lib/content/load.mjs';
import { buildBasics } from '../../src/lib/content/basics.mjs';
import { buildSite } from '../../src/lib/content/build.mjs';

const F_FILE = path.join(APP_DIR, 'tests/fixtures/basics/F.json');
const basics = readBasicsBundle(resolveBasicsPath({ Z2H_BASICS_FILE: F_FILE }));
const lecture = readBundle(
  resolvePaths({ Z2H_CONTENT_DIR: path.join(APP_DIR, 'tests/fixtures/pedagogy/content'), Z2H_EXTRAS_DIR: path.join(APP_DIR, 'tests/fixtures/extras') }),
);
const F = basics.file.data;
const L01 = lecture.lectureFiles[0].data;

describe('칸 분류: 정본의 모든 칸이 분류표에 있다', () => {
  for (const [name, data] of [
    ['F.json', F],
    ['L01.json', L01],
  ]) {
    it(name, () => {
      const missing = fieldPaths(data).filter((p) => classOf(p) == null);
      expect(missing).toEqual([]);
    });
  }
  it('분류 값은 screen · data · late · check 넷 중 하나', () => {
    for (const [owner, fields] of Object.entries(FIELD_CLASS)) for (const [k, v] of Object.entries(fields)) expect(['screen', 'data', 'late', 'check'], `${owner}.${k}`).toContain(v);
  });
});

/** 화면 데이터 안의 모든 [경로, 글자] (키 이름도 같이 본다) */
function* walk(v, at = '') {
  if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* walk(v[i], `${at}[${i}]`);
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) {
      yield [`${at}.${k}`, k, x];
      yield* walk(x, `${at}.${k}`);
    }
}
const keysOf = (v) => new Set([...walk(v)].map(([, k]) => k));
const textsOf = (v) => new Set([...walk(v)].filter(([, , x]) => typeof x === 'string').map(([, , x]) => x));

/**
 * 정본에서 분류가 cls 인 칸의 글. 짧은 글(우연히 같을 수 있음)과, 같은 글이 더 드러나는 칸에도 있는 것은 뺀다
 * (예 진단 F-D1 의 verify_code = 문제 code, 어떤 verify_output = 힌트의 blank_filled_output)
 */
function textsOfClass(data, cls) {
  const all = [...walk(data)]
    .filter(([, , x]) => typeof x === 'string')
    .map(([p, , x]) => [classOf(p.replace(/\[\d+\]/g, '[]').replace(/^\./, '')), x]);
  const openerClasses = cls === 'check' ? ['screen', 'data', 'late'] : ['screen', 'data'];
  const shown = new Set(all.filter(([c]) => openerClasses.includes(c)).map(([, x]) => x));
  return [...new Set(all.filter(([c, x]) => c === cls && x.length >= 12 && !shown.has(x)).map(([, x]) => x))];
}
const checkTexts = (data) => textsOfClass(data, 'check');
const lateTexts = (data) => textsOfClass(data, 'late');

const memo = {};
/** 화면 데이터는 처음 쓸 때 한 번 만든다(만들다 실패하면 그 테스트가 실패로 보이게) */
function built(which) {
  if (memo[which]) return memo[which];
  if (which === 'F') {
    const b = buildBasics(basics);
    memo.F = { data: F, page: { units: b.units, steps: b.steps, questions: b.questions, rebuild: b.rebuild, diagnostic: b.diagnostic, intro_ko: b.intro_ko }, late: [b.answers, b.hints] };
  } else {
    const d = buildSite(lecture).details.L01;
    memo.L01 = { data: L01, page: { lecture: d.lecture, steps: d.steps, questions: d.questions, rebuild: d.rebuild }, late: [d.answers, d.hints] };
  }
  return memo[which];
}

const NEVER_ON_PAGE = ['verify_code', 'verify_output', 'expr', 'checks', 'solution_code', 'solution_code_line_notes_ko', 'solution_source_ko', 'answer_code', 'answer_output', 'blank_answers', 'blank_filled_output', 'answer_index', 'answer_ko', 'measures_ko', 'points_to_id'];

for (const which of ['F', 'L01']) {
  describe(`새는 곳(${which}): 검사용 칸은 화면 데이터 어디에도 없고, 풀이는 늦게 받는 JSON 에만`, () => {
    it('검사용·풀이 칸 이름이 페이지 데이터에 없다', () => {
      const keys = keysOf(built(which).page);
      expect(NEVER_ON_PAGE.filter((k) => keys.has(k))).toEqual([]);
    });
    it('검사용 칸의 글은 페이지 데이터에도, 늦게 받는 JSON 에도 없다', () => {
      const { data, page, late } = built(which);
      const leaked = checkTexts(data).filter((t) => [page, ...late].some((pg) => textsOf(pg).has(t)));
      expect(leaked).toEqual([]);
    });
    it('풀이·정답 코드·힌트 본문은 페이지 데이터에 없고, answers·hints JSON 에는 있다', () => {
      const { data, page, late } = built(which);
      const texts = lateTexts(data);
      expect(texts.length).toBeGreaterThan(0);
      const pageTexts = textsOf(page);
      expect(texts.filter((t) => pageTexts.has(t))).toEqual([]);
      const lateAll = new Set(late.flatMap((x) => [...textsOf(x)]));
      expect(texts.filter((t) => !lateAll.has(t))).toEqual([]);
    });
  });
}
