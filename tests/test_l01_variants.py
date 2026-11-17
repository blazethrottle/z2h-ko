"""단계 채점 칸이 실제로 틀린 구현을 잡는지: 정본 정답 코드(정답 노트북 본문 셀)를 글자 치환으로 한 곳씩 틀리게 바꾸고
본문 전체를 파이썬 안에서 다시 돌려, 그 버그를 가르치는 단계의 칸이 "✕ 다시"인지 본다.

- 치환이 정답 셀에 실제로 적용됐는지(바꾼 곳 수 > 0) 먼저 단언한다.
- UNCAUGHT: 어떤 단계 칸도 잡지 못하는 변형(채점이 못 잡는 버그). 테스트를 느슨하게 하지 않고 그대로 적어 두며,
  여전히 못 잡는지 확인한다(채점을 고쳐 잡게 되면 이 시험이 실패하므로 VARIANTS 로 옮긴다).
  같은 목록이 notebooks/ep01-micrograd/README.md 에 있다.
"""
import contextlib
import io
import random

import pytest

import z2h_check
from z2h_check import check, runs
from l01_helpers import run_notebook_cells, solution_cells, tags

# 이름: (정본 코드 치환 목록, 반드시 "✕ 다시" 여야 하는 칸, 무엇을 틀리게 했는지)
VARIANTS = {
    "곱셈 _backward 재료 바꿔 씀": (
        [("self.grad = other.data * out.grad", "self.grad = self.data * out.grad"),
         ("self.grad += other.data * out.grad", "self.grad += self.data * out.grad")],
        {"L01-S28"}),
    "더하기 _backward 한쪽 누락": (
        [("other.grad = 1.0 * out.grad", "other.grad = 0.0 * out.grad"),
         ("other.grad += 1.0 * out.grad", "other.grad += 0.0 * out.grad")],
        {"L01-S27"}),
    "tanh 기울기 식 오류(1 - t)": (
        [("(1 - t**2) * out.grad", "(1 - t) * out.grad")],
        {"L01-S52"}),
    "+= 대신 =(같은 값을 여러 번 쓸 때 기울기를 잃음)": (
        [("self.grad += ", "self.grad = "), ("other.grad += ", "other.grad = ")],
        {"L01-S53"}),
    "위상 정렬을 뒤집지 않음": (
        [("for node in reversed(topo):", "for node in topo:")],
        {"L01-S49"}),
    "backward 시작값(self.grad = 1.0) 누락": (
        [("    self.grad = 1.0\n    for node in reversed(topo):", "    for node in reversed(topo):")],
        {"L01-S31"}),
    "기울기 비우기 누락": (
        [("  for p in n.parameters():\n    p.grad = 0.0\n", "")],
        {"L01-S53"}),
    "갱신 부호 반대": (
        [("p.data += -0.05 * p.grad", "p.data += 0.05 * p.grad"), ("p.data += -0.01 * p.grad", "p.data += 0.01 * p.grad")],
        {"L01-S53"}),
    "거듭제곱 기울기 지수 오류": (
        [("other * (self.data ** (other - 1)) * out.grad", "other * (self.data ** other) * out.grad")],
        {"L01-S53"}),
    "뉴런 편향 누락": (
        [("zip(self.w, x)), self.b)", "zip(self.w, x)), Value(0.0))")],
        {"L01-S51"}),
    "식 f 의 상수 누락": (
        [("return 3*x**2 - 4*x + 5", "return 3*x**2 - 4*x")],
        {"L01-S02", "L01-S03"}),
}

# 어떤 단계 칸도 잡지 못하는 변형: (치환 목록, 까닭)
UNCAUGHT = {
    "exp 기울기 오류(out.data 빠짐)": (
        [("self.grad += out.data * out.grad", "self.grad += out.grad")],
        "exp 를 쓰는 단계는 S36(확인 식이 값만 봄)과 S39(그림, manual)뿐이고 학습에는 exp 가 없다"),
}


def _body():
    cells = solution_cells()
    start = next(i for i, c in enumerate(cells) if "rebuild-start" in tags(c))
    return cells[:start]


BODY = _body()


def _mutate(pairs):
    applied = {old: 0 for old, _ in pairs}
    out = []
    for cell in BODY:
        cell = dict(cell)
        if cell["cell_type"] == "code" and not set(tags(cell)) & {"check", "z2h-bundle"}:
            for old, new in pairs:
                count = cell["source"].count(old)
                if count:
                    applied[old] += count
                    cell["source"] = cell["source"].replace(old, new)
        out.append(cell)
    assert all(applied.values()), f"정답 셀에 적용되지 않은 치환: {[o for o, n in applied.items() if not n]}"
    return out


def _failed(cells):
    z2h_check.reset()
    runs.forget()
    random.seed(0)
    with contextlib.redirect_stdout(io.StringIO()):
        run_notebook_cells(cells, check)
    return {cid for cid, rec in z2h_check.results().items() if rec["status"] == "fail"}


def test_unmutated_body_has_no_failures():
    assert _failed([dict(c) for c in BODY]) == set()


@pytest.mark.parametrize("name", sorted(VARIANTS))
def test_step_checks_catch_variant(name):
    pairs, must = VARIANTS[name]
    failed = _failed(_mutate(pairs))
    assert must <= failed, f"{name}: ✕ 여야 할 칸 {sorted(must - failed)} 이 통과했습니다(✕ 칸: {sorted(failed)})"


@pytest.mark.parametrize("name", sorted(UNCAUGHT))
def test_known_uncaught_variant_is_still_uncaught(name):
    pairs, _why = UNCAUGHT[name]
    assert _failed(_mutate(pairs)) == set(), f"{name}: 이제 단계 칸이 잡습니다. VARIANTS 로 옮기고 README 목록을 고치세요"
