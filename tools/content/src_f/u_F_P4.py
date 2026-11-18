from _lib import h1, h2, h3, h4

UNIT = {
    "unit_id": "F-P4",
    "kind": "python",
    "title_ko": "함수와 if, while",
    "goal_ko": "def로 함수를 만들고 return으로 결과를 돌려주고, if로 갈림길을, while과 break로 '될 때까지 반복'을 쓴다.",
    "analogy_ko": "함수는 자판기입니다. 넣는 것(인자)이 있고 나오는 것(return)이 있습니다. 자판기를 설치(def)하는 것과 버튼을 누르는 것(호출)은 다른 일입니다.",
    "card_ko": [
        "함수는 계산 묶음에 이름을 붙인 것입니다. def 이름(인자): 로 만들고, 아래 줄을 들여 써서 몸통을 적습니다.",
        "인자는 함수에 넣는 값이고, return은 함수가 돌려주는 결과입니다. return을 만나면 함수는 그 자리에서 끝납니다.",
        "return이 없는 함수는 None(아무것도 없음)을 돌려줍니다. 화면에 보여 주는 print와 돌려주는 return은 다릅니다.",
        "함수를 만드는 것(def)과 쓰는 것(호출, 예: area(3, 4))은 다릅니다. 만들기만 하면 아무 일도 일어나지 않습니다.",
        "if 조건: 아래 줄은 조건이 맞을 때만 실행됩니다. 비교는 > < >= <= == != 를 씁니다(!= 는 '다르다').",
        "while 조건: 은 조건이 맞는 동안 계속 반복합니다. while True: 는 끝없이 돌다가 break를 만나면 멈춥니다.",
        "들여쓰기가 어디까지가 몸통인지를 정합니다. 함수, if, for, while 모두 같습니다.",
    ],
    "needed_by": ["L01", "L02", "L09"],
    "steps": [
        {
            "title_ko": "넓이 함수 만들고 쓰기",
            "input_ko": "새 노트북의 첫 셀에 세 줄을 칩니다. 둘째 줄만 들여 씁니다.",
            "code": r'''
def area(w, h):
    return w * h
print(area(3, 4))
''',
            "notes": [
                "area라는 함수를 만듭니다. w(가로)와 h(세로) 두 값을 받습니다. 줄 끝에 콜론을 칩니다.",
                "들여 쓴 몸통입니다. w * h를 계산해 돌려줍니다.",
                "들여쓰기 없이, 함수에 3과 4를 넣어 쓰고 돌려받은 값을 보여 줍니다.",
            ],
            "expected_ko": "12가 나옵니다.",
            "expected_output": "12",
            "meaning_ko": "한 번 만든 함수는 이름만 불러 몇 번이고 쓸 수 있습니다. 강의의 계산들도 대부분 이렇게 이름 붙은 묶음으로 만들어져 있습니다.",
            "hints": [
                h1("아무것도 안 나오나요? 셋째 줄 print(area(3, 4))가 들여 써져서 함수 몸통 안에 들어가 있지 않은지 보세요."),
                h2("들여 쓴 줄만 함수 몸통이고, 몸통은 함수를 부를 때만 실행됩니다. 함수를 부르는 줄은 들여 쓰지 않습니다(설명 카드 4, 7번째 문장).", unit="F-P4", card=4),
            ],
        },
        {
            "title_ko": "if로 갈림길 만들기",
            "input_ko": "새 셀에 여섯 줄을 칩니다. 셋째 줄은 if 안이라 한 번 더 들여 씁니다(콜론 뒤 Enter를 치면 Colab과 Jupyter가 알아서 들여 써 줍니다). 넷째 줄은 Backspace로 한 칸 덜 들여 써서 if와 같은 높이로 맞춥니다.",
            "code": r'''
def grade(score):
    if score >= 80:
        return "통과"
    return "다시"
print(grade(85))
print(grade(70))
''',
            "notes": [
                "점수 하나를 받는 grade 함수를 만듭니다.",
                "점수가 80 이상(>=)인지 묻습니다.",
                "맞으면 '통과'를 돌려주고 함수가 바로 끝납니다.",
                "if에 걸리지 않았을 때만 이 줄까지 옵니다. '다시'를 돌려줍니다.",
                "85점을 넣어 봅니다.",
                "70점을 넣어 봅니다.",
            ],
            "expected_ko": "통과, 다시 가 한 줄씩 나옵니다.",
            "expected_output": "통과\n다시",
            "meaning_ko": "if로 값에 따라 다른 길을 갑니다. return이 함수를 바로 끝내기 때문에 else 없이도 두 갈래가 됩니다.",
            "hints": [
                h1("70점에서 다시 대신 None이 나오나요? return \"다시\" 줄이 if 안(return \"통과\"와 같은 높이)에 들어가 있지 않은지 보세요. 이 줄은 if 줄과 같은 높이여야 합니다."),
                h2("return을 만나면 함수가 끝납니다(설명 카드 2번째 문장). 그래서 80 이상이면 '통과'에서 끝나고, 아니면 아래 return까지 내려옵니다.", unit="F-P4", card=2),
            ],
        },
        {
            "title_ko": "while과 break로 될 때까지 반복하기",
            "input_ko": "새 셀에 여섯 줄을 칩니다. 셀이 끝나지 않고 계속 돌면 셀 왼쪽 정지 단추를 눌러 멈추고 들여쓰기를 확인하세요.",
            "code": r'''
n = 0
while True:
    n += 1
    if n == 3:
        break
print(n)
''',
            "notes": [
                "n에 0을 넣고 시작합니다.",
                "조건이 늘 맞음(True)이라 끝없이 반복합니다. 멈추는 방법은 break뿐입니다.",
                "한 바퀴 돌 때마다 n에 1을 더합니다.",
                "n이 3이 되었는지 묻습니다(== 는 같은지 묻기).",
                "맞으면 반복을 깨고(break) 빠져나옵니다.",
                "반복이 끝난 뒤 n을 보여 줍니다. 들여쓰기가 없습니다.",
            ],
            "expected_ko": "3이 나옵니다.",
            "expected_output": "3",
            "meaning_ko": "while True와 break는 '멈출 조건이 올 때까지 반복'입니다. 2편에서 이름을 한 글자씩 뽑다가 끝 표시가 나오면 멈추는 코드가 이 꼴입니다.",
            "hints": [
                h1("셀이 끝나지 않고 계속 도나요(왼쪽 단추가 계속 돎)? n += 1 줄이 while 안에 들여 써져 있는지 보세요."),
                h2("n += 1 이 반복 몸통 밖에 있으면 n이 영영 3이 되지 않아 끝나지 않습니다. 정지 단추로 멈춘 뒤 들여쓰기를 고치세요(설명 카드 6, 7번째 문장).", unit="F-P4", card=6),
            ],
        },
    ],
    "questions": [
        {
            "type": "predict",
            "prompt_ko": "아래 코드를 실행하면 무엇이 나올까요? 숫자만 쓰세요.",
            "code": r'''
def g(x):
    return 2 * x + 1
print(g(g(1)))
''',
            "auto_grade": {"type": "exact", "value": "7"},
            "answer_ko": "7입니다. 안쪽부터 계산합니다. g(1) = 2 x 1 + 1 = 3, 그다음 g(3) = 2 x 3 + 1 = 7입니다.",
            "rubric": [{"point": 1, "criterion_ko": "7"}],
            "hints": [
                h1("괄호 안쪽 g(1)부터 계산하면 얼마인가요?"),
                h2("함수가 돌려준 값(return)은 다시 다른 함수에 넣을 수 있습니다(설명 카드 2번째 문장).", unit="F-P4", card=2),
                h3("두 번에 나눠 계산했습니다. 주석의 빈칸을 채운 뒤 실행하세요.", code=r'''
def g(x):
    return 2 * x + 1
inside = g(1)      # inside는 ___
print(g(inside))   # g(3)은 ___
''', blanks=["3", "7"], out="7"),
                h4("정답은 7입니다. g(1)은 3이고, g(3)은 7입니다."),
            ],
        },
        {
            "type": "choice",
            "prompt_ko": "아래 코드의 마지막 줄 print(r)이 보여 주는 것은 무엇일까요?",
            "code": r'''
def hello():
    print("안녕")
r = hello()
print(r)
''',
            "choices": ["안녕", "None", "0", "에러가 난다"],
            "answer_index": 1,
            "answer_ko": "None입니다. hello는 '안녕'을 화면에 보여 주기만 하고 아무것도 돌려주지 않습니다(return 없음). 돌려준 것이 없으면 파이썬은 None(없음)을 줍니다. 그래서 화면에는 안녕, None 두 줄이 나오고, 마지막 줄은 None입니다.",
            "rubric": [{"point": 1, "criterion_ko": "None을 고름"}],
            "verify_code": r'''
def hello():
    print("안녕")
r = hello()
print(r)
''',
            "verify_output": "안녕\nNone",
            "hints": [
                h1("hello 안에 return 줄이 있나요? 없다면 r에는 무엇이 들어갈까요?"),
                h2("설명 카드 3번째 문장: return이 없는 함수는 None을 돌려주고, print와 return은 다릅니다.", unit="F-P4", card=3),
                h3("return을 넣으면 무엇이 바뀌는지 보세요. 빈칸에 \"반가워요\"(따옴표 포함)를 넣고 실행합니다.", code=r'''
def hello():
    print("안녕")
    return ___
r = hello()
print(r)
''', blanks=["\"반가워요\""], out="안녕\n반가워요"),
                h4("정답은 None입니다. print는 보여 주기만 하고, 돌려주는 값은 return이 있어야 생깁니다."),
            ],
        },
        {
            "type": "apply",
            "prompt_ko": "두 수 중 큰 수를 돌려주는 함수 bigger(a, b)를 직접 쓰고, print(bigger(3, 8))을 실행해 나온 값을 쓰세요.",
            "code": None,
            "auto_grade": {"type": "exact", "value": "8"},
            "answer_ko": "if로 a와 b를 비교해 a가 크면 a를, 아니면 b를 돌려줍니다. 결과는 8입니다.",
            "rubric": [
                {"point": 0.5, "criterion_ko": "if로 a와 b를 비교함"},
                {"point": 0.3, "criterion_ko": "return으로 돌려줌(print가 아님)"},
                {"point": 0.2, "criterion_ko": "결과 8"},
            ],
            "answer_code": r'''
def bigger(a, b):
    if a > b:
        return a
    return b
print(bigger(3, 8))
''',
            "answer_notes": [
                "두 수 a, b를 받는 함수를 만듭니다.",
                "a가 b보다 큰지 묻습니다.",
                "크면 a를 돌려주고 끝납니다.",
                "아니면 b를 돌려줍니다.",
                "3과 8을 넣어 결과를 보여 줍니다.",
            ],
            "answer_output": "8",
            "hints": [
                h1("a가 더 크면 무엇을 돌려줘야 하나요? 아니면요?"),
                h2("F-P4-S2의 grade 함수와 같은 꼴입니다. if 아래 return, 그 밑에 다른 return.", step="F-P4-S2"),
                h3("빈칸을 채우세요.", code=r'''
def bigger(a, b):
    if a ___ b:
        return ___
    return ___
print(bigger(3, 8))
''', blanks=[">", "a", "b"], out="8"),
                h4("if a > b: return a, 그 아래 return b. bigger(3, 8)은 8입니다."),
            ],
        },
    ],
    "rebuild": {
        "title_ko": "100을 처음 넘는 2의 거듭제곱 찾기",
        "prompt_ko": "빈 셀에서 만드세요. 숫자 limit을 받아, 1에서 시작해 2를 계속 곱하다가 limit을 처음 넘는 수를 돌려주는 함수 first_over(limit)를 while로 만들고, print(first_over(100))을 실행하세요.",
        "solution_code": r'''
def first_over(limit):
    n = 1
    while n <= limit:
        n = n * 2
    return n
print(first_over(100))
''',
        "solution_notes": [
            "limit을 받는 함수를 만듭니다.",
            "1에서 시작합니다.",
            "n이 limit 이하인 동안 반복합니다. 넘으면 반복이 끝납니다.",
            "n에 2를 곱해 다시 넣습니다.",
            "반복이 끝난 뒤(이제 n이 limit보다 큼) n을 돌려줍니다. while과 같은 높이로 들여 씁니다.",
            "100을 넣어 결과를 보여 줍니다.",
        ],
        "expected_output": "128",
        "self_check_ko": [
            "함수를 만드는 줄(def)과 부르는 줄(print(first_over(100)))을 구분했다",
            "while 조건이 언젠가 거짓이 되어 반복이 끝난다",
            "first_over(1000)이면 1024가 나온다",
        ],
        "hints": [
            h1("반복을 언제 멈춰야 하나요? n이 어떤 상태일 때까지 2를 곱하나요?"),
            h2("while 조건: 은 조건이 맞는 동안 반복합니다(설명 카드 6번째 문장). 'n이 limit 이하인 동안'을 조건으로 쓰면 됩니다.", unit="F-P4", card=6),
            h3("빈칸을 채우세요.", code=r'''
def first_over(limit):
    n = 1
    while n ___ limit:
        n = n * 2
    return ___
print(first_over(100))
''', blanks=["<=", "n"], out="128"),
            h4("while n <= limit: 안에서 n = n * 2 를 하고, 반복이 끝나면 return n. 1, 2, 4, ..., 64, 128에서 멈춥니다."),
        ],
    },
}
