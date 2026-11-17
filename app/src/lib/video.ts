// 영상 주소를 만드는 곳은 이 파일 하나다 (DESIGN.md 5절, spec 0.5, HANDOFF 5절).
// autoplay 매개변수와 IFrame API는 쓰지 않는다. end_s 는 늘 값이 있다(D49). 빈 구간 목록 = 영상 없는 단계.

export interface Segment {
  start_s: number;
  end_s: number;
}

const EMBED_BASE = 'https://www.youtube-nocookie.com/embed/';

/** https://www.youtube-nocookie.com/embed/{id}?start=..&end=..&rel=0&playsinline=1&cc_load_policy=1&cc_lang_pref=ko&hl=ko */
export function buildEmbedUrl(videoId: string, startS: number, endS: number): string {
  const params = [`start=${Math.max(0, Math.floor(startS))}`, `end=${Math.floor(endS)}`, 'rel=0', 'playsinline=1', 'cc_load_policy=1', 'cc_lang_pref=ko', 'hl=ko'];
  return `${EMBED_BASE}${encodeURIComponent(videoId)}?${params.join('&')}`;
}

/** 플레이어를 만들지: 빈 목록이면 영상 없는 단계(iframe 을 만들지 않음, D40·D49) */
export function playerMode(segments: Segment[] | null | undefined): 'video' | 'no_video' {
  return Array.isArray(segments) && segments.length > 0 ? 'video' : 'no_video';
}

/** "유튜브에서 열기": video_url&t={start}s */
export function buildWatchUrl(videoUrl: string, startS: number): string {
  const sep = videoUrl.includes('?') ? '&' : '?';
  return `${videoUrl}${sep}t=${Math.max(0, Math.floor(startS))}s`;
}

const sameSeg = (a: Segment, b: Segment) => a.start_s === b.start_s && a.end_s === b.end_s;

/** 같은 구간을 쓰는 연속 단계 범위(order 기준). 혼자 쓰면 null */
export function sharedStepRange(
  steps: { order: number; video_segments: Segment[] }[],
  currentOrder: number,
  seg: Segment,
): { from: number; to: number } | null {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((s) => s.order === currentOrder);
  if (idx < 0) return null;
  const has = (i: number) => i >= 0 && i < sorted.length && sorted[i].video_segments.some((x) => sameSeg(x, seg));
  let lo = idx;
  let hi = idx;
  while (has(lo - 1)) lo--;
  while (has(hi + 1)) hi++;
  if (lo === hi) return null;
  return { from: sorted[lo].order, to: sorted[hi].order };
}

/** 초 → "1:22:28" / "19:09" */
export function formatClock(totalS: number): string {
  const s = Math.max(0, Math.floor(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** 범위 글자. en dash(–) 사용 */
export function formatRange(startS: number, endS: number): string {
  return `${formatClock(startS)}–${formatClock(endS)}`;
}
