// 페이지가 공통으로 쓰는 값 계산 (빌드 때만 실행)
import { loadSite } from './content/build.mjs';

export function lectureLabel(lectureId: string, titleKo: string): string {
  const short = String(titleKo).split(':')[0].trim();
  return `${lectureId.slice(1)} ${short}`;
}

export function notebookPublicPath(lectureId: string, repoPath: string | null): string | null {
  if (!repoPath) return null;
  const base = repoPath.split('/').pop();
  return `/notebooks/${lectureId}/${base}`;
}

export function unitTitles(): Map<string, string> {
  const site = loadSite();
  return new Map((site.units ?? []).map((u: any) => [u.unit_id, u.title_ko]));
}

export { loadSite };
