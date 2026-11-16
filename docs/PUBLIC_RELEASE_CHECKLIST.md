# 공개 전환 체크리스트 (blazethrottle/z2h-ko)

얼큰이 결정(2026-11-16 19:43~44 KST, CEO 전달): 비공개로 시작, 완성 후 공개. 아래 전 항목 통과 후 얼큰이 승인을 받아야 공개 전환. 공개 전환 버튼은 승인 전 누르지 않음.

## 1. 비밀값 검사 (gitleaks)
- [ ] 전체 이력 검사: `gitleaks git --log-opts="--all" .` (구버전은 `gitleaks detect --log-opts="--all"`) 결과 0건
- [ ] 작업 폴더 검사: `gitleaks dir .` 결과 0건
- [ ] 발견 시: 공개 중단, 해당 비밀값 폐기·교체가 먼저(이력 재작성은 강제 푸시라 얼큰이 승인 필요)
- [ ] .env, 토큰, 개인 경로·이메일 노출 여부 눈으로 1회 확인

## 2. Karpathy 원본 출처 표기 (MIT 5개)
- [ ] `third_party/licenses/` 에 각 LICENSE 전문 원문 그대로 보관
- [ ] 루트 `NOTICE.md` 에 저장소·저작권자·라이선스·우리가 쓴 위치 표

| 원본 | 라이선스 | 저작권 문구(원문) |
|---|---|---|
| karpathy/micrograd | MIT | Copyright (c) 2020 Andrej Karpathy |
| karpathy/makemore | MIT | Copyright (c) 2022 Andrej Karpathy |
| karpathy/nn-zero-to-hero | MIT | Copyright (c) 2022 Andrej Karpathy |
| karpathy/nanoGPT | MIT | Copyright (c) 2022 Andrej Karpathy |
| karpathy/minbpe | MIT | Copyright (c) 2024 Andrej |
(2026-11-16 각 저장소 LICENSE 원문에서 확인. 공개 직전 재확인)

- [ ] 원본에서 가져온 코드 파일 머리에 출처 한 줄
- [ ] build-nanogpt: 라이선스 표기 없음 → 코드 복사 0건 확인(링크만). `rg` 로 고유 구간 대조

## 3. 영상·데이터
- [ ] 영상은 youtube-nocookie 공식 embed와 링크만, 영상 파일·자막 전문 0건
- [ ] data/ 의 데이터마다 출처·라이선스 표기 (names.txt: makemore MIT, tiny shakespeare: 출처 표기)

## 3-1. 글꼴·입력 자료
- [ ] Pretendard, JetBrains Mono 글꼴 파일은 SIL OFL 1.1 라이선스 사본을 함께 두기(공개 전 각 배포처에서 재확인)
- [ ] inputs/ 폴더의 팀 자료에 내부 경로·개인 정보·비밀값 없는지 확인, 공개본에 남길지 결정

## 4. 저장소 상태
- [ ] 우리 코드의 라이선스 결정(얼큰이): 예) MIT 또는 비공개 유지
- [ ] 커밋·PR에 Co-Authored-By·Claude 꼬리표·링크 0건 (`git log --all --format=%B | rg -i "co-authored-by|claude"`)
- [ ] main 보호 규칙, 이슈·액션 설정 확인
- [ ] 얼큰이 공개 전환 승인 (날짜·원문 기록)
