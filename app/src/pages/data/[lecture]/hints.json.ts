// 힌트 본문(H4 정답 포함): 힌트를 열 때 불러오는 별도 JSON
import type { APIRoute } from 'astro';
import { loadSite } from '../../../lib/content/build.mjs';

export function getStaticPaths() {
  return Object.keys(loadSite().details).map((lecture) => ({ params: { lecture } }));
}

export const GET: APIRoute = ({ params }) =>
  new Response(JSON.stringify((loadSite().details as any)[params.lecture as string].hints), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
