"""콘텐츠 JSON 의 단계 code 를 노트북처럼 차례로 실행하고 expected_check 와 대조한다.

쓰는 법(저장소 루트에서):
  .venv/bin/python tools/content/run_code.py inputs/pedagogy/content/L01.json --questions
  .venv/bin/python tools/content/run_code.py inputs/pedagogy/content/F.json --questions
  .venv/bin/python tools/content/run_code.py inputs/pedagogy/content/L01.json --json
실행 방식:
  - 강의 편: 편 전체가 이름공간 하나(노트북 하나). 기초: 단위마다 새 이름공간.
  - 단계 순서는 order. 셀 마지막 줄이 식이면 노트북처럼 그 값을 화면에 보인 것으로 친다.
  - edits 가 있으면 앞 셀을 고친 뒤 그 셀과 rerun_first 를 다시 실행하고 새 셀을 실행한다.
  - 그림은 화면 없이(matplotlib Agg). graphviz 그림은 dot 이 있으면 실제로 그려 본다.
  - ! 나 % 로 시작하는 노트북 명령 줄은 건너뛴다.
종료 코드: 0 불일치·예외 없음, 1 하나라도 있음(--strict 면 '대조 불가'도) 또는 단계를 하나도 못 찾음,
2 파일 없음, 3 도구 내부 오류.
주의: 이 도구는 JSON 안의 학습 코드를 exec/eval 로 그대로 실행하는 것이 목적이다. 우리가 쓴 콘텐츠에만 쓰고,
남이 준 JSON 은 돌리지 않는다. 실행은 임시 폴더에서 하고 끝나면 지운다(파일이 작업 폴더에 남지 않게).
"""
import argparse
import ast
import builtins
import contextlib
import io
import json
import math
import os
import re
import shutil
import signal
import sys
import tempfile
import time
import traceback
import warnings

import cc_common as C

# 학습 코드가 matplotlib 을 처음 부를 때 화면 없이 그리게 한다(이 파일은 matplotlib 을 부르지 않음)
os.environ.setdefault("MPLBACKEND", "Agg")

STATUS_KO = {"pass": "일치", "ran": "실행만", "nocheck": "대조 불가", "mismatch": "불일치", "error": "예외", "skip": "코드 없음"}
NUM = r"[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?"
NUM_RE = re.compile(NUM)
HAS_DOT = shutil.which("dot") is not None
DEFAULT_TOL = 1e-6


class CellTimeout(Exception):
    pass


def _alarm(signum, frame):
    raise CellTimeout("셀 실행 시간 제한을 넘었습니다")


def prep_lines(lines):
    out, skipped = [], 0
    for ln in lines:
        s = ln.lstrip()
        if s.startswith("!") or s.startswith("%"):
            out.append("")
            skipped += 1
        else:
            out.append(ln)
    return out, skipped


def exec_cell(lines, ns, label, timeout):
    """셀 하나 실행. 결과 dict: out, exc, exc_text, figures, magic_skipped, rendered."""
    lines, skipped = prep_lines(lines)
    src = "\n".join(lines)
    buf = io.StringIO()
    res = {"out": "", "exc": None, "exc_text": "", "figures": 0, "magic_skipped": skipped, "rendered": None}
    old_stdin = sys.stdin
    old_handler = signal.signal(signal.SIGALRM, _alarm)
    try:
        sys.stdin = io.StringIO("")
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf), warnings.catch_warnings():
            warnings.filterwarnings("ignore", message=".*non-interactive.*")
            warnings.filterwarnings("ignore", message=".*FigureCanvasAgg.*")
            if timeout:
                signal.setitimer(signal.ITIMER_REAL, timeout)
            try:
                tree = ast.parse(src, filename="<%s>" % label)
                last = None
                if tree.body and isinstance(tree.body[-1], ast.Expr) and not src.rstrip().endswith(";"):
                    last = tree.body.pop()
                exec(compile(tree, "<%s>" % label, "exec"), ns)
                if last is not None:
                    val = eval(compile(ast.Expression(last.value), "<%s>" % label, "eval"), ns)
                    if val is not None:
                        mod = type(val).__module__ or ""
                        if mod.startswith("graphviz"):
                            print("<그림: %s>" % type(val).__name__)
                            if HAS_DOT and hasattr(val, "pipe"):
                                val.pipe(format="svg")
                                res["rendered"] = True
                            else:
                                res["rendered"] = False
                        else:
                            print(repr(val))
            except BaseException as e:  # noqa: BLE001 - 학습 코드의 모든 에러를 기록
                if isinstance(e, KeyboardInterrupt):
                    raise
                res["exc"] = e
                res["exc_text"] = "".join(traceback.format_exception_only(type(e), e)).strip()
            finally:
                if timeout:
                    signal.setitimer(signal.ITIMER_REAL, 0)
            plt = sys.modules.get("matplotlib.pyplot")
            if plt is not None:
                try:
                    res["figures"] = len(plt.get_fignums())
                    plt.close("all")
                except Exception:  # noqa: BLE001
                    pass
    finally:
        sys.stdin = old_stdin
        signal.signal(signal.SIGALRM, old_handler)
    res["out"] = buf.getvalue()
    return res


# ---------------------------------------------------------------- 대조
def norm(text):
    lines = [x.rstrip() for x in str(text).replace("\r\n", "\n").split("\n")]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines)


def to_number(v):
    if C.is_num(v):
        return float(v)
    d = getattr(v, "data", None)
    if C.is_num(d):
        return float(d)
    if hasattr(v, "item"):
        try:
            return float(v.item())
        except Exception:  # noqa: BLE001
            pass
    if isinstance(v, str):
        return float(v.strip())
    return float(v)


def line_eq(a, b, tol):
    if a.strip() == b.strip():
        return True
    pa, pb = re.split("(%s)" % NUM, a.strip()), re.split("(%s)" % NUM, b.strip())
    if len(pa) != len(pb):
        return False
    for i, (x, y) in enumerate(zip(pa, pb)):
        if i % 2 == 0:
            if x.strip() != y.strip():
                return False
        else:
            # 정수 모양(5)과 소수 모양(5.0)은 다르게 본다(파이썬 기초에서 int, float 차이가 중요).
            # 둘 다 소수 모양일 때만 허용오차로 비교한다.
            if not (_is_float_tok(x) and _is_float_tok(y)):
                if x.lstrip("+") != y.lstrip("+"):
                    return False
            elif not math.isclose(float(x), float(y), rel_tol=tol, abs_tol=tol):
                return False
    return True


def _is_float_tok(t):
    return "." in t or "e" in t.lower()


def text_match(actual, expected, mode, tol):
    a, e = norm(actual), norm(expected)
    if mode == "regex":
        return re.search(expected, a, re.M) is not None
    al, el = a.split("\n") if a else [], e.split("\n") if e else []
    if mode == "exact":
        return a == e or (len(al) == len(el) and all(line_eq(x, y, tol) for x, y in zip(al, el)))
    # contains: 경계를 지켜 찾는다. 기대 '5' 가 실제 '15', '0.5', '5.0' 안에서 맞았다고 하지 않게.
    if not el:
        return True
    pat = re.escape(e)
    if re.match(r"[\w.]", e[0]):
        pat = r"(?<![\w.])" + pat
    if re.search(r"\w$", e):
        pat = pat + r"(?!\w|\.\d)"
    if re.search(pat, a):
        return True
    for i in range(0, len(al) - len(el) + 1):
        if all(line_eq(al[i + j], el[j], tol) for j in range(len(el))):
            return True
    return False


def short(text, n=400):
    t = str(text)
    return t if len(t) <= n else t[:n] + " ...(%d자 생략)" % (len(t) - n)


def range_of(spec):
    lo = spec.get("min", spec.get("low"))
    hi = spec.get("max", spec.get("high"))
    rg = spec.get("range")
    if isinstance(rg, list) and len(rg) == 2:
        lo, hi = rg
    return lo, hi


def get_value(spec, ns, out):
    """value_range 와 exact 가 볼 값: expr 이 있으면 그 식, 없으면 출력의 마지막 숫자."""
    expr = next((spec[k] for k in C.EXPR_FIELDS if isinstance(spec.get(k), str)), None)
    if expr:
        try:
            return eval(expr, ns), "식 %s" % expr, None
        except Exception as e:  # noqa: BLE001
            return None, "식 %s" % expr, "식 %s 계산 실패: %s" % (expr, e)
    nums = NUM_RE.findall(out)
    if not nums:
        return None, "출력의 마지막 숫자", "출력에서 숫자를 찾지 못했습니다"
    return nums[-1], "출력의 마지막 숫자", None


def evaluate(check, ns, out):
    """돌려줌: (status, check_label, detail)"""
    if not isinstance(check, dict):
        return "ran", "없음", "expected_check 없음"
    t = check.get("type")
    tol = check.get("tolerance", DEFAULT_TOL)
    tol = tol if C.is_num(tol) else DEFAULT_TOL
    if t in (None, "manual", "error"):
        return "ran", t or "없음", ""
    if t == "output_match":
        if isinstance(check.get("pattern") or check.get("regex"), str):
            exp, mode = check.get("pattern") or check.get("regex"), "regex"
        else:
            exp = next((check[k] for k in C.OUTPUT_FIELDS if k in check and check[k] is not None), None)
            mode = check.get("match", "contains")
        if exp is None:
            return "nocheck", t, "기준 출력 칸(expected 등)이 없어 대조하지 못했습니다"
        if mode not in ("contains", "exact", "regex"):
            return "nocheck", t, "match %r 를 모릅니다" % mode
        try:
            ok = text_match(out, str(exp), mode, tol)
        except re.error as e:
            return "nocheck", t, "정규식 %r 이 잘못되었습니다: %s" % (exp, e)
        label = "%s(%s)" % (t, mode)
        if ok:
            return "pass", label, ""
        return "mismatch", label, "기대 %r 가 실제 출력에 없습니다. 실제 출력: %r" % (short(exp, 200), short(norm(out)))
    if t in ("value_range", "numeric_range"):
        lo, hi = range_of(check)
        if lo is None and hi is None:
            return "nocheck", t, "min/max 가 없어 대조하지 못했습니다"
        v, src, err = get_value(check, ns, out)
        if err:
            return "mismatch", t, err
        try:
            x = to_number(v)
        except Exception:  # noqa: BLE001
            return "mismatch", t, "%s 값 %r 을 숫자로 바꾸지 못했습니다" % (src, short(repr(v), 100))
        ok = (lo is None or x >= lo) and (hi is None or x <= hi)
        label = "%s[%s, %s]" % (t, lo, hi)
        if ok:
            return "pass", label, ""
        return "mismatch", label, "%s = %r 가 범위 [%s, %s] 밖입니다" % (src, x, lo, hi)
    if t == "exact":
        if "value" not in check:
            return "nocheck", t, "value 가 없어 대조하지 못했습니다"
        want = str(check["value"])
        expr = next((check[k] for k in C.EXPR_FIELDS if isinstance(check.get(k), str)), None)
        if expr:
            v, src, err = get_value(check, ns, out)
            if err:
                return "mismatch", t, err
            cand = [str(v), repr(v)]
        else:
            lines = [x for x in norm(out).split("\n") if x.strip()]
            src = "출력의 마지막 줄"
            cand = [norm(out), lines[-1].strip() if lines else ""]
        if any(c.strip() == want.strip() or line_eq(c, want, tol) for c in cand):
            return "pass", "exact", ""
        return "mismatch", "exact", "기대 %r, 실제(%s) %r" % (want, src, short(cand[-1], 200))
    return "nocheck", str(t), "run_code 가 모르는 확인 유형 %r 입니다" % t


def expected_error_spec(step):
    v = step.get("expected_error", step.get("expects_error"))
    ec = step.get("expected_check")
    if v is None and isinstance(ec, dict) and ec.get("type") == "error":
        v = ec.get("error") or ec.get("error_type") or ec.get("value") or True
    if v is False:
        return None
    return v


def error_matches(spec, exc):
    if spec is True:
        return True
    name, _, msg = str(spec).partition(":")
    name, msg = name.strip(), msg.strip()
    names = [c.__name__ for c in type(exc).__mro__]
    if name and name not in names:
        return False
    if msg and msg not in str(exc):
        return False
    return True


# ---------------------------------------------------------------- 실행
def build_groups(data, kind):
    objs = C.collect(data)
    lecture_id = None
    if kind == "lecture":
        lec = data.get("lecture") if isinstance(data, dict) else None
        lecture_id = lec.get("lecture_id") if isinstance(lec, dict) else None
    groups = {}
    order_keys = {}
    if kind == "foundation":
        for i, (p, u, _) in enumerate(objs["unit"]):
            uid = u.get("unit_id")
            if isinstance(uid, str) and uid not in order_keys:
                o = u.get("order")
                order_keys[uid] = (o if C.is_int(o) else 10 ** 6, i)
    for p, s, u in objs["step"]:
        owner = C.owner_of(s, u, kind, lecture_id) or "(소속 미상)"
        groups.setdefault(owner, []).append((p, s))
    names = sorted(groups, key=lambda g: order_keys.get(g, (10 ** 7, 0)))
    questions = []
    for p, q, u in objs["question"]:
        qid = q.get("question_id")
        if kind == "foundation" and isinstance(qid, str) and (qid.startswith("F-D") or q.get("unit_id") == C.DIAG_UNIT):
            owner = C.DIAG_UNIT
        else:
            owner = C.owner_of(q, u if u != C.DIAG_UNIT else None, kind, lecture_id) or "(소속 미상)"
        questions.append((owner, q))
    return [(g, C.sort_steps(groups[g])) for g in names], questions


def defines_names(lines):
    """셀 맨 바깥에 class 나 def 가 있으면 정의 셀로 본다(문법 오류면 정의 셀로 쳐서 먼저 돌려 에러를 보이게)."""
    try:
        tree = ast.parse("\n".join(prep_lines(lines)[0]))
    except SyntaxError:
        return True
    return any(isinstance(n, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) for n in tree.body)


def runnable_question(q):
    ag = q.get("auto_grade")
    return (q.get("type") == "predict" and C.split_lines(q.get("code"))
            and isinstance(ag, dict) and ag.get("type") in ("exact", "numeric_range"))


def run_question(q, ns_snapshot, timeout):
    qid = q.get("question_id")
    ag = q["auto_grade"]
    t0 = time.time()
    res = exec_cell(C.split_lines(q["code"]), ns_snapshot, qid, timeout)
    rec = {"id": qid, "status": None, "check": ag.get("type"), "detail": "", "seconds": round(time.time() - t0, 2),
           "output": short(res["out"], 2000)}
    if res["exc"] is not None:
        rec["status"], rec["detail"] = "error", res["exc_text"]
        return rec
    if ag["type"] == "exact":
        st, label, detail = evaluate({"type": "exact", "value": ag.get("value")}, ns_snapshot, res["out"])
    else:
        st, label, detail = evaluate({**ag, "type": "numeric_range"}, ns_snapshot, res["out"])
    rec["status"], rec["detail"] = st, detail
    return rec


def run_all(data, kind, timeout, with_questions):
    groups, questions = build_groups(data, kind)
    step_results, q_results = [], []
    q_after = {}
    q_end = {}
    if with_questions:
        for owner, q in questions:
            if not runnable_question(q):
                continue
            a = q.get("after_step")
            if isinstance(a, str):
                q_after.setdefault(a, []).append(q)
            else:
                q_end.setdefault(owner, []).append(q)
    seen_q = set()

    def do_questions(qs, ns):
        for q in qs:
            if q.get("question_id") in seen_q:
                continue
            seen_q.add(q.get("question_id"))
            q_results.append(run_question(q, dict(ns), timeout))

    for gname, steps in groups:
        ns = {"__name__": "__main__", "__builtins__": builtins}
        plans, probs, _ = C.simulate_cells(steps)
        prob_by_step = {}
        for sev, code, sid, msg in probs:
            prob_by_step.setdefault(sid, []).append((sev, msg))
        live = {}
        for p, s in steps:
            sid = s.get("step_id")
            rec = {"id": sid, "group": gname, "kind": s.get("kind"), "status": None, "check": "", "detail": "",
                   "seconds": 0.0, "output": "", "notes": []}
            step_results.append(rec)
            t0 = time.time()
            code = s.get("code")
            if code is not None and not isinstance(code, str):
                rec["status"], rec["detail"] = "error", "code 칸이 글자가 아닙니다"
                continue
            plan = plans.get(sid, {"edits": [], "own_cell": C.split_lines(code), "edited": [], "rerun": [],
                                   "edit_failed": False})
            for sev, msg in prob_by_step.get(sid, []):
                if sev == "warning":
                    rec["notes"].append(msg)
            prep = s.get("prepared_code")
            prep_lines = C.split_lines(prep) if isinstance(prep, str) else []
            if not plan["edit_failed"] and not plan["own_cell"] and not plan["edits"] and not prep_lines:
                rec["status"], rec["check"] = "skip", ""
                do_questions(q_after.get(sid, []), ns)
                continue
            if plan["edit_failed"]:
                msgs = [m for sv, m in prob_by_step.get(sid, []) if sv == "error"]
                rec["status"], rec["detail"] = "error", "edits 적용 실패: " + " / ".join(msgs)
                # 고치지 못했어도 새 셀은 실행해 이름공간을 이어 간다(뒤 단계 영향 줄이기)
                if plan["own_cell"]:
                    r = exec_cell(plan["own_cell"], ns, sid, timeout)
                    live[sid] = plan["own_cell"]
                    rec["output"] = short(r["out"], 2000)
                rec["seconds"] = round(time.time() - t0, 2)
                do_questions(q_after.get(sid, []), ns)
                continue
            # 실행 순서(이 단계 하나):
            #   1) restart_first 가 true 면 이름공간 비우기(런타임 다시 시작. data-spec 밖 칸)
            #   2) rerun_first 에 없는 고친 셀 중 class/def 를 담은 정의 셀(새 설계도를 먼저 만듦)
            #   3) rerun_first 셀을 적힌 순서대로(고친 셀이 들어 있으면 고친 내용으로)
            #   4) prepared_code
            #   5) rerun_first 에 없는 나머지 고친 셀(학습 셀처럼 실행 자체가 이 단계의 결과)
            #   6) 이 단계의 새 셀
            # 대조할 출력은 5)+6) 의 출력. 둘 다 없으면 이 단계에서 실행한 모든 셀의 출력.
            if s.get("restart_first") is True:
                ns = {"__name__": "__main__", "__builtins__": builtins}
                rec["notes"].append("런타임 다시 시작(이름공간 비움)")
            for tgt, cell, desc in plan["edits"]:
                live[tgt] = cell
                rec["notes"].append(desc)
            rerun_ids = plan["rerun"]
            not_listed = [t for t in plan["edited"] if t not in rerun_ids]
            def_ids = [t for t in not_listed if defines_names(live[t])]
            post_ids = [t for t in not_listed if t not in def_ids]
            runs = []  # (이름, 결과, 이 단계 실행인지)
            for tid in def_ids:
                rec["notes"].append("고친 정의 셀 %s 를 rerun_first 보다 먼저 다시 실행" % tid)
                runs.append((tid + "(고친 셀)", exec_cell(live[tid], ns, tid, timeout), False))
            for rid in rerun_ids:
                if rid not in live:
                    rec["notes"].append("다시 실행할 %s 셀이 없어 건너뜀" % rid)
                    continue
                runs.append((rid, exec_cell(live[rid], ns, rid, timeout), False))
            if prep_lines:
                runs.append(("prepared_code", exec_cell(prep_lines, ns, sid + ":prepared", timeout), False))
            for tid in post_ids:
                runs.append((tid + "(고친 셀)", exec_cell(live[tid], ns, tid, timeout), True))
            if plan["own_cell"]:
                runs.append((sid, exec_cell(plan["own_cell"], ns, sid, timeout), True))
                live[sid] = plan["own_cell"]
            main_runs = [x for x in runs if x[2]] or runs
            main_out = "".join(r["out"] for _, r, _ in main_runs)
            rec["output"] = short(main_out, 2000)
            for _, r, _ in runs:
                if r["magic_skipped"]:
                    rec["notes"].append("노트북 명령 줄 %d개 건너뜀" % r["magic_skipped"])
                if r["figures"]:
                    rec["notes"].append("그림 %d개" % r["figures"])
                if r["rendered"] is True:
                    rec["notes"].append("graphviz 그림 그리기 성공")
                elif r["rendered"] is False:
                    rec["notes"].append("graphviz 그림은 dot 이 없어 그리지 않음")
            spec = expected_error_spec(s)
            check = s.get("expected_check")
            pre_fail = next(((n, r) for n, r, is_main in runs if r["exc"] is not None and not is_main and main_runs is not runs), None)
            main_fail = next(((n, r) for n, r, _ in main_runs if r["exc"] is not None), None)
            if pre_fail is not None:
                rid, r = pre_fail
                rec["status"], rec["detail"] = "error", "이 단계 전에 다시 실행한 %s 에서 에러: %s" % (rid, r["exc_text"])
            elif main_fail is not None:
                rid, r = main_fail
                if spec is None:
                    rec["status"], rec["detail"] = "error", ("%s: " % rid if rid != sid else "") + r["exc_text"]
                elif error_matches(spec, r["exc"]):
                    st, label, detail = evaluate(check, ns, main_out)
                    rec["check"] = "에러 %s" % (spec if spec is not True else "있음")
                    if st == "mismatch":
                        rec["status"], rec["detail"] = "mismatch", detail
                    else:
                        rec["status"] = "pass"
                else:
                    rec["status"], rec["check"] = "mismatch", "에러 %s" % spec
                    rec["detail"] = "%s 에러가 나야 하는데 다른 에러가 났습니다: %s" % (spec, r["exc_text"])
            elif spec is not None:
                rec["status"], rec["check"] = "mismatch", "에러 %s" % (spec if spec is not True else "있음")
                rec["detail"] = "%s 에러가 나야 하는데 에러 없이 끝났습니다" % (spec if spec is not True else "")
            else:
                st, label, detail = evaluate(check, ns, main_out)
                rec["status"], rec["check"], rec["detail"] = st, label, detail
            rec["seconds"] = round(time.time() - t0, 2)
            do_questions(q_after.get(sid, []), ns)
        do_questions(q_end.get(gname, []), ns)
    # 진단 문항, 소속 단계가 없는 문제: 새 이름공간
    leftovers = [q for qs in list(q_after.values()) + list(q_end.values()) for q in qs if q.get("question_id") not in seen_q]
    for q in leftovers:
        seen_q.add(q.get("question_id"))
        q_results.append(run_question(q, {"__name__": "__main__", "__builtins__": builtins}, timeout))
    return step_results, q_results


def summarize(results):
    s = {k: 0 for k in STATUS_KO}
    for r in results:
        s[r["status"]] = s.get(r["status"], 0) + 1
    return s


def md_cell(x):
    return str(x).replace("|", "\\|").replace("\n", " ")


def print_human(path, kind, steps, qs, with_q, show_output):
    label = {"lecture": "강의 편(이름공간 하나)", "foundation": "사전 기초(단위마다 새 이름공간)"}.get(kind, kind)
    print("실행 파일: %s" % path)
    print("파일 종류: %s" % label)
    print("dot 프로그램: %s" % ("있음(graphviz 그림을 실제로 그림)" if HAS_DOT else "없음(graphviz 그림은 건너뜀)"))
    print()
    print("| 단계 | 묶음 | 종류 | 결과 | 대조 | 초 | 메모 |")
    print("|---|---|---|---|---|---|---|")
    for r in steps:
        print("| %s | %s | %s | %s | %s | %s | %s |" % (
            md_cell(r["id"]), md_cell(r["group"]), md_cell(r["kind"]), STATUS_KO.get(r["status"], r["status"]),
            md_cell(r["check"]), r["seconds"], md_cell("; ".join(r["notes"]))))
    if with_q:
        print()
        print("| 문제 | 결과 | 채점 | 초 |")
        print("|---|---|---|---|")
        for r in qs:
            print("| %s | %s | %s | %s |" % (md_cell(r["id"]), STATUS_KO.get(r["status"], r["status"]), md_cell(r["check"]), r["seconds"]))
    bad = [r for r in steps + qs if r["status"] in ("mismatch", "error")]
    nochk = [r for r in steps + qs if r["status"] == "nocheck"]
    print()
    if bad:
        print("불일치·예외 목록 (%d건)" % len(bad))
        for r in bad:
            print("- %s [%s]: %s" % (r["id"], STATUS_KO[r["status"]], r["detail"]))
    else:
        print("불일치·예외 없음")
    if nochk:
        print()
        print("대조 불가 목록 (%d건)" % len(nochk))
        for r in nochk:
            print("- %s: %s" % (r["id"], r["detail"]))
    if show_output:
        print()
        print("단계별 실제 출력")
        for r in steps:
            print("--- %s" % r["id"])
            print(r["output"].rstrip() or "(출력 없음)")
    s = summarize(steps)
    print()
    print("요약: 단계 %d개. " % len(steps) + ", ".join("%s %d" % (STATUS_KO[k], v) for k, v in s.items()))
    if with_q:
        sq = summarize(qs)
        print("문제 %d개 실행. " % len(qs) + ", ".join("%s %d" % (STATUS_KO[k], v) for k, v in sq.items() if v))


def main(argv=None):
    ap = argparse.ArgumentParser(description="콘텐츠 JSON 의 단계 code 실행과 결과 대조")
    ap.add_argument("path")
    ap.add_argument("--kind", choices=["lecture", "foundation"], help="파일 종류를 직접 정함(기본: 자동 판별)")
    ap.add_argument("--timeout", type=float, default=120.0, help="셀 하나의 시간 제한(초, 기본 120, 0 이면 없음)")
    ap.add_argument("--questions", action="store_true", help="code 가 있는 예측(predict) 문제도 실행해 답(auto_grade)과 대조")
    ap.add_argument("--json", action="store_true", help="결과를 JSON 으로 출력")
    ap.add_argument("--show-output", action="store_true", help="단계별 실제 출력도 보여 줌")
    ap.add_argument("--strict", action="store_true", help="'대조 불가'도 실패로 봄")
    ap.add_argument("--keep-workdir", action="store_true", help="실행용 임시 폴더를 지우지 않음")
    a = ap.parse_args(argv)
    if not os.path.isfile(a.path):
        print("파일이 없습니다: %s" % a.path, file=sys.stderr)
        return 2
    path = os.path.abspath(a.path)
    data, probs = C.load_json(path)
    if data is None:
        print("JSON 을 읽지 못해 실행하지 않습니다: %s" % "; ".join(m for _, m in probs))
        return 1
    kind = a.kind or C.detect_kind(data)
    if kind is None:
        print("파일 종류를 알 수 없습니다. --kind lecture 또는 --kind foundation 을 주세요")
        return 1
    workdir = tempfile.mkdtemp(prefix="cc_run_")
    cwd = os.getcwd()
    try:
        os.chdir(workdir)
        steps, qs = run_all(data, kind, a.timeout, a.questions)
    except Exception:  # noqa: BLE001 - 도구 자체 버그는 콘텐츠 불일치와 구분해 종료 3
        print("실행 도구 내부 오류입니다(콘텐츠 탓이 아닐 수 있음). 도구 담당에게 아래를 전달하세요.", file=sys.stderr)
        traceback.print_exc()
        return 3
    finally:
        os.chdir(cwd)
        if not a.keep_workdir:
            shutil.rmtree(workdir, ignore_errors=True)
    bad = [r for r in steps + qs if r["status"] in ("mismatch", "error")]
    nochk = [r for r in steps + qs if r["status"] == "nocheck"]
    no_steps = not steps
    failed = bool(bad) or (a.strict and bool(nochk)) or no_steps
    if a.json:
        print(json.dumps({"file": a.path, "kind": kind, "dot_available": HAS_DOT, "steps": steps, "questions": qs,
                          "summary": summarize(steps), "question_summary": summarize(qs), "passed": not failed,
                          "no_steps_found": no_steps,
                          "workdir": workdir if a.keep_workdir else None}, ensure_ascii=False, indent=2))
    else:
        print_human(a.path, kind, steps, qs, a.questions, a.show_output)
        if no_steps:
            print("실행할 단계(step_id 가 있는 객체)를 하나도 찾지 못했습니다. 파일 모양을 확인하세요")
        if a.keep_workdir:
            print("실행 폴더(지우지 않음): %s" % workdir)
        print("결과: %s" % ("실패" if failed else "통과"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
