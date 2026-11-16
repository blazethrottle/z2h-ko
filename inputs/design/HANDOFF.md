# Z2H 디자인 → CTO 인계

작성: 디자이너 몽키 · 2026-11-16 KST. 코딩은 CTO 쪽, 이 폴더는 디자인 원본이다. 목업 내용은 모두 예시다.

## 1. 폴더 안내
| 파일 | 내용 |
|---|---|
| `flow.md` | 학습 흐름 mermaid, 화면 목록, 전환 규칙 |
| `tokens.json` | 디자인 토큰 원본 (색, 대비, 글꼴, 글자 크기, 간격, 모서리, 분기점) |
| `tokens.md` | 토큰 설명, WCAG 대비표, 글꼴 파일 목록 |
| `spec.md` | 화면별 컴포넌트, 상태, 문구, 모바일/데스크톱 차이, 접근성 |
| `decisions.md` | 결정과 이유, 열린 질문 |
| `mockups/src/*.html` + `z2h.css` | 목업 HTML. 반응형 하나로 390/1280 둘 다 그림. 구조 참고용 (운영 코드로 그대로 쓰지 말 것) |
| `mockups/png/*_{m390,d1280}.png` | 화면 9종 × 2폭 = 18장 (2배 해상도) |
| `contact_sheet.png` | 한 장 요약 |
| `mockups/font_check.json`, `font_scan.json` | 글꼴 실제 로딩 검사 결과 |

## 2. 만들 순서 (권장)
1. **토큰 + 기본 틀**: `tokens.json` → CSS 변수, Pretendard·JetBrains Mono 자체 호스팅, 상단 바·하단 탭·카드·버튼·다음 줄·결과 상자.
2. **4 따라 하기 실습** (대표 화면, 가장 위험): 코드 줄·풀이 2단/1단 전환, 복사, 실행 장소 칩, 예상 출력, 붙여넣기 비교 규칙 (`spec.md` 4절).
3. **영상 플레이어 컴포넌트** (`spec.md` 0.5): youtube-nocookie 임베드, start/end, 자동 재생 없음, 접기, 불러오는 중·오류·대체 링크.
4. **3 강의 구간**, **6 힌트 사다리** (실습 안 패널).
5. **5 확인 문제** (고르기 즉시 채점, 짧은 답 허용 목록).
6. **1 홈·진도**, **2 강의 개요**, 진도 저장.
7. **7 복습** (간격 반복), **8 사전 기초**.
8. **9 빈·불러오는 중·오류** 상태 전부.

01 micrograd 한 편을 처음부터 끝까지 돌릴 수 있게 만든 뒤 나머지 편으로 넓히는 것을 권장한다.

## 3. 토큰 쓰는 법
- `tokens.json`의 `color.*.*.value`를 같은 이름의 CSS 변수로: `--paper`, `--paper-raised`, `--paper-sunken`, `--ink`, `--ink-muted`, `--line`, `--line-strong`, `--accent`, `--accent-tint`, `--on-accent`, `--correct`, `--correct-tint`, `--retry`, `--retry-tint`, `--code-*`.
- 컴포넌트에서 hex를 직접 쓰지 않는다. 새 색이 필요하면 디자이너에게 요청.
- `type.*`는 모바일 값. 1024 이상에서 `title-1` 26, `title-2` 21, `title-3` 18, 본문 17, 코드 14 (`tokens.md` 5절).
- 숫자 표시 요소에 `font-variant-numeric: tabular-nums`. 코드에 `font-variant-ligatures: none`.
- 한국어 문장에 `word-break: keep-all`.

## 4. 글꼴 (반드시 확인)
- Pretendard 1.3.9 `woff2` 4개: Regular 400, Medium 500, SemiBold 600, Bold 700. **굵기마다 다른 파일을 `@font-face`로 연결.**
- JetBrains Mono 가변 woff2 1개 (`font-weight: 100 800`), 400·600만 사용.
- 배포 뒤 확인: 브라우저 콘솔에서 `[...document.fonts].map(f=>f.family+' '+f.weight+' '+f.status)`가 모두 `loaded`인지. 시스템에 Pretendard가 깔린 맥에서는 스크린샷만 보고 판단하면 안 된다 (CDN이나 파일 경로가 빠져도 정상처럼 보임).
- `button`, `input`, `textarea`, `code`는 글꼴을 상속하지 않는 브라우저 기본값이 있으니 `font-family: inherit` 또는 `var(--font-code)`를 명시. (목업에서 이것 때문에 DejaVu Sans Mono로 그려진 곳이 있었고 고쳤다.)
- 아이콘은 인라인 SVG (Pretendard에 ✕, ▾ 등 글리프 없음).

## 5. 영상 임베드 (2026-11-16 19:43 얼큰이님 결정)
```html
<iframe
  src="https://www.youtube-nocookie.com/embed/{videoId}?start=1149&end=1930&rel=0&playsinline=1"
  title="영상 19:09–32:10: Value 상자 만들기"
  loading="lazy"
  allow="encrypted-media; picture-in-picture; fullscreen"
  referrerpolicy="strict-origin-when-cross-origin"
  style="aspect-ratio:16/9;width:100%;border:0"></iframe>
```
- `autoplay` 매개변수와 `allow="autoplay"`를 넣지 않는다. IFrame API를 써도 `playVideo()`를 자동 호출하지 않는다.
- 대체 링크: `https://www.youtube.com/watch?v={videoId}&t={start}s`, 새 창. 늘 보이게 둔다 (오류 상태에서는 큰 버튼으로 바뀜).
- 오류 판정: 10초 안에 로드 없음, 또는 IFrame API `onError`. 
- 시각(start/end, 초)은 단계 데이터에서 받는다. 목업의 19:09–32:10은 예시 (01 micrograd 영상 id는 리서치 몽키가 확정).
- 영상 파일을 내려받거나 다시 올리지 않는다.

## 6. 단계 데이터에 필요한 필드 (디자인 기준)
`lectureId`, `stepNo`, `stepCount`, `title`, `purpose`(한 문장), `video{id,start,end}`, `summary[3]`, `concepts[{term,plain}]`, `code[{line,explain}]`, `expectedOutput`, `outputVaries`, `tolerance`, `mismatchHints[]`, `hints[3]`, `quiz[]`, `next{title}`. 콘텐츠는 리서치·교사 몽키 산출물에서 채운다.

## 7. 열린 질문 (CTO 관련)
- Q3 실습 시간 세는 방법, Q4 진도 저장 위치 (기기만 / 맥미니 서버) → `decisions.md`.
- 비교 기능에서 숫자 허용 오차를 단계 데이터로 받을지, 기본값(상대 1e-4)을 둘지.
- 노트북 파일 이름 규칙 (목업은 `01_micrograd.ipynb`, 단계 칸 제목 "단계 4").

## 8. 검수 요청
구현 화면이 나오면 디자이너가 390/1280에서 목업과 비교하고, 글꼴 로딩(`document.fonts` + 굵기별 파일), 44px, 대비, em dash 여부를 다시 검사한다.
