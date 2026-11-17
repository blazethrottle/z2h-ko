"""재구성 L01-R3 다시 실행 규칙(교사 정본 2026-11-17)과 학습 셀 실행 세기(z2h_check.runs).

- 규칙: 학습 셀(steps_per_run 번 반복)을 최대 max_reruns 번 실행해 그 안에 마지막 손실이 기준 미만이면 통과.
  다시 실행은 힌트로 세지 않는다 = 진행 중("○ 아직")은 기록하지 않고, 결과코드·서버 보내기에 실행 횟수가 없다.
- 숫자는 교사 정본(inputs/pedagogy/content/L01.json)에서 읽는다(시험 안에도 5, 20, 0.1 을 박지 않는다).
- 세기는 IPython 의 셀 실행 끝 알림을 흉내 낸 가짜 셸로 시험한다(실제 커널은 tests/test_notebooks_l01.py).
"""
import base64
import json
import os
import random

import pytest

import z2h_check
from z2h_check import check, decode_result_code, finish, runs
from z2h_check import core
from reference_impl import scenarios

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANON_FILE = os.path.join(ROOT, "inputs", "pedagogy", "content", "L01.json")


def _canon_r3():
    if not os.path.exists(CANON_FILE):
        pytest.skip("교사 정본 L01.json 없음")
    with open(CANON_FILE, encoding="utf-8") as fh:
        canon = json.load(fh)
    return next(r for r in canon["rebuild_tasks"] if r["rebuild_id"] == "L01-R3")["check"]


R3 = _canon_r3()
MAX_RUNS, STEPS, LIMIT = R3["max_reruns"], R3["steps_per_run"], R3["max"]


def _rec():
    return z2h_check.results().get("L01-R3")


def _trained_model(ref, seed=0):
    """정답 구현으로 기준 안에 0.1 아래로 내려간 모델과 그때의 실행 번째."""
    random.seed(seed)
    m = ref.MLP(3, [4, 4, 1])
    for k in range(1, MAX_RUNS + 1):
        ref.train(m, steps=STEPS, lr=0.05)
        if scenarios.mse_loss(m, ref.XS, ref.YS).data < LIMIT:
            return m, k
    pytest.fail(f"시드 {seed}: 정답 구현이 {MAX_RUNS}번 안에 {LIMIT} 아래로 내려가지 않음")


def _stuck_model(ref, seed=0):
    """학습률이 너무 작아 손실이 기준 위에 머무는 모델(틀린 구현 흉내)."""
    random.seed(seed)
    m = ref.MLP(3, [4, 4, 1])
    ref.train(m, steps=STEPS, lr=1e-5)
    assert scenarios.mse_loss(m, ref.XS, ref.YS).data >= LIMIT
    return m


# ---- 채점 규칙 (runs 를 직접 넘김) ----------------------------------------------

def test_reference_values_come_from_canon():
    ref_r3 = z2h_check._resources.load_json("reference/l01.json")["R3"]
    assert (ref_r3["max_reruns"], ref_r3["steps_per_run"], ref_r3["last_loss_max"]) == (MAX_RUNS, STEPS, LIMIT)


def test_pass_at_any_run_up_to_the_limit(ref, capsys):
    m, _k = _trained_model(ref)
    loss = scenarios.mse_loss(m, ref.XS, ref.YS)
    for k in range(1, MAX_RUNS + 1):
        z2h_check.reset()
        assert check("L01-R3", m, loss, runs=k), capsys.readouterr().out
        out = capsys.readouterr().out
        assert out.startswith("✓ 맞음") and f"{k}번째" in out and f"{k * STEPS}번 반복" in out, out
        assert "힌트로 세지 않습니다" in out
        assert _rec()["status"] == "pass"


def test_in_progress_is_not_recorded_and_not_counted(ref, capsys):
    m = _stuck_model(ref)
    loss = scenarios.mse_loss(m, ref.XS, ref.YS)
    for k in range(1, MAX_RUNS):
        assert check("L01-R3", m, loss, runs=k) is False
        out = capsys.readouterr().out
        assert out.startswith("○ 아직: ") and f"{k}번째" in out and f"앞으로 {MAX_RUNS - k}번" in out, out
        assert "힌트로 세지 않습니다" in out and out.rstrip().endswith("[L01-R3]")
        assert _rec() is None  # 기록하지 않음: 채점표 "아직 안 함", 결과코드에도 없음
    code = decode_result_code(finish("L01", send=False))
    assert "L01-R3" not in code["p"] and "L01-R3" not in code["f"]
    capsys.readouterr()
    # 기준 횟수째에도 위면 "✕ 다시"(구현을 의심, 힌트로)
    assert check("L01-R3", m, loss, runs=MAX_RUNS) is False
    out = capsys.readouterr().out
    assert out.startswith("✕ 다시") and "구현을 의심" in out and "H1" in out, out
    assert _rec()["status"] == "fail" and _rec()["attempts"] == 1  # 앞의 진행 중 확인은 시도로 세지 않았다


def test_over_the_limit_is_not_a_pass(ref, capsys):
    m, _k = _trained_model(ref, seed=1)
    loss = scenarios.mse_loss(m, ref.XS, ref.YS)
    # 기준 안에서 확인한 적 없이 기준을 넘긴 n: 손실이 낮아도 통과 아님, 처음부터 다시
    assert check("L01-R3", m, loss, runs=MAX_RUNS + 1) is False
    out = capsys.readouterr().out
    assert out.startswith("✕ 다시") and "통과로 치지 않습니다" in out and "처음부터 다시 만들어 보세요" in out, out
    assert f"{MAX_RUNS + 1}번째" in out
    stuck = _stuck_model(ref, seed=2)
    assert check("L01-R3", stuck, scenarios.mse_loss(stuck, ref.XS, ref.YS), runs=MAX_RUNS + 3) is False
    assert "처음부터 다시" in capsys.readouterr().out


def test_earlier_pass_is_kept_after_extra_runs(ref, capsys):
    m, k = _trained_model(ref, seed=3)
    assert check("L01-R3", m, scenarios.mse_loss(m, ref.XS, ref.YS), runs=k)
    capsys.readouterr()
    ref.train(m, steps=STEPS, lr=0.05)  # 통과한 뒤에도 더 학습함(기준을 넘김)
    assert check("L01-R3", m, scenarios.mse_loss(m, ref.XS, ref.YS), runs=MAX_RUNS + 1) is False
    out = capsys.readouterr().out
    assert out.startswith("○ 참고: ") and "이미 통과" in out and f"{k}번째" in out, out
    assert _rec()["status"] == "pass" and _rec()["attempts"] == 1
    assert "L01-R3" in decode_result_code(finish("L01", send=False))["p"]


def test_made_up_loss_still_fails(ref, capsys):
    random.seed(4)
    m = ref.MLP(3, [4, 4, 1])
    assert check("L01-R3", m, LIMIT / 2, runs=1) is False
    assert "다시 계산한 손실" in _rec()["message_ko"]


@pytest.mark.parametrize("bad", [0, -1, 1.5, "3", True, None.__class__])
def test_bad_runs_is_a_plain_fail(ref, bad, capsys):
    m, _k = _trained_model(ref)
    assert check("L01-R3", m, scenarios.mse_loss(m, ref.XS, ref.YS), runs=bad) is False
    out = capsys.readouterr().out
    assert out.startswith("✕ 다시") and "runs" in out and "채점기 오류" not in out, out


def test_without_runs_only_the_loss_is_checked(ref, capsys):
    m, _k = _trained_model(ref)
    assert check("L01-R3", m, scenarios.mse_loss(m, ref.XS, ref.YS))
    assert "셀 수 없어 손실만" in capsys.readouterr().out
    stuck = _stuck_model(ref)
    assert check("L01-R3", stuck, scenarios.mse_loss(stuck, ref.XS, ref.YS)) is False
    out = capsys.readouterr().out
    assert out.startswith("✕ 다시") and f"최대 {MAX_RUNS}번" in out


def test_reruns_never_reach_the_result_code_or_server(ref, monkeypatch, capsys):
    """진행 중 확인을 몇 번 해도 결과코드 JSON 칸은 v,l,p,f,t 그대로이고, 서버 본문에도 횟수·힌트가 없다."""
    sent = []
    monkeypatch.setattr(core, "_post_json", lambda url, body, timeout: sent.append(body) or 200)
    m = _stuck_model(ref, seed=5)
    for k in range(1, MAX_RUNS):
        check("L01-R3", m, scenarios.mse_loss(m, ref.XS, ref.YS), runs=k)
    m2, k2 = _trained_model(ref, seed=5)
    assert check("L01-R3", m2, scenarios.mse_loss(m2, ref.XS, ref.YS), runs=k2)
    capsys.readouterr()
    code = finish("L01", at="2026-11-17T21:00:00+09:00")
    data = decode_result_code(code)
    body = code.split(".")[1]
    raw = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    assert list(raw) == ["v", "l", "p", "f", "t"]
    assert data["p"] == ["L01-R3"] and data["f"] == []
    (posted,) = sent
    assert [r for r in posted["results"] if r["check_id"] == "L01-R3"] == [
        {"check_id": "L01-R3", "passed": True, "message_ko": "✓ 맞음: " + _rec()["message_ko"]}]
    assert set(posted) == {"lecture_id", "results", "at"}
    assert all(set(r) == {"check_id", "passed", "message_ko"} for r in posted["results"])


# ---- 학습 셀 실행 세기 (가짜 IPython 셸) ------------------------------------------

class _Events:
    def __init__(self):
        self.callbacks = {"pre_run_cell": [], "post_run_cell": []}

    def register(self, event, fn):
        if not callable(fn):
            raise TypeError("not callable")
        self.callbacks[event].append(fn)

    def unregister(self, event, fn):
        self.callbacks[event].remove(fn)

    def trigger(self, event, *args):
        for fn in list(self.callbacks[event]):
            fn(*args)


class _Shell:
    """IPython 셸 흉내: user_ns(노트북 이름 공간)와 셀 실행 끝 알림."""

    def __init__(self):
        self.user_ns = {}
        self.events = _Events()

    def run_cell(self, fn):
        """셀 하나 실행: fn(ns) 다음에 post_run_cell 알림."""
        fn(self.user_ns)
        self.events.trigger("post_run_cell", object())


@pytest.fixture
def shell(monkeypatch):
    sh = _Shell()
    monkeypatch.setattr(runs, "_shell", lambda: sh)
    return sh


def _self_check(shell):
    ns = shell.user_ns
    out = {}
    shell.run_cell(lambda _ns: out.setdefault("ok", check("L01-R3", ns["n"], ns["loss"], runs=runs.runs_of(ns["n"]))))
    return out["ok"]


def _make_cell(ref, seed):
    def cell(ns):
        random.seed(seed)
        ns["n"] = ref.MLP(3, [4, 4, 1])
        ns["loss"] = scenarios.mse_loss(ns["n"], ref.XS, ref.YS)
    return cell


def _train_cell(ref, lr=0.05):
    def cell(ns):
        ref.train(ns["n"], steps=STEPS, lr=lr)
        ns["loss"] = scenarios.mse_loss(ns["n"], ref.XS, ref.YS)
    return cell


def test_runs_of_is_none_outside_ipython(ref):
    assert runs.watch() is False and runs.watching() is False
    assert runs.runs_of(ref.MLP(3, [4, 4, 1])) is None


def test_watch_twice_registers_once(shell):
    assert runs.watch(("n",)) and runs.watch(("n",))
    ours = [cb for cb in shell.events.callbacks["post_run_cell"] if hasattr(cb, "z2h_runs_state")]
    assert len(ours) == 1 and runs.watching()


def test_counts_training_cell_runs_per_model(ref, shell):
    runs.watch(("n",))
    shell.run_cell(_make_cell(ref, seed=0))
    n = shell.user_ns["n"]
    assert runs.runs_of(n) == 1  # 아직 학습 전(0)이어도 1번째로 본다
    shell.run_cell(lambda ns: None)  # 상관없는 셀은 세지 않는다
    for k in range(1, 4):
        shell.run_cell(_train_cell(ref))
        assert runs.runs_of(n) == k
        assert runs.runs_of(n) == k  # 확인 셀을 두 번 눌러도 그대로
    shell.run_cell(_make_cell(ref, seed=1))  # 만들기 셀을 다시 실행: 새 모델은 처음부터
    assert shell.user_ns["n"] is not n and runs.runs_of(shell.user_ns["n"]) == 1
    shell.run_cell(_train_cell(ref))
    assert runs.runs_of(shell.user_ns["n"]) == 1
    shell.run_cell(_train_cell(ref))
    assert runs.runs_of(shell.user_ns["n"]) == 2


def test_training_and_check_in_one_cell_is_counted(ref, shell):
    runs.watch(("n",))
    shell.run_cell(_make_cell(ref, seed=0))
    n = shell.user_ns["n"]
    got = []
    shell.run_cell(lambda ns: (_train_cell(ref)(ns), got.append(runs.runs_of(n))))
    assert got == [1] and runs.runs_of(n) == 1


def test_model_seen_first_by_the_check_is_unknown(ref, shell):
    runs.watch(("n",))
    random.seed(0)
    m = ref.MLP(3, [4, 4, 1])
    assert runs.runs_of(m) is None  # 처음 보는 모델: 몇 번인지 모름(손실만 보게 됨)
    ref.train(m, steps=STEPS, lr=0.05)
    assert runs.runs_of(m) == 1


def test_broken_parameters_never_raise(shell):
    class Broken:
        def parameters(self):
            print("학생 print")
            raise RuntimeError("펑")
    runs.watch(("n",))
    shell.run_cell(lambda ns: ns.update(n=Broken()))
    assert runs.runs_of(shell.user_ns["n"]) is None
    shell.run_cell(lambda ns: ns.update(n=42))
    shell.run_cell(lambda ns: ns.update(n=object()))


def test_rerun_rule_end_to_end_with_check_after_each_run(ref, shell, capsys):
    """학생 흐름: 만들기 셀 → (학습 셀 → 자기 확인 셀) × 기준 횟수 + 1. 1~기준째는 통과 또는 아직, 그다음은 통과 아님."""
    runs.watch(("n",))
    shell.run_cell(_make_cell(ref, seed=6))
    outs = []
    for _k in range(MAX_RUNS + 1):
        shell.run_cell(_train_cell(ref))
        _self_check(shell)
        outs.append(capsys.readouterr().out)
    marks = [o.split(":")[0] for o in outs]
    assert all(m in ("✓ 맞음", "○ 아직") for m in marks[:MAX_RUNS]), marks
    first = marks.index("✓ 맞음") + 1
    assert marks[MAX_RUNS] == "○ 참고", marks  # 기준 안에서 통과한 n: 통과 기록은 그대로, 새 통과는 아님
    assert f"학습 셀 {first}번째 실행에서 이미 통과" in outs[MAX_RUNS], outs[MAX_RUNS]
    assert _rec()["status"] == "pass"


def test_skipping_the_check_cell_still_counts_runs(ref, shell, capsys):
    """학습 셀만 기준보다 많이 누르고 자기 확인을 한 번만 해도 실행 횟수가 맞게 잡혀 통과가 아니다."""
    runs.watch(("n",))
    shell.run_cell(_make_cell(ref, seed=7))
    for _k in range(MAX_RUNS + 1):
        shell.run_cell(_train_cell(ref))
    assert _self_check(shell) is False
    out = capsys.readouterr().out
    assert out.startswith("✕ 다시") and f"{MAX_RUNS + 1}번째" in out and "처음부터 다시" in out, out


def test_stuck_model_fails_at_the_limit_then_not_a_pass(ref, shell, capsys):
    runs.watch(("n",))
    shell.run_cell(_make_cell(ref, seed=8))
    marks = []
    for _k in range(MAX_RUNS + 1):
        shell.run_cell(_train_cell(ref, lr=1e-5))
        _self_check(shell)
        marks.append(capsys.readouterr().out)
    assert all(m.startswith("○ 아직") for m in marks[:MAX_RUNS - 1]), marks
    assert marks[MAX_RUNS - 1].startswith("✕ 다시") and "구현을 의심" in marks[MAX_RUNS - 1]
    assert marks[MAX_RUNS].startswith("✕ 다시") and "처음부터 다시" in marks[MAX_RUNS]
    assert _rec()["status"] == "fail"
