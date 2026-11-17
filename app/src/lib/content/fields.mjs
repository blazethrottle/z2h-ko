// 콘텐츠 칸 분류 한 곳 (정본 F.json·L01.json, data-spec.md 2-2절 표와 같은 내용).
//   screen: 화면에 글이나 값으로 보인다 / data: 화면이 계산·판정·연결에 쓴다(글로는 안 보일 수 있다)
//   late:   풀이·정답·힌트 본문. 페이지에는 넣지 않고 제출하거나 힌트를 열 때 answers·hints JSON 으로 받는다
//   check:  검사·검수 전용. 어떤 화면 데이터에도 넣지 않는다
// 표에 이름이 있는 묶음(예 'steps[]')은 아래 칸을 하나씩 적어야 하고(tests/unit/fields.test.mjs 가 정본의 모든 칸을 확인), 표에 없는 묶음은 부모 칸의 분류를 따른다.
export const FIELD_CLASS = {
  '': { _meta: 'check', lecture: 'screen', steps: 'screen', questions: 'screen', rebuild_tasks: 'screen', mastery_rule: 'data', hints: 'late' },
  lecture: {
    lecture_id: 'data',
    title_ko: 'screen',
    video_url: 'screen',
    youtube_video_id: 'data',
    video_seconds: 'screen',
    video_minutes: 'data',
    source_repos: 'screen',
    env: 'screen',
    objectives: 'screen',
    prereq_units: 'screen',
    prereq_lectures: 'screen',
    mastery_rule_id: 'data',
    research_status: 'check',
    intro_ko: 'screen',
    units: 'screen',
    diagnostic: 'screen',
    recommend_rules: 'screen',
    lecture_prereq_units: 'data',
  },
  'lecture.objectives[]': { objective_id: 'data', text_ko: 'screen', unit_id: 'data' },
  'lecture.units[]': {
    unit_id: 'screen',
    kind: 'data',
    title_ko: 'screen',
    goal_ko: 'screen',
    analogy_ko: 'screen',
    card_ko: 'screen',
    needed_by_lectures: 'screen',
    recommend_first: 'data',
    objective_ids: 'data',
    step_ids: 'data',
    question_ids: 'data',
    rebuild_ids: 'data',
    estimated_minutes: 'screen',
    status: 'data',
  },
  'lecture.diagnostic': { question_ids: 'data', hints: 'data', locks_anything: 'data', rules_ko: 'screen', result_if_correct_ko: 'screen', result_if_wrong_ko: 'screen' },
  'lecture.recommend_rules[]': { rule_id: 'data', units: 'data', units_from: 'check', label_ko: 'screen', when_ko: 'screen' },
  mastery_rule: {
    mastery_rule_id: 'data',
    applies_to: 'data',
    steps_complete_ratio: 'screen',
    question_score_ratio: 'screen',
    rebuild_max_hint_level: 'screen',
    rebuild_required: 'data',
    extra_checks: 'data',
    note_ko: 'screen',
  },
  'steps[]': {
    step_id: 'screen',
    lecture_id: 'data',
    unit_id: 'data',
    order: 'screen',
    title_ko: 'screen',
    video_segments: 'screen',
    long_step: 'screen',
    new_code_lines: 'screen',
    moved_code_lines: 'data',
    prepared_code: 'screen',
    prepared_code_line_notes_ko: 'screen',
    prepared_code_source_ko: 'screen',
    kind: 'screen',
    input_ko: 'screen',
    code: 'screen',
    code_line_notes_ko: 'screen',
    cell_line_counts: 'screen',
    edits: 'screen',
    rerun_first: 'screen',
    run_plan: 'screen',
    place_before: 'screen',
    restart_first: 'screen',
    expected_ko: 'screen',
    expected_check: 'screen',
    expected_error: 'screen',
    expected_output_example: 'screen',
    self_check_ko: 'screen',
    meaning_ko: 'screen',
    objective_ids: 'data',
    hint_ids: 'data',
  },
  'steps[].video_segments[]': { start_s: 'screen', end_s: 'screen' },
  'steps[].edits[]': { target_step: 'screen', where_ko: 'screen', action: 'screen', anchor_line: 'screen', line_count: 'screen' },
  // expected/min/max 는 "보여야 하는 것"과 붙여넣기 비교, match 는 비교 방식. expr·checks·mode·lines 는 검사 도구(run_code.py, verify_f.py)만 읽는다
  'steps[].expected_check': { type: 'data', expected: 'screen', match: 'data', min: 'screen', max: 'screen', expr: 'check', checks: 'check', mode: 'check', lines: 'check' },
  'questions[]': {
    question_id: 'screen',
    lecture_id: 'data',
    unit_id: 'data',
    type: 'screen',
    after_step: 'data',
    scored: 'data',
    alternate_of: 'data',
    prompt_ko: 'screen',
    code: 'screen',
    choices: 'screen',
    max_points: 'screen',
    must_pass: 'screen',
    objective_ids: 'data',
    hint_ids: 'data',
    graded_on: 'data',
    recommend_units_if_wrong: 'data',
    dont_know_index: 'data',
    allow_dont_know: 'data',
    auto_grade: 'late',
    answer_index: 'late',
    answer_ko: 'late',
    rubric: 'late',
    answer_code: 'late',
    answer_code_line_notes_ko: 'late',
    answer_output: 'late',
    measures_ko: 'late',
    verify_code: 'check',
    verify_output: 'check',
  },
  // type 은 채점 방식 이름("정확히 맞히기로 채점")으로 화면에 보이고, 정답 값은 제출할 때 받는다
  'questions[].auto_grade': { type: 'data', value: 'late', accept: 'late', min: 'late', max: 'late', keywords: 'late' },
  'hints[]': {
    hint_id: 'data',
    target_id: 'data',
    level: 'data',
    unlock: 'data',
    show_solution: 'data',
    text_ko: 'late',
    code_with_blanks: 'late',
    blank_answers: 'late',
    blank_filled_output: 'late',
    points_to_id: 'late',
    points_to_card_line: 'late',
  },
  'rebuild_tasks[]': {
    rebuild_id: 'screen',
    lecture_id: 'data',
    unit_id: 'data',
    title_ko: 'screen',
    task_ko: 'screen',
    prompt_ko: 'screen',
    check: 'screen',
    check_code: 'screen',
    check_code_line_notes_ko: 'screen',
    pass_ko: 'screen',
    max_hint_level_for_pass: 'screen',
    required_for_mastery: 'screen',
    cell_line_counts: 'screen',
    expected_output_example: 'screen',
    self_check_ko: 'screen',
    hint_ids: 'data',
    solution_code: 'late',
    solution_code_line_notes_ko: 'late',
    solution_source_ko: 'late',
  },
  'rebuild_tasks[].check': { type: 'data', reference: 'screen', expected: 'screen', mode: 'check' },
};

const parentOf = (p) => {
  const i = p.lastIndexOf('.');
  return i < 0 ? ['', p] : [p.slice(0, i), p.slice(i + 1)];
};

/** 칸 경로(예 'steps[].expected_check.expr', 배열은 [])의 분류. 표에 없으면 null */
export function classOf(fieldPath) {
  const [owner, keyRaw] = parentOf(fieldPath);
  const key = keyRaw.replace(/\[\]$/, '');
  if (owner in FIELD_CLASS) return FIELD_CLASS[owner][key] ?? null;
  return owner === '' ? null : classOf(owner.replace(/\[\]$/, ''));
}

/** 데이터 안의 모든 칸 경로(중복 없이, 배열은 []) */
export function fieldPaths(data) {
  const out = new Set();
  const walk = (v, at) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, at));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        const p = at ? `${at}.${k}` : k;
        out.add(p);
        walk(x, Array.isArray(x) ? `${p}[]` : p);
      }
  };
  walk(data, '');
  return [...out].sort();
}

/** 한 묶음(owner)의 칸 중 주어진 분류인 것의 이름 */
export function fieldsOfClass(owner, ...classes) {
  return Object.entries(FIELD_CLASS[owner] ?? {})
    .filter(([, c]) => classes.includes(c))
    .map(([k]) => k);
}
