# Z2H 기술 설계 v2 (프로토타입 우선)

- 작성: 2026-11-16 20:10 KST, CTO 몽키. v1(10편 전체, 개인 학습앱)은 DESIGN_DRAFT_v1.md 로 보관.
- 바뀐 이유: 얼큰이 방향 전환(t833u, 2026-11-16 20:06 KST, CEO 전달). 일반인 대상 제품, 프로토타입 먼저.
- 갱신: 20:20 KST pedagogy v1.1·VALUE_CURRICULUM.md·video-segments.json 반영(5절, 4절, 1절).
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

## 0-1. 디자인 v2·v1.3 반영 (2026-11-16 20:32 KST 디자이너 갱신)
- 맛보기: Pyodide 없이 **Colab 8단계**로 확정. 브라우저 안 코드 실행은 범위에서 뺌(4절 A·B안 폐기).
- 영상 구간: `video-segments.json`의 `video_segments`와 `shared_with` 기준. `shared_with`가 있으면 그 단계들 사이에서 플레이어를 유지하고 위치를 이어 감. 구간이 여럿이면 "구간 1/3" 전환기(`cueVideoById`, 재생은 안 함). 영상 없음 상태(iframe 만들지 않고 한 줄 안내).
- D49(20:34, 디자이너 HANDOFF 20:40, X6 대체): `video_segments: []` = 영상 없는 단계. "영상 없음" 상태만 보이고 빈 플레이어(iframe)는 만들지 않음. `end_s`는 **늘 값이 있음**(null 처리 규칙 없음). 빌드 검사: `end_s`가 null·빠짐이면 **실패**, `start_s < end_s ≤ video_seconds`가 아니면 실패.
- D43(X2): 프로토타입도 맥미니 저장이되 **처음부터 계정별 구조**. `users` 테이블과 모든 기록의 `user_id`는 실제 FK. 단일 고정 사용자를 전제로 한 코드 금지(요청마다 현재 사용자에서 user_id를 받음). 공개 서버 DB 종류·위치는 공개 출시 때 CTO 제안 + 얼큰이 승인.
- D44(X3): 로그인은 **이메일 + Google만**, X 로그인 없음(나중 선택지). 실제 메일 발송·Google OAuth는 공개 승인 때 구현. 지금은 `AuthAdapter` 자리 + 로컬 개발용 로그인(여러 계정 만들고 전환 가능, 127.0.0.1 전용, 비밀번호 없음)만.
- D45(X9): "X에 공유"는 X 글쓰기 창(intent)만 열고, 공유 미리 보기 버튼 바로 아래 "저장한 이미지를 첨부해 주세요" 안내. 맛보기 결과 카드(`card_names`)와 `v2_taste_done` 이름 결과 아래 "첫 모델이라 아직 서툴러요".
- D46(X12): 랜딩 문구와 약관·개인정보 문구는 공개 전 승인 항목. 목업 "예시 화면" 표시 유지.
- D47(X10): 단계 배지는 **누적 점검(CP) 통과**로 받음. CP1 → 언어 모델 견습, CP2 → 신경망 정비사, CP3 → GPT 제작자(수료). CP 단독 배지 없음. `c4_cp_result`에 배지 표시. 배지 부여는 `checkpoint_attempt` 통과 기록에서 서버가 계산.
- D48(X11): 회사원·투자자 길에서만 07편 전 03·04 다리 카드 2장. 스키마에 **선택 필드**로 `bridge_card` 추가(아래 5-1). 확인 문제 결과는 복습 추천에만, 07편 잠그지 않음. 내용 원본 `pedagogy/bridge-cards-03-04.md`(작성 중).
- 단계 수 확정(D51, HANDOFF 20:53, data-spec v1.2): 01편 **26단계**, 10편 합 **169단계**(맛보기 8단계 별도). 그래도 단계 수 하드코딩 금지(분모는 데이터). HANDOFF 7-2 새 필드(모두 선택 필드, 모르는 필드는 경고): step `edits[]`(`target_step`, `where_ko`, `action` insert|replace, `anchor_line`(null = 셀 맨 아래), `line_count`), `rerun_first[]`, `moved_code_lines`, `prepared_code_line_notes_ko`, `prepared_code_source_ko`, `kind: copy_run`·`expected_output_example`·`aha_ko`·`code_alt_local`(맛보기), 문항 `after_step`·`scored`(false면 제출 없이 바로 풀이, 점수·복습 없음)·`alternate_of`, 힌트 `show_solution`, 편 `rewards`(`stamp`, `badge_progress`, `artifact`), 학습자 `path_id`, checkpoint `path_variants[]`(+`gate`), 배지 변형(`badge_on_pass` id, 예 `BADGE-S1-SUMMARY`). **삭제**: `cell_mode`, `changed_lines_only`.
- 바뀐 줄만 보여 주는 화면(spec 4.2-1, 목업 `c7_edits`): 비교(diff) 도구 없이, `anchor_line`은 회색 한 줄, 그 아래 넣을 줄(replace면 바뀐 뒤 줄) 강조, "전체 보기"로 셀 전체 펼침. `rerun_first`는 위에 "먼저 다시 실행: L01-S04 셀" 안내.
- 요약 경로(spec 12.5, 회사원·투자자 길): CP 점수 기준(`path_variants`의 replace·remove·pass_ratio)과 `gate`는 **프로토타입 범위 밖**(07편 이후). 스키마·DB에 자리만 두고 계산 코드는 만들지 않음. `path_id`(full|office_worker|investor, 기본 full)는 진도 기록(users·step_progress·checkpoint_attempt)에 포함. "전체 길로 바꾸기"는 path_id만 full로, 기록은 그대로.
- 맛보기 완료·공유(D30·D45): Colab에서 사용자가 **스스로 완료를 확인**("비슷해요 / 달라요")하고, 결과(지어낸 이름, 손실 값)를 **붙여넣어** 공유 카드를 만든다. `taster_result`에 `self_reported`와 붙여넣은 값을 저장(검증 안 된 값이라는 표시).
- 영상 없는 단계: `L08-S01`·`L08-S04`·`L08-S08`과 맛보기(전부). 빌드 검사로 이 목록과 데이터의 빈 `video_segments`가 일치하는지 확인.
- D56(X15 닫힘): 맛보기 이름 카드는 **1200 × 675** 하나로 확정(1080 정사각판 없음).
- D57(X16 닫힘): 요약 경로 순서 = 01 → 02 → 03 다리 카드 6장 → CP1(요약) → 04 다리 카드 4장(07편 관문) → 07 → 그 길의 남은 편 → CP3(요약, 줄인 판). 07 뒤의 편은 코드에 08·09·10을 고정하지 않고 `path_id`로 계산(길별 편 목록은 콘텐츠 데이터/설정 한 곳). 프로토타입 범위 밖이라 순서 계산 함수 자리와 데이터 필드만 둠.
- 남은 열린 항목: X4(X 이미지 첨부 방식), X5(동의·약관 법적 검토), X8(맛보기 보관 7일·코드 10분·재전송 60초 값, 설정값으로).
- 맛보기 노트북: Colab .ipynb는 `pedagogy/taster.md` 셀 내용(`content/taster.json`)으로 구현 쪽(P2)이 만듦. 검수 기준 = `inputs/pedagogy/content/test_content.py` 통과(CPU 약 7초, 손실 3.839 → 2.472).
- 10편 1000스텝 실측은 프로토타입 뒤로 미룸(PM과 맥 자원 다투지 않게).

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
| 성취 배지 | 단계 배지 3개 = CP 통과(D47), 편 도장 10개, 맛보기 완료 표시 | 테이블 5절, 규칙은 `badge_rules` 설정 한 곳, 요약 경로 배지 변형은 `badge_on_pass` id(자리만) |
| 공유 카드 | 이미지 카드 | [자리] 테이블은 지금 설계, 프로토타입은 내 기기에 이미지 저장만(공개 공유 주소 없음) |
| 2~10편 | 프로토타입 뒤 | 아님 (자료는 inputs/에 보관) |

## 2. 앱 구조
| 층 | 프로토타입 | 나중(승인 후) |
|---|---|---|
| 화면 | Astro + Preact 부품, 정적 빌드 | 같음 (CDN 배포) |
| 진도 서버 | Python FastAPI, 맥미니 127.0.0.1 바인드, 정적 파일도 제공 | 같은 코드를 서버 호스팅에 올림 |
| 저장 | SQLite 파일 1개 (`StorageAdapter` 뒤) | Postgres 어댑터로 교체 |
| 스키마 관리 | Alembic 마이그레이션 파일(SQLite·Postgres 둘 다 지원) | 같은 마이그레이션을 Postgres에 적용 |
| 사용자 | 계정별 구조(users + FK), 로컬 개발용 로그인으로 여러 계정 전환. 고정 사용자 전제 코드 금지 | 실제 가입(이메일 코드·Google, X는 나중) 추가는 CEO 조율·공개는 승인 항목 |
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
원칙: 모든 학습 기록 테이블에 `user_id`(users FK, ON DELETE CASCADE). 시간은 ISO 문자열 `+09:00`(SQLite), Postgres에서는 TIMESTAMPTZ로 같은 마이그레이션에서 매핑. SQLite 전용 기능(동적 타입 의존, `INSERT OR REPLACE` 등) 쓰지 않고 표준 SQL + 어댑터에서 upsert 처리. 필드 이름은 pedagogy/data-spec.md(snake_case)가 정본, 화면 이름은 design HANDOFF 6절 대응표로 변환.

| 테이블 | 주요 칼럼 | 비고 |
|---|---|---|
| users | user_id(UUID PK), path_id(full·office_worker·investor, 기본 full), display_name, created_at, locale | 여러 계정 가능(로컬 개발 로그인으로 생성). 다른 테이블의 user_id는 FK |
| auth_identity | provider(dev_local 지금, email_otp·google 나중), subject, user_id(FK), created_at | AuthAdapter 뒤. 메일 발송·OAuth 미구현 |
| sessions | session_id, user_id(FK), created_at, expires_at | 로컬 개발 로그인 세션 |
| step_progress | user_id, path_id, step_id(문자열, 예 L01-S14b), status, max_hint_level, attempts, started_at, done_at, active_seconds_auto, active_seconds_user, updated_at | PK(user_id, step_id) |
| question_attempt | user_id, question_id(문자열, CP1-Q03·F-D2 포함), attempt_no, answer_text, choice_index(객관식 고른 번호, 아니면 NULL), is_dont_know("모르겠어요"), is_correct, raw_points, max_hint_level, score_ratio, points_awarded, env_issue, context(step·checkpoint·bridge·taste), at | PK(user_id, question_id, attempt_no) |
| rebuild_attempt | user_id, rebuild_id, passed, max_hint_level, at | |
| mastery_state | user_id, target_id, state, steps_done_ratio, question_score_ratio, must_pass_ok, rebuild_ok, extra_checks_ok, mastered_at, updated_at | |
| review_card | user_id, card_id, source_id, kind, interval_days, due_at, last_result, history_json, updated_at | |
| checkpoint_attempt | path_id, user_id, checkpoint_id(CP1~CP3), attempt_no, covers_json, score_ratio, passed, max_hint_level, hand_task_self_check_json, started_at, at | 문항별 응답은 question_attempt에 checkpoint_attempt 번호를 달아 저장(checkpoint_attempt_no 칼럼). 잠금 동작(C5)은 설정값으로 |
| diagnostic_result | user_id, attempt_no, answers_json, recommended_units_json, at | 기초 진단 F-D1~F-D5 |
| taster_result | user_id(FK), attempt_no, step_id(T-S01~T-S08), self_reported(similar·different), pasted_names_text, pasted_loss_start, pasted_loss_end, share_card_id(NULL 가능), at | 맛보기 본인 확인 + 붙여넣은 값(검증 안 됨 표시). PK(user_id, attempt_no, step_id) |
| taste_result | user_id, done_at, loss_start, loss_end, names_json, source(colab/precomputed) | 맛보기 완료 표시용, 사용자가 붙여넣은 값만 |
| help_note | user_id, target_id, goal_ko, last_cell_code, error_last_line, env_json, hints_seen_json, created_at | 사용자 화면에만, 자동 발송 없음 |
| study_session | user_id, session_id, target_id, started_at, ended_at, active_seconds, source(auto/manual) | 실습 시간 원자료 |
| badge_def | badge_id, name_ko, rule_json, icon, version | D47: 단계 배지 3개 = CP1·CP2·CP3 통과, 편 도장 10개. rule_json은 `badge_rules` 설정에서 생성, 요약 배지 변형(BADGE-S1-SUMMARY 등) 행은 자리만 |
| user_badge | user_id, badge_id, earned_at, evidence_json | PK(user_id, badge_id) |
| share_card | share_id(추측 불가 임의 값), user_id, kind, payload_json, image_path, visibility(기본 private), created_at, revoked_at | 공개 공유 주소는 공개 배포 승인 뒤 |
| sync_conflicts | user_id, table_name, row_key, losing_json, at | 동기화 충돌 기록 |
| schema_migrations | Alembic 관리 | |

콘텐츠(lecture, step, question, hint, rebuild_task, mastery_rule, checkpoint)는 DB가 아니라 저장소 파일. pedagogy v1.1 반영:
- step: `long_step`(새 코드 6~10줄이면 true, 10줄 초과 오류), `new_code_lines`, `prepared_code`(+줄별 풀이), `video_segments: [{start_s, end_s}]`(여러 개 가능, 없으면 [] = 영상 없는 단계, end_s 늘 필수, D49). 전체 169단계(D51, 맛보기 8단계 별도). 나눈 단계는 `L01-S14b`처럼 접미 글자라 **step_id는 늘 문자열**, 정렬은 `order` 필드로(문자열 정렬 금지).
- 5-1 `bridge_card`(D48, 선택, 디자이너 제안 필드): `bridge_id`, `lecture_id`("L03"/"L04"), `title_ko`, `body_ko`(한 문단), `figure_ko` 또는 `mini_practice`(둘 중 하나, 선택), `questions`(1~2개, `type: "choice"`, 점수 없음, "모르겠어요" 포함), `video_segments`(03·04편 구간, 위 규칙 동일), `paths`(["office","investor"]). 응답은 `question_attempt`에 `context="bridge"`로 저장(새 테이블 없음).
- lecture: `youtube_video_id`, `video_seconds`, `video_url`(대체 링크).
- question: `type`에 `choice` 추가, `choices`(2개 이상), `answer_index`(0부터), `auto_grade.type: choice`, `recommend_units_if_wrong`.
- checkpoint: CP1~CP3, 문항 40개, `covers`, `unlocks_lecture`, `items`, `question_ids`, `pass_ratio` 0.8, `max_hint_level` 2, `hand_task_format`, `fail_action`.
- 영상 구간 정본은 `inputs/pedagogy/video-segments.json`(영상 ID·길이·챕터·단계별 구간). 빌드 때 단계 파일과 합치고 어긋나면 빌드 실패.
- 빌드 검사 추가: long_step ↔ new_code_lines 규칙, choice의 answer_index 범위, video_segments의 end_s 필수(null이면 실패)·start_s < end_s ≤ video_seconds, X13 새 필드는 선택(모르는 필드 경고), edits[].target_step·rerun_first id가 같은 편 안, alternate_of 문항은 원 문항과 type·max_points 같음, code 줄 수 = new + moved(+replace), bridge_card 선택 스키마. 이유: 버전 관리·검수가 쉬움. 각 기록에 `content_version`을 붙여 내용이 바뀌어도 기록이 깨지지 않게.

영상 구간: v1.1에서 초 단위 `video_segments`로 정해짐. 임베드 `https://www.youtube-nocookie.com/embed/{youtube_video_id}?start={start_s}&end={end_s}&rel=0&playsinline=1&cc_load_policy=1&cc_lang_pref=ko&hl=ko`(end_s 늘 있음, D49), 자동 재생 없음, 늘 "유튜브에서 열기"(`video_url&t={start_s}s`). 구간이 여럿이면 구간 버튼 여러 개. 빈 배열이면 플레이어 대신 "영상 없음" 상태.

어댑터: `StorageAdapter` 인터페이스(진도 읽기·쓰기, 동기화, 배지 부여, 공유 카드 기록) → `SqliteAdapter`(지금), `PostgresAdapter`(나중). 같은 테스트 묶음을 두 어댑터에 돌리게 설계(Postgres는 나중에 로컬 컨테이너로).

## 6. 확장 경로 (프로토타입 → 일반인 서비스)
1. AuthAdapter에 실제 가입(이메일 일회용 코드, Google) 구현. 구조는 이미 계정별이라 스키마 변경 최소.
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
2. main 병합 금지. 작업은 마일스톤 브랜치(`m1-skeleton-ep01` 등) → PR까지만. 병합은 얼큰이 승인 후.
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
- 열린 항목: X4·X5·X8뿐(디자인 decisions D1~D57, 20:56). X13~X16은 닫힘(요약 경로 CP·gate·순서 계산은 프로토타입 밖, 자리만). 공개 전 승인: 랜딩·약관·개인정보 문구(D46). 디자인 결정은 decisions.md D1~D49(20:40 HANDOFF) 기준.
- 위험: Colab 바로 열기는 공개 저장소가 필요(프로토타입은 우회), Fable 한도 소모가 빠름, 맛보기 Pyodide 로딩 크기, 공유 카드의 개인정보(이름·진도 노출 범위는 기본 비공개).
- 라이선스: MIT 5개 출처 표기, build-nanogpt는 링크만(PUBLIC_RELEASE_CHECKLIST).

## 출처
- Claude Code 문서: model-config, sub-agents, cli-reference, settings-reference(attribution), env-vars(CLAUDE_CODE_DISABLE_ADVISOR_TOOL)
- YouTube 플레이어 매개변수: developers.google.com/youtube/player_parameters (cc_load_policy, cc_lang_pref, hl)
- 원본 저장소: karpathy/micrograd, makemore, nn-zero-to-hero, nanoGPT, minbpe(MIT), build-nanogpt(라이선스 표기 없음)
- 맥 실측: MEASURE_M0.md

---

## 12. P0·P1 구현 계약 (PM, 2026-11-16 22:10 KST 갱신)

0~11절(m0-setup 본문)은 그대로 두고, 이 절은 그 위에서 구현이 따르는 세부 계약이다. 0~11절과 다르면 0~11절이 이긴다. 다만 12.5절의 "5절과 다르게 둔 곳" 표는 이유와 함께 확인을 기다린다. 근거가 없는 값은 지어내지 않고 "미확인" 또는 "자료 대기"로 둔다.

### 12.1 확정 요약
| 항목 | 확정 | 한 줄 이유 |
|---|---|---|
| 앱 | Astro 7 + Preact 부품, 정적 빌드. 버전은 `app/package-lock.json`으로 고정 | 글이 대부분인 앱. 콘텐츠 오류를 빌드 때 잡음 |
| 콘텐츠 정본 | 교사가 만든 `inputs/pedagogy/content/L01.json`(손으로 고치지 않음). 앱 로더 한 곳이 그대로 읽음 | data-spec 검수 규칙 10 |
| 진도 서버 | FastAPI + uvicorn, `127.0.0.1:8787` 고정. 빌드된 앱(`app/dist/`)도 같은 주소에서 제공 | 결정 9. 같은 주소라 브라우저 보안 예외 설정(CORS)이 필요 없음 |
| 저장 | `StorageAdapter`(추상) → `SqliteAdapter`. SQLAlchemy Core의 표준 SQL만 | Postgres로 옮길 때 어댑터만 추가 |
| 스키마 | Alembic 마이그레이션 파일로만. 올리기·내리기 왕복 테스트 | 결정 9 |
| 계정 | 고정 사용자 없음. `AuthAdapter` → `LocalDevAuth`(여러 계정 만들기·바꾸기, 이 컴퓨터 안 요청만). 이메일·Google은 자리만 | D43·D44 |
| 브라우저 저장 | IndexedDB 대기열 + 마지막 상태 사본, 계정별로 나눔 | 결정 3 |
| 실습 | Colab이 기본. 비공개 저장소 기간에는 "노트북 받기 + Colab에 올리기" 안내. 로컬 Jupyter는 선택 | 결정 10 |
| 채점 결과 전달 | 노트북의 `finish("L01")`이 결과코드를 출력 → 앱에 붙여넣기 | Colab은 맥미니 127.0.0.1에 닿지 못함 |
| 화면 검사 | Playwright(자동 브라우저)로 390px·1280px, 글꼴 로딩·굵기 | HANDOFF |
| 글꼴 | Pretendard 1.3.9 woff2 4개 + JetBrains Mono 가변 1개를 앱 안에 파일로, OFL 사본 동봉 | HANDOFF 4절 |

### 12.2 저장소 폴더
```
app/                  웹앱 (Astro). public/fonts/, src/, scripts/, tests/
content/              lectures.yaml(10편 목록), ep00-basics/units.yaml(1편 선행 단위),
                      ep01-micrograd/overlay_draft.yaml(앱 전용 칸 초안, 교사 확인 대기, 아직 화면에 쓰지 않음)
server/               z2h_server/, alembic/, tests/. data/ 는 git 제외
z2h_check/            채점 패키지(check, finish, 결과코드, graders/, reference/, 묶음)
notebooks/ep01-micrograd/  학생용·정답용 노트북(교사 정본에서 생성), 생성 스크립트, Colab 안내
tests/                verify_models.py, 채점 패키지 테스트
third_party/licenses/ MIT 원본 LICENSE 전문 5개, 글꼴 OFL
NOTICE.md             원본·저작권자·쓴 위치 표
inputs/               팀 입력 자료(읽기 전용)
```

### 12.3 화면과 주소 (P1)
| 주소 | 화면 | P1 |
|---|---|---|
| `/` | 랜딩 | 뼈대. 문구는 "자료 대기"·"예시 화면" 표시(공개 전 승인 항목) |
| `/home/` | 홈·진도 | 구현. 2~10편은 이름과 "준비 중" |
| `/lectures/L01/` | 강의 개요 | 구현. 선행 기초 단위 추천(잠금 아님), 노트북 받기 안내, 결과코드 붙여넣기 |
| `/lectures/L01/{step_id 뒷부분}/` | 구간 → 따라 하기 → 확인 문제, 힌트 사다리 | 구현. 앞 셀을 고치는 단계는 "바뀐 줄만" 화면(기준 줄 회색 한 줄 + 새 줄 강조 + 전체 보기) |
| `/basics/`, `/taste/`, `/taste/precomputed/`, `/badges/`, `/share/`, `/review/` | 기초, 맛보기, 배지, 공유 카드, 복습 | 뼈대와 데이터 자리 |
| `/settings/` | 동기화 상태, 실행 장소, JSON 백업, 개발용 계정 바꾸기 | 구현 |

가입·로그인 화면(이메일·Google)은 만들지 않는다. 자리 문구만 둔다. X 로그인 없음.

### 12.4 콘텐츠와 빌드 검사
- 단계 수는 코드에 박지 않고 콘텐츠에서 센다(지금 01편 26단계, 전체 169단계, 맛보기 8단계 별도. 최종 수는 X13).
- 빌드 검사(`npm run check:content`, 어기면 빌드 실패): 스키마와 id 모양(step_id는 문자열, 정렬은 `order`) / `code` 줄 수 = `new_code_lines` + `moved_code_lines`(+ 바꾸는 줄), 줄별 풀이 개수 일치 / `long_step` 규칙(0~5 false, 6~10 true, 10 초과 오류, `copy_run` 제외) / choice 문항 보기와 정답 번호 범위 / 영상: `end_s` 필수, `start_s < end_s ≤ video_seconds`, 빈 배열은 "영상 없는 단계" 목록(L08-S01·S04·S08, 맛보기. 설정 한 곳)과 맞아야 함 / 문제마다 `answer_ko`와 `rubric`, id 중복 없음, `rerun_first`·`edits[].target_step`·`after_step`이 같은 편 안 / 힌트 개수(코드 단계와 설명·버그·적용 문제는 H1~H4, 예측 문제는 0개) / 화면 글에 긴 줄표(U+2014) 없음 / build-nanogpt 출처 금지.
- 경고만 내는 것: 모르는 필드, `code` 안의 `#` 줄(정본 L01-S16이 줄을 막는 단계라 실패로 두지 않음).
- 풀이(`answer_ko`, H4 정답)는 제출·열림 조건 전에는 화면 DOM에 없다.
- 문제는 교사 문제 11개만. 새 문제를 지어 넣지 않는다.

### 12.5 진도 서버
- 실행 `python -m z2h_server`. 바인드는 `127.0.0.1`만, 다른 주소는 실행 거부. `Host`가 `127.0.0.1`·`localhost`일 때만 응답. 쓰기 요청은 `Origin`이 있으면 이 서버 주소일 때만, 없으면 받음. 본문 1MB 제한.
- 개발용 로그인 잠금: 이 컴퓨터 안에서 직접 온 요청에만 동작. 전달 머리말(`CF-Connecting-IP`, `X-Forwarded-For` 등)이 있으면 거부. 허용 Host에 바깥 주소(터널 주소)를 넣거나 `Z2H_DEV_AUTH=0`이면 개발용 로그인이 통째로 꺼지고, 그때 기록 API는 로그인 수단이 없어 401이다. 폰 접속은 Tailscale serve(tailnet 안, Funnel 금지)로 정해졌고(CTO 22:35), serve도 프록시라 같은 잠금이 걸린다. 그래서 로그인 장치가 생기기 전에는 폰에서 진도를 읽고 쓸 수 없다. 로그인 장치는 안만 적고 구현하지 않는다. `docs/PHONE_ACCESS_PLAN.md`에서 다룬다.
- API: `GET /api/health`, `GET /api/state?since={server_seq}`, `POST /api/sync`, `POST /api/result-code`, `POST /api/grade`, `GET /api/export`, `GET·POST /api/me`, `/api/dev-auth/{accounts,login,logout}`. 요청·응답 모양의 정본은 `server/API.md`(문서와 코드가 어긋나면 테스트 실패).
- 동기화: 모든 기록 표에 `updated_at`(기기 시각), `content_version`, `server_seq`(서버가 반영할 때마다 1씩 올리는 번호). 이어 받기는 기기 시각이 아니라 `server_seq`로 비교한다. 같은 행은 `updated_at`이 늦은 쪽이 이기고 진 값은 `sync_conflicts`에 남긴다(같은 기기의 연속 수정과 `base_updated_at`이 서버 값과 같은 수정은 충돌로 남기지 않음). `step_progress`는 진도가 뒤로 가지 않게 status는 done 우선, `max_hint_level`·`active_seconds_auto`·`attempts`는 큰 값.
- 쌓이는 기록(`question_attempt`, `rebuild_attempt`, `checkpoint_attempt`, `diagnostic_result`)의 열쇠는 기기가 만든 `attempt_id`, 번호(`attempt_no`)는 서버가 도착 순서로 매긴다. 기기가 번호를 매기면 두 기기가 오프라인에서 같은 문제를 풀 때 하나가 사라지기 때문이다.
- `user_pref` 키: `run_place`(실행 장소), `resume`(이어서 하기 위치), `practice_week:{주 시작일}`(홈에서 고친 실습 시간 `{edited_seconds, edited_at}`, 비우면 자동 기록으로 되돌아감). 말하기 질문 자가 표시는 `mastery_state.extra_checks_ok`.
- 요약 경로(CP 점수 기준, gate)와 단계 배지 계산은 스키마·자리만 있고 계산 코드는 없다. 서버는 동기화로 온 `user_badge` 행을 그대로 받는다(badge_id를 검증하지 않음). 단계 배지를 누가 계산하고 검증할지는 누적 점검을 만들 때 정한다.

5절과 다르게 둔 곳(확인 대기)
| 5절 | 구현 | 이유 |
|---|---|---|
| `question_attempt` PK(user_id, question_id, attempt_no) | PK(user_id, question_id, attempt_id), attempt_no는 서버가 매김. `rebuild_attempt`·`checkpoint_attempt`·`diagnostic_result`도 같은 방식, `help_note`는 note_id | 두 기기 오프라인 충돌 방지 |
| `schema_migrations` | Alembic 기본 표 `alembic_version` | Alembic이 스스로 관리하는 표를 따로 만들지 않음 |
| 표에 없음 | `grade_result`(노트북 채점 결과), `user_pref`, `step_progress.prediction`, `question_attempt.checkpoint_attempt_id`, 공통 칼럼 `server_seq`·`content_version`·`last_client_id`, `applied_ops`, `sync_counter` | 채점 결과 저장, 설정 동기화, 예측 칸, 동기화 판정 |
| `taste_result`와 `taster_result` 둘 다 있음 | 둘 다 만듦. 앱은 `taster_result`만 씀 | 5절에 둘 다 적혀 있음. 하나로 합칠지 확인 필요 |
| 이름 카드: 20글자 넘는 이름은 앞 20글자 + … (taster.md 4절, spec 13.5) | 20글자 넘는 줄과 a~z 밖 글자가 있는 줄은 저장·카드에서 뺌 | 개인 정보를 붙여 넣는 경우 대비(P2 검수). 교사·디자이너 확인 대기 |
| 맛보기 완료는 배지가 아닌 표시(VALUE 2절) | 화면은 표시로만 보이고, 저장은 `user_badge`에 `TASTER-DONE` 행 | 완료 기록을 둘 표가 따로 없어서. 교사 확인 대기 |
| 단계 배지 3개(1절·5절) / 화면은 4장(spec 13.4: 0 첫 셀 완주 포함) | 화면 4장. 0번 id `BADGE-S0`은 앱이 임시로 붙임 | spec 13.4. id는 교사 확인 대기 |

### 12.6 바꾸기 쉽게 둔 설정값
| 항목 | 지금 값 | 두는 곳 |
|---|---|---|
| 누적 점검 잠금(C5) | `lock`. `recommend`로 바꿀 수 있음 | `app/src/config.ts` |
| Colab 바로 열기 주소 | null → 버튼 숨김, "받기 + 올리기" 안내 | `app/src/config.ts` |
| 숫자 비교 허용 오차 | 상대 1e-4 | `app/src/config.ts` |
| 영상 없는 단계 목록 | L08-S01·S04·S08, 맛보기 | `app/src/content-config.mjs` |
| 공유 카드 크기 | 1200x675 | `app/src/config.ts` |
| 배지 규칙 | 편 도장(그 편 익힘)과 맛보기 완료 표시는 앱이 계산해 `user_badge`에 저장. 단계 배지(CP 통과)와 요약 경로 변형은 자리만 | `app/src/badge-rules.ts` |
| 익힘 문턱 | 교사 정본 `mastery_rule` 값을 읽음 | 콘텐츠 |

### 12.7 채점
- 세 갈래: A 노트북 채점(`z2h_check.check()` → `grade_result`), B 앱의 출력 붙여넣기 비교(점수 없음), C 앱의 확인 문제(`question_attempt`).
- 채점 칸 id는 단계 id 그대로 + 재구성 `L01-R1`~`R3`. 개수는 등록 목록에서 센다. 틀리거나 미완성이어도 예외를 던지지 않는다.
- 1편 핵심: 학생의 `Value`로 계산한 기울기를 PyTorch 기울기와 비교. 무작위로 달라지는 값은 범위로. 학습 반복 칸(S15b)은 정본에 시드 고정이 없어 "손실이 줄었는지"만 보고 0.1 위면 "한 번 더 실행" 안내(교사 확인 대기). 재구성 R3는 0.1 미만.
- Colab용: 패키지를 파일 하나로 묶어 노트북 준비 셀에 넣는다("노트북 안 사본 = 패키지" 테스트).
- 결과코드: `Z2H1.{base64url(JSON)}.{crc32 8자리 16진수 소문자}`, JSON은 `{"v":1,"l":"L01","p":[통과 id],"f":[실패 id],"t":"시각+09:00"}`, crc32는 base64url 글자(패딩 없음)에 대해. 비밀값이 아니고 위조를 막지 않는다. 서버·앱·채점 패키지가 같은 기준 예시로 테스트한다.
- 로컬 Jupyter의 자동 전송(`/api/grade`)은 계정을 알려야 저장된다(`X-Z2H-User`). 노트북이 계정 번호를 얻는 방법은 미정이라 지금은 거부되면 결과코드로 넘어간다.

### 12.8 열린 것 (PM이 본 것. 디자인·교사의 X 항목과 별개)
1. 맛보기 노트북: CTO 20:47 통지로 P2 확정(닫힘).
2. 1편 확인 문제는 교사 문제 11개만(기본값 유지, 확인 대기).
3. 익힘 문턱: 교사 정본 `mastery_rule`을 따른다(P0 질문 3 닫음).
4. `end_s` 빈 값: D49로 닫힘.
5. Colab 바로 열기용 공개 노트북 주소: 공개 배포 승인 항목, 열림.
6. 로컬 Jupyter 자동 전송의 계정 지정 방법(12.7절).
7. 폰 접속(Tailscale serve)에서 쓸 로그인 장치: `docs/PHONE_ACCESS_PLAN.md` 2절의 A~D안 중 결정 필요(보안 변경이라 CTO 결정).
8. 같은 구간을 쓰는 단계 사이 재생 위치 유지: YouTube 외부 스크립트(IFrame API) 없이는 안 되어 만들지 않음. 외부 스크립트를 허용할지 결정 필요.
9. `taste_result`·`taster_result` 중복(12.5절).
