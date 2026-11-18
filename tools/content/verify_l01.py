"""L01 추가 확인: run_code.py 와 같은 순서로 셀을 돌리고, 조각에 적어 둔 verify 식(assert)을 단계마다 실행한다.

run_code.py 는 expected_check 하나만 대조한다. 이 스크립트는 그림(draw_dot) 안의 grad 숫자처럼
expected_ko 에 적었지만 expected_check 로 다 담지 못한 것까지 확인한다.
쓰는 법: .venv/bin/python tools/content/verify_l01.py  (정본 inputs/pedagogy/content/L01.json 과 조각 src_l01/ 을 읽는다)
"""
import builtins
import glob
import json
import os
import sys
import tempfile

import cc_common as C
import run_code as R
from fragments import folder_on_path, load_file

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src_l01")
DOC = os.path.join(os.path.dirname(os.path.dirname(HERE)), "inputs", "pedagogy", "content", "L01.json")
K = load_file(os.path.join(SRC, "common.py"))
os.environ.setdefault("MPLBACKEND", "Agg")


def fragment_checks():
    """조각에 적어 둔 확인 식: (단계 id → 식, 문항 뒤 단계 id → [(문항 id, 식)])."""
    verify = {}
    qverify = {}
    with folder_on_path(SRC):
        for p in sorted(glob.glob(os.path.join(SRC, "part0*_steps_*.py"))):
            for s in load_file(p).STEPS:
                if s["verify"]:
                    verify[K.sid(s["n"])] = s["verify"]
        qpath = os.path.join(SRC, "part08_questions.py")
        if os.path.exists(qpath):
            for q in load_file(qpath).QUESTIONS:
                if q["verify"]:
                    qverify.setdefault(q["after"], []).append((K.qid(q["n"]), q["verify"]))
    return verify, qverify


def main():
    with tempfile.TemporaryDirectory(prefix="v_l01_") as work:
        cwd = os.getcwd()
        os.chdir(work)
        try:
            return run_checks()
        finally:
            os.chdir(cwd)


def run_checks():
    verify, qverify = fragment_checks()
    with open(DOC, encoding="utf-8") as f:
        data = json.load(f)
    steps = [(None, s) for s in sorted(data["steps"], key=lambda s: s["order"])]
    plans, probs, _ = C.simulate_cells(steps)
    for sev, code, sid, msg in probs:
        print("simulate %s %s: %s" % (sev, sid, msg))
    ns = {"__name__": "__main__", "__builtins__": builtins}
    live = {}
    ok = bad = 0
    for _, s in steps:
        sid = s["step_id"]
        plan = plans[sid]
        for tgt, cell, _ in plan["edits"]:
            live[tgt] = cell
        rerun = plan["rerun"]
        not_listed = [t for t in plan["edited"] if t not in rerun]
        def_ids = [t for t in not_listed if R.defines_names(live[t])]
        post_ids = [t for t in not_listed if t not in def_ids]
        errs = []
        for t in def_ids:
            r = R.exec_cell(live[t], ns, t, 60)
            errs.append(r["exc_text"])
        for t in rerun:
            r = R.exec_cell(live[t], ns, t, 60)
            errs.append(r["exc_text"])
        if s.get("prepared_code"):
            r = R.exec_cell(C.split_lines(s["prepared_code"]), ns, sid + ":prep", 60)
            errs.append(r["exc_text"])
        for t in post_ids:
            r = R.exec_cell(live[t], ns, t, 60)
            errs.append(r["exc_text"])
        if plan["own_cell"]:
            r = R.exec_cell(plan["own_cell"], ns, sid, 60)
            live[sid] = plan["own_cell"]
            errs.append(r["exc_text"])
        errs = [e for e in errs if e]
        if errs:
            print("%s 에러: %s" % (sid, errs))
            bad += 1
        if sid in verify:
            try:
                exec(verify[sid], dict(ns))
                ok += 1
            except AssertionError as e:
                print("%s verify 실패: %s" % (sid, e))
                bad += 1
            except Exception as e:  # noqa: BLE001
                print("%s verify 예외: %r" % (sid, e))
                bad += 1
        for q_id, code in qverify.get(sid, []):
            try:
                exec(code, dict(ns))
                ok += 1
            except Exception as e:  # noqa: BLE001
                print("%s verify 실패: %r" % (q_id, e))
                bad += 1
    # 재구성 과제: 풀이 코드 + 확인 셀을 실행해 check.expected 와 대조
    final_ns = ns
    for rb in data.get("rebuild_tasks", []):
        rid = rb["rebuild_id"]
        if rid == "L01-R1":
            env = {"__name__": "__main__", "__builtins__": builtins}
            src = rb["solution_code"]
        elif rid == "L01-R2":
            env = {"__name__": "__main__", "__builtins__": builtins}
            r1 = next(x for x in data["rebuild_tasks"] if x["rebuild_id"] == "L01-R1")
            src = r1["solution_code"] + "\n" + rb["solution_code"]
        else:
            env = dict(final_ns)
            src = rb["solution_code"]
        r = R.exec_cell(C.split_lines(src), env, rid + ":solution", 60)
        r2 = R.exec_cell(C.split_lines(rb["check_code"]), env, rid + ":check", 60)
        want = rb["check"]["expected"]
        got = r2["out"]
        if r["exc"] or r2["exc"] or not R.text_match(got, want, "contains", 1e-6):
            print("%s 재구성 확인 실패: 기대 %r, 실제 %r, 에러 %s %s" % (rid, want, got, r["exc_text"], r2["exc_text"]))
            bad += 1
        else:
            ok += 1
            print("%s 재구성 확인 통과: %r" % (rid, got.strip()))
    print("verify 통과 %d, 실패 %d" % (ok, bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
