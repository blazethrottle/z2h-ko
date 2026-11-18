from _lib import h1, h2, h3, h4

UNIT = {
    "unit_id": "F-P6",
    "kind": "python",
    "title_ko": "클래스와 특수 메서드",
    "goal_ko": "class로 설계도를 만들고, __init__과 self로 상자 안에 값을 담고, 메서드(상자가 할 줄 아는 일)를 만들고, __repr__(보여 주는 모습)과 __add__(+ 의 뜻) 같은 특수 메서드를 쓴다. sum()에 쓰려면 __radd__가 필요한 이유를 안다.",
    "analogy_ko": "클래스는 붕어빵 틀, 객체는 그 틀로 구워 낸 붕어빵입니다. self는 '지금 다루는 이 붕어빵 자신'입니다.",
    "card_ko": [
        "클래스(class)는 상자를 찍어 내는 설계도이고, 설계도로 만든 상자 하나하나를 객체라고 부릅니다.",
        "__init__은 상자를 만들 때 저절로 실행되는 준비 함수입니다. Wallet(1000)이라고 쓰면 __init__에 1000이 들어갑니다.",
        "self는 '지금 만들고 있는(다루고 있는) 그 상자 자신'입니다. self.money = money 는 이 상자 안에 money라는 칸을 만들어 값을 넣습니다.",
        "메서드는 클래스 안에 만든 함수로, 상자가 할 줄 아는 일입니다. w.spend(300)처럼 점(.)으로 부르고, 첫 인자 self는 파이썬이 알아서 채웁니다.",
        "__add__처럼 이름 앞뒤에 밑줄 두 개가 붙은 것은 특수 메서드입니다. a + b 를 쓰면 파이썬이 a.__add__(b)를 부르므로, + 의 뜻을 우리가 정할 수 있습니다. __repr__은 상자를 화면에 보여 줄 때의 모습을 정합니다.",
        "클래스 셀을 고치면 그 셀을 다시 실행하고, 상자도 다시 만들어야 합니다. 옛 상자는 옛 설계도로 만든 것이라 새 기능이 없습니다.",
        "sum([w1, w2])는 0부터 더하기 시작해 0 + w1 을 먼저 계산합니다. 왼쪽이 숫자 0이면 파이썬은 오른쪽 상자의 __radd__(오른쪽에서 더하기)를 찾습니다.",
    ],
    "needed_by": ["L01", "L04", "L06", "L07", "L10"],
    "steps": [
        {
            "title_ko": "설계도로 지갑 상자 만들기",
            "input_ko": "셀 하나(이 단위의 '클래스 셀')에 앞의 세 줄을 치고 실행합니다. 화면에 아무것도 안 나오는 것이 정상입니다(설계도만 만들었으니까요). 그 아래 새 셀에 뒤의 두 줄을 치고 실행합니다.",
            "code": r'''
class Wallet:
    def __init__(self, money):
        self.money = money
w = Wallet(1000)
print(w.money)
''',
            "notes": [
                "(클래스 셀) Wallet(지갑)이라는 설계도를 시작합니다. 줄 끝에 콜론.",
                "(클래스 셀) 상자를 만들 때 실행되는 준비 함수입니다. self(이 상자)와 money(넣어 줄 돈)를 받습니다.",
                "(클래스 셀) 이 상자의 money 칸에 받은 돈을 넣습니다.",
                "(새 셀) 설계도로 1000원이 든 지갑 상자를 만들어 w라고 부릅니다.",
                "(새 셀) w 상자의 money 칸을 꺼내 보여 줍니다.",
            ],
            "cells": [3, 2],
            "expected_ko": "클래스 셀은 아무것도 보여 주지 않고, 둘째 셀에서 1000이 나옵니다.",
            "expected_output": "1000",
            "meaning_ko": "설계도(class)로 상자를 만들고, 점(.)으로 상자 안의 칸을 꺼냈습니다. 1편의 Value 상자도 이렇게 숫자 하나를 담는 것에서 시작합니다.",
            "hints": [
                h1("TypeError: Wallet() takes no arguments 가 나오나요? __init__의 밑줄이 앞뒤로 두 개씩인지 보세요."),
                h2("__init__은 밑줄 두 개 + init + 밑줄 두 개입니다. 하나만 치면 파이썬이 준비 함수로 알아보지 못합니다(설명 카드 2번째 문장).", unit="F-P6", card=2),
            ],
        },
        {
            "title_ko": "메서드 넣고 클래스 셀 다시 실행하기",
            "input_ko": "클래스 셀로 돌아가 self.money = money 줄 바로 아래에 앞의 두 줄을 넣습니다(def는 __init__의 def와 같은 높이, 그 아래 줄은 self.money = money 와 같은 높이). 높이가 어긋나면 IndentationError가 납니다. 클래스 셀을 다시 실행한 뒤, 새 셀에 뒤의 세 줄을 칩니다.",
            "code": r'''
    def spend(self, x):
        self.money -= x
w = Wallet(1000)
w.spend(300)
print(w.money)
''',
            "notes": [
                "(클래스 셀에 넣기) 돈을 쓰는 메서드 spend를 만듭니다. __init__의 def와 같은 높이입니다.",
                "(클래스 셀에 넣기) 이 상자의 money에서 x를 뺍니다. -= 는 '빼서 다시 넣기'입니다.",
                "(새 셀) 고친 설계도로 지갑을 새로 만듭니다.",
                "(새 셀) 300원을 씁니다. 점(.)으로 부르고, self는 파이썬이 w로 채웁니다.",
                "(새 셀) 남은 돈을 보여 줍니다.",
            ],
            "edits": [
                {
                    "target_step": "F-P6-S1",
                    "where_ko": "클래스 셀의 self.money = money 줄 바로 아래",
                    "action": "insert",
                    "anchor_line": "        self.money = money",
                    "line_count": 2,
                }
            ],
            "rerun_first": ["F-P6-S1"],
            "expected_ko": "700이 나옵니다. 클래스 셀을 다시 실행하지 않았다면 AttributeError: 'Wallet' object has no attribute 'spend' 가 납니다(옛 설계도에는 spend가 없음).",
            "expected_output": "700",
            "meaning_ko": "상자가 할 줄 아는 일(메서드)을 더했습니다. 클래스를 고치면 클래스 셀을 다시 실행하고 상자도 새로 만들어야 한다는 것이 1편에서 가장 자주 걸리는 점입니다.",
            "hints": [
                h1("AttributeError: 'Wallet' object has no attribute 'spend' 가 나오나요? 클래스 셀을 고친 뒤 다시 실행했는지 보세요."),
                h2("옛 상자는 옛 설계도로 만든 것이라 새 메서드가 없습니다. 클래스 셀 실행 → 상자 새로 만들기 순서로 하세요(설명 카드 6번째 문장).", unit="F-P6", card=6),
            ],
        },
        {
            "title_ko": "+ 의 뜻과 보여 주는 모습 정하기",
            "input_ko": "클래스 셀의 self.money -= x 줄 바로 아래에 앞의 네 줄을 넣습니다(def는 다른 def와 같은 높이, return은 self.money -= x 와 같은 높이). 클래스 셀을 다시 실행한 뒤, 새 셀에 뒤의 두 줄을 칩니다.",
            "code": r'''
    def __repr__(self):
        return f"Wallet(money={self.money})"
    def __add__(self, other):
        return Wallet(self.money + other.money)
total = Wallet(1) + Wallet(2)
print(total)
''',
            "notes": [
                "(클래스 셀에 넣기) 상자를 보여 줄 모습을 정하는 특수 메서드입니다.",
                "(클래스 셀에 넣기) Wallet(money=돈) 꼴의 글을 돌려줍니다. print(상자)를 하면 이 글이 보입니다.",
                "(클래스 셀에 넣기) + 의 뜻을 정하는 특수 메서드입니다. other는 + 오른쪽 상자입니다.",
                "(클래스 셀에 넣기) 두 상자의 돈을 더한 새 지갑 상자를 돌려줍니다.",
                "(새 셀) 1원 지갑 + 2원 지갑. 파이썬이 Wallet(1).__add__(Wallet(2))를 부릅니다.",
                "(새 셀) 결과 상자를 보여 줍니다. __repr__이 정한 모습으로 나옵니다.",
            ],
            "edits": [
                {
                    "target_step": "F-P6-S1",
                    "where_ko": "클래스 셀의 self.money -= x 줄 바로 아래",
                    "action": "insert",
                    "anchor_line": "        self.money -= x",
                    "line_count": 4,
                }
            ],
            "rerun_first": ["F-P6-S1"],
            "expected_ko": "Wallet(money=3) 이 나옵니다. __repr__을 넣지 않으면 <__main__.Wallet object at 0x...> 같은 알아보기 힘든 글이 나옵니다(뒤의 숫자는 사람마다 다름).",
            "expected_output": "Wallet(money=3)",
            "meaning_ko": "+ 의 뜻과 화면 모습을 우리가 정했습니다. 1편의 Value 상자가 바로 이 방법으로 a + b, a * b 를 계산하면서 누가 누구로 만들어졌는지를 기억합니다.",
            "hints": [
                h1("TypeError: unsupported operand type(s) for +: 'Wallet' and 'Wallet' 가 나오나요? __add__를 넣은 클래스 셀을 다시 실행했는지 보세요."),
                h2("a + b 는 a.__add__(b)를 부르는 것과 같습니다. 클래스 셀에 __add__가 있고, 그 셀을 다시 실행해야 + 가 통합니다(설명 카드 5, 6번째 문장).", unit="F-P6", card=5),
            ],
        },
    ],
    "questions": [
        {
            "type": "predict",
            "prompt_ko": "아래 코드를 실행하면 무엇이 나올까요? 숫자만 쓰세요.",
            "code": r'''
class Box:
    def __init__(self, v):
        self.v = v
    def __mul__(self, other):
        return Box(self.v * other.v)
print((Box(2) * Box(5)).v)
''',
            "auto_grade": {"type": "exact", "value": "10"},
            "answer_ko": "10입니다. Box(2) * Box(5) 는 Box(2).__mul__(Box(5))를 부르고, 2 x 5 = 10이 든 새 Box를 돌려줍니다. 그 상자의 v를 꺼내면 10입니다.",
            "rubric": [{"point": 1, "criterion_ko": "10"}],
            "hints": [
                h1("* 를 쓰면 파이썬은 어떤 특수 메서드를 부를까요? 그 안에서 self.v와 other.v는 각각 몇인가요?"),
                h2("설명 카드 5번째 문장: a + b 가 a.__add__(b)인 것처럼, a * b 는 a.__mul__(b)입니다.", unit="F-P6", card=5),
                h3("빈칸을 채워 실행하세요. 둘째 줄은 * 가 하는 일을 직접 부른 것입니다.", code=r'''
class Box:
    def __init__(self, v):
        self.v = v
    def __mul__(self, other):
        return Box(self.v * other.v)
b = Box(2).___(Box(5))
print(b.v)
''', blanks=["__mul__"], out="10"),
                h4("정답은 10입니다. self.v가 2, other.v가 5라서 2 x 5 = 10이 든 Box가 나옵니다."),
            ],
        },
        {
            "type": "choice",
            "prompt_ko": "class Wallet 안의 self.money = money 에서 self는 무엇일까요?",
            "choices": [
                "Wallet 설계도 자체",
                "지금 다루고 있는 그 지갑 상자 자신",
                "money와 같은 값",
                "파이썬이 만든 에러 표시",
            ],
            "answer_index": 1,
            "answer_ko": "self는 지금 만들고 있는(다루고 있는) 그 상자 자신입니다. Wallet(100)과 Wallet(500)을 만들면 각자의 self가 따로 있어서, 각 상자의 money 칸도 따로 있습니다.",
            "rubric": [{"point": 1, "criterion_ko": "'지금 다루고 있는 그 지갑 상자 자신'을 고름"}],
            "hints": [
                h1("지갑 상자 두 개를 만들면 money 칸은 몇 개일까요? 하나를 같이 쓸까요, 따로 있을까요?"),
                h2("설명 카드 3번째 문장: self는 '지금 만들고 있는 그 상자 자신'입니다.", unit="F-P6", card=3),
                h3("빈칸을 채워 실행하고, 두 상자의 값이 따로인지 보세요.", code=r'''
class Wallet:
    def __init__(self, money):
        self.money = money
a = Wallet(100)
b = Wallet(500)
print(a.money, b.___)
''', blanks=["money"], out="100 500"),
                h4("정답은 '지금 다루고 있는 그 지갑 상자 자신'입니다. a를 만들 때 self는 a, b를 만들 때 self는 b입니다."),
            ],
        },
        {
            "type": "fix_bug",
            "prompt_ko": "아래 코드는 TypeError: unsupported operand type(s) for +: 'int' and 'Wallet' 가 납니다. 왜 에러가 나는지 쓰고, 고친 뒤 나오는 값을 쓰세요. (1편 끝부분 MLP에서 똑같은 에러를 만납니다.)",
            "code": r'''
class Wallet:
    def __init__(self, money):
        self.money = money
    def __add__(self, other):
        return Wallet(self.money + other.money)
total = sum([Wallet(1), Wallet(2)])
print(total.money)
''',
            "auto_grade": {"type": "manual"},
            "answer_ko": "sum은 0부터 더하기 시작해서 맨 처음에 0 + Wallet(1)을 계산합니다. 왼쪽이 숫자 0이라 Wallet의 __add__가 쓰이지 않고, 파이썬은 오른쪽 상자의 __radd__를 찾다가 없어서 에러를 냅니다. 고치는 법은 두 가지입니다. (1) 시작값을 상자로 주기: sum([...], Wallet(0)) (2) 클래스에 __radd__를 넣어 '숫자 + 상자'도 처리하기: def __radd__(self, other): return Wallet(self.money + other). 어느 쪽이든 결과는 3입니다.",
            "rubric": [
                {"point": 0.4, "criterion_ko": "sum이 0부터 더해 0 + Wallet 이 된다는 원인을 씀"},
                {"point": 0.4, "criterion_ko": "Wallet(0) 시작값 또는 __radd__로 고침"},
                {"point": 0.2, "criterion_ko": "결과 3"},
            ],
            "answer_code": r'''
class Wallet:
    def __init__(self, money):
        self.money = money
    def __add__(self, other):
        return Wallet(self.money + other.money)
total = sum([Wallet(1), Wallet(2)], Wallet(0))
print(total.money)
''',
            "answer_notes": [
                "클래스는 그대로입니다.",
                "준비 함수도 그대로입니다.",
                "money 칸에 넣는 줄도 그대로입니다.",
                "+ 의 뜻도 그대로입니다.",
                "두 상자의 돈을 더한 새 상자를 돌려줍니다.",
                "sum의 둘째 칸에 시작값 Wallet(0)을 줍니다. 이제 처음 계산이 Wallet(0) + Wallet(1)이라 __add__가 쓰입니다.",
                "합계 상자의 돈을 보여 줍니다.",
            ],
            "answer_output": "3",
            "verify_code": r'''
class Wallet:
    def __init__(self, money):
        self.money = money
    def __add__(self, other):
        return Wallet(self.money + other.money)
    def __radd__(self, other):
        return Wallet(self.money + other)
total = sum([Wallet(1), Wallet(2)])
print(total.money)
''',
            "verify_output": "3",
            "hints": [
                h1("에러 줄의 'int'와 'Wallet'은 + 의 왼쪽과 오른쪽입니다. 왼쪽의 int(정수)는 어디서 왔을까요? 코드에 숫자를 더하는 곳이 보이나요?"),
                h2("설명 카드 7번째 문장: sum은 0부터 더하기 시작합니다. 그래서 첫 계산이 0 + Wallet(1)입니다.", unit="F-P6", card=7),
                h3("시작값을 주는 방법입니다. 빈칸을 채워 실행하세요.", code=r'''
class Wallet:
    def __init__(self, money):
        self.money = money
    def __add__(self, other):
        return Wallet(self.money + other.money)
total = sum([Wallet(1), Wallet(2)], ___)
print(total.money)
''', blanks=["Wallet(0)"], out="3"),
                h4("sum([Wallet(1), Wallet(2)], Wallet(0))처럼 시작값을 상자로 주거나, 클래스에 __radd__를 넣습니다. 결과는 3입니다."),
            ],
        },
    ],
    "rebuild": {
        "title_ko": "점수 상자 만들기",
        "prompt_ko": "빈 셀에서 만드세요. Score(10)처럼 점수를 담는 상자 Score를 만들고, + 로 두 점수를 더하면 새 Score가 나오고, print하면 Score(15)처럼 보이게 하세요. 마지막에 print(Score(10) + Score(5))를 실행합니다.",
        "solution_code": r'''
class Score:
    def __init__(self, points):
        self.points = points
    def __add__(self, other):
        return Score(self.points + other.points)
    def __repr__(self):
        return f"Score({self.points})"
print(Score(10) + Score(5))
''',
        "solution_notes": [
            "Score 설계도를 시작합니다.",
            "상자를 만들 때 점수를 받습니다.",
            "이 상자의 points 칸에 점수를 넣습니다.",
            "+ 의 뜻을 정합니다.",
            "두 점수를 더한 새 Score를 돌려줍니다.",
            "보여 주는 모습을 정합니다.",
            "Score(점수) 꼴의 글을 돌려줍니다.",
            "두 상자를 더해 결과를 보여 줍니다.",
        ],
        "expected_output": "Score(15)",
        "self_check_ko": [
            "__init__, __add__, __repr__의 밑줄이 모두 앞뒤 두 개씩이다",
            "__add__가 숫자가 아니라 새 Score 상자를 돌려준다",
            "print(Score(1) + Score(2) + Score(3))도 Score(6)이 나온다",
        ],
        "hints": [
            h1("상자에 담을 칸은 무엇인가요? + 를 하면 무엇이 나와야 하나요?"),
            h2("F-P6-S1(설계도), S3(__add__, __repr__)를 합치면 됩니다. 설명 카드 5번째 문장도 보세요.", unit="F-P6", card=5),
            h3("빈칸을 채우세요.", code=r'''
class Score:
    def __init__(self, points):
        self.points = points
    def ___(self, other):
        return Score(self.points + other.___)
    def __repr__(self):
        return f"Score({___})"
print(Score(10) + Score(5))
''', blanks=["__add__", "points", "self.points"], out="Score(15)"),
            h4("__add__는 Score(self.points + other.points)를, __repr__은 f\"Score({self.points})\"를 돌려줍니다."),
        ],
    },
}
