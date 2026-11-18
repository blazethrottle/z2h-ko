#!/usr/bin/env node
// 정본 문구 정리 (2026-11-18): 실행 장소 Colab 고정(교사 지시 + 결정), 전체 시간 표시 안 함(결정). 정본 F.json·L01.json·taster.json 을 손으로 고치지 않고 이 표로만 고친다.
// 규칙: 교사가 대체 문구를 준 곳(after)은 그 글자 그대로, 나머지는 remove 의 구절을 빼기만 한다(새 문장·새 설명을 넣지 않음).
//   빼면 문장이 깨지거나 기록이 거짓이 되는 곳, 코드와 그 출력, 앱이 그리지 않는 칸은 고치지 않고 KEPT 에 이유와 함께 남긴다.
// 표의 한 줄 = 칸 하나. 칸의 지금 값이 before 면 바꾸고, 이미 바뀐 값이면 건너뛴다(두 번 돌려도 같다). 다른 값이면 멈춘다.
// 빼는 구절은 그 칸 안에 정확히 한 번 있어야 하고, 칸의 JSON 글자는 파일에서 정확히 한 번 찾아 바꾼다(파일의 줄 모양을 지킨다).
// 파일마다 _meta 에 변경 내역 한 줄(CHANGELOG_KEY). 실행: node scripts/canon-colab-time.mjs  검사: tests/unit/canonCopy.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 실행 장소 낱말(Colab 밖 실행 장소) */
export const RUN_PLACE_WORDS = /맥미니|Jupyter|MPS|mps|내 맥|고른 길/;
/** 여러 단위·단계를 합친 전체 시간("약 13시간", "2시간쯤", "1시간 반"). "영상 1시간 9분 2초"처럼 분이 이어지는 영상 시각은 아니다 */
export const TOTAL_TIME_WORDS = /\d+\s*시간(?!\s*\d+\s*분)/;
export const CHANGELOG_KEY = 'changes_2026_11_18';

const TABLE = 'app/scripts/canon-colab-time.mjs';

/**
 * 파일별 표. line: c8e0ec6 판 줄 번호(찾아보기용). why: colab(실행 장소 Colab 고정) | time(전체 시간) | 둘 다.
 * teacher: 교사가 준 대체 문구(after 그대로).
 */
export const CANON_EDITS = [
  {
    file: 'inputs/pedagogy/content/F.json',
    changelog: `2026-11-18 교사 지시로 Colab 고정 문구 정리, 전체 시간 표시 안 함(결정): F-P1 제목 "노트북 다루기(Colab)"와 F-P1-S1 input_ko 는 교사 문구, 그 밖의 칸은 맥미니·Jupyter·MPS·전체 시간 구절만 뺌(${TABLE} 표). 판 이름은 그대로.`,
    edits: [
      { id: 'F-meta-restart-first-why', line: 103, why: 'colab', path: ['_meta', 'added_fields', 9, 'why'], before: '이 단계 전에 다시 시작(Colab 런타임, Jupyter Kernel)으로 기억을 비움(cc-tools 칸). F-P1-S3b', remove: [', Jupyter Kernel'] },
      {
        id: 'F-meta-convention-run-place',
        line: 186,
        why: 'colab',
        path: ['_meta', 'conventions_ko', 0],
        before: "두 실행 길(맥미니 Jupyter, Colab)을 같이 지원한다. 메뉴 이름은 둘 다 적고, 설치 안내는 넣지 않는다(맥미니 환경 준비는 CTO 쪽, 설계서 F-P1 '길 고르기').",
        remove: ['두 ', '맥미니 Jupyter, ', '같이 ', '메뉴 이름은 둘 다 적고, ', '맥미니 환경 준비는 CTO 쪽, '],
      },
      {
        id: 'F-P1-objective',
        line: 267,
        why: 'colab',
        path: ['lecture', 'objectives', 0, 'text_ko'],
        before: '노트북(코드 칸과 결과가 한 화면에 쌓이는 문서)을 맥미니 로컬 Jupyter나 Colab에서 열고, 셀에 코드를 쳐서 실행하고, 셀 왼쪽 번호로 실행 순서를 읽고, 꼬이면 다시 시작해 위에서부터 다시 돌릴 수 있다.',
        remove: ['맥미니 로컬 Jupyter나 '],
      },
      {
        id: 'F-intro-total-time',
        line: 345,
        why: 'time',
        path: ['lecture', 'intro_ko', 0],
        before: '사전 기초는 강의를 따라가는 데 필요한 파이썬과 수학을 15개의 작은 단위로 나눈 것입니다. 단위 하나는 40~60분쯤 걸립니다(추정, 실측 아님). 15단위를 모두 하면 약 13시간입니다.',
        remove: [' 15단위를 모두 하면 약 13시간입니다.'],
      },
      {
        id: 'F-intro-run-place',
        line: 347,
        why: 'colab',
        path: ['lecture', 'intro_ko', 2],
        before: '단위마다 설명 카드를 읽고, 실습을 맥미니 Jupyter나 Colab(구글이 주는 무료 파이썬 실행 화면) 중 내가 고른 길에서 직접 쳐서 돌리고, 확인 문제 3개를 풉니다. 마지막 익힘 과제는 빈 셀에서 혼자 다시 만들어 보는 연습입니다.',
        remove: ['맥미니 Jupyter나 ', ' 중 내가 고른 길'],
      },
      {
        id: 'F-intro-first-units',
        line: 350,
        why: 'colab+time',
        path: ['lecture', 'intro_ko', 5],
        before: '처음이라면 F-P1(노트북 다루기, 내가 고른 길로)과 F-P8(에러 읽기)부터 보세요. 실습과 문제만 하면 1시간 반쯤, 익힘 과제까지 하면 2시간쯤입니다(추정).',
        remove: [', 내가 고른 길로', ' 실습과 문제만 하면 1시간 반쯤, 익힘 과제까지 하면 2시간쯤입니다(추정).'],
      },
      { id: 'F-P1-title', line: 356, why: 'colab', teacher: true, path: ['lecture', 'units', 0, 'title_ko'], before: '노트북 다루기(맥미니 Jupyter, Colab)', after: '노트북 다루기(Colab)' },
      {
        id: 'F-P1-goal',
        line: 357,
        why: 'colab',
        path: ['lecture', 'units', 0, 'goal_ko'],
        before: '노트북(코드 칸과 결과가 한 화면에 쌓이는 문서)을 맥미니 로컬 Jupyter나 Colab에서 열고, 셀에 코드를 쳐서 실행하고, 셀 왼쪽 번호로 실행 순서를 읽고, 꼬이면 다시 시작해 위에서부터 다시 돌릴 수 있다.',
        remove: ['맥미니 로컬 Jupyter나 '],
      },
      {
        id: 'F-P1-card-3-memory',
        line: 362,
        why: 'colab',
        path: ['lecture', 'units', 0, 'card_ko', 2],
        before: '실행한 셀에서 만든 값은 컴퓨터 기억에 남아서 다른 셀에서도 쓸 수 있습니다. 이 기억을 Colab은 런타임, Jupyter는 커널(Kernel)이라고 부릅니다.',
        remove: [', Jupyter는 커널(Kernel)'],
      },
      {
        id: 'F-P1-card-6-menus',
        line: 365,
        why: 'colab',
        path: ['lecture', 'units', 0, 'card_ko', 5],
        before:
          "꼬였다 싶으면 '다시 시작'으로 기억을 비우고 '모두 실행'으로 위에서부터 다시 돌립니다. Colab은 런타임 > 런타임 다시 시작(화면에 따라 '세션 다시 시작')과 런타임 > 모두 실행, Jupyter는 Kernel > Restart Kernel(Kernel 다시 시작)과 Run > Run All Cells(모두 실행)입니다.",
        remove: [', Jupyter는 Kernel > Restart Kernel(Kernel 다시 시작)과 Run > Run All Cells(모두 실행)'],
      },
      {
        id: 'F-P1-card-8-mps',
        line: 367,
        why: 'colab',
        path: ['lecture', 'units', 0, 'card_ko', 7],
        before: '맥미니 길이라면 torch.backends.mps.is_available()가 True일 때 맥미니 GPU(MPS)를 쓸 수 있습니다. 기초 단위는 모두 GPU 없이 돕니다.',
        remove: ['맥미니 길이라면 torch.backends.mps.is_available()가 True일 때 맥미니 GPU(MPS)를 쓸 수 있습니다. '],
      },
      {
        id: 'F-P8-card-7-restart',
        line: 659,
        why: 'colab',
        path: ['lecture', 'units', 7, 'card_ko', 6],
        before: '에러를 고쳤는데도 이상하면 셀 순서를 의심합니다. 다시 시작(Colab 런타임, Jupyter Kernel) 뒤 모두 실행이 가장 확실합니다(F-P1).',
        remove: [', Jupyter Kernel'],
      },
      {
        id: 'F-recommend-always-first-when',
        line: 1000,
        why: 'colab',
        path: ['lecture', 'recommend_rules', 0, 'when_ko'],
        before: '진단 결과와 상관없이 늘 표시합니다. F-P1은 내가 고른 길(맥미니 Jupyter 또는 Colab)로 합니다.',
        remove: [' F-P1은 내가 고른 길(맥미니 Jupyter 또는 Colab)로 합니다.'],
      },
      { id: 'F-P1-S1-title', line: 1083, why: 'colab', path: ['steps', 0, 'title_ko'], before: '내가 고른 길로 노트북 열고 첫 셀 실행하기', remove: ['내가 고른 길로 '] },
      {
        id: 'F-P1-S1-input',
        line: 1094,
        why: 'colab',
        teacher: true,
        path: ['steps', 0, 'input_ko'],
        before:
          "앱의 'Colab에서 열기' 또는 '맥미니용 파일 받기' 단추로 이 단위의 노트북을 내가 고른 길에서 엽니다. 단추가 없으면 Colab은 colab.research.google.com 에서 '새 노트북', 맥미니 Jupyter는 File > New > Notebook 으로 새 노트북을 만듭니다(맥미니 Jupyter는 이미 준비돼 있다는 전제입니다). 첫 셀에 아래 한 줄을 그대로 치고 Shift+Enter를 누릅니다. 따옴표와 괄호는 영어 입력 상태로 칩니다.",
        after:
          "앱의 'Colab에서 열기' 단추로 이 단위의 노트북을 엽니다. 단추가 없으면 colab.research.google.com 에서 '새 노트북'을 만듭니다. 첫 셀에 아래 한 줄을 그대로 치고 Shift+Enter를 누릅니다. 따옴표와 괄호는 영어 입력 상태로 칩니다.",
      },
      {
        id: 'F-P1-S2b-input',
        line: 1179,
        why: 'colab',
        path: ['steps', 2, 'input_ko'],
        before:
          "셀 B 바로 위에 새 셀(셀 A)을 넣습니다. Colab은 셀 B 위쪽 가장자리에 마우스를 올리면 나오는 '+ 코드', Jupyter는 셀 B를 고른 뒤 Esc 다음 A 키입니다. 셀 A에 x = 10 을 쳐서 실행하고, 그다음 셀 B를 다시 실행합니다(셀 B는 고치지 않음).",
        remove: [', Jupyter는 셀 B를 고른 뒤 Esc 다음 A 키'],
      },
      {
        id: 'F-P1-S3b-input',
        line: 1278,
        why: 'colab',
        path: ['steps', 4, 'input_ko'],
        before:
          "먼저 다시 시작합니다(Colab: 런타임 > 런타임 다시 시작 또는 세션 다시 시작, Jupyter: Kernel > Restart Kernel). 확인 창이 나오면 '예'를 누릅니다. 그다음 셀 C 아래에 새 셀을 만들어 print(x) 한 줄을 치고 실행해 봅니다. 마지막으로 모두 실행합니다(Colab: 런타임 > 모두 실행, Jupyter: Run > Run All Cells).",
        remove: [', Jupyter: Kernel > Restart Kernel', ', Jupyter: Run > Run All Cells'],
      },
      {
        id: 'F-indent-enter-input',
        line: 1502,
        why: 'colab',
        path: ['steps', 9, 'input_ko'],
        before:
          '새 셀에 여섯 줄을 칩니다. 콜론(:)으로 끝나는 줄 다음에 Enter를 치면 Colab과 Jupyter 모두 알아서 들여 써 줍니다(빈칸 2개나 4개. 설정에 따라 다르지만, 한 셀 안에서 같은 높이끼리 똑같기만 하면 됩니다). 반복이 끝나고 다음 for를 칠 때는 Backspace로 들여쓰기를 지웁니다.',
        remove: ['Colab과 Jupyter 모두 '],
      },
      {
        id: 'F-indent-if-input',
        line: 1639,
        why: 'colab',
        path: ['steps', 12, 'input_ko'],
        before: '새 셀에 여섯 줄을 칩니다. 셋째 줄은 if 안이라 한 번 더 들여 씁니다(콜론 뒤 Enter를 치면 Colab과 Jupyter가 알아서 들여 써 줍니다). 넷째 줄은 Backspace로 한 칸 덜 들여 써서 if와 같은 높이로 맞춥니다.',
        remove: ['Colab과 Jupyter가 '],
      },
      {
        id: 'F-file-where-input',
        line: 2029,
        why: 'colab',
        path: ['steps', 20, 'input_ko'],
        before: '새 노트북의 첫 셀에 다섯 줄을 칩니다. 둘째 줄만 들여 씁니다. 파일은 Colab이면 임시 폴더(연결이 끊기면 지워짐), 맥미니 Jupyter면 노트북 파일이 있는 폴더에 생깁니다.',
        remove: [', 맥미니 Jupyter면 노트북 파일이 있는 폴더'],
      },
      {
        id: 'F-file-where-expected',
        line: 2042,
        why: 'colab',
        path: ['steps', 20, 'expected_ko'],
        before: "['emma', 'olivia', 'ava'] 와 emma-olivia-ava 가 나옵니다. Colab은 왼쪽 폴더 그림, Jupyter는 왼쪽 파일 목록에서 names.txt가 보입니다.",
        remove: [', Jupyter는 왼쪽 파일 목록'],
      },
      {
        id: 'F-torch-installed-input',
        line: 2338,
        why: 'colab',
        path: ['steps', 27, 'input_ko'],
        before: '새 셀에 세 줄을 치고 실행합니다. torch는 신경망 도구입니다. Colab에는 이미 깔려 있고, 맥미니 Jupyter는 torch가 깔린 환경이 준비돼 있다는 전제입니다(직접 설치하지 않음).',
        remove: ['있고, 맥미니 Jupyter는 torch가 깔린 환경이 준비돼 '],
      },
      {
        id: 'F-torch-import-note',
        line: 2432,
        why: 'colab',
        path: ['steps', 29, 'code_line_notes_ko', 0],
        before: '신경망 도구 torch를 불러옵니다(Colab에는 이미 깔려 있고, 맥미니 Jupyter는 준비된 환경 전제).',
        remove: ['(Colab에는 이미 깔려 있고, 맥미니 Jupyter는 준비된 환경 전제)'],
      },
      {
        id: 'F-matplotlib-installed-input',
        line: 2706,
        why: 'colab',
        path: ['steps', 34, 'input_ko'],
        before: '새 셀에 다섯 줄을 칩니다. matplotlib는 그림 그리는 도구입니다. Colab에는 이미 깔려 있고, 맥미니 Jupyter는 준비된 환경에 깔려 있다는 전제입니다.',
        remove: ['있고, 맥미니 Jupyter는 준비된 환경에 깔려 '],
      },
      {
        id: 'F-restart-question-1',
        line: 3884,
        why: 'colab',
        path: ['questions', 7, 'prompt_ko'],
        before:
          "다시 시작(Colab 런타임, Jupyter Kernel)한 직후입니다. 노트북 위쪽에는 x = 10 이 적힌 셀 A가 있고, 아래 셀 B를 실행했더니 NameError: name 'x' is not defined 가 났습니다. (1) 무엇을 먼저 해야 하는지 한 문장으로 쓰고 (2) 그렇게 한 뒤 셀 B를 다시 돌리면 나오는 값을 쓰세요.",
        remove: [', Jupyter Kernel'],
      },
      {
        id: 'F-restart-question-2',
        line: 4727,
        why: 'colab',
        path: ['questions', 28, 'prompt_ko'],
        before:
          "노트북에 아래 세 셀이 위에서부터 있습니다(첫 줄이 셀 1, 둘째 줄이 셀 2, 셋째 줄이 셀 3). 다시 시작(Colab 런타임, Jupyter Kernel)한 뒤 셀 3만 실행했더니 NameError: name 'P' is not defined 가 났습니다. 셀 3이 제대로 돌려면 어떤 셀들을 어떤 순서로 실행해야 할까요? 셀 번호를 실행 순서대로 쉼표로 쓰세요(예: 3, 2).",
        remove: [', Jupyter Kernel'],
      },
      {
        id: 'F-hint-busy-cell',
        line: 6156,
        why: 'colab',
        path: ['hints', 0, 'text_ko'],
        before: '아무것도 안 나오나요? 셀 왼쪽이 [*](Jupyter)이거나 돌아가는 단추(Colab)인 채로 멈춰 있지 않은지, 셀 아래에 빨간 글이 있는지 보세요.',
        remove: ['[*](Jupyter)이거나 '],
      },
      {
        id: 'F-hint-menu-card',
        line: 6262,
        why: 'colab',
        path: ['hints', 9, 'text_ko'],
        before: '다시 시작은 기억(만든 이름표)을 모두 지웁니다. 모두 실행은 맨 위 셀부터 차례로 돌려 줍니다. 두 길의 메뉴 이름은 설명 카드 6번째 문장에 있습니다.',
        remove: ['두 길의 '],
      },
      {
        id: 'F-hint-run-all',
        line: 8443,
        why: 'colab',
        path: ['hints', 181, 'text_ko'],
        before: '정답은 1, 2, 3 입니다. 모두 실행(Colab 런타임 > 모두 실행, Jupyter Run > Run All Cells)을 눌러도 같은 순서로 돕니다.',
        remove: [', Jupyter Run > Run All Cells'],
      },
      {
        id: 'F-hint-no-torch',
        line: 8506,
        why: 'colab',
        path: ['hints', 186, 'text_ko'],
        before: "ModuleNotFoundError: No module named 'torch' 가 나오나요? 코드가 아니라 환경 문제입니다. 맥미니 Jupyter라면 torch가 깔린 환경(커널)을 골랐는지 보세요.",
        remove: [' 맥미니 Jupyter라면 torch가 깔린 환경(커널)을 골랐는지 보세요.'],
      },
    ],
  },
  {
    file: 'inputs/pedagogy/content/L01.json',
    changelog: `2026-11-18 결정(실행 장소 Colab 고정)에 따른 문구 정리: 맥미니 Jupyter 병기 구절만 뺌(${TABLE} 표). 코드·출력·id·개수·판 이름은 그대로.`,
    edits: [
      {
        id: 'L01-S02-input',
        line: 468,
        why: 'colab',
        path: ['steps', 1, 'input_ko'],
        before:
          "영상 8분 8초부터 보다가, 함수 f를 만드는 장면에서 멈춥니다. (1) 노트북 맨 위에 미리 들어 있는 '환경 확인' 준비 코드 셀을 실행합니다(없으면 아래 준비 코드를 새 셀에 붙여 넣고 실행). Colab과 맥미니 Jupyter 어느 쪽에서든 같은 노트북을 씁니다. (2) 다음 새 셀에 아래 5줄을 칩니다. 4번째 줄 끝의 쌍점(:)을 꼭 치세요. 5번째 줄은 앞에 빈칸(들여쓰기)을 둡니다. 화면은 2칸이지만, Enter를 치면 Colab은 2칸, 맥미니 Jupyter는 4칸을 알아서 넣어 줄 수 있습니다. 어느 쪽이든 됩니다.",
        remove: ['Colab과 맥미니 Jupyter 어느 쪽에서든 같은 노트북을 씁니다. ', ' 화면은 2칸이지만, Enter를 치면 Colab은 2칸, 맥미니 Jupyter는 4칸을 알아서 넣어 줄 수 있습니다. 어느 쪽이든 됩니다.'],
      },
      {
        id: 'L01-S07-input',
        line: 700,
        why: 'colab',
        path: ['steps', 6, 'input_ko'],
        before:
          "영상 19분 9초부터 봅니다. class Value를 처음 만드는 장면 뒤에 새 셀에 5줄을 칩니다. 이 셀을 앞으로 'Value 셀'이라고 부릅니다. 뒤 단계에서 여러 번 고칩니다. 줄 앞 빈칸(들여쓰기)은 화면에서 한 깊이에 2칸씩입니다. 맥미니 Jupyter처럼 Enter가 4칸씩 넣어 주면 4칸씩 써도 됩니다. 다만 뒤 단계에서 이 셀에 줄을 넣을 때는, 넣는 줄의 빈칸을 바로 위아래 같은 깊이 줄과 똑같이 맞춰야 합니다.",
        remove: ['맥미니 Jupyter처럼 '],
      },
      {
        id: 'L01-R1-task',
        line: 3973,
        why: 'colab',
        path: ['rebuild_tasks', 0, 'task_ko'],
        before:
          'Colab이나 맥미니 Jupyter에서 빈 노트북을 하나 엽니다. 앞 단계를 보지 않고, 새 셀에 Value 설계도를 다시 만듭니다. 들어가야 하는 것: __init__(data, _children, _op, label, grad, _backward), __repr__, __add__, __mul__, tanh. 세 연산 모두 _backward를 갖고, 기울기는 +=로 쌓아야 합니다. 맨 위에 import math를 잊지 마세요. 다 만들면 확인 셀(check_code)을 붙여 넣어 실행합니다. backward()는 R2에서 만들므로 여기서는 없어도 됩니다.',
        remove: ['이나 맥미니 Jupyter'],
      },
      {
        id: 'L01-hint-graphviz',
        line: 4615,
        why: 'colab',
        path: ['hints', 50, 'text_ko'],
        before:
          '그림 도구 graphviz는 파이썬 부품과 컴퓨터 프로그램(dot) 두 가지가 다 있어야 합니다. Colab만: ModuleNotFoundError가 나면 새 셀에 `!pip install graphviz`를 실행한 뒤 준비 코드 셀을 다시 실행합니다. 맥미니 Jupyter: 저장소 가상환경에 파이썬 부품이, 맥에 graphviz 프로그램이 깔려 있어야 합니다. 없으면 직접 설치하지 말고 담당자에게 알리세요(설치는 승인 뒤, 환경 문제라 HELP로 표시). 그동안은 draw_dot(L) 대신 draw_text(L)로 같은 내용을 글자로 볼 수 있습니다. 기초 F-P8(에러 읽기)을 보세요.',
        remove: [' 맥미니 Jupyter: 저장소 가상환경에 파이썬 부품이, 맥에 graphviz 프로그램이 깔려 있어야 합니다. 없으면 직접 설치하지 말고 담당자에게 알리세요(설치는 승인 뒤, 환경 문제라 HELP로 표시).'],
      },
      {
        id: 'L01-hint-torch',
        line: 5785,
        why: 'colab',
        path: ['hints', 154, 'text_ko'],
        before:
          'Colab에는 PyTorch가 기본으로 들어 있는 것으로 알려져 있습니다(이번에 직접 확인하지는 않음). 맥미니 Jupyter는 저장소 가상환경에 깔려 있어야 합니다. 없으면 직접 설치하지 말고 담당자에게 알리세요(환경 문제라 HELP로 표시). 텐서는 기초 F-P9(텐서 첫걸음)에서 더 자세히 봅니다.',
        remove: [' 맥미니 Jupyter는 저장소 가상환경에 깔려 있어야 합니다. 없으면 직접 설치하지 말고 담당자에게 알리세요(환경 문제라 HELP로 표시).'],
      },
    ],
  },
  {
    file: 'inputs/pedagogy/content/taster.json',
    changelog: `2026-11-18 결정(실행 장소 Colab 고정)에 따른 문구 정리: 힌트의 맥미니 Jupyter 구절만 뺌(${TABLE} 표). 코드·code_alt_local·id·판 이름은 그대로.`,
    edits: [
      {
        id: 'T-hint-wget',
        line: 698,
        why: 'colab',
        path: ['hints', 11, 'text_ko'],
        before: "예상 출력: `32033 ['emma', 'olivia', 'ava', 'isabella', 'sophia']`. 맥미니 Jupyter에서는 `!wget`이 없을 수 있어 앱이 대신 쓸 코드(code_alt_local)를 보여 줍니다. 그래도 안 되면 HELP를 누릅니다.",
        remove: [' 맥미니 Jupyter에서는 `!wget`이 없을 수 있어 앱이 대신 쓸 코드(code_alt_local)를 보여 줍니다.', '그래도 '],
      },
    ],
  },
];

/**
 * 고치지 않고 남긴 곳(교사 문구 요청·기록용). path 가 가리키는 칸의 지금 글 그대로.
 * kind: sentence(빼면 문장이 깨짐) | record(기록이 거짓이 됨: _meta 제작·변경 기록) | code(코드와 그 출력)
 * 앱이 그리지 않는 칸(taster.json code_alt_local)은 실행 장소 낱말이 없어 여기 적지 않는다(그대로 둠)
 */
export const KEPT = [
  { file: 'inputs/pedagogy/content/F.json', line: 360, path: ['lecture', 'units', 0, 'card_ko', 0], kind: 'sentence', reason: '둘째 문장에서 맥미니 구절을 빼면 "구글의 Colab(…) 엽니다"로 조사가 없고, 문장째 빼면 Colab 설명(무료, 구글 로그인 필요)이 사라진다' },
  { file: 'inputs/pedagogy/content/F.json', line: 9, path: ['_meta', 'verified_on'], kind: 'record', reason: '검증한 환경 기록' },
  { file: 'inputs/pedagogy/content/F.json', line: 215, path: ['_meta', 'changes_from_1_0', 0], kind: 'record', reason: '1.0 → 1.1 변경 기록' },
  { file: 'inputs/pedagogy/content/F.json', line: 223, path: ['_meta', 'unverified', 2], kind: 'record', reason: '확인하지 않은 것의 기록' },
  { file: 'inputs/pedagogy/content/F.json', line: 224, path: ['_meta', 'unverified', 3], kind: 'record', reason: '확인하지 않은 것의 기록' },
  { file: 'inputs/pedagogy/content/L01.json', line: 36, path: ['_meta', 'run_paths'], kind: 'record', reason: '제작 때 실행 길 기록' },
  { file: 'inputs/pedagogy/content/L01.json', line: 63, path: ['_meta', 'decisions', 0], kind: 'record', reason: '결정 기록' },
  { file: 'inputs/pedagogy/content/L01.json', line: 64, path: ['_meta', 'decisions', 1], kind: 'record', reason: '결정 기록(기기 고르기 셀: cuda/mps/cpu)' },
  { file: 'inputs/pedagogy/content/L01.json', line: 86, path: ['_meta', 'unverified', 6], kind: 'record', reason: '확인하지 않은 것의 기록' },
  { file: 'inputs/pedagogy/content/L01.json', line: 88, path: ['_meta', 'unverified', 8], kind: 'record', reason: '확인하지 않은 것의 기록' },
  { file: 'inputs/pedagogy/content/L01.json', line: 469, path: ['steps', 1, 'prepared_code'], kind: 'code', reason: '준비 코드가 출력하는 글("내 컴퓨터(맥미니 Jupyter 등)")과 mps 기기 고르기. 바꾸면 노트북·출력이 달라진다' },
  { file: 'inputs/pedagogy/content/L01.json', line: 472, path: ['steps', 1, 'prepared_code_line_notes_ko', 1], kind: 'code', reason: '코드 줄 풀이: 코드가 알아보는 기기 이름(cpu, mps, cuda)' },
  { file: 'inputs/pedagogy/content/L01.json', line: 474, path: ['steps', 1, 'prepared_code_line_notes_ko', 3], kind: 'code', reason: '코드 줄 풀이: 코드에 있는 mps 를 설명("mps(맥 GPU)")' },
  { file: 'inputs/pedagogy/content/L01.json', line: 490, path: ['steps', 1, 'expected_ko'], kind: 'code', reason: '준비 코드가 찍는 출력(실행 장소, 기기 cpu·mps·cuda)을 설명' },
];

/** 칸 경로의 값 */
export function valueAt(data, p) {
  return p.reduce((v, k) => (v == null ? undefined : v[k]), data);
}

/** 표 한 줄의 바뀐 글: 교사 문구 그대로, 아니면 before 에서 remove 구절을 하나씩 뺀 것(각 구절은 before 에 정확히 한 번) */
export function afterOf(e) {
  if (e.teacher) return e.after;
  let out = e.before;
  for (const r of e.remove) {
    const n = e.before.split(r).length - 1;
    if (n !== 1) throw new Error(`${e.id}: 빼는 구절이 칸에 ${n}번 있습니다(정확히 1번이어야 함): ${r}`);
    out = out.replace(r, '');
  }
  return out;
}

const indentOf = (text) => (text.match(/\n( +)"/) ?? [, ' '])[1];

/** 정본 파일 글 하나에 그 파일의 표를 적용 → { text, applied, alreadyDone, changelog: 'added'|'present' } */
export function applyCanonEdits(text, spec) {
  let out = text;
  const applied = [];
  const alreadyDone = [];
  for (const e of spec.edits) {
    const after = afterOf(e);
    const cur = valueAt(JSON.parse(out), e.path);
    if (cur === after) {
      alreadyDone.push(e.id);
      continue;
    }
    if (cur !== e.before) throw new Error(`${e.id}(${e.line}행): 칸 ${JSON.stringify(e.path)} 의 글이 표의 전 글과 다릅니다`);
    // 같은 글이 다른 칸에도 있을 수 있어(목표 text_ko = 단위 goal_ko) 칸 이름까지 붙여 찾는다
    const last = e.path[e.path.length - 1];
    const lead = typeof last === 'string' ? `${JSON.stringify(last)}: ` : '';
    const enc = lead + JSON.stringify(e.before);
    const n = out.split(enc).length - 1;
    if (n !== 1) throw new Error(`${e.id}: 전 글이 파일에 ${n}번 있습니다(정확히 1번이어야 함)`);
    out = out.replace(enc, () => lead + JSON.stringify(after));
    if (valueAt(JSON.parse(out), e.path) !== after) throw new Error(`${e.id}: 바꾼 뒤 칸 값이 후 글이 아닙니다`);
    applied.push(e.id);
  }
  const meta = JSON.parse(out)._meta ?? {};
  let changelog = 'present';
  if (!(CHANGELOG_KEY in meta)) {
    // _meta 의 끝(다음 최상위 칸 "lecture" 앞)에 한 줄을 더한다
    const u = indentOf(out);
    const anchor = `\n${u}},\n${u}"lecture": {`;
    const n = out.split(anchor).length - 1;
    if (n !== 1) throw new Error(`${spec.file}: _meta 끝 자리를 ${n}번 찾았습니다`);
    out = out.replace(anchor, () => `,\n${u}${u}${JSON.stringify(CHANGELOG_KEY)}: [\n${u}${u}${u}${JSON.stringify(spec.changelog)}\n${u}${u}]${anchor}`);
    changelog = 'added';
  } else if (JSON.stringify(meta[CHANGELOG_KEY]) !== JSON.stringify([spec.changelog])) throw new Error(`${spec.file}: _meta.${CHANGELOG_KEY} 가 표의 한 줄과 다릅니다`);
  JSON.parse(out);
  return { text: out, applied, alreadyDone, changelog };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  for (const spec of CANON_EDITS) {
    const file = path.join(root, spec.file);
    const r = applyCanonEdits(fs.readFileSync(file, 'utf8'), spec);
    fs.writeFileSync(file, r.text);
    console.log(`${spec.file}: 바꿈 ${r.applied.length}칸, 이미 바뀜 ${r.alreadyDone.length}칸, 변경 내역 ${r.changelog === 'added' ? '추가' : '있음'}`);
  }
}
