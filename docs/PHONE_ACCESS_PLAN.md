# 폰 접속 계획 (초안, 실행 금지)

- 작성: PM, 2026-11-16 KST. 2026-11-17 얼큰이 결정(05:45)으로 로그인 장치 A안을 구현하고 이 문서를 고침.
- 상태: **serve는 켜지 않았다. 이 문서의 `tailscale` 명령은 하나도 실행하지 않았다.** 서버 쪽 로그인 장치(A안)만 구현했고 자동 테스트로만 확인했다.
- 실행 주체: 로그인 장치는 보안 변경이라 **CTO가 코드를 검토한 뒤**, CEO에 사전 통보하고 CTO가 직접 serve를 켠다. PM과 서브 에이전트는 실행하지 않는다(저장소 규칙 9).
- 표시: [확인됨] 저장소 코드·테스트로 확인 / [문서 확인] Tailscale 공식 문서(tailscale.com/kb/1312/serve, 2026-11-17 열람) / [미확인] 실행 전 실제 기기로 확인할 것

## 1. 목적과 정해진 것

목적: 얼큰이님이 폰에서도 맥미니의 Z2H 앱과 진도를 이어 보게 한다. 공개 배포가 아니다.

정해진 것(CTO 22:35)
- Tailscale의 `serve`만 쓴다. 얼큰이님 tailnet(본인 기기끼리만 이어진 사설망) 안에서만 열린다.
- **Funnel(인터넷 전체에 여는 기능)은 쓰지 않는다.**
- 서버 바인드는 `127.0.0.1` 그대로. 맥미니 방화벽·공유기 포트를 열지 않는다.

지금 상태 [확인됨]
- 진도 서버는 `127.0.0.1:8787`에만 열리고 다른 주소로는 실행을 거부한다.
- `Z2H_TAILSCALE_HOST` 설정이 없으면 서버는 전과 같다(Host가 `127.0.0.1`·`localhost`일 때만 응답, 개발용 로그인만).
- Tailscale 설정은 만들거나 바꾼 것이 없다.

## 2. 로그인 장치: A안으로 결정, 구현함 (CTO 검토 대기)

결정(얼큰이 11/17): Tailscale serve가 넘겨주는 접속자 정보를 서버가 학습 계정에 잇는다. 구현은 `server/z2h_server/auth.py`의 `TailscaleAuth`, 쓰는 법은 `server/README.md` 6절.

Tailscale 문서에서 확인한 것 [문서 확인]
- serve는 프록시한 요청에 `Tailscale-User-Login`(로그인 이름) 머리말을 붙인다.
- 들어온 요청에 같은 머리말이 이미 있으면 serve가 지운다(바깥에서 넣은 위조 값 제거).
- 태그된 기기와 Funnel 요청에는 이 머리말이 없다. 기기를 공유받은 바깥 사용자에게는 붙는다.
- 백엔드는 localhost에만 열라고 권한다. 그러면 위조할 수 있는 것은 같은 컴퓨터 안 프로그램뿐이다.

서버가 하는 일 [확인됨: `server/tests/test_tailscale_auth.py`, `test_tailscale_cli.py`]
| 항목 | 동작 |
|---|---|
| 켜기 | `Z2H_TAILSCALE_HOST=<기기>.<tailnet>.ts.net` 하나. `.ts.net` 이름 1개가 아니면 서버가 켜지지 않는다 |
| 머리말을 믿는 조건 | 접속 쪽이 `127.0.0.1` + Host가 설정한 serve 이름과 같음 + `Tailscale-User-Login`이 정확히 1개. 하나라도 틀리면 401 |
| 계정 잇기 | 자동 가입 없음. 맥미니에서 `link-tailscale` 명령으로 이어 둔 로그인 이름만 통과. 웹 주소로는 이을 수 없다 |
| 개발용 로그인과 분리 | serve 이름으로 온 요청은 개발용 로그인 주소가 404, 개발용 쿠키·머리말 무시. 맥의 `127.0.0.1` 요청은 전처럼 개발용 로그인만 되고 Tailscale 머리말이 붙어 있으면 거부 |
| 개인정보 | 로그인 이름(이메일)은 서버 로그·응답에 나오지 않는다. DB(`auth_identity`, git 제외 폴더)에는 저장된다 |
| 앱 화면 | 이어진 폰은 "Tailscale 계정으로 접속 중", 안 이어진 폰은 "맥미니에서 연결한 뒤 새로 고침" 안내. 개발용 계정 만들기는 보이지 않는다 |

CTO 검토 때 볼 것
1. **전제 [미확인]: serve가 Host를 원래 이름 그대로 서버에 넘긴다.** 실제 기기로 재 보지 않았다. 틀리면 5절 첫 확인에서 `dev_local`이 보인다. 그때는 serve를 바로 끈다.
2. 같은 컴퓨터 안 프로그램은 Host와 머리말을 꾸며 `127.0.0.1:8787`에 보낼 수 있다(문서가 말한 남는 범위). 맥미니 안에 Host를 그대로 넘기는 다른 프록시를 서버 앞에 두면 같은 통로가 된다.
3. 세션·로그아웃이 없다. Tailscale 로그인이 곧 그 계정이다. 폰을 잃어버리면 Tailscale 관리 화면에서 기기를 빼거나 `unlink-tailscale`.
4. serve 이름으로 온 쓰기 요청은 Origin이 정확히 `https://<serve 이름>`일 때만 받는다(없어도 거부). 그래서 serve는 HTTPS 기본 포트(443)로만 연다. 폰 브라우저가 같은 주소로 보내는 쓰기에 Origin을 붙이는지는 실제 폰으로 확인할 것 [미확인]. 안 붙이면 폰에서 저장이 403으로 막힌다(막히는 쪽으로 실패).
5. tailnet을 공유받은 사람은 기록 API에서 401이지만 앱 화면(정적 파일)은 열린다.
6. 설정이 없을 때도 달라진 점 2가지: 개발용 로그인이 `Tailscale-User-*` 머리말이 붙은 요청을 거부한다(잠금을 강하게 하는 쪽), `/api/me`와 401 본문에 `auth_provider` 칸이 생겼다.

7. serve 대상은 `http://127.0.0.1:8787`만. 앱 dev·preview 포트를 가리키면 그 프록시가 Host를 로컬로 바꿔 개발용 로그인에 닿을 수 있다.
8. Funnel 표시 머리말(`Tailscale-Funnel-Request`)이나 Cloudflare 머리말이 있는 요청은 Tailscale 로그인도 개발용 로그인도 거부한다. Funnel 머리말 이름은 실제 요청으로 확인하지 않았다 [미확인].

버린 안: B(이메일·Google 먼저, 공개 승인 항목), C(tailnet 안에서 개발용 로그인 허용, 계정 구분 없음), D(미룸).

## 3. 구성 그림

```
폰 (Tailscale 앱 로그인, 같은 tailnet)
   │  https://<맥미니 이름>.<tailnet 이름>.ts.net
   ▼
맥미니의 Tailscale (serve: tailnet 안에서만 받음, HTTPS 인증서 자동)
   │  http://127.0.0.1:8787
   ▼
Z2H 진도 서버 (127.0.0.1 바인드 그대로) ── SQLite
```

## 4. 단계별 스크립트 초안 (실행 금지, [미확인] 실행 전 공식 문서 대조)

명령 이름과 옵션은 Tailscale 버전에 따라 다르다. 아래는 순서를 보이기 위한 초안이다.

1. 맥미니와 폰이 같은 tailnet에 로그인돼 있는지 본다.
```
tailscale status
```
2. 지금 serve·Funnel 설정이 비어 있는지 본다. 예전에 지운 프로그램의 공유 규칙이 남아 있을 수 있으니 먼저 확인한다.
```
tailscale serve status
```
3. 서버를 폰 로그인을 켠 상태로 켠다(`server` 폴더에서). 맥의 개발용 로그인은 그대로 된다.
```
Z2H_TAILSCALE_HOST=<맥미니 이름>.<tailnet 이름>.ts.net ../.venv/bin/python -m z2h_server
```
4. 얼큰이님 Tailscale 로그인 이름을 맥에서 쓰던 학습 계정에 잇는다. 계정 번호는 맥 브라우저의 `http://127.0.0.1:8787/api/dev-auth/accounts`에서 본다.
```
../.venv/bin/python -m z2h_server link-tailscale --login <로그인 이름> --user <user_id>
```
5. tailnet 안에서만 8787을 잇는다. **`tailscale funnel` 명령은 쓰지 않는다.**
```
tailscale serve --bg 8787
```
6. 설정을 다시 보고 Funnel이 꺼져 있는지 확인한다.
```
tailscale serve status
```

## 5. 확인할 것 (실행한 사람이)

- **맨 먼저**: 폰에서 `https://<맥미니 이름>.<tailnet 이름>.ts.net/api/me`를 연다. `"auth_provider": "tailscale"`이면 정상. **`"dev_local"`이 보이면 serve를 끄고 멈춘다**(2절 CTO 검토 1번 전제가 틀린 것).
- 잇기 전에는 401과 "아직 학습 계정에 이어져 있지 않습니다" 안내, 이은 뒤에는 그 계정의 `user_id`가 보인다.
- 폰에서 한 단계를 완료하면 상단 표시가 "저장됨"이 되고 맥(`http://127.0.0.1:8787`)의 같은 계정에 보인다. 저장이 계속 실패하면 2절 4번(Origin)을 본다.
- 폰에서 `/api/dev-auth/accounts`는 404다.
- Tailscale을 끈 폰이나 tailnet 밖 기기에서는 주소가 열리지 않는다.
- `tailscale serve status`에 Funnel 표시가 없다.
- 맥미니에서 `lsof -iTCP -sTCP:LISTEN -P | grep 8787` 결과가 `127.0.0.1:8787` 한 줄이다.

## 6. 되돌리는 법

1. serve 규칙을 지운다: `tailscale serve reset` [미확인: 버전별 명령]. `tailscale serve status`가 비었는지 본다.
2. 서버를 끄고 `Z2H_TAILSCALE_HOST` 없이 다시 켠다(전과 같은 서버가 된다). 계정 잇기를 없애려면 `unlink-tailscale`. 학습 기록은 지워지지 않는다.
3. 서버나 앱을 지울 때는 serve 규칙도 함께 지운다. 규칙은 Tailscale 쪽 설정이라 앱을 지워도 남는다.

## 7. 위험

| 위험 | 대응 |
|---|---|
| Funnel이 켜져 인터넷에 열림 | `tailscale funnel` 명령을 쓰지 않는다. 4절 6번에서 확인. Funnel 요청에는 접속자 머리말이 없어 기록 API는 401이지만 앱 화면은 열린다 |
| tailnet을 다른 사람과 공유 | 그 사람도 주소와 앱 화면을 열 수 있다. 이어 두지 않은 로그인 이름은 기록 API에서 401 |
| 개발용 로그인이 tailnet에 노출 | serve 이름으로 온 요청에서는 개발용 로그인이 404. 로컬 이름으로 온 요청도 전달 머리말이나 Tailscale 머리말이 있으면 거부 [확인됨]. `Z2H_EXTRA_HOSTS`에 serve 이름을 넣지 않는다(넣으면 개발용 로그인이 통째로 꺼짐) |
| 남은 serve 규칙 | 되돌리는 법 3번. 나중에 다른 프로그램이 8787을 쓰면 그 프로그램이 tailnet에 열린다 |
| 서버 프로세스를 여러 개 띄움 | 동기화 번호(server_seq)와 쓰기 잠금이 프로세스 1개 기준. 1개만 띄운다 |

## 8. 실행 기록

실제로 실행한 `tailscale` 명령: 0건(P1 검수 서브가 `tailscale serve status`를 한 번 시도했으나 권한에서 거부되어 실행되지 않음. 세션 기록으로 확인). serve 켜기: 0건. 로그인 장치: 서버 코드 구현 1건(A안, CTO 검토 대기, 자동 테스트로만 확인).
