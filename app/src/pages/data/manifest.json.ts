// 빌드 요약 (자동 브라우저 테스트가 단계 목록을 읽는 용도). 풀이 없음.
import type { APIRoute } from 'astro';
import { loadSite } from '../../lib/content/build.mjs';
import { loadTaster } from '../../lib/content/taster.mjs';

export const GET: APIRoute = () => {
  const site: any = loadSite();
  const lectures = Object.entries(site.details).map(([lid, d]: [string, any]) => ({
    lecture_id: lid,
    content_version: d.lecture.content_version,
    steps: d.steps.map((s: any) => ({
      step_id: s.step_id,
      slug: s.slug,
      order: s.order,
      question_ids: s.question_ids,
      expected_check: s.expected_check.type,
      expected_range: s.expected_check.type === 'value_range' ? { min: s.expected_check.min, max: s.expected_check.max } : null,
      check_id: s.check_id ?? s.step_id,
      has_edits: !!s.edit_view,
      rerun_first: (s.rerun_first ?? []).map((r: any) => r.step_id),
      hint_levels: s.hint_levels,
      segments: s.video_segments.length,
    })),
    questions: d.questions.map((q: any) => ({ question_id: q.question_id, type: q.type, grade_type: q.grade_type, hint_levels: q.hint_levels, scored: q.scored, after_step: q.after_step })),
    rebuild_ids: d.rebuild.map((r: any) => r.rebuild_id),
    stamp_id: d.lecture.rewards?.stamp?.stamp_id ?? null,
    artifact_id: d.lecture.rewards?.artifact?.artifact_id ?? null,
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
  // 편 목록 전체(내용이 없는 편 포함): 배지 화면의 편 도장 수를 테스트가 콘텐츠에서 센다
  const lecture_list = site.lectures.map((l: any) => ({ lecture_id: l.lecture_id, available: !!l.available }));
  return new Response(JSON.stringify({ source: site.source, lectures, lecture_list, step_counts: site.stepCounts, taster }), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
