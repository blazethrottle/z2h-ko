"""기초 정본(inputs/pedagogy/content/F.json)의 모든 코드를 노트북처럼(IPython) 실제로 실행해 적어 둔 출력과 맞는지 본다.

쓰는 법: .venv/bin/python tools/content/verify_f.py [--unit F-P1] [--show] [--record]
- --record: 결과를 src_f/_verify_result.json 에 적는다. 그 파일은 정본 _meta.verification 이 되므로,
  적은 뒤 build_canon.py 로 다시 만들면 F.json 이 바뀐다(실행 시각 등). 기록을 새로 남길 때만 쓴다.
- 단계: 단위마다 새 노트북(IPython 셸) 하나. 셀 나누기(cell_line_counts), 앞 셀 고치기(edits),
  다시 실행(rerun_first), 실행 순서(run_plan: new:N, cell:STEP:N, restart, run_all)를 흉내 낸다.
- 셀 마지막 줄이 값이면 노트북처럼 그 값을 보여 준다(Out[n] 표시는 뺀다).
- 에러는 노트북 에러 화면의 맨 아래 줄 꼴("종류: 내용")로 적는다.
- 문항: verify_code, 예측 문항 code, 정답 코드(answer_code), 힌트 H3 빈칸 채운 코드, 익힘 과제 정답 코드.
"""
import json
import os
import re
import sys
import tempfile
import time

os.environ["MPLBACKEND"] = "Agg"
import warnings

warnings.filterwarnings("ignore")

from IPython.core.interactiveshell import InteractiveShell
from IPython.core.profiledir import ProfileDir
from IPython.utils.capture import capture_output
from traitlets.config import Config

# 학습 코드를 집 폴더의 IPython 기록(history.sqlite)에 남기지 않게 기록을 끈다(실행 번호와 Out 은 메모리에만)
SHELL_CONFIG = Config()
SHELL_CONFIG.HistoryManager.enabled = False

HERE = os.path.dirname(os.path.abspath(__file__))
DOC = os.path.join(os.path.dirname(os.path.dirname(HERE)), "inputs", "pedagogy", "content", "F.json")
RESULT = os.path.join(HERE, "src_f", "_verify_result.json")
SHOW = "--show" in sys.argv
RECORD = "--record" in sys.argv
ONLY = sys.argv[sys.argv.index("--unit") + 1] if "--unit" in sys.argv else None

OUT_RE = re.compile(r"^Out\[\d+\]: ?\n?", re.M)


def new_shell():
    """새 노트북 하나. 위치 없는 ProfileDir 와 지금 폴더(verify_all 의 임시 폴더)를 주어 IPython 이 ~/.ipython 을 만들지 않게 한다."""
    InteractiveShell.clear_instance()
    sh = InteractiveShell.instance(config=SHELL_CONFIG, ipython_dir=os.getcwd(), profile_dir=ProfileDir())
    sh.showtraceback = lambda *a, **k: None
    sh.showsyntaxerror = lambda *a, **k: None
    sh.run_cell("import matplotlib\nmatplotlib.use('Agg')", store_history=False)
    sh.reset(new_session=True)
    return sh


def run(sh, code):
    with capture_output() as c:
        r = sh.run_cell(code, store_history=True)
    out = OUT_RE.sub("", c.stdout).rstrip("\n")
    e = r.error_in_exec or r.error_before_exec
    if e is not None:
        line = f"{type(e).__name__}: {e}"
        out = (out + "\n" + line) if out else line
    try:
        import matplotlib.pyplot as plt
        plt.close("all")
    except Exception:
        pass
    return out, e


def norm(s):
    if s is None:
        return None
    return "\n".join(l.rstrip() for l in s.strip("\n").split("\n"))


def fill(code, answers):
    for a in answers:
        code = code.replace("___", a, 1)
    return code


results = {"steps": [], "questions": [], "hints": [], "rebuild": []}
fails = []


def record(kind, id_, ok, actual, expected, note=""):
    results[kind].append({"id": id_, "ok": ok, "note": note})
    if not ok:
        fails.append((kind, id_, actual, expected, note))
    if SHOW or not ok:
        print(("OK  " if ok else "FAIL"), kind, id_, note)
        if not ok or SHOW:
            print("  --- 실제 ---\n  " + (actual or "").replace("\n", "\n  "))
            if not ok:
                print("  --- 기대 ---\n  " + (expected or "").replace("\n", "\n  "))


def check_step(sh, step, actual):
    chk = step["expected_check"]
    exp = norm(step["expected_output_example"])
    act = norm(actual)
    t = chk["type"]
    if t == "output_match" and chk.get("mode", "exact") == "exact":
        return act == exp, ""
    if t == "output_match" and chk["mode"] == "contains_lines":
        lines = act.split("\n")
        i = 0
        for want in chk["lines"]:
            while i < len(lines) and want not in lines[i]:
                i += 1
            if i == len(lines):
                return False, f"없는 줄: {want}"
            i += 1
        return True, "contains_lines"
    if t == "value_range":
        notes = []
        for c in chk["checks"]:
            v = sh.ev(c["expr"])
            v = float(v)
            ok = c["min"] <= v <= c["max"]
            notes.append(f"{c['expr']}={v:.4g}{'' if ok else ' 범위 밖'}")
            if not ok:
                return False, "; ".join(notes)
        same = "출력도 같음" if act == exp else "출력 다름(무작위, 범위로 판정)"
        return True, "; ".join(notes) + " / " + same
    if t == "manual":
        notes = []
        for c in chk.get("checks", []):
            v = float(sh.ev(c["expr"]))
            if not c["min"] <= v <= c["max"]:
                return False, f"{c['expr']}={v:.4g} 범위 밖"
            notes.append(f"{c['expr']}={v:.4g}")
        return True, "manual(그림 등, 스스로 확인). " + "; ".join(notes)
    return False, f"모르는 검사 {t}"


def verify_steps(doc):
    by_unit = {}
    for s in doc["steps"]:
        by_unit.setdefault(s["unit_id"], []).append(s)
    for uid, steps in by_unit.items():
        if ONLY and uid != ONLY:
            continue
        sh = new_shell()
        cells = {}
        order = []
        for s in steps:
            lines = s["code"].split("\n")
            k = 0
            for e in s["edits"]:
                ins = lines[k:k + e["line_count"]]
                k += e["line_count"]
                tgt = cells[e["target_step"]]
                placed = False
                for ci, cc in enumerate(tgt):
                    cl = cc.split("\n")
                    if e["anchor_line"] is None:
                        continue
                    if e["anchor_line"] in cl:
                        j = cl.index(e["anchor_line"])
                        cl = cl[:j + 1] + ins + cl[j + 1:]
                        tgt[ci] = "\n".join(cl)
                        placed = True
                        break
                if not placed:
                    tgt[-1] = tgt[-1] + "\n" + "\n".join(ins)
            rest = lines[k:]
            new_cells = []
            p = 0
            for n in s["cell_line_counts"]:
                new_cells.append("\n".join(rest[p:p + n]))
                p += n
            cells[s["step_id"]] = new_cells
            new_pos = [(s["step_id"], i) for i in range(len(new_cells))]
            if s.get("place_before"):
                j = next(k for k, (sid0, _) in enumerate(order) if sid0 == s["place_before"])
                order[j:j] = new_pos
            else:
                order.extend(new_pos)
            if s.get("restart_first") and not s.get("run_plan"):
                sh.reset(new_session=True)
            for r in s["rerun_first"]:
                for cc in cells[r]:
                    run(sh, cc)
            plan = s.get("run_plan") or [f"new:{i + 1}" for i in range(len(new_cells))]
            outs = []
            for tok in plan:
                if tok == "restart":
                    sh.reset(new_session=True)
                    continue
                if tok == "run_all":
                    for sid, ci in order:
                        o, _ = run(sh, cells[sid][ci])
                        if o:
                            outs.append(o)
                    continue
                if tok.startswith("new:"):
                    o, _ = run(sh, new_cells[int(tok[4:]) - 1])
                else:
                    _, sid, ci = tok.split(":")
                    o, _ = run(sh, cells[sid][int(ci) - 1])
                if o:
                    outs.append(o)
            actual = "\n".join(outs)
            ok, note = check_step(sh, s, actual)
            record("steps", s["step_id"], ok, actual, s["expected_output_example"], note)


def single(code):
    sh = new_shell()
    o, e = run(sh, code)
    return o, e


def verify_questions(doc):
    for q in doc["questions"]:
        uid = q["unit_id"]
        if ONLY and uid != ONLY:
            continue
        qid = q["question_id"]
        ag = q["auto_grade"]
        if q.get("verify_code"):
            o, _ = single(q["verify_code"])
            record("questions", qid + ":verify", norm(o) == norm(q["verify_output"]), o, q["verify_output"])
        if q["type"] == "predict" and q.get("code") and not q.get("verify_code"):
            o, _ = single(q["code"])
            last = norm(o).split("\n")[-1]
            if ag["type"] == "exact":
                ok = last == ag["value"] or last in ag.get("accept", [])
            elif ag["type"] == "numeric_range":
                ok = ag["min"] <= float(last) <= ag["max"]
            else:
                ok = True
            record("questions", qid + ":predict", ok, o, json.dumps(ag, ensure_ascii=False))
        if q["type"] == "fix_bug" and q.get("code"):
            o, e = single(q["code"])
            record("questions", qid + ":bug", e is not None or "Error" in (o or ""), o, "에러가 나야 함")
        if q.get("answer_code"):
            o, _ = single(q["answer_code"])
            ok = norm(o) == norm(q["answer_output"])
            if ok and ag["type"] == "exact" and q.get("graded_on") == "output":
                last = norm(o).split("\n")[-1]
                ok = last == ag["value"] or last in ag.get("accept", [])
            record("questions", qid + ":answer", ok, o, q["answer_output"])


def verify_hints(doc):
    targets = {}
    for q in doc["questions"]:
        targets[q["question_id"]] = q["unit_id"]
    for r in doc["rebuild_tasks"]:
        targets[r["rebuild_id"]] = r["unit_id"]
    for s in doc["steps"]:
        targets[s["step_id"]] = s["unit_id"]
    for h in doc["hints"]:
        if ONLY and targets.get(h["target_id"]) != ONLY:
            continue
        if h["level"] != 3 or not h.get("code_with_blanks"):
            continue
        code = fill(h["code_with_blanks"], h["blank_answers"])
        o, e = single(code)
        exp = h.get("blank_filled_output")
        ok = (norm(o) == norm(exp)) if exp is not None else e is None
        record("hints", h["hint_id"], ok, o, exp)


def verify_rebuild(doc):
    for r in doc["rebuild_tasks"]:
        if ONLY and r["unit_id"] != ONLY:
            continue
        o, _ = single(r["solution_code"])
        record("rebuild", r["rebuild_id"], norm(o) == norm(r["expected_output_example"]), o, r["expected_output_example"])


def verify_all(doc):
    """학습 코드가 파일을 만들기도 하므로(names.txt 등) 임시 폴더에서 돌리고 지운다."""
    cwd = os.getcwd()
    with tempfile.TemporaryDirectory(prefix="verify_f_") as work:
        os.chdir(work)
        try:
            verify_steps(doc)
            verify_questions(doc)
            verify_hints(doc)
            verify_rebuild(doc)
        finally:
            os.chdir(cwd)


if __name__ == "__main__":
    t0 = time.time()
    with open(DOC, encoding="utf-8") as f:
        doc = json.load(f)
    verify_all(doc)
    import platform
    import torch
    summary = {k: f"{sum(x['ok'] for x in v)}/{len(v)}" for k, v in results.items()}
    print("요약", summary, f"{time.time() - t0:.1f}초")
    if RECORD and not ONLY:
        out = {
            "tool": "tools/content/verify_f.py (IPython 셀 실행 흉내, 작성자가 만든 검사)",
            "ran_at": time.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
            "python": platform.python_version(),
            "torch": torch.__version__,
            "summary": summary,
            "failed": [f"{k}:{i}" for k, i, *_ in fails],
            "seconds": round(time.time() - t0, 1),
        }
        with open(RESULT, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
    sys.exit(1 if fails else 0)
