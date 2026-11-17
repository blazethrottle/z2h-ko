# 맛보기(첫 30분) 노트북

설치 없이 브라우저만으로, 영어 이름 3만 2천 개를 보고 작은 AI가 새 이름을 지어내게 하는 체험 노트북입니다.
기본 실행 장소는 Colab(구글이 주는 무료 온라인 노트북)이고, 내 컴퓨터의 Jupyter는 선택입니다.

출처: 이름 데이터와 방식은 Andrej Karpathy의 makemore(MIT 라이선스)를 따릅니다. https://github.com/karpathy/makemore
이 노트북은 비공식 학습 가이드입니다.

| 파일 | 무엇 |
|---|---|
| `taster.ipynb` | Colab용 노트북 한 개. 단계마다 안내 글과 준비된 코드 셀. 실행 출력 없이 저장돼 있습니다 |
| `build_notebook.py` | 노트북을 교사 정본(`inputs/pedagogy/content/taster.json`)에서 만드는 프로그램. 노트북은 손으로 고치지 않습니다 |
| `mac_run.json` | 맥에서 노트북을 실제로 실행해 나온 출력, 실행 시간, torch 버전, 날짜. 손으로 쓰지 않습니다 |

## 무엇이 들어 있나

- 교사 정본의 단계 순서대로: 단계 이름, 할 일, 줄별 풀이 표, 보여야 하는 것, 깨달음, 그리고 정본 코드 그대로인 코드 셀.
- 점수는 없습니다. 채점 셀과 채점 도구(z2h_check)를 넣지 않았습니다. 단계 완료는 앱에서 "직접 확인했어요"로 표시합니다.
- 마지막 안내: 정리 문구와 "T-S07 출력(이름 10줄)을 복사해 앱의 맛보기 끝 화면에 붙여 넣으면 이름 카드를 만들 수 있습니다".
- 처음부터 순서대로 실행하면 이름과 손실 숫자가 정본의 출력 예와 같게 나옵니다(무작위 출발점을 42로 고정). 셀을 다시 실행해 다른 이름이 나오는 것은 정상입니다.

## Colab에서 열기 (기본)

저장소가 비공개인 동안에는 "파일 받기 → Colab에 올리기" 순서로 엽니다.

1. `taster.ipynb` 파일을 내 컴퓨터로 받습니다.
2. https://colab.research.google.com 에 들어가 메뉴의 "파일 → 노트북 업로드"에서 받은 파일을 고릅니다(개인 Google 계정으로 씁니다).
3. 맨 위부터 코드 셀을 한 칸씩 실행합니다(셀을 누르고 Shift+Enter).
4. Colab에서 런타임(실행 환경)을 다시 시작했다면 T-S03 셀부터 차례로 다시 실행합니다.

"Colab에서 바로 열기" 링크: 공개 노트북 주소가 승인되면 이 자리에 넣습니다. 지금은 넣지 않습니다.

Colab에서 직접 실행해 본 기록은 아직 없습니다(미확인). 아래 실측은 맥에서 잰 것입니다.

## 내 컴퓨터 Jupyter에서 열기 (선택)

저장소 안의 노트북 파일을 그대로 실행·저장하면 "생성본이 최신인지" 검사가 실패합니다. 먼저 저장소 밖(예: 문서 폴더)으로 복사한 뒤 엽니다.

```bash
# 노트북을 문서 폴더로 복사합니다(저장소 파일은 그대로 둡니다)
cp notebooks/taster/taster.ipynb ~/Documents/
# 저장소 .venv 의 JupyterLab 을 이 컴퓨터 안에서만(127.0.0.1) 열고, 복사한 노트북을 띄웁니다
.venv/bin/jupyter lab --ip=127.0.0.1 ~/Documents/taster.ipynb
```

- 잘 되면 브라우저에 노트북이 열립니다. `command not found`가 나오면 저장소 맨 위 폴더에서 실행했는지 확인합니다.
- 끄는 법: 터미널에서 Ctrl+C 를 두 번 누릅니다.
- 내 컴퓨터에 `wget`(파일 내려받기 명령)이 없으면 T-S03 셀에서 `FileNotFoundError`가 납니다. 그때는 바로 아래 "Colab이 아닌 곳에서는 이 셀을 대신 실행" 셀을 실행하면 됩니다(파이썬만으로 같은 파일을 받습니다). 두 셀을 모두 실행해도 같은 파일을 한 번 더 받을 뿐이라 괜찮습니다(wget이 있으면 `names.txt.1`이라는 사본이 하나 더 생길 수 있지만 쓰지 않는 파일입니다).
- 노트북을 연 폴더에 `names.txt`가 생깁니다. 다 쓰면 지워도 됩니다.

## 데이터 출처와 라이선스

| 데이터 | 출처 | 라이선스 | 저장소에 넣었나 |
|---|---|---|---|
| `names.txt` (영어 이름 32,033개) | [karpathy/makemore](https://github.com/karpathy/makemore), 받는 주소 `https://raw.githubusercontent.com/karpathy/makemore/master/names.txt` | MIT, Copyright (c) 2022 Andrej Karpathy. 전문: `third_party/licenses/makemore-LICENSE.txt` | 넣지 않음. T-S03 셀이 실행할 때 내려받습니다 |

## 맥 실행 기록 (실측)

2026-11-16, Mac mini(Apple M4), macOS 27.2.1, 저장소 `.venv`(Python 3.12.13, torch 2.15.0, nbconvert 7.17.2, ipykernel 7.4.0). 자세한 값은 `mac_run.json`.

| 무엇 | 결과 |
|---|---|
| 배포본 그대로 nbconvert 실행(names.txt 를 미리 받아 둔 임시 폴더, wget 있음) 3회 | 오류 0. 전체 4.96초 · 4.97초 · 4.89초(커널 켜는 시간 포함). 셀 실행만 3.42초 · 3.41초 · 3.32초. 가장 긴 셀은 T-S06 학습(2.11초) |
| 단계별 출력 대 정본 출력 예(T-S02~T-S07, T-S03 대체 셀) | 모두 글자 하나까지 같음(허용 오차를 쓴 단계 없음). 교사 `taster_outputs.json`과도 모두 같음 |
| T-S06 손실 | 처음 3.839, 끝 2.472(기준: 처음 3.7~4.0, 끝 2.6 이하) |
| wget 없는 로컬 흉내(PATH 에서 wget 을 빼고 미리 받은 파일 없이 실행) | T-S03 정본 셀만 `FileNotFoundError`, 대체 셀이 파일을 받은 뒤 나머지 출력은 모두 정본과 같음. 4.89초 · 4.92초 · 4.97초 |

## 노트북 다시 만들기

교사 정본 `inputs/pedagogy/content/taster.json`이 바뀌면 다시 만듭니다.

```bash
# 노트북을 정본에서 다시 만듭니다(덮어씀)
.venv/bin/python notebooks/taster/build_notebook.py
# 지금 파일이 최신인지만 확인합니다(다르면 종료 코드 1)
.venv/bin/python notebooks/taster/build_notebook.py --check
```

정본 모양이 맞지 않으면(코드 줄 수와 줄별 풀이 개수가 다른 등) "만들지 못했습니다: …"를 출력하고 종료 코드 2로 끝납니다. 이때는 정본을 고치지 말고 알립니다.

## 검사

```bash
# 노트북 검사: 생성본 최신, 정본 순서·코드, 출력 없음, 긴 줄표 0, 실제 실행(배포본 그대로, wget 없는 로컬), 단계별 출력, 손실 범위
.venv/bin/python -m pytest tests/test_notebooks_taster.py -q -s
# 맥 실행 기록(mac_run.json)을 이번 실행 값으로 다시 씁니다
Z2H_TASTER_RECORD=1 .venv/bin/python -m pytest tests/test_notebooks_taster.py -q -s
```

- `-s`를 붙이면 손실, 실행 시간, 단계별 일치 결과가 화면에 보입니다.
- 실행 검사는 names.txt 를 인터넷에서 받아야 합니다. 받지 못하면(네트워크 없음) 실행 검사만 건너뛰고(skip) 그 이유를 보여 줍니다. 받은 파일은 pytest 임시 폴더에만 두고 끝나면 지웁니다.
