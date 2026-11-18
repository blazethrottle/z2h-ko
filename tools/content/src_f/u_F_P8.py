from _lib import h1, h2, h3, h4

UNIT = {
    "unit_id": "F-P8",
    "kind": "python",
    "title_ko": "에러 읽기와 셀 순서",
    "goal_ko": "에러 화면은 맨 아래 줄 '에러 종류: 내용'부터 읽는다. NameError, TypeError, IndexError, KeyError, 모양 에러를 구분하고 어느 셀을 다시 실행할지 정한다. 막히면 HELP 메모(목표, 마지막 셀 코드, 에러 마지막 줄)를 쓴다.",
    "analogy_ko": "에러 화면은 사고 보고서입니다. 위쪽은 사고까지 거쳐 온 길이고, 맨 아래 한 줄이 '무슨 사고인지' 요약입니다.",
    "card_ko": [
        "코드에 문제가 있으면 빨간 에러 화면(Traceback, 거쳐 온 길의 기록)이 나옵니다. 컴퓨터가 고장 난 것이 아니라 '여기서 이래서 못 했다'는 보고입니다.",
        "가장 먼저 맨 아래 줄을 읽습니다. '에러 종류: 내용' 꼴로 원인이 적혀 있습니다. 위쪽의 화살표(---->)는 문제가 난 줄을 가리킵니다.",
        "NameError는 아직 없는 이름을 썼다는 뜻입니다. 철자를 보거나, 그 이름을 만드는 셀을 먼저 실행합니다.",
        "TypeError는 종류가 안 맞는 계산입니다. 예를 들어 글자 \"3\"과 숫자 4는 바로 더할 수 없습니다. int(\"3\")은 글자를 숫자로, str(4)는 숫자를 글자로 바꿉니다.",
        "IndexError는 리스트에 없는 번호를 썼다는 뜻이고, KeyError는 사전에 없는 키를 썼다는 뜻입니다.",
        "모양 에러(예: mat1 and mat2 shapes cannot be multiplied (2x3 and 2x3))는 괄호 속 두 모양을 비교하면 됩니다. 행렬곱은 앞 모양의 뒤 숫자와 뒤 모양의 앞 숫자가 같아야 합니다(F-M6).",
        "에러를 고쳤는데도 이상하면 셀 순서를 의심합니다. 다시 시작(Colab 런타임) 뒤 모두 실행이 가장 확실합니다(F-P1).",
        "그래도 막히면 HELP 메모에 세 가지를 적습니다. 하려던 일(목표), 마지막에 실행한 셀의 코드, 에러 맨 아래 줄입니다.",
    ],
    "needed_by": ["L01", "L02", "L03", "L04", "L05", "L06", "L07", "L09", "L10"],
    "recommend_first": True,
    "steps": [
        {
            "title_ko": "NameError 화면 읽기",
            "input_ko": "새 노트북의 첫 셀에 아래 한 줄을 치고 실행합니다. y를 만든 적이 없으니 일부러 에러를 보는 것입니다. 놀라지 말고 맨 아래 줄부터 읽습니다.",
            "code": r'''
print(y)
''',
            "notes": [
                "아직 만든 적 없는 y를 보여 달라고 합니다. 에러가 납니다.",
            ],
            "expected_error": "NameError",
            "expected_ko": "빨간 에러 화면이 나오고 맨 아래 줄이 NameError: name 'y' is not defined 입니다. 위쪽에는 ----> 1 print(y) 처럼 문제가 난 줄을 가리키는 화살표가 보입니다.",
            "expected_output": "NameError: name 'y' is not defined",
            "meaning_ko": "NameError의 뜻은 '그런 이름은 아직 없다'입니다. 맨 아래 줄만 읽어도 원인이 보입니다.",
            "hints": [
                h1("에러 화면이 길어서 어디를 볼지 모르겠나요? 맨 아래 한 줄만 소리 내어 읽어 보세요."),
                h2("맨 아래 줄이 '에러 종류: 내용'입니다. NameError는 없는 이름입니다(설명 카드 2, 3번째 문장).", unit="F-P8", card=3),
            ],
        },
        {
            "sub": "b",
            "title_ko": "NameError 고치기",
            "input_ko": "에러 난 셀 아래에 셀 두 개를 만들어 한 줄씩 치고 차례로 실행합니다.",
            "code": r'''
y = 5
print(y)
''',
            "notes": [
                "첫 셀. y에 5를 넣어 y를 만듭니다.",
                "둘째 셀. 이제 y가 있으니 5가 나옵니다.",
            ],
            "cells": [1, 1],
            "expected_ko": "첫 셀은 아무것도 보여 주지 않고, 둘째 셀은 5를 보여 줍니다. 맨 위의 print(y) 셀을 지금 다시 실행해도 5가 나옵니다.",
            "expected_output": "5",
            "meaning_ko": "할 일은 맨 아래 줄이 알려 줍니다. 없는 이름이면 그 이름을 만드는 셀을 먼저 실행하면 됩니다.",
            "hints": [
                h1("둘째 셀에서도 NameError가 나오나요? 첫 셀(y = 5)을 실행했는지, y의 철자가 같은지 보세요."),
                h2("이름은 만드는 셀이 실행된 뒤에만 쓸 수 있습니다(설명 카드 3번째 문장, F-P1).", unit="F-P8", card=3),
            ],
        },
        {
            "title_ko": "TypeError 화면 읽기",
            "input_ko": "새 셀에 아래 한 줄을 치고 실행합니다. 글자와 숫자를 더해 일부러 에러를 봅니다.",
            "code": r'''
print("3" + 4)
''',
            "notes": [
                "글자 \"3\"과 숫자 4를 더하려고 합니다. 종류가 달라 에러가 납니다.",
            ],
            "expected_error": "TypeError",
            "expected_ko": "맨 아래 줄이 TypeError: can only concatenate str (not \"int\") to str 입니다. '글자(str)에는 숫자(int)가 아니라 글자만 이어 붙일 수 있다'는 뜻입니다.",
            "expected_output": "TypeError: can only concatenate str (not \"int\") to str",
            "meaning_ko": "TypeError는 계산하려는 두 값의 종류가 안 맞는다는 뜻입니다. 따옴표가 있으면 글자, 없으면 숫자입니다.",
            "hints": [
                h1("맨 아래 줄에서 str과 int는 각각 무엇을 가리킬까요? \"3\"과 4 중 어느 쪽이 글자인가요?"),
                h2("str은 글자, int는 정수(숫자)입니다. 글자와 숫자는 바로 더할 수 없습니다(설명 카드 4번째 문장).", unit="F-P8", card=4),
            ],
        },
        {
            "sub": "b",
            "title_ko": "TypeError 고치기: 종류 맞추기",
            "input_ko": "에러 난 셀 아래 새 셀에 두 줄을 치고 실행합니다.",
            "code": r'''
print(int("3") + 4)
print("3" + str(4))
''',
            "notes": [
                "int(\"3\")으로 글자를 숫자 3으로 바꾼 뒤 4를 더합니다.",
                "str(4)로 숫자를 글자 \"4\"로 바꾼 뒤 글자끼리 이어 붙입니다.",
            ],
            "expected_ko": "7과 34가 한 줄씩 나옵니다.",
            "expected_output": "7\n34",
            "meaning_ko": "종류를 맞추면 풀립니다. 숫자로 맞추면 더하기(7), 글자로 맞추면 이어 붙이기(34)가 됩니다.",
            "hints": [
                h1("또 TypeError가 나오나요? 둘째 줄은 int(...)로, 셋째 줄은 str(...)로 한쪽을 감쌌는지 보세요."),
                h2("글자 + 글자는 이어 붙이기, 숫자 + 숫자는 더하기입니다. int()와 str()로 종류를 바꿉니다(설명 카드 4번째 문장).", unit="F-P8", card=4),
            ],
        },
        {
            "title_ko": "모양 에러 화면 읽기",
            "input_ko": "새 셀에 세 줄을 치고 실행합니다. torch는 신경망 도구입니다. Colab에는 이미 깔려 있다는 전제입니다(직접 설치하지 않음).",
            "code": r'''
import torch
A = torch.ones(2, 3)
print(A @ A)
''',
            "notes": [
                "신경망 도구 torch를 불러옵니다.",
                "1로 채운 2행 3열 표를 만듭니다.",
                "표끼리 행렬곱(@)을 해 봅니다. (2, 3)과 (2, 3)은 모양이 맞지 않아 에러가 납니다.",
            ],
            "expected_error": "RuntimeError",
            "check": {
                "type": "output_match",
                "mode": "contains_lines",
                "lines": ["mat1 and mat2 shapes cannot be multiplied (2x3 and 2x3)"],
            },
            "expected_ko": "맨 아래 줄이 RuntimeError: mat1 and mat2 shapes cannot be multiplied (2x3 and 2x3) 입니다(torch 판에 따라 앞에 mm: 이 붙기도 합니다). mat1과 mat2는 @ 앞뒤의 두 표입니다.",
            "expected_output": "RuntimeError: mm: mat1 and mat2 shapes cannot be multiplied (2x3 and 2x3)",
            "meaning_ko": "모양 에러는 괄호 속 두 모양만 보면 됩니다. 2x3 과 2x3 은 앞 모양의 뒤 숫자(3)와 뒤 모양의 앞 숫자(2)가 달라서 안 됩니다.",
            "hints": [
                h1("ModuleNotFoundError: No module named 'torch' 가 나오나요? 이것은 코드가 아니라 환경 문제입니다. 직접 설치하지 말고 HELP 메모로 남기세요(점수에서 빠집니다)."),
                h2("모양 에러는 괄호 속 두 모양을 비교합니다. 행렬곱은 (a, b) @ (b, c) 꼴이어야 합니다(설명 카드 6번째 문장, 자세히는 F-M6).", unit="F-P8", card=6),
            ],
        },
        {
            "sub": "b",
            "title_ko": "모양 맞춰 고치기",
            "input_ko": "에러 난 셀 아래 새 셀에 두 줄을 칩니다. 위 셀의 A를 그대로 씁니다.",
            "code": r'''
B = torch.ones(3, 2)
print((A @ B).shape)
''',
            "notes": [
                "이번에는 3행 2열 표를 만듭니다.",
                "(2, 3) @ (3, 2)는 가운데 3이 같아서 됩니다. 결과의 모양을 보여 줍니다.",
            ],
            "expected_ko": "torch.Size([2, 2]) 가 나옵니다. 결과는 바깥 두 숫자 (2, 2)입니다.",
            "expected_output": "torch.Size([2, 2])",
            "meaning_ko": "가운데 숫자를 맞추면 모양 에러가 풀립니다. 3편부터 이 에러를 자주 만나는데, 이제 읽고 고칠 수 있습니다.",
            "hints": [
                h1("NameError: name 'A' is not defined 가 나오나요? 위 셀(A를 만든 셀)을 먼저 실행했는지 보세요. 그 셀은 에러를 냈어도 A는 만들어져 있습니다."),
                h2("(2, 3) @ (3, 2)는 가운데가 같아 되고, 결과는 (2, 2)입니다(설명 카드 6번째 문장).", unit="F-P8", card=6),
            ],
        },
    ],
    "questions": [
        {
            "type": "choice",
            "prompt_ko": "셀을 실행했더니 빨간 에러 화면이 스무 줄 넘게 나왔습니다. 가장 먼저 읽을 곳은 어디일까요?",
            "choices": [
                "맨 위 첫 줄",
                "맨 아래 줄(에러 종류: 내용)",
                "가운데의 가장 긴 줄",
                "읽지 않고 셀을 지운 뒤 다시 친다",
            ],
            "answer_index": 1,
            "answer_ko": "맨 아래 줄입니다. 거기에 '에러 종류: 내용'으로 원인이 요약되어 있습니다. 그다음 화살표(---->)로 내 셀의 몇째 줄인지 확인합니다.",
            "rubric": [{"point": 1, "criterion_ko": "맨 아래 줄을 고름"}],
            "hints": [
                h1("F-P8-S1의 에러 화면에서 NameError라는 글자는 어디에 있었나요?"),
                h2("설명 카드 2번째 문장: 가장 먼저 맨 아래 줄을 읽습니다.", unit="F-P8", card=2),
                h3("빈칸을 채워 보세요. 에러 화면의 맨 ___ 줄에는 '에러 ___: 내용'이 적혀 있고, 위쪽 화살표 ---->는 문제가 난 ___을 가리킵니다.", blanks=["아래", "종류", "줄"]),
                h4("정답은 맨 아래 줄입니다. 원인 요약이 늘 그곳에 있습니다."),
            ],
        },
        {
            "type": "fix_bug",
            "prompt_ko": "아래 셀은 TypeError: can only concatenate str (not \"int\") to str 가 납니다. 고쳐서 실행하고 나오는 것을 그대로 쓰세요.",
            "code": r'''
print("합계: " + 100)
''',
            "auto_grade": {"type": "exact", "value": "합계: 100", "accept": ["합계:100"]},
            "answer_ko": "글자 \"합계: \"에 숫자 100을 바로 이어 붙일 수 없어서 납니다. str(100)으로 숫자를 글자로 바꾸거나 f-문자열 f\"합계: {100}\"을 쓰면 '합계: 100'이 나옵니다.",
            "rubric": [
                {"point": 0.5, "criterion_ko": "str(100) 또는 f-문자열로 종류를 맞춤"},
                {"point": 0.5, "criterion_ko": "결과 합계: 100"},
            ],
            "answer_code": r'''
print("합계: " + str(100))
''',
            "answer_notes": [
                "str(100)이 숫자 100을 글자 \"100\"으로 바꿔서, 글자끼리 이어 붙일 수 있습니다.",
            ],
            "answer_output": "합계: 100",
            "hints": [
                h1("+ 왼쪽은 글자이고 오른쪽은 숫자입니다. 둘을 같은 종류로 맞추려면 어느 쪽을 바꿔야 할까요?"),
                h2("설명 카드 4번째 문장: str(4)는 숫자를 글자로 바꿉니다. F-P8-S2b 둘째 줄과 같은 방법입니다.", unit="F-P8", card=4),
                h3("빈칸을 채우세요.", code=r'''
print("합계: " + ___(100))
''', blanks=["str"], out="합계: 100"),
                h4("print(\"합계: \" + str(100)) 또는 print(f\"합계: {100}\"). 결과는 합계: 100 입니다."),
            ],
        },
        {
            "type": "apply",
            "prompt_ko": "노트북에 아래 세 셀이 위에서부터 있습니다(첫 줄이 셀 1, 둘째 줄이 셀 2, 셋째 줄이 셀 3). 다시 시작(Colab 런타임)한 뒤 셀 3만 실행했더니 NameError: name 'P' is not defined 가 났습니다. 셀 3이 제대로 돌려면 어떤 셀들을 어떤 순서로 실행해야 할까요? 셀 번호를 실행 순서대로 쉼표로 쓰세요(예: 3, 2).",
            "code": r'''
counts = [6, 3, 1]
P = [c / sum(counts) for c in counts]
print(P[0])
''',
            "auto_grade": {"type": "exact", "value": "1, 2, 3", "accept": ["1,2,3", "1 2 3", "123", "1-2-3"]},
            "answer_ko": "1, 2, 3 순서입니다. 셀 3은 P를 쓰고, P는 셀 2가 만들고, 셀 2는 셀 1의 counts를 씁니다. 다시 시작하면 셋 다 지워졌으니 위에서부터 차례로 돌려야 합니다(모두 실행도 같음). 그러면 셀 3은 0.6을 보여 줍니다.",
            "rubric": [
                {"point": 0.5, "criterion_ko": "셀 2가 P를 만들고 셀 1이 counts를 만든다는 연결을 앎"},
                {"point": 0.5, "criterion_ko": "1, 2, 3 순서(또는 모두 실행)"},
            ],
            "answer_code": r'''
counts = [6, 3, 1]
P = [c / sum(counts) for c in counts]
print(P[0])
''',
            "answer_notes": [
                "셀 1. counts를 만듭니다.",
                "셀 2. counts로 P를 만듭니다.",
                "셀 3. P의 첫 값을 보여 줍니다.",
            ],
            "answer_output": "0.6",
            "graded_on": "answer_text",
            "hints": [
                h1("셀 3은 무엇을 쓰나요? 그것은 어느 셀이 만드나요? 그 셀은 또 무엇을 쓰나요?"),
                h2("NameError는 그 이름을 만드는 셀을 아직 안 돌렸다는 뜻입니다(설명 카드 3번째 문장). 이름이 만들어지는 셀을 거슬러 올라가 찾으세요.", unit="F-P8", card=3),
                h3("세 셀을 실행할 순서대로 위에서부터 놓았습니다. 주석의 빈칸에 셀 번호를 채운 뒤, 세 줄을 한 셀에 넣어 실행해 0.6이 나오는지 보세요.", code=r'''
counts = [6, 3, 1]                      # 셀 ___ (counts를 만듦)
P = [c / sum(counts) for c in counts]   # 셀 ___ (counts로 P를 만듦)
print(P[0])                             # 셀 3 (P를 씀)
''', blanks=["1", "2"], out="0.6"),
                h4("정답은 1, 2, 3 입니다. 모두 실행(Colab 런타임 > 모두 실행)을 눌러도 같은 순서로 돕니다."),
            ],
        },
    ],
    "rebuild": {
        "title_ko": "HELP 메모 쓰고 직접 고치기",
        "prompt_ko": "새 셀에 price = 1200 과 print(prise * 3) 두 줄을 치고 실행해 에러를 냅니다. 먼저 HELP 메모 세 줄(하려던 일, 마지막 셀 코드, 에러 맨 아래 줄)을 노트북의 글 셀이나 종이에 적습니다. 그다음 에러를 고쳐 3600이 나오게 하세요.",
        "solution_code": r'''
price = 1200
print(price * 3)
''',
        "solution_notes": [
            "가격을 price에 넣습니다.",
            "철자를 prise에서 price로 고쳤습니다. 이제 3600이 나옵니다.",
        ],
        "expected_output": "3600",
        "self_check_ko": [
            "HELP 메모에 목표(가격 3개의 합계 보기), 셀 코드, 에러 맨 아래 줄 NameError: name 'prise' is not defined 를 적었다",
            "맨 아래 줄을 보고 '없는 이름'이라는 원인을 스스로 찾았다",
            "고친 뒤 3600이 나왔다",
        ],
        "hints": [
            h1("에러 맨 아래 줄은 어떤 이름을 모른다고 하나요? 그 이름을 위 줄과 한 글자씩 비교해 보세요."),
            h2("NameError는 없는 이름입니다. 철자가 한 글자만 달라도 다른 이름입니다(설명 카드 3번째 문장).", unit="F-P8", card=3),
            h3("빈칸을 채우세요.", code=r'''
price = 1200
print(___ * 3)
''', blanks=["price"], out="3600"),
            h4("print(prise * 3)을 print(price * 3)으로 고칩니다. HELP 메모: 목표 '1200원짜리 3개 합계 보기', 셀 코드 두 줄, 에러 NameError: name 'prise' is not defined."),
        ],
    },
}
