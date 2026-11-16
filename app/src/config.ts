// 앱 설정 한 곳 (DESIGN.md 12.6절). 바꿀 때는 이 파일만 고친다.
// 콘텐츠 검사용 설정(영상 없는 단계 목록, 노트북 경로)은 src/content-config.mjs.

export type CheckpointLock = 'recommend' | 'lock';

export interface AppConfig {
  /** C5 누적 점검: lock(통과해야 다음 편, 기본) | recommend(권고만). P1은 1편뿐이라 화면 영향 없음 */
  checkpointLock: CheckpointLock;
  /** Colab 바로 열기 주소. null이면 "Colab에서 열기" 버튼을 숨기고 "노트북 받기 + Colab에 올리기" 안내만 */
  colabOpenUrl: string | null;
  /** 붙여넣기 비교의 숫자 허용 오차. 단계의 tolerance가 우선 */
  numericTolerance: { rel: number; abs: number };
  /** 익힘 판정 문제 점수 문턱. 콘텐츠 mastery_rule.question_score_ratio 가 있으면 그것이 우선 */
  questionScoreRatio: number;
  /** 동기화 재시도 간격(연결 복구 때는 즉시) */
  retryDelaysMs: number[];
  /** "동기화 중" 표시는 이 시간보다 오래 걸릴 때만 */
  syncingIndicatorDelayMs: number;
  syncBatchSize: number;
  requestTimeoutMs: number;
  /** 실습 시간: 마지막 입력 뒤 이 시간이 지나면 세지 않음 */
  idleLimitMs: number;
  activityFlushMs: number;
  /** 영상이 이 시간 안에 안 뜨면 오류 상태 */
  videoLoadTimeoutMs: number;
  /** 공유 카드 크기 (X15 미정, 설정값 한 곳) */
  shareCard: { width: number; height: number };
  /** 배지 규칙 자리 (D47: 단계 배지는 누적 점검 통과로, CP 단독 배지 없음). 계산 코드는 아직 없음 */
  badgeRules: { badge_id: string; name_ko: string; on_pass: string }[];
  /** 새 개발 계정의 기본 이름 */
  devAccountName: string;
  /** 30분 맛보기 (spec 13.2, taster.md 4절) */
  taste: TasteConfig;
}

export interface TasteConfig {
  /** 맛보기 노트북 Colab 바로 열기 주소. null이면 버튼을 숨기고 "노트북 받기 + Colab에 올리기" 안내 (비공개 저장소 기간) */
  colabOpenUrl: string | null;
  /** 이 기기가 처음 정하는 시도 번호(taster_result.attempt_no, 1부터) */
  firstAttemptNo: number;
  /** 셀이 이 줄 수보다 길면 앞부분을 접는다("앞부분 10줄 보기") */
  longCellLines: number;
  foldHeadLines: number;
  /** "보여야 하는 것"이 길면 앞 3줄 + … + 끝 2줄 */
  outputHeadLines: number;
  outputTailLines: number;
  /** 이름 붙여 넣기 정리: 최대 줄 수, 한 이름 최대 글자 수(넘으면 자름) */
  maxNames: number;
  maxNameChars: number;
  /** 카드에서 뺄 이름(금칙어) 목록. 교사·CEO 확정 전이라 비어 있음(taster.md 4절 "앱의 금칙어 목록") */
  blockedNames: string[];
}

export const config: AppConfig = {
  checkpointLock: 'lock',
  colabOpenUrl: null,
  numericTolerance: { rel: 1e-4, abs: 0 },
  questionScoreRatio: 0.8,
  retryDelaysMs: [30_000, 60_000, 300_000],
  syncingIndicatorDelayMs: 1_000,
  syncBatchSize: 200,
  requestTimeoutMs: 15_000,
  idleLimitMs: 5 * 60_000,
  activityFlushMs: 15_000,
  videoLoadTimeoutMs: 10_000,
  shareCard: { width: 1200, height: 675 },
  badgeRules: [
    { badge_id: 'BADGE-S1', name_ko: '언어 모델 견습', on_pass: 'CP1' },
    { badge_id: 'BADGE-S2', name_ko: '신경망 정비사', on_pass: 'CP2' },
    { badge_id: 'BADGE-S3', name_ko: 'GPT 제작자', on_pass: 'CP3' },
  ],
  devAccountName: '개발용 계정',
  taste: {
    colabOpenUrl: null,
    firstAttemptNo: 1,
    longCellLines: 12,
    foldHeadLines: 10,
    outputHeadLines: 3,
    outputTailLines: 2,
    maxNames: 10,
    maxNameChars: 20,
    blockedNames: [],
  },
};
