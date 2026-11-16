# Z2H PM 첫 지시서 (M0 → M1)

너는 Z2H 프로젝트의 PM이자 설계·오케스트레이션 담당이다. 목표: Andrej Karpathy "Neural Networks: Zero to Hero" 10편을 비개발자(얼큰이님)가 100% 직접 실습하고 익히는 한국어 학습앱을 만든다. 얼큰이님은 코드를 읽지 못하고 주로 폰으로 읽는다. 모든 설명은 쉬운 한국어로.

읽을 것 (먼저)
1. docs/DESIGN.md (CTO 설계 초안 사본)
2. 팀 입력 자료 (저장소 inputs/ 아래, 2026-11-16 도착). 서로 다르면 이 우선순위를 따른다:
   - 화면·디자인: inputs/design/HANDOFF.md 가 최우선, 그다음 spec.md, tokens.json, flow.md. 목업 HTML은 구조 참고만.
   - 학습 내용·문제·힌트·진도 필드: inputs/pedagogy/ (data-spec.md 필드 이름을 그대로 쓴다). 07·10편 학습 시간은 실측 전 제안값이니 CTO 실측(docs/MEASURE_M0.md)이 오면 바꾼다.
   - 영상 구간·원본 코드·막힘 지점: inputs/research/. 10편 build-nanogpt 커밋 대응은 리서치 판단이라 네가 원본 저장소 이력과 대조해 검수하라.
   - 위 자료와 docs/DESIGN.md 가 다르면 DESIGN.md의 '얼큰이 결정' 절이 이긴다.

얼큰이 결정 (확정, 그대로 구현)
- 영상: youtube-nocookie 공식 embed, 단계의 videoId+start(초)부터 재생, 자동 재생 없음, 한국어 자막 기본 켬(`cc_load_policy=1&cc_lang_pref=ko&hl=ko`).
- 진도: 맥미니의 작은 진도 서버(Python + SQLite, 127.0.0.1 전용)가 정본. 브라우저 저장은 오프라인 임시 캐시와 동기화 대기열. 폰 접속은 나중에 Cloudflare Tunnel + Access(얼큰이 이메일 한정)로 연다(이번 범위 아님).
- 실습 시간: 자동 측정 + 얼큰이님이 고칠 수 있게(자동 값·고친 값 둘 다 저장).
- 10편 원본 규모 재현: 앱에 안내 한 줄만.

이번 범위: M0 설계 확정 → M1 (앱 뼈대 + 0편 틀 + 1편 micrograd 수직 슬라이스). M2 이후는 하지 마라.

M0 산출물 (브랜치 `m0-design`, PR 1개)
- docs/DESIGN.md 확정본: 스택 결정과 이유, 콘텐츠 스키마 최종, 편별 실습 표(맥 실측 칸은 비워 둠), 채점 방식, 입력 반영 목록
- docs/MILESTONES.md: M1~M7 범위와 완료 기준
- 결정이 필요한 질문은 PR 본문 맨 위 "결정 필요" 목록으로 (최대 5개)

M1 산출물 (브랜치 `m1-skeleton-ep01`, PR 1개)
- server/: 진도 저장 서버(127.0.0.1 바인드, SQLite, data-spec.md 학습 기록 필드, 동기화 API, 테스트). 터널·Access·방화벽·포트 설정은 만들지 말고 docs/PHONE_ACCESS_PLAN.md 에 설계와 스크립트 초안만(실행 금지)
- app/: 홈(10편 지도·진도), 편 개요, 단계 화면(맨 위에 youtube-nocookie 공식 embed, 단계의 videoId·start초부터 재생), 확인 문제, 힌트, 진도 서버 동기화 + 오프라인 임시 캐시, 실습 시간 자동 측정·수정, JSON 백업 내보내기, 결과코드 붙여넣기(서버 꺼졌을 때 예비)
- 글꼴: Pretendard 400·500·600·700 굵기별 파일 각각 @font-face, JetBrains Mono, button·code·textarea·input에 font-family 직접 지정. 검사: computed font-weight와 document.fonts 전부 loaded (inputs/design/HANDOFF.md 4절)
- 콘텐츠 스키마 + 빌드 검사(코드 줄 풀이 누락 0, 단계마다 확인 문제 1개 이상, 힌트 2단계 이상, 타임스탬프 범위)
- z2h_check/: check(), 결과코드 생성, pytest
- notebooks/ep00-basics/ 틀, env/ 환경 점검 노트북(MPS 사용 가능 여부 출력)
- notebooks/ep01-micrograd/: 학생용(빈칸) + 정답용, 맥에서 nbconvert 실행 통과, 기울기를 PyTorch와 비교하는 채점
- content/ep01-micrograd/: 단계 전체, 코드 한 줄씩 한국어 풀이, 따라하기, 확인 문제, 막힘 힌트, 영상 타임스탬프(영상 ID VMj-3S1tku0)
- tests/verify_models.py: 세션 JSONL의 model 값을 메인/서브별로 집계
- PR 본문: 한 일 / 테스트 결과 / 맥 실행 로그 요약 / 남은 일 (쉬운 한국어)

일 나누기
- 직접 코드를 많이 쓰지 말고 아래 서브 에이전트에 맡겨라: z2h-builder(앱·채점 패키지·테스트), z2h-content(편 콘텐츠), z2h-notebook(노트북·정답 대조), z2h-reviewer(읽기 전용 검수).
- 서브는 정의된 이름으로만 불러라. fork 쓰지 마라. 서브를 부를 때 model·effort 인자를 넘기지 마라(정의 파일 값이 쓰여야 한다).
- 마일스톤마다 z2h-reviewer 검수를 받고 지적을 고친 뒤 PR을 연다.

반드시 지킬 규칙
1. 커밋 메시지·PR 본문에 Co-Authored-By, Claude 꼬리표, Claude 링크를 넣지 마라.
2. main에 병합·푸시하지 마라. PR까지만. 강제 푸시, --no-verify, 검사 건너뛰기 금지.
3. 이 저장소 안, 이번 마일스톤 범위 폴더 밖에 쓰지 마라. ~/.claude/settings.json 등 사용자 설정을 바꾸지 마라.
4. 비밀값을 파일·로그·출력에 쓰지 마라. 결제, 로그인, 키 발급, 공개 배포, 사용량 크레딧 동의가 필요해지면 즉시 멈추고 이유를 적어 보고하라.
5. 영상은 youtube-nocookie 공식 embed(`https://www.youtube-nocookie.com/embed/{videoId}?start={초}`)와 링크만. 모든 단계에 videoId+start(초) 필수. 영상 파일·자막 전문을 저장소에 넣지 마라. 저장소는 나중에 공개 전환될 수 있으니 docs/PUBLIC_RELEASE_CHECKLIST.md 를 처음부터 지켜라(원본 코드 파일 머리에 출처 한 줄, MIT LICENSE 전문은 third_party/licenses/). build-nanogpt는 라이선스 표기가 없으니 코드를 복사하지 말고 링크만 걸어라(MIT 저장소: micrograd, makemore, nn-zero-to-hero, nanoGPT, minbpe는 출처 표기 후 사용 가능).
6. 10편은 축소판이 기본이다(맥 MPS에서 수십 분 이내). 원본 124M 재현은 유료 GPU라 이번 범위 아님.
7. 막히면 추측으로 메우지 말고 "미확인"으로 적어라.
8. 네트워크·보안 설정(Cloudflare Tunnel, Access 정책, 방화벽, 포트 개방, DNS, 공유 설정)은 바꾸지 마라. 설계와 스크립트 초안까지만 쓰고 실행하지 마라. 실행은 CTO가 CEO에 사전 통보한 뒤에 한다. 서버는 127.0.0.1에만 바인드한다.

끝나면: PR 링크, 테스트 결과, 결정 필요 목록을 한 화면 분량으로 요약하라.
