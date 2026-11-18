# tools/content: 정본 JSON을 만드는 도구

기초 정본 `inputs/pedagogy/content/F.json`(기초 15단위와 진단 5문제)과 1편 정본 `L01.json`(58단계)은 이 폴더의 **조각 원본**을 **합치기**로 묶어 만든다. 조각은 파이썬 파일이고, 합친 결과는 저장소 정본과 바이트 단위로 같다(`tests/test_content_tools.py`가 확인).

## 1. 규칙

- **정본을 손으로 고치지 않는다.** 고칠 곳이 있으면 조각(`src_f/`, `src_l01/`)을 고치고 다시 만든다.
- 다시 만든 뒤에는 정본을 읽어 만드는 파일(노트북, 기준값, 묶음)도 3절 순서대로 다시 만든다.
- 정본이 조각과 다르면 `build_canon.py --check`가 종료 코드 1로 알려 준다. 정본을 손으로 고친 경우라면 그 고침을 조각으로 옮긴다.

## 2. 쓰는 법

저장소 루트에서 `.venv/bin/python`으로 실행한다. `-I`를 붙이지 않는다(도구가 같은 폴더의 `cc_common.py` 같은 파일을 이름으로 부르는데, `-I`는 스크립트 폴더를 import 경로에서 뺀다).

| 하는 일 | 명령 | 종료 코드 |
|---|---|---|
| 정본 다시 만들기(전부) | `.venv/bin/python tools/content/build_canon.py` | 0 다 씀(내용이 같으면 파일을 건드리지 않음), 2 조각 형식 오류 |
| 확인만(파일을 쓰지 않음) | `.venv/bin/python tools/content/build_canon.py --check` | 0 같음, 1 다르거나 없음, 2 조각 형식 오류 |
| 정본 하나만 | `.venv/bin/python tools/content/build_canon.py L01` (`--check`와 함께 써도 됨) | 위와 같음. 모르는 이름은 2 |
| 다른 폴더에 만들어 보기 | `.venv/bin/python tools/content/build_canon.py --out-dir 폴더` | 정본 폴더 대신 그 폴더의 `F.json`, `L01.json`에 쓰거나(`--check`면) 비교 |
| 형식 검사(기초) | `.venv/bin/python tools/content/check_format.py inputs/pedagogy/content/F.json` | 0 통과, 1 오류(`--strict`면 경고도), 2 파일 없음, 3 도구 버그 |
| 형식 검사(1편) | `.venv/bin/python tools/content/check_format.py inputs/pedagogy/content/L01.json --foundation inputs/pedagogy/content/F.json` | 위와 같음. `--foundation`은 1편 선행 기초 단위가 기초 정본에 있는지 함께 봄 |
| 실행 대조 | `.venv/bin/python tools/content/run_code.py inputs/pedagogy/content/F.json --questions` (1편은 `L01.json`) | 0 불일치·예외 없음, 1 하나라도 있음, 2 파일 없음, 3 도구 버그 |
| 작성자 실행 확인(기초) | `.venv/bin/python tools/content/verify_f.py` | 0 모두 맞음, 1 틀린 곳 있음. 아래 `--record` 주의 |
| 작성자 실행 확인(1편) | `.venv/bin/python tools/content/verify_l01.py` | 0 모두 맞음, 1 틀린 곳 있음 |
| 도구 자체 확인 | `.venv/bin/python tools/content/selftest_tools.py` | 0 형식 검사·실행 대조가 `fixtures/` 예시에서 통과와 실패를 제대로 가름 |
| 위 전부를 테스트로 | `.venv/bin/python -m pytest tests/test_content_tools.py -q` | 정본의 코드를 돌리는 느린 검사 5개는 `content_run` 표식이며 기본 실행에 들어간다. 빼려면 `-m "not content_run"` |

- 실행 대조와 작성자 실행 확인은 정본 안의 학습 코드를 그대로 실행한다. 우리가 쓴 정본에만 쓴다. 실행은 임시 폴더에서 하고 끝나면 지운다.
- `verify_f.py --record`는 결과를 `src_f/_verify_result.json`에 적는다. 그 파일이 기초 정본의 `_meta.verification`이 되므로, 적고 나서 다시 만들면 F.json이 바뀐다(실행 시각 등). 확인 기록을 새로 남길 때만 쓴다. `--record` 없이는 아무 파일도 쓰지 않는다.
- 실행 대조와 실행 확인의 칸 읽는 법(`output_match`의 `match`, `value_range`의 `expr`, `expected_error`, `restart_first`, `edits` 해석)은 각 파일 머리말에 있다. data-spec이 정하지 않은 칸이라 형식 검사가 경고(UNKNOWN-FIELD, CHECK-TYPE)를 내지만 실패는 아니다.

## 3. 만드는 순서: 조각 → 정본 → 노트북·기준값

| 순서 | 입력 | 출력 | 다시 만들기 | 최신인지 확인 |
|---|---|---|---|---|
| 1 | `tools/content/src_f/` | `inputs/pedagogy/content/F.json` | `.venv/bin/python tools/content/build_canon.py F` | `.venv/bin/python tools/content/build_canon.py --check F` |
| 1 | `tools/content/src_l01/` | `inputs/pedagogy/content/L01.json` | `.venv/bin/python tools/content/build_canon.py L01` | `.venv/bin/python tools/content/build_canon.py --check L01` |
| 2 | `L01.json` | `z2h_check/reference/l01.json`(채점 기준값) | `.venv/bin/python -m z2h_check.refgen --write` | `.venv/bin/python -m z2h_check.refgen --check` |
| 3 | `z2h_check/` 패키지(기준값 포함) | `z2h_check/_bundle.py`(노트북 준비 셀 묶음) | `.venv/bin/python -m z2h_check.bundle --write` | `.venv/bin/python -m z2h_check.bundle --check` |
| 4 | `L01.json`, `_bundle.py` | `notebooks/ep01-micrograd/ep01_solution.ipynb`, `ep01_student.ipynb` | `.venv/bin/python notebooks/ep01-micrograd/build_notebooks.py` | `.venv/bin/python notebooks/ep01-micrograd/build_notebooks.py --check` |

- F.json은 앱이 바로 읽는다(기초는 노트북·기준값을 만들지 않는다).
- 앱은 빌드 때 `npm run check:content`(`app/scripts/validate-content.mjs`)로 두 정본을 다시 검사한다(5절).
- 맛보기 정본 `taster.json`은 이 도구가 만들지 않는다(`notebooks/taster/build_notebook.py`가 그 정본에서 노트북을 만든다).

## 4. 폴더 구조

```
tools/content/
  build_canon.py     진입점: 정본 목록(CANONS), 후처리 자리(POSTPROCESS), --check, --out-dir
  fragments.py       조각 폴더 읽기 도우미(folder_on_path, load_file)와 BuildError
  build_f.py         기초 합치기: src_f → F.json (build, serialize)
  build_l01.py       1편 합치기: src_l01 → L01.json (build, serialize)
  src_f/             기초 조각: u_F_P1~P9, u_F_M1~M6(단위 15개), diag.py(첫 화면 안내, 진단, 추천 규칙),
                     meta.py(_meta 글), _lib.py(힌트 도우미), _verify_result.json(verify_f.py --record 결과)
  src_l01/           1편 조각: part00_meta(편 정보, _meta 계산), part01~07(단계 1~58), part08_questions(문항 15),
                     part09_rebuild(재구성 3, 익힘 기준), common.py(S, Q 같은 도우미), meta_text.py(_meta 글)
  check_format.py    형식 검사(data-spec 칸 이름과 형식)
  run_code.py        실행 대조(단계 code를 노트북처럼 차례로 돌려 expected_check와 대조)
  cc_common.py       두 검사 도구가 함께 쓰는 부분(id 규칙, JSON 읽기, edits 흉내)
  selftest_tools.py  두 검사 도구의 자체 확인
  fixtures/          자체 확인용 예시(ok, bad, ok_F, bad_F. 도구 담당이 지어낸 내용)
  verify_f.py        작성자 실행 확인(기초): IPython 셀 실행으로 단계·문항·H3 빈칸·익힘 과제 출력 대조
  verify_l01.py      작성자 실행 확인(1편): 조각에 적어 둔 확인 식(verify)과 재구성 확인 셀
```

## 5. 형식 검사의 근거, 앱 빌드 검사와의 차이

- `check_format.py`는 2026-11-17의 data-spec 사본을 근거로 만들었다. 저장소의 `inputs/pedagogy/data-spec.md`는 그 뒤에 기초 id 행과 '클로드 버전 추가 칸' 절이 더해졌고, 도구는 그 절을 모른다. 그래서 그 칸들은 경고(UNKNOWN-FIELD)로 나온다(오류 아님). 지금 정본에서 오류는 둘 다 0이고, 경고는 F.json 731개(UNKNOWN-FIELD 728, HINT-BLANKS 2, CHECK-VALUE 1), L01.json 21개(정본 `_meta.verification`: data-spec 밖 재구성 칸 18, replace 줄 해석 모호 3)다.
- 앱의 `validate-content.mjs`(`npm run check:content`, 빌드 앞)는 앱이 화면을 만들 수 있는지를 본다: 스키마와 id 모양, 줄 수 = 풀이 수, 줄 수 규칙, 보기와 정답 번호, 영상 구간, 참조 대상, 긴 줄표, 원본 코드 출처, 힌트 개수, 맛보기 규칙(`app/src/lib/content/validate.mjs`·`basics.mjs`의 RULES).
- 겹치는 것: id 모양과 중복, 줄 수 = 풀이 수, 긴 단계 규칙, 보기·정답 번호, 영상 구간, 힌트 단계, 참조 대상, 긴 줄표.
- 이 도구에만 있는 것: 코드를 실제로 돌려 보는 실행 대조와 작성자 실행 확인, 한 객체 안의 같은 칸 두 번(JSON-DUPKEY. 앱 검사에서는 찾지 못함), data-spec 밖 칸 경고.
- 앱 검사에만 있는 것: 원본 코드 출처 규칙, 맛보기 검사, 앱 화면용 칸 분류(`app/src/lib/content/fields.mjs`와 그 테스트).
- 지금은 둘 다 둔다. 하나로 합칠지는 남은 일이다.

## 6. 후처리 자리 (POSTPROCESS)

`build_canon.py`의 흐름은 `build()` → `serialize()` → `POSTPROCESS`(차례로) → 비교 또는 쓰기다. `--check`와 다시 만들기가 같은 글을 쓰므로, 후처리를 넣으면 둘 다 그 결과를 정본으로 본다.

- 모양: 함수 `(정본 이름, 글) -> 글`. 해당하지 않는 정본이면 글을 그대로 돌려준다.
- 지금은 비어 있다(`POSTPROCESS = ()`).
- 들어올 것: P9의 `app/scripts/canon-colab-time.mjs`가 정본 F.json·L01.json·taster.json의 문구(맥미니·Jupyter·전체 시간)를 치환 표로 고친다. P9는 이 도구를 만든 기준(main c8e0ec6) 뒤에 main(cfc179e)으로 들어갔다. 그 main과 합치면 "조각에서 생성"만으로는 정본과 달라져 `--check`와 재현 테스트가 실패한다. 맞추는 길은 둘이다.
  - (가) 후처리 한 단계로 그 치환 표를 적용한다. 표의 `applyCanonEdits(글, 표)`는 칸의 JSON 글자를 정확히 한 번 찾아 바꾸고 이미 바뀐 칸은 건너뛰므로(두 번 돌려도 같음), 생성한 글에 그대로 적용할 수 있다. 시험(2026-11-18, 저장소 밖 임시 사본): 조각에서 만든 F.json·L01.json에 main cfc179e의 표를 적용하면 main의 정본과 바이트까지 같았다(F 30칸, L01 5칸, 두 번 적용해도 같음).
  - (나) 조각 원본 자체에 그 문구 정리를 반영한다. 그러면 후처리가 필요 없고 정본의 근원이 조각 하나로 남는다.
- 권장: (나). (가)는 (나)를 하기 전까지의 다리로만 쓴다.

## 7. 새 정본 더하기 (예: F_intro.json, courses.json)

정본 하나 = 조각 폴더 하나 + 합치기 하나.

1. 조각 폴더 `src_<이름>/`를 만든다.
2. 합치기 `build_<이름>.py`에 `build() -> dict`와 `serialize(dict) -> str`를 둔다. 형식 규칙을 어기면 `fragments.BuildError(오류 글 목록)`를 낸다. 조각끼리 서로 부르면(`from common import ...`) `build()` 안에서 `with folder_on_path(SRC):`로 읽는다. 끝나면 그 폴더의 모듈이 지워지므로 다른 조각 폴더와 파일 이름이 겹쳐도 섞이지 않는다.
3. `build_canon.py`의 `CANONS`에 `Canon("<이름>", "build_<이름>", "inputs/pedagogy/content/<이름>.json")` 한 줄을 더한다.
4. `tests/test_content_tools.py`의 `CANON_FILES`에 한 줄을 더한다(바이트 동일 검사가 따라온다).
5. 형식 검사·실행 대조가 그 정본을 아는지 본다. 지금 두 도구는 강의 편(`L01`~`L10`)과 기초(`F`, 단위 id `F-P1`~`F-P9`, `F-M1`~`F-M6`) 두 종류만 안다. 새 단위 id 꼴이나 단계가 없는 정본(코스 순서 같은 것)은 도구를 넓히거나 대상에서 뺀다.
6. 앱이 새 정본을 읽으면 앱 빌드 검사도 맞춘다.

## 8. 정본 `_meta`에 적힌 옛 이름

정본 `_meta`의 `build`, `spec`, `basis`, `verification` 칸에 적힌 `cc/...` 경로와 파일 이름은 조각을 처음 만들던 **옛 작업 폴더의 이름**이다. 정본 글이라 이번에는 고치지 않았다(고치려면 조각의 meta를 고쳐 다시 만들어야 하고 그러면 정본이 바뀐다). 지금 위치는 아래와 같다.

| 정본에 적힌 옛 이름 | 지금 위치 |
|---|---|
| `F_claude.json`, `L01_claude.json` (`_meta.file`) | `inputs/pedagogy/content/F.json`, `L01.json` |
| `cc/src_f/u_*.py`, `diag.py`, `meta.py` | `tools/content/src_f/` |
| `cc/tools/build_f.py` | `tools/content/build_f.py` (실행은 `build_canon.py`) |
| `cc/src_l01/part00~part09` | `tools/content/src_l01/` |
| `cc/tools/build_l01.py` | `tools/content/build_l01.py` (실행은 `build_canon.py`) |
| `tools/check_format.py`, `tools/run_code.py` | `tools/content/check_format.py`, `tools/content/run_code.py` |
| `cc/src_f/verify_f.py`, `src_l01/verify_l01.py` | `tools/content/verify_f.py`, `tools/content/verify_l01.py` |
| `cc/ref/data-spec.md` | `inputs/pedagogy/data-spec.md` (판이 다름, 5절) |
| `cc/out/curriculum.md` | `docs/CURRICULUM.md` (같은 내용) |
| `cc/ref/research/01_micrograd.md` | `inputs/research/01_micrograd.md` (같은 내용) |
| `cc/BRIEF.md`, `cc/BRIEF_PM_ADDENDUM.md` | 저장소에 없음(옛 작업 폴더의 작업 지시라 옮기지 않음) |

## 9. 원본 코드의 출처와 라이선스

- `src_l01/part01`~`part09`에는 karpathy/micrograd(engine.py, nn.py)와 karpathy/nn-zero-to-hero(lectures/micrograd 강의 노트북)를 따른 코드 글이 들어 있다. 둘 다 MIT License다. 각 파일 첫 줄에 출처를 적었고, LICENSE 전문은 `third_party/licenses/micrograd-LICENSE.txt`, `nn-zero-to-hero-LICENSE.txt`, 쓴 위치 표는 루트 `NOTICE.md`에 있다.
- `src_f/`(기초)는 원본 저장소 파일의 코드를 옮긴 것으로 보지 않았다(정본 `_meta.data_sources`: 모든 값은 코드 안에 적은 작은 예시). 다만 F-P3의 `zip(w, w[1:])`, F-P7의 `sorted(set("".join(words)))` 같은 몇 줄은 makemore 강의 노트북과 같은 꼴이다. 출처 표기가 필요한지는 미확인이다.
- `fixtures/`는 도구 담당이 지어낸 예시다(원본 코드 없음).
