// 랜딩 문구 한 곳 (spec 13.1 표, 원본 inputs/pedagogy/VALUE_CURRICULUM.md 1·2·4·5절, 배치 참고 목업 v2_landing).
// 랜딩 문구는 공개 전 승인 항목(D46)이다. 화면 위 "예시 화면 · 문구는 공개 전 승인 대기" 표시를 유지하고, 승인 뒤 바꿀 때는 이 파일만 고친다.
// 숫자 규칙(D28): 편별 시간·단계 수·문항 수만 쓴다. 사용자 수·후기·완주율·로고는 넣지 않는다.
//   - 편별 단계 수와 전체 단계 수는 여기 적지 않고 빌드 때 inputs/pedagogy/video-segments.json 에서 센다.
//   - 편별 예상 시간과 누적 점검(범위·문항 구성)도 여기 적지 않는다: 홈과 같은 출처 content/lectures.yaml(docs/CURRICULUM.md 에서 옮김)에서
//     빌드 때 채운다(src/lib/landingPath.ts). 사전 기초 시간은 정본 F.json 단위 예상 분의 합. 시간은 설계서 추정이라 "추정"을 단다.
// 피해야 할 말(VALUE 5절)은 옆 파일 landing-banned.mjs. 빌드 결과(dist)를 그 목록으로 검사한다(scripts/check-copy.mjs).

export const LANDING = {
  sample: { label: '예시 화면', note: '문구는 공개 전 승인 대기' },
  topbar: { home: '학습 홈', taste: '30분 맛보기 시작' },

  // 1 첫 화면 (VALUE 1절 과정 전체 약속, 5절 근거 있는 말)
  hero: {
    promise: 'ChatGPT 같은 AI가 속에서 어떻게 배우고 글을 만드는지, 한 줄씩 직접 만들어 보며 이해합니다',
    lead: '코드를 처음 보는 사람을 위해 설계했습니다. Andrej Karpathy의 공개 강의 "Neural Networks: Zero to Hero" 10편을 따라 하는 한국어 실습 가이드이고, 모든 코드 줄에 한국어 풀이가 붙습니다.',
    primary: '30분 맛보기 시작',
    secondary: '학습 홈',
    secondaryNote: '로그인과 가입은 준비 중입니다.',
    // VALUE 1절 맛보기 약속 + 5절 권고("목표 30분")
    caption: '목표 30분 만에 내 컴퓨터가 처음 보는 이름을 지어내는 것을 직접 봅니다. 가입 없이, 설치 없이 무료 Colab에서.',
    // 맛보기 T-S05 코드 4줄 + 줄별 풀이: 글은 taster.json 에서 그대로 읽는다(줄 번호는 1부터)
    code: { step_id: 'T-S05', lines: [1, 7, 10, 11], label: '맛보기 코드 예시 · 세기만으로 이름 짓기' },
  },

  // 2 끝내면 얻는 것 (VALUE 2절 단계 배지 4장, D47)
  gains: {
    title: '끝내면 얻는 것',
    lead: '단계마다 직접 만든 결과물이 남습니다. 배지는 앱 안의 학습 기록이며 자격증이 아닙니다.',
    outputsLabel: '공유할 수 있는 결과물',
    badges: [
      { no: 0, name: '첫 셀 완주', rule: '맛보기 + 00 · 기초 15단위 익힘 + 종합 과제', outputs: ['맛보기에서 내 모델이 지은 이름 10개'] },
      { no: 1, name: '언어 모델 견습', rule: '01~03 · 누적 점검 1 통과', outputs: ['내 모델이 지은 이름 20개', '내 손실 곡선', '글자 임베딩 지도'] },
      { no: 2, name: '신경망 정비사', rule: '04~06 · 누적 점검 2 통과', outputs: ['고치기 전후 진단 그래프', '내 WaveNet 검증 손실과 영상 기준 비교'] },
      { no: 3, name: 'GPT 제작자 (수료)', rule: '07~10 · 누적 점검 3 통과', outputs: ['내 GPT가 쓴 셰익스피어 흉내 글', '내 토크나이저가 내 문장을 자른 그림', '축소판 GPT-2 결과 보고 카드'] },
    ],
    // D20: 10편 축소판 안내 한 줄 (버튼·결제 안내 없음)
    note: '10편은 GPT-2와 같은 구조를 작게 줄여 전 과정을 체험합니다. 원본 규모 재현은 유료 GPU가 필요해 넣지 않았습니다.',
  },

  // 3 이런 분께 (VALUE 4절)
  audience: {
    title: '이런 분께 맞습니다',
    pathLabel: '추천 길',
    timeLabel: '시간',
    items: [
      {
        name: 'AI를 업무에 쓰는 회사원',
        message: '"매일 쓰는 AI, 속을 한 번 직접 만들어 보면 쓰는 법이 달라집니다."',
        path: '맛보기 → 00 → 01 → 02 → 07 → 08 → 09',
        time: '약 40~60시간 · 주 4시간이면 약 3~4개월',
      },
      {
        name: 'AI 산업을 판단해야 하는 투자자·경영자',
        message: '"AI 발표의 숫자를, 직접 돌려 본 사람의 눈으로 읽습니다."',
        path: '맛보기 → 08 → 00 → 01 → 02 → 07 → 10',
        time: '약 35~55시간 · 주 3시간이면 약 3~5개월',
      },
      {
        name: '입문 개발자',
        message: '"라이브러리 뒤에 숨은 신경망을, 빈 노트북에서 직접 만들어 봅니다."',
        path: '맛보기(선택) → 00 → 01~10 전부',
        time: '약 80~120시간 · 주 6시간이면 약 3~5개월',
      },
    ],
    note: '시간은 편별 예상 시간을 더한 값입니다. 길에 없는 편도 언제든 열 수 있습니다.',
  },

  // 4 수료까지의 길 (편별 한 줄 약속은 VALUE 1절을 줄인 것. 시간·단계 수·점검 구성은 빌드 때 채움)
  path: {
    title: '수료까지의 길',
    /** {lectures}편, {steps}단계, {checks}번은 빌드 때 채운다 */
    lead: '사전 기초와 {lectures}편, {steps}단계, 누적 점검 {checks}번. 몇 달에 걸쳐 직접 만들며 이해합니다.',
    rows: [
      { mark: '00', basics: true, name: '사전 기초', promise: '셀을 실행하고 에러를 읽는 법, 최소한의 수학(기울기, 행렬, 확률)을 숫자와 그림으로 익힙니다' },
      { mark: '01', lecture_id: 'L01', name: 'micrograd', promise: 'AI가 스스로 배우는 원리(역전파)를 작은 계산 엔진으로 직접 만들어 봅니다' },
      { mark: '02', lecture_id: 'L02', name: 'makemore 1', promise: '글자 짝을 세는 가장 단순한 언어 모델로 내 컴퓨터가 새 이름을 지어내게 합니다' },
      { mark: '03', lecture_id: 'L03', name: 'makemore 2', promise: '작은 신경망으로 더 그럴듯한 이름을 만들고, 모델 성적을 공정하게 재는 법을 익힙니다' },
      // {range}: 그 점검이 덮는 편(lectures.yaml checkpoints.covers)을 빌드 때 채운다
      { mark: 'CP1', checkpoint_id: 'CP1', checkpoint: true, name: '누적 점검 1', promise: '{range}을 한 번에 꺼내 봅니다' },
      { mark: '04', lecture_id: 'L04', name: 'BatchNorm', promise: '신경망이 잘 배우고 있는지 그래프로 건강 검진하는 법을 배웁니다' },
      { mark: '05', lecture_id: 'L05', name: 'Backprop Ninja', promise: '역전파를 손으로 끝까지 계산해 학습이 어떻게 흐르는지 확인합니다' },
      { mark: '06', lecture_id: 'L06', name: 'WaveNet', promise: '층을 나무처럼 쌓아 더 긴 문맥을 보는 모델을 만듭니다' },
      { mark: 'CP2', checkpoint_id: 'CP2', checkpoint: true, name: '누적 점검 2', promise: '{range}을 한 번에 꺼내 봅니다' },
      { mark: '07', lecture_id: 'L07', name: 'GPT 만들기', promise: 'ChatGPT의 뼈대인 트랜스포머를 직접 만들어 셰익스피어 흉내 글을 쓰게 합니다' },
      { mark: '08', lecture_id: 'L08', name: 'State of GPT', promise: 'AI 비서가 어떤 단계로 만들어지는지, 왜 어떤 질문 방식이 더 잘 통하는지 이해합니다' },
      { mark: '09', lecture_id: 'L09', name: '토크나이저', promise: '글을 토큰으로 나누는 도구를 만들어, 한국어가 더 비싸고 AI가 철자에 약한 이유를 설명합니다' },
      { mark: '10', lecture_id: 'L10', name: 'GPT-2 축소판', promise: 'GPT-2와 같은 구조를 만들고, 작게 줄인 판으로 학습 전 과정을 처음부터 끝까지 경험합니다' },
      { mark: 'CP3', checkpoint_id: 'CP3', checkpoint: true, name: '누적 점검 3', promise: '{range}을 한 번에 꺼내 봅니다. 통과하면 수료입니다' },
    ],
  },

  // 5 코드를 처음 봐도 따라갈 수 있게 (VALUE 5절 근거 있는 말 6개)
  support: {
    title: '코드를 처음 봐도 따라갈 수 있게',
    cards: [
      { title: '모든 코드 줄에 한국어 풀이', body: '줄마다 쉬운 말 설명이 옆에 붙습니다.' },
      { title: '4단계 힌트', body: '질문 힌트부터 정답 풀이까지, 필요한 만큼만 하나씩 엽니다.' },
      { title: '어려운 곳은 잘게', body: '한 단계에 새 개념 하나. 어려운 편은 단계를 더 잘게 나눴습니다.' },
      { title: '필요한 수학은 기초 모듈에서', body: '기울기, 행렬, 확률을 숫자와 그림으로. 진단 5문제로 시작점을 추천합니다.' },
      { title: '잊기 전에 다시 꺼내 보는 간격 복습', body: '틀린 문제와 핵심 개념이 1·3·7·14·30일 간격으로 돌아옵니다.' },
      { title: '공식 YouTube 영상을 구간별로', body: '앱 안에서 필요한 구간만 봅니다. 실습은 무료 Colab 또는 내 맥에서.' },
    ],
  },

  // 6 끝 CTA
  end: {
    title: '먼저 30분만 해 보세요',
    body: '이름 3만 2천 개를 읽은 내 컴퓨터가 새 이름을 지어냅니다. 코드는 복사해 실행만 하고, 풀이를 읽기만 하면 됩니다.',
  },

  // 7 바닥 (약관 본문 없음, X5: 자리만)
  footer: {
    text: 'Andrej Karpathy의 공개 강의를 따라 하는 비공식 학습 가이드입니다. 강의 저자와 관계나 보증이 없습니다. 영상은 공식 YouTube 플레이어로만 보여 주고 다시 올리지 않습니다. 원본 코드는 각 저장소의 라이선스를 따릅니다.',
    legal: '이용약관 · 개인정보 처리방침 (준비 중)',
  },
};

/** 문구 파일 안의 모든 글 (검사용) */
export function* landingStrings(v = LANDING, at = 'LANDING') {
  if (typeof v === 'string') yield [at, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* landingStrings(v[i], `${at}[${i}]`);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* landingStrings(x, `${at}.${k}`);
}
