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

모두 `z2h_server/config.py` 한 곳에 있습니다. 환경변수로도 바꿀 수 있습니다.

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

## 4. 표(스키마) 바꾸기

표는 Alembic 마이그레이션 파일(`alembic/versions/`)로만 만들고 바꿉니다. 서버 코드가 표를 직접 만들지 않습니다.
- 지금 버전: `0002`. 버전은 Alembic 기본 표 `alembic_version` 에 적힌다.
  - `0001`: DESIGN.md 5절 표 전부 + 12.5절의 `applied_ops`, server_seq 번호표 `sync_counter`.
  - `0002`: `taste_result` 표를 지운다(앱이 한 번도 쓰지 않음. 맛보기 기록은 `taster_result` 하나). 그 표에 행이 있었다면 버려진다. 내리면 빈 표로 다시 생긴다.
  - 예전 판으로 만든 DB 도 서버를 켜면 자동으로 `0002` 까지 올라간다.
- 손으로 올리기·내리기(`server` 폴더에서): `../.venv/bin/alembic upgrade head`, `../.venv/bin/alembic downgrade base`
  - 내리기는 표를 모두 지웁니다(기록도 지워짐). 먼저 `http://127.0.0.1:8787/api/export` 로 백업을 받습니다.
- 표를 바꾸면 `z2h_server/schema.py` 도 같이 고칩니다. 둘이 다르면 테스트가 실패합니다.

## 5. 폴더

```
server/
  z2h_server/      서버 코드
    config.py      설정 한 곳(경로·주소·제한)
    app.py         앱 만들기, 정적 파일
    api.py         /api/* (health, state, sync, result-code, grade, export, 개발 로그인, me)
    auth.py        AuthAdapter(요청의 현재 계정) → LocalDevAuth(맥), TailscaleAuth(폰), ByHostAuth(Host 로 고름). 이메일·Google 은 자리만
    __main__.py    서버 켜기, Tailscale 잇기 명령(link-tailscale 등)
    security.py    Host·Origin·본문 크기·접속 주소 검사
    sync.py        동기화 검사와 충돌 규칙
    result_code.py 결과코드 해독
    schema.py      표 정의(읽고 쓰기용. 만드는 것은 마이그레이션)
    storage/       StorageAdapter(약속) → SqlAdapter(표준 SQL) → SqliteAdapter
  alembic/         마이그레이션
  tests/           pytest
  data/            DB 파일(git 제외)
```

## 6. 폰에서 열기: Tailscale 로그인 (로그인 A안)

폰은 Tailscale serve(같은 tailnet 안에서만 열리는 길. 인터넷 공개인 Funnel 은 쓰지 않음)를 거쳐 맥미니의 이 서버(`127.0.0.1:8787`)에 닿습니다.
serve 는 요청마다 그 사람의 Tailscale 로그인 이름을 머리말(`Tailscale-User-Login`)로 붙여 주고, 서버는 그 이름을 맥미니에서 미리 이어 둔 학습 계정으로 바꿉니다.
맥에서 쓰던 계정과 같은 계정에 이으면, 맥에서 하던 진도를 폰에서 이어 봅니다.

serve 를 켜는 일(Tailscale 설정)은 네트워크 설정이라 이 문서 범위 밖입니다. CTO 가 CEO 에게 먼저 알린 뒤 합니다. 서버는 계속 `127.0.0.1` 에만 붙습니다.

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
4. 그 로그인 이름이 6-2 로 이어져 있음(자동 가입 없음)

그리고 두 로그인은 섞이지 않습니다.
- serve 주소로 온 요청: Tailscale 로그인만. 개발용 로그인 주소(`/api/dev-auth/*`)는 404, 개발용 쿠키와 `X-Z2H-User` 는 무시.
- `127.0.0.1`·`localhost` 로 온 요청: 개발용 로그인만. `Tailscale-User-Login` 이 붙어 와도 믿지 않고, 그런 요청은 개발용 로그인도 거부합니다.
- 다른 사이트에서 보낸 쓰기 요청은 serve 주소에서도 거부합니다(Origin 검사). 받는 Origin 은 `https://<serve 이름>` 하나입니다.
- 서버 로그에는 로그인 이름(이메일)을 남기지 않습니다. DB 오류 기록에도 SQL 에 넣은 값이 나오지 않게 해 두었습니다.

### 6-4. 처음 켠 뒤 폰에서 한 번 확인할 것

폰 브라우저에서 `https://<기기>.<tailnet>.ts.net/api/me` 를 엽니다.
- 잇기 전: `"auth_provider": "tailscale"` 과 "이 Tailscale 계정은 아직 학습 계정에 이어져 있지 않습니다" 안내(401)가 보이면 정상입니다.
- 잇고 난 뒤: `"ok": true`, 이은 계정의 `user_id`, `"auth_provider": "tailscale"` 이 보이면 정상입니다.
- **`"auth_provider": "dev_local"` 이 보이면 멈춥니다.** serve 가 주소 이름(Host)을 바꿔 넘긴다는 뜻이고, 이 설계의 전제(serve 는 Host 를 그대로 넘김, 미확인)가 틀린 것입니다. serve 를 끄고 CTO 에게 알립니다.
- `bad_host` 가 보이면: 짧은 이름이나 IP 로 연 것입니다. `https://<기기>.<tailnet>.ts.net` 전체 이름으로 엽니다.

### 6-5. 남는 위험

- **같은 컴퓨터 안 프로그램은 위조할 수 있습니다.** 맥미니 안에서 도는 프로그램은 `127.0.0.1:8787` 에 serve 이름 Host 와 아무 로그인 이름을 붙여 보낼 수 있습니다. 그런 프로그램은 DB 파일도 직접 읽을 수 있어서 서버가 막을 수 있는 범위 밖입니다. 맥미니에 모르는 프로그램을 들이지 않는 것이 방어입니다.
- **맥미니 안의 다른 프록시도 통로가 될 수 있습니다.** 바깥 요청의 Host 와 머리말을 그대로 넘기는 프록시를 이 서버 앞에 따로 붙이면 위조 통로가 됩니다. 앱 dev 서버의 `/api` 프록시는 `127.0.0.1` 에만 붙고 Host 를 `127.0.0.1:8787` 로 바꾸므로 해당하지 않습니다.
- **tailnet 을 공유받은 사람:** 그 사람의 요청에도 로그인 이름이 붙습니다. 이어 두지 않았으면 401 이라 아무것도 못 읽지만, 주소와 화면(앱 정적 파일)은 열립니다.
- **태그된 기기:** serve 가 로그인 이름을 붙이지 않아 로그인할 수 없습니다(401).
- **Tailscale 로그인 = 바로 그 계정:** 비밀번호나 세션이 따로 없습니다. 폰을 잃어버리면 Tailscale 관리 화면에서 그 기기를 빼거나 6-2 끊기를 합니다.
