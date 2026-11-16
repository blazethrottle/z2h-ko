# Z2H 기술 설계 v2 확정본 (프로토타입 우선)

- 작성: 2026-11-16 20:10 KST, CTO 몽키. v1(10편 전체, 개인 학습앱)은 DESIGN_DRAFT_v1.md 로 보관.
- 바뀐 이유: 얼큰이 방향 전환(t833u, 2026-11-16 20:06 KST, CEO 전달). 일반인 대상 제품, 프로토타입 먼저.
- 갱신: 20:20 KST pedagogy v1.1·VALUE_CURRICULUM.md·video-segments.json 반영(5절, 4절, 1절).
- P0 확정: 2026-11-16 KST, PM. 12절이 P0에서 확정한 구현 계약이다. 1~11절과 12절이 다르면 12절이 이기고, 0절 '확정된 결정'이 모든 것보다 우선한다.
- 표시: [확인됨] 문서·실측으로 확인 / [가정] 근거 있는 추정 / [자리] 교사·디자이너 자료가 오면 채울 곳

## 0. 확정된 결정 (모두 반영)
| # | 결정 | 시각(KST) |
|---|---|---|
| 1 | 영상은 youtube-nocookie 공식 embed, 단계 구간부터 재생(start 초), 자동 재생 없음 | 11/16 19:43 |
| 2 | 저장소는 비공개 blazethrottle/z2h-ko로 시작, 완성 후 공개 전환(체크리스트 통과 + 얼큰이 승인) | 11/16 19:44 |
| 3 | 진도는 서버에 저장해 폰과 컴퓨터에서 이어 보기. 브라우저는 오프라인 임시 캐시와 동기화 | 11/16 19:52 |
| 4 | 실습 시간 자동 측정 + 사용자가 고칠 수 있음 | 11/16 19:52 |
| 5 | 한국어 자막 기본 켬(`cc_load_policy=1&cc_lang_pref=ko&hl=ko`) | 11/16 19:52 |
| 6 | 10편 원본 규모 재현은 앱에 안내 한 줄만 | 11/16 19:52 |
| 7 | 일반인 대상 제품: 랜딩, 첫 30분 맛보기, 성취 배지, 공유 카드 추가 | 11/16 20:06 |
| 8 | 프로토타입 범위: 랜딩, 맛보기, 1편 micrograd 전 과정, 진도 저장. 2~10편은 뒤로 | 11/16 20:06 |
| 9 | 프로토타입은 맥미니 저장(작은 서버 + SQLite), 나중에 여러 사용자·계정 서버 DB(예: Postgres)로 옮기기 쉽게: user_id 처음부터, 저장 계층 어댑터, 마이그레이션 파일, 배지·공유 카드 테이블 | 11/16 20:06 |
| 10 | 실습 환경: "내 맥" 가정 버림. Colab 열기 링크가 기본, 로컬 Jupyter는 선택. 맛보기는 설치 없이 브라우저에서 | 11/16 20:06 |

승인 게이트
- 얼큰이 승인: main 병합, 공개 배포, 저장소 공개 전환, 서버 공개 운영, 유료 서버·DB, 결제(GPU 등).
- CEO 사전 통보: 네트워크·보안 설정 변경(Cloudflare Tunnel, Access 정책, 방화벽, 포트 개방, DNS). PM·서브는 설계·스크립트 초안까지만.

## 1. 프로토타입 범위
| 부분 | 내용 | 지금 자료로 시작? |
|---|---|---|
| 앱 뼈대 | 상단 바·하단 탭·카드·버튼, 디자인 토큰, 글꼴, 영상 플레이어 부품, 동기화 상태 표시 | 예 (design v1.2 HANDOFF) |
| 진도 저장 | 맥미니 진도 서버 + SQLite + 브라우저 임시 캐시·동기화, 실습 시간 측정·수정 | 예 (data-spec.md) |
| 1편 micrograd 전 과정 | 단계·코드 풀이·확인 문제·힌트 4단계·노트북(Colab 기본)·자동 채점 | 예 (research/01, pedagogy/01, hints.md) |
| 0편 기초 중 1편에 필요한 단위 | 1편 선행 단위만 (추천 표시, 잠금 아님) | 예 (00-foundations.md) |
| 랜딩 | 제품 소개, 맛보기 시작 버튼 | [자리] 교사·디자이너 설계 중 |
| 첫 30분 맛보기 | 설치 없이 브라우저에서. 교사 VALUE_CURRICULUM.md 3절의 Colab 맛보기 코드(이름 지어내기, CPU 약 6초, 손실 3.84 → 2.47, 교사 실행 확인) | 예 (내용 확정, 화면은 design v2_taste 목업) |
| 성취 배지 | 규칙·화면 | [자리] 테이블은 지금 설계(5절) |
| 공유 카드 | 이미지 카드 | [자리] 테이블은 지금 설계, 프로토타입은 내 기기에 이미지 저장만(공개 공유 주소 없음) |
| 2~10편 | 프로토타입 뒤 | 아님 (자료는 inputs/에 보관) |

## 2. 앱 구조
| 층 | 프로토타입 | 나중(승인 후) |
|---|---|---|
| 화면 | Astro + Preact 부품, 정적 빌드 | 같음 (CDN 배포) |
| 진도 서버 | Python FastAPI, 맥미니 127.0.0.1 바인드, 정적 파일도 제공 | 같은 코드를 서버 호스팅에 올림 |
| 저장 | SQLite 파일 1개 (`StorageAdapter` 뒤) | Postgres 어댑터로 교체 |
| 스키마 관리 | Alembic 마이그레이션 파일(SQLite·Postgres 둘 다 지원) | 같은 마이그레이션을 Postgres에 적용 |
| 사용자 | 고정 단일 사용자 `user_id = 00000000-0000-4000-8000-000000000001`, 로그인 없음 | 계정·로그인 추가(인증 방식은 그때 결정, 승인 항목) |
| 폰 접속 | Cloudflare Tunnel + Access(얼큰이 이메일 한정) 초안만, 실행은 CEO 사전 통보 후 | 공개 운영은 얼큰이 승인 |
| 콘텐츠 | 저장소 안 파일(YAML/MDX), 빌드 때 스키마 검사, `content_version` 표시 | 같음 |

동기화 상태 표시(design v1.2 HANDOFF 6-1): 저장됨 / 동기화 중 / 오프라인. 브라우저 IndexedDB 대기열에 변경을 쌓고, 연결되면 `POST /api/sync`로 보냄. 같은 행 충돌은 `updated_at` 늦은 쪽이 이기고 진 값은 `sync_conflicts`에 남김.

실습 시간(HANDOFF 6-2): 단계 화면이 보이는 동안만 셈(탭 숨김, 5분 무입력이면 멈춤). `active_seconds_auto`와 사용자가 고친 `active_seconds_user`를 둘 다 저장, 화면은 고친 값 우선.

## 3. 실습 실행 환경 (결정 10)
| 방식 | 역할 | 메모 |
|---|---|---|
| Colab 열기 (기본) | 1편 노트북 실행 | 1편은 CPU로 충분 [확인됨: 맥 실측과 원본 구조]. "Colab에서 열기" 링크는 `colab.research.google.com/github/{owner}/{repo}/blob/{branch}/{path}` 형식이 공개 저장소에서만 바로 열림. 프로토타입 기간(비공개 저장소)에는 얼큰이 계정 GitHub 권한 연결로 열거나, 앱에서 .ipynb 받기 + Colab 업로드 안내. 일반인 공개 때는 노트북만 담은 공개 저장소 또는 공개 주소가 필요(공개 배포 승인 항목) |
| 로컬 Jupyter (선택) | 설치할 수 있는 사람용 | `requirements.txt` + 환경 점검 노트북. 맥 MPS는 7편 이후에만 의미 있음 |
| 브라우저 안 (맛보기) | 설치 없이 30분 | 4절 후보 |

graphviz: 1편 `draw_dot`은 Colab에 graphviz가 기본 설치돼 있다는 것이 일반적 경험이나 [가정, Colab 실측 아님]. 맥 로컬은 brew graphviz 16.1.1 + 파이썬 graphviz 0.21로 렌더 성공 [확인됨, MEASURE_M0.md ⑤].

## 4. 맛보기(설치 없이 브라우저)
결정(pedagogy v1.1 근거): 기본은 **Colab 맛보기 노트북**(VALUE_CURRICULUM.md 3절 T1~T7, 02편 S01~S16 압축판). Colab도 설치 없이 브라우저에서 돌고, PyTorch가 필요해 Pyodide로는 같은 코드를 못 돌림. 교사 실측 CPU 약 6초, 손실 3.84 → 2.47(환경에 따라 조금 다름). 앱 검수: 맥 .venv에서 같은 코드를 nbconvert로 돌려 손실 범위(시작 3.7~4.0, 끝 2.6 이하 [가정: 교사 값 기준 허용오차, 실행 후 확정])를 확인.
예비: Colab을 못 여는 사람용으로 앱 안에 "미리 계산한 결과 보기"(손실 그래프·지어낸 이름 10개 그림, 아래 C안). 맛보기 완료는 배지가 아니라 "맛보기 완료" 표시(VALUE_CURRICULUM 2절).

이전 후보 비교(참고):
| 후보 | 장점 | 단점 | 폰에서 |
|---|---|---|---|
| A. Pyodide(브라우저 파이썬) | 진짜 파이썬 코드가 돎. micrograd는 순수 파이썬이라 그대로 실행 가능 | 첫 로딩 수 MB~10MB대 다운로드 [가정: 공식 배포 크기 확인 필요], 저사양 폰 느림, PyTorch 불가 | 느릴 수 있음 |
| B. 자바스크립트로 다시 만든 작은 micrograd + 슬라이더 시각화 | 즉시 반응, 가벼움, 그래프 직접 그림 | 사용자가 파이썬을 직접 치는 경험은 아님 | 좋음 |
| C. 미리 계산한 시각화(애니메이션·단계 그림) | 가장 가볍고 안정 | 상호작용 적음 | 좋음 |
→ v1.1에서 교사가 Colab 기반 맛보기를 확정해 A·B는 보류. C는 Colab 예비 화면으로 사용.

## 5. 데이터 구조 (확장 대비)
원칙: 모든 학습 기록 테이블에 `user_id`. 시간은 ISO 문자열 `+09:00`(SQLite), Postgres에서는 TIMESTAMPTZ로 같은 마이그레이션에서 매핑. SQLite 전용 기능(동적 타입 의존, `INSERT OR REPLACE` 등) 쓰지 않고 표준 SQL + 어댑터에서 upsert 처리. 필드 이름은 pedagogy/data-spec.md(snake_case)가 정본, 화면 이름은 design HANDOFF 6절 대응표로 변환.

| 테이블 | 주요 칼럼 | 비고 |
|---|---|---|
| users | user_id(UUID PK), display_name, created_at, locale | 프로토타입은 1행 고정 |
| step_progress | user_id, step_id(문자열, 예 L01-S14b), status, max_hint_level, attempts, started_at, done_at, active_seconds_auto, active_seconds_user, prediction(예측 칸 글, 없으면 NULL), content_version, updated_at | PK(user_id, step_id) |
| question_attempt | user_id, question_id(문자열, CP1-Q03·F-D2 포함), attempt_no, answer_text, choice_index(객관식 고른 번호, 아니면 NULL), is_dont_know("모르겠어요"), checkpoint_attempt_no(누적 점검 문항이면 그 시도 번호, 아니면 NULL), is_correct, raw_points, max_hint_level, score_ratio, points_awarded, env_issue, at | PK와 번호 규칙은 12.5절 |
| rebuild_attempt | user_id, rebuild_id, passed, max_hint_level, at | |
| mastery_state | user_id, target_id, state, steps_done_ratio, question_score_ratio, must_pass_ok, rebuild_ok, extra_checks_ok, mastered_at, updated_at | |
| review_card | user_id, card_id, source_id, kind, interval_days, due_at, last_result, history_json, updated_at | |
| grade_result | user_id, check_id(문자열, 예 L01-S11b), passed, message_ko, source(notebook/result_code), at, updated_at | PK(user_id, check_id). 노트북 채점 결과(12.7절). P0 추가 |
| user_pref | user_id, pref_key, value_json, updated_at | PK(user_id, pref_key). 실행 장소 선택 등 기기 사이에 맞출 설정. P0 추가 |
| checkpoint_attempt | user_id, checkpoint_id(CP1~CP3), attempt_no, covers_json, score_ratio, passed, max_hint_level, hand_task_self_check_json, started_at, at | 문항별 응답은 question_attempt에 checkpoint_attempt 번호를 달아 저장(checkpoint_attempt_no 칼럼). 잠금 동작(C5)은 설정값으로 |
| diagnostic_result | user_id, attempt_no, answers_json, recommended_units_json, at | 기초 진단 F-D1~F-D5 |
| taste_result | user_id, done_at, loss_start, loss_end, names_json, source(colab/precomputed) | 맛보기 완료 표시용, 사용자가 붙여넣은 값만 |
| help_note | user_id, target_id, goal_ko, last_cell_code, error_last_line, env_json, hints_seen_json, created_at | 사용자 화면에만, 자동 발송 없음 |
| study_session | user_id, session_id, target_id, started_at, ended_at, active_seconds, source(auto/manual) | 실습 시간 원자료 |
| badge_def | badge_id, name_ko, rule_json, icon, version | 규칙은 교사·디자이너 [자리] |
| user_badge | user_id, badge_id, earned_at, evidence_json | PK(user_id, badge_id) |
| share_card | share_id(추측 불가 임의 값), user_id, kind, payload_json, image_path, visibility(기본 private), created_at, revoked_at | 공개 공유 주소는 공개 배포 승인 뒤 |
| sync_conflicts | user_id, table_name, row_key, losing_json, at | 동기화 충돌 기록 |
| alembic_version | Alembic이 스스로 관리하는 버전 표. 따로 만들지 않음 | |

콘텐츠(lecture, step, question, hint, rebuild_task, mastery_rule, checkpoint)는 DB가 아니라 저장소 파일. pedagogy v1.1 반영:
- step: `long_step`(새 코드 6~10줄이면 true, 10줄 초과 오류), `new_code_lines`, `prepared_code`(+줄별 풀이), `video_segments: [{start_s, end_s|null}]`(여러 개 가능, 없으면 []). 전체 165단계. 나눈 단계는 `L01-S14b`처럼 접미 글자라 **step_id는 늘 문자열**, 정렬은 `order` 필드로(문자열 정렬 금지).
- lecture: `youtube_video_id`, `video_seconds`, `video_url`(대체 링크).
- question: `type`에 `choice` 추가, `choices`(2개 이상), `answer_index`(0부터), `auto_grade.type: choice`, `recommend_units_if_wrong`.
- checkpoint: CP1~CP3, 문항 40개, `covers`, `unlocks_lecture`, `items`, `question_ids`, `pass_ratio` 0.8, `max_hint_level` 2, `hand_task_format`, `fail_action`.
- 영상 구간 정본은 `inputs/pedagogy/video-segments.json`(영상 ID·길이·챕터·단계별 구간). 빌드 때 단계 파일과 합치고 어긋나면 빌드 실패.
- 빌드 검사 추가: long_step ↔ new_code_lines 규칙, choice의 answer_index 범위, video_segments의 end_s ≤ video_seconds. 이유: 버전 관리·검수가 쉬움. 각 기록에 `content_version`을 붙여 내용이 바뀌어도 기록이 깨지지 않게.

영상 구간: v1.1에서 초 단위 `video_segments`로 정해짐. 임베드 `https://www.youtube-nocookie.com/embed/{youtube_video_id}?start={start_s}&end={end_s}&rel=0&playsinline=1&cc_load_policy=1&cc_lang_pref=ko&hl=ko`(end_s가 null이면 end 생략), 자동 재생 없음, 늘 "유튜브에서 열기"(`video_url&t={start_s}s`). 구간이 여럿이면 구간 버튼 여러 개. decisions.md C8이 바뀌면 플레이어 부품 한 곳만 고침.

어댑터: `StorageAdapter` 인터페이스(진도 읽기·쓰기, 동기화, 배지 부여, 공유 카드 기록) → `SqliteAdapter`(지금), `PostgresAdapter`(나중). 같은 테스트 묶음을 두 어댑터에 돌리게 설계(Postgres는 나중에 로컬 컨테이너로).

## 6. 확장 경로 (프로토타입 → 일반인 서비스)
1. 계정·로그인 추가, 고정 user_id를 실제 계정에 연결(마이그레이션 1개).
2. Postgres로 이전: 같은 Alembic 이력 적용 + SQLite 데이터 내보내기·가져오기 스크립트.
3. 서버 호스팅·공개 배포·공개 공유 주소: 얼큰이 승인 항목, 비용은 그때 견적.
4. 노트북 공개 저장소(Colab 바로 열기): 공개 배포 승인 항목, PUBLIC_RELEASE_CHECKLIST 적용.
5. 2~10편 콘텐츠 추가(입력 자료는 이미 inputs/에 있음).

## 7. Claude Code 운영 (v1 그대로 유지)

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
| `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` | Advisor 도구 끔(`/advisor` 사용 불가, `advisorModel` 무시) [확인됨: code.claude.com/docs/en/env-vars] | 사용. z2h-run.settings.json env에만. 모델 검증에 다른 모델 값이 섞이지 않게 |

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
- 집계에서 advisor 관련 항목(도구 이름에 advisor가 들어간 호출·결과)이 보이면 따로 분류해 표시(끄기 설정이 듣지 않았다는 신호, 불합격 아님, CTO 보고).
- 실행 중 확인: `/tasks`에서 서브 줄에 모델·강도 표시(v2.1.242 이상).
- 결과는 `docs/model_audit/YYYYMMDD.md`에 남김(값 집계만, 비밀값 없음).

### 지시서 기본 규칙 (PM과 모든 서브에 적용)
1. 커밋·PR 본문에 Co-Authored-By, Claude 꼬리표, Claude 링크 금지.
2. main 병합 금지. 작업은 마일스톤 브랜치(`p1-skeleton-ep01` 등) → PR까지만. 병합은 얼큰이 승인 후.
3. 지정 폴더(저장소 안 해당 마일스톤 범위) 밖 쓰기 금지. `~/.claude/settings.json` 수정 금지.
4. 강제 푸시·`--no-verify`·검사 건너뛰기 금지.
5. 비밀값을 파일·로그·출력에 쓰지 않음. 결제·로그인·키 발급·공개 배포가 필요하면 멈추고 보고.
6. fork 금지, 서브 호출 때 model·effort 인자 넘기지 않음.
7. 원본 영상 재배포 금지(youtube-nocookie 공식 embed·링크만). 라이선스 없는 build-nanogpt는 코드 복사 없이 링크만.
8. 마일스톤이 끝나면 PR 본문에 "한 일 / 테스트 결과 / 맥 실행 로그 요약 / 남은 일"을 쉬운 한국어로.

---


추가 규칙(v2): 서버는 127.0.0.1 바인드, 네트워크·보안 설정 변경 금지(초안만). 서버 공개 운영·유료 서버·DB 생성 금지.

## 8. 검수
| 누가 | 무엇을 | 합격 기준 |
|---|---|---|
| CTO B검토 | PR 전체 | 테스트 먼저 실행, 위험 점검표(외부 쓰기·비밀값·폴더 밖 쓰기·꼬리표·main 접근) 통과, 모델 검증 표 합격 |
| 자동 | 노트북 실행 | 맥에서 `jupyter nbconvert --to notebook --execute` 로 모든 정답 노트북 오류 0, 시간 한도 안. 학생 노트북은 정답 주입 상태로 채점 셀 전부 통과 |
| 자동 | 정답 대조 | z2h_check 테스트(pytest), 기준값 표와 허용오차 일치 |
| 자동 | 콘텐츠 | 스키마 검사, 코드 줄 풀이 누락 0, 확인 문제·힌트 개수, 타임스탬프 범위 |
| 디자이너 몽키 | 화면 | 폰 폭(390px 안팎)·맥 화면 스크린샷 검수, 디자인 토큰 일치, 글자 크기·대비 |
| 자동 + CTO | 글꼴 | Pretendard 400·500·600·700 굵기별 파일 각각 연결, JetBrains Mono. 요소별 computed `font-weight`와 `[...document.fonts].map(f=>f.family+' '+f.weight+' '+f.status)` 전부 `loaded` 확인. button·code·textarea·input에 font-family 직접 지정 확인. 스크린샷만으로 판정 금지(맥에 Pretendard가 깔려 있으면 빠져도 정상처럼 보임) |
| 교사 몽키 | 확인 문제·힌트 | 학습 목표와 문제 연결, 비개발자가 풀 수 있는 난이도, 채점 기준 |
| 리서치 몽키 | 사실 | 타임스탬프·개념 설명이 원본과 일치 (표본 검사) |
| 얼큰이 | 실제 사용 | 1편을 직접 해 보고 막힌 곳 기록 → M2 반영 |

---


추가 검수(v2): 진도 서버 테스트(동기화 충돌, 오프라인 대기열, user_id 누락 0), 마이그레이션 왕복(올리기·내리기), 어댑터 공통 테스트, 글꼴 굵기별 연결(computed weight + document.fonts).

## 9. 일정 (KST) [가정]
가정: 하루 PM 세션 1~2회, 한도로 끊기는 날 있음, 교사·디자이너 랜딩·맛보기 자료가 11/18까지 도착.
| 단계 | 내용 | 목표일 |
|---|---|---|
| P0 | 설계 v2 확정, PM 새 지시서로 재시작 | 11/17(화) |
| P1 | 앱 뼈대 + 진도 서버(SQLite·어댑터·마이그레이션) + 1편 전 과정 + Colab 연결 | 11/21(금) |
| P2 | 랜딩 + 맛보기(자료 도착 후) | 11/25(화) |
| P3 | 배지·공유 카드 화면 + 통합 검수 + 비공개 시연 | 11/28(금) |
| 그다음 | 얼큰이 시연 피드백 → 2~10편 일정 재수립 | 12월 |

## 10. 예상 사용량 (재추정)
- 실측 단서 [확인됨, 1회 관찰]: Fable 5.2 PM이 입력 읽기·설계 확정본 작성 약 6분 동안 Claude 화면의 5시간 한도 표시가 4% → 9%로 올랐음(같은 계정의 다른 세션 사용이 섞였을 수 있음). 7일 표시는 10% 그대로.
- 해석 [가정]: Fable PM을 쉬지 않고 돌리면 5시간 창을 약 2시간 안에 다 쓸 수 있음. 그래서 PM은 오케스트레이션만 하고, 긴 구현은 서브(Opus 5.5 xhigh)에 맡기는 규칙을 유지. 한도에 닿으면 일정을 늘리고 유료 크레딧은 쓰지 않음.
- 세션 수 [가정]: 프로토타입 P0~P3 합계 PM 대화형 세션 6~10회, 서브 작업 15~25건(서브 1건 20~60분 가정, 측정값 없음). P1 끝나고 실제 % 변화로 다시 추정.
- 맥 연산: 1편 노트북 실행 수 분, 검수 재실행 포함 프로토타입 기간 합계 1~2시간 이하 [가정]. Colab 기본이라 사용자 쪽 비용 0.
- 유료 비용: 0원 기본. 서버 호스팅·DB는 승인 후 견적. 10편 원본 재현은 안내 한 줄(실행 계획 없음).

## 11. 위험·결정 필요
- 승인 필요(얼큰이): main 병합, 공개 배포, 저장소 공개 전환, 서버 공개 운영, 유료 서버·DB, 결제.
- CEO 사전 통보: 폰 접속용 Tunnel·Access 생성.
- 조율 상태: decisions.md 기록으로는 C1~C10이 20:07 KST에 모두 닫혔다. PM 지시서는 '조율 중'으로 적혀 있어, C5(누적 점검 잠금)와 C8(영상 끝 초, X6)은 설정값·변환 함수 한 곳으로 둔다(12.6절). 랜딩·배지·공유 카드 문구는 자료 대기.
- 위험: Colab 바로 열기는 공개 저장소가 필요(프로토타입은 우회), Fable 한도 소모가 빠름, 맛보기 Pyodide 로딩 크기, 공유 카드의 개인정보(이름·진도 노출 범위는 기본 비공개).
- 라이선스: MIT 5개 출처 표기, build-nanogpt는 링크만(PUBLIC_RELEASE_CHECKLIST).

## 출처
- Claude Code 문서: model-config, sub-agents, cli-reference, settings-reference(attribution), env-vars(CLAUDE_CODE_DISABLE_ADVISOR_TOOL)
- YouTube 플레이어 매개변수: developers.google.com/youtube/player_parameters (cc_load_policy, cc_lang_pref, hl)
- 원본 저장소: karpathy/micrograd, makemore, nn-zero-to-hero, nanoGPT, minbpe(MIT), build-nanogpt(라이선스 표기 없음)
- 맥 실측: MEASURE_M0.md

---

## 12. P0 확정 (PM, 2026-11-16 KST)

서브 에이전트는 이 절을 계약서로 쓴다. 근거가 없는 값은 지어내지 않고 "미확인" 또는 "자료 대기"로 둔다.

### 12.1 확정 요약
| 항목 | 확정 | 한 줄 이유 |
|---|---|---|
| 앱 | Astro + Preact 부품, 정적 빌드. 버전은 설치 시점 안정판을 `package-lock.json`으로 고정 | 글이 대부분인 앱. 콘텐츠 오류를 빌드 때 잡음 |
| 콘텐츠 | 저장소 루트 `content/` 아래 YAML. 필드 이름은 data-spec.md 그대로 | 교사 자료와 1:1 대응, 앱과 검사 스크립트가 같은 파일을 읽음 |
| 진도 서버 | FastAPI + uvicorn, `127.0.0.1:8787` 고정. 빌드된 앱(`app/dist/`)도 같은 주소에서 제공 | 결정 9. 같은 주소라 브라우저 보안 예외 설정(CORS)이 필요 없음 |
| 저장 | `StorageAdapter`(추상) → `SqliteAdapter`. SQLAlchemy Core의 표준 SQL만 사용 | Postgres로 옮길 때 어댑터만 추가 |
| 스키마 | Alembic 마이그레이션 파일로만 만들고 바꿈. 올리기·내리기 왕복 테스트 | 결정 9 |
| 브라우저 저장 | IndexedDB 대기열 + 마지막 상태 사본 | 결정 3 |
| 실습 | Colab이 기본. 비공개 저장소 기간에는 "노트북 받기 + Colab에 올리기" 안내. 로컬 Jupyter는 선택 | 결정 10, 3절 |
| 채점 결과 전달 | 노트북의 `finish("L01")`이 결과코드를 출력 → 앱에 붙여넣기. 로컬 Jupyter면 서버로 바로 보내기도 시도 | Colab은 맥미니 127.0.0.1에 닿지 못함 |
| 화면 검사 | Playwright(자동 브라우저)로 390px·1280px, 글꼴 로딩·굵기 | HANDOFF 4절·9절 |
| 글꼴 | Pretendard 1.3.9 woff2 4개(400·500·600·700) + JetBrains Mono 가변 1개를 앱 안에 파일로 보관, OFL 사본 동봉 | HANDOFF 4절 |

### 12.2 저장소 폴더
```
app/                  웹앱 (Astro). public/fonts/, src/, scripts/, tests/
content/
  lectures.yaml       10편 목록(홈 지도용: lecture_id, title_ko, youtube_video_id, video_seconds). 2~10편은 이름만
  ep00-basics/units.yaml   1편 선행 기초 단위 목록(추천 표시용)
  ep01-micrograd/     lecture.yaml, steps/*.yaml, questions.yaml, rebuild.yaml
server/               z2h_server/(api, storage, sync), alembic/, tests/. data/ 는 git 제외
z2h_check/            채점 패키지(check, finish, 결과코드, graders/, reference/)
notebooks/ep01-micrograd/  ep01_student.ipynb, ep01_solution.ipynb, README.md(Colab 안내)
tests/                verify_models.py, 노트북 실행 테스트
third_party/licenses/ MIT 원본 LICENSE 전문, 글꼴 OFL
NOTICE.md             원본·저작권자·쓴 위치 표
docs/                 DESIGN.md, MILESTONES.md, PHONE_ACCESS_PLAN.md, model_audit/
inputs/               팀 입력 자료(읽기 전용, 고치지 않음)
```

### 12.3 화면과 주소 (P1)
| 주소 | 화면(flow.md 3절 번호) | P1 |
|---|---|---|
| `/` | A 랜딩 | 뼈대. 문구는 "자료 대기", 맛보기 시작·학습 홈 버튼만 동작 |
| `/home/` | 1 홈·진도 | 구현. 2~10편은 이름과 "준비 중" |
| `/lectures/L01/` | 2 강의 개요 | 구현. 선행 기초 단위 추천 줄(잠금 아님), 노트북 받기·Colab 안내, 결과코드 붙여넣기 |
| `/lectures/L01/{step_id}/` | 3 구간 → 4 따라 하기 → 5 확인 문제, 6 힌트 사다리 | 구현. 주소의 step_id는 문자열 그대로(`S14b`) |
| `/basics/` | 8 사전 기초 | 뼈대. 1편 선행 단위 목록과 추천 표시. 단위 내용·진단은 뒤로 |
| `/taste/`, `/taste/precomputed/` | B·C 맛보기, 미리 계산한 결과 보기 | 뼈대와 데이터 자리. 내용은 P2 |
| `/badges/`, `/share/` | E 배지, 공유 카드 | 뼈대와 데이터 자리. 문구 "자료 대기" |
| `/review/` | 7 복습 | 빈 상태 화면만 |
| `/settings/` | 동기화 상태, 실행 장소, JSON 백업 내보내기 | 구현 |

공통 틀: 상단 바(동기화 표시 포함), 하단 탭, 카드, 버튼, 결과 상자(spec.md 0절). 가입·로그인 화면(D)은 만들지 않는다(로그인은 승인 항목).

### 12.4 콘텐츠 형식 (1편)
- `lecture.yaml`: data-spec lecture 필드 전부 + `notebook{student, solution}`, `mastery_rule`.
- `steps/{step_id 뒷부분}.yaml` (예 `S14b.yaml`): data-spec step 필드 전부(`step_id`, `lecture_id`, `order`, `title_ko`, `long_step`, `new_code_lines`, `prepared_code`, `kind`, `input_ko`, `code`, `code_line_notes_ko`, `expected_ko`, `expected_check`, `meaning_ko`, `objective_ids`) + 아래 앱 전용 칸.
- `video_segments`는 단계 파일에 적지 않는다. 빌드가 `inputs/pedagogy/video-segments.json`에서 읽어 붙인다(정본 하나). 1편 22단계 모두 구간이 1개 이상이어야 빌드 통과.
- 1편 단계는 22개다(S01~S16 + 쪼갠 단계 S09b, S10b, S11b, S13b, S14b, S14c). 근거: pedagogy/01-micrograd.md 3절, video-segments.json.

앱 전용 칸(data-spec에 없음, 교사·디자이너 확인 대기라 모두 선택 칸)
| 칸 | 설명 |
|---|---|
| `prepared_code_line_notes_ko` | 준비 코드 줄별 풀이(개수 = 준비 코드 줄 수) |
| `code_origin` | `{repo, path, license}` 또는 null. 원본에서 가져온 코드의 출처. build-nanogpt는 검사에서 막음 |
| `summary_ko` | 구간 요약 최대 3줄. research/01에 근거가 있을 때만 |
| `concept_ko` | `{term, plain}` 새 개념 1개 |
| `expected_output`, `output_varies`, `tolerance`, `mismatch_hints_ko` | 붙여넣기 비교용(HANDOFF 6절) |
| `notebook_cell` | 노트북 안 칸 이름(예 `S04`), `check_id` |
| `hints` | 힌트 목록을 단계 파일 안에 바로 적음. `hint_ids`는 빌드가 만듦 |
| `question_ids` | 이 단계 뒤에 푸는 문제 |
| `origin` | `pedagogy`(교사 자료 그대로) 또는 `content`(콘텐츠 담당 작성, 교사 검수 대기) |

문제와 힌트
- 문제는 교사의 L01-Q01~Q11만 쓴다. 문제가 없는 단계에 새 문제를 지어 넣지 않는다(익힘 점수 기준을 바꾸지 않기 위해). 문제마다 관련 단계 1곳에 `question_ids`로 건다.
- 힌트는 hints.md 규칙: 코드 단계와 설명·버그 문제에 H1~H4, 예측 문제에는 없음. 교사 예시(S11, Q06)는 그대로 쓰고, 나머지는 콘텐츠 담당이 써서 `origin: content`로 표시한다. H4에는 정답 코드와 줄별 풀이.
- 풀이(`answer_ko`, H4)는 제출 뒤 또는 힌트 열림 조건을 채운 뒤에만 화면에 보인다.
- HELP 메모(5단계)는 P1에서 화면만 두고 저장은 `help_note` 표에 한다. 자동 발송 없음.

빌드 검사(`npm run check:content`, 어기면 빌드 실패)
1. 스키마와 id 모양. step_id는 문자열, 정렬은 `order`.
2. `code` 줄 수 = `code_line_notes_ko` 개수(준비 코드, H4 코드도 같은 규칙).
3. `long_step` ↔ `new_code_lines`(1~5 false, 6~10 true, 10 초과 오류).
4. choice 문항 `choices` 2개 이상, `answer_index` 범위.
5. 영상: 구간 1개 이상, `0 ≤ start_s < end_s ≤ video_seconds`, `youtube_video_id`가 강의와 같음.
6. 문제마다 `answer_ko`와 `rubric`. id 중복 없음. `objective_ids`, `question_ids`, 힌트 대상이 실제로 있음.
7. 화면 글에 긴 줄표(U+2014) 없음. `code`에는 주석을 넣지 않는다(C2, 풀이는 옆 칸).
9. 힌트 개수: 코드 단계와 설명·버그·적용 문제는 H1~H4가 모두 있고, 예측 문제는 0개.
10. `new_code_lines`가 0인 단계(앞 코드를 다시 실행하거나 한 줄을 지우는 S12·S16 같은 단계)는 `long_step` false로 허용.
8. `code_origin.repo`에 build-nanogpt가 있으면 실패. 원본 코드를 쓴 저장소의 LICENSE가 `third_party/licenses/`에 있어야 함.

### 12.5 진도 서버
- 실행: `python -m z2h_server`. 바인드는 `127.0.0.1`만. 다른 주소(`0.0.0.0` 등)를 넘기면 실행을 거부하고 테스트로 확인한다.
- 요청 검사: `Host`가 `127.0.0.1`·`localhost`일 때만 응답(나중에 터널 주소는 설정 파일로 허용). 쓰기 요청은 `Origin`이 있으면 이 서버 주소(127.0.0.1:8787, localhost:8787)일 때만 받고, 없으면(파이썬 `finish()` 등) 받는다. 본문 1MB 제한.
- 사용자: 모든 요청을 고정 user_id `00000000-0000-4000-8000-000000000001`로 처리. 로그인 없음. 어댑터의 모든 함수는 `user_id`를 첫 인자로 받는다.
- 표: 5절 목록 전부(배지·공유 카드 포함)를 첫 마이그레이션에서 만든다. 배지 규칙은 자료 대기라 `badge_def`는 빈 표.
- 이름: DB 칼럼은 목록·객체 값을 `_json`으로 끝나는 글자 칼럼에 담고, API·내보내기에서는 data-spec 이름(`covers`, `history`, `env`, `hints_seen`)으로 돌려준다. `checkpoint_attempt.max_hint_level`은 data-spec의 `max_hint_level_allowed`와 같은 값이다.
- 모든 학습 기록 표에 공통 칼럼 3개: `updated_at`(기기 시각), `content_version`, `server_seq`(서버가 반영할 때마다 1씩 올려 넣는 번호).

표별 열쇠(PK). 5절 표에 PK가 적히지 않은 표는 아래를 따른다.
| 표 | PK | 메모 |
|---|---|---|
| step_progress | user_id, step_id | |
| question_attempt | user_id, question_id, attempt_id | `attempt_id`는 기기가 만든 UUID. `attempt_no`는 서버가 도착 순서로 매김 |
| rebuild_attempt | user_id, rebuild_id, attempt_id | 위와 같음. `max_hint_level`은 노트북이 모르므로 앱의 힌트 기록으로 채움 |
| checkpoint_attempt | user_id, checkpoint_id, attempt_id | 위와 같음 |
| diagnostic_result | user_id, attempt_id | 위와 같음 |
| study_session | user_id, session_id | 기기가 만든 UUID |
| help_note | user_id, note_id | 기기가 만든 UUID |
| mastery_state | user_id, target_id | |
| review_card | user_id, card_id | |
| taste_result | user_id | 한 사람 1행 |
| grade_result | user_id, check_id | |
| user_pref | user_id, pref_key | |
| user_badge | user_id, badge_id | |
| share_card | share_id | |
| sync_conflicts | conflict_id | 서버가 매기는 번호 |
| applied_ops | op_id | 같은 요청 중복 방지 |

- 쌓이는 기록의 번호를 기기가 매기면 두 기기가 오프라인에서 같은 문제를 풀 때 둘 다 1번이 되어 하나가 사라진다. 그래서 열쇠는 기기가 만든 `attempt_id`, 번호(`attempt_no`)는 서버가 매긴다.
- `user_pref` 키(P1): `run_place`(실행 장소), `resume`(이어서 하기 위치: step_id와 단계 안 칸), `practice_week:{주 시작일}`(홈 주간 카드에서 고친 실습 시간 `{edited_seconds, edited_at}`, 지우면 자동 기록으로 되돌아감). 단계별 `active_seconds_user` 칼럼은 두되 P1 화면은 주 단위 수정만 쓴다.

API(모두 JSON)
| 요청 | 하는 일 |
|---|---|
| `GET /api/health` | `{ok, server_time, schema_version}` |
| `GET /api/state?since={server_seq}` | `server_seq`가 그보다 큰 기록과 지금의 가장 큰 `server_seq`. `since`가 없으면 전체. 기기 시각이 아니라 서버 번호로 비교해야 늦게 올라온 옛 기록도 다른 기기가 받는다 |
| `POST /api/sync` | `{client_id, ops:[{op_id, table, key, data, updated_at}]}` → `{applied[], superseded[], rejected[{op_id, reason_ko}], server_time}`. 같은 `op_id`는 한 번만 반영 |
| `POST /api/result-code` | 결과코드를 풀어 `grade_result`로 저장 |
| `POST /api/grade` | 로컬 Jupyter의 `finish()`가 채점 결과를 바로 보냄 |
| `GET /api/export` | 전체 JSON 백업 |

충돌 규칙: 같은 행은 `updated_at`이 늦은 쪽이 이기고 진 값은 `sync_conflicts`에 남긴다. 쌓이는 기록(`question_attempt`, `checkpoint_attempt`, `study_session`)은 열쇠가 다르면 둘 다 남긴다. 진도가 뒤로 가지 않게 `step_progress`의 `status`는 done이 우선, `max_hint_level`과 `active_seconds_auto`는 큰 값.

브라우저: 모든 변경을 먼저 IndexedDB 대기열에 넣고 서버로 보낸다. 표시는 저장됨 / 동기화 중(1초 넘을 때만) / 오프라인(+ "지금 다시 시도"). 재시도는 연결 복구 즉시, 그 밖에는 30초·1분·5분.

### 12.6 바꾸기 쉽게 둔 곳
| 항목 | 지금 기본값 | 두는 곳 |
|---|---|---|
| C5 누적 점검 잠금 | `lock`(통과해야 다음 편이 열림. 닫힌 C5·D36, data-spec, review.md 4절). `recommend`로 바꿀 수 있음 | 앱 설정 파일 한 곳. CP1이 4편을 여는 것이 첫 적용이라 P1(1편)은 화면 영향 없음 |
| C8·X6 `end_s`가 null일 때 | `next_step_start`(다음 단계 시작, 마지막이면 영상 끝). `video_end`로 바꿀 수 있음 | 영상 주소를 만드는 변환 함수 한 곳. 1편은 null이 없어 영향 없음 |
| Colab 바로 열기 주소 | 없음(null) → "Colab에서 열기" 버튼을 숨기고 "노트북 받기 + Colab에 올리기" 안내만 보임 | 앱 설정 파일. 공개 노트북 주소가 승인되면 값만 넣음(질문 5). 3절의 "GitHub 권한 연결로 열기"는 사용자 계정 연결이 필요해 넣지 않음 |
| 숫자 비교 허용 오차 | 상대 1e-4(HANDOFF 8절 제안), 단계별 `tolerance`가 우선 | 비교 함수 한 곳 |

### 12.7 채점
| 갈래 | 어디서 | 무엇을 | 기록 |
|---|---|---|---|
| A 노트북 채점 | Colab 또는 로컬 Jupyter, `z2h_check.check()` | 내가 쓴 코드가 맞게 동작하는지 | `grade_result`. 재구성 과제는 `rebuild_attempt` |
| B 출력 비교 | 앱 따라 하기 칸, 붙여넣기 | 노트북 출력이 예상과 같은지 | 단계 완료를 돕기만 함. 점수 없음 |
| C 확인 문제 | 앱 문제 칸 | 개념 이해. `auto_grade` 종류대로 | `question_attempt` (choice는 `choice_index`) |

- `check("L01-S11b", 값)`: 맞으면 "✓ 맞음", 틀리면 "✕ 다시: 무엇이 다른지"를 한국어로 출력. 틀려도 예외를 던지지 않는다.
- 1편 핵심: 학생의 `Value`로 계산한 기울기를 같은 식의 PyTorch 기울기와 비교(원본 micrograd 테스트 방식). 학습 단계는 손실이 줄었는지와 기준 아래인지. 버전마다 달라지는 값은 범위로 대조.
- Colab에서 쓰기: 비공개 저장소라 설치 주소가 없다. 그래서 `z2h_check`를 파일 하나로 묶어 노트북 준비 셀에 넣는다(묶는 스크립트 + "노트북 안 사본 = 패키지" 테스트).
- 결과코드: `Z2H1.{base64url(JSON)}.{crc32 8자리 16진수 소문자}`. JSON은 `{"v":1,"l":"L01","p":[통과 check_id],"f":[실패 check_id],"t":"시각+09:00"}`(check_id는 `L01-S11b` 같은 전체 글자), crc32는 base64url 글자(패딩 없음)에 대해 계산. 비밀값이 아니고 위조를 막지 않는다(목적은 편의). 오타는 crc32로 잡는다.
- `/api/grade` 본문: `{lecture_id, results:[{check_id, passed, message_ko}], at}`.
- 익힘 판정(1편): 단계 22개 완료 + 교사 문제 점수 80% 이상(힌트 비율 반영. 11점 만점에 8.8점, data-spec `question_score_ratio` 0.8 기준이고 01-micrograd.md의 "9점 이상"과 다른 점은 질문 3) + 재구성 3조각 통과(H2 이하) + 말하기 질문. P1은 앞의 세 조건을 계산해 `mastery_state`에 저장하고, 말하기 질문은 스스로 표시하는 칸으로 둔다.

### 12.8 입력끼리 다른 곳과 PM 처리
| # | 다른 점 | PM 처리 |
|---|---|---|
| 1 | 1편 단계 수: 디자인 문서 16, pedagogy v1.1은 22(쪼갠 단계 포함) | pedagogy 22 |
| 2 | 지시서 "C1~C10 조율 중" / decisions.md "모두 닫힘" | 닫힌 답대로 구현(C5는 잠금, C8은 배열·공유)하되 C5·C8은 12.6절처럼 설정값으로 바꿀 수 있게 |
| 3 | `end_s` null: data-spec "영상 끝까지" / 교사 답 "다음 단계 시작"(X6) | 12.6절. 교사 확인 대기 |
| 4 | 맛보기 실행: 디자인은 브라우저 안 실행(Pyodide) 가정 / 교사는 Colab 노트북(PyTorch 필요) | Colab + "미리 계산한 결과 보기"(4절). 디자인 목업의 "실행" 버튼은 "Colab에서 열기 + 결과 붙여넣기"로 |
| 5 | 맛보기 내용: 디자인 D30은 01편 앞 5단계 / 교사 VALUE_CURRICULUM 3절은 이름 지어내기 | 교사안(지시서 6번) |
| 6 | 저장: 디자인 v2는 계정·서버 DB(X2) / 결정 9는 맥미니 단일 사용자 | 결정 9. 가입·로그인 화면은 만들지 않음 |
| 7 | 문제 ↔ 단계 연결: data-spec에 없음 | 단계에 `question_ids`(12.4절) |
| 8 | 실습 시간 칸 이름: HANDOFF `practice_time` / 5절 `active_seconds_*` + `study_session` | 5절 |

### 12.9 결정이 필요한 질문 (PR 본문 맨 위와 같음)
1. 맛보기 노트북 제작·맥 실행 검증을 P1에 당겨 넣을지, 일정표대로 P2에 둘지. 기본값: P2.
2. 1편 확인 문제는 교사 문제 11개만 쓸지, 문제가 없는 단계에 가벼운 확인 문제를 콘텐츠 담당이 추가할지. 기본값: 교사 문제만.
3. 1편 익힘 문턱: 점수 80%(8.8점, data-spec) / 11점 중 9점 이상(01-micrograd.md 6절). 힌트 비율 때문에 두 값이 갈릴 수 있다. 기본값: 80%.
4. `end_s`가 비었을 때(X6): 다음 단계 시작 / 영상 끝. 기본값: 다음 단계 시작. 1편에는 영향 없음.
5. Colab 바로 열기: 노트북만 담은 공개 주소를 만들지(공개 배포 승인 항목). 기본값: 만들지 않고 "받기 + 올리기" 안내.
