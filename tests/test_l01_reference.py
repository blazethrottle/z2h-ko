"""정답 구현이면 1편 채점 칸이 모두 통과하는지, 채점 칸이 교사 정본과 같은지, torch가 없을 때는 어떻게 되는지."""
import json
import os
import random
import subprocess

import pytest

import z2h_check
from z2h_check import check, decode_result_code, finish, graders
from reference_impl import scenarios, variants

ALL_IDS = [cid for cid, _title in graders.lecture_checks("L01")]
TITLES = dict(graders.lecture_checks("L01"))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_JSON = os.path.join(ROOT, "z2h_check", "reference", "l01.json")


def teacher_l01():
    """교사 정본 L01.json: 작업 폴더에 있으면 그것, 없으면 origin/m0-setup 에서 읽기만 한다(git show)."""
    path = os.path.join(ROOT, "inputs", "pedagogy", "content", "L01.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    try:
        proc = subprocess.run(["git", "show", "origin/m0-setup:inputs/pedagogy/content/L01.json"],
                              cwd=ROOT, capture_output=True, timeout=30)
        if proc.returncode == 0:
            return json.loads(proc.stdout.decode("utf-8"))
    except Exception:
        pass
    pytest.skip("교사 정본 L01.json 을 찾지 못함")


def test_check_ids_follow_teacher_canonical():
    t = teacher_l01()
    steps = sorted(t["steps"], key=lambda s: s["order"])
    mine_steps = [cid for cid in ALL_IDS if "-S" in cid]
    assert mine_steps == [s["step_id"] for s in steps]
    assert [cid for cid in ALL_IDS if "-R" in cid] == [r["rebuild_id"] for r in t["rebuild_tasks"]]
    for s in steps:
        assert TITLES[s["step_id"]] == s["title_ko"], s["step_id"]
    for r in t["rebuild_tasks"]:
        assert TITLES[r["rebuild_id"]] == r["title_ko"], r["rebuild_id"]


def test_reference_ranges_match_teacher_expected_check():
    t = teacher_l01()
    exp = {s["step_id"]: s["expected_check"] for s in t["steps"]}
    with open(REF_JSON, encoding="utf-8") as fh:
        ref = json.load(fh)
    assert (ref["S02"]["min"], ref["S02"]["max"]) == (exp["L01-S02"]["min"], exp["L01-S02"]["max"])
    assert (ref["S03"]["a"]["min"], ref["S03"]["a"]["max"]) == (exp["L01-S03"]["min"], exp["L01-S03"]["max"])
    assert (ref["S08"]["after_min"], ref["S08"]["after_max"]) == (exp["L01-S08"]["min"], exp["L01-S08"]["max"])
    assert ref["S07"]["lecture_example"]["grads"]["a"] == exp["L01-S07"]["values"]["a.grad"]
    assert ref["S15"]["params"] == exp["L01-S15"]["values"]["len(n.parameters())"]
    # 정본에 시드 고정이 없어 S15b 는 줄었는지만 본다(PM 결정). 정본 범위는 안내용으로만 둔다.
    assert ref["S15b"]["last_loss_max"] is None
    assert ref["S15b"]["teacher_value_range"] == [exp["L01-S15b"]["min"], exp["L01-S15b"]["max"]]
    assert "seed" not in json.dumps(t, ensure_ascii=False).lower()
    r3 = [r for r in t["rebuild_tasks"] if r["rebuild_id"] == "L01-R3"][0]["check"]
    assert ref["R3"]["last_loss_max"] == r3["max"]
    for key in ("x1.grad", "w1.grad", "x2.grad", "w2.grad"):
        assert ref["S11b"]["lecture_grads"][key.split(".")[0]] == exp["L01-S11b"]["values"][key]


def test_reference_json_null_convention():
    with open(REF_JSON, encoding="utf-8") as fh:
        ref = json.load(fh)
    assert ref["lecture_id"] == "L01" and ref["tolerance"]["grad"] == 1e-6

    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if v is None:
                    assert "노트북 실행 후 확정" in node.get(f"{k}_주석", ""), k
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
    walk(ref)


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_reference_passes_everything(seed, torch_mod, capsys):
    got = scenarios.run(variants.load(None), check, torch=torch_mod, seed=seed)
    out = capsys.readouterr().out
    assert got == {cid: True for cid in ALL_IDS}, out
    assert "✕" not in out and "채점기 오류" not in out
    code = finish("L01", send=False)
    res = decode_result_code(code)
    assert res["p"] == ALL_IDS and res["f"] == []


def test_reference_passes_with_the_real_reference_module(ref, torch_mod):
    got = scenarios.run(ref, check, torch=torch_mod)
    assert all(got.values()), got


def test_without_torch_only_s13e_is_skipped(monkeypatch, capsys):
    monkeypatch.setenv("Z2H_NO_TORCH", "1")
    got = scenarios.run(variants.load(None), check, torch=None)
    out = capsys.readouterr().out
    assert got["L01-S13e"] is False
    assert z2h_check.results()["L01-S13e"]["status"] == "skip"
    assert "torch가 없어 건너뜀" in out
    others = {cid: ok for cid, ok in got.items() if cid != "L01-S13e"}
    assert all(others.values()), out
    for cid in ("L01-S11b", "L01-S13d", "L01-R1", "L01-R2"):
        assert "torch가 없어" in z2h_check.results()[cid]["message_ko"], cid
    capsys.readouterr()
    code = finish("L01", send=False)
    out = capsys.readouterr().out
    assert "건너뜀 1" in out
    res = decode_result_code(code)
    assert "L01-S13e" not in res["p"] and "L01-S13e" not in res["f"]


def test_readme_lists_every_call_contract():
    with open(os.path.join(ROOT, "z2h_check", "README.md"), encoding="utf-8") as fh:
        readme = fh.read()
    for cid in ALL_IDS:
        usage = graders.usage_of(cid)
        assert usage.startswith(f'check("{cid}"'), usage
        assert usage in readme, usage
        assert f"| {cid} |" in readme, cid


def test_specific_values(ref, torch_mod):
    assert check("L01-S02", 14.0003) and not check("L01-S02", -14.0) and not check("L01-S02", 0.0014)
    assert not check("L01-S02", 14.05)  # 교사 정본 범위 13.99~14.01 밖
    assert check("L01-S03", -3.0, slope_b=2.0, slope_c=1.0)
    assert not check("L01-S03", -3.0, slope_b=-3.0)
    assert check("L01-S12", 2.0) and not check("L01-S12", 1.0)
    assert check("L01-S08", -7.286496) and not check("L01-S08", -7.0) and not check("L01-S08", -8.5)
    assert check("L01-S08", -8.0, -7.286496) and check("L01-S08", 1.0, 2.0) and not check("L01-S08", -8.0, -8.5)
    assert check("L01-S06", seen=True) and not check("L01-S06", [1, 2])
    assert check("L01-S01", seen=True) and not check("L01-S01", lambda x: 3 * x**2 + 4 * x + 5)
    a = ref.Value(1.0)
    assert not check("L01-S11", [a, a], a)


def test_s13e_float32_tensors_get_looser_tolerance(torch_mod):
    t = torch_mod
    x1 = t.tensor([2.0], requires_grad=True); x2 = t.tensor([0.0], requires_grad=True)
    w1 = t.tensor([-3.0], requires_grad=True); w2 = t.tensor([1.0], requires_grad=True)
    b = t.tensor([6.8813735870195432], requires_grad=True)
    o = t.tanh(x1 * w1 + x2 * w2 + b)
    o.backward()
    assert check("L01-S13e", x1=x1, x2=x2, w1=w1, w2=w2, b=b, o=o)
    assert "double" in z2h_check.results()["L01-S13e"]["message_ko"]
    # 숫자를 넘기면 다시
    assert not check("L01-S13e", x1=1.0, x2=0.0, w1=-3.0, w2=1.0, b=6.88)


def test_s15_loss_must_be_the_squared_error_of_n(ref):
    m = ref.MLP(3, [4, 4, 1])
    assert check("L01-S15", m, scenarios.mse_loss(m, ref.XS, ref.YS))
    wrong = sum(abs(m(x).data - y) for x, y in zip(ref.XS, ref.YS))  # 제곱 대신 절댓값
    assert not check("L01-S15", m, wrong)
    assert "다시 계산한 값" in z2h_check.results()["L01-S15"]["message_ko"]
    assert not check("L01-S15", ref.MLP(3, [4, 1]), 3.0)
    assert "41" in z2h_check.results()["L01-S15"]["message_ko"]


def test_s15b_only_checks_that_loss_went_down(ref):
    msg = lambda: z2h_check.results()["L01-S15b"]["message_ko"]
    random.seed(0)
    m = ref.MLP(3, [4, 4, 1])
    start = scenarios.mse_loss(m, ref.XS, ref.YS)
    assert not check("L01-S15b", m, start)  # S15 칸을 거치지 않아 처음 손실을 모름
    assert "L01-S15" in msg()
    assert check("L01-S15", m, start)
    assert not check("L01-S15b", m, start)  # 학습 전 그대로
    assert "그대로" in msg()
    ref.train(m, steps=1, lr=0.05)
    assert check("L01-S15b", m, scenarios.mse_loss(m, ref.XS, ref.YS))  # 한 걸음이라도 줄면 통과
    assert "교사 안내" in msg()  # 0.1 위라 다시 돌리라는 안내만 붙는다
    m2 = ref.MLP(3, [4, 4, 1])
    s2 = scenarios.mse_loss(m2, ref.XS, ref.YS).data
    ref.train(m2, steps=20, lr=-0.05)  # 갱신 부호 반대
    assert not check("L01-S15b", m2, scenarios.mse_loss(m2, ref.XS, ref.YS), start=s2)
    assert "-0.05" in msg()


def test_r3_s16(ref):
    m = ref.MLP(3, [4, 4, 1])
    assert not check("L01-R3", m, 0.05)  # 지어낸 손실: 넘긴 n으로 다시 계산하면 큼
    assert "다시 계산한 손실" in z2h_check.results()["L01-R3"]["message_ko"]
    ref.train(m, steps=200, lr=0.05)
    assert check("L01-R3", m, scenarios.mse_loss(m, ref.XS, ref.YS).data)
    assert check("L01-S16", seen=True)
    assert not check("L01-S16", [3.0, 2.0, 1.0], [3.0, 2.0, 1.0])
    same = [3.0, 2.0]
    assert not check("L01-S16", same, same)
    assert check("L01-S16", [3.0, 2.0, 1.0], [3.0, 2.5, 4.0])
