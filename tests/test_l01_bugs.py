"""일부러 틀린 구현이 바로 그 버그를 다루는 채점 칸에서 실패하고, 상관없는 칸은 통과하는지."""
import pytest

import z2h_check
from z2h_check import check
from reference_impl import scenarios, variants

CLASS_STEPS = {"L01-S04", "L01-S05", "L01-S09b", "L01-S14", "L01-S14b", "L01-S14c"}
# 채점기가 직접 거꾸로 도는 연산 칸 (학생 backward() 와 무관)
OPS_STEPS = {"L01-S10", "L01-S10b", "L01-S12", "L01-S13", "L01-S13b", "L01-S13c", "L01-S13d", "L01-R1"}

# (변형, 반드시 실패할 칸, 반드시 통과할 칸, 실패 문구에 들어 있어야 하는 말)
CASES = [
    ("eq_accumulate", {"L01-S12", "L01-S13d", "L01-R1", "L01-R2"},
     CLASS_STEPS | {"L01-S10", "L01-S10b", "L01-S11", "L01-S11b", "L01-S13", "L01-S13b", "L01-S13c", "L01-S15"},
     {"L01-S12": "+=", "L01-S13d": "+=", "L01-R1": "+=", "L01-R2": "+="}),
    ("mul_sign_flip", {"L01-S10", "L01-S11b"},
     CLASS_STEPS | {"L01-S10b", "L01-S11", "L01-S15"}, {"L01-S10": "곱셈", "L01-S11b": "L01-S10(+, *)"}),
    ("no_reversed", {"L01-S11b", "L01-R2", "L01-S15b", "L01-R3"},
     CLASS_STEPS | OPS_STEPS | {"L01-S11", "L01-S15"},
     {"L01-S11b": "reversed", "L01-R2": "reversed", "L01-S15b": "그대로"}),
    ("no_grad_one", {"L01-S11b", "L01-R2", "L01-S15b", "L01-R3"},
     CLASS_STEPS | OPS_STEPS | {"L01-S11", "L01-S15"}, {"L01-S11b": "self.grad = 1.0"}),
    ("tanh_grad_wrong", {"L01-S10b", "L01-S11b", "L01-R1"},
     CLASS_STEPS | {"L01-S10", "L01-S11", "L01-S12", "L01-S13", "L01-S13b", "L01-S13c", "L01-S13d", "L01-S15"},
     {"L01-S10b": "1 - t**2", "L01-S11b": "L01-S10b(tanh)"}),
    ("params_missing_bias", {"L01-S14c", "L01-S15", "L01-S15b", "L01-R3"},
     (CLASS_STEPS - {"L01-S14c"}) | OPS_STEPS | {"L01-S11", "L01-S11b", "L01-R2"},
     {"L01-S14c": "41", "L01-S15": "41"}),
    ("update_sign_flip", {"L01-S15b", "L01-R3"},
     CLASS_STEPS | OPS_STEPS | {"L01-S11", "L01-S11b", "L01-R2", "L01-S15"}, {"L01-S15b": "-0.05"}),
    ("no_visited", {"L01-R2"},
     CLASS_STEPS | OPS_STEPS | {"L01-S11", "L01-S11b", "L01-S15"},
     {"L01-R2": "visited"}),
]


@pytest.mark.parametrize("name,must_fail,must_pass,words", CASES, ids=[c[0] for c in CASES])
def test_bug_is_caught_at_its_check(name, must_fail, must_pass, words, torch_mod, capsys):
    got = scenarios.run(variants.load(name), check, torch=torch_mod)
    out = capsys.readouterr().out
    recs = z2h_check.results()
    assert all(r["status"] != "error" for r in recs.values()), out
    for cid in must_fail:
        assert got[cid] is False, (name, cid, out)
    for cid in must_pass:
        assert got[cid] is True, (name, cid, recs[cid]["message_ko"])
    for cid, word in words.items():
        assert word in recs[cid]["message_ko"], (cid, recs[cid]["message_ko"])
    assert "Traceback" not in out


def test_every_variant_still_compiles():
    for name in variants.PATCHES:
        mod = variants.load(name)
        assert hasattr(mod, "Value") and hasattr(mod, "MLP")
