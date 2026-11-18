from _lib import h1, h2, h3, h4

UNIT = {
    "unit_id": "F-P7",
    "kind": "python",
    "title_ko": "문자열, 파일, 바이트",
    "goal_ko": "문자열을 줄로 나누고(splitlines) 합치고(join), set으로 중복을 없애고, 파일을 쓰고 읽고, ord와 chr로 글자와 번호를 오가고, encode로 글자를 바이트(컴퓨터가 저장하는 0~255 숫자)로 바꾼다.",
    "analogy_ko": "글자는 사람이 읽는 모양이고, 바이트는 창고에 넣을 때 쓰는 상자 번호입니다. 영어 한 글자는 상자 하나, 한글 한 글자는 상자 세 개에 나눠 담깁니다.",
    "card_ko": [
        "문자열은 따옴표로 감싼 글자들의 줄입니다. 리스트처럼 번호로 꺼내고 자를 수 있습니다.",
        "\\n은 '줄 바꿈' 표시 한 글자입니다. text.splitlines()는 줄 바꿈마다 잘라 문자열들의 리스트를 줍니다.",
        "\"-\".join(리스트)는 리스트의 글자들 사이에 - 를 끼워 하나로 합칩니다. \"\".join(리스트)이면 그냥 이어 붙입니다.",
        "set(...)은 중복을 없앤 모음입니다. 순서가 정해져 있지 않아서 sorted(set(...))처럼 줄을 세워 씁니다.",
        "파일은 with open(이름, \"w\") as f: 로 열어 f.write(글)로 쓰고, open(이름).read()로 전부 읽습니다. with를 쓰면 다 쓴 뒤 파일을 알아서 닫습니다.",
        "컴퓨터는 글자를 번호로 저장합니다. ord(\"A\")는 글자의 번호 65, chr(65)는 번호 65의 글자 A입니다.",
        "\"가\".encode(\"utf-8\")은 글자를 바이트(0~255 사이 숫자)로 바꿉니다. UTF-8(가장 널리 쓰는 글자 저장 규칙)에서 영어 한 글자는 1바이트, 한글 한 글자는 3바이트입니다.",
        "9편 토크나이저(글을 숫자 조각으로 바꾸는 장치)는 이 바이트에서 출발합니다.",
    ],
    "needed_by": ["L02", "L07", "L09"],
    "steps": [
        {
            "title_ko": "파일에 쓰고 읽어 줄로 나누기",
            "input_ko": "새 노트북의 첫 셀에 다섯 줄을 칩니다. 둘째 줄만 들여 씁니다. 파일은 Colab이면 임시 폴더(연결이 끊기면 지워짐)에 생깁니다.",
            "code": r'''
with open("names.txt", "w") as f:
    f.write("emma\nolivia\nava")
words = open("names.txt").read().splitlines()
print(words)
print("-".join(words))
''',
            "notes": [
                "names.txt라는 파일을 쓰기(\"w\") 모드로 열어 f라고 부릅니다. 들여 쓴 줄이 끝나면 파일이 알아서 닫힙니다.",
                "이름 세 개를 줄 바꿈(\\n)으로 이어 파일에 적습니다.",
                "파일을 열어(open) 전부 읽고(read) 줄마다 잘라(splitlines) 리스트로 만듭니다. 2편 첫 셀과 같은 꼴입니다.",
                "리스트를 보여 줍니다.",
                "리스트를 - 로 이어 붙인 한 줄 글을 보여 줍니다.",
            ],
            "expected_ko": "['emma', 'olivia', 'ava'] 와 emma-olivia-ava 가 나옵니다. Colab은 왼쪽 폴더 그림에서 names.txt가 보입니다.",
            "expected_output": "['emma', 'olivia', 'ava']\nemma-olivia-ava",
            "meaning_ko": "파일 하나를 이름 목록(리스트)으로 바꾸고, 다시 한 줄로 합쳤습니다. 2편은 3만 개가 넘는 이름이 든 names.txt를 이 한 줄로 읽으며 시작합니다.",
            "hints": [
                h1("이름이 셋으로 나뉘지 않고 ['emma/nolivia/nava'] 처럼 한 덩어리로 나오나요? 둘째 줄에서 \\n 대신 /n 을 치지 않았는지 보세요."),
                h2("줄 바꿈은 역슬래시(\\)와 n입니다. 한국어 자판에서는 원화 기호(₩) 자리에 있고, 한글 입력 상태로 치면 ₩가 찍혀 줄 바꿈이 되지 않으니 영어 입력으로 바꿔 칩니다. splitlines는 이 표시마다 자릅니다(설명 카드 2번째 문장).", unit="F-P7", card=2),
            ],
        },
        {
            "title_ko": "중복 없는 글자 목록과 글자 번호표",
            "input_ko": "새 셀에 네 줄을 칩니다.",
            "code": r'''
chars = sorted(set("banana"))
print(chars)
stoi = {ch: i for i, ch in enumerate(chars)}
print(stoi)
''',
            "notes": [
                "banana의 글자에서 중복을 없애고(set) 가나다(abc) 순으로 줄 세운(sorted) 리스트를 만듭니다.",
                "중복 없는 글자 목록을 보여 줍니다.",
                "글자마다 번호를 붙인 사전을 한 줄로 만듭니다. enumerate가 번호 i와 글자 ch를 짝으로 줍니다(F-P3). stoi는 string to integer, 즉 '글자 → 번호'의 줄임말입니다.",
                "글자 번호표를 보여 줍니다.",
            ],
            "expected_ko": "['a', 'b', 'n'] 과 {'a': 0, 'b': 1, 'n': 2} 가 나옵니다.",
            "expected_output": "['a', 'b', 'n']\n{'a': 0, 'b': 1, 'n': 2}",
            "meaning_ko": "글이 어떤 글자들로 이루어졌는지 뽑고, 글자마다 번호를 붙였습니다. 신경망은 글자를 직접 못 다루고 번호만 다루기 때문에, 2편과 7편 모두 이 번호표(stoi)를 맨 먼저 만듭니다.",
            "hints": [
                h1("['b', 'a', 'n'] 처럼 순서가 섞여 나오나요? set 바깥을 sorted( )로 감쌌는지 보세요."),
                h2("set은 순서가 없어서 sorted로 줄을 세워야 늘 같은 순서가 됩니다(설명 카드 4번째 문장). 순서가 같아야 번호표도 매번 같습니다.", unit="F-P7", card=4),
            ],
        },
        {
            "title_ko": "글자를 번호와 바이트로 바꾸기",
            "input_ko": "새 셀에 네 줄을 칩니다.",
            "code": r'''
print(ord("A"), chr(65))
b = "가".encode("utf-8")
print(list(b))
print(len(b), len("가"))
''',
            "notes": [
                "A의 번호와, 번호 65의 글자를 함께 보여 줍니다.",
                "한글 '가'를 UTF-8 규칙으로 바이트로 바꿔 b에 넣습니다.",
                "바이트를 0~255 숫자 리스트로 펼쳐 보여 줍니다.",
                "바이트 개수와 글자 개수를 나란히 보여 줍니다.",
            ],
            "expected_ko": "65 A, [234, 176, 128], 3 1 이 나옵니다. '가' 한 글자가 바이트 3개(234, 176, 128)입니다.",
            "expected_output": "65 A\n[234, 176, 128]\n3 1",
            "meaning_ko": "같은 '가' 한 글자가 컴퓨터 안에서는 숫자 3개입니다. 9편은 이 바이트 숫자들 가운데 자주 붙어 나오는 것끼리 묶어 토큰(글 조각)을 만드는 이야기입니다.",
            "hints": [
                h1("b'\\xea\\xb0\\x80' 같은 글이 보이나요? 그것은 print(b)를 했을 때의 모습입니다. list(b)로 감쌌는지 보세요."),
                h2("바이트를 그대로 보여 주면 16진수 표기(\\xea)로 나옵니다. list()로 감싸면 0~255 숫자로 보입니다(설명 카드 7번째 문장).", unit="F-P7", card=7),
            ],
        },
    ],
    "questions": [
        {
            "type": "predict",
            "prompt_ko": "아래 코드를 실행하면 무엇이 나올까요? 숫자만 쓰세요.",
            "code": r'''
print(len(set("hello")))
''',
            "auto_grade": {"type": "exact", "value": "4"},
            "answer_ko": "4입니다. hello의 글자는 h, e, l, l, o 다섯 개지만, set이 중복된 l을 하나로 줄여 h, e, l, o 네 개가 남습니다.",
            "rubric": [{"point": 1, "criterion_ko": "4"}],
            "hints": [
                h1("hello에서 두 번 나오는 글자는 무엇인가요? set은 그것을 어떻게 하나요?"),
                h2("설명 카드 4번째 문장: set은 중복을 없앤 모음입니다.", unit="F-P7", card=4),
                h3("빈칸을 채워 중복 없는 글자를 직접 보세요.", code=r'''
print(sorted(set("hello")))
print(len(___("hello")))
''', blanks=["set"], out="['e', 'h', 'l', 'o']\n4"),
                h4("정답은 4입니다. 남는 글자는 e, h, l, o입니다."),
            ],
        },
        {
            "type": "choice",
            "prompt_ko": "text = \"a\\nb\\nc\" 일 때 text.splitlines()가 돌려주는 것은 무엇일까요? (\\n은 줄 바꿈 표시입니다.)",
            "choices": [
                "['a', 'b', 'c'] (문자열들의 리스트)",
                "'abc' (이어 붙인 문자열 하나)",
                "3 (줄의 개수)",
                "['a\\nb\\nc'] (원래 글 하나가 든 리스트)",
            ],
            "answer_index": 0,
            "answer_ko": "['a', 'b', 'c']입니다. splitlines는 줄 바꿈마다 잘라 문자열들의 리스트를 줍니다. 개수가 필요하면 len(...)을 한 번 더 씌웁니다.",
            "rubric": [{"point": 1, "criterion_ko": "['a', 'b', 'c']를 고름"}],
            "verify_code": r'''
text = "a\nb\nc"
print(text.splitlines())
''',
            "verify_output": "['a', 'b', 'c']",
            "hints": [
                h1("F-P7-S1에서 splitlines 뒤 print(words)는 어떤 모양이었나요?"),
                h2("설명 카드 2번째 문장: 줄 바꿈마다 잘라 문자열들의 리스트를 줍니다.", unit="F-P7", card=2),
                h3("빈칸을 채워 실행해 보세요.", code=r'''
text = "a\nb\nc"
print(text.___())
''', blanks=["splitlines"], out="['a', 'b', 'c']"),
                h4("정답은 ['a', 'b', 'c'] (문자열들의 리스트)입니다."),
            ],
        },
        {
            "type": "explain",
            "prompt_ko": "글자와 바이트의 차이를 한두 문장으로 써 보세요. 한글 예를 하나 넣으세요.",
            "code": None,
            "auto_grade": {"type": "manual"},
            "answer_ko": "글자는 사람이 보는 모양이고, 바이트는 컴퓨터가 글자를 저장할 때 쓰는 0~255 사이 숫자입니다. 영어 A는 1바이트지만 한글 '가'는 3바이트(234, 176, 128)처럼, 한 글자가 여러 바이트일 수 있습니다.",
            "rubric": [
                {"point": 0.4, "criterion_ko": "글자는 사람이 보는 모양이라고 씀"},
                {"point": 0.3, "criterion_ko": "바이트는 저장용 숫자(0~255)라고 씀"},
                {"point": 0.3, "criterion_ko": "한 글자가 여러 바이트일 수 있다는 한글 예"},
            ],
            "hints": [
                h1("F-P7-S3에서 len(\"가\")와 len(\"가\".encode(\"utf-8\"))는 각각 얼마였나요?"),
                h2("설명 카드 6, 7번째 문장을 읽고 '보이는 것'과 '저장되는 것'으로 나눠 써 보세요.", unit="F-P7", card=7),
                h3("주석의 빈칸을 예상해 채운 뒤 실행해 확인하세요.", code=r'''
print(len("A".encode("utf-8")))
print(len("가".encode("utf-8")))
print(len("안녕".encode("utf-8")))   # 예상: ___
''', blanks=["6"], out="1\n3\n6"),
                h4("예시 답: '글자는 화면에 보이는 모양이고 바이트는 저장할 때 쓰는 0~255 숫자입니다. A는 1바이트, 가는 3바이트, 안녕은 6바이트입니다.'"),
            ],
        },
    ],
    "rebuild": {
        "title_ko": "파일에서 글자 목록 뽑기",
        "prompt_ko": "빈 셀에서 만드세요. 파일 pets.txt에 cat, dog, cow를 한 줄에 하나씩 쓰고, 다시 읽어 이름 리스트로 만든 뒤, 모든 이름에 쓰인 글자를 중복 없이 abc 순으로 보여 주세요.",
        "solution_code": r'''
with open("pets.txt", "w") as f:
    f.write("cat\ndog\ncow")
words = open("pets.txt").read().splitlines()
print(words)
print(sorted(set("".join(words))))
''',
        "solution_notes": [
            "pets.txt를 쓰기 모드로 엽니다.",
            "이름 셋을 줄 바꿈으로 이어 적습니다.",
            "파일을 읽어 줄마다 잘라 리스트로 만듭니다.",
            "이름 리스트를 보여 줍니다.",
            "이름들을 하나로 이어 붙인 뒤(join) 중복을 없애고(set) 줄 세워(sorted) 보여 줍니다.",
        ],
        "expected_output": "['cat', 'dog', 'cow']\n['a', 'c', 'd', 'g', 'o', 't', 'w']",
        "self_check_ko": [
            "\\n으로 줄을 나눠 썼고 splitlines로 다시 나눴다",
            "\"\".join으로 이름들을 이어 붙인 뒤 set을 썼다",
            "이 마지막 줄이 2편의 글자 목록 만들기(chars)와 같은 꼴임을 알아챘다",
        ],
        "hints": [
            h1("F-P7-S1(파일 쓰고 읽기)과 F-P7-S2(중복 없는 글자 목록)를 어떻게 이으면 될까요?"),
            h2("리스트를 글자 하나로 합치려면 \"\".join(리스트)를 씁니다(설명 카드 3번째 문장). 그다음 sorted(set(...))입니다.", unit="F-P7", card=3),
            h3("빈칸을 채우세요.", code=r'''
with open("pets.txt", "w") as f:
    f.write("cat\ndog\ncow")
words = open("pets.txt").read().___()
print(words)
print(sorted(set("".___(words))))
''', blanks=["splitlines", "join"], out="['cat', 'dog', 'cow']\n['a', 'c', 'd', 'g', 'o', 't', 'w']"),
            h4("파일을 쓰고, open(\"pets.txt\").read().splitlines()로 읽고, sorted(set(\"\".join(words)))를 보여 줍니다."),
        ],
    },
}
