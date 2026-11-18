# Z2H 진도 서버 API (앱 작업자용)

기준: docs/DESIGN.md 12.5절(진도 서버, 작업 폴더 판), 12.7절(결과코드), origin/m0-setup 판 DESIGN.md 5절(표·칼럼, 계정 D43·D44), inputs/pedagogy/data-spec.md(필드 이름).
주소: `http://127.0.0.1:8787` (앱도 같은 주소에서 열리므로 CORS 설정이 필요 없음). 모두 JSON.

## 0. 공통 약속

- 계정: 고정 사용자는 없다. 요청마다 현재 계정을 서버의 인증 계층(`AuthAdapter`)이 정한다. 로그인 수단은 둘이고, 요청 하나는 Host 에 따라 둘 중 하나만 쓴다.
  - 맥: 로컬 개발 로그인(`LocalDevAuth`, 1절). Host 가 `127.0.0.1`·`localhost` 인 요청.
  - 폰: Tailscale 로그인(`TailscaleAuth`, 1-1절). 서버에 `Z2H_TAILSCALE_HOST` 를 설정했을 때만, Host 가 그 serve 이름인 요청.
  - 계정이 없으면 학습 기록 API 는 401 `no_user`. 응답의 `auth_provider` 로 어느 수단이 맡았는지 알 수 있다.
- 시각: 모두 시간대가 붙은 ISO 글자. 서버는 받은 시각을 `+09:00` 로 바꿔 저장한다(`2026-11-20T11:00:00.123Z` → `2026-11-20T20:00:00.123000+09:00`). 시간대가 없는 시각은 거절.
- 오류 모양: `{"ok": false, "error": "<짧은 영어 코드>", "message_ko": "<화면에 보여도 되는 한국어>"}`
  - 400 `bad_host`(주소 틀림), `bad_since`, `bad_account`, `bad_grade`, 결과코드 오류(5절)
  - 401 `no_user`(계정을 고르지 않음, 본문에 `auth_provider` 도 있음. 1-1절), 403 `bad_origin`(다른 사이트에서 보낸 쓰기), `not_loopback`(이 컴퓨터 밖에서 접속)
  - 404 `not_found`·`no_account`, 413 `too_large`(본문 1MB 초과), 422 `bad_request`(요청 모양 틀림), 500 `server_error`
- 쓰기 요청(POST)은 `Origin` 이 있으면 `http://127.0.0.1:8787` 또는 `http://localhost:8787` 일 때만 받는다. `Sec-Fetch-Site: cross-site` 인 쓰기도 거부한다. Origin 이 없는 요청(로컬 Jupyter 의 Python `finish()` 등)은 받는다. `Z2H_TAILSCALE_HOST` 를 설정하면 Origin 을 Host 와 묶는다(1-1절): serve 이름 Host 의 쓰기는 Origin 이 정확히 `https://<serve 이름>` 일 때만(없어도 403), 로컬 Host 의 쓰기는 그 Origin 을 받지 않는다. dev 서버(4321)는 프록시에서 Origin 을 서버 주소로 바꿔 보내면 된다.
- 본문은 1MB 까지. 오프라인 대기열이 크면 여러 번에 나눠 보낸다(예: 200줄씩).

## 1. 계정 (로컬 개발 로그인, 127.0.0.1 전용, 비밀번호 없음)

| 요청 | 하는 일 |
|---|---|
| `GET /api/dev-auth/accounts` | `{accounts:[{user_id, display_name, path_id, locale, created_at}], current_user_id}` |
| `POST /api/dev-auth/accounts` `{display_name?, path_id?(기본 full), locale?}` | 새 계정을 만들고 그 계정으로 로그인. 응답 `{ok, user}` + 쿠키 `z2h_dev_session`(HttpOnly, SameSite=Strict, Path=/, 30일. 속성은 서버 설정 `CookieSettings` 한 곳에서 오고 기본값이 이것) |
| `POST /api/dev-auth/login` `{user_id}` | 다른 계정으로 바꾸기(쿠키 새로 받음). 없는 계정이면 404 |
| `POST /api/dev-auth/logout` | 세션 지우기 |
| `GET /api/me` | 현재 계정 `{ok, user, auth_provider}`. `auth_provider` 는 `"dev_local"`(맥 개발용 로그인) 또는 `"tailscale"`(폰). 없으면 401 |
| `POST /api/me` `{path_id?, display_name?, locale?}` | 계정 칸 바꾸기. "전체 길로 바꾸기" = `{"path_id": "full"}`(기록은 그대로) |

- 브라우저: 쿠키가 알아서 붙는다(`fetch` 는 같은 주소라 `credentials: 'same-origin'` 이면 됨).
- 브라우저 밖 도구(로컬 Jupyter 의 `finish()` 등): 머리말 `X-Z2H-User: {user_id}` 로 계정을 고른다.
- `path_id`: `full` | `office_worker` | `investor`. 계정(users)에 있고, `step_progress`·`checkpoint_attempt` 기록에도 칸이 있다(기본 full).
- 이메일 일회용 코드·Google 로그인은 자리만 있다(공개 승인 항목, 메일 발송·OAuth 키 없음). X 로그인은 없다.

**개발용 로그인은 이 컴퓨터 안에서만 쓰고, 터널을 붙이면 꺼진다.** 비밀번호 없이 아무 계정으로나 들어가는 길이라 아래 중 하나라도 해당하면 `/api/dev-auth/*` 는 404, `X-Z2H-User` 머리말과 개발용 쿠키는 그 요청에서 무시(기록 API 는 401)된다.
1. 접속한 쪽이 127.0.0.1 이 아님
2. 프록시·터널 머리말이 있음: `CF-Connecting-IP`, `CF-Ray`, `X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `X-Real-IP`, `Forwarded`, 그리고 Tailscale serve 가 붙이는 `Tailscale-User-Login`·`Tailscale-User-Name`·`Tailscale-User-Profile-Pic`·`Tailscale-Funnel-Request`. 앱 dev 서버 프록시는 이 머리말을 붙이지 않게 둔다(Vite 기본값 `xfwd: false`)
3. Host 가 `127.0.0.1`·`localhost`(포트는 상관없음)가 아님. Host 가 serve 이름(1-1절)인 요청은 늘 여기에 해당한다
4. 서버 설정에 127.0.0.1·localhost 가 아닌 허용 주소(`Z2H_EXTRA_HOSTS`, 예: 터널 주소)가 하나라도 있거나 `Z2H_DEV_AUTH=0`: 개발용 로그인 자체가 꺼지고 시작 로그에 "개발용 로그인 꺼짐"이 남는다. 그때는 맥 쪽 기록 API 가 401(실제 로그인은 공개 승인 뒤). `Z2H_TAILSCALE_HOST` 의 이름은 이 '바깥 주소'로 세지 않는다(같은 이름을 `Z2H_EXTRA_HOSTS` 에도 넣으면 센다).

## 1-1. 폰 로그인 (Tailscale serve, `Z2H_TAILSCALE_HOST` 를 설정했을 때만)

폰은 Tailscale serve(tailnet 안에서만. Funnel 은 쓰지 않음)를 거쳐 `https://<기기>.<tailnet>.ts.net` 으로 이 서버에 닿는다. 앱은 같은 주소에서 열리므로 할 일이 거의 없다.

- 로그인 화면이 없다. serve 가 붙여 주는 Tailscale 로그인 이름으로 서버가 계정을 찾는다. 쿠키·`X-Z2H-User` 를 보내지 않아도 된다(보내도 무시).
- 계정은 맥미니에서 미리 이어 둬야 한다(`python -m z2h_server link-tailscale`, README 6절). **자동 가입 없음.** 이어 두지 않은 Tailscale 계정은 모든 기록 API 가 401.
- serve 이름 Host 에서는 `/api/dev-auth/*` 가 모두 404 다. 폰에서는 계정 만들기·바꾸기 화면을 보이지 않는다.
- 앱이 할 일: `GET /api/me` 의 `auth_provider` 가 `"tailscale"` 이면 폰 로그인 상태. 401 이면 본문 `message_ko` 를 그대로 보인다.

서버가 요청을 serve 경유로 믿는 조건(모두 충족. 하나라도 어기면 그 요청은 누구도 아니고 401)
1. 접속한 쪽이 `127.0.0.1`
2. `Host` 머리말이 정확히 1개이고 설정한 serve 이름과 같음(포트는 상관없음, 대소문자 무시)
3. `Tailscale-User-Login` 머리말이 정확히 1개이고 비어 있지 않음. 인코딩된 값(`=?` 로 시작), 공백·쉼표가 든 값은 거부
4. `Tailscale-Funnel-Request`(Funnel 요청), `CF-Connecting-IP`·`CF-Ray`(Cloudflare 터널)가 없음. `X-Forwarded-*` 는 있든 없든 판단에 쓰지 않는다(serve 가 붙이는지 미확인)
- Host 가 `127.0.0.1`·`localhost` 인 요청에 `Tailscale-User-Login` 이 있어도 믿지 않는다(serve 를 거치지 않은 요청이므로). 그런 요청은 개발용 로그인도 거부한다(1절 2번).
- 로그인 이름은 대소문자를 가리지 않는다(소문자로 맞춰 찾음). 응답 본문에 로그인 이름을 되돌려 주지 않는다.

401 본문(serve 이름 Host 로 온 요청)
```json
{"ok": false, "error": "no_user", "auth_provider": "tailscale",
 "message_ko": "이 Tailscale 계정은 아직 학습 계정에 이어져 있지 않습니다. 맥미니에서 연결해 주세요(태그된 기기에서는 로그인할 수 없습니다)."}
```
그 밖의 요청의 401 은 `message_ko` 가 지금과 같고 `auth_provider` 는 `"dev_local"`(개발용 로그인이 꺼져 있으면 `"none"`).

- 쓰기 요청(POST 등)은 `Origin` 머리말이 정확히 1개이고 `https://<serve 이름>`(포트 없이, 끝의 `/`·대소문자는 무시)일 때만 받는다. Origin 이 없거나, `http://127.0.0.1:8787` 같은 로컬 Origin 이거나, `Z2H_EXTRA_ORIGINS` 에 넣은 값이어도 403 `bad_origin`. 앱은 같은 주소에서 `fetch` 하므로 브라우저가 알아서 붙인다. serve 는 HTTPS 기본 포트(443)로 연다.
- 로컬 Host 로 온 쓰기에 `Origin: https://<serve 이름>` 이 붙어 있으면 403.
- `Tailscale-User-Login`·`Tailscale-Funnel-Request` 같은 serve 머리말이 붙은 로컬 Host 요청은 개발용 로그인도 쓰지 못한다(1절 2번).
- 짧은 이름(`http://macmini`)이나 Tailscale IP(`100.x.y.z`)로 열면 Host 가 달라 400 `bad_host`.

## 2. `GET /api/health`

```json
{"ok": true, "server_time": "2026-11-20T20:00:00.123456+09:00", "schema_version": "0002"}
```
계정 없이 부를 수 있다. DB 에 닿지 못하면 503, `ok: false`.

## 3. `POST /api/sync`

요청:
```json
{
  "client_id": "web-3f2a9c",
  "ops": [
    {
      "op_id": "6f1c2e0a-8d7b-4b7e-9a51-2f0d3c4b5a69",
      "table": "step_progress",
      "key": {"step_id": "L01-S14b"},
      "data": {"status": "done", "done_at": "2026-11-20T20:30:00+09:00",
               "max_hint_level": 2, "active_seconds_auto": 300},
      "updated_at": "2026-11-20T20:30:00+09:00"
    },
    {
      "op_id": "a9e4d1f2-0c3b-4e5a-8f6d-7b8c9d0e1f2a",
      "table": "question_attempt",
      "key": {"question_id": "F-D1", "attempt_id": "1b6f0c1e-2d3a-4c5b-9e8f-7a6b5c4d3e2f"},
      "data": {"choice_index": 3, "is_dont_know": true, "is_correct": false, "at": "2026-11-20T20:31:00+09:00"},
      "updated_at": "2026-11-20T20:31:00+09:00"
    }
  ]
}
```
응답:
```json
{"applied": ["6f1c2e0a-...", "a9e4d1f2-..."], "superseded": [], "rejected": [],
 "server_time": "2026-11-20T20:31:02.000001+09:00"}
```

한 줄(op)의 칸
| 칸 | 뜻 |
|---|---|
| `client_id` | 기기(브라우저)마다 한 번 만들어 IndexedDB 에 두는 값, 1~64자. 같은 기기가 이어서 고친 것은 충돌로 보지 않는 데 쓴다 |
| `op_id` | 변경 한 건마다 새로 만드는 UUID, 1~128자. **재시도할 때는 같은 op_id 그대로**. 같은 op_id 는 한 번만 반영하고, 다시 오면 처음 결과를 그대로 돌려준다 |
| `table` | 아래 표 이름 중 하나 |
| `key` | 그 표의 열쇠 칸만 담은 객체(user_id 빼고). 칸 이름이 정확히 맞아야 함 |
| `data` | **바꿀 칸만** 담으면 된다. 없는 칸은 서버 값 그대로, 새 행이면 기본값. `null` 은 비우기. 행 전체를 보내도 된다: `user_id`(현재 계정과 같아야 함)·열쇠 칸(key 와 같아야 함)은 확인만 하고, 서버 칸 `attempt_no`·`server_seq`·`updated_at` 은 무시한다 |
| `updated_at` | 이 변경을 기기에서 만든 시각. 충돌 때 늦은 쪽이 이긴다 |
| `base_updated_at` | (선택) 고치기 전에 기기가 알던 그 행의 `updated_at`. 서버 값과 같으면 다른 기기 값을 덮어도 충돌로 기록하지 않는다 |

결과 목록의 뜻
- `applied`: 반영됨. 대기열에서 지운다.
- `superseded`: 서버에 더 새 값이 있어 이 변경의 일부 또는 전부가 버려짐(버려진 값은 `sync_conflicts` 에 남음). 대기열에서 지우고 `GET /api/state?since=` 로 서버 값을 받는다.
- `rejected`: 모양이 틀려 반영하지 않음(`reason_ko` 에 이유). 다시 보내도 같으므로 대기열에서 지운다. 한 줄이 거절돼도 나머지는 계속 반영된다.

### 표와 열쇠 (`*` = 새 행에 꼭 필요, 기본값이 있으면 생략 가능)

- JSON 칸: DB 칼럼은 `*_json` 글자, API·내보내기 이름은 data-spec 이름(`covers`, `history`, `env`, `hints_seen` 등 `_json` 을 뗀 이름)이고 값은 JSON 그대로(배열·객체). `*_json` 이름으로 보내면 **JSON 글자(문자열)** 로 보고 풀어서 받는다. 돌려줄 때는 늘 data-spec 이름.
- `checkpoint_attempt.max_hint_level_allowed` 는 DB 칼럼 `max_hint_level` 과 같은 값(12.5절). 두 이름 다 받고, 돌려줄 때는 `max_hint_level_allowed`.
- 모든 표 공통: `content_version`(기기가 씀), `updated_at`, `server_seq`(서버가 씀).

| 표 | 열쇠(key) | data 칸 |
|---|---|---|
| `step_progress` | `step_id` | `path_id`* 고르기(full/office_worker/investor)=기본 full; `status`* 고르기(not_started/in_progress/done/skipped_optional)=기본 not_started; `max_hint_level` 정수(0~5)=기본 0; `attempts` 정수(0~)=기본 0; `started_at` 시각; `done_at` 시각; `active_seconds_auto` 정수(0~)=기본 0; `active_seconds_user` 정수(0~); `prediction` 긴 글; `content_version` 글자 |
| `question_attempt` | `question_id`, `attempt_id`(기기가 만든 UUID) | `attempt_no` 서버가 매김(읽기 전용); `answer_text` 긴 글; `choice_index` 정수(0~); `is_dont_know`* true/false=기본 false; `is_correct` true/false; `raw_points` 숫자; `max_hint_level` 정수(0~5); `score_ratio` 숫자(0~1); `points_awarded` 숫자; `env_issue`* true/false=기본 false; `context` 고르기(step/checkpoint/bridge/taste), 기본 null, 다리 카드 응답은 bridge; `checkpoint_attempt_id` 아이디(누적 점검 시도의 attempt_id); `checkpoint_attempt_no` 정수(1~), checkpoint_attempt_id 가 있으면 서버가 채움; `at` 시각; `content_version` 글자 |
| `rebuild_attempt` | `rebuild_id`, `attempt_id` | `attempt_no` 서버가 매김(읽기 전용); `passed` true/false; `max_hint_level` 정수(0~5), 노트북은 모르므로 앱의 힌트 기록으로; `at` 시각; `content_version` 글자 |
| `mastery_state` | `target_id` | `state` 고르기(locked/open/in_progress/almost/mastered/revisit); `steps_done_ratio` 숫자(0~1); `question_score_ratio` 숫자(0~1); `must_pass_ok` true/false; `rebuild_ok` true/false; `extra_checks_ok` true/false; `mastered_at` 시각; `content_version` 글자 |
| `review_card` | `card_id` | `source_id` 아이디; `kind` 고르기(concept/predict/hands_on); `interval_days` 정수(0~); `due_at` 날짜(YYYY-MM-DD) 또는 시각; `last_result` 고르기(pass/shaky/miss); `history` JSON 배열(DB `history_json`); `content_version` 글자 |
| `grade_result` | `check_id` | `passed`* true/false; `message_ko` 긴 글; `source`* 고르기(notebook/result_code); `at` 시각; `content_version` 글자 |
| `user_pref` | `pref_key`: `run_place` · `resume` · `practice_week:{주 시작일 YYYY-MM-DD}` · `legacy_progress:{편 L01}:{옛 판 1.2}` · `course` · `course_intro_done` · `guided_mode` · `test_out:{기초 단위 F-P1·F-M6·F-B1 꼴}` 만 | `value` JSON(DB `value_json`). 열쇠별 값 모양은 아래 「`user_pref` 값」 표. `legacy_progress:*` 는 옛 판 진도 보관본(앱 `src/lib/migrate`, 옛 행 JSON 그대로·`applied_at`). `run_place` 는 앱이 2026-11-18(Colab 고정)부터 쓰지 않지만 옛 값을 받는다; `content_version` 글자 |
| `checkpoint_attempt` | `checkpoint_id`, `attempt_id` | `attempt_no` 서버가 매김(읽기 전용); `path_id`* 고르기(full/office_worker/investor)=기본 full; `covers` JSON 배열(DB `covers_json`); `score_ratio` 숫자(0~1); `passed` true/false; `max_hint_level_allowed` 정수(0~5)(DB `max_hint_level`); `hand_task_self_check` JSON(DB `hand_task_self_check_json`); `started_at` 시각; `at` 시각; `content_version` 글자 |
| `diagnostic_result` | `attempt_id` | `attempt_no` 서버가 매김(읽기 전용); `answers` JSON(DB `answers_json`); `recommended_units` JSON(DB `recommended_units_json`); `at` 시각; `content_version` 글자 |
| `taster_result` | `attempt_no`(기기가 정함, 1부터), `step_id`(T-S01 같은 맛보기 단계) | `self_reported` 고르기(similar/different) = "비슷해요/달라요"; `pasted_names_text` 긴 글; `pasted_loss_start` 숫자; `pasted_loss_end` 숫자; `share_card_id` 아이디; `at` 시각; `content_version` 글자. 붙여넣은 값은 검증하지 않은 값 |
| `help_note` | `note_id`(기기가 만든 UUID) | `target_id` 아이디; `goal_ko` 긴 글; `last_cell_code` 긴 글; `error_last_line` 긴 글; `env` JSON(DB `env_json`); `hints_seen` JSON 배열(DB `hints_seen_json`); `created_at` 시각; `content_version` 글자 |
| `study_session` | `session_id`(기기가 만든 UUID) | `target_id` 아이디; `started_at` 시각; `ended_at` 시각; `active_seconds` 정수(0~); `source` 고르기(auto/manual); `content_version` 글자 |
| `user_badge` | `badge_id` | `earned_at` 시각; `evidence` JSON(DB `evidence_json`); `content_version` 글자 |
| `share_card` | `share_id`(영문·숫자·-_ 16~64자 임의 값) | `kind` 아이디; `payload` JSON(DB `payload_json`); `image_path` 글자; `visibility`* 고르기(private)=기본 private, 공개 공유는 승인 뒤; `created_at` 시각; `revoked_at` 시각; `content_version` 글자 |

- 아이디: 영문·숫자로 시작, 영문·숫자·`-_.:` 만, 64자까지(`checkpoint_id` 16자, `share_card.kind` 32자). step_id 는 늘 글자(`L01-S14b`), 정렬은 콘텐츠의 `order` 로.
- 동기화로 쓸 수 없는 표: `users`, `auth_identity`, `sessions`, `badge_def`, `sync_conflicts`, `applied_ops`, `sync_counter`.
- 맛보기 기록은 `taster_result` 하나다. 예전 `taste_result` 표는 스키마 `0002` 에서 지웠다(앱이 쓴 적 없음). 그 이름으로 보내면 다른 모르는 표와 똑같이 그 줄만 `rejected`(`reason_ko`: `모르는 표입니다: taste_result`)이고 나머지 줄은 반영된다.
- 지우기 요청은 없다(프로토타입).

### `user_pref` 값

열쇠의 `:` 앞 갈래마다 값을 검사한다(`sync.PREF_VALUE_RULES`). 객체 값은 칸 이름이 아래와 **정확히** 같아야 한다(빠진 칸도, 더한 칸도 거절. `practice_week:*` 만 두 칸 중 일부만 와도 됨). 시각 칸은 `+09:00` 시각으로 바꿔 저장한다. 모양이 틀리면 그 줄만 `rejected`(`reason_ko` 에 이유).

| 열쇠 | 값(`value`) | `null` 로 비우기 |
|---|---|---|
| `run_place`, `resume`, `legacy_progress:*` | JSON 이면 그대로 받음(모양 검사 없음) | 받음 |
| `practice_week:*` | `{"edited_seconds": 0 이상 정수 또는 null, "edited_at": 시각 또는 null}` | 받음(자동 기록으로 되돌아감) |
| `course` | `{"course_id": "intro" 또는 "main", "source": "diagnostic"·"skip_link"·"switch" 중 하나, "diagnostic_attempt_id": 아이디 또는 null, "at": 시각, "history": 목록}`. `history` 는 20개까지, 항목마다 `{"course_id", "source", "at"}` 같은 규칙 | 받음(코스 없음 = 진단 전) |
| `course_intro_done` | `{"at": 시각}` | 받음 |
| `guided_mode` | `"on"` 또는 `"off"` | 받음 |
| `test_out:F-…` | `{"attempt_id": 아이디, "passed": true/false(정수 아님), "answers": 목록, "at": 시각, "content_version": 64자까지 글자 또는 null}`. `answers` 는 10개까지, 항목마다 `{"question_id": 아이디, "is_correct": true/false}` | **거절**. `value` 없이 보내도 거절(한 단위에 한 번 보는 시험 기록이라 비우지 않는다) |

### 충돌 규칙 (DESIGN.md 12.5)

- 같은 행(같은 표 + 같은 열쇠): `updated_at` 이 늦은 쪽이 이긴다. 진 값은 `sync_conflicts` 에 남는다. 같은 기기(`client_id`)가 이어서 고친 것, `base_updated_at` 이 서버 값과 같은 것은 보통 수정이라 기록하지 않는다.
- 쌓이는 기록(`question_attempt`, `rebuild_attempt`, `checkpoint_attempt`, `diagnostic_result`)은 기기가 만든 `attempt_id` 가 열쇠라, 두 기기가 오프라인에서 같은 문제를 각각 풀어도 **둘 다 남는다**. `attempt_no` 는 서버가 같은 묶음(같은 question_id 등) 안에서 도착 순서로 1, 2, 3… 을 매긴다. `study_session`·`help_note` 도 기기가 만든 UUID 열쇠.
- `step_progress` 는 진도가 뒤로 가지 않게: `status` 는 `done` 이 한쪽에라도 있으면 `done`, `max_hint_level`·`active_seconds_auto`·`attempts` 는 큰 값, `started_at` 은 이른 값, done 이면 `done_at` 을 잃지 않는다. `active_seconds_user` 와 나머지는 늦은 쪽.
- `review_card.history` 는 양쪽 기록을 합쳐 `at` 순으로 둔다.

## 4. `GET /api/state?since={server_seq}`

`since` 를 빼면 전체, 넣으면 **server_seq 가 그보다 큰 행만**. 다음 요청의 `since` 에는 **직전 응답의 `server_seq`(정수)** 를 쓴다. 기기 시각이 아니라 서버 번호로 비교하므로, 다른 기기가 늦게 올린 옛 시각의 기록도 빠지지 않는다. 정수가 아니면 400 `bad_since`.

```json
{
  "user": {"user_id": "9c1d…", "display_name": "테스트 계정", "path_id": "full", "locale": "ko-KR"},
  "since": null,
  "server_seq": 42,
  "server_time": "2026-11-20T20:31:05.000002+09:00",
  "schema_version": "0002",
  "tables": {
    "step_progress": [
      {"step_id": "L01-S14b", "path_id": "full", "status": "done", "max_hint_level": 2, "attempts": 0,
       "started_at": null, "done_at": "2026-11-20T20:30:00+09:00",
       "active_seconds_auto": 300, "active_seconds_user": null, "prediction": null, "content_version": null,
       "updated_at": "2026-11-20T20:30:00+09:00", "server_seq": 41}
    ],
    "question_attempt": [
      {"question_id": "F-D1", "attempt_id": "1b6f…", "attempt_no": 1, "choice_index": 3, "is_dont_know": true,
       "...": "...", "updated_at": "2026-11-20T20:31:00+09:00", "server_seq": 42}
    ],
    "rebuild_attempt": [], "mastery_state": [], "review_card": [], "grade_result": [], "user_pref": [],
    "checkpoint_attempt": [], "diagnostic_result": [], "taster_result": [],
    "help_note": [], "study_session": [], "user_badge": [], "share_card": []
  }
}
```
- 행 모양 = 열쇠 칸 + (`attempt_no`) + data 칸 전부(data-spec 이름) + `updated_at` + `server_seq`. 표 14개가 늘 다 들어 있다(없으면 빈 배열).
- 실습 시간 화면: 주 단위로 고친 값은 `user_pref` 의 `practice_week:{주 시작일}`, 자동 값은 `study_session`·`step_progress.active_seconds_auto`. 단계별 `active_seconds_user` 칸도 있지만 P1 화면은 주 단위 수정만 쓴다(12.5절).

## 5. `POST /api/result-code`

노트북 `finish("L01")` 가 출력한 결과코드를 앱에 붙여 넣으면 보낸다(현재 계정으로 저장).
```json
{"code": "Z2H1.eyJ2IjoxLCJsIjoiTDAxIiwicCI6WyJMMDEtUzA0IiwiTDAxLVMxMWIiXSwiZiI6WyJMMDEtUzEyIl0sInQiOiIyMDI2LTExLTIwVDIxOjAwOjAwKzA5OjAwIn0.e00a6ba9"}
```
응답(200):
```json
{"ok": true, "lecture_id": "L01", "t": "2026-11-20T21:00:00+09:00",
 "passed": ["L01-S04", "L01-S11b"], "failed": ["L01-S12"],
 "applied": ["L01-S04", "L01-S11b", "L01-S12"], "superseded": [], "rejected": [],
 "server_time": "2026-11-20T21:00:03.000001+09:00"}
```
- 각 check_id 가 `grade_result` 한 행이 된다(`source: "result_code"`, `at` = 코드 안의 `t`). 더 늦은 `t` 의 결과가 이미 있으면 그 check_id 는 `superseded`. 같은 코드를 두 번 붙여 넣어도 한 번만 반영된다.
- 붙여 넣은 글의 공백·줄바꿈·앞뒤 따옴표는 서버가 지운다.
- 오류(400): `error` 가 `empty`, `bad_format`, `bad_checksum`(글자 틀림), `bad_version`, `bad_payload`. `message_ko` 를 그대로 화면에 보이면 된다.
- 앱이 브라우저에서 직접 풀어 `grade_result` 행을 `/api/sync` 로 보내도 된다. 그때도 아래 규칙대로 풀어야 한다.

결과코드 규칙(12.7절, z2h_check 와 같음, 바꾸지 않음): `Z2H1.{base64url(JSON), 패딩 없음}.{crc32 8자리 16진수 소문자}`. crc32 는 **가운데 base64url 글자**의 UTF-8 바이트로 계산(JSON 원문이 아님). JSON 은 `{"v":1,"l":"L01","p":[통과 check_id],"f":[실패 check_id],"t":"ISO+09:00"}`.
기준 예시(위 code 값): JSON `{"v":1,"l":"L01","p":["L01-S04","L01-S11b"],"f":["L01-S12"],"t":"2026-11-20T21:00:00+09:00"}`, crc32 `e00a6ba9`. 해독 코드: `server/z2h_server/result_code.py`.

## 6. `POST /api/grade`

로컬 Jupyter 의 `finish()` 가 서버로 바로 보내는 길(Colab 은 이 주소에 닿지 못하므로 결과코드 붙여넣기). 계정은 머리말 `X-Z2H-User: {user_id}`. 본문(12.7절):
```json
{"lecture_id": "L01", "at": "2026-11-20T21:30:00+09:00",
 "results": [{"check_id": "L01-S11b", "passed": true, "message_ko": "✓ 맞음"},
             {"check_id": "L01-S12", "passed": false, "message_ko": "✕ 다시: a.grad 가 1.0 입니다"}]}
```
결과코드 그대로 `{"code": "Z2H1...."}` 도 받는다. 시각 키는 `at`(예전 이름 `t` 도 받지만 `at` 이 정본). 응답은 5절과 같은 모양(`source: "notebook"` 으로 저장).
- 계정: 노트북에는 브라우저 쿠키가 없으므로 `X-Z2H-User: {user_id}` 머리말이 꼭 필요하다. 없거나 모르는 계정이면 **401 `no_user`** 이고 저장하지 않는다(그때 finish() 는 결과코드를 보여 붙여넣기로 대신하면 된다).
- `Origin: http://127.0.0.1:8787` 을 붙여도 되고 빼도 된다. 다른 주소의 Origin 이면 403.
- 노트북이 user_id 를 어디서 얻을지(예: 환경변수, 앱 설정 화면에 보이는 값 복사)는 z2h_check·앱 작업자가 정한다(미정).

## 7. `GET /api/export`

현재 계정의 전체 JSON 백업(설정 화면 "JSON 백업 내보내기"). `Content-Disposition: attachment; filename="z2h-backup-YYYYMMDD.json"`. 이름은 4절과 같이 data-spec 이름.
```json
{"format": "z2h-backup", "format_version": 1, "exported_at": "...", "schema_version": "0002", "server_seq": 42,
 "user_id": "...", "user": {...},
 "tables": {"step_progress": [...], "...": [...],
            "sync_conflicts": [{"conflict_id": 1, "table_name": "user_pref", "row_key": {"pref_key": "run_place"},
                                "losing": {"op_id": "...", "client_id": "phone", "winner": "op",
                                           "lost_server_values": {"value": "colab"}, "lost_op_values": {},
                                           "op_updated_at": "...", "server_updated_at_before": "...",
                                           "server_client_id_before": "..."},
                                "at": "..."}]}}
```

## 8. 정적 파일

`app/dist/` 가 있으면 `/` 아래 모든 주소에서 그 파일을 준다(`/lectures/L01/S04/` → `lectures/L01/S04/index.html`, 없는 주소는 `404.html`). 없으면 `/` 에서 안내 JSON(`app_built: false`).
