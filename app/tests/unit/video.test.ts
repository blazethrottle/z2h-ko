import { describe, expect, it } from 'vitest';
import { buildEmbedUrl, buildWatchUrl, formatClock, playerMode, sharedStepRange } from '../../src/lib/video';

describe('영상 주소 변환 (한 곳)', () => {
  it('start·end와 자막·rel·playsinline 매개변수를 정해진 순서로 넣는다', () => {
    expect(buildEmbedUrl('VMj-3S1tku0', 1149, 1930)).toBe(
      'https://www.youtube-nocookie.com/embed/VMj-3S1tku0?start=1149&end=1930&rel=0&playsinline=1&cc_load_policy=1&cc_lang_pref=ko&hl=ko',
    );
  });

  it('autoplay 매개변수는 없다', () => {
    expect(buildEmbedUrl('abc', 10, 20)).not.toMatch(/autoplay/);
  });

  it('유튜브에서 열기 주소는 video_url&t={start}s', () => {
    expect(buildWatchUrl('https://www.youtube.com/watch?v=VMj-3S1tku0', 1149)).toBe('https://www.youtube.com/watch?v=VMj-3S1tku0&t=1149s');
    expect(buildWatchUrl('https://youtu.be/x', 7)).toBe('https://youtu.be/x?t=7s');
  });

  it('빈 구간 목록 = 영상 없는 단계(플레이어를 만들지 않음, D49)', () => {
    expect(playerMode([])).toBe('no_video');
    expect(playerMode(null)).toBe('no_video');
    expect(playerMode([{ start_s: 0, end_s: 10 }])).toBe('video');
  });

  it('같은 구간을 쓰는 연속 단계 범위를 order 기준으로 계산한다', () => {
    const seg = (s: number, e: number) => [{ start_s: s, end_s: e }];
    const steps = [
      { order: 3, video_segments: seg(852, 1149) },
      { order: 4, video_segments: seg(1149, 1930) },
      { order: 5, video_segments: seg(1149, 1930) },
      { order: 6, video_segments: seg(1149, 1930) },
      { order: 7, video_segments: seg(1930, 3070) },
    ];
    expect(sharedStepRange(steps, 5, { start_s: 1149, end_s: 1930 })).toEqual({ from: 4, to: 6 });
    expect(sharedStepRange(steps, 3, { start_s: 852, end_s: 1149 })).toBeNull();
  });

  it('시각 글자: 1:22:28, 19:09', () => {
    expect(formatClock(4948)).toBe('1:22:28');
    expect(formatClock(1149)).toBe('19:09');
  });
});
