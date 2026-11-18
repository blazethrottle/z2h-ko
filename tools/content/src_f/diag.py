# 기초 탭 첫 화면 안내, 시작 전 진단 5문제, 추천 규칙 (설계서 2-3, 2-4)

INTRO_KO = [
    "사전 기초는 강의를 따라가는 데 필요한 파이썬과 수학을 15개의 작은 단위로 나눈 것입니다. 단위 하나는 40~60분쯤 걸립니다(추정, 실측 아님). 15단위를 모두 하면 약 13시간입니다.",
    "먼저 진단 5문제를 풀어 보세요. 결과는 '먼저 보면 좋은 단위'를 추천할 뿐이고, 아무것도 잠그지 않습니다. 모르는 문제는 '모르겠어요'를 고르면 됩니다. 감점이 없습니다.",
    "단위마다 설명 카드를 읽고, 실습을 맥미니 Jupyter나 Colab(구글이 주는 무료 파이썬 실행 화면) 중 내가 고른 길에서 직접 쳐서 돌리고, 확인 문제 3개를 풉니다. 마지막 익힘 과제는 빈 셀에서 혼자 다시 만들어 보는 연습입니다.",
    "단위마다 새 노트북을 하나 만드는 것을 권합니다. 앞 단위에서 만든 값이 섞이지 않아 결과가 이 화면과 똑같이 나옵니다.",
    "코드는 눈으로 보지 말고 직접 치세요. 복사해 붙이면 빠르지만, 손으로 쳐 봐야 오타와 에러를 만나고 고치는 힘이 생깁니다.",
    "처음이라면 F-P1(노트북 다루기, 내가 고른 길로)과 F-P8(에러 읽기)부터 보세요. 실습과 문제만 하면 1시간 반쯤, 익힘 과제까지 하면 2시간쯤입니다(추정).",
]

DIAGNOSTIC_INFO = {
    "question_ids": ["F-D1", "F-D2", "F-D3", "F-D4", "F-D5"],
    "hints": False,
    "locks_anything": False,
    "rules_ko": [
        "힌트가 없습니다.",
        "모든 문제에서 '모르겠어요'를 고를 수 있고 감점이 없습니다. 오답으로 기록해 추천에만 씁니다.",
        "결과는 추천만 합니다. 강의와 기초 단위는 모두 열려 있습니다.",
    ],
    "result_if_correct_ko": "이 부분은 바로 가도 좋아요.",
    "result_if_wrong_ko": "아래 단위를 1편 전에 보면 좋아요.",
}

RECOMMEND_RULES = [
    {
        "rule_id": "always_first",
        "units": ["F-P1", "F-P8"],
        "label_ko": "처음이면 먼저",
        "when_ko": "진단 결과와 상관없이 늘 표시합니다. F-P1은 내가 고른 길(맥미니 Jupyter 또는 Colab)로 합니다.",
    },
    {
        "rule_id": "diagnostic",
        "units_from": "questions[].recommend_units_if_wrong",
        "label_ko": "1편 전에 보기",
        "when_ko": "진단에서 틀리거나 '모르겠어요'를 고른 문제의 추천 단위를 표시합니다.",
    },
    {
        "rule_id": "lecture_start",
        "units_from": "lecture.lecture_prereq_units[편 id]",
        "label_ko": "이 편 전에 보면 좋아요",
        "when_ko": "각 편 시작 화면에서, 그 편의 선행 기초 중 아직 mastered가 아닌 단위를 다시 보여 줍니다. 진단에서 재지 않는 F-P5, F-P7, F-M5는 이 방법으로만 추천됩니다.",
    },
    {
        "rule_id": "stuck",
        "units_from": "hints[level=2].points_to.unit_id",
        "label_ko": "막혔을 때",
        "when_ko": "단계나 문제의 2단계 힌트가 해당 기초 단위를 바로 연결합니다.",
    },
]

DIAG = [
    {
        "id": "F-D1",
        "type": "choice",
        "measures_ko": "리스트와 0부터 세기",
        "prompt_ko": "아래 코드를 실행하면 무엇이 출력될까요?",
        "code": r'''
names = ["mina", "joon", "sua", "hyun"]
print(names[2])
''',
        "choices": ["joon", "sua", "hyun", "모르겠어요"],
        "answer_index": 1,
        "answer_ko": "sua입니다. 파이썬은 자리 번호를 0부터 셉니다. mina가 0번, joon이 1번, sua가 2번입니다.",
        "rubric": [{"point": 1, "criterion_ko": "sua를 고름"}],
        "recommend": ["F-P2", "F-P3"],
        "verify_code": r'''
names = ["mina", "joon", "sua", "hyun"]
print(names[2])
''',
        "verify_output": "sua",
    },
    {
        "id": "F-D2",
        "type": "choice",
        "measures_ko": "클래스와 메서드 읽기",
        "prompt_ko": "아래 코드를 실행하면 마지막에 무엇이 출력될까요?",
        "code": r'''
class Counter:
    def __init__(self, start):
        self.n = start
    def up(self):
        self.n = self.n + 1
c = Counter(5)
c.up()
c.up()
print(c.n)
''',
        "choices": ["5", "6", "7", "모르겠어요"],
        "answer_index": 2,
        "answer_ko": "7입니다. Counter(5)로 n이 5인 상자를 만들고, up()을 부를 때마다 n에 1을 더합니다. 두 번 불렀으니 7입니다.",
        "rubric": [{"point": 1, "criterion_ko": "7을 고름"}],
        "recommend": ["F-P4", "F-P6"],
        "verify_code": r'''
class Counter:
    def __init__(self, start):
        self.n = start
    def up(self):
        self.n = self.n + 1
c = Counter(5)
c.up()
c.up()
print(c.n)
''',
        "verify_output": "7",
    },
    {
        "id": "F-D3",
        "type": "predict",
        "measures_ko": "변화율과 연쇄법칙",
        "prompt_ko": "a를 1만큼 늘리면 b가 3만큼 늘어나고, b를 1만큼 늘리면 y가 2만큼 늘어납니다. a를 아주 조금 늘리면, y는 a가 늘어난 양의 몇 배만큼 늘어날까요? 숫자만 쓰세요.",
        "code": None,
        "auto_grade": {"type": "exact", "value": "6", "accept": ["6.0", "6배"]},
        "answer_ko": "6입니다. a가 조금 늘면 b는 그 3배만큼 늘고, b가 는 만큼의 2배로 y가 늡니다. 3 x 2 = 6배입니다. 이어진 계산의 변화율은 곱한다는 것이 연쇄법칙입니다.",
        "rubric": [{"point": 1, "criterion_ko": "6(또는 6.0)"}],
        "recommend": ["F-M1", "F-M2"],
        "verify_code": r'''
def b_of(a):
    return 3 * a
def y_of(b):
    return 2 * b
h = 0.001
print(round((y_of(b_of(1 + h)) - y_of(b_of(1))) / h))
''',
        "verify_output": "6",
    },
    {
        "id": "F-D4",
        "type": "choice",
        "measures_ko": "개수를 확률로 바꾸기",
        "prompt_ko": "어떤 글자 바로 뒤에 x가 5번, y가 3번, z가 2번 왔습니다. 이 기록대로라면 그 글자 뒤에 y가 올 확률은 얼마일까요?",
        "code": None,
        "choices": ["0.3", "0.5", "3", "모르겠어요"],
        "answer_index": 0,
        "answer_ko": "0.3입니다. 모두 5 + 3 + 2 = 10번 중 y가 3번이니 3 / 10 = 0.3입니다. 개수를 전체 합으로 나누면 확률이 됩니다.",
        "rubric": [{"point": 1, "criterion_ko": "0.3을 고름"}],
        "recommend": ["F-M4", "F-M3"],
        "verify_code": r'''
counts = [5, 3, 2]
print(counts[1] / sum(counts))
''',
        "verify_output": "0.3",
    },
    {
        "id": "F-D5",
        "type": "choice",
        "measures_ko": "행렬곱의 모양",
        "prompt_ko": "모양이 (32, 3)인 숫자 표와 (3, 10)인 숫자 표를 행렬곱(@)하면 결과의 모양은 무엇일까요?",
        "code": None,
        "choices": ["(32, 10)", "(3, 3)", "(32, 3, 10)", "모르겠어요"],
        "answer_index": 0,
        "answer_ko": "(32, 10)입니다. 행렬곱은 앞 표의 뒤 숫자(3)와 뒤 표의 앞 숫자(3)가 같아야 하고, 결과는 바깥 두 숫자 (32, 10)이 됩니다.",
        "rubric": [{"point": 1, "criterion_ko": "(32, 10)을 고름"}],
        "recommend": ["F-M6", "F-P9"],
        "verify_code": r'''
import torch
print(tuple((torch.ones(32, 3) @ torch.ones(3, 10)).shape))
''',
        "verify_output": "(32, 10)",
    },
]
