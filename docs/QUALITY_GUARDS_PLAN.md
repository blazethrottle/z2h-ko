# 품질 장치 전환 계획 (글 규칙 → 기계 장치)

작성: CTO 몽키, 2026-11-17. 근거: poteto 강연 "All Code Is Slop (Except Mine)"의 신뢰 피라미드.
원칙: CLAUDE.md 11~16의 글 규칙을 하나씩 기계가 막는 장치로 옮긴다. 장치가 생기면 해당 글 규칙은 한 줄 포인터로 줄인다.

## 현재 기준값 (2026-11-17, app/src, main 818fcf1)
- setTimeout 16곳, useEffect 40곳, any(`: any`·`as any`) 112곳, 검사 끄기 주석 0곳, TODO·FIXME 1곳.
- 린트 없음, 타입 검사 명령 없음, CI 없음, 커밋 전 훅은 전역 gitleaks뿐.

## 후보 (우선순위 순)
| 순서 | 장치 | 막는 것 | 비용 | 형태 |
|---|---|---|---|---|
| 1 | 땜질 계수기(ratchet) 스크립트 `scripts/check-debt.mjs`: 위 4개 수가 기준값보다 늘면 실패 | 땜질 번짐 | 작음 | PR, `npm test` 앞에 연결 |
| 2 | 타입 검사 `astro check`(또는 tsc --noEmit)를 build 앞에 | 타입 오류 | 작음 | PR |
| 3 | ESLint 최소 규칙: no-explicit-any(경고→실패), 검사 끄기 주석 금지, 새 setTimeout 제한 | any·검사 끄기 | 중간 | PR |
| 4 | GitHub Actions CI: 공개 저장소라 무료. 1~3 + 단위 테스트 + e2e + gitleaks + 커밋 이메일 Gmail 검사 | 검사 건너뛴 PR | 중간 | PR |
| 5 | main 보호 규칙(공개 저장소라 무료): CI 통과 필수, 직접 push 금지 | main 직접 push | 작음 | 보안 설정이라 얼큰이 승인 뒤 |
| 6 | 기능 지도 docs/FEATURES.md + 각 줄이 실제 e2e 테스트 이름을 가리키는지 검사 | 확인 안 된 기능 | 중간 | PR |
| 7 | 진단·진도 흐름 상태도(statechart) 모델과 경로 테스트 | 복잡한 상태 버그 | 큼 | 1~6 뒤 검토 |

## 진행 방식
- 1·2를 한 PR로 먼저(작고 안전). 그다음 3·4, 5는 승인 질문, 6·7은 P6 비교 리뷰 끝난 뒤.
- 모든 PR은 CTO 검수 후 main 병합은 얼큰이 승인.

## 되돌리기
- 이 문서와 CLAUDE.md 11~16은 커밋 하나라 `git revert <커밋>`으로 되돌린다.
