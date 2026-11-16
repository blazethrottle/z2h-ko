// 맛보기 확인 질문 풀이: 페이지에 넣지 않고 고를 때 불러오는 별도 JSON (점수 없음)
import type { APIRoute } from 'astro';
import { loadTaster } from '../../../lib/content/taster.mjs';

export const GET: APIRoute = () =>
  new Response(JSON.stringify((loadTaster() as any).answers), { headers: { 'content-type': 'application/json; charset=utf-8' } });
