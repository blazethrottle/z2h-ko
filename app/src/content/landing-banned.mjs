// 화면에 쓰지 않는 말 (랜딩·맛보기). 원본: inputs/pedagogy/VALUE_CURRICULUM.md 5절 "피해야 할 말", spec 13.1 "쓰지 않는 말",
// decisions D28(가짜 숫자·후기·사용자 수 없음), spec 0.4(재촉·죄책감 문구 없음), 개인 호칭 금지.
// 검사: 문구 파일(tests/unit/landing.test.mjs), 빌드 결과(scripts/check-copy.mjs), 화면(tests/e2e/landing.spec.ts).
// 주의: "배지는 … 자격증이 아닙니다"처럼 부정하는 문장은 허용해야 하므로 단어 하나가 아니라 쓰임새로 막는다.

// 같은 뜻의 변형(조사·띄어쓰기·한글 표기, "한 달 만에" 같은 다른 기간)도 막는다(P2 검수 권고).
// "30분 만에"(맛보기 목표, VALUE 5절 근거 있는 말)는 막지 않는다.
const WHO = String.raw`(?:Andrej\s*)?(?:Karpathy|카파시|카르파티)`;
export const BANNED = [
  { re: /(?:\d+\s*(?:일|주|개월|달)|한\s*달|두\s*달|석\s*달|일주일|한\s*주)\s*(?:만에|안에|이면)/, why: '"30일 만에 AI 엔지니어"·"한 달 만에" 같은 기간 약속 (VALUE 5절)' },
  { re: /보장/, why: '취업·연봉·수익 보장 (VALUE 5절)' },
  {
    re: new RegExp(
      String.raw`${WHO}\s*(?:의|가|이|님|님이|님의|씨가)?\s*(?:공식|추천|인증|보증|감수|직접\s*만든|강력\s*추천)|${WHO}\s*(?:가|이|님이)?\s*(?:만든|제작한)\s*(?:앱|과정|강좌)|공동\s*제작|공식\s*파트너|공식\s*(?:인증|승인)`,
      'i',
    ),
    why: 'Karpathy 공식·추천·공동 제작 (VALUE 5절)',
  },
  { re: /영상\s*(?:을|를|이|가|도|까지)?\s*(?:제공|포함|탑재|수록)/, why: '강의 영상 제공·포함 (VALUE 5절)' },
  { re: /(?:그대로|완벽(?:하게|히)?|똑같이)\s*재현/, why: 'GPT-2를 그대로 재현 (VALUE 5절)' },
  { re: /나만의\s*(?:ChatGPT|챗\s*GPT|챗지피티|챗봇)/i, why: '나만의 ChatGPT (VALUE 5절)' },
  { re: /수학\s*(?:을|은|이|는)?\s*(?:몰라도|없이도|필요\s*없|안\s*해도|못해도)/, why: '수학 몰라도 됨 (VALUE 5절)' },
  { re: /공인\s*자격|인증서|수료증|자격증\s*(?:을|이)?\s*(?:드립|드려|받|발급|취득|인정|따)/, why: '공인 자격증·인증서 (VALUE 5절)' },
  { re: /100\s*%\s*(?:쉬|쉽)|하나도\s*안\s*어려/, why: '100% 쉬움 (VALUE 5절)' },
  { re: /완주율|수강생|후기|별점|만족도|\d[\d,]*\s*명\s*(?:이|의)?\s*(?:수강|사용|함께|선택)/, why: '사용자 수·후기·완주율 (D28)' },
  { re: /스트릭|연속\s*\d+\s*일|\d+\s*일\s*연속|벌써|안\s*하셨|순위|랭킹/, why: '연속 기록·순위·재촉 문구 (spec 0.4)' },
  { re: /얼큰이/, why: '개인 호칭 (전역 규칙)' },
];

/** 글에서 쓰지 않는 말을 찾는다 → [{ why, match }] */
export function findBanned(text) {
  const out = [];
  for (const b of BANNED) {
    const m = String(text ?? '').match(b.re);
    if (m) out.push({ why: b.why, match: m[0] });
  }
  return out;
}
