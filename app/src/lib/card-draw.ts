// 공유 카드 그리기 (spec 13.5, 크기 config.shareCard 1200x675, 배치 참고 목업 card_names). 브라우저 canvas 로 PNG 를 만든다.
// 외부 라이브러리·서버 렌더링 없음. 색·크기·글꼴은 토큰 CSS 변수(tokens.css)에서 읽는다(hex 를 여기 적지 않는다).
// 글꼴(Pretendard·JetBrains Mono)이 로드된 뒤에 그린다(waitCardFonts). 이미지는 내 기기에만 두고 서버에 올리지 않는다.
import { config } from '../config';
import type { CardSpec } from './share-card';

export interface CardTheme {
  paper: string;
  paperRaised: string;
  ink: string;
  inkMuted: string;
  line: string;
  lineStrong: string;
  accent: string;
  accentTint: string;
  codeBg: string;
  codeText: string;
  codeComment: string;
  fontUi: string;
  fontCode: string;
  padX: number;
  padY: number;
  badge: number;
  title: number;
  sub: number;
  output: number;
  outputLh: number;
  outputRadius: number;
  foot: number;
}

/** 토큰 CSS 변수 → 카드 색·크기 */
export function readCardTheme(el: Element = document.documentElement): CardTheme {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const n = (name: string) => parseFloat(v(name));
  return {
    paper: v('--paper'),
    paperRaised: v('--paper-raised'),
    ink: v('--ink'),
    inkMuted: v('--ink-muted'),
    line: v('--line'),
    lineStrong: v('--line-strong'),
    accent: v('--accent'),
    accentTint: v('--accent-tint'),
    codeBg: v('--code-bg'),
    codeText: v('--code-text'),
    codeComment: v('--code-comment'),
    fontUi: v('--font-ui'),
    fontCode: v('--font-code'),
    padX: n('--share-card-pad-x'),
    padY: n('--share-card-pad-y'),
    badge: n('--share-card-badge'),
    title: n('--share-card-title'),
    sub: n('--share-card-sub'),
    output: n('--share-card-output'),
    outputLh: n('--share-card-output-lh'),
    outputRadius: n('--share-card-output-radius'),
    foot: n('--share-card-foot'),
  };
}

/** 카드에 쓰는 굵기의 글꼴 파일이 다 로드될 때까지 기다린다 */
export async function waitCardFonts(t: CardTheme): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  const want = [`700 ${t.title}px ${t.fontUi}`, `400 ${t.sub}px ${t.fontUi}`, `600 ${t.sub}px ${t.fontUi}`, `400 ${t.output}px ${t.fontCode}`];
  await Promise.all(want.map((f) => fonts.load(f).catch(() => [])));
  await fonts.ready;
}

/** 공백 단위로 줄 바꿈(한국어 keep-all 처럼). 한 낱말이 폭보다 길면 글자 단위로 자른다 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const tryLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(tryLine).width <= maxW) {
      line = tryLine;
      continue;
    }
    if (line) out.push(line);
    if (ctx.measureText(word).width <= maxW) {
      line = word;
      continue;
    }
    let chunk = '';
    for (const ch of [...word]) {
      if (ctx.measureText(chunk + ch).width > maxW && chunk) {
        out.push(chunk);
        chunk = ch;
      } else chunk += ch;
    }
    line = chunk;
  }
  if (line) out.push(line);
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 카드 한 장을 canvas 에 그린다 (canvas 크기 = config.shareCard) */
export function drawCard(canvas: HTMLCanvasElement, spec: CardSpec, t: CardTheme): void {
  const W = config.shareCard.width;
  const H = config.shareCard.height;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d 를 쓸 수 없습니다');
  const font = (w: number, size: number, fam = t.fontUi) => `${w} ${size}px ${fam}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = t.paper;
  ctx.fillRect(0, 0, W, H);

  const x0 = t.padX;
  const innerW = W - 2 * t.padX;
  let y = t.padY;

  // 1 위: 원(✓ 또는 편 번호) + 제목 + 부제
  let tx = x0;
  const titleH = t.title * 1.3;
  const subH = spec.sub ? t.sub * 1.5 : 0;
  const textH = titleH + (spec.sub ? 6 + subH : 0);
  const headH = Math.max(spec.mark ? t.badge : 0, textH);
  if (spec.mark) {
    const r = t.badge / 2;
    const cx = x0 + r;
    const cy = y + headH / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
    ctx.fillStyle = t.accentTint;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = t.accent;
    ctx.stroke();
    if (spec.mark.type === 'check') {
      // 아이콘 IconCheck 와 같은 모양(24 칸 기준 경로를 키움). 글리프에 기대지 않는다
      const s = (t.badge * 0.5) / 24;
      ctx.save();
      ctx.translate(cx - 12 * s, cy - 12 * s);
      ctx.beginPath();
      ctx.moveTo(5 * s, 12.5 * s);
      ctx.lineTo(9.5 * s, 17 * s);
      ctx.lineTo(19 * s, 7.5 * s);
      ctx.lineWidth = 2.6 * s;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = t.accent;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.font = font(700, Math.round(t.badge * 0.34));
      ctx.fillStyle = t.accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.mark.text, cx, cy + 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    }
    tx = x0 + t.badge + 16;
  }
  const ty = y + (headH - textH) / 2;
  ctx.font = font(700, t.title);
  ctx.fillStyle = t.ink;
  ctx.fillText(spec.title, tx, ty + (titleH - t.title) / 2, W - t.padX - tx);
  if (spec.sub) {
    ctx.font = font(400, t.sub);
    ctx.fillStyle = t.inkMuted;
    ctx.fillText(spec.sub, tx, ty + titleH + 6 + (subH - t.sub) / 2, W - t.padX - tx);
  }
  y += headH + 32;

  // 3 아래(먼저 높이를 잰다): 앱 이름 + 출처 줄
  ctx.font = font(400, t.foot);
  const footLines = wrapText(ctx, spec.footText, innerW);
  const footTitleH = t.foot * 1.5;
  const footLineH = t.foot * 1.5;
  const footH = footTitleH + 4 + footLines.length * footLineH;
  const footTop = H - t.padY - footH;

  // 2 가운데 상자
  const boxTop = y;
  const boxH = footTop - 24 - boxTop;
  const pad = { x: 40, y: 28 };
  if (spec.box.type === 'names') {
    ctx.fillStyle = t.codeBg;
    roundRect(ctx, x0, boxTop, innerW, boxH, t.outputRadius);
    ctx.fill();
    let by = boxTop + pad.y;
    ctx.font = font(400, t.sub);
    ctx.fillStyle = t.codeComment;
    ctx.fillText(spec.box.caption, x0 + pad.x, by);
    by += t.sub * 1.4 + 8;
    const footY = boxTop + boxH - pad.y - t.sub * 1.5;
    const rows = Math.max(1, Math.ceil(config.taste.maxNames / 2));
    const areaH = footY - 4 - by;
    const colGap = 48;
    const colW = (innerW - 2 * pad.x - colGap) / 2;
    let size = Math.min(t.output, areaH / (rows * t.outputLh));
    ctx.font = font(400, size, t.fontCode);
    const widest = Math.max(1, ...spec.box.names.map((nm) => ctx.measureText(nm).width));
    if (widest > colW) size = Math.floor((size * colW) / widest);
    ctx.font = font(400, size, t.fontCode);
    ctx.fillStyle = t.codeText;
    spec.box.names.forEach((nm, i) => {
      const col = i < rows ? 0 : 1;
      const row = i % rows;
      ctx.fillText(nm, x0 + pad.x + col * (colW + colGap), by + row * size * t.outputLh + (size * t.outputLh - size) / 2);
    });
    ctx.font = font(400, t.sub);
    ctx.fillStyle = t.codeText;
    ctx.fillText(spec.box.foot, x0 + pad.x, footY + (t.sub * 1.5 - t.sub) / 2);
  } else {
    // 그래프 결과물은 코드 상자 대신 paper-raised 그림 칸 (spec 13.5)
    ctx.fillStyle = t.paperRaised;
    roundRect(ctx, x0, boxTop, innerW, boxH, t.outputRadius);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = t.line;
    ctx.stroke();
    let by = boxTop + pad.y;
    ctx.font = font(400, t.sub);
    ctx.fillStyle = t.inkMuted;
    ctx.fillText(spec.box.caption, x0 + pad.x, by);
    by += t.sub * 1.4 + 12;
    const losses = spec.box.losses;
    ctx.font = font(400, t.sub, t.fontCode);
    const labelW = Math.max(ctx.measureText(spec.box.top).width, ctx.measureText(spec.box.bottom).width);
    const px0 = x0 + pad.x + labelW + 16;
    const px1 = x0 + innerW - pad.x;
    const py0 = by + t.sub / 2;
    const py1 = boxTop + boxH - pad.y - t.sub / 2;
    const yMax = Math.max(...losses);
    const yMin = Math.min(...losses);
    const sx = (i: number) => px0 + (losses.length > 1 ? (i / (losses.length - 1)) * (px1 - px0) : 0);
    const sy = (v: number) => py0 + ((yMax - v) / Math.max(1e-12, yMax - yMin)) * (py1 - py0);
    ctx.strokeStyle = t.lineStrong;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px0, py0);
    ctx.lineTo(px0, py1);
    ctx.lineTo(px1, py1);
    ctx.stroke();
    ctx.fillStyle = t.inkMuted;
    ctx.textAlign = 'right';
    ctx.fillText(spec.box.top, px0 - 12, py0 - t.sub / 2);
    ctx.fillText(spec.box.bottom, px0 - 12, py1 - t.sub / 2);
    ctx.textAlign = 'left';
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    losses.forEach((v, i) => (i === 0 ? ctx.moveTo(sx(i), sy(v)) : ctx.lineTo(sx(i), sy(v))));
    ctx.stroke();
    ctx.fillStyle = t.accent;
    losses.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(sx(i), sy(v), 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 3 아래 그리기
  let fy = footTop;
  ctx.font = font(700, t.foot);
  ctx.fillStyle = t.ink;
  ctx.fillText(spec.footTitle, x0, fy + (footTitleH - t.foot) / 2);
  fy += footTitleH + 4;
  ctx.font = font(400, t.foot);
  ctx.fillStyle = t.inkMuted;
  for (const l of footLines) {
    ctx.fillText(l, x0, fy + (footLineH - t.foot) / 2);
    fy += footLineH;
  }
}

/** canvas → PNG 묶음 */
export function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 를 만들지 못했습니다'))), 'image/png'));
}

/** PNG 를 내 기기에 내려받기만 한다(서버에 올리지 않음) */
export async function savePng(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
  const blob = await canvasPng(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
