// 영상 플레이어 부품 (spec 0.5, HANDOFF 5절). youtube-nocookie 공식 임베드, 자동 재생 없음, IFrame API 없음.
// 상태: 접힘 / 불러오는 중 / 준비됨 / 오류(10초 안에 안 뜸) / 영상 없음(빈 구간 목록, iframe 을 만들지 않음, D40·D49)
import { useEffect, useRef, useState } from 'preact/hooks';
import { config } from '../config';
import { buildEmbedUrl, buildWatchUrl, formatClock, formatRange, playerMode, sharedStepRange, type Segment } from '../lib/video';
import { IconChevron, IconExternal } from './Icons';

export interface PlayerProps {
  videoId: string;
  videoUrl: string;
  title: string;
  segments: Segment[];
  /** 같은 구간 공유 표시용 */
  lectureSteps: { order: number; video_segments: Segment[] }[];
  order: number;
  /** 접힘 기억 이름 (기기별 localStorage) */
  context: 'segment' | 'practice';
  showCaptionNote?: boolean;
}

function initialCollapsed(context: PlayerProps['context']): boolean {
  if (typeof window === 'undefined') return false;
  const desktop = window.matchMedia?.('(min-width: 1024px)').matches ?? true;
  const key = `z2h.video.collapsed.${context}.${desktop ? 'desktop' : 'mobile'}`;
  const v = window.localStorage?.getItem(key);
  if (v === '1') return true;
  if (v === '0') return false;
  return context === 'practice' && !desktop; // 처음 값: 구간 펼침, 모바일 실습 접힘, 데스크톱 실습 펼침
}

function rememberCollapsed(context: PlayerProps['context'], v: boolean) {
  const desktop = window.matchMedia?.('(min-width: 1024px)').matches ?? true;
  window.localStorage?.setItem(`z2h.video.collapsed.${context}.${desktop ? 'desktop' : 'mobile'}`, v ? '1' : '0');
}

export default function VideoPlayer(p: PlayerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [segIdx, setSegIdx] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const boxRef = useRef<HTMLDivElement>(null);
  // iframe은 화면에 붙은 뒤에만 만든다. 정적 HTML에 넣으면 부품이 깨어나기 전에 load가 끝나 "불러오는 중"에 멈출 수 있다
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(initialCollapsed(p.context));
    setMounted(true);
  }, [p.context]);

  const seg = p.segments[segIdx] ?? null;
  const end = seg ? seg.end_s : 0;
  const src = seg ? buildEmbedUrl(p.videoId, seg.start_s, end) : null;
  const watch = buildWatchUrl(p.videoUrl, seg?.start_s ?? 0);
  const range = seg ? formatRange(seg.start_s, end) : null;
  const shared = seg ? sharedStepRange(p.lectureSteps, p.order, seg) : null;

  // 오류 판정: 화면에 보인 뒤 10초 안에 load가 없으면
  useEffect(() => {
    if (!src || collapsed || !mounted) return;
    setState('loading');
    let timer: ReturnType<typeof setTimeout> | null = null;
    const el = boxRef.current;
    const start = () => {
      if (!timer) timer = setTimeout(() => setState((s) => (s === 'loading' ? 'error' : s)), config.videoLoadTimeoutMs);
    };
    let io: IntersectionObserver | null = null;
    if (el && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && start());
      io.observe(el);
    } else start();
    return () => {
      if (timer) clearTimeout(timer);
      io?.disconnect();
    };
  }, [src, collapsed, mounted]);

  const toggle = () => {
    const v = !collapsed;
    setCollapsed(v);
    rememberCollapsed(p.context, v);
  };

  if (playerMode(p.segments) === 'no_video' || !seg) {
    return (
      <p class="novid" data-testid="no-video">
        이 단계는 영상 없이 글로만 합니다.
      </p>
    );
  }

  return (
    <section class={`pcard${collapsed ? ' collapsed' : ''}`} aria-label="영상" data-testid="video-player" data-state={collapsed ? 'collapsed' : state}>
      <div class="pc-head">
        <div class="grow">
          <h2 class="num">영상 {range}</h2>
          <span class="cap">유튜브 공식 챕터 기준</span>
        </div>
        <button type="button" class="btn ghost sm" aria-expanded={!collapsed} onClick={toggle}>
          {collapsed ? '펼치기' : '접기'} <IconChevron up={!collapsed} />
        </button>
      </div>
      {!collapsed && (
        <>
          {p.segments.length > 1 && (
            <div class="pc-segs" role="group" aria-label="영상 구간 고르기">
              {p.segments.map((g, i) => (
                <button type="button" class="chip num" aria-pressed={i === segIdx} onClick={() => setSegIdx(i)}>
                  구간 {i + 1} · {formatRange(g.start_s, g.end_s)}
                </button>
              ))}
            </div>
          )}
          {state === 'error' ? (
            <div class="player error">
              <div class="ov">
                <p class="msg">이 화면에서 영상을 열 수 없습니다</p>
                <a class="btn" href={watch} target="_blank" rel="noopener noreferrer">
                  유튜브에서 {formatClock(seg.start_s)}부터 보기 <IconExternal />
                </a>
              </div>
            </div>
          ) : (
            <div class="player" ref={boxRef}>
              {mounted && (
              <iframe
                key={src}
                src={src!}
                title={`영상 ${range}: ${p.title}`}
                loading="lazy"
                allow="encrypted-media; picture-in-picture; fullscreen"
                referrerpolicy="strict-origin-when-cross-origin"
                onLoad={() => setState('ready')}
              />
              )}
              {state === 'loading' && (
                <div class="ov" aria-busy="true">
                  <p class="msg">영상을 불러오는 중입니다</p>
                  <span class="sk" />
                  <p class="sub">오래 걸리면 아래 유튜브에서 열기를 쓰세요</p>
                </div>
              )}
            </div>
          )}
          {state !== 'error' && (
            <div class="pc-foot">
              <a href={watch} target="_blank" rel="noopener noreferrer" data-testid="watch-link">
                유튜브에서 열기 <IconExternal />
              </a>
              <span class="cap num">{formatClock(end)}에서 멈춥니다</span>
            </div>
          )}
          {shared && (
            <p class="pc-note small">
              이 구간은 단계 {shared.from}~{shared.to}가 함께 씁니다.
            </p>
          )}
          {p.showCaptionNote && state === 'ready' && (
            <p class="pc-note cap">
              자막: 한국어 자막(YouTube 자동 번역)을 켜서 엽니다. YouTube가 한국어 자막을 주지 않으면 영어 자막이나 자막 없이 재생됩니다. 그때는 아래 세 줄 요약과 핵심 개념으로 내용을 확인하세요.
            </p>
          )}
          {state === 'ready' && <p class="sr-only">누르면 {formatClock(seg.start_s)}부터 재생 · 한국어 자막 켜짐 · 자동 재생 없음</p>}
        </>
      )}
    </section>
  );
}
