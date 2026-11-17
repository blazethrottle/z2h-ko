# NOTICE: 원본 출처와 라이선스

이 저장소는 Andrej Karpathy의 "Neural Networks: Zero to Hero" 강의와 공개 저장소를 바탕으로 만든 한국어 학습 자료입니다.
원본 코드를 가져다 쓴 곳은 아래 표에 적고, 각 원본의 LICENSE 전문을 `third_party/licenses/`에 원문 그대로 둡니다
(2026-11-16 각 저장소의 LICENSE를 GitHub에서 받아 GitHub 파일 해시와 같은지 확인. 공개 직전 다시 확인).
원본 코드를 쓴 파일은 첫 줄에 출처 한 줄을 적습니다.

## Karpathy 원본 저장소 (MIT License)

| 원본 | 저작권 (LICENSE 원문) | 라이선스 | 전문 | 우리가 쓴 위치 (1편 기준) |
|---|---|---|---|---|
| [karpathy/micrograd](https://github.com/karpathy/micrograd) | Copyright (c) 2020 Andrej Karpathy | MIT | `third_party/licenses/micrograd-LICENSE.txt` | `tests/reference_impl/micrograd_ref.py` (정답 구현: engine.py의 Value, nn.py의 Neuron·Layer·MLP와 같은 구조), `z2h_check/graders/l01.py` (test/test_engine.py의 PyTorch 기울기 비교 방식. 식과 코드는 새로 씀), `content/ep01-micrograd/overlay_draft.yaml` (`code_origin`에 micrograd/engine.py) |
| [karpathy/nn-zero-to-hero](https://github.com/karpathy/nn-zero-to-hero) | Copyright (c) 2022 Andrej Karpathy | MIT | `third_party/licenses/nn-zero-to-hero-LICENSE.txt` | `tests/reference_impl/micrograd_ref.py` (lectures/micrograd 강의 노트북 코드), `z2h_check/reference/l01.json` (강의 예제 숫자와 학습 데이터 xs, ys), `z2h_check/graders/l01.py`, `z2h_check/_bundle.py` (z2h_check 패키지를 묶은 사본), `notebooks/ep01-micrograd/` (정답용·학생용 노트북), `notebooks/taster/taster.ipynb`와 앱 맛보기 화면(글자 짝 세기와 작은 신경망 코드가 lectures/makemore 강의 노트북의 방식을 따름. 코드 글은 교사 정본 `inputs/pedagogy/content/taster.json`) |
| [karpathy/makemore](https://github.com/karpathy/makemore) | Copyright (c) 2022 Andrej Karpathy | MIT | `third_party/licenses/makemore-LICENSE.txt` | `notebooks/taster/taster.ipynb` (맛보기: 이름 데이터 names.txt를 실행 때 내려받아 씀. 글자 짝 세기와 작은 신경망 코드는 교사 정본 `inputs/pedagogy/content/taster.json`에서 생성), `third_party/makemore/names.txt` (이름 데이터 원본 사본, 아래 표) |
| [karpathy/nanoGPT](https://github.com/karpathy/nanoGPT) | Copyright (c) 2022 Andrej Karpathy | MIT | `third_party/licenses/nanoGPT-LICENSE.txt` | 아직 쓰지 않음 |
| [karpathy/minbpe](https://github.com/karpathy/minbpe) | Copyright (c) 2024 Andrej | MIT | `third_party/licenses/minbpe-LICENSE.txt` | 아직 쓰지 않음 |

- [karpathy/build-nanogpt](https://github.com/karpathy/build-nanogpt): 라이선스 표기 없음, 코드 복사 없이 링크만 (2026-11-16 GitHub에 LICENSE 파일 없음 확인).

### 데이터 파일 사본

| 파일 | 받은 곳 | 받은 날 | 확인 | 라이선스 | 쓰는 곳 |
|---|---|---|---|---|---|
| `third_party/makemore/names.txt` | `https://raw.githubusercontent.com/karpathy/makemore/master/names.txt` (karpathy/makemore, Copyright (c) 2022 Andrej Karpathy) | 2026-11-17 (KST) | 이름 32,033줄(끝 줄바꿈 없음), 모두 a~z. SHA-256 `0a30b5557f192f32ab962680889aac5f6fda0f4cecf40a6d0b5694f58ea8cc4d` | MIT, 전문 `third_party/licenses/makemore-LICENSE.txt` | 앱 빌드가 맛보기 이름 금칙어(교사 정본 `inputs/pedagogy/content/taster_blocklist.json`)의 허용 규칙에 쓴다. 앱에는 3만 개를 싣지 않고 "실제 이름인데 금칙어에 걸리는 이름"만 뽑아 싣는다(`app/src/lib/name-filter.mjs`) |

- names.txt는 원본 그대로 둔다(줄 수를 지키려고 파일 머리에 출처 줄을 넣지 않고, 출처는 이 표에 적는다).
- 1편 노트북(`notebooks/ep01-micrograd/ep01_solution.ipynb`, `ep01_student.ipynb`)은 교사 정본(`inputs/pedagogy/content/L01.json`)에서 생성하며, 그 코드는 karpathy/micrograd와 karpathy/nn-zero-to-hero(둘 다 MIT)의 방식을 따른다. 정답용에는 전체 코드가, 학생용에는 준비 코드(`draw_dot`)가 들어 있고 노트북 첫 셀에 출처를 적었다.

## 영상

강의 영상은 youtube-nocookie 공식 embed와 유튜브 링크로만 보여 줍니다. 영상 파일과 자막 전문은 저장소에 넣지 않습니다.

## 글꼴 (SIL Open Font License 1.1)

| 글꼴 | 라이선스 | 전문 | 쓴 위치 |
|---|---|---|---|
| Pretendard | SIL OFL 1.1 | `third_party/licenses/Pretendard-OFL.txt` | `app/public/fonts/` (버전·받은 곳은 아래 표) |
| JetBrains Mono | SIL OFL 1.1 | `third_party/licenses/JetBrainsMono-OFL.txt` | `app/public/fonts/` (버전·받은 곳은 아래 표) |

## 글꼴 파일 출처 (SIL OFL 1.1, 사본은 third_party/licenses/)
| 글꼴 | 받은 곳 | 우리가 쓴 위치 |
|---|---|---|
| Pretendard 1.3.9 (woff2 4개: 400·500·600·700) | npm `pretendard@1.3.9`의 `dist/web/static/woff2` | `app/public/fonts/` |
| JetBrains Mono 가변 (woff2 1개) | github.com/JetBrains/JetBrainsMono 커밋 02bb50b0의 `fonts/webfonts/JetBrainsMono[wght].woff2` (파일 이름을 `JetBrainsMono-Variable.woff2`로 바꿈) | `app/public/fonts/` |
