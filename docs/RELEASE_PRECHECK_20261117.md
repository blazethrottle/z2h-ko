# 공개 전환 사전 점검 기록 (2026-11-17 KST, PM)

`docs/PUBLIC_RELEASE_CHECKLIST.md`의 자동으로 볼 수 있는 항목만 미리 본 기록이다. **공개 전환은 하지 않았고, 이 기록은 승인이 아니다.** 공개 직전에 전 항목을 다시 본다.

| 체크리스트 항목 | 결과 | 근거 |
|---|---|---|
| 1. gitleaks 전체 이력 | 유출 0건 | `gitleaks git --log-opts="--all" .` → no leaks found |
| 1. gitleaks 작업 폴더 | 저장소 파일 0건 | `gitleaks dir .`가 3건을 냈으나 모두 git에 올라가지 않는 `.venv` 안 Jupyter 묶음 파일(외부 패키지). 저장소에 올라간 파일에서는 0건 |
| 1. .env·토큰·개인 경로·이메일 | **결정 필요** | (1) 모든 커밋의 작성자 칸에 개인 이메일 주소가 들어 있다(`git log --format=%ae`). 공개 전환하면 그대로 보인다. 그대로 둘지, 이력을 정리할지(이력 재작성은 강제 푸시라 얼큰이 승인 항목) 결정 필요. (2) GitHub 계정 이름이 `docs/DESIGN.md`, `docs/PUBLIC_RELEASE_CHECKLIST.md`에 있다(저장소 주소라 공개되면 어차피 보임). (3) 맥의 작업 폴더 경로가 `docs/MEASURE_M0.md`에 있다: 공개본에 남길지 결정 필요. (4) 테스트 파일의 이메일은 예시 주소(`example.com` 등)뿐. `.env`·토큰 파일 0건 |
| 2. MIT 5개 LICENSE 전문 | 있음 | `third_party/licenses/` 5개, GitHub 원문과 같은지 `tests/test_notice_licenses.py`가 검사 |
| 2. NOTICE.md | 있음 | 원본·저작권자·쓴 위치 표, 글꼴 받은 곳 |
| 2. 원본 코드 파일 머리 출처 | 있음 | `tests/reference_impl/micrograd_ref.py`, `z2h_check/graders/l01.py`, `z2h_check/_bundle.py`, 노트북 첫 셀 |
| 2. build-nanogpt 코드 복사 0건 | 코드 복사 0건 | 이름이 나오는 곳은 규칙 문서, 금지 검사 코드와 그 테스트, `NOTICE.md`(링크만 한다는 안내), `docs/MEASURE_M0.md`와 `inputs/`의 10편 자료(링크·이슈 언급)다. 코드 구간은 없음. 10편 콘텐츠는 아직 없음 |
| 3. 영상 파일·자막 전문 | 0건 | 영상·자막 확장자 파일 0건. 앱은 youtube-nocookie embed와 링크만 |
| 3. 데이터 출처·라이선스 | names.txt는 저장소에 없음 | 맛보기 실행 때 내려받음. 출처는 NOTICE.md와 노트북 첫 셀 |
| 3-1. 글꼴 OFL 사본 | 있음 | `third_party/licenses/Pretendard-OFL.txt`, `JetBrainsMono-OFL.txt` |
| 3-1. inputs/ 자료 | 미확인 | 내부 경로·개인 정보를 사람이 읽어 확인해야 함. 공개본에 남길지도 결정 필요 |
| 4. 우리 코드 라이선스 | 미정 | 얼큰이 결정 항목 |
| 4. 커밋 꼬리표 | Co-Authored-By 0건 | `git log --all`. "claude"가 나오는 커밋 3건은 파일 이름(`CLAUDE.md`, `.claude/agents`) 언급이며 꼬리표·링크가 아님 |
| 4. main 보호 규칙·이슈·액션 설정 | 미확인 | GitHub 설정 화면에서 사람이 확인 |
| 4. 얼큰이 공개 전환 승인 | 없음 | 받지 않았고 요청하지도 않음 |

공개 전에 따로 필요한 것(체크리스트 밖, P1~P3에서 나온 것)
- 랜딩·약관·개인정보 문구 승인(D46). 약관 본문은 아직 없음.
- 실제 로그인(이메일·Google) 구현과 개발용 로그인 끄기.
- Colab 바로 열기용 공개 노트북 주소.
- 정답 파일을 앱이 미리 받는 구조에 대한 결정(PR #3 질문 3).
