// 배지·도장·맛보기 완료 표시 규칙 한 곳 (DESIGN.md 0-1절 D47, 1절 "badge_rules 설정 한 곳", 5절 badge_def).
// 값의 출처: inputs/pedagogy/VALUE_CURRICULUM.md 2절(배지 조건, 공유 원칙), inputs/design/decisions.md D31·D47·D50,
// 교사 정본 inputs/pedagogy/content/L01.json lecture.rewards(STAMP-L01, BADGE-S1 진행), taster.json completion_rule(TASTER-DONE).
// 계산은 src/lib/badges.ts 가 이 파일만 읽어서 한다. 여기에는 정의와 조건만 둔다.
//
// 지키는 것
// - 배지는 기존 "익혔다" 기준과 누적 점검에만 묶는다. 새 기준을 만들지 않는다(VALUE 2절).
// - 연속 기록(스트릭) 배지 없음. 누적 점검 단독 배지 없음(D31·D47). 맛보기 완료는 배지가 아니라 표시(VALUE 2절).
// - 단계 배지는 누적 점검 통과로 받고, 부여 계산은 아직 어디에도 없다(D47 은 checkpoint_attempt 통과 기록으로 주라고 정했고, 서버·앱 중 누가 계산할지는 누적 점검을 만들 때 정한다). 앱은 쓰지 않는다.
//   프로토타입에는 누적 점검 화면이 없으므로 단계 배지는 서버에 행이 생기기 전까지 "아직"으로만 보인다.
// - 앱이 직접 user_badge 행을 쓰는 것은 편 도장(그 편 mastery_state = mastered)과 맛보기 완료 표시뿐이다.

/** 누가 user_badge 행을 쓰는가. app: 이 앱이 조건을 보고 동기화 대기열로 저장 / server: 서버가 계산(D47) / null: 부여 경로 미정 */
export type Awarder = 'app' | 'server' | null;

export type BadgeCondition =
  /** 그 편 mastery_state.state = mastered (VALUE 2절 편 도장, 정본 rewards.stamp.condition) */
  | { type: 'lecture_mastered'; lecture_id: string }
  /** 맛보기 완료 규칙(taster.json completion_rule.requires_steps 를 이 시도에서 모두 "직접 확인했어요") */
  | { type: 'taster_complete'; rule_id: string }
  /** 누적 점검 통과 (D47: CP1 → 언어 모델 견습, CP2 → 신경망 정비사, CP3 → GPT 제작자) */
  | { type: 'checkpoint_passed'; checkpoint_id: string }
  /** 기초 모듈 전체 통과(00-foundations.md "기초 모듈 전체 통과 기준": 15단위 익힘 + 종합 과제 H2 이하) */
  | { type: 'foundations_passed' };

export interface StageBadgeRule {
  badge_id: string;
  /** 단계 번호 0~3 (원 안 글자) */
  no: number;
  name_ko: string;
  /** 받는 조건 (화면 글, VALUE 2절·D47) */
  condition_ko: string;
  condition: BadgeCondition;
  /** 이 단계에 들어가는 편 (남은 것을 사실로만 보일 때 씀) */
  covers: string[];
  awarder: Awarder;
}

/** 맛보기 완료 표시 (배지 아님). badge_id 는 정본 완료 규칙 id 그대로 */
export const TASTE_MARK = {
  badge_id: 'TASTER-DONE',
  name_ko: '맛보기 완료',
  note_ko: '배지가 아닌 완료 표시',
  condition: { type: 'taster_complete', rule_id: 'TASTER-DONE' } as BadgeCondition,
  awarder: 'app' as Awarder,
};

/** 단계 배지 4장 (VALUE 2절 표, D47). 받는 조건 글은 목업 v2_badges·랜딩(LANDING.gains)과 같은 뜻 */
export const STAGE_BADGES: readonly StageBadgeRule[] = [
  {
    badge_id: 'BADGE-S0',
    no: 0,
    name_ko: '첫 셀 완주',
    condition_ko: '기초 15단위 익힘 + 종합 과제 (힌트 2단계 이하)',
    condition: { type: 'foundations_passed' },
    covers: [],
    // 기초 모듈 화면이 아직 없어(프로토타입 범위 밖) 부여 경로를 정하지 않았다
    awarder: null,
  },
  {
    badge_id: 'BADGE-S1',
    no: 1,
    name_ko: '언어 모델 견습',
    condition_ko: '01~03편 · 누적 점검 1 통과',
    condition: { type: 'checkpoint_passed', checkpoint_id: 'CP1' },
    covers: ['L01', 'L02', 'L03'],
    awarder: 'server',
  },
  {
    badge_id: 'BADGE-S2',
    no: 2,
    name_ko: '신경망 정비사',
    condition_ko: '04~06편 · 누적 점검 2 통과',
    condition: { type: 'checkpoint_passed', checkpoint_id: 'CP2' },
    covers: ['L04', 'L05', 'L06'],
    awarder: 'server',
  },
  {
    badge_id: 'BADGE-S3',
    no: 3,
    name_ko: 'GPT 제작자 (수료)',
    condition_ko: '07~10편 · 누적 점검 3 통과',
    condition: { type: 'checkpoint_passed', checkpoint_id: 'CP3' },
    covers: ['L07', 'L08', 'L09', 'L10'],
    awarder: 'server',
  },
];

/** 편 도장 규칙: 편 목록(콘텐츠 lectures.yaml)마다 하나. id 는 정본 rewards.stamp.stamp_id, 없으면 같은 모양으로 */
export const STAMP_RULE = {
  idOf: (lectureId: string, contentStampId?: string | null) => contentStampId || `STAMP-${lectureId}`,
  condition: (lectureId: string): BadgeCondition => ({ type: 'lecture_mastered', lecture_id: lectureId }),
  awarder: 'app' as Awarder,
};

/**
 * 요약 경로 배지 변형 (D50, data-spec 검수 규칙 12, checkpoint.path_variants[].badge_on_pass). 자리만 둔다.
 * - BADGE-S1-SUMMARY: 언어 모델 견습(요약 경로) = L01·L02 익힘 + 03편 다리 카드 6장 + CP1(요약) 통과
 * - BADGE-SUMMARY-DONE: AI 속 들여다보기 수료 = 그 길의 핵심 편 익힘 + 다리 카드 관문 + CP3(요약) 통과
 * 프로토타입은 path_id 가 full 고정이라 계산 코드가 없다(DESIGN.md 0-1절). 화면에도 그리지 않는다.
 */
export type SummaryBadgeId = 'BADGE-S1-SUMMARY' | 'BADGE-SUMMARY-DONE';
export interface SummaryBadgeVariant {
  badge_id: SummaryBadgeId;
  /** 같은 단계의 전체 길 배지. 전체 길에서 같은 단계를 마치면 전체 배지로 바뀐다 */
  full_badge_id: string | null;
  path_ids: ('office_worker' | 'investor')[];
}
