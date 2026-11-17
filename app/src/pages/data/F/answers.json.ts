// 사전 기초 풀이·채점 값(진단 포함): 페이지에 넣지 않고 제출·결과 보기를 누를 때 불러오는 별도 JSON (1편 /data/L01/answers.json 과 같은 모양)
import type { APIRoute } from 'astro';
import { loadBasics } from '../../../lib/content/basics.mjs';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(loadBasics().answers), { headers: { 'content-type': 'application/json; charset=utf-8' } });
