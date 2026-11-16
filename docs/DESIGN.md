# Z2H 기술 설계 초안 (CTO 몽키)

- 작성: 2026-11-16 KST, 상태: CEO 승인(초안 그대로 진행), 얼큰이 결정 2건 반영(11/16 19:43~44 KST, CEO 전달), M0 진행 중
- 근거: BRIEF.md, 얼큰이 원문(t826u 2026-11-16 19:31 KST), 공개 원본 저장소·공식 문서(아래 출처)
- 표시 규칙: [확인됨] 이번에 문서·저장소로 확인 / [가정] 근거 있는 추정 / [맥확인] 맥미니에서 실제로 봐야 함

## 얼큰이 결정 반영 (2026-11-16 19:43~44 KST)
1. 영상: 앱 단계 화면에 YouTube 공식 삽입(youtube-nocookie.com iframe embed). 해당 구간부터 재생(start=초, 필요 시 end=초). 영상 파일 재배포는 여전히 금지.
2. 저장소: 비공개 blazethrottle/z2h-ko로 시작, 완성 후 공개 전환. 공개 전에 docs/PUBLIC_RELEASE_CHECKLIST.md(gitleaks 전체 이력 검사, MIT 원본 5개 LICENSE 전문·저작권자 NOTICE, build-nanogpt는 링크만) 확인. 공개 전환 자체는 그때 얼큰이 승인.

## 한 줄 요약
폰에서 읽는 한국어 정적 웹앱 + 맥미니에서 돌리는 편별 실습 노트북(자동 채점 셀 포함). 10편 GPT-2는 맥에서 수십 분짜리 축소판이 기본. 유료 비용 0이 기본.

---

## (a) 앱 구조

### 1. 추천 스택: 정적 웹앱 (서버 없음)
| 항목 | 추천 | 이유 |
|---|---|---|
| 프레임워크 | Astro + Preact 작은 부품(퀴즈·진도·힌트) | 글이 대부분인 강의 앱에 맞음. 콘텐츠 묶음(content collections)이 스키마 검사를 해 줘서 10편 자료 형식 오류를 빌드 단계에서 잡음. Preact는 BFB에서 이미 쓰는 기술 |
| 대안 | Vite + Preact (BFB와 동일) | Astro가 낯설면 이쪽. 대신 스키마 검사를 따로 짜야 함 |
| 서버 | 없음 | 로그인·DB가 없으면 비밀값·보안 부담이 0 |
| 진도 저장 | 브라우저 저장(localStorage) + "진도 파일 내보내기/가져오기"(JSON) | 로그인 없음. 폰과 맥 사이는 파일 하나로 옮김. 나중에 원하면 동기화 추가(별도 결정) |
| 노트북 실행 | 앱 밖: 맥미니 Jupyter(기본) 또는 Colab | 브라우저 안 파이썬(Pyodide)은 1편 일부만 가능하고 PyTorch가 안 돌아서 기본에서 제외, 선택 기능으로만 검토 |
| 영상 | 단계 화면에 YouTube 공식 삽입: `https://www.youtube-nocookie.com/embed/{videoId}?start={초}&end={초}&rel=0` (iframe, 지연 로딩, 폰 폭 16:9) + "YouTube에서 열기" 링크(&t=초) | 얼큰이 결정 1. 공식 embed라 재배포 아님. 영상 파일·자막 전문은 저장 안 함 |

화면 흐름(디자이너 확정 전 가안): 홈(10편 지도·진도) → 편 개요(목표·선행지식·예상시간) → 단계 화면(영상 구간 → 개념 → 코드 한 줄씩 풀이 → 따라하기 → 확인 문제 → 막힘 힌트) → 편 마무리(채점 결과 붙여넣기·체크).

채점 결과 연결: 노트북 마지막 채점 셀이 "Z2H-결과코드"(편·단계별 통과 목록을 담은 짧은 문자열, 비밀 아님)를 출력. 얼큰이님이 앱에 붙여넣으면 진도에 반영. 서버 없이 노트북과 앱을 잇는 가장 단순한 방법.

### 2. 콘텐츠 형식 (편별 단계 파일)
- 편마다 폴더 1개: `content/ep01-micrograd/episode.yaml` + 단계별 `steps/NN-이름.mdx`
- 단계 파일 앞머리(frontmatter) 스키마 초안:

```yaml
id: ep01-s03                # 편-단계
title: "Value 클래스에 덧셈 넣기"
video: { videoId: VMj-3S1tku0, start: 1520, end: 1935 }   # 필수: videoId+start(초), end는 선택. 리서치 자료로 확정
goal: "덧셈 결과가 어느 두 값에서 왔는지 기억하게 만든다"
prereq: [ep00-python-class]  # 0편 기초 모듈 연결
concepts:
  - term: "연산 그래프"
    plain: "계산 순서를 화살표로 이은 지도"
code:                        # 코드 한 줄씩 한국어 풀이
  - line: "def __add__(self, other):"
    ko: "두 Value를 + 로 더할 때 파이썬이 이 함수를 부른다"
steps:                       # 따라하기
  - do: "노트북 3번 셀을 실행하세요 (Shift+Enter)"
    expect: "Value(data=5.0) 가 보이면 성공"
check:                       # 확인 문제 (교사 몽키 기준)
  - type: choice | number | order | explain
    q: "a=2, b=3 일 때 (a+b)._prev 에 들어 있는 것은?"
    answer: ...
    why: "정답 풀이"
hints:                       # 막힘 힌트, 단계별로 점점 자세히
  - level: 1
    text: "오류 메시지 마지막 줄만 먼저 읽어 보세요"
  - level: 2
    text: "NameError 면 위쪽 셀을 먼저 실행했는지 확인"
notebook: { file: ep01/ep01_student.ipynb, cells: [3, 4], grader: ep01-s03 }
sources: [karpathy/nn-zero-to-hero lectures/micrograd]
```

- 편 파일 `episode.yaml`: 제목, 영상 ID, 길이, 학습 목표(교사), 선행지식, 예상 학습 시간, 실습 환경 기본값, 단계 순서.
- 검사: 빌드 때 스키마 검사(모든 단계에 video.videoId·video.start 필수, start<end<영상 길이) + "모든 코드 줄에 ko 풀이 있음" + "모든 단계에 확인 문제 1개 이상, 힌트 2단계 이상" + "타임스탬프가 영상 길이 안" 자동 테스트.

### 3. 저장소 (비공개 새 저장소)
- 이름 제안: `blazethrottle/z2h-ko` (비공개). 생성은 다음 단계에서 CTO가 함, 지금은 안 만듦.
- 폴더 구조:

```
z2h-ko/
  app/                 웹앱 (Astro)
    src/content/       편별 episode.yaml + steps/*.mdx
    src/components/    퀴즈·진도·힌트·코드풀이 부품
  notebooks/
    ep00-basics/       0편 사전 기초 (교사 자료 기반)
    ep01-micrograd/    ep01_student.ipynb (빈칸), ep01_solution.ipynb (정답)
    ...
    ep10-gpt2-mini/
  z2h_check/           자동 채점 파이썬 패키지 (check(), 결과코드 생성)
  data/                작은 데이터만 (names.txt, tiny shakespeare 등, 출처·라이선스 표기)
  env/                 requirements-mac.txt, requirements-colab.txt, 환경 점검 노트북
  tests/               스키마 테스트, 노트북 실행 테스트, 채점기 테스트
  docs/                DESIGN.md, 마일스톤 기록, 모델 검증 기록
  .claude/agents/      서브 에이전트 정의 (아래 c)
  CLAUDE.md            저장소 규칙
```

- 원본 코드 사용: micrograd·makemore·nn-zero-to-hero·nanoGPT·minbpe는 MIT [확인됨]. build-nanogpt는 GitHub에 라이선스 표기가 없음 [확인됨] → 코드 복사 없이 링크만(설명은 우리말 재작성).
- 공개 전환(얼큰이 결정 2): 비공개로 시작, 완성 후 공개. 전환 전 docs/PUBLIC_RELEASE_CHECKLIST.md 전 항목 통과 + 얼큰이 승인.

### 4. 배포: 비공개 미리보기만
- 기본: 맥미니에서 로컬 미리보기(`npm run preview`). 이것만으로 M1 검수 가능.
- 폰 미리보기가 필요하면: Cloudflare Pages 미리보기 + Cloudflare Access(이메일 로그인 제한, 무료 범위) [가정: 무료 한도는 설정 시 재확인]. 주의: pages.dev 미리보기 주소는 Access를 켜지 않으면 누구나 열 수 있어 사실상 공개 배포임. Access 없이 올리지 않음.
- 공개 배포는 얼큰이 승인 항목.

---

## (b) 편별 실습 방식

공통: 기본 실행 환경은 맥미니 M4 32GB 로컬 Jupyter. Colab 무료는 "맥이 안 될 때" 예비. 시간은 정답 노트북을 한 번 끝까지 실행하는 데 드는 대략치 [가정: 원본 설정과 nanoGPT README의 CPU/MPS 안내 기준, M1~M6에서 맥 실측으로 교체].

| 편 | 기본 환경 | 예상 실행 시간(정답 노트북) | 데이터 | 정답 대조 방식 |
|---|---|---|---|---|
| 0 사전 기초 | CPU | 몇 분 | 없음 | 파이썬·수학 확인 문제 assert (교사 몽키 자료 기반) |
| 1 micrograd | CPU | 1~3분 | 없음 | 내가 만든 Value의 기울기를 PyTorch 기울기와 비교(원본 micrograd 테스트 방식), 작은 신경망 손실 감소 확인 |
| 2 makemore 바이그램 | CPU | 1~5분 | names.txt (makemore 저장소, MIT) | 바이그램 표 합계·확률 합 1 확인, 손실값을 정답 노트북 값과 소수점 허용오차로 비교 |
| 3 MLP | CPU (MPS 선택) | 5~15분 | names.txt | 고정 시드로 텐서 모양·첫 손실 일치, 검증 손실이 기준선 이하 |
| 4 활성화·BatchNorm | CPU 또는 MPS | 10~30분 (학습 횟수 축소판 기본) | names.txt | 초기 손실이 이론값(-ln(1/27) 근처)인지, BN 출력 평균 0·분산 1 근처인지, 활성화 포화 비율 범위 assert |
| 5 Backprop Ninja | CPU | 몇 분 | names.txt | 원본의 cmp() 방식: 손으로 구한 기울기와 PyTorch 기울기가 정확/근사 일치하는지 항목별 표시 |
| 6 WaveNet | MPS (CPU 가능) | 15~40분 | names.txt | 층별 출력 모양 assert, 검증 손실이 기준선 이하 |
| 7 GPT 만들기 | MPS | 축소판 10~30분 (원본 크기는 MPS에서 1시간 이상 예상) | tiny shakespeare | 어텐션 마스크 모양·인과성 assert, 손실 감소 곡선, 기준 손실 이하 |
| 8 State of GPT (강연) | 코드 거의 없음, CPU | 몇 분 | 없음 | 개념 지도 + 확인 문제 중심. 작은 실습: 토큰 세기, 사전학습/미세조정/RLHF 단계 순서 맞히기 |
| 9 토크나이저 | CPU | 5~15분 | 작은 텍스트 + tiktoken GPT-2 사전 | 내 BPE의 인코드→디코드 왕복 일치, 같은 문장에서 tiktoken(GPT-2)과 토큰 일치(minbpe 테스트 방식) |
| 10 GPT-2 축소판 | MPS | 30~60분 이내 목표 | 작은 텍스트 조각(예: FineWeb-Edu 일부 수천만 토큰 이하 또는 tiny shakespeare) | (1) 공개 GPT-2 124M 가중치를 불러와 내 모델 출력이 기준 라이브러리 출력과 일치(추론만, 맥 가능) (2) 작은 모델(수천만 파라미터 이하) 학습 손실 감소 (3) 학습률 스케줄·기울기 누적 결과 assert (4) HellaSwag 일부 문항 평가 실습 |

10편 메모
- 영상의 전 과정(모델 코드, 가중치 불러오기, 학습률 스케줄, 기울기 누적, 혼합 정밀도, 분산 학습 개념, 평가)을 축소판에서 모두 손으로 해 봄. 분산 학습(DDP)은 프로세스 1개로 구조만 실습 [맥확인: torchrun 1프로세스 동작].
- MPS 주의 [맥확인]: torch.compile·bf16·fused AdamW 일부가 MPS에서 안 되거나 느릴 수 있음 → 노트북에 "맥에서는 이 줄을 끄세요" 분기와 이유 풀이.
- 원본 124M 재현(영상 기준 8xA100급)은 유료 GPU라 별도 승인 항목(아래 g, h).

공통 채점 방식
- 학생 노트북 = 빈칸(`# 여기에 작성`) + 채점 셀 `z2h_check.check("ep03-s05", 변수)`. 틀리면 한국어로 "무엇이 다른지 + 힌트 번호" 출력.
- 정답 노트북은 검수용으로 맥에서 끝까지 실행 통과해야 함. 학생 노트북은 정답을 넣은 상태로도 채점 셀이 모두 통과해야 함(채점기 자체 검사).
- 기준값(손실 등)은 고정 시드로 정답 노트북을 맥에서 돌려 정함. 원본 영상 수치는 참고만 (기기·버전 차이로 다를 수 있음).

0편 사전 기초: 교사 몽키 pedagogy/ 자료가 정본. CTO 쪽은 노트북 틀(파이썬 변수·리스트·함수·클래스, 미분 감각, 행렬 곱, 확률 합)과 환경 설치 점검 노트북(맥 MPS 사용 가능 여부 출력)을 준비.

Colab 메모: 비공개 저장소의 노트북은 Colab "바로 열기" 링크가 GitHub 권한 연결을 요구함 → 기본은 맥, Colab은 노트북 파일 내려받아 올리기 방식 안내.

---

## (c) Claude Code 운영 설계

### 모델 규칙
- PM(메인 세션) = Fable 5.2, effort medium
- 서브 에이전트 = Opus 5.5, effort xhigh 고정 (헤드리스 "서브 금지" 규칙을 이 프로젝트에선 이것으로 대체)
- `~/.claude/settings.json`(opus/medium)은 건드리지 않음

### 덮어쓰기 방법 후보 (공식 문서 확인, 2026-11-16) [확인됨]
| 방법 | 효과 | 쓸지 |
|---|---|---|
| `claude --model fable --effort medium` | 이 실행에서만 메인 모델·강도 지정, 설정 파일 기본값보다 우선, 저장 안 됨 | 사용 (PM) |
| `--settings <별도 파일>` | 이 실행에서만 설정 키를 덮어씀. 파일에 없는 키는 기존 값 유지 | 사용 (서브 고정용 env 담기) |
| 서브 정의 파일 `.claude/agents/*.md` 앞머리 `model:`·`effort:` | 그 서브의 모델·강도 | 사용 (정의마다 명시) |
| `CLAUDE_CODE_SUBAGENT_MODEL` + `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` | 모든 서브·팀원·워크플로 에이전트를 한 모델로 강제. 정의 파일 model·호출 시 model 무시. v2.1.257 이상 | 사용 (이중 잠금, --settings 파일의 env 블록에) |
| `CLAUDE_CODE_EFFORT_LEVEL` 환경변수 | 메인·서브 모두의 강도를 하나로 덮어씀(정의의 effort보다 우선) | 쓰지 않음. 켜져 있으면 서브 xhigh가 medium으로 눌림. 발사 전 비어 있는지 확인 |
| `ANTHROPIC_MODEL` | 메인 모델 지정 | 쓰지 않음(--model로 충분) |

예정 발사 형태(맥에서 실제 문자열 확인 후 확정, 지금은 실행 안 함):
```
cd ~/z2h-ko
claude --model fable --effort medium --settings ./.claude/z2h-run.settings.json
```
`z2h-run.settings.json` 초안:
```json
{ "env": { "CLAUDE_CODE_SUBAGENT_MODEL": "claude-opus-5-5",
           "CLAUDE_CODE_SUBAGENT_MODEL_FORCE": "1" } }
```
서브 정의 앞머리: `model: claude-opus-5-5`, `effort: xhigh`.

주의(문서 근거)
- FORCE를 켜도 "fork"와 `model: inherit` 스킬은 부모 모델(Fable)로 돎 → 지시서에서 fork 금지, 서브는 정의된 이름으로만 부르게 함.
- 내장 Explore는 부모가 Fable이면 Opus로 돎(구독 연결 기준). Plan·general-purpose도 FORCE 대상이지만 검증 집계에 포함.
- 서브의 effort는 정의 파일 effort가 적용되고 호출 시 effort 인자가 그보다 우선 → 지시서에 "effort 인자 넘기지 말 것".
- 예전 위키 노트(2026-07)의 "환경변수가 정의 파일보다 우선"은 현재 문서와 다름. 현재는 정의 파일이 우선이고, 강제하려면 FORCE가 필요.
- 맥 확인(2026-11-16 19:47 KST): Claude Code 2.1.322, /model 목록에 Fable 5.2(과금 표시 없음)·Opus 5.5 있음, 로컬 세션 기록의 모델 ID `claude-fable-5-2`, `claude-opus-5-5`. 발사는 별칭 대신 전체 ID로 고정: `--model claude-fable-5-2`.
- 실행 설정 파일에 `"attribution": false` 추가(커밋·PR 꼬리표 자동 삽입 끄기, v2.1.281 이상).

### Fable 과금 위험 [확인됨, 중요]
- 문서: 요금제·자리 등급에 따라 Fable 사용이 "사용량 크레딧"(추가 결제)으로 청구될 수 있음. `-p` 무인 모드에서는 묻지 않고 청구.
- 대응: (1) 발사 전 `/model` 화면의 Fable 줄에 "Requires usage credits" 표시가 있는지 확인 (2) 있으면 발사 중단, 얼큰이 결제 승인 항목으로 보고 (3) PM은 `-p` 무인 모드로 돌리지 않고 대화형 세션으로만 (4) 크레딧 동의 창이 뜨면 누르지 않고 멈춤·보고.

### 실행 후 모델 검증
- 세션 기록: `~/.claude/projects/<프로젝트경로>/<세션ID>.jsonl`, 서브 기록은 세션 폴더 아래 subagents/ [맥확인: 정확한 경로·필드명].
- 집계 스크립트(`tests/verify_models.py`, PR에 포함): 모든 JSONL의 assistant 메시지 `message.model` 값을 메인/서브별로 세어 표로 출력. 합격 = 메인은 Fable 5.2 ID만, 서브는 Opus 5.5 ID만. 다른 값이 1건이라도 있으면 불합격으로 기록하고 CEO 보고(그 세션 산출물은 재검토).
- 실행 중 확인: `/tasks`에서 서브 줄에 모델·강도 표시(v2.1.242 이상).
- 결과는 `docs/model_audit/YYYYMMDD.md`에 남김(값 집계만, 비밀값 없음).

### 지시서 기본 규칙 (PM과 모든 서브에 적용)
1. 커밋·PR 본문에 Co-Authored-By, Claude 꼬리표, Claude 링크 금지.
2. main 병합 금지. 작업은 마일스톤 브랜치(`m1-skeleton-ep01` 등) → PR까지만. 병합은 얼큰이 승인 후.
3. 지정 폴더(저장소 안 해당 마일스톤 범위) 밖 쓰기 금지. `~/.claude/settings.json` 수정 금지.
4. 강제 푸시·`--no-verify`·검사 건너뛰기 금지.
5. 비밀값을 파일·로그·출력에 쓰지 않음. 결제·로그인·키 발급·공개 배포가 필요하면 멈추고 보고.
6. fork 금지, 서브 호출 때 model·effort 인자 넘기지 않음.
7. 원본 영상 재배포 금지(youtube-nocookie 공식 embed·링크만). 라이선스 없는 build-nanogpt는 코드 복사 없이 링크만.
8. 마일스톤이 끝나면 PR 본문에 "한 일 / 테스트 결과 / 맥 실행 로그 요약 / 남은 일"을 쉬운 한국어로.

---

## (d) 검수
| 누가 | 무엇을 | 합격 기준 |
|---|---|---|
| CTO B검토 | PR 전체 | 테스트 먼저 실행, 위험 점검표(외부 쓰기·비밀값·폴더 밖 쓰기·꼬리표·main 접근) 통과, 모델 검증 표 합격 |
| 자동 | 노트북 실행 | 맥에서 `jupyter nbconvert --to notebook --execute` 로 모든 정답 노트북 오류 0, 시간 한도 안. 학생 노트북은 정답 주입 상태로 채점 셀 전부 통과 |
| 자동 | 정답 대조 | z2h_check 테스트(pytest), 기준값 표와 허용오차 일치 |
| 자동 | 콘텐츠 | 스키마 검사, 코드 줄 풀이 누락 0, 확인 문제·힌트 개수, 타임스탬프 범위 |
| 디자이너 몽키 | 화면 | 폰 폭(390px 안팎)·맥 화면 스크린샷 검수, 디자인 토큰 일치, 글자 크기·대비 |
| 교사 몽키 | 확인 문제·힌트 | 학습 목표와 문제 연결, 비개발자가 풀 수 있는 난이도, 채점 기준 |
| 리서치 몽키 | 사실 | 타임스탬프·개념 설명이 원본과 일치 (표본 검사) |
| 얼큰이 | 실제 사용 | 1편을 직접 해 보고 막힌 곳 기록 → M2 반영 |

---

## (e) 입력 의존성
| 시점 | 할 수 있는 일 |
|---|---|
| research/·pedagogy/·design/ 오기 전 | 저장소 뼈대, 콘텐츠 스키마, 채점 패키지 z2h_check, 노트북 실행 테스트 틀, 환경 점검 노트북, 모델 검증 스크립트, 1편 정답 노트북(원본 MIT 코드 기반) 실행 확인, 기본 화면(임시 스타일) |
| research/ 도착 후 | 편별 타임스탬프, 개념 지도, 코드 단계 나누기, 자주 막히는 지점 → 힌트 |
| pedagogy/ 도착 후 | 학습 목표, 확인 문제·채점 기준, 0편 기초 모듈, 난이도 조정 |
| design/ 도착 후 | 디자인 토큰·화면 적용, 모바일 배치, 진도 화면 |

PM은 입력을 기다리지 않고 설계 초안부터 시작하고, 입력이 오면 반영 목록을 PR에 적음.

---

## (f) 일정 (KST, 현실 기준) [가정]
가정: 하루 PM 세션 1~2회, 사용량 한도로 끊기는 날 있음, 얼큰이 검토는 하루 이내. 아래는 "앱 제작" 일정이고 얼큰이님 학습 시간은 별도.

| 마일스톤 | 내용 | 목표일 |
|---|---|---|
| M0 설계 확정 | 이 초안 + 입력 3종 반영, 맥 환경·모델 ID·과금 표시 확인, 저장소 생성 | 11/18(수) |
| M1 뼈대 + 1편 수직 슬라이스 | 앱 뼈대·스키마·진도·채점 패키지 + 0편 틀 + 1편 전체(단계·풀이·노트북·채점) + 모델 검증 1회 | 11/22(일) |
| (얼큰이 1편 체험) | 막힌 곳 기록 → 형식 조정 | 11/23~24 |
| M2 | 2~3편 (makemore 바이그램, MLP) | 11/28(토) |
| M3 | 4~5편 (BatchNorm, Backprop Ninja) | 12/3(목) |
| M4 | 6~7편 (WaveNet, GPT 만들기) | 12/8(화) |
| M5 | 8~9편 (State of GPT, 토크나이저) | 12/12(토) |
| M6 | 10편 GPT-2 축소판 | 12/17(목) |
| M7 | 전체 검수·다듬기·비공개 미리보기 | 12/20(일) |

얼큰이님 학습 시간 참고 [가정]: 영상 약 19.6시간 + 실습·확인 문제로 영상의 2~4배 → 약 40~80시간.

---

## (g) 예상 사용량 [가정, 숫자는 근거와 함께만]

Claude Max (이 계정은 Max 5x로 기록됨, 위키 기준 [맥확인])
- 세션 수 가정: 마일스톤마다 PM(Fable 5.2 medium) 대화형 세션 1~3회, 서브(Opus 5.5 xhigh) 작업 4~8건 (구현 1~2, 콘텐츠 2~4, 검수 1~2). M0~M7 합계 PM 약 10~20회, 서브 약 35~60건.
- 시간: 서브 1건 20~60분 가정 → 서브 합계 약 15~60시간. 범위가 넓은 이유는 측정값이 없어서임.
- 근거: 팀 위키 실측(2026-09, Claude-5-5-Model-Effort-Task-Fit): Fable은 같은 일에 시간·비용 3~5배, xhigh는 코딩에서 모델 시간 3~4배. 같은 실측에서 Fable max 세션이 세션 한도로 끊긴 일이 있었음. 그래서 한도에 걸릴 가능성이 높음.
- 대응: M1 끝나고 실제 사용량(주간 한도 %)을 재서 M2~M7 예측을 다시 씀. 한도에 닿으면 일정을 늘리지, 유료 크레딧을 쓰지 않음.
- Fable 5.2의 Max 요금제 조건(한도 내 포함 여부)은 미확인 [맥확인: /model 표시]. 2026-09 기준 Fable 5.1은 Max에서 주간 한도 50%까지 추가 비용 없음(위키 기록).

맥미니 연산 시간 [가정]: 정답 노트북 전체 1회 실행 약 2~4시간(10편 축소판 포함), 마일스톤마다 재실행 → 제작 기간 합계 약 15~30시간. 전기료 외 비용 없음.

유료 비용: 기본 0원.
- 선택 1, Colab Pro: 월 $9.99 (Pro+ $49.99) [확인됨: colab.research.google.com/signup, 미국 가격 표시]. 기본 계획엔 필요 없음.
- 선택 2, 10편 원본 124M 재현: Karpathy는 "약 1시간, 약 $10"이라 적음(2024년 가격) [확인됨: github.com/karpathy/build-nanogpt README]. 현재 Lambda 8x A100 80GB 단가 $3.19/GPU/시간 → 시간당 약 $25.5, 8x H100 $4.59/GPU/시간 → 시간당 약 $36.7 [확인됨: lambda.ai/pricing, 2026-11-16 표시, 세금 별도]. 데이터 준비·설치·평가 포함 2~3시간 가정 시 약 $50~$110 [가정]. 얼큰이 승인 없이는 안 함.

---

## (h) 위험·결정 필요 항목
얼큰이 승인 필요
1. main 병합 (마일스톤 PR마다)
2. 공개 배포 (Access 없는 pages.dev 미리보기도 사실상 공개라 포함), 저장소 공개 전환(체크리스트 통과 후)
3. 결제: 유료 GPU(124M 재현), Colab 유료, Fable 사용량 크레딧

CTO가 정하되 보고할 것
4. 스택: Astro(추천) vs Vite+Preact
5. 폰 미리보기 방식: 로컬만 vs Cloudflare Access 보호 미리보기 (Cloudflare 쓰기 권한 필요, 현재 계정 토큰은 읽기만 검증됨)
6. 10편 축소판 데이터: FineWeb-Edu 일부 vs tiny shakespeare

위험
- Fable이 사용량 크레딧으로 청구될 수 있음(위 c). 발사 전 확인 필수.
- 사용량 한도로 일정 지연 (가장 가능성 높음).
- 서브 모델 혼입(fork·호출 인자·EFFORT 환경변수) → FORCE + 검증 스크립트로 막음.
- MPS 호환 문제(10편 일부 기능) → CPU 분기·개념 실습으로 대체.
- build-nanogpt 라이선스 표기 없음 → 재작성·링크.
- 비개발자 학습 난도: 1편 체험 후 형식 조정 구간을 일정에 넣음.

## 출처
- https://code.claude.com/docs/en/model-config (모델 우선순위, effort 우선순위, Fable 과금)
- https://code.claude.com/docs/en/sub-agents (서브 모델 우선순위, FORCE, effort 필드, /tasks)
- https://code.claude.com/docs/en/cli-reference (--model, --effort, --settings, --agents)
- https://github.com/karpathy/nn-zero-to-hero, micrograd, makemore, nanoGPT, minbpe, build-nanogpt (라이선스: 앞 5개 MIT, build-nanogpt 표기 없음)
- https://lambda.ai/pricing , https://colab.research.google.com/signup
- 영상 ID 10개: YouTube oEmbed로 제목 확인 (VMj-3S1tku0, PaCmpygFfXo, TCH_1BHY58I, P6sfmUTpUmc, q8SA3rM6ckI, t3YJ5hKiMQ0, kCc8FmEb1nY, bZQun8Y4L2A, zduSFxRajkE, l8pRSuU81PU)
