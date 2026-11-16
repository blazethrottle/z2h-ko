// 빌드 요약 (자동 브라우저 테스트가 단계 목록을 읽는 용도). 풀이 없음.
import type { APIRoute } from 'astro';
import { loadSite } from '../../lib/content/build.mjs';

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
  }));
  return new Response(JSON.stringify({ source: site.source, lectures }), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
