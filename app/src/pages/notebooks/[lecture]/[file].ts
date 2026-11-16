// 노트북 받기: 저장소 notebooks/ 의 학생용 노트북이 있으면 빌드에 넣는다(없으면 화면에 "노트북 준비 중")
import type { APIRoute } from 'astro';
import { loadSite } from '../../../lib/content/build.mjs';
import { readRepoFile } from '../../../lib/content/load.mjs';

export function getStaticPaths() {
  const site: any = loadSite();
  return Object.entries(site.details).flatMap(([lid, d]: [string, any]) => {
    const nb = d.lecture.notebook;
    if (!nb?.student || !nb.student_available) return [];
    return [{ params: { lecture: lid, file: String(nb.student).split('/').pop() }, props: { path: nb.student } }];
  });
}

export const GET: APIRoute = ({ props }) =>
  new Response(new Uint8Array(readRepoFile((props as { path: string }).path)), {
    headers: { 'content-type': 'application/x-ipynb+json' },
  });
