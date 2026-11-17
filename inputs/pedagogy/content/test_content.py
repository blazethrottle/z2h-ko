"""L01.json, taster.json, F.json 코드를 학습자 순서대로 실행해 '보여야 하는 것'을 점검합니다(그림은 렌더하지 않음)."""
# 테스트 환경: python3 + 사용자 설치 torch(CPU)·graphviz·numpy. 상자에서 패키지가 사라지면 `pip install --user --break-system-packages graphviz torch --index-url https://download.pytorch.org/whl/cpu` 후 실행(교훈 2026-11-17).
import json, ast, io, contextlib, sys, os, random, re
import matplotlib; matplotlib.use("Agg")
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import l01_source as S

def run_cell(code, ns):
    tree = ast.parse(code)
    last = tree.body[-1] if tree.body else None
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        if isinstance(last, ast.Expr):
            exec(compile(ast.Module(tree.body[:-1], []), "<cell>", "exec"), ns)
            val = eval(compile(ast.Expression(last.value), "<cell>", "eval"), ns)
            if val is not None and not type(val).__name__ == "Digraph":
                print(repr(val))
            elif val is not None:
                print("<graph nodes=%d>" % val.source.count("shape=record"))
        else:
            exec(compile(tree, "<cell>", "exec"), ns)
    return buf.getvalue().strip()

def test_l01(seed):
    random.seed(seed)
    ns, cls, outs = {}, [], {}
    run_of = {st["id"]: "\n".join(l for l, _ in st["run"]) for st in S.STEPS}
    for st in S.STEPS:
        mode = st.get("cell", "new")
        if mode == "class_new":
            cls = [l for l, _ in st["edits"][0][2]]
        elif mode == "class_edit":
            for where, anchor, ls in st["edits"]:
                new = [l for l, _ in ls]
                if anchor == "END":
                    cls += new
                else:
                    i = cls.index(anchor); cls[i+1:i+1] = new
        if mode in ("class_new", "class_edit"):
            exec("\n".join(cls), ns)
        if st.get("prepared"):
            exec("\n".join(l for l, _ in S.PREPARED_DRAW_DOT), ns)
        for r in st.get("rerun", []):
            run_cell(run_of[r], ns)
        if st.get("changed"):
            code = run_of["L01-S15b"].replace("    for p in n.parameters():\n        p.grad = 0.0\n", "")
            outs[st["id"]] = run_cell(code, ns)
        elif st["run"]:
            outs[st["id"]] = run_cell(run_of[st["id"]], ns)
        else:
            outs[st["id"]] = "(no output)"
        g = lambda k: eval(k, ns)
        if st["id"] == "L01-S07": assert (g("L.data"), g("a.grad"), g("b.grad"), g("c.grad"), g("f.grad")) == (-8.0, 6.0, -4.0, -2.0, 4.0)
        if st["id"] == "L01-S10b": assert abs(g("n.grad") - 0.5) < 1e-6 and abs(g("b.grad") - 0.5) < 1e-6
        if st["id"] in ("L01-S11b", "L01-S13d"):
            assert abs(g("x1.grad") + 1.5) < 1e-6 and abs(g("w1.grad") - 1.0) < 1e-6 and abs(g("x2.grad") - 0.5) < 1e-6 and g("w2.grad") == 0.0, st["id"]
            assert abs(g("o.data") - 0.70710678) < 1e-6
        if st["id"] == "L01-S11": assert len(g("topo")) == 10
        if st["id"] == "L01-S15b": outs["final_loss"] = g("loss.data")
    return outs

def run_cell_safe(code, ns):
    """에러가 나도 멈추지 않고 '에러종류: 설명' 한 줄을 돌려줍니다(F-P7 단계용)."""
    try:
        return run_cell(code, ns)
    except Exception as e:
        return f"{type(e).__name__}: {e}"

def run_f_steps(steps):
    """F 단계를 단위별 새 노트북(ns)에서 학습자 순서대로 실행. steps: f_source.STEPS 형식. 돌려줌: {step_id: 출력}."""
    outs, cells, ns, unit = {}, {}, {}, None
    for st in steps:
        if st["unit"] != unit:
            unit, ns, cells = st["unit"], {}, {}
        if not st["run"] and not st.get("edits"):
            continue
        out = None
        for target, where, action, anchor, ls in st.get("edits", []):
            lines = cells[target]
            new = [l for l, _ in ls]
            if action == "insert" and anchor == "END":
                lines += new
            elif action == "replace":
                i = lines.index(anchor); lines[i:i+1] = new
            else:
                i = lines.index(anchor); lines[i+1:i+1] = new
            out = run_cell_safe("\n".join(lines), ns)
        for r in st.get("rerun", []):
            run_cell_safe("\n".join(cells[r]), ns)
        if st["run"]:
            cells[st["id"]] = [l for l, _ in st["run"]]
            out = run_cell_safe("\n".join(cells[st["id"]]), ns)
        outs[st["id"]] = re.sub(r" at 0x[0-9a-f]+", "", out)   # 그래프 객체 주소는 실행마다 달라 지움
    return outs

def check_expected(chk, out):
    t = chk["type"]
    if t == "output_match": return out == chk["value"]
    if t == "value_range": return chk["min"] <= float(out.splitlines()[-1]) <= chk["max"]
    if t == "error_match": return out.startswith(chk["error_type"] + ":")
    return True

def test_f():
    """F.json 점검: 코드 실행 결과, 검수 규칙(data-spec 4절), 진단 5문항."""
    import f_source as F
    d = json.load(open(os.path.join(HERE, "F.json")))
    assert list(d) == ["_meta", "lecture", "steps", "questions", "rebuild_tasks", "mastery_rule", "hints"]
    outs = run_f_steps(F.STEPS)
    ok = 0
    for st in d["steps"]:
        assert len(st["code"].splitlines()) == len(st["code_line_notes_ko"]), st["step_id"]
        assert st["new_code_lines"] <= 10 and st["long_step"] == (6 <= st["new_code_lines"] <= 10), st["step_id"]
        if st["kind"] == "read":
            assert st["code"] == "" and st["expected_output_example"] is None; continue
        out = outs[st["step_id"]]
        assert out == st["expected_output_example"], (st["step_id"], out)
        assert check_expected(st["expected_check"], out), (st["step_id"], out)
        ok += 1
        print(st["step_id"], "match |", out[:80].replace("\n", " / "))
    ids = {s["step_id"] for s in d["steps"]} | {q["question_id"] for q in d["questions"]} | {r["rebuild_id"] for r in d["rebuild_tasks"]}
    for h in d["hints"]: assert h["target_id"] in ids, h
    hint_ids = {h["hint_id"] for h in d["hints"]}
    for x in d["steps"] + d["questions"] + d["rebuild_tasks"]:
        for hid in x["hint_ids"]: assert hid in hint_ids, hid
    for q in d["questions"]:
        assert q["answer_ko"] and q["rubric"], q["question_id"]
        if q["type"] == "choice": assert len(q["choices"]) >= 2 and 0 <= q["answer_index"] < len(q["choices"])
        if q["type"] == "predict": assert q["hint_ids"] == [], q["question_id"]
        if q.get("after_step"): assert q["after_step"] in ids
    diag = [q for q in d["questions"] if q.get("unit_id") == "F-DIAG"]
    assert [q["question_id"] for q in diag] == ["F-D1", "F-D2", "F-D3", "F-D4", "F-D5"]
    assert all(q["hint_ids"] == [] and q["recommend_units_if_wrong"] for q in diag)
    assert diag[2]["type"] == "predict" and diag[2]["auto_grade"] == {"type": "exact", "value": "8"}
    unit_ids = [u["unit_id"] for u in d["lecture"]["units"]]
    assert len(unit_ids) == 15 and sum(u["required"] for u in d["lecture"]["units"]) == 8
    for q in diag: assert set(q["recommend_units_if_wrong"]) <= set(unit_ids)
    for u in d["lecture"]["units"]:
        assert (u["status"] == "written") == bool(u["step_ids"]), u["unit_id"]
    assert "\u2014" not in json.dumps(d, ensure_ascii=False), "긴 줄표"
    # 확인 문제·익힘 과제 정답을 실제로 실행해 맞춤
    ns = {}
    run_cell("def f(x): return 3*x**2 - 4*x + 5", ns)
    assert run_cell("a = 5; a = a * 2; print(a)", {}) == "10" and run_cell('print("abc"[2])', {}) == "c"
    assert run_cell("f(0)", ns) == "5" and run_cell("def f(a): return a * 2\nf(4)", {}) == "8"
    assert run_cell("def sq(x): x*x\nprint(sq(3))", {}) == "None"
    st6 = {st["id"]: st for st in F.STEPS}
    box = [l for l, _ in st6["F-P6-S01"]["run"]] + [l for k in ("F-P6-S02", "F-P6-S03") for l, _ in st6[k]["edits"][0][4]]
    nb = {}; run_cell("\n".join(box), nb)
    assert run_cell("print(Box(1) + Box(1) + Box(1))", nb) == "Box(3)" and run_cell_safe("Box(2) * Box(3)", nb).startswith("TypeError")
    run_cell("\n".join(box + ["    def __mul__(self, other):", "        return Box(self.data * other.data)"]), nb)
    assert run_cell("print(Box(2) * Box(3))", nb) == "Box(6)"
    assert run_cell_safe("for i in range(3) print(i)", {}).startswith("SyntaxError")
    h = 0.0001; g = lambda x: 3*x**2 - 4*x + 5
    assert (g(-1 + h) - g(-1)) / h < 0 and abs((g(1 + h) - g(1)) / h - 2.0003) < 1e-3
    def gd(lr):
        w = 0.0
        for _ in range(20): w = w - lr * 2*(w - 3)
        return w
    assert abs(gd(0.01) - 1.0) < 0.01 and abs(gd(0.1) - 2.965) < 0.001 and gd(1.5) < -1e6
    a, b, c, f = 2.0, -3.0, 10.0, -2.0; e = a*b; dd = e + c; L = dd*f
    assert (L, f*b, f*a, f, dd) == (-8.0, 6.0, -4.0, -2.0, 4.0)
    assert run_cell_safe("print(len(emma))", {}).startswith("NameError")
    # F-P3, F-P4, F-P8
    assert run_cell("[10, 20, 30][1:]", {}) == "[20, 30]" and run_cell_safe('d = {"a": 1}; print(d["z"])', {}).startswith("KeyError")
    assert run_cell("for i in range(2, 5): print(i)", {}) == "2\n3\n4" and run_cell('list(zip("ab", "bc"))', {}) == "[('a', 'b'), ('b', 'c')]"
    assert run_cell_safe("for i in range(3):\nprint(i)", {}).startswith("IndentationError")
    assert run_cell("import numpy as np\nprint(np.array([1,2,3]) * 2)", {}) == "[2 4 6]" and run_cell("import numpy as np\nprint(np.arange(0, 1, 0.5))", {}) == "[0.  0.5]"
    assert run_cell('d = {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5}\nprint(d["a"], d["e"])', {}) == "1 5"
    assert run_cell('words = ["emma", "ava", "olivia", "mia"]\nfor w in words:\n    if len(w) >= 4:\n        print(w)', {}) == "emma\nolivia"
    nf = {}; run_cell("import numpy as np\nimport matplotlib.pyplot as plt\nxs = np.arange(-5, 5, 0.25)\nys = xs**3\nline = plt.plot(xs, ys)[0]", nf)
    assert len(nf["line"].get_ydata()) == 40 and nf["ys"][0] == -125.0
    assert run_cell_safe("import numpy as np\nxs = np.arange(-5, 5, 0.25)\nxs^3", {}).startswith("TypeError")
    pf = {}; run_cell("\n".join(l for st in F.STEPS if st["unit"] == "F-P8" for l, _ in st["run"]), pf)
    yd = pf["plt"].gca().lines[-1].get_ydata(); assert yd.argmin() not in (0, len(yd) - 1) and yd[0] > yd.min()   # 아래로 볼록
    print(f"F.json ok: steps {len(d['steps'])}(코드 실행 {ok}), questions {len(d['questions'])}, rebuild {len(d['rebuild_tasks'])}, hints {len(d['hints'])}")

if __name__ == "__main__":
    if sys.argv[1:] == ["F"]:
        test_f(); sys.exit(0)
    o = test_l01(0)
    for k, v in o.items(): print(k, "|", str(v)[:300].replace("\n", " / "))
    finals = [test_l01(s)["final_loss"] for s in range(20)]
    print("final losses over 20 seeds:", [round(x, 3) for x in finals], "under 0.1:", sum(x < 0.1 for x in finals))
    # taster
    t = json.load(open(os.path.join(HERE, "taster.json")))
    # names.txt가 있는 작업 폴더에서 실행(저장소 체크아웃에 파일을 만들지 않음, 교훈 2026-11-17b)
    import shutil, tempfile
    src = next(p for p in ["/workspace/teacher/scratch/names.txt", "/tmp/z2h/third_party/makemore/names.txt", "/tmp/names.txt"] if os.path.exists(p))
    work = tempfile.mkdtemp(prefix="z2h_taster_"); shutil.copy(src, work); os.chdir(work); ns = {}
    for st in t["steps"]:
        if not st["code"]: continue
        code = "\n".join(l for l in st["code"].splitlines() if not l.startswith("!"))
        out = run_cell(code, ns)
        exp = st["expected_output_example"].strip()
        print(st["step_id"], "match" if out == exp else "DIFF", "|", out[:80].replace("\n", " / "))
    os.chdir(HERE); test_f()
