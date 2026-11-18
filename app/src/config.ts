// 앱 설정 한 곳 (DESIGN.md 12.6절). 바꿀 때는 이 파일만 고친다.
// 콘텐츠 검사용 설정(영상 없는 단계 목록, 노트북 경로, 금칙어 정본 경로)은 src/content-config.mjs. 배지·도장 규칙은 src/badge-rules.ts.
// 개발 서버·진도 서버 주소와 포트(node 쪽: dev 프록시, 자동 검사)는 src/lib/api-target.mjs.
// 공개 전환 때 브라우저 쪽에서 바꿀 값(API 주소, 저장소 이름, 로그인 길별 화면)은 이 파일의 api·storage·auth 에 모여 있다.

export type CheckpointLock = 'recommend' | 'lock';

/**
 * 서버가 알려 주는 로그인 길(server/API.md 1절 auth_provider). 아래 config.auth.screens 의 열쇠와 같다.
 * 일반 로그인(email_otp·google, 공개 승인 뒤)을 넣을 때: 이 목록과 screens 에 행을 더하고, 그 행의 part 부품을 SettingsApp 에 더한다.
 */
export type AuthProvider = 'dev_local' | 'tailscale';

/** 설정 계정 칸에 그리는 부품 이름 (SettingsApp.tsx 의 ACCOUNT_PARTS) */
export type AccountPart = 'dev_accounts' | 'link_on_mac';

/** 로그인 길 하나가 화면에 보이는 것 */
export interface AuthScreen {
  /** 설정 계정 칸 제목 옆 꼬리표. null 이면 없음 */
  tag: string | null;
  /** 설정 계정 칸의 부품 */
  part: AccountPart;
  /** 계정이 없을 때(401) 앱이 개발용 로그인(목록에서 고르기, 없으면 만들기)을 해 보는가 */
  devLogin: boolean;
  /** 로그인된 상태의 안내 한 줄 (part 가 그린다) */
  signedIn: string | null;
  /** 계정 없음(기록 API 401): 상단 동기화 표시와 설정 동기화 칸의 글 */
  needAccountLabel: string;
  /** 계정 없음: 설정 계정 칸 안내와 덧붙임 (part 가 그린다) */
  needAccount: string | null;
  needAccountCaption: string | null;
  /** 계정 칸 맨 아래 한 줄 */
  footnote: string | null;
}

export interface AppConfig {
  /** 진도 서버 API. 앱과 같은 출처의 상대 주소를 쓴다(공개 전환 때 다른 출처로 옮기면 base·credentials 와 서버 CORS·쿠키를 함께 바꾼다) */
  api: { base: string; credentials: RequestCredentials };
  /** 이 기기 저장소 이름(localStorage 열쇠, IndexedDB 이름). 바꾸면 이미 저장된 기록을 못 읽으니 옮기는 코드와 함께 바꾼다 */
  storage: {
    accountKey: string;
    clientIdKey: string;
    /** 영상 접힘 기억 열쇠 머리말 (+ .{context}.{desktop|mobile}) */
    videoCollapsedPrefix: string;
    /** 계정을 정하기 전 기록을 두는 IndexedDB */
    pendingDb: string;
    /** 계정별 IndexedDB 이름 머리말 (+ user_id) */
    accountDbPrefix: string;
  };
  /** 로그인 길별 화면. auth_provider 칸이 없거나 표에 없는 값(옛 서버, "none")이면 fallback 행 */
  auth: { fallback: AuthProvider; screens: Record<AuthProvider, AuthScreen> };
  /** C5 누적 점검: lock(통과해야 다음 편) | recommend(권고만, 기본: 얼큰이 결정 "잠금 없음, 추천만", P7). 앱은 어느 쪽이든 잠그지 않고 홈 안내 글만 바뀐다 */
  checkpointLock: CheckpointLock;
  /**
   * Colab 바로 열기(2026-11-18 결정: 실행 장소 Colab 고정): 공개 저장소의 커밋 하나에 고정한 노트북을 연다.
   * 브랜치 이름(main)을 가리키면 학습 중인 노트북이 예고 없이 바뀌므로 커밋을 쓴다. 노트북을 고쳐 내보낼 때 이 커밋을 새 커밋으로 바꾼다
   */
  colab: { repo: string; commit: string };
  /** 붙여넣기 비교의 숫자 허용 오차. 단계의 tolerance가 우선 */
  numericTolerance: { rel: number; abs: number };
  /** 익힘 판정 문제 점수 문턱. 콘텐츠 mastery_rule.question_score_ratio 가 있으면 그것이 우선 */
  questionScoreRatio: number;
  /** 동기화 재시도 간격(연결 복구 때는 즉시) */
  retryDelaysMs: number[];
  /** "동기화 중" 표시는 이 시간보다 오래 걸릴 때만 */
  syncingIndicatorDelayMs: number;
  syncBatchSize: number;
  /** 요청 하나의 시간 한도. 응답 본문(오류 본문 포함)을 다 읽을 때까지 */
  requestTimeoutMs: number;
  /** 페이지를 열 때의 첫 받기를 기다리는 상한. 넘으면 그 동기화를 버리고 오프라인으로 보고 이 기기 사본에 먼저 쓴다(DESIGN.md 2절) */
  firstPullMaxMs: number;
  /** "마치기"·"건너뛰기" 저장 한 번의 상한. 넘으면 안내 한 줄과 다시 누르기(첫 받기 상한보다 길게) */
  saveMaxMs: number;
  /** 실습 시간: 마지막 입력 뒤 이 시간이 지나면 세지 않음 */
  idleLimitMs: number;
  activityFlushMs: number;
  /** 영상이 이 시간 안에 안 뜨면 오류 상태 */
  videoLoadTimeoutMs: number;
  /** 공유 카드 (spec 13.5). 크기는 D56 1200 × 675 (교사 정본 taster.json format.image 도 "PNG 1200 × 675", 2026-11-17 확정) */
  shareCard: {
    width: number;
    height: number;
    /** 카드 아래 앱 이름과 짧은 이름(글 복사) */
    appName: string;
    appShort: string;
    /** 학습 기록 카드: 손실 줄을 이만큼까지만 받는다 */
    maxLossPoints: number;
  };
  /** 화면 부품이 이 시간 안에 켜지지(마운트) 않으면 "화면을 불러오지 못했습니다" 한 줄 (Base.astro) */
  gateTimeoutMs: number;
  /** 새 개발 계정의 기본 이름 */
  devAccountName: string;
  /** 30분 맛보기 (spec 13.2, taster.md 4절) */
  taste: TasteConfig;
}

export interface TasteConfig {
  /** 이 기기가 처음 정하는 시도 번호(taster_result.attempt_no, 1부터) */
  firstAttemptNo: number;
  /** 셀이 이 줄 수보다 길면 앞부분을 접는다("앞부분 10줄 보기") */
  longCellLines: number;
  foldHeadLines: number;
  /** "보여야 하는 것"이 길면 앞 3줄 + … + 끝 2줄 */
  outputHeadLines: number;
  outputTailLines: number;
  /** 이름 붙여 넣기 정리: 최대 줄 수, 한 이름 최대 글자 수(넘는 줄은 a~z 밖 줄처럼 저장·카드에서 뺀다) */
  maxNames: number;
  maxNameChars: number;
  // 카드에서 뺄 이름(금칙어)은 여기 두지 않는다. 교사 정본 inputs/pedagogy/content/taster_blocklist.json 을 빌드 때 읽는다
  // (src/content-config.mjs TASTER.blocklistFile, 규칙은 src/lib/name-filter.mjs)
}

const FOOTNOTE_LATER_LOGIN = '이메일·Google 로그인은 공개 승인 뒤에 넣습니다.';

export const config: AppConfig = {
  api: { base: '/api', credentials: 'same-origin' },
  storage: {
    accountKey: 'z2h.account',
    clientIdKey: 'z2h.client_id',
    videoCollapsedPrefix: 'z2h.video.collapsed',
    pendingDb: 'z2h-pending',
    accountDbPrefix: 'z2h-u-',
  },
  auth: {
    fallback: 'dev_local',
    screens: {
      // 맥미니(127.0.0.1)의 개발용 로그인. 옛 서버(칸 없음)와 로그인 수단이 꺼진 서버("none")도 이 행
      dev_local: {
        tag: '개발용',
        part: 'dev_accounts',
        devLogin: true,
        signedIn: null,
        needAccountLabel: '계정을 골라 주세요',
        needAccount: null,
        needAccountCaption: null,
        footnote: FOOTNOTE_LATER_LOGIN,
      },
      // 폰에서 Tailscale serve 로 연 화면. 로그인은 서버가 접속자 정보로 정하고, 이어 주는 일은 맥미니에서 명령으로만 한다
      tailscale: {
        tag: null,
        part: 'link_on_mac',
        devLogin: false,
        signedIn: 'Tailscale 계정으로 접속 중입니다. 진도는 맥미니의 같은 학습 계정에 저장됩니다.',
        needAccountLabel: '계정 연결 필요',
        needAccount: '이 Tailscale 계정은 아직 학습 계정에 이어져 있지 않습니다. 맥미니에서 연결한 뒤 새로 고침해 주세요.',
        needAccountCaption: '그동안 한 학습은 이 기기에 먼저 저장해 둡니다. 연결한 뒤 새로 고침하면 그 학습 계정으로 올라갑니다.',
        footnote: FOOTNOTE_LATER_LOGIN,
      },
      // email_otp·google: 공개 승인 뒤. 여기에 행을 더하고(AuthProvider 에도), part 에 새 부품 이름(예: 'email_form')을 주고
      // SettingsApp.tsx ACCOUNT_PARTS 에 그 부품을 더한다. 만들기 전까지 서버가 그 값을 보내도 fallback 행으로 보인다.
    },
  },
  checkpointLock: 'recommend',
  colab: { repo: 'blazethrottle/z2h-ko', commit: 'cfc179e5dd4928f52a0b99ceca3af8d47c50ef49' },
  numericTolerance: { rel: 1e-4, abs: 0 },
  questionScoreRatio: 0.8,
  retryDelaysMs: [30_000, 60_000, 300_000],
  syncingIndicatorDelayMs: 1_000,
  syncBatchSize: 200,
  requestTimeoutMs: 15_000,
  firstPullMaxMs: 5_000,
  saveMaxMs: 8_000,
  idleLimitMs: 5 * 60_000,
  activityFlushMs: 15_000,
  videoLoadTimeoutMs: 10_000,
  shareCard: { width: 1200, height: 675, appName: 'Z2H 제로 투 히어로 실습', appShort: 'Z2H', maxLossPoints: 200 },
  gateTimeoutMs: 10_000,
  devAccountName: '개발용 계정',
  taste: {
    firstAttemptNo: 1,
    longCellLines: 12,
    foldHeadLines: 10,
    outputHeadLines: 3,
    outputTailLines: 2,
    maxNames: 10,
    maxNameChars: 20,
  },
};

/** 저장소 노트북(예 notebooks/taster/taster.ipynb)을 config.colab 커밋에 고정해 Colab 에서 여는 주소. 저장소 notebooks/ 안 .ipynb 만 */
export function colabOpenUrl(notebookPath: string): string {
  if (!/^notebooks\/(?:[\w-][\w.-]*\/)*[\w-][\w.-]*\.ipynb$/.test(notebookPath) || notebookPath.split('/').includes('..'))
    throw new Error(`Colab 으로 열 수 있는 노트북 경로가 아닙니다: ${notebookPath}`);
  return `https://colab.research.google.com/github/${config.colab.repo}/blob/${config.colab.commit}/${notebookPath}`;
}

/** 로그인 길 → 화면 행. 모르는 값·null 은 fallback 행 */
export function authScreen(provider: AuthProvider | null | undefined): AuthScreen {
  return (provider && config.auth.screens[provider]) || config.auth.screens[config.auth.fallback];
}

/** 표에 있는 로그인 길 이름인가 (서버가 보낸 auth_provider 를 받을 때) */
export function isAuthProvider(v: unknown): v is AuthProvider {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(config.auth.screens, v);
}
