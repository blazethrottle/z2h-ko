// 정본 F.json·L01.json·taster.json 의 문구 정리(2026-11-18: 실행 장소 Colab 고정, 전체 시간 표시 안 함). 손으로 고치지 않고 scripts/canon-colab-time.mjs 의 표로만 고친다.
// 1) c8e0ec6 판(git 기록)에 표를 적용하면 지금 정본과 글자 하나까지 같다(손 편집 없음). 2) 두 번 적용해도 같다. 3) 표에 없는 칸은 하나도 바뀌지 않았다(코드·출력·id·칸 구조 그대로).
// 4) 교사가 문구를 준 곳은 그 글자 그대로, 나머지는 빼기만 했다. 5) 실행 장소 낱말·전체 시간이 남은 글은 "그대로 둔 곳(KEPT)"뿐이다. 6) 정본 수치는 그대로다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CANON_EDITS, CHANGELOG_KEY, KEPT, RUN_PLACE_WORDS, TOTAL_TIME_WORDS, afterOf, applyCanonEdits, valueAt } from '../../scripts/canon-colab-time.mjs';
import { APP_DIR, REPO_ROOT } from '../../src/lib/content/load.mjs';

const BASE_COMMIT = 'c8e0ec6a107e473de60b478ca608a96a89d40273';
const original = (file) => execFileSync('git', ['-C', REPO_ROOT, 'show', `${BASE_COMMIT}:${file}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const current = (file) => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');

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

for (const spec of CANON_EDITS) {
  describe(`정본 문구 정리: ${spec.file}`, () => {
    const before = original(spec.file);
    const now = current(spec.file);
    it('c8e0ec6 판에 표를 적용하면 지금 정본과 같고, 칸마다 정확히 한 번 적용된다', () => {
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
      const b = JSON.parse(now);
      const a = JSON.parse(before);
      const kept = KEPT.filter((k) => k.file === spec.file);
      const changelog = JSON.stringify(['_meta', CHANGELOG_KEY, 0]);
      const left = [...leaves(b)]
        .filter(([, v]) => typeof v === 'string' && (RUN_PLACE_WORDS.test(v) || TOTAL_TIME_WORDS.test(v)))
        .map(([p]) => JSON.stringify(p))
        .filter((p) => p !== changelog);
      expect(left.sort()).toEqual(kept.map((k) => JSON.stringify(k.path)).sort());
      for (const k of kept) expect(valueAt(b, k.path), String(k.line)).toBe(valueAt(a, k.path));
      for (const x of spec.edits) expect(TOTAL_TIME_WORDS.test(afterOf(x)) || RUN_PLACE_WORDS.test(afterOf(x)), x.id).toBe(false);
    });
  });
}

describe('정본 수치·판 이름·테스트용 예시', () => {
  it('기초 단계 50·문항 50·익힘 과제 15·힌트 340, 1편 단계 58·문항 15·재구성 3·힌트 290, 맛보기 단계 8·문항 3. 판 이름 그대로', () => {
    const F = JSON.parse(current('inputs/pedagogy/content/F.json'));
    const L = JSON.parse(current('inputs/pedagogy/content/L01.json'));
    const T = JSON.parse(current('inputs/pedagogy/content/taster.json'));
    expect([F.steps.length, F.questions.length, F.rebuild_tasks.length, F.hints.length]).toEqual([50, 50, 15, 340]);
    expect([L.steps.length, L.questions.length, L.rebuild_tasks.length, L.hints.length]).toEqual([58, 15, 3, 290]);
    expect([T.steps.length, T.questions.length]).toEqual([8, 3]);
    for (const f of ['F.json', 'L01.json', 'taster.json']) {
      const p = `inputs/pedagogy/content/${f}`;
      expect(JSON.parse(current(p))._meta.version, f).toBe(JSON.parse(original(p))._meta.version);
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
