from _lib import h1, h2, h3, h4

UNIT = {
    "unit_id": "F-P9",
    "kind": "python",
    "title_ko": "텐서 첫걸음",
    "goal_ko": "torch.tensor로 숫자 표를 만들고, .shape(가로세로 크기)와 dtype(숫자 종류)을 읽고, t[행, 열]로 꺼내고, sum(dim, keepdim=True)로 한 방향으로 더하고, 브로드캐스팅(작은 표를 자동으로 늘려 계산하기)과 view(모양 바꾸기)를 쓴다.",
    "analogy_ko": "텐서는 엑셀 표입니다. dim 0은 위아래 방향(행끼리), dim 1은 옆 방향(열끼리)입니다. 'dim 0으로 더하기'는 표의 세로줄마다 맨 아래에 합계를 내는 것입니다.",
    "card_ko": [
        "텐서는 숫자를 표 모양으로 담는 PyTorch(신경망을 만드는 파이썬 도구)의 상자입니다. import torch로 불러옵니다.",
        ".shape는 표의 크기입니다. torch.Size([2, 3])은 2행(가로줄 2개) 3열(세로줄 3개)입니다.",
        "dtype은 숫자 종류입니다. 1, 2처럼 쓰면 정수(int64), 1., 2.처럼 점을 찍으면 소수(float32)가 됩니다.",
        "t[1, 2]는 1번 행, 2번 열의 값입니다. 리스트처럼 0부터 셉니다.",
        "t.sum(0)은 dim 0 방향(위아래)으로 더해 행이 사라지고, t.sum(1)은 옆으로 더해 열이 사라집니다. keepdim=True를 주면 사라질 자리를 크기 1로 남깁니다.",
        "브로드캐스팅은 모양이 다른 두 표를 계산할 때, 크기가 1인 쪽을 자동으로 늘려 맞추는 규칙입니다. (2, 3) 표를 (2, 1) 표로 나누면 행마다 그 행의 값 하나로 나눕니다.",
        ".view(3, 2)는 숫자는 그대로 두고 모양만 바꿉니다. -1을 쓰면 '나머지는 알아서 맞춰'라는 뜻입니다.",
    ],
    "needed_by": ["L02", "L03", "L04", "L05", "L06", "L07", "L10"],
    "steps": [
        {
            "title_ko": "숫자 표 만들고 모양 읽기",
            "input_ko": "새 노트북의 첫 셀에 다섯 줄을 칩니다. 대괄호가 두 겹([[...], [...]])이라 짝을 잘 맞춥니다.",
            "code": r'''
import torch
t = torch.tensor([[1, 2, 3], [4, 5, 6]])
print(t)
print(t.shape, t.dtype)
print(t[1, 2])
''',
            "notes": [
                "신경망 도구 torch를 불러옵니다(Colab에는 이미 깔려 있고, 맥미니 Jupyter는 준비된 환경 전제).",
                "두 줄짜리 리스트로 2행 3열 텐서를 만듭니다. 안쪽 대괄호 하나가 행 하나입니다.",
                "텐서를 표 모양으로 보여 줍니다.",
                "모양과 숫자 종류를 보여 줍니다.",
                "1번 행(둘째 줄), 2번 열(셋째 칸)의 값을 꺼냅니다.",
            ],
            "expected_ko": "표 모양의 tensor([[1, 2, 3], [4, 5, 6]]) (두 줄로 보임), torch.Size([2, 3]) torch.int64, tensor(6) 이 나옵니다.",
            "expected_output": "tensor([[1, 2, 3],\n        [4, 5, 6]])\ntorch.Size([2, 3]) torch.int64\ntensor(6)",
            "meaning_ko": "모양(shape)은 텐서를 읽는 첫 단서입니다. 3편부터 '보여야 하는 것'에 모양을 늘 적는 이유입니다. 꺼낸 값도 tensor(6)처럼 텐서로 나옵니다.",
            "hints": [
                h1("ModuleNotFoundError: No module named 'torch' 가 나오나요? 코드가 아니라 환경 문제입니다. 맥미니 Jupyter라면 torch가 깔린 환경(커널)을 골랐는지 보세요."),
                h2("직접 설치하지 말고 HELP 메모로 남기세요. 환경 문제는 점수에서 빠집니다(F-P8 설명 카드 8번째 문장). 모양 읽기는 이 단위 설명 카드 2번째 문장입니다.", unit="F-P9", card=2),
            ],
        },
        {
            "title_ko": "한 방향으로 더하기와 keepdim",
            "input_ko": "새 셀에 네 줄을 칩니다. 위 셀의 t를 씁니다.",
            "code": r'''
print(t.sum(0))
print(t.sum(1))
print(t.sum(1, keepdim=True))
print(t.sum(1, keepdim=True).shape)
''',
            "notes": [
                "위아래(dim 0)로 더합니다. 1+4, 2+5, 3+6.",
                "옆으로(dim 1) 더합니다. 1+2+3, 4+5+6.",
                "옆으로 더하되 모양을 세로 한 줄(2행 1열)로 남깁니다.",
                "그 모양을 보여 줍니다.",
            ],
            "expected_ko": "tensor([5, 7, 9]), tensor([ 6, 15]), 세로로 6과 15가 든 표, torch.Size([2, 1]) 이 나옵니다.",
            "expected_output": "tensor([5, 7, 9])\ntensor([ 6, 15])\ntensor([[ 6],\n        [15]])\ntorch.Size([2, 1])",
            "meaning_ko": "sum의 숫자는 '어느 방향을 없애며 더할지'입니다. keepdim=True는 없앤 자리를 크기 1로 남겨서, 다음 단계에서 원래 표와 줄을 맞춰 계산할 수 있게 합니다.",
            "hints": [
                h1("결과가 [6, 15]가 아니라 [5, 7, 9]처럼 나오나요? 괄호 안 숫자 0과 1을 바꿔 쓰지 않았는지 보세요."),
                h2("dim 0은 위아래(행이 사라짐), dim 1은 옆(열이 사라짐)입니다(설명 카드 5번째 문장).", unit="F-P9", card=5),
            ],
        },
        {
            "title_ko": "행마다 나누기와 모양 바꾸기",
            "input_ko": "새 셀에 다섯 줄을 칩니다.",
            "code": r'''
p = t / t.sum(1, keepdim=True)
print(p)
print(p.sum(1))
print(t.view(3, 2))
print(t.view(-1))
''',
            "notes": [
                "(2, 3) 표를 행 합계 (2, 1) 표로 나눕니다. 브로드캐스팅으로 행마다 그 행의 합으로 나눕니다.",
                "나눈 표를 보여 줍니다.",
                "행마다 합을 보여 줍니다. 모두 1이어야 합니다.",
                "같은 숫자 6개를 3행 2열로 바꿔 보여 줍니다.",
                "-1은 '알아서'라서 한 줄로 펼쳐 보여 줍니다.",
            ],
            "expected_ko": "행마다 합이 1인 표 [[0.1667, 0.3333, 0.5000], [0.2667, 0.3333, 0.4000]], 행 합 tensor([1., 1.])(컴퓨터에 따라 tensor([1.0000, 1.0000])처럼 보여도 같은 뜻), 3행 2열 표 [[1, 2], [3, 4], [5, 6]], 한 줄 tensor([1, 2, 3, 4, 5, 6]) 이 나옵니다.",
            "expected_output": "tensor([[0.1667, 0.3333, 0.5000],\n        [0.2667, 0.3333, 0.4000]])\ntensor([1., 1.])\ntensor([[1, 2],\n        [3, 4],\n        [5, 6]])\ntensor([1, 2, 3, 4, 5, 6])",
            "check": {"type": "value_range", "checks": [{"expr": "p.sum(1).min().item()", "min": 0.9999, "max": 1.0001}, {"expr": "p.sum(1).max().item()", "min": 0.9999, "max": 1.0001}, {"expr": "p[0, 0].item()", "min": 0.1666, "max": 0.1667}, {"expr": "t.view(3, 2).shape[0]", "min": 3, "max": 3}, {"expr": "t.view(-1).shape[0]", "min": 6, "max": 6}]},
            "meaning_ko": "개수 표를 행마다 합이 1인 확률 표로 바꿨습니다. 2편의 핵심 한 줄이 바로 이것입니다. view는 3편에서 글자 묶음을 한 줄로 펼칠 때 씁니다.",
            "hints": [
                h1("행 합계가 1이 아닌가요? 첫 줄에 keepdim=True를 넣었는지 보세요."),
                h2("keepdim=True가 있어야 합계가 (2, 1) 모양이 되어 행마다 나뉩니다. 없으면 (2,) 모양이 되어 엉뚱한 방향으로 나뉩니다(설명 카드 5, 6번째 문장).", unit="F-P9", card=6),
            ],
        },
    ],
    "questions": [
        {
            "type": "predict",
            "prompt_ko": "아래 코드를 실행하면 무엇이 나올까요? 화면에 보일 모양 그대로 쓰세요. (torch.zeros(4, 3)은 0으로 채운 4행 3열 표입니다.)",
            "code": r'''
import torch
print(torch.zeros(4, 3).sum(0).shape)
''',
            "auto_grade": {"type": "exact", "value": "torch.Size([3])", "accept": ["[3]", "(3,)", "(3)", "3"]},
            "answer_ko": "torch.Size([3])입니다. dim 0(위아래)으로 더하면 행 4개가 하나로 합쳐져 사라지고, 열 3개만 남습니다.",
            "rubric": [{"point": 1, "criterion_ko": "torch.Size([3]) (또는 [3], (3,))"}],
            "hints": [
                h1("4행 3열 표를 위아래로 더하면 몇 칸짜리가 남을까요?"),
                h2("설명 카드 5번째 문장: sum(0)은 행이 사라집니다.", unit="F-P9", card=5),
                h3("빈칸을 채워 두 방향을 비교하세요.", code=r'''
import torch
print(torch.zeros(4, 3).sum(___).shape)
print(torch.zeros(4, 3).sum(1).shape)
''', blanks=["0"], out="torch.Size([3])\ntorch.Size([4])"),
                h4("정답은 torch.Size([3])입니다. sum(1)이었다면 torch.Size([4])입니다."),
            ],
        },
        {
            "type": "choice",
            "prompt_ko": "27행 27열 개수 표 N이 있습니다. 각 행을 그 행의 합으로 나눠, 행마다 합이 1이 되게 하려면 어떻게 써야 할까요?",
            "choices": [
                "N / N.sum(1, keepdim=True)",
                "N / N.sum(1)",
                "N / N.sum(0)",
                "N / N.sum()",
            ],
            "answer_index": 0,
            "answer_ko": "N / N.sum(1, keepdim=True)입니다. keepdim=True면 합계가 (27, 1) 모양이라 행마다 나뉩니다. N.sum(1)은 (27,) 모양이라 브로드캐스팅이 이를 가로 한 줄 (1, 27)처럼 늘려 열마다 나눠 버립니다. 에러 없이 틀린 결과가 나와서 2편에서 가장 찾기 어려운 버그로 나옵니다.",
            "rubric": [{"point": 1, "criterion_ko": "N / N.sum(1, keepdim=True)를 고름"}],
            "verify_code": r'''
import torch
N = torch.arange(1, 10).view(3, 3).float()
print((N / N.sum(1, keepdim=True)).sum(1))
print((N / N.sum(1)).sum(1))
''',
            "verify_output": "tensor([1., 1., 1.])\ntensor([0.4250, 1.2500, 2.0750])",
            "hints": [
                h1("F-P9-S3 첫 줄에서 행마다 나눌 때 무엇을 넣었나요?"),
                h2("설명 카드 5, 6번째 문장: keepdim=True면 (행 수, 1) 모양이 남아 행마다 나뉩니다.", unit="F-P9", card=6),
                h3("작은 3행 3열 표로 두 방법을 비교합니다. 빈칸을 채워 실행하고 어느 쪽이 행마다 합 1인지 보세요.", code=r'''
import torch
N = torch.arange(1, 10).view(3, 3).float()
print((N / N.sum(1, keepdim=___)).sum(1))
print((N / N.sum(1)).sum(1))
''', blanks=["True"], out="tensor([1., 1., 1.])\ntensor([0.4250, 1.2500, 2.0750])"),
                h4("정답은 N / N.sum(1, keepdim=True)입니다. keepdim이 없으면 행 합이 [0.4250, 1.2500, 2.0750]처럼 1이 되지 않습니다."),
            ],
        },
        {
            "type": "predict",
            "prompt_ko": "torch.arange(12)는 0부터 11까지 12개 숫자가 한 줄로 든 텐서입니다. 아래 코드를 실행하면 무엇이 나올까요? 화면에 보일 모양 그대로 쓰세요.",
            "code": r'''
import torch
print(torch.arange(12).view(3, -1).shape)
''',
            "auto_grade": {"type": "exact", "value": "torch.Size([3, 4])", "accept": ["[3, 4]", "(3, 4)", "(3,4)", "3, 4"]},
            "answer_ko": "torch.Size([3, 4])입니다. 숫자 12개를 3행으로 나누면 한 행에 4개입니다. -1은 '나머지는 알아서'라서 4로 채워집니다.",
            "rubric": [{"point": 1, "criterion_ko": "torch.Size([3, 4]) (또는 (3, 4))"}],
            "hints": [
                h1("숫자 12개를 3줄로 나누면 한 줄에 몇 개인가요?"),
                h2("설명 카드 7번째 문장: -1은 '나머지는 알아서 맞춰'입니다.", unit="F-P9", card=7),
                h3("빈칸을 채워 실행하세요. -1을 쓴 것과 같은 결과인지 보세요.", code=r'''
import torch
print(torch.arange(12).view(3, ___).shape)
''', blanks=["4"], out="torch.Size([3, 4])"),
                h4("정답은 torch.Size([3, 4])입니다. 12 / 3 = 4."),
            ],
        },
    ],
    "rebuild": {
        "title_ko": "작은 개수 표를 확률 표로",
        "prompt_ko": "빈 셀에서 만드세요. 2행 2열 텐서 [[1, 3], [2, 2]]를 소수로 만들고(1., 3.처럼 점을 찍기), 행마다 합이 1이 되게 나눈 표와 그 모양을 보여 주세요.",
        "solution_code": r'''
import torch
c = torch.tensor([[1., 3.], [2., 2.]])
p = c / c.sum(1, keepdim=True)
print(p)
print(p.shape)
''',
        "solution_notes": [
            "torch를 불러옵니다.",
            "소수로 2행 2열 개수 표를 만듭니다.",
            "행마다 그 행의 합으로 나눕니다.",
            "확률 표를 보여 줍니다.",
            "모양을 보여 줍니다.",
        ],
        "expected_output": "tensor([[0.2500, 0.7500],\n        [0.5000, 0.5000]])\ntorch.Size([2, 2])",
        "self_check_ko": [
            "keepdim=True를 넣었다",
            "첫 행 [0.25, 0.75]의 뜻(1 대 3)을 말할 수 있다",
            "나눈 뒤에도 모양이 (2, 2)로 그대로라는 것을 확인했다",
        ],
        "hints": [
            h1("F-P9-S3의 첫 줄에서 t만 무엇으로 바꾸면 될까요?"),
            h2("행마다 나누기는 c / c.sum(1, keepdim=True)입니다(설명 카드 5, 6번째 문장).", unit="F-P9", card=5),
            h3("빈칸을 채우세요.", code=r'''
import torch
c = torch.tensor([[1., 3.], [2., 2.]])
p = c / c.sum(___, keepdim=True)
print(p)
print(p.___)
''', blanks=["1", "shape"], out="tensor([[0.2500, 0.7500],\n        [0.5000, 0.5000]])\ntorch.Size([2, 2])"),
            h4("p = c / c.sum(1, keepdim=True), 그리고 print(p), print(p.shape). 첫 행은 [0.25, 0.75], 둘째 행은 [0.5, 0.5]입니다."),
        ],
    },
}
