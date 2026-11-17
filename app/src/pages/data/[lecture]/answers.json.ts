// 풀이·채점 값: 페이지에 넣지 않고 제출할 때 불러오는 별도 JSON
import type { APIRoute } from 'astro';
import { loadSite } from '../../../lib/content/build.mjs';

export function getStaticPaths() {
  return Object.keys(loadSite().details).map((lecture) => ({ params: { lecture } }));
}

export const GET: APIRoute = ({ params }) =>
  new Response(JSON.stringify(loadSite().details[String(params.lecture)]?.answers ?? {}), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
