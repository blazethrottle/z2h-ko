// 사전 기초 힌트 본문(H4 정답 포함): 힌트를 열 때 불러오는 별도 JSON (1편 /data/L01/hints.json 과 같은 모양)
import type { APIRoute } from 'astro';
import { loadBasics } from '../../../lib/content/basics.mjs';

export const GET: APIRoute = () =>
  new Response(JSON.stringify((loadBasics() as any).hints), { headers: { 'content-type': 'application/json; charset=utf-8' } });
