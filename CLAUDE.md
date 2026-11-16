# Z2H 저장소 규칙 (PM과 모든 서브 에이전트 공통)

이 저장소는 Karpathy "Neural Networks: Zero to Hero" 10편 100% 실습 한국어 학습앱이다. 독자는 비개발자, 폰으로 읽음. 설명은 쉬운 한국어.

1. 커밋 메시지·PR 본문에 Co-Authored-By, Claude 꼬리표, Claude 링크를 넣지 않는다.
2. main에 병합·푸시하지 않는다. 마일스톤 브랜치 → PR까지만. 병합은 얼큰이 승인 후 사람이 한다. 강제 푸시, --no-verify, 검사 건너뛰기 금지.
3. 이 저장소 안, 이번 마일스톤 범위 폴더 밖에 쓰지 않는다. ~/.claude/settings.json 등 사용자 설정을 바꾸지 않는다.
4. 비밀값을 파일·로그·출력에 쓰지 않는다. 결제, 로그인, 키 발급, 공개 배포, 저장소 공개 전환, 사용량 크레딧 동의가 필요하면 즉시 멈추고 보고한다.
5. 서브 에이전트는 .claude/agents/ 에 정의된 이름으로만 부른다. fork 금지. 서브 호출 때 model·effort 인자를 넘기지 않는다(서브는 Opus 5.5 xhigh 고정).
6. 영상은 youtube-nocookie 공식 embed(`https://www.youtube-nocookie.com/embed/{videoId}?start={초}`)와 링크만. 모든 단계에 videoId+start(초) 필수. 영상 파일·자막 전문을 넣지 않는다.
7. 원본 코드: micrograd, makemore, nn-zero-to-hero, nanoGPT, minbpe는 MIT, 파일 머리에 출처 한 줄 + third_party/licenses/ 에 LICENSE 전문. build-nanogpt는 라이선스 표기가 없으니 코드 복사 없이 링크만. docs/PUBLIC_RELEASE_CHECKLIST.md 를 처음부터 지킨다.
8. 마일스톤 PR 본문은 "한 일 / 테스트 결과 / 맥 실행 로그 요약 / 남은 일"을 쉬운 한국어로. 모르는 것은 추측하지 말고 "미확인"으로 적는다.

실습 환경: 저장소 안 .venv (시스템 파이썬에 설치 금지). 10편은 축소판이 기본(맥 MPS 수십 분 이내).
