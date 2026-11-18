"""기초 정본(inputs/pedagogy/content/F.json)의 합치기: 조각 src_f/u_*.py, diag.py, meta.py를 data-spec 칸으로 합친다.

직접 실행하지 않고 build_canon.py 가 부른다(build → serialize).
- 조각마다 UNIT(딕셔너리)를 읽어 data-spec 칸 이름으로 바꾼다.
- 형식 규칙(줄 수 = 풀이 수, 긴 단계, 보기 번호, 힌트 단계, 긴 줄표 없음 등)을 검사하고, 어기면 BuildError.
- src_f/_verify_result.json(verify_f.py --record 결과)이 있으면 _meta.verification에 붙인다.
"""
import json
import os

from fragments import BuildError, folder_on_path, load_file

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src_f")

UNIT_ORDER = [
    "F-P1", "F-P2", "F-P3", "F-P4", "F-P5", "F-P6", "F-P7", "F-P8", "F-P9",
    "F-M1", "F-M2", "F-M3", "F-M4", "F-M5", "F-M6",
]
LECTURE_ID = "F"
EM_DASH = chr(0x2014)

UNLOCK = {
    1: {"after_attempts": 0, "after_minutes": None},
    2: {"after_attempts": 1, "after_minutes": None},
    3: {"after_attempts": 2, "after_minutes": 5},
    4: {"after_attempts": 3, "after_minutes": 10},
}

# 설계서 4절 각 편의 '선행 기초' 칸을 옮긴 것(편 시작 화면 추천용)
LECTURE_PREREQ_UNITS = {
    "L01": ["F-P1", "F-P2", "F-P3", "F-P4", "F-P6", "F-P8", "F-M1", "F-M2", "F-M3"],
    "L02": ["F-P5", "F-P7", "F-P9", "F-M3", "F-M4", "F-M6"],
    "L03": ["F-P9", "F-M4", "F-M6"],
    "L04": ["F-M5", "F-M3"],
    "L05": ["F-M2", "F-M5", "F-M6", "F-P9"],
    "L06": ["F-P6", "F-P9"],
    "L07": ["F-M6", "F-M4", "F-P6", "F-P7"],
    "L08": [],
    "L09": ["F-P5", "F-P7"],
    "L10": ["F-P6", "F-M6"],
}

errors = []


def err(msg):
    errors.append(msg)


def load(name):
    return load_file(os.path.join(SRC, name))


def code_lines(code):
    if code is None:
        return []
    return code.strip("\n").split("\n")


def clean(code):
    if code is None:
        return None
    return code.strip("\n")


def make_hints(target_id, hints, levels_required):
    out = []
    levels = [h["level"] for h in hints]
    if levels != levels_required:
        err(f"{target_id}: 힌트 단계 {levels} (필요 {levels_required})")
    for h in hints:
        lv = h["level"]
        d = {
            "hint_id": f"{target_id}-H{lv}",
            "target_id": target_id,
            "level": lv,
            "text_ko": h["text_ko"],
            "code_with_blanks": clean(h.get("code_with_blanks")) if lv == 3 else None,
            "unlock": dict(UNLOCK[lv]),
        }
        if lv == 4:
            d["show_solution"] = True
        if "points_to" in h:
            pt = h["points_to"]
            # unit_id/step_id 같은 id 칸 이름을 쓰면 검사 도구가 새 객체로 오해하므로 다른 이름을 쓴다
            d["points_to_id"] = pt.get("step_id") or pt.get("unit_id")
            if pt.get("card_line"):
                d["points_to_card_line"] = pt["card_line"]
        if lv == 3:
            d["blank_answers"] = h.get("blank_answers", [])
            d["blank_filled_output"] = h.get("blank_filled_output")
            cwb = d["code_with_blanks"] or d["text_ko"]
            if cwb.count("___") != len(d["blank_answers"]):
                err(f"{d['hint_id']}: 빈칸 {cwb.count('___')}개, 답 {len(d['blank_answers'])}개")
        out.append(d)
    return out


def est_minutes(unit_steps, n_questions):
    # 설계서 3-4: 코드 단계 4분 + 새 줄마다 1분 + 문제 4분. 설명 카드 3분, 익힘 과제 10분은 작성자 추정.
    m = sum(4 + s["new_code_lines"] for s in unit_steps) + 4 * n_questions
    return m + 3 + 10


def build():
    """조각을 합친 정본(dict). 형식 규칙을 어기면 BuildError."""
    errors.clear()
    with folder_on_path(SRC):
        doc = assemble()
    scan_em_dash(doc)
    check_ids(doc)
    if errors:
        raise BuildError(list(errors))
    return doc


def serialize(doc):
    return json.dumps(doc, ensure_ascii=False, indent=1)


def assemble():
    lecture_objectives = []
    units_out = []
    steps_out = []
    questions_out = []
    rebuild_out = []
    hints_out = []
    order = 0

    for uid in UNIT_ORDER:
        fname = "u_" + uid.replace("-", "_") + ".py"
        if not os.path.exists(os.path.join(SRC, fname)):
            err(f"{uid}: 조각 파일 없음 ({fname})")
            continue
        U = load(fname).UNIT
        assert U["unit_id"] == uid, uid
        obj_id = f"{uid}-O1"
        lecture_objectives.append({"objective_id": obj_id, "unit_id": uid, "text_ko": U["goal_ko"]})
        n_card = len(U["card_ko"])
        if not 5 <= n_card <= 8:
            err(f"{uid}: 설명 카드 {n_card}문장 (5~8)")

        u_steps = []
        num = 0
        for s in U["steps"]:
            order += 1
            # 쪼갠 단계(data-spec 1절): sub가 "b", "c"면 앞 단계 번호 뒤에 붙인다(예: F-P8-S1b)
            if s.get("sub"):
                sid = f"{uid}-S{num}{s['sub']}"
            else:
                num += 1
                sid = f"{uid}-S{num}"
            lines = code_lines(s["code"])
            notes = s["notes"]
            if len(lines) != len(notes):
                err(f"{sid}: 코드 {len(lines)}줄, 풀이 {len(notes)}개")
            n_new = len(lines)
            if n_new > 10:
                err(f"{sid}: 새 코드 {n_new}줄 (10 초과)")
            long_step = 6 <= n_new <= 10
            title = s["title_ko"] + (" (긴 단계)" if long_step else "")
            edits = s.get("edits", [])
            n_edit = sum(e["line_count"] for e in edits)
            rest = len(lines) - n_edit
            cells = s.get("cells") or ([rest] if rest else [])
            if sum(cells) != rest:
                err(f"{sid}: 셀 줄 수 합 {sum(cells)} != 새 셀 줄 {rest}")
            hints = make_hints(sid, s["hints"], [1, 2])
            check = dict(s.get("check") or {"type": "output_match", "mode": "exact"})
            exp_out = clean(s["expected_output"])
            exp_err = s.get("expected_error")
            # cc-tools run_code.py 호환 칸: 단계 code 전체를 셀 하나로 돌려 대조하는 도구라서,
            # 실행 순서가 따로 있거나(run_plan) 에러 뒤에 다른 셀 출력이 있는 단계는 기준 출력을 주지 않는다.
            tool_ok = s.get("run_plan") is None and not s.get("tool")
            tool_exp = exp_out
            if exp_err:
                lines_o = exp_out.split("\n")
                if lines_o[-1].startswith(exp_err.split(":")[0]):
                    tool_exp = "\n".join(lines_o[:-1])
                else:
                    tool_ok = False
            if check["type"] == "output_match" and tool_ok:
                if check.get("mode", "exact") in ("exact", "contains_lines"):
                    check["expected"] = tool_exp
                    check["match"] = "exact"
            if check["type"] == "value_range" and check.get("checks"):
                c0 = check["checks"][0]
                check.update({"expr": c0["expr"], "min": c0["min"], "max": c0["max"]})
            if s.get("tool"):
                check.update(s["tool"])
            step = {
                "step_id": sid,
                "lecture_id": LECTURE_ID,
                "unit_id": uid,
                "order": order,
                "title_ko": title,
                "video_segments": [],
                "long_step": long_step,
                "new_code_lines": n_new,
                "prepared_code": None,
                "prepared_code_line_notes_ko": [],
                "prepared_code_source_ko": None,
                "edits": edits,
                "rerun_first": s.get("rerun_first", []),
                "moved_code_lines": 0,
                "kind": "code",
                "input_ko": s["input_ko"],
                "code": clean(s["code"]),
                "code_line_notes_ko": notes,
                "cell_line_counts": cells,
                "run_plan": s.get("run_plan"),
                "expected_ko": s["expected_ko"],
                "expected_output_example": exp_out,
                "expected_check": check,
                "meaning_ko": s["meaning_ko"],
                "objective_ids": [obj_id],
                "hint_ids": [h["hint_id"] for h in hints],
            }
            if exp_err:
                step["expected_error"] = exp_err
            if s.get("restart_first"):
                step["restart_first"] = True
            if s.get("place_before"):
                step["place_before"] = s["place_before"]
            if s.get("self_check_ko"):
                step["self_check_ko"] = s["self_check_ko"]
            u_steps.append(step)
            hints_out.extend(hints)
        steps_out.extend(u_steps)
        last_step = u_steps[-1]["step_id"] if u_steps else None

        u_qids = []
        for i, q in enumerate(U["questions"], 1):
            qid = f"{uid}-Q{i}"
            u_qids.append(qid)
            hints = make_hints(qid, q["hints"], [1, 2, 3, 4])
            qq = question_obj(qid, uid, q, obj_id, last_step)
            qq["hint_ids"] = [h["hint_id"] for h in hints]
            questions_out.append(qq)
            hints_out.extend(hints)

        r = U["rebuild"]
        rid = f"{uid}-R1"
        rlines = code_lines(r["solution_code"])
        if len(rlines) != len(r["solution_notes"]):
            err(f"{rid}: 풀이 코드 {len(rlines)}줄, 풀이 {len(r['solution_notes'])}개")
        rhints = make_hints(rid, r["hints"], [1, 2, 3, 4])
        rebuild_out.append({
            "rebuild_id": rid,
            "lecture_id": LECTURE_ID,
            "unit_id": uid,
            "title_ko": r["title_ko"],
            "prompt_ko": r["prompt_ko"],
            "check": r.get("check") or {
                "type": "output_match",
                "mode": "exact",
                "reference": "아래 expected_output_example(정답 코드를 실제로 실행한 출력)",
            },
            "max_hint_level_for_pass": 2,
            "required_for_mastery": False,
            "solution_code": clean(r["solution_code"]),
            "solution_code_line_notes_ko": r["solution_notes"],
            "cell_line_counts": r.get("cells") or [len(rlines)],
            "expected_output_example": clean(r["expected_output"]),
            "self_check_ko": r["self_check_ko"],
            "hint_ids": [h["hint_id"] for h in rhints],
        })
        hints_out.extend(rhints)

        units_out.append({
            "unit_id": uid,
            "kind": U["kind"],
            "title_ko": U["title_ko"],
            "goal_ko": U["goal_ko"],
            "analogy_ko": U["analogy_ko"],
            "card_ko": U["card_ko"],
            "needed_by_lectures": U["needed_by"],
            "recommend_first": U.get("recommend_first", False),
            "objective_ids": [obj_id],
            "step_ids": [s["step_id"] for s in u_steps],
            "question_ids": u_qids,
            "rebuild_ids": [rid],
            "estimated_minutes": est_minutes(u_steps, len(u_qids)),
        })

    D = load("diag.py")
    diag_q = []
    for q in D.DIAG:
        qid = q["id"]
        qq = question_obj(qid, "F-DIAG", q, None, None)
        qq["hint_ids"] = []
        qq["recommend_units_if_wrong"] = q["recommend"]
        qq["measures_ko"] = q["measures_ko"]
        qq["scored"] = False
        if q["type"] == "choice":
            qq["dont_know_index"] = len(q["choices"]) - 1
            if q["choices"][-1] != "모르겠어요":
                err(f"{qid}: 마지막 보기가 '모르겠어요'가 아님")
        else:
            qq["allow_dont_know"] = True
        qq.pop("after_step", None)
        qq.pop("objective_ids", None)
        diag_q.append(qq)
    questions_out = diag_q + questions_out

    lecture = {
        "lecture_id": LECTURE_ID,
        "title_ko": "사전 기초: 강의 전에 익히는 파이썬과 수학",
        "video_url": None,
        "youtube_video_id": None,
        "video_seconds": 0,
        "video_minutes": 0,
        "source_repos": [],
        "env": ["cpu"],
        "objectives": lecture_objectives,
        "prereq_units": [],
        "prereq_lectures": [],
        "mastery_rule_id": "foundation_unit",
        "research_status": "merged",
        "intro_ko": D.INTRO_KO,
        "units": units_out,
        "diagnostic": D.DIAGNOSTIC_INFO,
        "recommend_rules": D.RECOMMEND_RULES,
        "lecture_prereq_units": LECTURE_PREREQ_UNITS,
    }

    mastery_rule = {
        "mastery_rule_id": "foundation_unit",
        "applies_to": "unit",
        "steps_complete_ratio": 1.0,
        "question_score_ratio": 0.8,
        "rebuild_max_hint_level": 2,
        "rebuild_required": False,
        "extra_checks": [],
        "note_ko": "기초 단위마다 따로 판정한다. 실습(쪼갠 단계 포함)을 모두 실행하고 단위 문제 3개의 점수 비율(힌트 반영)이 0.8 이상이면 mastered. 익힘 과제는 권장이며 판정에 넣지 않는다. 기초 단위는 강의를 잠그지 않는다(설계서 2-1).",
    }

    meta_mod = load("meta.py")
    meta = meta_mod.META
    vr = os.path.join(SRC, "_verify_result.json")
    if os.path.exists(vr):
        with open(vr, encoding="utf-8") as f:
            meta["verification"] = json.load(f)
    meta["counts"] = {
        "units": len(units_out),
        "steps": len(steps_out),
        "questions_unit": len(questions_out) - len(diag_q),
        "questions_diagnostic": len(diag_q),
        "rebuild_tasks": len(rebuild_out),
        "hints": len(hints_out),
    }
    meta.update(meta_mod.CHANGELOG)

    doc = {
        "_meta": meta,
        "lecture": lecture,
        "steps": steps_out,
        "questions": questions_out,
        "rebuild_tasks": rebuild_out,
        "mastery_rule": mastery_rule,
        "hints": hints_out,
    }
    return doc


def question_obj(qid, uid, q, obj_id, after_step):
    qq = {
        "question_id": qid,
        "lecture_id": LECTURE_ID,
        "unit_id": uid,
        "type": q["type"],
        "prompt_ko": q["prompt_ko"],
        "code": clean(q.get("code")),
    }
    if q["type"] == "choice":
        ch = q["choices"]
        ai = q["answer_index"]
        if len(ch) < 2 or not (0 <= ai < len(ch)):
            err(f"{qid}: 보기 {len(ch)}개, 정답 번호 {ai}")
        qq["choices"] = ch
        qq["answer_index"] = ai
        qq["auto_grade"] = {"type": "choice"}
    else:
        qq["auto_grade"] = q["auto_grade"]
    qq["answer_ko"] = q["answer_ko"]
    qq["rubric"] = q["rubric"]
    qq["max_points"] = 1
    pts = round(sum(r["point"] for r in q["rubric"]), 6)
    if pts != 1:
        err(f"{qid}: 채점 기준 점수 합 {pts} != 1")
    if not q["answer_ko"] or not q["rubric"]:
        err(f"{qid}: answer_ko 또는 rubric 없음")
    qq["must_pass"] = q.get("must_pass", False)
    qq["alternate_of"] = None
    qq["scored"] = True
    qq["after_step"] = after_step
    qq["objective_ids"] = [obj_id] if obj_id else []
    if q.get("answer_code"):
        al = code_lines(q["answer_code"])
        if len(al) != len(q["answer_notes"]):
            err(f"{qid}: 정답 코드 {len(al)}줄, 풀이 {len(q['answer_notes'])}개")
        qq["answer_code"] = clean(q["answer_code"])
        qq["answer_code_line_notes_ko"] = q["answer_notes"]
        qq["answer_output"] = clean(q.get("answer_output"))
        # 학습자가 입력 칸에 무엇을 쓰는지: output = 고친(만든) 코드의 실행 결과, answer_text = 글로 쓴 답, rubric = 자기 채점
        if q.get("graded_on"):
            qq["graded_on"] = q["graded_on"]
        elif q["auto_grade"]["type"] == "manual":
            qq["graded_on"] = "rubric"
        else:
            qq["graded_on"] = "output"
    if q.get("verify_code"):
        qq["verify_code"] = clean(q["verify_code"])
        qq["verify_output"] = clean(q.get("verify_output"))
    return qq


def scan_em_dash(obj, path="$"):
    if isinstance(obj, str):
        if EM_DASH in obj:
            err(f"긴 줄표: {path}")
    elif isinstance(obj, dict):
        for k, v in obj.items():
            scan_em_dash(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            scan_em_dash(v, f"{path}[{i}]")


def check_ids(doc):
    ids = set()
    for k, key in [("steps", "step_id"), ("questions", "question_id"), ("rebuild_tasks", "rebuild_id"), ("hints", "hint_id")]:
        for x in doc[k]:
            if x[key] in ids:
                err(f"id 중복: {x[key]}")
            ids.add(x[key])
    for h in doc["hints"]:
        if h["target_id"] not in ids:
            err(f"{h['hint_id']}: 대상 없음")
    step_ids = {s["step_id"] for s in doc["steps"]}
    for s in doc["steps"]:
        for r in s["rerun_first"]:
            if r not in step_ids:
                err(f"{s['step_id']}: rerun_first {r} 없음")
        for e in s["edits"]:
            if e["target_step"] not in step_ids:
                err(f"{s['step_id']}: edits 대상 {e['target_step']} 없음")
    for q in doc["questions"]:
        if q.get("after_step") and q["after_step"] not in step_ids:
            err(f"{q['question_id']}: after_step 없음")
