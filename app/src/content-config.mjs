// 콘텐츠 검사·빌드가 쓰는 설정 한 곳 (앱 설정 config.ts 와 별도: node 스크립트도 읽어야 해서 .mjs)

/** 영상이 없는 단계 (D40·D49·D53). video_segments 가 빈 목록이어도 되는 단계는 여기 적힌 것뿐이다 */
export const NO_VIDEO_STEPS = ['L08-S01', 'L08-S04', 'L08-S08'];
/** 맛보기 단계 id 머리말(모든 맛보기 단계는 영상 없음) */
export const TASTER_STEP_PREFIX = 'T-S';

export function isNoVideoStep(stepId) {
  return NO_VIDEO_STEPS.includes(stepId) || String(stepId).startsWith(TASTER_STEP_PREFIX);
}

/**
 * 맛보기 (교사 정본, 손으로 고치지 않는다). 강의 콘텐츠 JSON 과 같은 폴더(inputs/pedagogy/content)에 있다.
 * outputsFile: 교사가 실제로 실행한 출력(미리 계산한 결과 화면은 이 값만 쓴다).
 * notebook: 맛보기 노트북(저장소 기준). 있으면 빌드 때 dist/notebooks/taster/ 로 복사, 없으면 화면에 "노트북 준비 중".
 */
export const TASTER = {
  file: 'taster.json',
  /** 맛보기 코드의 원본 저장소(화면 아래 출처 한 줄). 근거: NOTICE.md 표(makemore·nn-zero-to-hero 행, 둘 다 MIT) */
  sourceRepos: ['karpathy/makemore', 'karpathy/nn-zero-to-hero'],
  outputsFile: 'taster_outputs.json',
  notebook: 'notebooks/taster/taster.ipynb',
  publicDir: '/notebooks/taster/',
  /** 이름 카드 금칙어 (교사 정본, 같은 폴더). 빌드 때 읽어 names.txt 와 대조한다(src/lib/name-filter.mjs). 앱 소스에 목록을 옮겨 적지 않는다 */
  blocklistFile: 'taster_blocklist.json',
};

/**
 * 맛보기 학습 데이터 names.txt (karpathy/makemore, MIT. 출처·받은 날은 저장소 NOTICE.md).
 * 금칙어의 허용 규칙(줄 전체가 실제 이름이면 둔다)에 쓴다. 앱에는 3만 개를 싣지 않고, 빌드 때 "실제 이름인데 금칙어에 걸리는 이름"만 뽑아 싣는다.
 */
export const NAMES_TXT = {
  path: 'third_party/makemore/names.txt',
  count: 32033,
};

/**
 * 사전 기초(교사 정본 F.json 하나만 읽는다. 경로는 저장소 기준이고 이 한 곳에서만 정한다). 없으면 콘텐츠 검사가 실패한다(빌드 멈춤).
 * 테스트만 환경 변수 Z2H_BASICS_FILE 로 다른 파일(tests/fixtures/basics/F.json)을 줄 수 있다(1편 Z2H_CONTENT_DIR 과 같은 방식).
 * 화면에 여는 단위: lecture.units[].status 가 written 인 단위. planned 는 목록에 "준비 중"(누를 수 없음, 주소 없음).
 * unitMap: 00-foundations.md "단위 지도" 순서(data-spec 1절 ID 규칙). 진단 추천 단위는 이 순서로 보인다.
 */
export const BASICS = {
  lectureId: 'F',
  file: 'inputs/pedagogy/content/F.json',
  diagnosticUnitId: 'F-DIAG',
  unitMap: ['F-P1', 'F-P2', 'F-P3', 'F-P4', 'F-P5', 'F-P6', 'F-P7', 'F-P8', 'F-P9', 'F-M1', 'F-M2', 'F-M3', 'F-M4', 'F-M5', 'F-M6'],
  /** 정본 lecture.diagnostic 의 약속. 코드는 이 값대로만 동작하고(잠금·건너뛰기·힌트 화면 없음), 정본 값이 다르면 빌드 검사 실패 */
  diagnosticPromises: { recommend_only: true, locks: false, auto_skip: false, uses_hints: false },
  /** 단위 묶음: id 머리말과 목록 제목(spec 8절) */
  groups: [
    { id: 'python', prefix: 'F-P', label_ko: '파이썬 최소' },
    { id: 'math', prefix: 'F-M', label_ko: '수학 최소' },
  ],
  /** expected_check·rebuild check 의 figure(그림 직접 확인) 값 → 안내 문구에 쓰는 이름. 채점에는 쓰지 않는다. 표에 없으면 이름 없이 안내 */
  figureLabels: { parabola: '포물선', cubic: '3차 곡선' },
};

/** 편별 학생용 노트북 경로(저장소 기준). 교사 JSON 에는 노트북 칸이 없어 여기 둔다. 파일이 없으면 화면에 "노트북 준비 중" */
export const NOTEBOOKS = {
  L01: { student: 'notebooks/ep01-micrograd/ep01_student.ipynb' },
};
