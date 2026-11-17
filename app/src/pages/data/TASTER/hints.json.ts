// 맛보기 힌트 본문(H4 예상 출력 전체 포함): 힌트를 열 때 불러오는 별도 JSON
import type { APIRoute } from 'astro';
import { loadTaster } from '../../../lib/content/taster.mjs';

export const GET: APIRoute = () =>
  new Response(JSON.stringify((loadTaster() as any).hints), { headers: { 'content-type': 'application/json; charset=utf-8' } });
