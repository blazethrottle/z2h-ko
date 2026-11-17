# Z2H 저장소 규칙 (PM과 모든 서브 에이전트 공통)

이 저장소는 Karpathy "Neural Networks: Zero to Hero"를 일반인이 100% 실습하며 익히는 한국어 학습 제품이다. 지금은 프로토타입 우선(랜딩, 첫 30분 맛보기, 1편 micrograd 전 과정, 진도 저장). 2~10편은 뒤로. 설명은 쉬운 한국어.

1. 커밋 메시지·PR 본문에 Co-Authored-By, Claude 꼬리표, Claude 링크를 넣지 않는다.
2. main에 병합·푸시하지 않는다. 마일스톤 브랜치 → PR까지만. 병합은 얼큰이 승인 후 사람이 한다. 강제 푸시, --no-verify, 검사 건너뛰기 금지.
3. 이 저장소 안, 이번 마일스톤 범위 폴더 밖에 쓰지 않는다. ~/.claude/settings.json 등 사용자 설정을 바꾸지 않는다.
4. 비밀값을 파일·로그·출력에 쓰지 않는다. 결제, 로그인, 키 발급, 공개 배포, 저장소 공개 전환, 서버 공개 운영, 유료 서버·DB, 사용량 크레딧 동의가 필요하면 즉시 멈추고 보고한다.
5. 서브 에이전트는 .claude/agents/ 에 정의된 이름으로만 부른다. fork 금지. 서브 호출 때 model·effort 인자를 넘기지 않는다(서브는 Opus 5.5 xhigh 고정).
6. 영상은 youtube-nocookie 공식 embed(`https://www.youtube-nocookie.com/embed/{videoId}?start={초}`)와 링크만. 모든 단계에 videoId+start(초) 필수. 영상 파일·자막 전문을 넣지 않는다.
7. 원본 코드: micrograd, makemore, nn-zero-to-hero, nanoGPT, minbpe는 MIT, 파일 머리에 출처 한 줄 + third_party/licenses/ 에 LICENSE 전문. build-nanogpt는 라이선스 표기가 없으니 코드 복사 없이 링크만. docs/PUBLIC_RELEASE_CHECKLIST.md 를 처음부터 지킨다.
8. 마일스톤 PR 본문은 "한 일 / 테스트 결과 / 맥 실행 로그 요약 / 남은 일"을 쉬운 한국어로. 모르는 것은 추측하지 말고 "미확인"으로 적는다.

9. 네트워크·보안 설정(Cloudflare Tunnel, Access 정책, 방화벽, 포트 개방, DNS)은 바꾸지 않는다. 설계와 스크립트 초안까지만. 실행은 CTO가 CEO에 사전 통보한 뒤. 서버는 127.0.0.1에만 바인드.
10. 입력 자료 우선순위: 화면은 inputs/design/HANDOFF.md 최우선, 학습 내용·진도 필드는 inputs/pedagogy(data-spec.md), 영상 구간·원본 대조는 inputs/research. docs/DESIGN.md의 '얼큰이 결정' 절이 모든 것보다 우선.

실습 환경: 사용자 기본은 Colab 열기, 로컬 Jupyter는 선택. 맥 검증용은 저장소 안 .venv (시스템 파이썬에 설치 금지).
데이터: 모든 학습 기록에 user_id, 저장 계층은 StorageAdapter 뒤, 스키마는 Alembic 마이그레이션으로만.

## 코드 품질 원칙 (2026-11-17 얼큰이 지시, poteto 강연 "All Code Is Slop (Except Mine)")

11. 믿을 순서: 구조 설계 > 기계 검사(타입·테스트·검사 스크립트) > 실제 실행 증거 > 글 규칙 > 사람 리뷰. 같은 실수가 두 번 나오면 글로 부탁하지 말고, 검사나 테스트로 막는 안을 같은 PR에 낸다.
12. 땜질 금지: 타이밍을 맞추려는 setTimeout, `as any`·`: any`, 검사 끄기 주석(eslint-disable, @ts-ignore), 증상만 가리는 분기를 새로 넣지 않는다. 원인을 고친다. 못 고치면 PR "남은 일"에 원인과 함께 적는다. 기존 땜질을 본보기로 복사하지 않는다(에이전트는 주변 코드를 따라 한다).
13. 변명하는 주석을 쓰지 않는다. 이름과 구조로 먼저 설명하고, 남기는 주석은 "왜"를 한 줄로만 쓴다.
14. 증거로 끝낸다: 버그는 실패하는 테스트를 먼저 쓰고 고치기 전 실패를 확인한 뒤 고친다. 화면 변경은 폰 폭(390px) e2e를 통과시키고 PR에 스크린샷을 남긴다.
15. 미묘한 판단이 필요한 기능(useEffect 안의 상태 동기화 등)은 더 단순한 구조가 있으면 그쪽을 쓴다. 새 useEffect·setTimeout을 넣으면 PR 본문에 이유를 한 줄 적는다.
16. 작성과 검증 루프가 아직 통과하지 않는 일을 루틴·훅으로 자동화하지 않는다.
기계 장치 전환 계획: docs/QUALITY_GUARDS_PLAN.md
