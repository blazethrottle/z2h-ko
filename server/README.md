# Z2H 진도 서버

학습 진도(단계 완료, 문제 답, 실습 시간, 채점 결과)를 맥미니에 저장해 폰과 컴퓨터에서 이어 보게 하는 작은 서버입니다.
이 컴퓨터 안(`127.0.0.1`)에서만 열리고, 바깥 네트워크로는 열리지 않습니다.

- 저장 위치: `server/data/z2h.sqlite3` 파일 하나(git 에 올라가지 않음). 기록은 계정별로 나뉜다.
- 계정: 로컬 개발 로그인(비밀번호 없음)으로 여러 계정을 만들고 바꿀 수 있다. 이메일·Google 로그인은 공개 승인 뒤.
- **개발용 로그인은 이 컴퓨터 안에서만 쓰고, 터널을 붙이면 꺼진다.** 프록시·터널을 거친 요청(CF-Connecting-IP, X-Forwarded-For 같은 머리말이 붙은 요청)이나 127.0.0.1·localhost 가 아닌 주소로 온 요청에서는 동작하지 않는다. `Z2H_EXTRA_HOSTS` 에 터널 주소를 넣거나 `Z2H_DEV_AUTH=0` 이면 아예 꺼지고, 시작 화면에 "개발용 로그인 꺼짐"이 나온다. 그때는 로그인 수단이 없어 진도 읽기·쓰기가 모두 막힌다(401).
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
테스트가 확인하는 것: 표 만들기·지우기 왕복, 모든 기록 표의 user_id 가 users 로 가는 FK, 두 계정의 기록이 서로 안 보임, 동기화(같은 op_id 한 번만, 충돌 기록, 진도 뒤로 안 감, 오프라인 대기열 한꺼번에, 두 기기가 같은 문제를 풀면 둘 다 남고 번호 1·2, 늦게 올라온 옛 기록도 server_seq 로 받음), 객관식 답·누적 점검 저장, 결과코드(정상, 글자 틀림), 127.0.0.1 밖 주소 거부, Host·Origin 검사, 본문 1MB 제한, 실습 시간 저장과 되돌리기, 실제로 서버를 한 번 켜서 `/api/health` 응답.

## 2-1. 계정 하나 만들어 보기 (손으로 확인할 때)

서버를 켠 상태에서, 개발 계정을 하나 만들고 그 계정의 진도를 읽어 봅니다. 쿠키는 임시 파일에 담깁니다.
```
curl -s -c /tmp/z2h.cookie -X POST -H 'Content-Type: application/json' -d '{"display_name":"내 계정"}' http://127.0.0.1:8787/api/dev-auth/accounts
curl -s -b /tmp/z2h.cookie http://127.0.0.1:8787/api/state
```
- 잘 되면: 첫 줄은 `"ok":true` 와 새 `user_id`, 둘째 줄은 빈 표 15개가 든 JSON.
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

## 4. 표(스키마) 바꾸기

표는 Alembic 마이그레이션 파일(`alembic/versions/`)로만 만들고 바꿉니다. 서버 코드가 표를 직접 만들지 않습니다.
- 지금 버전: `0001`(DESIGN.md 5절 표 전부 + 12.5절의 `applied_ops`, server_seq 번호표 `sync_counter`). 버전은 Alembic 기본 표 `alembic_version` 에 적힌다.
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
    auth.py        AuthAdapter(요청의 현재 계정) → LocalDevAuth. 이메일·Google 은 자리만
    security.py    Host·Origin·본문 크기·접속 주소 검사
    sync.py        동기화 검사와 충돌 규칙
    result_code.py 결과코드 해독
    schema.py      표 정의(읽고 쓰기용. 만드는 것은 마이그레이션)
    storage/       StorageAdapter(약속) → SqlAdapter(표준 SQL) → SqliteAdapter
  alembic/         마이그레이션
  tests/           pytest
  data/            DB 파일(git 제외)
```
