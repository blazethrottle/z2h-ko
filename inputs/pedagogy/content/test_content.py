"""L01.json, taster.json 코드를 학습자 순서대로 실행해 '보여야 하는 것'을 점검합니다(그림은 렌더하지 않음)."""
import json, ast, io, contextlib, sys, os, random
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

if __name__ == "__main__":
    o = test_l01(0)
    for k, v in o.items(): print(k, "|", str(v)[:300].replace("\n", " / "))
    finals = [test_l01(s)["final_loss"] for s in range(20)]
    print("final losses over 20 seeds:", [round(x, 3) for x in finals], "under 0.1:", sum(x < 0.1 for x in finals))
    # taster
    t = json.load(open(os.path.join(HERE, "taster.json")))
    os.chdir("/tmp/z2h"); ns = {}
    for st in t["steps"]:
        if not st["code"]: continue
        code = "\n".join(l for l in st["code"].splitlines() if not l.startswith("!"))
        out = run_cell(code, ns)
        exp = st["expected_output_example"].strip()
        print(st["step_id"], "match" if out == exp else "DIFF", "|", out[:80].replace("\n", " / "))
