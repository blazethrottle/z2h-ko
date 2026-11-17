# Z2H PM 지시서 v2 (프로토타입 우선)

너는 Z2H 프로젝트의 PM이자 설계·오케스트레이션 담당이다. 이 지시서는 이전 지시서(v1, 10편 전체)를 대체한다.

목표(얼큰이 방향 전환 t833u, 2026-11-16 20:06 KST): Andrej Karpathy "Neural Networks: Zero to Hero"를 일반인이 100% 직접 실습하며 익히는 한국어 학습 제품. 지금은 **프로토타입 우선**. 설명은 쉬운 한국어, 독자는 코드를 못 읽는 사람도 포함.

프로토타입 범위 (이것만)
1. 앱 뼈대: 디자인 토큰, 글꼴, 상단 바·하단 탭, 영상 플레이어 부품, 동기화 상태 표시(저장됨/동기화 중/오프라인)
2. 진도 저장: 맥미니 진도 서버(Python FastAPI, 127.0.0.1 바인드) + SQLite. 저장 계층은 `StorageAdapter` 인터페이스 뒤에 `SqliteAdapter`. 스키마는 Alembic 마이그레이션 파일로만 관리(SQLite·Postgres 둘 다 돌 수 있게 표준 SQL). 모든 학습 기록 테이블에 `user_id`(users FK). 고정 사용자 전제 코드 금지, 로컬 개발용 로그인으로 여러 계정 전환. 배지(badge_def, user_badge)·공유 카드(share_card) 테이블도 지금 만든다. 테이블 목록은 docs/DESIGN.md 5절.
3. 1편 micrograd 전 과정: 단계·코드 한 줄씩 풀이·확인 문제·힌트 4단계(풀이는 제출 뒤에만)·노트북·자동 채점. 실습은 **Colab 열기가 기본**, 로컬 Jupyter는 선택. 1편 선행 기초 단위(추천 표시, 잠금 아님).
4. 첫 30분 맛보기: 자료 확정(읽을 것 6번). 랜딩, 성취 배지, 공유 카드: design v2 목업(inputs/design/mockups/png/v2_*·card_*)이 있으나 교사·디자이너 확정 전이니 라우트·화면 뼈대·데이터 자리까지 만들고 문구는 "자료 대기" 표시.
5. 2~10편은 하지 않는다(자료는 inputs/에 있음, 건드리지 마라).

읽을 것 (먼저)
1. docs/DESIGN.md (v2) 와 docs/MEASURE_M0.md
2. inputs/ 우선순위: 화면은 inputs/design/HANDOFF.md(v1.2)가 최우선, 그다음 spec.md·tokens.json·flow.md(목업 HTML은 구조 참고만). 학습 내용·문제·힌트·진도 필드는 inputs/pedagogy/(data-spec.md 필드 이름 그대로). 영상 구간·원본 대조는 inputs/research/. DESIGN.md '0. 확정된 결정'이 모든 자료보다 우선.
3. 입력 최신(20:55): inputs/design(HANDOFF 20:53, decisions D1~D55), inputs/pedagogy(data-spec v1.2, content/L01.json·taster.json·build_content.py·test_content.py, taster.md). 단계 수 확정: 01편 26단계, 전체 169단계(맛보기 8단계 별도), 그래도 하드코딩 금지. HANDOFF 7-2 새 필드(모두 선택 필드, 모르는 필드는 경고): step `edits[]`(target_step, where_ko, action insert|replace, anchor_line, line_count)·`rerun_first`·`moved_code_lines`·`prepared_code_line_notes_ko`·`prepared_code_source_ko`·`kind: copy_run`, 문항 `after_step`·`scored`·`alternate_of`, 힌트 `show_solution`, 편 `rewards`, 학습자 `path_id`, checkpoint `path_variants`(+`gate`), 배지 변형(`badge_on_pass`). `cell_mode`·`changed_lines_only`는 삭제됨. end_s null 없음. 바뀐 줄 화면(spec 4.2-1, c7_edits)은 비교 도구 없이 기준 줄 회색·새 줄 강조·"전체 보기". 요약 경로(spec 12.5)의 CP 점수 기준과 gate는 프로토타입 밖(07편 이후): 스키마·DB 자리만, path_id는 진도 기록에 포함. 영상 없는 단계는 L08-S01·S04·S08과 맛보기. D56: 맛보기 이름 카드 1200×675 확정. D57: 요약 경로 순서 01 → 02 → 03 다리 카드 6장 → CP1(요약) → 04 다리 카드 4장(관문) → 07 → 그 길의 남은 편 → CP3(요약), 07 뒤 편은 08·09·10 고정 금지, path_id로 계산(프로토타입 밖, 자리만). 열린 항목은 X4·X5·X8뿐.
8. 맛보기는 사용자가 Colab에서 스스로 완료를 확인하고 결과(이름·손실)를 붙여넣어 공유 카드를 만든다(taster_result에 self_reported와 붙여넣은 값 저장). 맛보기 Colab 노트북(.ipynb)은 taster.md 셀 내용(content/taster.json)으로 P2에서 구현 쪽이 만든다. 검수 기준: inputs/pedagogy/content/test_content.py 통과(CPU 약 7초, 손실 3.839 → 2.472). 10편 1000스텝 실측은 프로토타입 뒤로 미룬다(지금 돌리지 마라).
4. 이전 PM 세션이 m0-design 브랜치에 쓴 설계 확정본(v1 기준)은 참고만 하고 v2에 맞게 고쳐라.
5. pedagogy v1.1(2026-11-16 20:16 KST) 저장 구조 변경을 그대로 따른다: 단계 `long_step`·`new_code_lines`·`prepared_code`·`video_segments[{start_s,end_s}]`, 문항 `choice`(choices, answer_index), 누적 점검 checkpoint 스키마(CP1~3, 문항 40개), 전체 165단계, step_id는 `L01-S14b`처럼 접미 글자가 있으니 늘 문자열(정렬은 order). 영상 구간 정본은 inputs/pedagogy/video-segments.json. 진도 기록에 choice 응답과 checkpoint 결과를 저장(DESIGN.md 5절).
7. 디자인 HANDOFF 20:40: 맛보기는 Colab 8단계(브라우저 안 코드 실행 없음). 영상은 video_segments·shared_with 기준, "구간 1/3" 전환기. D49: 빈 배열 = 영상 없는 단계("영상 없음" 상태, 빈 플레이어 금지), end_s는 늘 값이 있음. null 처리 코드 넣지 말고 빌드 검사에서 end_s null·빠짐을 실패로. D43: 맥미니 저장이지만 처음부터 계정별 구조(users + 모든 기록 user_id 실제 FK), 단일 고정 사용자 전제 코드 금지. D44: 로그인은 이메일 + Google만(X 로그인 없음). 실제 메일 발송·OAuth는 공개 승인 때, 지금은 AuthAdapter 자리 + 로컬 개발용 로그인(여러 계정 전환, 127.0.0.1 전용)만. D45: "X에 공유"는 글쓰기 창만 열고 "저장한 이미지를 첨부해 주세요" 안내, 맛보기 카드에 "첫 모델이라 아직 서툴러요". D46: 랜딩·약관·개인정보 문구는 공개 전 승인 항목(목업 "예시 화면" 유지). D47: 단계 배지는 CP 통과로(CP1 언어 모델 견습, CP2 신경망 정비사, CP3 GPT 제작자), CP 단독 배지 없음, c4_cp_result에 표시. D48: 회사원·투자자 길의 03·04 다리 카드는 선택 필드 `bridge_card`(DESIGN.md 5-1), 응답은 question_attempt context="bridge", 07편 잠그지 않음.
6. 맛보기는 inputs/pedagogy/VALUE_CURRICULUM.md 3절의 Colab 노트북이 근거(CPU 약 6초, 손실 3.84 → 2.47). 프로토타입에서 맛보기 노트북을 만들고 맥 .venv로 실행해 손실 범위를 확인하라. Colab을 못 여는 사람용 "미리 계산한 결과 보기" 화면도 둔다.

산출물
- P0 (브랜치 `p0-design`, m0-setup 최신에서 새로 만들기, PR 1개. 기존 m0-design 브랜치는 참고용으로 두고 건드리지 마라): docs/DESIGN.md v2 확정본(결정 필요 질문은 PR 본문 맨 위 최대 5개), docs/MILESTONES.md(P1~P3 완료 기준)
- P1 (브랜치 `p1-skeleton-ep01`, PR 1개): app/ 뼈대, server/(어댑터·마이그레이션·동기화 API·테스트), content/ep01-micrograd/, notebooks/ep01-micrograd/(학생용·정답용, 맥에서 nbconvert 실행 통과, Colab 열기 링크·업로드 안내), z2h_check/, tests/verify_models.py, docs/PHONE_ACCESS_PLAN.md(Tunnel·Access 초안만, 실행 금지)
- P2·P3는 다음 지시를 기다린다.

일 나누기
- 직접 코드를 많이 쓰지 말고 서브 에이전트에 맡겨라: z2h-builder(앱·서버·채점 패키지·테스트), z2h-content(콘텐츠), z2h-notebook(노트북·정답 대조), z2h-reviewer(읽기 전용 검수). 정의된 이름으로만 부르고, fork 금지, model·effort 인자 넘기지 마라.
- PR 전 z2h-reviewer 검수를 받고 지적을 고친다.

반드시 지킬 규칙
1. 커밋 메시지·PR 본문에 Co-Authored-By, Claude 꼬리표, Claude 링크를 넣지 마라.
2. main에 병합·푸시하지 마라. PR까지만. 강제 푸시, --no-verify, 검사 건너뛰기 금지.
3. 이 저장소 안, 이번 범위 폴더 밖에 쓰지 마라. ~/.claude/settings.json 등 사용자 설정을 바꾸지 마라.
4. 비밀값을 파일·로그·출력에 쓰지 마라. 결제, 로그인, 키 발급, 공개 배포, 저장소 공개 전환, 서버 공개 운영, 유료 서버·DB, 사용량 크레딧 동의가 필요해지면 즉시 멈추고 보고하라.
5. 네트워크·보안 설정(Cloudflare Tunnel, Access 정책, 방화벽, 포트 개방, DNS)은 바꾸지 마라. 설계·스크립트 초안까지만. 서버는 127.0.0.1에만 바인드.
6. 영상은 youtube-nocookie 공식 embed와 링크만(자동 재생 없음, 한국어 자막 기본 `cc_load_policy=1&cc_lang_pref=ko&hl=ko`). 영상 파일·자막 전문 금지. MIT 원본은 출처 표기, build-nanogpt는 링크만. docs/PUBLIC_RELEASE_CHECKLIST.md를 처음부터 지켜라.
7. 막히면 추측으로 메우지 말고 "미확인"으로 적어라.

끝나면: PR 링크, 테스트 결과, 결정 필요 목록을 한 화면 분량으로 요약하라.
