# Z2H 디자인 토큰 v1

기계용 원본: `tokens.json`. 이 문서는 사람용 설명이다. 컴포넌트 명세에는 토큰 이름만 쓴다.

## 1. 색 (기본 2 + 강조 1 + 의미 1쌍 + 코드)

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `paper` | #F6F1E7 | **기본색 1.** 앱 배경, 따뜻한 종이 |
| `paper-raised` | #FFFCF5 | 카드, 입력칸 바탕 |
| `paper-sunken` | #EFE9DC | 예상 출력 상자, 인라인 코드, 진행 막대 바탕 |
| `ink` | #1E2430 | **기본색 2.** 본문 글자 |
| `ink-muted` | #565C68 | 보조 글자 |
| `line` | #DAD2C2 | 장식용 구분선만 |
| `line-strong` | #857C6A | 입력칸·선택지·보조 버튼 테두리 |
| `accent` | #2C4A96 | **강조 1개.** 현재 단계, 주요 행동 버튼, 링크, 포커스 링 |
| `accent-tint` | #E4E9F5 | 현재 단계 행, 열린 코드 줄 풀이, "다음:" 줄 바탕 |
| `on-accent` | #FFFFFF | accent 위 글자 |
| `correct` / `correct-tint` | #2D6A3A / #E3EFE1 | ✓ 맞음 |
| `retry` / `retry-tint` | #A2382A / #F7E2DC | ✕ 다시 |

규칙
- accent는 "지금 여기 / 이걸 누르세요"에만 쓴다. 한 화면에 accent 채운 버튼은 1개.
- correct/retry는 색만으로 쓰지 않는다. 항상 기호 아이콘(✓/✕) + 글자(맞음/다시)를 함께 둔다.
- `line`은 대비 1.33:1이라 의미 있는 경계(입력칸, 선택지)에 쓰지 않는다. 그런 곳은 `line-strong`.

## 2. 코드 테마 (종이 위에 놓인 어두운 잉크 블록)

| 토큰 | 값 | code-bg 대비 |
|---|---|---|
| `code-bg` | #1C2030 | |
| `code-bg-sel` | #2A3350 | (선택 줄) |
| `code-text` | #E9E5DA | 12.85 |
| `code-comment` | #9BA4B8 | 6.47 (선택 줄 위 4.97) |
| `code-keyword` | #F2B47E | 8.94 |
| `code-string` | #A9D6A0 | 9.87 |
| `code-number` | #C8A9EE | 7.98 |
| `code-lineno` | #8A93A7 | 5.25 (선택 줄에서는 code-text로 바꿈) |

ink 계열 남색 바탕이라 종이 배경과 따로 놀지 않는다. 색은 4가지만 써서 비개발자가 "색이 많아 어지러운" 느낌을 받지 않게 했다.

## 3. 대비 확인 (WCAG 2.2 AA)

계산식: WCAG 상대 휘도. 본문 4.5:1, 큰 글자와 비텍스트 3:1 기준.

| 조합 | 대비 | 판정 |
|---|---|---|
| ink / paper | 13.82 | AA 통과 |
| ink / paper-raised | 15.18 | 통과 |
| ink / paper-sunken | 12.86 | 통과 |
| ink-muted / paper | 5.97 | 통과 |
| ink-muted / paper-raised | 6.56 | 통과 |
| ink-muted / paper-sunken | 5.55 | 통과 |
| ink-muted / correct-tint, retry-tint, accent-tint | 5.66 / 5.39 / 5.52 | 통과 |
| accent / paper | 7.38 | 통과 |
| accent / paper-raised | 8.11 | 통과 |
| on-accent / accent | 8.31 | 통과 |
| accent / accent-tint | 6.84 | 통과 |
| ink / accent-tint | 12.79 | 통과 |
| correct / correct-tint | 5.47 | 통과 |
| retry / retry-tint | 5.38 | 통과 |
| correct / paper-raised | 6.34 | 통과 |
| retry / paper-raised | 6.54 | 통과 |
| line-strong / paper (비텍스트) | 3.67 | 3:1 통과 |
| line-strong / paper-raised (비텍스트) | 4.03 | 3:1 통과 |
| line / paper | 1.33 | 장식 전용 (의미 경계 금지) |
| code 색 7종 / code-bg | 4.97 ~ 12.85 | 모두 4.5 이상 |

## 4. 글꼴

**UI: Pretendard 1.3.9** (목업은 상자 시스템 글꼴이 아니라 `@font-face`로 직접 연결한 파일로 렌더링)

| 굵기 | 운영용 파일 (자체 호스팅) | 목업에 쓴 파일 |
|---|---|---|
| 400 | `Pretendard-Regular.woff2` | `mockups/fonts/Pretendard-Regular.otf` |
| 500 | `Pretendard-Medium.woff2` | `Pretendard-Medium.otf` |
| 600 | `Pretendard-SemiBold.woff2` | `Pretendard-SemiBold.otf` |
| 700 | `Pretendard-Bold.woff2` | `Pretendard-Bold.otf` |

운영은 Pretendard 공식 배포의 `web/static/woff2/` 4개 파일을 쓴다. 300, 800, 900은 쓰지 않으니 넣지 않는다. 굵기마다 다른 파일이 연결돼야 한다 (한 파일을 여러 굵기에 묶으면 600이 400으로 보임).

**코드: JetBrains Mono** (가변 글꼴 1개, 400과 600만 사용)

고른 이유
1. `0/O`, `1/l/I`, `{}/()` 구분이 뚜렷해, 코드를 못 읽는 사람이 화면을 보고 그대로 옮겨 칠 때 틀릴 일이 적다.
2. 글자 높이가 커서 14px에서도 읽힌다. 모바일 13.5px 유지 가능.
3. 가변 파일 1개(약 190KB, woff2는 더 작음)로 끝나고 OFL 라이선스.
4. D2Coding은 한글이 들어 있는 장점이 있지만, 이 앱은 한글 풀이를 코드 옆 칸에 Pretendard로 따로 쓰므로 코드 안 한글이 거의 없다. 코드 안 한글 주석이 생기면 `font-code` 대체 순서에서 D2Coding → Pretendard가 받는다.
5. 합자(ligature)는 끈다 (`font-variant-ligatures: none`). `!=`가 `≠`처럼 보이면 비개발자가 그대로 칠 수 없다.

**숫자**: 진도·시간·타임스탬프·"단계 4 / 16"에는 `font-variant-numeric: tabular-nums`.

## 5. 글자 크기

| 토큰 | 모바일 | 데스크톱 | 줄 간격 | 굵기 | 쓰임 |
|---|---|---|---|---|---|
| `display` | 44 | 44 | 1.1 | 700 | 진도 큰 숫자 |
| `title-1` | 24 | 26 | 1.35 | 700 | 화면 제목 |
| `title-2` | 20 | 21 | 1.4 | 700 | 구역 제목 |
| `title-3` | 17 | 18 | 1.45 | 600 | 카드 제목 |
| `body` / `body-lg` | 16 | 17 | 1.7 / 1.75 | 400 | 본문, 코드 풀이 |
| `label` | 15 | 15 | 1.4 | 600 | 버튼 |
| `small` | 14 | 14 | 1.55 | 400 | 보조 설명 |
| `caption` | 13 | 13 | 1.5 | 500 | 메타, 배지. 13 미만 금지 |
| `code` | 13.5 | 14 | 1.7 | 400 | 코드 |

한국어는 `word-break: keep-all`로 단어 중간에서 줄이 바뀌지 않게 한다.

## 6. 간격·모서리·크기·분기점

- 간격 `space`: 4, 8, 12, 16, 20, 24, 32, 40, 56 (토큰 1, 2, 3, 4, 5, 6, 8, 10, 14)
- 모서리 `radius`: sm 6, md 10, lg 14, pill 999
- 크기 `size`: touch-min 44, button-h 48, tabbar-h 64, content-max 720, practice-max 1200
- 분기점 `breakpoint`: mobile 0~767, tablet 768~1023, desktop 1024+, wide 1280+. 실습 2단은 1024 이상에서만.
- 움직임 `motion`: 150ms ease-out. `prefers-reduced-motion`이면 0ms. 축하 효과 없음.

## 6-1. v2 추가 (2026-11-16 20:06 지시 반영)

- **새 색 없음.** 배지·공유 카드·랜딩은 기존 `paper`, `paper-raised`, `paper-sunken`, `ink`, `ink-muted`, `accent`, `accent-tint`, `line-strong`, `code-*`, `correct`만 쓴다. 허용된 "강조 1개 추가"는 쓰지 않았다 (배지가 색으로 경쟁하면 차분함이 깨짐).
- 받은 배지 = 2px `accent` 테두리 + `accent-tint` 바탕. 아직 = 2px 점선 `line-strong`, 글자 `ink-muted` (대비 3절 표의 기존 쌍 그대로).
- 글자 `promise`: 랜딩 약속 한 줄 30 / 1024 이상 40, 700, 줄높이 1.35.
- 크기 `size.option-h` 52 (고르기 보기 행), `size.badge` 52 (배지 원).
- `share-card` 묶음: 1200x675, 여백 64/56, 배지 원 56, 제목 30, 설명 20, 출력 40 (JetBrains Mono, 줄높이 1.55, 모서리 18), 바닥 20. 카드 위 글자 대비: `ink`/`paper` 13.82:1, `ink-muted`/`paper` 5.97:1, `code-text`/`code-bg` 12.85:1 (3절 표와 같은 쌍).
- 맛보기 진행 막대: 끝난 칸 `correct`, 지금 `accent`, 남은 칸 `paper-sunken`.

## 7. 토큰 파일 쓰는 법

`tokens.json` → CSS 변수 (`--paper`, `--accent` …) 로 바꿔 `:root`에 넣는다. 목업의 `mockups/src/z2h.css` 첫 부분이 그대로 예시다. Tailwind를 쓰면 `theme.extend.colors`에 같은 이름으로 넣는다.
