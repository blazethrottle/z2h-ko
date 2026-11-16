// 인라인 SVG 아이콘 (Pretendard에 ✕ ▾ ⧉ 글리프가 없어서). currentColor, aria-hidden.
import type { JSX } from 'preact';

type P = { size?: number };
const svg = (size: number, children: JSX.Element | JSX.Element[]) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

export const IconCheck = ({ size = 16 }: P) => svg(size, <path d="M5 12.5l4.5 4.5L19 7.5" />);
export const IconCross = ({ size = 16 }: P) => svg(size, [<path key="a" d="M6 6l12 12" />, <path key="b" d="M18 6L6 18" />]);
export const IconSync = ({ size = 16 }: P) =>
  svg(size, [<path key="a" d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />, <path key="b" d="M4 4v4h4" />, <path key="c" d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />, <path key="d" d="M20 20v-4h-4" />]);
export const IconHalf = ({ size = 16 }: P) => svg(size, <path d="M12 4L21 20H3z" />);
export const IconExternal = ({ size = 14 }: P) => svg(size, [<path key="a" d="M7 17L17 7" />, <path key="b" d="M8 7h9v9" />]);
export const IconCopy = ({ size = 16 }: P) => svg(size, [<rect key="a" x="9" y="9" width="11" height="11" rx="2" />, <path key="b" d="M5 15V5a1 1 0 0 1 1-1h10" />]);
export const IconChevron = ({ size = 16, up = false }: P & { up?: boolean }) => svg(size, <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />);
export const IconBack = ({ size = 22 }: P) => svg(size, <path d="M15 5l-7 7 7 7" />);
