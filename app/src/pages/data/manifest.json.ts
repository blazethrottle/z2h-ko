// 빌드 요약 (자동 브라우저 테스트가 단계 목록을 읽는 용도). 풀이 없음.
// check: 단계 화면의 확인 방식(lib/checkPlan.ts: text 붙여넣기 글 비교 / number 숫자 범위 / self 같아요·달라요). 테스트는 이 값으로 화면을 다룬다.
import type { APIRoute } from 'astro';
import { STAMP_RULE } from '../../badge-rules';
import type { PublicStep } from '../../components/StepApp';
import { checkPlan } from '../../lib/checkPlan';
import { loadSite } from '../../lib/content/build.mjs';
import { loadTaster } from '../../lib/content/taster.mjs';
import { loadBasics } from '../../lib/content/basics.mjs';

/** 단계 요약(1편·기초 공통) */
function stepSummary(s: PublicStep) {
  const plan = checkPlan(s);
  return {
    step_id: s.step_id,
    slug: s.slug,
    order: s.order,
    kind: s.kind,
    question_ids: s.question_ids,
    expected_check: s.expected_check.type,
    check: plan.kind,
    expected_range: plan.kind === 'number' ? { min: plan.min, max: plan.max } : null,
    expected_text: plan.kind === 'text' ? plan.expected : null,
    expected_error: s.expected_error ?? null,
    output_example: s.expected_output_example ?? null,
    self_check: (s.self_check_ko ?? []).length,
    cells: s.cells.map((c) => c.lines.length),
    run_plan: (s.run_plan ?? []).map((x) => x.kind),
    place_before: s.place_before?.step_id ?? null,
    restart_first: !!s.restart_first,
    prepared: !!s.prepared_code,
    check_id: s.check_id ?? s.step_id,
    has_edits: !!s.edit_view,
    edit_actions: s.edit_view ? [...new Set(s.edit_view.blocks.map((b) => b.action))] : [],
    rerun_first: (s.rerun_first ?? []).map((r) => r.step_id),
    hint_levels: s.hint_levels,
    segments: s.video_segments.length,
  };
}

export const GET: APIRoute = () => {
  const site = loadSite();
  const lectures = Object.entries(site.details).map(([lid, d]) => ({
    lecture_id: lid,
    content_version: d.lecture.content_version,
    steps: d.steps.map(stepSummary),
    questions: d.questions.map((q) => ({ question_id: q.question_id, type: q.type, grade_type: q.grade_type, graded_on: q.graded_on ?? null, dont_know_index: q.dont_know_index ?? null, hint_levels: q.hint_levels, scored: q.scored, after_step: q.after_step })),
    rebuild: d.rebuild.map((r) => ({ rebuild_id: r.rebuild_id, hint_levels: r.hint_levels, has_check_code: !!r.check_code })),
    rebuild_ids: d.rebuild.map((r) => r.rebuild_id),
    stamp_id: STAMP_RULE.idOf(lid, d.lecture.rewards?.stamp?.stamp_id ?? null),
  }));
  const t: any = loadTaster();
  const taster = {
    content_version: t.lecture.content_version,
    requires_steps: t.lecture.requires_steps,
    artifact_unlock_after: t.lecture.artifact?.unlock_after ?? null,
    notebook_available: t.lecture.notebook.available,
    total_minutes: t.total_minutes,
    steps: t.steps.map((s: any) => ({ step_id: s.step_id, slug: s.slug, order: s.order, kind: s.kind, cell_code_lines: s.cell_code_lines, question_ids: s.question_ids, hint_levels: s.hint_levels })),
    questions: t.questions.map((q: any) => ({ question_id: q.question_id, after_step: q.after_step, choices: (q.choices ?? []).length })),
  };
  // 편 목록 전체(내용이 없는 편 포함): 배지 화면의 편 도장 수, 홈·안내 화면을 테스트가 콘텐츠에서 센다
  const lecture_list = site.lectures.map((l) => ({ lecture_id: l.lecture_id, title_ko: l.title_ko, available: !!l.available, plan_steps: l.plan?.steps ?? null }));
  // 사전 기초: 어느 파일을 읽었는지, 단위·단계·문항 목록(풀이 없음). 자동 브라우저 테스트가 콘텐츠에서 센다
  const b = loadBasics();
  const basics = {
    file: b.file,
    counts: b.counts,
    rule: b.rule,
    recommend: b.recommend,
    lecture_prereq: b.lecturePrereq,
    lecture_id: b.lecture_id,
    content_version: b.content_version,
    ready_ids: b.readyIds,
    unit_order: b.unitOrder,
    units: b.units.map((u) => ({ unit_id: u.unit_id, group: u.group, title_ko: u.title_ko, ready: u.ready, status: u.status, estimated_minutes: u.estimated_minutes, card_lines: u.card_ko.length, mastery: u.mastery })),
    rebuild: Object.fromEntries(
      Object.entries(b.rebuild).map(([uid, rs]) => [uid, rs.map((r) => ({ rebuild_id: r.rebuild_id, max_hint_level_for_pass: r.max_hint_level_for_pass, required_for_mastery: r.required_for_mastery, hint_levels: r.hint_levels }))]),
    ),
    steps: Object.fromEntries(Object.entries(b.steps).map(([uid, ss]) => [uid, ss.map(stepSummary)])),
    questions: Object.fromEntries(
      Object.entries(b.questions).map(([uid, qs]) => [uid, qs.map((q) => ({ question_id: q.question_id, type: q.type, grade_type: q.grade_type, graded_on: q.graded_on ?? null, dont_know_index: q.dont_know_index ?? null, hint_levels: q.hint_levels, must_pass: q.must_pass }))]),
    ),
    diagnostic: b.diagnostic.questions.map((q) => ({ question_id: q.question_id, type: q.type, choices: q.choices, recommend_units_if_wrong: q.recommend_units_if_wrong, dont_know_index: q.dont_know_index, allow_dont_know: q.allow_dont_know })),
  };
  return new Response(JSON.stringify({ source: site.source, lectures, lecture_list, step_counts: site.stepCounts, taster, basics }), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
