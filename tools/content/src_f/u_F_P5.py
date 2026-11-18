from _lib import h1, h2, h3, h4

UNIT = {
    "unit_id": "F-P5",
    "kind": "python",
    "title_ko": "딕셔너리와 정렬",
    "goal_ko": "딕셔너리(이름표 → 값 사전)를 만들고, get(키, 0)으로 개수를 세고, items()로 꺼내고, sorted(..., key=...)와 max(..., key=...)로 가장 큰 것을 찾는다.",
    "analogy_ko": "딕셔너리는 출석부입니다. 이름(키)을 대면 그 사람의 값이 나옵니다. 출석부에 없는 이름을 부르면 '없는 사람'이라는 에러가 납니다.",
    "card_ko": [
        "딕셔너리는 '키 → 값' 짝을 모아 둔 사전입니다. {\"민지\": 30, \"준호\": 25}처럼 중괄호 안에 키: 값을 쉼표로 늘어놓습니다.",
        "d[\"민지\"]처럼 대괄호에 키를 넣어 값을 찾습니다. 없는 키를 대괄호로 찾으면 KeyError가 납니다.",
        "d.get(키, 0)은 키가 없으면 에러 대신 0을 줍니다. 그래서 개수를 셀 때 편합니다.",
        "d[키] = 값 은 새 짝을 넣거나, 이미 있는 키라면 값을 바꿉니다.",
        "counts[ch] = counts.get(ch, 0) + 1 은 '지금 개수(없으면 0)에 1을 더해 다시 적기'로, 세기의 기본 꼴입니다.",
        "d.items()는 (키, 값) 짝들을 줍니다. 괄호로 묶은 짝을 튜플이라고 부르고, kv[0]이 키, kv[1]이 값입니다. 튜플은 딕셔너리의 키로도 쓸 수 있습니다.",
        "sorted(..., key=기준)은 기준대로 줄을 세웁니다. lambda kv: -kv[1] 은 '짝의 값에 마이너스를 붙여라'는 한 줄짜리 함수라서, 값이 큰 것부터 줄을 섭니다.",
        "max(d, key=d.get)은 값이 가장 큰 키를 찾습니다.",
    ],
    "needed_by": ["L02", "L09"],
    "steps": [
        {
            "title_ko": "사전 만들고 찾기",
            "input_ko": "새 노트북의 첫 셀에 다섯 줄을 칩니다. 중괄호 { }와 콜론(:)을 씁니다.",
            "code": r'''
ages = {"민지": 30, "준호": 25}
print(ages["민지"])
print(ages.get("수아", 0))
ages["수아"] = 28
print(ages)
''',
            "notes": [
                "이름(키)과 나이(값) 짝 두 개로 사전을 만들어 ages라고 부릅니다.",
                "키 '민지'로 값을 찾습니다.",
                "없는 키 '수아'를 get으로 찾습니다. 없으니 대신 0을 줍니다.",
                "새 짝 '수아': 28을 넣습니다.",
                "사전 전체를 보여 줍니다. 넣은 차례대로 보입니다.",
            ],
            "expected_ko": "30, 0, 그리고 {'민지': 30, '준호': 25, '수아': 28} 이 나옵니다.",
            "expected_output": "30\n0\n{'민지': 30, '준호': 25, '수아': 28}",
            "meaning_ko": "키로 값을 바로 찾고, 없는 키는 get으로 안전하게 다룹니다. 2편에서 글자마다 번호를 붙인 사전(글자 → 번호)을 이렇게 씁니다.",
            "hints": [
                h1("SyntaxError가 나오나요? 키와 값 사이가 콜론(:)인지, 짝 사이가 쉼표인지 보세요."),
                h2("딕셔너리는 {키: 값, 키: 값} 꼴입니다(설명 카드 1번째 문장). 대괄호로 찾고, 없을 수 있으면 get을 씁니다.", unit="F-P5", card=1),
            ],
        },
        {
            "title_ko": "글자 개수 세기",
            "input_ko": "새 셀에 네 줄을 칩니다. 셋째 줄만 들여 씁니다.",
            "code": r'''
counts = {}
for ch in "banana":
    counts[ch] = counts.get(ch, 0) + 1
print(counts)
''',
            "notes": [
                "빈 사전을 만듭니다.",
                "글자 banana에서 한 글자씩 꺼내 ch라고 부릅니다.",
                "ch의 지금 개수(처음이면 0)에 1을 더해 다시 적습니다.",
                "다 센 사전을 보여 줍니다.",
            ],
            "expected_ko": "{'b': 1, 'a': 3, 'n': 2} 가 나옵니다. 처음 나온 차례(b, a, n)대로 보입니다.",
            "expected_output": "{'b': 1, 'a': 3, 'n': 2}",
            "meaning_ko": "get(키, 0) + 1 이 세기의 기본 꼴입니다. 2편은 이 꼴로 글자 짝의 개수를, 9편은 자주 붙어 나오는 바이트 짝의 개수를 셉니다.",
            "hints": [
                h1("KeyError: 'b' 가 나오나요? counts[ch] + 1 이 아니라 counts.get(ch, 0) + 1 로 썼는지 보세요."),
                h2("처음 보는 글자는 아직 사전에 없어서, 대괄호로 꺼내면 KeyError입니다. get(ch, 0)은 없을 때 0을 줍니다(설명 카드 3, 5번째 문장).", unit="F-P5", card=5),
            ],
        },
        {
            "title_ko": "많은 순으로 줄 세우기",
            "input_ko": "새 셀에 네 줄을 칩니다. 위 셀의 counts를 씁니다.",
            "code": r'''
print(list(counts.items()))
pairs = sorted(counts.items(), key=lambda kv: -kv[1])
print(pairs)
print(max(counts, key=counts.get))
''',
            "notes": [
                "사전의 (키, 값) 짝들을 리스트로 펼쳐 보여 줍니다.",
                "짝들을 값(kv[1])이 큰 순으로 줄 세웁니다. -kv[1]이라 큰 값이 앞에 옵니다.",
                "줄 세운 결과를 보여 줍니다.",
                "값이 가장 큰 키를 찾아 보여 줍니다.",
            ],
            "expected_ko": "[('b', 1), ('a', 3), ('n', 2)], [('a', 3), ('n', 2), ('b', 1)], a 가 나옵니다.",
            "expected_output": "[('b', 1), ('a', 3), ('n', 2)]\n[('a', 3), ('n', 2), ('b', 1)]\na",
            "meaning_ko": "센 결과를 많은 순으로 보고, 가장 많은 것을 찾았습니다. 2편에서 '가장 흔한 글자 짝', 9편에서 '가장 자주 붙는 짝'을 고를 때 이 두 줄을 씁니다.",
            "hints": [
                h1("작은 순(b가 맨 앞)으로 나오나요? kv[1] 앞에 마이너스(-)를 붙였는지 보세요."),
                h2("key=lambda kv: -kv[1] 은 '값에 마이너스'라서 큰 값이 앞에 섭니다. 마이너스가 없으면 작은 순입니다(설명 카드 7번째 문장).", unit="F-P5", card=7),
            ],
        },
    ],
    "questions": [
        {
            "type": "predict",
            "prompt_ko": "F-P5-S2와 같은 방법으로 hello의 글자를 셌습니다. 마지막 줄은 무엇을 보여 줄까요? 숫자만 쓰세요.",
            "code": r'''
counts = {}
for ch in "hello":
    counts[ch] = counts.get(ch, 0) + 1
print(counts["l"])
''',
            "auto_grade": {"type": "exact", "value": "2"},
            "answer_ko": "2입니다. hello에는 l이 두 번 있어서, l을 처음 볼 때 0 + 1 = 1, 두 번째에 1 + 1 = 2가 됩니다.",
            "rubric": [{"point": 1, "criterion_ko": "2"}],
            "hints": [
                h1("hello에 l은 몇 번 나오나요? l을 볼 때마다 개수는 어떻게 바뀌나요?"),
                h2("설명 카드 5번째 문장: 지금 개수(없으면 0)에 1을 더해 다시 적습니다.", unit="F-P5", card=5),
                h3("사전 전체를 보여 주게 바꿨습니다. 빈칸을 채워 실행하세요.", code=r'''
counts = {}
for ch in "hello":
    counts[ch] = counts.get(ch, ___) + 1
print(counts)
''', blanks=["0"], out="{'h': 1, 'e': 1, 'l': 2, 'o': 1}"),
                h4("정답은 2입니다. 사전은 {'h': 1, 'e': 1, 'l': 2, 'o': 1}입니다."),
            ],
        },
        {
            "type": "choice",
            "prompt_ko": "아래 코드를 실행하면 어떻게 될까요?",
            "code": r'''
ages = {"민지": 30, "준호": 25}
print(ages["수아"])
''',
            "choices": ["0이 나온다", "None이 나온다", "KeyError 에러가 난다", "수아가 나온다"],
            "answer_index": 2,
            "answer_ko": "KeyError 에러가 납니다. 사전에 없는 키를 대괄호로 찾으면 맨 아래 줄이 KeyError: '수아' 인 에러가 납니다. 0을 받고 싶으면 ages.get(\"수아\", 0)을 씁니다.",
            "rubric": [{"point": 1, "criterion_ko": "KeyError를 고름"}],
            "verify_code": r'''
ages = {"민지": 30, "준호": 25}
print(ages["수아"])
''',
            "verify_output": "KeyError: '수아'",
            "hints": [
                h1("사전 ages에 '수아'라는 키가 있나요? F-P5-S1에서는 수아를 찾을 때 무엇을 썼나요?"),
                h2("설명 카드 2, 3번째 문장: 대괄호로 없는 키를 찾으면 KeyError, get은 기본값을 줍니다.", unit="F-P5", card=2),
                h3("대괄호 대신 get을 쓰면 어떻게 되는지 보세요. 빈칸을 채워 실행합니다.", code=r'''
ages = {"민지": 30, "준호": 25}
print(ages.___("수아", 0))
''', blanks=["get"], out="0"),
                h4("정답은 'KeyError 에러가 난다'입니다. 0이 나오는 것은 get을 쓸 때입니다."),
            ],
        },
        {
            "type": "apply",
            "prompt_ko": "두 글자를 괄호로 묶은 튜플 (\"a\", \"n\")을 사전의 키로 쓰면 글자 짝의 개수도 셀 수 있습니다. banana의 이웃한 글자 짝을 모두 세는 코드를 쓰고, print(counts[(\"a\", \"n\")])의 결과를 쓰세요. (짝 짓기는 F-P3의 zip(w, w[1:])을 씁니다.)",
            "code": None,
            "auto_grade": {"type": "exact", "value": "2"},
            "answer_ko": "zip(w, w[1:])으로 이웃한 두 글자를 꺼내 (a, b) 튜플을 키로 개수를 셉니다. banana의 짝은 ba, an, na, an, na라서 ('a', 'n')은 2입니다.",
            "rubric": [
                {"point": 0.4, "criterion_ko": "zip(w, w[1:])으로 이웃한 짝을 꺼냄"},
                {"point": 0.4, "criterion_ko": "튜플 (a, b)를 키로 get(..., 0) + 1 로 셈"},
                {"point": 0.2, "criterion_ko": "결과 2"},
            ],
            "answer_code": r'''
counts = {}
w = "banana"
for a, b in zip(w, w[1:]):
    counts[(a, b)] = counts.get((a, b), 0) + 1
print(counts[("a", "n")])
''',
            "answer_notes": [
                "빈 사전을 만듭니다.",
                "짝을 세어 볼 단어 banana를 w에 넣습니다.",
                "이웃한 두 글자를 a, b로 꺼냅니다(F-P3-S3).",
                "(a, b) 짝을 키로 개수를 하나 늘립니다.",
                "('a', 'n') 짝의 개수를 보여 줍니다.",
            ],
            "answer_output": "2",
            "hints": [
                h1("글자 하나를 셀 때(F-P5-S2)와 무엇이 다른가요? 키가 글자 하나에서 무엇으로 바뀌나요?"),
                h2("튜플도 사전의 키가 됩니다(설명 카드 6번째 문장). 짝은 zip(w, w[1:])로 꺼냅니다(F-P3 설명 카드 5번째 문장).", unit="F-P5", card=6),
                h3("빈칸을 채우세요.", code=r'''
counts = {}
w = "banana"
for a, b in zip(w, ___):
    counts[(a, b)] = counts.get(___, 0) + 1
print(counts[("a", "n")])
''', blanks=["w[1:]", "(a, b)"], out="2"),
                h4("for a, b in zip(w, w[1:]): counts[(a, b)] = counts.get((a, b), 0) + 1. 결과는 2입니다. 2편의 바이그램 세기가 바로 이 코드입니다."),
            ],
        },
    ],
    "rebuild": {
        "title_ko": "가장 많이 나온 단어 찾기",
        "prompt_ko": "빈 셀에서 만드세요. 단어 리스트 [\"the\", \"cat\", \"and\", \"the\", \"hat\"]의 단어마다 개수를 세어 사전을 보여 주고, 가장 많이 나온 단어를 보여 주세요.",
        "solution_code": r'''
words = ["the", "cat", "and", "the", "hat"]
counts = {}
for w in words:
    counts[w] = counts.get(w, 0) + 1
print(counts)
print(max(counts, key=counts.get))
''',
        "solution_notes": [
            "단어 리스트를 만듭니다.",
            "빈 사전을 만듭니다.",
            "단어를 하나씩 꺼냅니다.",
            "그 단어의 개수를 하나 늘립니다.",
            "센 사전을 보여 줍니다.",
            "개수가 가장 많은 단어를 보여 줍니다.",
        ],
        "expected_output": "{'the': 2, 'cat': 1, 'and': 1, 'hat': 1}\nthe",
        "self_check_ko": [
            "get(w, 0) + 1 꼴로 셌다",
            "max(counts, key=counts.get)이 개수가 아니라 단어(키)를 돌려준다는 것을 안다",
            "sorted(counts.items(), key=lambda kv: -kv[1])로 많은 순 목록도 만들 수 있다",
        ],
        "hints": [
            h1("F-P5-S2의 세기 코드에서 무엇만 바꾸면 될까요? 글자 대신 무엇을 하나씩 꺼내나요?"),
            h2("세기는 get(키, 0) + 1, 가장 큰 것 찾기는 max(사전, key=사전.get)입니다(설명 카드 5, 8번째 문장).", unit="F-P5", card=8),
            h3("빈칸을 채우세요.", code=r'''
words = ["the", "cat", "and", "the", "hat"]
counts = {}
for w in words:
    counts[w] = counts.get(w, ___) + 1
print(counts)
print(max(counts, key=___))
''', blanks=["0", "counts.get"], out="{'the': 2, 'cat': 1, 'and': 1, 'hat': 1}\nthe"),
            h4("for w in words: counts[w] = counts.get(w, 0) + 1 로 세고, max(counts, key=counts.get)으로 the를 찾습니다."),
        ],
    },
}
