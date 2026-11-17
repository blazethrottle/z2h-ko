import { describe, expect, it } from 'vitest';
import { gradeQuestion, hintScoreRatio, scoreAttempt, bestQuestionScore } from '../../src/lib/grading';

const base = { max_points: 1, rubric: [{ point: 1, criterion_ko: '기준' }] };

describe('채점 4방식 + choice', () => {
  it('choice: answer_index와 같으면 정답, 모르겠어요(정본 dont_know_index 보기)는 감점 없이 오답 기록', () => {
    const q = { ...base, type: 'choice', choices: ['3', '5', '32', '모르겠어요'], answer_index: 1, dont_know_index: 3, auto_grade: { type: 'choice' } };
    expect(gradeQuestion(q, { choiceIndex: 1 }).verdict).toBe('correct');
    const w = gradeQuestion(q, { choiceIndex: 0 });
    expect(w.verdict).toBe('wrong');
    expect(w.is_dont_know).toBe(false);
    const d = gradeQuestion(q, { choiceIndex: 3 });
    expect(d.verdict).toBe('wrong');
    expect(d.is_dont_know).toBe(true);
    expect(d.raw_points).toBe(0);
  });

  it('exact: 공백·대소문자 무시, 숫자면 2 와 2.0을 같게 본다', () => {
    const q = { ...base, type: 'predict', auto_grade: { type: 'exact', value: '2.0' } };
    expect(gradeQuestion(q, { text: ' 2 ' }).verdict).toBe('correct');
    expect(gradeQuestion(q, { text: '2.0' }).verdict).toBe('correct');
    expect(gradeQuestion(q, { text: '3' }).verdict).toBe('wrong');
    const s = { ...base, type: 'fix_bug', auto_grade: { type: 'exact', value: ['+=', 'self.grad +='] } };
    expect(gradeQuestion(s, { text: 'SELF.GRAD  +=' }).verdict).toBe('correct');
  });

  it('choice: 모르겠어요는 글이 아니라 정본 dont_know_index 로 안다(보기 글이 모르겠어요여도 번호가 없으면 일반 오답)', () => {
    const q = { ...base, type: 'choice', choices: ['모르겠어요', '5'], answer_index: 1, auto_grade: { type: 'choice' } };
    expect(gradeQuestion(q, { choiceIndex: 0 }).is_dont_know).toBe(false);
    expect(gradeQuestion({ ...q, dont_know_index: 0 }, { choiceIndex: 0 }).is_dont_know).toBe(true);
  });

  it('exact: 같은 답의 다른 표기(정본 auto_grade.accept)도 정답', () => {
    const q = { ...base, type: 'predict', auto_grade: { type: 'exact', value: '6', accept: ['6.0', '6배'] } };
    for (const t of ['6', '6.0', '6배', ' 6배 ']) expect(gradeQuestion(q, { text: t }).verdict, t).toBe('correct');
    expect(gradeQuestion(q, { text: '7배' }).verdict).toBe('wrong');
  });

  it('numeric_range: 첫 숫자가 범위 안이면 정답', () => {
    const q = { ...base, type: 'predict', auto_grade: { type: 'numeric_range', min: 0.5, max: 0.52 } };
    expect(gradeQuestion(q, { text: '약 0.51' }).verdict).toBe('correct');
    expect(gradeQuestion(q, { text: '0.7' }).verdict).toBe('wrong');
    expect(gradeQuestion(q, { text: '모르겠다' }).reason_code).toBe('no_number');
  });

  it('keywords: rubric 항목의 keywords로 미리 체크하고 점수를 합한다', () => {
    const q = {
      type: 'explain',
      max_points: 1,
      auto_grade: { type: 'keywords' },
      rubric: [
        { point: 0.5, criterion_ko: '조금 바꾸면', keywords: ['조금', '살짝'] },
        { point: 0.5, criterion_ko: '몇 배', keywords: ['배'] },
      ],
    };
    const half = gradeQuestion(q, { text: 'x를 살짝 올리면 f가 오른다' });
    expect(half.raw_points).toBe(0.5);
    expect(half.verdict).toBe('partial');
    expect(half.autoChecked).toEqual([true, false]);
    expect(gradeQuestion(q, { text: '조금 올리면 14배' }).verdict).toBe('correct');
  });

  it('keywords: rubric에 keywords가 없으면 auto_grade.keywords 묶음 비율로 점수', () => {
    const q = { type: 'explain', max_points: 1, rubric: [{ point: 1, criterion_ko: '둘 다' }], auto_grade: { type: 'keywords', keywords: [['그대로'], ['곱']] } };
    expect(gradeQuestion(q, { text: '+는 그대로' }).raw_points).toBe(0.5);
  });

  it('manual: 사용자가 고른 채점 기준의 합', () => {
    const q = {
      type: 'explain',
      max_points: 1,
      auto_grade: { type: 'manual' },
      rubric: [
        { point: 0.5, criterion_ko: 'a' },
        { point: 0.5, criterion_ko: 'b' },
      ],
    };
    expect(gradeQuestion(q, { text: '무엇', checked: [true, true] }).verdict).toBe('correct');
    expect(gradeQuestion(q, { text: '무엇', checked: [false, true] }).raw_points).toBe(0.5);
    expect(gradeQuestion(q, { text: '무엇' }).raw_points).toBe(0);
  });

  it('keywords에서 사용자가 체크를 고치면 고친 값이 이긴다', () => {
    const q = { type: 'explain', max_points: 1, auto_grade: { type: 'keywords' }, rubric: [{ point: 1, criterion_ko: 'x', keywords: ['없는말'] }] };
    expect(gradeQuestion(q, { text: '설명', checked: [true] }).verdict).toBe('correct');
  });
});

describe('힌트 점수 비율 (hints.md 3절)', () => {
  it('H0·H1 1.0, H2 0.8, H3 0.5, H4 0, HELP 0', () => {
    expect([0, 1, 2, 3, 4, 5].map((l) => hintScoreRatio(l))).toEqual([1, 1, 0.8, 0.5, 0, 0]);
  });
  it('points_awarded = raw_points × 비율', () => {
    expect(scoreAttempt(1, 2)).toEqual({ score_ratio: 0.8, points_awarded: 0.8 });
    expect(scoreAttempt(0.5, 3)).toEqual({ score_ratio: 0.5, points_awarded: 0.25 });
  });
  it('문제 점수는 시도 중 가장 높은 points_awarded, HELP+env_issue는 분모에서 뺀다', () => {
    expect(bestQuestionScore([{ points_awarded: 0 }, { points_awarded: 0.8 }])).toEqual({ points: 0.8, excluded: false });
    expect(bestQuestionScore([{ points_awarded: 0, max_hint_level: 5, env_issue: true }])).toEqual({ points: 0, excluded: true });
    expect(bestQuestionScore([])).toEqual({ points: 0, excluded: false });
  });
});
