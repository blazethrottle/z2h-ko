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
};

/** 편별 학생용 노트북 경로(저장소 기준). 교사 JSON 에는 노트북 칸이 없어 여기 둔다. 파일이 없으면 화면에 "노트북 준비 중" */
export const NOTEBOOKS = {
  L01: { student: 'notebooks/ep01-micrograd/ep01_student.ipynb' },
};
