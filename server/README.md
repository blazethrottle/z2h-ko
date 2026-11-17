# Z2H 진도 서버

학습 진도(단계 완료, 문제 답, 실습 시간, 채점 결과)를 맥미니에 저장해 폰과 컴퓨터에서 이어 보게 하는 작은 서버입니다.
이 컴퓨터 안(`127.0.0.1`)에서만 열리고, 바깥 네트워크로는 열리지 않습니다.

- 저장 위치: `server/data/z2h.sqlite3` 파일 하나(git 에 올라가지 않음). 기록은 계정별로 나뉜다.
- 계정: 로컬 개발 로그인(비밀번호 없음)으로 여러 계정을 만들고 바꿀 수 있다. 이메일·Google 로그인은 공개 승인 뒤.
- **개발용 로그인은 이 컴퓨터 안에서만 쓰고, 터널을 붙이면 꺼진다.** 프록시·터널을 거친 요청(CF-Connecting-IP, X-Forwarded-For 같은 머리말이 붙은 요청)이나 127.0.0.1·localhost 가 아닌 주소로 온 요청에서는 동작하지 않는다. `Z2H_EXTRA_HOSTS` 에 터널 주소를 넣거나 `Z2H_DEV_AUTH=0` 이면 아예 꺼지고, 시작 화면에 "개발용 로그인 꺼짐"이 나온다. 그때는 로그인 수단이 없어 진도 읽기·쓰기가 모두 막힌다(401).
- **폰 로그인(Tailscale, 선택)**: `Z2H_TAILSCALE_HOST` 를 설정하면 폰이 Tailscale serve 주소로 들어와, 맥미니에서 미리 이어 둔 계정으로만 진도를 읽고 쓴다(자동 가입 없음). 6절.
- 주소: `http://127.0.0.1:8787`
- 앱 작업자용 API 설명: [API.md](API.md)

## 1. 켜기

저장소 맨 위 폴더(`z2h-ko`)에서 아래 두 줄을 차례로 실행합니다.

서버 폴더로 들어갑니다.
```
cd server
```
서버를 켭니다. 처음 켜면 DB 파일과 표를 자동으로 만듭니다.
```
../.venv/bin/python -m z2h_server
```
- 잘 켜지면: `Z2H 진도 서버: http://127.0.0.1:8787/` 이 보이고 화면이 멈춘 듯 기다립니다(정상).
- 확인: 브라우저에서 `http://127.0.0.1:8787/api/health` 를 열면 `"ok": true` 가 보입니다.
- 끄기: 그 터미널에서 `Ctrl + C`.
- 앱을 먼저 빌드해 두면(`app/` 에서 `npm run build`) `http://127.0.0.1:8787/` 에서 앱이 열립니다. 빌드 전에는 안내 문구(JSON)가 보입니다.

잘못된 경우
- `실행 거부: 서버는 127.0.0.1 에만 ...` 이 나오면: `--host` 나 `Z2H_HOST` 에 다른 주소를 넣은 것입니다. 일부러 막아 둔 것이니 그 값을 빼고 다시 켭니다.
- `address already in use` 가 나오면: 이미 다른 창에서 서버가 켜져 있습니다. 그 창을 끄거나 그대로 씁니다.

## 2. 테스트

`server` 폴더에서 실행합니다. 모두 통과하면 마지막 줄에 `N passed` 가 나옵니다(`failed` 가 있으면 문제).
```
../.venv/bin/python -m pytest -q
```
테스트가 확인하는 것: 표 만들기·지우기 왕복(0002 의 taste_result 지우기·되살리기 포함), 모든 기록 표의 user_id 가 users 로 가는 FK, 두 계정의 기록이 서로 안 보임, 동기화(같은 op_id 한 번만, 충돌 기록, 진도 뒤로 안 감, 오프라인 대기열 한꺼번에, 두 기기가 같은 문제를 풀면 둘 다 남고 번호 1·2, 늦게 올라온 옛 기록도 server_seq 로 받음), 객관식 답·누적 점검 저장, 결과코드(정상, 글자 틀림), 127.0.0.1 밖 주소 거부, Host·Origin 검사, 본문 1MB 제한, 실습 시간 저장과 되돌리기, 폰 로그인(Tailscale) 조건·잇기 명령·로그에 로그인 이름 없음, 실제로 서버를 한 번 켜서 `/api/health` 응답.

## 2-1. 계정 하나 만들어 보기 (손으로 확인할 때)

서버를 켠 상태에서, 개발 계정을 하나 만들고 그 계정의 진도를 읽어 봅니다. 쿠키는 임시 파일에 담깁니다.
```
curl -s -c /tmp/z2h.cookie -X POST -H 'Content-Type: application/json' -d '{"display_name":"내 계정"}' http://127.0.0.1:8787/api/dev-auth/accounts
curl -s -b /tmp/z2h.cookie http://127.0.0.1:8787/api/state
```
- 잘 되면: 첫 줄은 `"ok":true` 와 새 `user_id`, 둘째 줄은 빈 표 14개가 든 JSON.
- 둘째 줄이 `no_user` 이면: 첫 줄의 쿠키가 저장되지 않은 것입니다. 첫 줄을 다시 실행합니다.

## 3. 바꿀 수 있는 설정

주소·Origin·쿠키·DB 접근 값은 모두 `z2h_server/config.py` 의 `Settings` 한 곳에서 나옵니다(다른 파일에 박지 않음. 테스트가 확인). 환경변수로도 바꿀 수 있습니다. 값이 틀리면 서버를 켜지 않습니다(`실행 거부: ...`, 종료 코드 2).

| 환경변수 | 기본값 | 뜻 |
|---|---|---|
| `Z2H_DB_PATH` | `server/data/z2h.sqlite3` | DB 파일 위치 |
| `Z2H_DB_URL` | 없음 | DB 주소 전체(나중에 Postgres 로 옮길 때. 지금은 SQLite 만 동작) |
| `Z2H_APP_DIST` | `app/dist` | 빌드된 앱 폴더 |
| `Z2H_PORT` | `8787` | 포트 |
| `Z2H_HOST` | `127.0.0.1` | 바인드 주소. 127.0.0.1 말고는 실행 거부 |
| `Z2H_EXTRA_HOSTS`, `Z2H_EXTRA_ORIGINS` | 없음 | 추가로 받을 주소(쉼표 구분). 나중 폰 접속용 자리이며 지금은 비워 둔다. 바깥 주소를 넣으면 개발용 로그인이 꺼진다 |
| `Z2H_DEV_AUTH` | `1` | `0` 이면 개발용 로그인을 끈다 |
| `Z2H_TAILSCALE_HOST` | 없음 | 폰 로그인을 켠다. 값은 `<기기>.<tailnet>.ts.net` 이름 1개(스킴·포트·쉼표 없이). 틀린 모양이면 서버를 켜지 않는다(종료 코드 2). 6절 |
| `Z2H_SESSION_DAYS` | `30` | 로그인 쿠키 유지 일수(1~400) |
| `Z2H_COOKIE_SECURE` | `0` | `1` 이면 쿠키에 Secure(https 에서만 보냄). 공개 때 켠다(7절) |
| `Z2H_COOKIE_SAMESITE` | `strict` | `strict` 또는 `lax`. `none` 은 받지 않는다 |

환경변수가 없는 설정(코드의 `Settings` 칸): 쿠키 이름 `z2h_dev_session`·Path `/`·Domain 없음(`CookieSettings`), DB 잠금 대기 30초(`db_timeout_seconds`), 로그 수준 `info`(`log_level`), 본문 상한 1MB(`max_body_bytes`).

설정으로 풀 수 없게 막아 둔 것(불변식. 공개 전환 뒤에도 그대로)
- 서버는 `127.0.0.1` 에만 붙습니다. **공개할 때도 서버는 127.0.0.1 에 두고, 앞에 프록시(터널 등)를 둡니다.** 이 서버가 직접 바깥에 열리는 일은 없습니다.
- 접속한 쪽 주소를 머리말(X-Forwarded-For 등)로 바꾸지 않습니다(uvicorn `proxy_headers` 끔).
- 개발용 로그인은 이 컴퓨터 안에서 바로 온 요청만 받습니다(1절 아래 조건, `auth.local_only`).
- 세션 쿠키는 늘 HttpOnly 이고, SameSite=None 은 고를 수 없습니다.
- DB 오류 기록에 SQL 값(로그인 이름·학습 기록)을 싣지 않습니다.

## 4. 표(스키마) 바꾸기

표는 Alembic 마이그레이션 파일(`alembic/versions/`)로만 만들고 바꿉니다. 서버 코드가 표를 직접 만들지 않습니다.
- 지금 버전: `0002`. 버전은 Alembic 기본 표 `alembic_version` 에 적힌다.
  - `0001`: DESIGN.md 5절 표 전부 + 12.5절의 `applied_ops`, server_seq 번호표 `sync_counter`.
  - `0002`: `taste_result` 표를 지운다(앱이 한 번도 쓰지 않음. 맛보기 기록은 `taster_result` 하나). 그 표에 행이 있었다면 버려진다. 내리면 빈 표로 다시 생긴다.
  - 예전 판으로 만든 DB 도 서버를 켜면 자동으로 `0002` 까지 올라간다.
- 손으로 올리기·내리기(`server` 폴더에서): `../.venv/bin/alembic upgrade head`, `../.venv/bin/alembic downgrade base`
  - 내리기는 표를 모두 지웁니다(기록도 지워짐). 먼저 `http://127.0.0.1:8787/api/export` 로 백업을 받습니다.
- 표를 바꾸면 `z2h_server/schema.py` 도 같이 고칩니다. 둘이 다르면 테스트가 실패합니다.

### 4-1. SQLite 에서 Postgres 로 옮길 때 바꿀 곳 (지금은 구현하지 않음)

DB 종류를 아는 코드는 `z2h_server/storage/` 와 설정(`config.py`)뿐입니다. 서버의 나머지(API, 로그인, 잇기 명령, 마이그레이션 실행)는 `open_adapter(settings.db_url)`·`prepare_location` 만 씁니다(테스트가 확인).
1. `z2h_server/storage/` 에 `PostgresAdapter` 파일 하나. 공통 `SqlAdapter` 를 이어받고 엔진 만들기만 다르게(`SqliteAdapter` 처럼).
2. `z2h_server/storage/__init__.py` 의 `open_adapter`·`prepare_location` 에 postgresql 갈래 하나.
3. `requirements.txt` 에 Postgres 드라이버 하나(어느 드라이버로 할지 미정).
4. 환경변수 `Z2H_DB_URL=postgresql://...`(비밀번호가 든 값이라 파일·로그에 쓰지 않음).
- 표·마이그레이션은 처음부터 Postgres 에서도 도는 표준 SQL 이고, 시각 칸은 Postgres 에서 TIMESTAMPTZ 입니다(오프라인 SQL 생성까지 테스트. 실제 Postgres 실행은 미확인).
- 옮기기 전에 7절의 'server_seq·프로세스 1개 전제'를 먼저 봅니다.
- 유료 DB 를 쓰면 승인이 필요합니다.

## 5. 폴더

```
server/
  z2h_server/      서버 코드
    config.py      설정 한 곳(주소·Origin·쿠키·DB 접근·제한) + 설정으로 못 푸는 불변식
    app.py         앱 만들기, 정적 파일
    api.py         /api/* (health, state, sync, result-code, grade, export, 개발 로그인, me)
    auth.py        AuthAdapter(요청의 현재 계정) → LocalDevAuth(맥), TailscaleAuth(폰), ByHostAuth(Host 로 고름).
                   build_auth(설정 → 수단 조립 한 곳), AUTH_PROVIDERS(수단 이름표). 이메일·Google 은 자리만
    __main__.py    서버 켜기, Tailscale 잇기 명령(link-tailscale 등)
    security.py    Host·Origin·본문 크기·접속 주소 검사
    sync.py        동기화 검사와 충돌 규칙
    result_code.py 결과코드 해독
    schema.py      표 정의(읽고 쓰기용. 만드는 것은 마이그레이션)
    storage/       StorageAdapter(약속) → SqlAdapter(표준 SQL) → SqliteAdapter. open_adapter(DB 주소 → 어댑터, DB 종류를 아는 유일한 곳)
  alembic/         마이그레이션
  tests/           pytest
  data/            DB 파일(git 제외)
```

## 6. 폰에서 열기: Tailscale 로그인 (로그인 A안)

폰은 Tailscale serve(같은 tailnet 안에서만 열리는 길. 인터넷 공개인 Funnel 은 쓰지 않음)를 거쳐 맥미니의 이 서버(`127.0.0.1:8787`)에 닿습니다.
serve 는 요청마다 그 사람의 Tailscale 로그인 이름을 머리말(`Tailscale-User-Login`)로 붙여 주고, 서버는 그 이름을 맥미니에서 미리 이어 둔 학습 계정으로 바꿉니다.
맥에서 쓰던 계정과 같은 계정에 이으면, 맥에서 하던 진도를 폰에서 이어 봅니다.

serve 를 켜는 일(Tailscale 설정)은 네트워크 설정이라 이 문서 범위 밖입니다. CTO 가 CEO 에게 먼저 알린 뒤 합니다. 서버는 계속 `127.0.0.1` 에만 붙습니다.

**serve 대상은 `http://127.0.0.1:8787` 만입니다. 앱 dev 서버(4321)·preview 서버 포트를 serve 대상으로 쓰지 않습니다.** 그 서버들의 `/api` 프록시는 Host 를 `127.0.0.1:8787` 로 바꾸고 전달 머리말(X-Forwarded-* 등)을 지웁니다. serve 가 그 포트를 가리키면, 신원 머리말이 없는 요청(태그된 기기 등)이 진도 서버에는 맥 안에서 바로 온 요청처럼 보여 개발용 로그인(비밀번호 없음)에 닿을 수 있습니다. HTTPS 포트도 기본값(443)으로 둡니다(쓰기 요청의 Origin 을 `https://<serve 이름>` 하나만 받기 때문).

### 6-1. 켜기

서버를 켤 때 serve 주소 이름을 함께 알려 줍니다(`server` 폴더에서). `<기기>.<tailnet>.ts.net` 자리에 실제 이름을 넣습니다.
```
Z2H_TAILSCALE_HOST=<기기>.<tailnet>.ts.net ../.venv/bin/python -m z2h_server
```
- 잘 켜지면: 시작 화면에 `Tailscale 로그인 켜짐` 이 한 줄 더 나옵니다. 맥의 `http://127.0.0.1:8787` 개발용 로그인은 그대로 됩니다.
- `실행 거부: Z2H_TAILSCALE_HOST 는 ...` 이 나오면: 값 모양이 틀린 것입니다. `https://`, `:443`, 쉼표, 공백을 빼고 이름 하나만 넣습니다.
- 끄기: `Ctrl + C` 뒤 이 설정 없이 다시 켜면 지금과 똑같은 서버입니다.

### 6-2. 계정 잇기 (맥미니에서만)

잇기는 맥미니 터미널 명령으로만 합니다. 웹 주소(API)로는 할 수 없습니다. 서버가 켜져 있어도 꺼져 있어도 됩니다(`server` 폴더에서).

먼저 이을 학습 계정의 `user_id` 를 봅니다(맥 브라우저에서 `http://127.0.0.1:8787/api/dev-auth/accounts`).

로그인 이름을 계정에 잇습니다.
```
../.venv/bin/python -m z2h_server link-tailscale --login <로그인 이름> --user <user_id>
```
- 잘 되면: `연결함: <로그인 이름> → <user_id>` 한 줄. 로그인 이름은 대소문자를 가리지 않고 소문자로 저장됩니다.
- `이미 계정 ... 에 이어져 있습니다` 가 나오면: 한 로그인 이름은 계정 하나에만 이어집니다. 바꾸려면 아래 끊기를 먼저 합니다.
- `그런 학습 계정(user_id)이 없습니다` 가 나오면: user_id 를 다시 복사합니다.
- 되돌리기: 아래 끊기 명령.

이어 둔 목록을 봅니다(로그인 이름, user_id, 계정 이름, 이은 시각).
```
../.venv/bin/python -m z2h_server list-tailscale
```

잇기를 끊습니다. 끊으면 그 Tailscale 계정은 바로 401(아무것도 못 읽음)이 됩니다. 학습 기록은 지워지지 않습니다.
```
../.venv/bin/python -m z2h_server unlink-tailscale --login <로그인 이름>
```

### 6-3. 서버가 믿는 조건

요청 하나를 "serve 를 거친 폰 요청"으로 믿으려면 아래가 모두 맞아야 합니다. 하나라도 틀리면 그 요청은 누구도 아니고(401) 다른 로그인으로 넘어가지도 않습니다.
1. 접속한 쪽이 `127.0.0.1`(serve 는 이 컴퓨터 안에서 접속함)
2. 주소 이름(Host)이 `Z2H_TAILSCALE_HOST` 와 같음
3. `Tailscale-User-Login` 이 정확히 1개, 비어 있지 않음, 인코딩된 값(`=?` 로 시작)이 아님
4. Funnel 표시(`Tailscale-Funnel-Request`)나 Cloudflare 터널 표시(`CF-Connecting-IP`, `CF-Ray`)가 없음. Funnel 은 쓰지 않지만 서버에서도 한 번 더 막습니다. `X-Forwarded-*` 는 serve 가 붙일 수 있어 판단에 쓰지 않습니다
5. 그 로그인 이름이 6-2 로 이어져 있음(자동 가입 없음)

그리고 두 로그인은 섞이지 않습니다.
- serve 주소로 온 요청: Tailscale 로그인만. 개발용 로그인 주소(`/api/dev-auth/*`)는 404, 개발용 쿠키와 `X-Z2H-User` 는 무시.
- `127.0.0.1`·`localhost` 로 온 요청: 개발용 로그인만. `Tailscale-User-Login` 이 붙어 와도 믿지 않고, 그런 요청은 개발용 로그인도 거부합니다.
- serve 주소로 온 쓰기 요청은 `Origin` 이 정확히 `https://<serve 이름>` 일 때만 받습니다. Origin 이 없거나 `http://127.0.0.1:8787` 같은 로컬 주소여도 403 입니다. Tailscale 신원은 그 기기의 모든 요청에 저절로 붙기 때문에 다른 사이트가 몰래 보내는 쓰기를 이것으로 막습니다.
- 반대로 `127.0.0.1`·`localhost` 로 온 쓰기에서 `Origin: https://<serve 이름>` 은 받지 않습니다(`Z2H_EXTRA_ORIGINS` 에 넣어도). 로컬 주소의 다른 규칙(Origin 없는 쓰기 허용, Jupyter 용)은 그대로입니다.
- 서버 로그에는 로그인 이름(이메일)을 남기지 않습니다. DB 오류 기록에도 SQL 에 넣은 값이 나오지 않게 해 두었습니다.

### 6-4. 처음 켠 뒤 폰에서 한 번 확인할 것

폰 브라우저에서 `https://<기기>.<tailnet>.ts.net/api/me` 를 엽니다.
- 잇기 전: `"auth_provider": "tailscale"` 과 "이 Tailscale 계정은 아직 학습 계정에 이어져 있지 않습니다" 안내(401)가 보이면 정상입니다.
- 잇고 난 뒤: `"ok": true`, 이은 계정의 `user_id`, `"auth_provider": "tailscale"` 이 보이면 정상입니다.
- **`"auth_provider": "dev_local"` 이 보이면 멈춥니다.** serve 가 주소 이름(Host)을 바꿔 넘긴다는 뜻이고, 이 설계의 전제(serve 는 Host 를 그대로 넘김, 미확인)가 틀린 것입니다. serve 를 끄고 CTO 에게 알립니다.
- `bad_host` 가 보이면: 짧은 이름이나 IP 로 연 것입니다. `https://<기기>.<tailnet>.ts.net` 전체 이름으로 엽니다.

### 6-5. 남는 위험

- **같은 컴퓨터 안 프로그램은 위조할 수 있습니다.** 맥미니 안에서 도는 프로그램은 `127.0.0.1:8787` 에 serve 이름 Host 와 아무 로그인 이름을 붙여 보낼 수 있습니다. 그런 프로그램은 DB 파일도 직접 읽을 수 있어서 서버가 막을 수 있는 범위 밖입니다. 맥미니에 모르는 프로그램을 들이지 않는 것이 방어입니다.
- **맥미니 안의 다른 프록시도 통로가 될 수 있습니다.** 바깥 요청의 Host 와 머리말을 그대로 넘기는 프록시를 이 서버 앞에 붙이면 위조 통로가 됩니다.
- **serve 가 앱 dev·preview 서버를 가리키면 위험합니다.** 앱 dev 서버(4321)·preview 서버의 `/api` 프록시는 Host 를 `127.0.0.1:8787` 로 바꾸고 전달 머리말을 지웁니다. serve 가 그 포트를 가리키면 신원 머리말 없는 요청(태그된 기기 등)이 맥 안에서 바로 온 요청처럼 보여 개발용 로그인에 닿을 수 있습니다. 그래서 serve 대상은 `http://127.0.0.1:8787` 만 씁니다(6절 첫머리).
- **tailnet 을 공유받은 사람:** 그 사람의 요청에도 로그인 이름이 붙습니다. 이어 두지 않았으면 401 이라 아무것도 못 읽지만, 주소와 화면(앱 정적 파일)은 열립니다.
- **태그된 기기:** serve 가 로그인 이름을 붙이지 않아 로그인할 수 없습니다(401).
- **Tailscale 로그인 = 바로 그 계정:** 비밀번호나 세션이 따로 없습니다. 폰을 잃어버리면 Tailscale 관리 화면에서 그 기기를 빼거나 6-2 끊기를 합니다.

## 7. 공개 전환 시 바꿀 것

지금은 Tailscale serve(내 기기만)로만 씁니다. 아래는 나중에 인터넷 공개로 바꿀 때 손댈 곳의 목록이고, **지금은 아무것도 바꾸지 않았습니다**(동작은 그대로). 공개 전환 자체(배포, 도메인, 터널, Funnel)는 승인 항목이며, 저장소 전체 기준은 `docs/PUBLIC_RELEASE_CHECKLIST.md` 입니다.

전제: 공개 뒤에도 서버는 `127.0.0.1` 에 붙고, 앞에 프록시(Cloudflare Tunnel 같은 것)를 둡니다. 프록시·터널·DNS 설정은 CTO 가 CEO 에게 먼저 알린 뒤 합니다.

| 무엇을 | 어느 설정·파일에서 | 지금 값 | 공개 때 값 | 승인 |
|---|---|---|---|---|
| 로그인 수단 교체 | `auth.py` 의 `build_auth`(조립 한 곳) + 새 클래스 `EmailOtpAuth`·`GoogleAuth` 구현. API 코드는 고치지 않음 | 맥: 개발용 로그인(`dev_local`), 폰: Tailscale(`tailscale`) | 공개 주소: 이메일 일회용 코드(`email_otp`)·Google(`google`). 공개 주소에서는 개발용 로그인 없음 | 필요(메일 발송 서비스·키, Google OAuth 키 발급) |
| Tailscale 로 쓰던 계정을 일반 로그인에 잇기 | DB `auth_identity` 표(provider, subject → user_id) | `(tailscale, 로그인 이름) → user_id` | 같은 user_id 로 `(email_otp, 확인된 이메일)` 또는 `(google, Google 계정 고유번호)` 줄을 더함. 계정·학습 기록은 그대로(모두 user_id 기준) | 필요(개인정보 처리 방침) |
| 허용 Host·Origin | `config.py` `Settings.allowed_hostnames`·`allowed_origins`·`serve_origin` | `127.0.0.1`·`localhost`(+ serve 이름), Origin `http://127.0.0.1:8787`·`http://localhost:8787`(+ `https://<serve 이름>`) | 공개 이름 1개를 serve 이름처럼 Host·Origin 을 묶어 받는 설정 칸(미구현). 임시로 `Z2H_EXTRA_HOSTS`·`Z2H_EXTRA_ORIGINS` 도 되지만 Origin 이 Host 와 묶이지 않음 | 필요(공개 배포, 도메인) |
| 공개 기준 주소 | `config.py` `Settings.base_url` | `http://127.0.0.1:8787` | `https://<공개 이름>`(안내 글에 쓰임) | 공개 배포 승인에 포함 |
| 쿠키 속성 | `config.py` `CookieSettings`, `Z2H_COOKIE_SECURE`·`Z2H_COOKIE_SAMESITE`·`Z2H_SESSION_DAYS` | 이름 `z2h_dev_session`, Secure 없음, SameSite=Strict, Path `/`, Domain 없음, HttpOnly, 30일 | Secure 켬(`Z2H_COOKIE_SECURE=1`), Domain 없음 유지. SameSite 는 Google 로그인 흐름에 따라 Strict 유지 또는 Lax(미확인). 이름을 바꾸면 모두 다시 로그인 | 불필요(CTO 검토) |
| 개발용 로그인 끄기 | `Z2H_DEV_AUTH=0`. `Z2H_EXTRA_HOSTS` 에 바깥 이름이 있으면 저절로 꺼짐 | 켜짐(맥 안에서만) | 꺼짐 | 불필요 |
| DB: SQLite → Postgres | 4-1절(`storage/`, `requirements.txt`, `Z2H_DB_URL`) | SQLite 파일 `server/data/z2h.sqlite3` | Postgres | 필요(유료 DB) |
| 프로세스 1개 전제(server_seq) | `storage/sql.py` (프로세스 안 잠금 `threading.RLock`, `sync_counter` 한 줄, 시각이 앞으로만 가게 하는 `_now`) | uvicorn 프로세스 1개 | 1개로 유지. 늘리려면 번호 매기기(server_seq·attempt_no)를 DB 잠금으로 바꾼 뒤(미구현) | 불필요(설계 변경은 CTO 검토) |
| 프록시 뒤 실제 접속 주소 | `config.py` `TRUST_PROXY_HEADERS`(불변식), `security.py`, `auth.py` | 머리말을 믿지 않음. 모든 요청의 접속 주소는 `127.0.0.1` | 그대로 둔다. 속도 제한 등에 실제 주소가 필요하면 '우리 프록시가 붙인 머리말 하나'만 읽는 코드를 따로 넣음(미구현, 프록시 종류 미정) | 필요(터널·프록시는 네트워크 설정) |
| 속도 제한 | 없음 | 없음 | 로그인 코드 보내기·확인, 쓰기 API 에 필요(미구현, 방식 미정) | 불필요(구현 검토) |
| 로그의 개인정보 | `app.py`·`auth.py`(로그인 이름을 쓰지 않음), `storage/sqlite.py`(SQL 값 숨김), uvicorn 접속 기록 | 터미널 출력만. 접속 기록에는 주소(`127.0.0.1`)·경로·상태 코드만, 로그인 이름 없음 | 로그를 어디에 얼마나 둘지 정하기(미정). 이메일 로그인이 생기면 이메일도 로그에 쓰지 않는 규칙 유지 | 필요(개인정보 처리 방침) |
| 백업 | `GET /api/export`(계정별 JSON), DB 파일 | 손으로: 계정별 내보내기, 서버를 끈 뒤 `server/data/z2h.sqlite3` 복사 | Postgres 자동 백업 또는 정기 덤프(미정) | 유료 DB 면 필요 |
| Tailscale 로그인 | `Z2H_TAILSCALE_HOST` | 설정하면 켜짐(기본값은 꺼짐. serve는 CTO 검토 뒤에 켬) | 계속 쓸지 끌지 결정(둘은 Host 로 나뉘어 같이 둘 수 있음) | 불필요 |

자세한 메모
- **로그인 수단 넣는 법**: 새 수단은 `AuthAdapter` 를 이어받아 `provider`, `no_user_message_ko`, `current_user_id`(필요하면 `dev_login`)만 채웁니다. 그다음 `build_auth` 에서 공개 이름 → 새 수단을 `ByHostAuth` 의 routes 에 더합니다. 이름표 `AUTH_PROVIDERS` 에 이미 `email_otp`·`google` 이 있습니다. 세션 쿠키는 `CookieSettings` 와 `sessions` 표를 그대로 쓸 수 있습니다.
- **계정 잇기**: Tailscale 로그인 이름이 이메일처럼 보여도 그 이메일을 받는 사람이 같은 사람이라는 보장은 없습니다(예: `someone@github` 같은 이름도 있음). 그래서 이메일이 같다고 저절로 잇지 않습니다. 운영자가 맥미니에서 명령으로 잇거나(지금의 `link-tailscale` 같은 명령, 미구현), 이메일 코드로 확인된 뒤에만 잇습니다. Google 은 이메일이 아니라 Google 계정 고유번호를 subject 로 씁니다.
- **server_seq**: 한 프로세스 안의 잠금으로 번호를 줄 세웁니다. 프로세스를 둘 이상 띄우거나 서버를 여러 대 두면 attempt_no 가 겹쳐 기록이 거절될 수 있습니다(미확인, 시험 안 함). 공개 직후에는 프로세스 1개로 둡니다.
- **개발용 로그인**: 비밀번호가 없는 길이라 공개 주소에서는 열리면 안 됩니다. 지금도 공개 이름을 `Z2H_EXTRA_HOSTS` 에 넣으면 저절로 꺼지고, 프록시 머리말이 붙은 요청은 받지 않습니다. 그래도 공개 때는 `Z2H_DEV_AUTH=0` 을 명시합니다.
