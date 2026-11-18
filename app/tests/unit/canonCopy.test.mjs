// 정본 F.json·L01.json·taster.json 의 문구 정리(2026-11-18: 실행 장소 Colab 고정, 전체 시간 표시 안 함). 정본은 손으로 고치지 않는다.
// P9 가 한 일의 약속: 1) c8e0ec6 판(git 기록)에 표를 적용하면 정리한 판과 글자 하나까지 같다(손 편집 없음). 2) 두 번 적용해도 같다. 3) 표에 없는 칸은 하나도 바뀌지 않았다.
//   4) 교사가 문구를 준 곳은 그 글자 그대로, 나머지는 빼기만 했다. 5) 실행 장소 낱말·전체 시간이 남은 글은 "그대로 둔 곳(KEPT)"뿐이다. 6) 정본 수치와 판 이름은 그대로다.
// 정리한 판: taster.json(조각 없는 교사 정본)은 지금 정본. F.json·L01.json(조각 tools/content 에서 만듦)은 P9 판(cfc179e).
//   왜: 지금 정본을 "c8e0ec6 + 표"에 묶으면 조각을 고칠 때마다(새 진단 문항 등) 깨진다. 그 두 파일의 지금 정본은 "되돌아가지 않음"과 5)만 보고,
//   손 편집이 없다는 약속(1·3의 뜻)은 "정본 = 조각에서 만든 것" 재현 테스트(tests/test_content_tools.py)가 맡는다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANON_EDITS,
  CHANGELOG_KEY,
  EDITABLE_EDITS,
  KEPT,
  RUN_PLACE_WORDS,
  TOTAL_TIME_WORDS,
  afterOf,
  applyCanonEdits,
  valueAt,
} from '../../scripts/canon-colab-time.mjs';
import { APP_DIR, REPO_ROOT } from '../../src/lib/content/load.mjs';

const BASE_COMMIT = 'c8e0ec6a107e473de60b478ca608a96a89d40273';
const P9_COMMIT = 'cfc179e5dd4928f52a0b99ceca3af8d47c50ef49';
const atCommit = (commit, file) => execFileSync('git', ['-C', REPO_ROOT, 'show', `${commit}:${file}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const original = (file) => atCommit(BASE_COMMIT, file);
const current = (file) => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
/** P9 약속을 확인할 판: 조각에서 만드는 정본은 P9 판, 그 밖은 지금 정본 */
const cleaned = (spec) => (spec.generatedFrom ? atCommit(P9_COMMIT, spec.file) : current(spec.file));
const specOf = (name) => CANON_EDITS.find((s) => s.file === `inputs/pedagogy/content/${name}`);

/** 모든 [경로, 값] (배열 번호 포함) */
function* leaves(v, at = []) {
  if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* leaves(v[i], [...at, i]);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* leaves(x, [...at, k]);
  else yield [at, v];
}
const deletionOnly = (src, shown) => {
  let i = 0;
  for (const ch of src) if (ch === shown[i]) i++;
  return i === shown.length;
};
const TEACHER_P1_S1 =
  "앱의 'Colab에서 열기' 단추로 이 단위의 노트북을 엽니다. 단추가 없으면 colab.research.google.com 에서 '새 노트북'을 만듭니다. 첫 셀에 아래 한 줄을 그대로 치고 Shift+Enter를 누릅니다. 따옴표와 괄호는 영어 입력 상태로 칩니다.";

/** 실행 장소 낱말·전체 시간이 남은 칸은 KEPT 뿐이고, KEPT 는 c8e0ec6 판 그대로다 */
function expectOnlyKeptWords(spec, text) {
  const b = JSON.parse(text);
  const a = JSON.parse(original(spec.file));
  const kept = KEPT.filter((k) => k.file === spec.file);
  const changelog = JSON.stringify(['_meta', CHANGELOG_KEY, 0]);
  const left = [...leaves(b)]
    .filter(([, v]) => typeof v === 'string' && (RUN_PLACE_WORDS.test(v) || TOTAL_TIME_WORDS.test(v)))
    .map(([p]) => JSON.stringify(p))
    .filter((p) => p !== changelog);
  expect(left.sort()).toEqual(kept.map((k) => JSON.stringify(k.path)).sort());
  for (const k of kept) expect(valueAt(b, k.path), String(k.line)).toBe(valueAt(a, k.path));
  for (const x of spec.edits) expect(TOTAL_TIME_WORDS.test(afterOf(x)) || RUN_PLACE_WORDS.test(afterOf(x)), x.id).toBe(false);
}

it('표가 실제로 고치는 정본은 taster.json 뿐이고, F.json·L01.json 은 조각 폴더에서 만든다', () => {
  expect(EDITABLE_EDITS.map((s) => s.file)).toEqual(['inputs/pedagogy/content/taster.json']);
  expect(CANON_EDITS.filter((s) => s.generatedFrom).map((s) => [s.file, s.generatedFrom])).toEqual([
    ['inputs/pedagogy/content/F.json', 'tools/content/src_f'],
    ['inputs/pedagogy/content/L01.json', 'tools/content/src_l01'],
  ]);
  for (const s of CANON_EDITS.filter((x) => x.generatedFrom)) expect(fs.existsSync(path.join(REPO_ROOT, s.generatedFrom)), s.generatedFrom).toBe(true);
});

for (const spec of CANON_EDITS) {
  const where = spec.generatedFrom ? 'P9 판' : '지금 정본';
  describe(`정본 문구 정리: ${spec.file} (${where})`, () => {
    const before = original(spec.file);
    const now = cleaned(spec);
    it(`c8e0ec6 판에 표를 적용하면 ${where}과 같고, 칸마다 정확히 한 번 적용된다`, () => {
      const r = applyCanonEdits(before, spec);
      expect(r.text).toBe(now);
      expect(r.applied).toEqual(spec.edits.map((x) => x.id));
      expect(r.alreadyDone).toEqual([]);
      expect(r.changelog).toBe('added');
    });
    it('두 번 적용해도 결과가 같다(이미 적용된 칸은 건너뛴다)', () => {
      const r = applyCanonEdits(now, spec);
      expect(r.text).toBe(now);
      expect(r.applied).toEqual([]);
      expect(r.alreadyDone).toEqual(spec.edits.map((x) => x.id));
      expect(r.changelog).toBe('present');
    });
    it('표에 적은 칸과 _meta 변경 내역 한 줄 말고는 아무 칸도 바뀌지 않았다', () => {
      const pa = new Map([...leaves(JSON.parse(before))].map(([p, v]) => [JSON.stringify(p), v]));
      const pb = new Map([...leaves(JSON.parse(now))].map(([p, v]) => [JSON.stringify(p), v]));
      const changed = [...pb.keys()].filter((k) => pa.get(k) !== pb.get(k)).sort();
      expect([...pa.keys()].filter((k) => !pb.has(k))).toEqual([]);
      expect(changed).toEqual([...spec.edits.map((x) => JSON.stringify(x.path)), JSON.stringify(['_meta', CHANGELOG_KEY, 0])].sort());
      expect(JSON.parse(now)._meta[CHANGELOG_KEY]).toEqual([spec.changelog]);
      expect(spec.changelog).toContain('2026-11-18');
    });
    it('교사 문구는 그 글자 그대로, 나머지는 원문에서 빼기만 했다', () => {
      const a = JSON.parse(before);
      const b = JSON.parse(now);
      for (const x of spec.edits) {
        expect(valueAt(a, x.path), x.id).toBe(x.before);
        expect(valueAt(b, x.path), x.id).toBe(afterOf(x));
        if (!x.teacher) expect(deletionOnly(x.before, afterOf(x)), x.id).toBe(true);
      }
    });
    it('실행 장소 낱말·전체 시간이 남은 글은 그대로 둔 곳(KEPT)뿐이고, 그대로 둔 곳은 원문 그대로다', () => {
      expectOnlyKeptWords(spec, now);
    });
  });
}

for (const spec of CANON_EDITS.filter((s) => s.generatedFrom)) {
  describe(`조각에서 만드는 정본의 지금 판: ${spec.file}`, () => {
    const text = current(spec.file);
    const strings = new Set([...leaves(JSON.parse(text))].map(([, v]) => v).filter((v) => typeof v === 'string'));
    it('되돌아가지 않음: 표의 후 글은 어느 칸에 그대로 있고, 전 글은 어느 칸에도 없다(칸 위치가 아니라 글로 찾는다)', () => {
      for (const x of spec.edits) {
        expect(strings.has(afterOf(x)), `${x.id} 후 글`).toBe(true);
        expect(strings.has(x.before), `${x.id} 전 글`).toBe(false);
      }
      expect(JSON.parse(text)._meta[CHANGELOG_KEY]).toEqual([spec.changelog]);
    });
    it('실행 장소 낱말·전체 시간이 남은 글은 그대로 둔 곳(KEPT)뿐이고, 그대로 둔 곳은 원문 그대로다', () => {
      expectOnlyKeptWords(spec, text);
    });
  });
}

describe('정본 수치·판 이름·테스트용 예시', () => {
  it('P9 는 수치와 판 이름을 바꾸지 않았다: 기초 단계 50·문항 50·익힘 과제 15·힌트 340, 1편 단계 58·문항 15·재구성 3·힌트 290, 맛보기 단계 8·문항 3', () => {
    const F = JSON.parse(cleaned(specOf('F.json')));
    const L = JSON.parse(cleaned(specOf('L01.json')));
    const T = JSON.parse(cleaned(specOf('taster.json')));
    expect([F.steps.length, F.questions.length, F.rebuild_tasks.length, F.hints.length]).toEqual([50, 50, 15, 340]);
    expect([L.steps.length, L.questions.length, L.rebuild_tasks.length, L.hints.length]).toEqual([58, 15, 3, 290]);
    expect([T.steps.length, T.questions.length]).toEqual([8, 3]);
    for (const [name, doc] of [['F.json', F], ['L01.json', L], ['taster.json', T]]) {
      expect(doc._meta.version, name).toBe(JSON.parse(original(`inputs/pedagogy/content/${name}`))._meta.version);
    }
  });
  it('교사 문구: F-P1 제목 "노트북 다루기(Colab)", F-P1-S1 input_ko', () => {
    const F = JSON.parse(current('inputs/pedagogy/content/F.json'));
    expect(F.lecture.units.find((u) => u.unit_id === 'F-P1').title_ko).toBe('노트북 다루기(Colab)');
    expect(F.steps.find((s) => s.step_id === 'F-P1-S1').input_ko).toBe(TEACHER_P1_S1);
  });
  it('테스트용 예시(tests/fixtures)는 지금 정본에서 다시 뽑은 것과 같다', () => {
    expect(fs.readFileSync(path.join(APP_DIR, 'tests/fixtures/basics/F.json'), 'utf8')).toBe(current('inputs/pedagogy/content/F.json'));
    expect(fs.readFileSync(path.join(APP_DIR, 'tests/fixtures/pedagogy/content/L01.json'), 'utf8')).toBe(current('inputs/pedagogy/content/L01.json'));
  });
});
