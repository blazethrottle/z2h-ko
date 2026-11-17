// 실습 시간 자동 측정 (HANDOFF 6-2, DESIGN.md 2절).
// 화면이 보이고(visibilityState) 마지막 입력(스크롤·키·탭)이 5분 안일 때만 1초씩 센다.

export interface TrackerOptions {
  now: () => number;
  isVisible: () => boolean;
  idleLimitMs: number;
  flushEverySeconds: number;
  onFlush: (deltaSeconds: number) => void;
}

export class ActivityTracker {
  totalSeconds = 0;
  private pending = 0;
  private lastInput: number;

  constructor(private o: TrackerOptions) {
    this.lastInput = o.now();
  }

  noteInput(): void {
    this.lastInput = this.o.now();
  }

  tick(): void {
    if (!this.o.isVisible()) return;
    if (this.o.now() - this.lastInput > this.o.idleLimitMs) return;
    this.totalSeconds++;
    this.pending++;
    if (this.pending >= this.o.flushEverySeconds) this.flush();
  }

  flush(): void {
    if (this.pending > 0) {
      const d = this.pending;
      this.pending = 0;
      this.o.onFlush(d);
    }
  }

  /** 브라우저에 붙인다. 돌려준 함수를 부르면 멈추고 남은 시간을 내보낸다 */
  attach(win: Window = window): () => void {
    const onInput = () => this.noteInput();
    const evs = ['keydown', 'pointerdown', 'scroll', 'wheel', 'touchstart', 'input'];
    for (const e of evs) win.addEventListener(e, onInput, { passive: true, capture: true });
    const onHide = () => {
      if (win.document.visibilityState !== 'visible') this.flush();
    };
    win.document.addEventListener('visibilitychange', onHide);
    const onPageHide = () => this.flush();
    win.addEventListener('pagehide', onPageHide);
    const h = win.setInterval(() => this.tick(), 1000);
    return () => {
      win.clearInterval(h);
      for (const e of evs) win.removeEventListener(e, onInput, { capture: true });
      win.document.removeEventListener('visibilitychange', onHide);
      win.removeEventListener('pagehide', onPageHide);
      this.flush();
    };
  }
}
