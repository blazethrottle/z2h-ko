// 맛보기 노트북 받기: 저장소 notebooks/taster/taster.ipynb 가 있으면 빌드 때 dist/notebooks/taster/ 로 복사한다.
// 없으면 아무것도 만들지 않고 화면은 "노트북 준비 중"을 보인다.
import type { APIRoute } from 'astro';
import { loadTaster } from '../../../lib/content/taster.mjs';
import { readRepoFile } from '../../../lib/content/load.mjs';

export function getStaticPaths() {
  const nb = (loadTaster() as any).lecture.notebook;
  return nb.available ? [{ params: { file: nb.file }, props: { path: nb.path } }] : [];
}

export const GET: APIRoute = ({ props }) =>
  new Response(new Uint8Array(readRepoFile((props as { path: string }).path)), { headers: { 'content-type': 'application/x-ipynb+json' } });
