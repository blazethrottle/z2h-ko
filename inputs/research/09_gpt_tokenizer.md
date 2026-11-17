# 09. GPT 토크나이저 만들기

- 영상: [Let's build the GPT Tokenizer](https://www.youtube.com/watch?v=zduSFxRajkE) (2024-02-20 업로드, 2시간 13분 34초)
- 저장소: [karpathy/minbpe](https://github.com/karpathy/minbpe) (`minbpe/base.py`, `basic.py`, `regex.py`, `gpt4.py`, `train.py`, `exercise.md`, 강의 텍스트판 `lecture.md`)
- 설명란 Colab: https://colab.research.google.com/drive/1y0KnCFZvGVf_odSfcNAws6kcDD7HsI0L?usp=sharing
- 근거: 설명란(챕터, 과제), 자동 자막(분석용), 저장소, GitHub 이슈, 유튜브 상위 댓글 300개 표본

## 1. 다루는 개념과 나오는 순서

설명란 요지: 토크나이저는 LLM과 완전히 별개인 단계로, 자체 학습 데이터와 학습 알고리즘(BPE)을 가지며 학습 후 encode(문자열을 토큰으로), decode(토큰을 문자열로) 두 기능을 합니다. OpenAI GPT 계열 토크나이저를 처음부터 만들고, LLM의 이상한 행동 상당수가 토큰화에서 온다는 것을 봅니다.

1. 토큰화가 왜 중요한가, GPT-2 논문, 토큰화 관련 문제들
2. 웹 UI(tiktokenizer)로 예시 보기
3. 파이썬 문자열과 유니코드 코드포인트
4. 바이트 인코딩: ASCII, UTF-8, UTF-16, UTF-32
5. 토큰화를 없애는 상상
6. BPE 알고리즘 설명
7. 구현: 연속 쌍 세기, 가장 흔한 쌍 찾기, 합치기, while 루프로 학습, 압축률
8. 토크나이저와 LLM은 완전히 별개 단계라는 그림
9. decode, encode 구현
10. 정규식으로 범주(글자, 숫자, 구두점, 공백) 경계에서 강제 분리
11. tiktoken 라이브러리, GPT-2와 GPT-4 정규식 차이, OpenAI GPT-2 `encoder.py` 살펴보기
12. 특수 토큰
13. minbpe 연습: 내 GPT-4 토크나이저 만들기
14. sentencepiece(Llama 2 어휘 학습에 사용)
15. 어휘 크기 정하기, 07편 gpt.py 다시 보기, 새 토큰 추가와 프롬프트 압축
16. 이미지, 영상, 오디오 토큰화(벡터 양자화)
17. LLM 토큰화의 기묘한 현상 다시 설명, 최종 권장사항

## 2. 코드를 만들어 가는 단계와 타임스탬프

출처: 영상 설명란 챕터.

| 시각 | 단계 |
|---|---|
| 0:00:00 | intro: 토큰화, GPT-2 논문, 토큰화 관련 문제 |
| 0:05:50 | 웹 UI(tiktokenizer)로 예시 보기 |
| 0:14:56 | 파이썬 문자열, 유니코드 코드포인트 |
| 0:18:15 | 유니코드 바이트 인코딩, ASCII, UTF-8, UTF-16, UTF-32 |
| 0:22:47 | 상상: 토큰화 없애기 |
| 0:23:50 | BPE 알고리즘 설명 |
| 0:27:02 | 구현 시작 |
| 0:28:35 | 연속 쌍 세기, 가장 흔한 쌍 찾기 |
| 0:30:36 | 가장 흔한 쌍 합치기 |
| 0:34:58 | 토크나이저 학습: while 루프, 압축률 |
| 0:39:20 | 토크나이저와 LLM 관계도: 완전히 별개 단계 |
| 0:42:47 | 토큰을 문자열로 decode |
| 0:48:21 | 문자열을 토큰으로 encode |
| 0:57:36 | 범주 경계 강제 분리용 정규식 |
| 1:11:38 | tiktoken 소개, GPT-2와 GPT-4 정규식 차이 |
| 1:14:59 | OpenAI가 공개한 GPT-2 encoder.py 살펴보기 |
| 1:18:26 | 특수 토큰, tiktoken의 처리, GPT-2와 GPT-4 차이 |
| 1:25:28 | minbpe 연습 시간: 내 GPT-4 토크나이저 만들기 |
| 1:28:42 | sentencepiece 소개(Llama 2 어휘 학습) |
| 1:43:27 | 어휘 크기 정하기, gpt.py 트랜스포머 다시 보기 |
| 1:48:11 | 새 토큰 학습, 프롬프트 압축 예 |
| 1:49:58 | 멀티모달(이미지, 영상, 오디오) 토큰화, 벡터 양자화 |
| 1:51:41 | LLM 토큰화의 기묘한 현상 다시 설명 |
| 2:10:20 | 최종 권장사항 |
| 2:12:50 | ??? :) |

## 3. 미리 알아야 하는 것

- 07편 GPT(글자 단위 토큰화를 썼던 부분, `vocab_size`와 임베딩 표의 관계). 1:43:27에서 gpt.py를 다시 봅니다.
- 파이썬: 딕셔너리, 튜플, while 루프, 정렬(`max(stats, key=stats.get)`), 바이트(`bytes`)와 문자열의 차이
- 정규식은 영상에서 패턴을 읽는 정도만 필요합니다.

## 4. 설명란의 연습 과제

- 설명란 원문(요지): "이 문서를 참고해서 영상에서 부분 정답을 공개하기 전에 단계를 직접 구현해 보라. 막히면 전체 정답은 minbpe 코드에 있다." 링크: [minbpe/exercise.md](https://github.com/karpathy/minbpe/blob/master/exercise.md)
- exercise.md 5단계 요지:
  - Step 1: `BasicTokenizer` 클래스(`train`, `encode`, `decode`) 작성, `tests/taylorswift.txt`로 학습해 합쳐진 토큰 보기
  - Step 2: GPT-4 정규식으로 텍스트를 나누는 `RegexTokenizer`로 바꾸기
  - Step 3: GPT-4 토크나이저(tiktoken `cl100k_base`)의 merges를 불러와 encode, decode 결과가 똑같은지 확인. 두 함정: merges 복원(`recover_merges`), 바이트 순서 섞임(byte shuffle)
  - Step 4(선택, "귀찮고 꼭 쓸모 있지는 않음"): 특수 토큰 처리
  - Step 5: sentencepiece 탐구, 원하면 Llama 2 토크나이저를 코드포인트 BPE로 맞추기

## 5. 학습자가 자주 막히는 지점

GitHub 이슈:
- 같은 토큰이 연속 반복될 때(1,1,1,1) 쌍 개수 세기가 실제 합칠 수 있는 수보다 많음: [minbpe#51](https://github.com/karpathy/minbpe/issues/51)
- 빈 문자열이나 공백만 있는 입력에서 `max() arg is an empty sequence`: [minbpe#114](https://github.com/karpathy/minbpe/issues/114)
- GPT 정규식이 힌디어처럼 결합 문자가 있는 문자를 음절 중간에서 끊음: [minbpe#73](https://github.com/karpathy/minbpe/issues/73), 영어 외 언어가 불리함: [minbpe#92](https://github.com/karpathy/minbpe/issues/92)
- encode 로직 질문: [minbpe#87](https://github.com/karpathy/minbpe/issues/87)
- 학습 속도(순수 파이썬이 느림): [minbpe#5](https://github.com/karpathy/minbpe/issues/5) (댓글 11), [minbpe#25](https://github.com/karpathy/minbpe/issues/25)
- 저장과 불러오기: [minbpe#2](https://github.com/karpathy/minbpe/issues/2)

유튜브 댓글(상위 300개 표본): 구체 오류 보고는 적었습니다. 길이가 길어 앞부분을 잊었다는 반응([댓글](https://www.youtube.com/watch?v=zduSFxRajkE&lc=UgzgOvQXduZUQ8KUEMB4AaABAg)), 영어 외 언어(암하라어) 토큰화에 도움됐다는 반응([댓글](https://www.youtube.com/watch?v=zduSFxRajkE&lc=Ugz1WmkC592CunjFZpd4AaABAg))이 있습니다.

앱 반영 제안: 한국어 학습자에게는 0:18:15 UTF-8 구간에서 "한글 한 글자는 UTF-8로 3바이트"를 직접 확인하는 실습이 좋아 보입니다. exercise.md Step 3 예문에도 "안녕하세요"가 들어 있습니다. 이 3바이트 사실은 UTF-8 표준 지식이며 영상 발화로는 확인하지 않았습니다.

## 6. 실습 환경과 데이터

- 라이브러리: minbpe `requirements.txt`는 `regex`, `tiktoken` 두 개. 테스트는 `pytest`. sentencepiece 구간은 `sentencepiece` 패키지가 추가로 필요
- 데이터: `minbpe/tests/taylorswift.txt`(저장소 포함), 원하는 텍스트 아무거나
- 파이썬, PyTorch 버전: 저장소에 명시 없음(미확인). 토크나이저 자체는 PyTorch가 필요 없습니다.
- 맥미니 M4: CPU로 충분합니다. 순수 파이썬 BPE라 어휘를 크게 잡으면 학습이 느릴 수 있습니다(이슈 #5)
- Colab 무료: 설명란 Colab 그대로 가능, tiktoken 설치 필요
