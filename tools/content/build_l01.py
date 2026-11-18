"""1편 정본(inputs/pedagogy/content/L01.json)의 합치기: 조각 src_l01/part00~part09 를 data-spec 칸으로 합친다.

직접 실행하지 않고 build_canon.py 가 부른다(build → serialize).
조각이 아직 다 없어도 있는 것만 합친다(작성 중 확인용). 합치면서 아래를 스스로 검사하고 문제가 있으면 BuildError.
  - 코드 줄 수와 풀이 수가 같은지(조각에서 쌍으로 적으므로 늘 같음)
  - edits 줄 수 합이 code 줄 수를 넘지 않는지
  - H3 빈칸 글자가 코드 안에 실제로 있는지
  - 긴 줄표(U+2014)가 없는지
"""
import glob
import json
import os

from fragments import BuildError, folder_on_path, load_file

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src_l01")
K = load_file(os.path.join(SRC, "common.py"))

EM = chr(0x2014)
BLANK = "____"


def load(path):
    return load_file(path)


def blanked(code_text, blanks, where):
    if isinstance(blanks, str):
        return blanks
    out = code_text
    for b in blanks:
        if b not in out:
            raise BuildError(["%s: H3 빈칸 %r 가 코드에 없습니다" % (where, b)])
        out = out.replace(b, BLANK, 1)
    return out


def make_hints(target, hints, code_text):
    objs, ids = [], []
    for i, h in enumerate(hints):
        lv = i + 1
        hid = "%s-H%d" % (target, lv)
        o = {"hint_id": hid, "target_id": target, "level": lv, "text_ko": None, "code_with_blanks": None,
             "unlock": K.UNLOCK[lv]}
        if lv == 3:
            text, blanks = h
            o["text_ko"] = text
            o["code_with_blanks"] = blanked(code_text, blanks, hid)
        else:
            o["text_ko"] = h
        if lv == 4:
            o["show_solution"] = True
        objs.append(o)
        ids.append(hid)
    return objs, ids


def build_step(s, order):
    step_id = K.sid(s["n"])
    code_lines = [c for c, _ in s["code"]]
    notes = [n for _, n in s["code"]]
    repl = sum(e["line_count"] for e in s["edits"] if e["action"] == "replace")
    ed_total = sum(e["line_count"] for e in s["edits"])
    if ed_total > len(code_lines):
        raise BuildError(["%s: edits 줄 수 합 %d 가 code 줄 수 %d 보다 큽니다" % (step_id, ed_total, len(code_lines))])
    new = len(code_lines) - s["moved"] - repl
    if new > 10:
        raise BuildError(["%s: 새 코드 %d줄은 한도 10줄을 넘습니다" % (step_id, new)])
    long_step = 6 <= new <= 10
    title = s["title"] + (" (긴 단계)" if long_step else "")
    prep = s["prepared"]
    code_text = "\n".join(code_lines)
    hints, hint_ids = make_hints(step_id, s["hints"], code_text)
    obj = {
        "step_id": step_id,
        "lecture_id": K.LID,
        "order": order,
        "title_ko": title,
        "video_segments": s["segments"],
        "long_step": long_step,
        "new_code_lines": new,
        "moved_code_lines": s["moved"],
        "kind": s["kind"],
        "input_ko": s["input_ko"],
        "prepared_code": "\n".join(c for c, _ in prep) if prep else None,
        "prepared_code_line_notes_ko": [n for _, n in prep] if prep else [],
        "prepared_code_source_ko": s["prepared_source"],
        "edits": s["edits"],
        "rerun_first": s["rerun"],
        "code": code_text,
        "code_line_notes_ko": notes,
        "expected_ko": s["expected"],
        "expected_check": s["check"],
        "meaning_ko": s["meaning"],
        "objective_ids": s["obj"],
        "hint_ids": hint_ids,
    }
    return obj, hints


def build_question(q):
    q_id = K.qid(q["n"])
    code_text = q["code"] if q["code"] else ""
    hints, hint_ids = make_hints(q_id, q["hints"], code_text)
    obj = {
        "question_id": q_id,
        "lecture_id": K.LID,
        "type": q["type"],
        "after_step": q["after"],
        "prompt_ko": q["prompt"],
        "code": q["code"],
    }
    if q["type"] == "choice":
        obj["choices"] = q["choices"]
        obj["answer_index"] = q["answer_index"]
    obj.update({
        "answer_ko": q["answer"],
        "auto_grade": q["grade"],
        "rubric": [{"point": p, "criterion_ko": c} for p, c in q["rubric"]],
        "max_points": 1,
        "must_pass": q["must_pass"],
        "alternate_of": None,
        "scored": True,
        "objective_ids": q["obj"],
        "hint_ids": hint_ids,
    })
    return obj, hints


def scan_dash(node, path="$"):
    bad = []
    if isinstance(node, dict):
        for k, v in node.items():
            bad += scan_dash(v, "%s.%s" % (path, k))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            bad += scan_dash(v, "%s[%d]" % (path, i))
    elif isinstance(node, str) and EM in node:
        bad.append(path)
    return bad


def build():
    """조각을 합친 정본(dict). 형식 규칙을 어기면 BuildError."""
    with folder_on_path(SRC):
        data = assemble()
    bad = scan_dash(data)
    if bad:
        raise BuildError(["긴 줄표가 있습니다: %s" % ", ".join(bad[:10])])
    return data


def serialize(data):
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def assemble():
    step_parts = sorted(glob.glob(os.path.join(SRC, "part0*_steps_*.py")))
    raw_steps = []
    for p in step_parts:
        raw_steps += load(p).STEPS
    raw_steps.sort(key=lambda s: s["n"])
    steps, hints = [], []
    for i, s in enumerate(raw_steps, start=1):
        o, h = build_step(s, i)
        if o["order"] != s["n"]:
            raise BuildError(["단계 번호가 비었습니다: %s 의 order 가 %d" % (o["step_id"], o["order"])])
        steps.append(o)
        hints += h
    questions = []
    qpath = os.path.join(SRC, "part08_questions.py")
    if os.path.exists(qpath):
        for q in load(qpath).QUESTIONS:
            o, h = build_question(q)
            questions.append(o)
            hints += h
    rebuilds, mastery = [], None
    rpath = os.path.join(SRC, "part09_rebuild.py")
    if os.path.exists(rpath):
        rmod = load(rpath)
        for r in rmod.REBUILDS:
            r = dict(r)
            rh = r.pop("hints")
            h, ids = make_hints(r["rebuild_id"], rh, r.get("check_code") or "")
            hints += h
            rebuilds.append(r)
        mastery = rmod.MASTERY
    meta_mod = load(os.path.join(SRC, "part00_meta.py"))
    return {
        "_meta": meta_mod.meta(steps, questions, rebuilds, hints),
        "lecture": meta_mod.LECTURE,
        "steps": steps,
        "questions": questions,
        "rebuild_tasks": rebuilds,
        "mastery_rule": mastery or meta_mod.DEFAULT_MASTERY,
        "hints": hints,
    }
