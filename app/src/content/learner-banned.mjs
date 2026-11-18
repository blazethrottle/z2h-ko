// 학습자 화면에 내지 않는 말: 설계서·작업 메모(근거 표시, 측정·확인 상태, 승인 절차)와 내부 호칭이 화면에 새는 것을 막는다.
// 랜딩 문구 규칙(landing-banned.mjs: 과장·약속·재촉)과는 목적이 달라 따로 둔다.
// 검사: 빌드 결과의 랜딩·강의 화면(scripts/check-copy.mjs), content/lectures.yaml 화면 칸(tests/unit/learnerCopy.test.mjs), 화면(tests/e2e/guided-copy.spec.ts).
// 낱말 경계: research 는 주소(colab.research.google.com)의 한 조각이면 막지 않고, PM 은 다른 영어 낱말(npm 등) 속이면 막지 않는다.
export const LEARNER_BANNED = [
  { re: /별도\s*승인/, why: '승인 절차 메모' },
  { re: /승인\s*대상/, why: '승인 절차 메모' },
  { re: /승인\s*뒤/, why: '승인 절차 메모' },
  { re: /미측정/, why: '측정 상태 메모' },
  { re: /미확인/, why: '확인 상태 메모' },
  { re: /(?<![A-Za-z0-9./-])research(?![A-Za-z0-9.-])/i, why: '근거 표시 메모(research)' },
  { re: /얼큰이/, why: '내부 호칭' },
  { re: /설계서/, why: '내부 문서 이름' },
  { re: /교사/, why: '내부 역할 이름' },
  { re: /(?<![A-Za-z])PM(?![A-Za-z])/, why: '내부 역할 이름' },
];

/** 글에서 학습자 화면에 내지 않는 말을 찾는다 → [{ why, match }] */
export function findLearnerBanned(text) {
  const out = [];
  for (const b of LEARNER_BANNED) {
    const m = String(text ?? '').match(b.re);
    if (m) out.push({ why: b.why, match: m[0] });
  }
  return out;
}
