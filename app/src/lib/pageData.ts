// 페이지가 공통으로 쓰는 값 계산 (빌드 때만 실행)
import { loadSite } from './content/build.mjs';
import { loadBasics } from './content/basics.mjs';
import { colabOpenUrl } from '../config';

/** 노트북이 저장소에 있을 때만 Colab 바로 열기 주소(커밋 고정, config.colab). 없으면 null(화면은 "노트북 준비 중") */
export function colabUrlOf(repoPath: string | null | undefined, available: boolean): string | null {
  return repoPath && available ? colabOpenUrl(repoPath) : null;
}

export function lectureLabel(lectureId: string, titleKo: string): string {
  const short = String(titleKo).split(':')[0].trim();
  return `${lectureId.slice(1)} ${short}`;
}

/** 경로의 마지막 조각(파일 이름). / 가 없으면 그대로 */
export function fileNameOf(repoPath: string): string {
  return repoPath.slice(repoPath.lastIndexOf('/') + 1);
}

export function notebookPublicPath(lectureId: string, repoPath: string | null): string | null {
  if (!repoPath) return null;
  const base = repoPath.split('/').pop();
  return `/notebooks/${lectureId}/${base}`;
}

/** 기초 단위 이름: 정본 F.json lecture.units */
export function unitTitles(): Map<string, string> {
  return new Map(loadBasics().units.map((u) => [u.unit_id, u.title_ko]));
}

export { loadSite };

/** 배지 화면용 편 목록 (편 수는 콘텐츠 목록에서 센다). 도장 id 는 정본 rewards.stamp.stamp_id */
export function badgeLectures() {
  const site: any = loadSite();
  return site.lectures.map((l: any) => {
    const d = site.details[l.lecture_id];
    return {
      lecture_id: l.lecture_id,
      available: !!l.available,
      stamp_id: d?.lecture?.rewards?.stamp?.stamp_id ?? null,
      content_version: d?.lecture?.content_version ?? null,
    };
  });
}

/** 출처 표기 문장: 정본 artifact.contents_ko 의 "출처 표기: …" 줄에서 뒷부분 */
export function creditFromContents(contents: unknown): string | null {
  const line = (Array.isArray(contents) ? contents : []).map(String).find((s) => /^출처 표기\s*:/.test(s));
  return line ? line.replace(/^출처 표기\s*:\s*/, '').trim() : null;
}

/** 편 공유 결과물(정본 lecture.rewards.artifact)을 화면 값으로. 열리는 단계는 unlock 글의 단계 id. 모양이 다르면 빌드 실패 */
export function lectureArtifact(lectureId: string) {
  const site: any = loadSite();
  const d = site.details[lectureId];
  const a = d?.lecture?.rewards?.artifact;
  if (!a) return null;
  const unlockStep = String(a.unlock ?? '').match(/\b(L\d{2}-S[0-9A-Za-z]+)\b/)?.[1] ?? null;
  const step = d.steps.find((s: any) => s.step_id === unlockStep);
  const credit = creditFromContents(a.contents_ko);
  if (!step || !credit || !a.x_compose?.prefill_ko) throw new Error(`${lectureId} rewards.artifact 의 unlock 단계·출처 표기·x_compose 를 읽지 못했습니다`);
  return {
    artifact_id: String(a.artifact_id),
    name_ko: String(a.name_ko),
    lecture_id: lectureId,
    lecture_label: lectureLabel(lectureId, d.lecture.title_ko),
    mark: lectureId.slice(1),
    credit_ko: credit,
    prefill_ko: String(a.x_compose.prefill_ko),
    unlock_step: { step_id: step.step_id, slug: step.slug, order: step.order, title_ko: step.title_ko },
    content_version: d.lecture.content_version as string,
  };
}

/** 단계 화면 아래 코드 출처 한 줄: "이 코드는 Andrej Karpathy의 A와 B(MIT 라이선스)를 따라 만든 것입니다" + 저장소 링크 */
export function codeCredit(repos: string[]) {
  const list = repos.map((r) => ({ name: r.split('/').pop() as string, url: `https://github.com/${r}` }));
  const names = list.map((x) => x.name);
  const joined = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')}와 ${names[names.length - 1]}`;
  return { text: `이 코드는 Andrej Karpathy의 ${joined}(MIT 라이선스)를 따라 만든 것입니다`, repos: list };
}
