"""Z2H 콘텐츠 빌더: l01_source.py, l01_extra.py, taster_source.py -> L01.json, taster.json, 마크다운 조각.
실행: python3 build_content.py  (pedagogy/content 폴더에서)"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import l01_source as S, l01_extra as X, taster_source as T

UNLOCK = {1: {"after_attempts": 0, "after_minutes": None}, 2: {"after_attempts": 1, "after_minutes": None},
          3: {"after_attempts": 1, "after_minutes": 15}, 4: {"after_attempts": 1, "after_minutes": 30}}

def blankify(code, blanks):
    out = code
    for b in blanks:
        out = out.replace(b, "___", 1)
    return out

def step_code(st):
    lines = []
    for where, anchor, ls in st.get("edits", []):
        lines += ls
    lines += st["run"]
    return lines

def edits_of(st):
    """class_edit: Value 클래스 셀(L01-S04)에 줄 넣기. changed: 앞 단계 셀의 줄 바꾸기. 새 셀이면 []."""
    if st.get("changed"):
        return [{"target_step": "L01-S15b", "where_ko": "L01-S15b 셀의 grad 비우기 2줄", "action": "replace",
                 "anchor_line": None, "line_count": len(st["run"])}]
    if st.get("cell") != "class_edit":
        return []
    return [{"target_step": "L01-S04", "where_ko": w, "action": "insert",
             "anchor_line": None if a == "END" else a.strip(), "line_count": len(ls)} for w, a, ls in st["edits"]]

def l01():
    seg_index = S.SEG
    steps, hints = [], []
    for i, st in enumerate(S.STEPS, 1):
        lines = step_code(st)
        code = "\n".join(l for l, _ in lines)
        notes = [n for _, n in lines]
        moved = st.get("moved", 0)
        new = 0 if st.get("changed") else len(lines) - moved
        hid = [f"{st['id']}-H{k}" for k in range(1, 5)]
        step = {
            "step_id": st["id"], "lecture_id": "L01", "order": i, "title_ko": st["title"],
            "video_segments": [{"start_s": a, "end_s": b} for a, b in seg_index[st["seg"]]],
            "video_chapter_ko": S.SEGLABEL[st["seg"]],
            "long_step": 6 <= new <= 10, "new_code_lines": new, "moved_code_lines": moved,
            "prepared_code": None, "prepared_code_line_notes_ko": None,
            "kind": "code",
            "edits": edits_of(st),
            "rerun_first": st.get("rerun", []),
            "input_ko": st["input"], "code": code, "code_line_notes_ko": notes,
            "expected_ko": st["expected"], "expected_check": st["check"], "meaning_ko": st["meaning"],
            "objective_ids": st["obj"], "hint_ids": hid,
        }
        if st.get("prepared"):
            step["prepared_code"] = "\n".join(l for l, _ in S.PREPARED_DRAW_DOT)
            step["prepared_code_line_notes_ko"] = [n for _, n in S.PREPARED_DRAW_DOT]
            step["prepared_code_source_ko"] = "karpathy/nn-zero-to-hero lectures/micrograd 노트북의 draw_dot를 줄여 다듬은 것(label 칸 대신 data와 grad만 표시)"
        assert new <= 10, st["id"]
        steps.append(step)
        texts = [st["h1"], st["h2"], "빈칸을 채워 보세요.", f"정답 코드와 줄별 풀이를 봅니다. 흔한 원인: {st['mistake']}"]
        for k in range(1, 5):
            hints.append({"hint_id": hid[k-1], "target_id": st["id"], "level": k, "text_ko": texts[k-1],
                          "code_with_blanks": blankify(code, st["blanks"]) if k == 3 else None,
                          "show_solution": k == 4, "unlock": UNLOCK[k]})
    questions = []
    for q in X.QUESTIONS:
        hid = [f"{q['id']}-H{k}" for k in range(1, 5)] if q.get("h") else []
        item = {"question_id": q["id"], "lecture_id": "L01", "type": q["type"], "after_step": q["after"],
                "prompt_ko": q["prompt"], "code": q.get("code"), "answer_ko": q["answer"]}
        if q["type"] == "choice":
            item["choices"] = q["choices"]; item["answer_index"] = q["answer_index"]
            item["auto_grade"] = {"type": "choice"}
        else:
            item["auto_grade"] = q["grade"]
        item.update({"rubric": [{"point": p, "criterion_ko": c} for p, c in q["rubric"]], "max_points": 1,
                     "must_pass": False, "objective_ids": q["obj"], "hint_ids": hid})
        questions.append(item)
        for k, txt in enumerate(q.get("h", []), 1):
            hints.append({"hint_id": hid[k-1], "target_id": q["id"], "level": k, "text_ko": txt,
                          "code_with_blanks": txt if k == 3 else None, "show_solution": k == 4, "unlock": UNLOCK[k]})
    rebuilds = []
    for r in X.REBUILDS:
        hid = [f"{r['id']}-H{k}" for k in range(1, 5)]
        rebuilds.append({"rebuild_id": r["id"], "lecture_id": "L01", "title_ko": r["title"], "task_ko": r["task"],
                         "check": r["check"], "max_hint_level_for_pass": 2, "hint_ids": hid})
        for k, txt in enumerate(r["h"], 1):
            hints.append({"hint_id": hid[k-1], "target_id": r["id"], "level": k, "text_ko": txt,
                          "code_with_blanks": txt if k == 3 else None, "show_solution": k == 4, "unlock": UNLOCK[k]})
    lecture = {"lecture_id": "L01", "title_ko": "micrograd: 신경망과 역전파를 손으로 만들기",
               "video_url": "https://www.youtube.com/watch?v=VMj-3S1tku0", "youtube_video_id": S.V,
               "video_seconds": 8752, "video_minutes": 146, "source_repos": ["karpathy/micrograd", "karpathy/nn-zero-to-hero"],
               "env": ["cpu"], "objectives": [{"objective_id": a, "text_ko": b} for a, b in X.OBJECTIVES],
               "prereq_units": ["F-P1", "F-P2", "F-P5", "F-P6", "F-P7", "F-M1", "F-M2", "F-M6"],
               "prereq_units_optional": ["F-P3", "F-P4", "F-P8"], "prereq_lectures": [],
               "mastery_rule_id": "L01", "research_status": "merged", "rewards": X.REWARDS}
    return {"_meta": {"version": "1.2", "created_kst": "2026-11-16", "schema": "pedagogy/data-spec.md 2절",
                      "generated_by": "pedagogy/content/build_content.py", "video_policy": "D16 youtube-nocookie 임베드, 자동 재생 없음, 유튜브에서 열기 대체 링크"},
            "lecture": lecture, "steps": steps, "questions": questions, "rebuild_tasks": rebuilds,
            "mastery_rule": X.MASTERY, "hints": hints}

def taster():
    outs = json.load(open(os.path.join(HERE, "taster_outputs.json")))
    steps, hints = [], []
    for i, st in enumerate(T.STEPS, 1):
        code = "\n".join(l for l, _ in st["run"])
        hid = [f"{st['id']}-H{k}" for k in range(1, 5)]
        s = {"step_id": st["id"], "lecture_id": "TASTER", "order": i, "title_ko": st["title"], "minutes": st["minutes"],
             "video_segments": [], "long_step": False, "new_code_lines": 0, "moved_code_lines": 0, "cell_code_lines": len(st["run"]),
             "prepared_code": None, "edits": [], "rerun_first": [], "kind": st["kind"], "input_ko": st["input"], "code": code,
             "code_line_notes_ko": [n for _, n in st["run"]],
             "code_alt_local": "\n".join(l for l, _ in st["alt_local"]) if st.get("alt_local") else None,
             "code_alt_local_line_notes_ko": [n for _, n in st["alt_local"]] if st.get("alt_local") else None,
             "expected_ko": st["expected"], "expected_output_example": outs.get(st.get("outkey")) if st.get("outkey") else None,
             "expected_check": {"type": "manual"}, "meaning_ko": st["aha"], "aha_ko": st["aha"],
             "summary_ko": st.get("summary"), "objective_ids": [], "hint_ids": hid,
             "question_ids": [q["id"] for q in T.QUESTIONS if q["after"] == st["id"]]}
        steps.append(s)
        names = ["질문", "짚어 주기", "처음 상태로 되돌리기", "예상 출력 전체와 HELP"]
        for k, txt in enumerate(st["h"], 1):
            hints.append({"hint_id": hid[k-1], "target_id": st["id"], "level": k, "text_ko": txt,
                          "code_with_blanks": None, "show_solution": k == 4, "taster_role_ko": names[k-1], "unlock": UNLOCK[k]})
    qs = []
    for q in T.QUESTIONS:
        hid = [f"{q['id']}-H{k}" for k in range(1, len(q["h"]) + 1)]
        qs.append({"question_id": q["id"], "lecture_id": "TASTER", "type": "choice", "after_step": q["after"],
                   "prompt_ko": q["prompt"], "code": None, "choices": q["choices"], "answer_index": q["answer_index"],
                   "answer_ko": q["answer"], "auto_grade": {"type": "choice"},
                   "rubric": [{"point": 1, "criterion_ko": "정답 보기 선택"}], "max_points": 1, "scored": False,
                   "must_pass": False, "objective_ids": [], "hint_ids": hid})
        for k, txt in enumerate(q["h"], 1):
            hints.append({"hint_id": hid[k-1], "target_id": q["id"], "level": k, "text_ko": txt,
                          "code_with_blanks": None, "show_solution": False, "unlock": UNLOCK[k]})
    course = {"lecture_id": "TASTER", "title_ko": "맛보기: 30분 첫 성공", "env": ["colab"], "minutes": sum(s["minutes"] for s in T.STEPS),
              "video_segments": [], "notebook_ko": "앱이 주는 맛보기 노트북(셀 T-S02~T-S07, CTO 제작). 코드는 이 파일의 code 그대로",
              "verified_kst": "2026-11-16, PyTorch 2.x CPU, 전체 실행 약 7초", "completion_rule": T.COMPLETION, "artifact": T.ARTIFACT,
              "next_ko": ["진단 5문제(00-foundations.md)", "00 사전 기초", "01 micrograd", "02 바이그램"]}
    return {"_meta": {"version": "1.2", "created_kst": "2026-11-16", "schema": "pedagogy/data-spec.md 2절(kind copy_run 추가)",
                      "generated_by": "pedagogy/content/build_content.py"},
            "lecture": course, "steps": steps, "questions": qs, "hints": hints}

if __name__ == "__main__":
    a, b = l01(), taster()
    json.dump(a, open(os.path.join(HERE, "L01.json"), "w"), ensure_ascii=False, indent=1)
    json.dump(b, open(os.path.join(HERE, "taster.json"), "w"), ensure_ascii=False, indent=1)
    print("L01 steps", len(a["steps"]), "questions", len(a["questions"]), "hints", len(a["hints"]))
    print("taster steps", len(b["steps"]), "questions", len(b["questions"]), "hints", len(b["hints"]))

# ---------- 마크다운 렌더 ----------
def hms(s):
    if s is None: return "영상 끝"
    return f"{s//3600}:{s%3600//60:02d}:{s%60:02d}"

def code_table(code, notes):
    rows = ["| 줄 | 코드 | 풀이 |", "|---|---|---|"]
    for i, (c, n) in enumerate(zip(code.split("\n"), notes), 1):
        c2 = c.replace("|", "\\|")
        lead = len(c2) - len(c2.lstrip(" "))
        rows.append(f"| {i} | `{'·' * lead}{c2.lstrip(' ')}` | {n} |")
    return "\n".join(rows)

GRADE_KO = {"numeric_range": "숫자 범위", "exact": "정확히 일치", "keywords": "핵심어", "choice": "객관식", "manual": "직접 확인", "value_range": "값 범위", "output_match": "출력 일치"}
TYPE_KO = {"predict": "예측", "explain": "설명", "fix_bug": "버그", "apply": "적용", "choice": "객관식"}

def check_ko(c):
    t = c.get("type")
    if t == "value_range": return f"값 범위 {c['min']} ~ {c['max']}" + (f" ({c['target']})" if c.get("target") else "")
    if t == "output_match": return f"출력 일치 `{c['value']}`"
    if c.get("values"): return "직접 확인(앱 점검값: " + ", ".join(f"{k} = {v}" for k, v in c["values"].items()) + ")"
    return "직접 확인(학습자가 '보여야 하는 것'과 비교)"

def render_l01(d):
    H = {h["hint_id"]: h for h in d["hints"]}
    out = []
    out.append("형식: 단계마다 영상 구간, 새 코드 줄 수, 입력할 것, 코드와 줄별 풀이, 보여야 하는 것, 뜻, 힌트 H1~H4를 둡니다. 이 절은 `pedagogy/content/l01_source.py`에서 `build_content.py`로 만든 것이며, 같은 내용이 `pedagogy/content/L01.json`에 있습니다. 고칠 때는 원본(l01_source.py)을 고치고 다시 만듭니다. 모든 코드는 교사 몽키가 2026-11-16에 학습자 순서대로 실행해 확인했습니다(`content/test_content.py`).\n")
    out.append("코드 표의 `·`는 띄어쓰기 한 칸입니다(앱 화면에서는 보통 공백으로 보입니다). 'Value 클래스 셀'은 S04에서 만든 셀이며, S05부터 그 셀 안에 줄을 더하고 다시 실행합니다. 클래스를 고친 뒤에는 그 전에 만든 Value 상자들이 옛 설계도를 쓰므로, '먼저 다시 실행'에 적힌 셀을 다시 돌립니다.\n")
    for s in d["steps"]:
        title = f"**{s['step_id']} {s['title_ko']}" + (" (긴 단계)" if s["long_step"] else "") + "**"
        out.append(title)
        segs = ", ".join(f"{hms(v['start_s'])} ~ {hms(v['end_s'])}" for v in s["video_segments"])
        out.append(f"- 영상 구간: {segs} (챕터 {s['video_chapter_ko']}, video-segments.json과 같음)")
        nl = f"- 새 코드: {s['new_code_lines']}줄"
        if s["long_step"]: nl += " (긴 단계: 나누면 뜻이 끊겨 한 단계로 둡니다)"
        if s["moved_code_lines"]: nl += f", 옮겨 붙이는 줄 {s['moved_code_lines']}줄(S11에서 쓴 줄, 새로 생각할 것 없음)"
        rep_ = [e for e in s["edits"] if e["action"] == "replace"]
        if rep_: nl += " (기존 줄 2개 앞에 `#`만 붙임)"
        mode = "새 셀" if not s["edits"] else ("앞 단계 셀 고치기" if rep_ else "Value 클래스 셀(L01-S04) 고치기")
        out.append(nl + f". 셀: {mode}.")
        if s["edits"]:
            ins = [e for e in s["edits"] if e["action"] == "insert"]
            if ins: out.append("- 넣을 곳: " + " / ".join(f"{e['where_ko']}에 {e['line_count']}줄" for e in ins) + ". 아래 코드 표의 앞 줄들이 넣을 줄이고(넣을 곳 순서대로), 그 뒤 줄은 새 셀에 칩니다.")
            if rep_: out.append("- 바꿀 곳: " + rep_[0]["where_ko"])
        if s["rerun_first"]:
            out.append("- 먼저 다시 실행: " + ", ".join(s["rerun_first"]) + " 셀")
        if s["prepared_code"]:
            out.append("- 준비 코드(붙여 넣기만, 외울 필요 없음, 확인 문제와 재구성 과제에 나오지 않음): " + s["prepared_code_source_ko"])
            out.append("\n<details><summary>준비 코드 draw_dot 줄별 풀이</summary>\n\n" + code_table(s["prepared_code"], s["prepared_code_line_notes_ko"]) + "\n\n</details>\n")
        out.append(f"- 입력: {s['input_ko']}")
        if s["code"]:
            out.append("\n" + code_table(s["code"], s["code_line_notes_ko"]) + "\n")
        out.append(f"- 보여야 하는 것: {s['expected_ko']}")
        out.append(f"- 점검 방식: {check_ko(s['expected_check'])}")
        out.append(f"- 뜻: {s['meaning_ko']}")
        h = [H[i] for i in s["hint_ids"]]
        out.append(f"- 힌트: H1 \"{h[0]['text_ko']}\" / H2 \"{h[1]['text_ko']}\" / H3 빈칸 코드(아래) / H4 {h[3]['text_ko']}")
        out.append("\n```python\n" + h[2]["code_with_blanks"] + "\n```\n")
    return "\n".join(out)

def render_l01_questions(d):
    H = {h["hint_id"]: h for h in d["hints"]}
    out = ["채점: 문항마다 1점, 11점 만점. 예측 문제는 실행 전에 맞히는 문제라 힌트가 없습니다(hints.md 2절). 객관식은 `choices`와 `answer_index`(0부터 셈)로 자동 채점, 설명 문제는 핵심어 자동 채점 뒤 애매하면 직접 확인(rubric)합니다. 힌트 반영은 hints.md 3절. 같은 내용이 `content/L01.json`의 questions에 있습니다.\n",
           "| 번호 | 유형 | 나오는 때 | 문제 | 정답 | 채점 |", "|---|---|---|---|---|---|"]
    for q in d["questions"]:
        g = q["auto_grade"]
        if g["type"] == "choice": gk = f"객관식, 정답 {q['answer_index'] + 1}번(answer_index {q['answer_index']})"
        elif g["type"] == "numeric_range": gk = f"숫자 범위 {g['min']} ~ {g['max']}"
        elif g["type"] == "exact": gk = f"정확히 {g['value']}"
        else: gk = "핵심어(" + "; ".join("/".join(k) for k in g["keywords"]) + "), 애매하면 직접 확인"
        out.append(f"| {q['question_id']} | {TYPE_KO[q['type']]} | {q['after_step']} 뒤 | {q['prompt_ko']} | {q['answer_ko']} | {gk} |")
    out.append("")
    for q in d["questions"]:
        if q["type"] == "choice" or q["hint_ids"] or q.get("code"):
            out.append(f"**{q['question_id']}**")
            if q.get("code"): out.append("\n```python\n" + q["code"] + "\n```\n")
            if q["type"] == "choice":
                out.append("- 보기: " + " / ".join(f"({i+1}) {c}" for i, c in enumerate(q["choices"])) + f". 정답 ({q['answer_index']+1}).")
            out.append("- 채점 기준: " + "; ".join(f"{r['point']}점 {r['criterion_ko']}" for r in q["rubric"]))
            if q["hint_ids"]:
                h = [H[i]["text_ko"] for i in q["hint_ids"]]
                out.append(f"- 힌트: H1 \"{h[0]}\" / H2 \"{h[1]}\" / H3 {h[2]} / H4 {h[3]}")
            out.append("")
    return "\n".join(out)

def render_l01_rebuild(d):
    H = {h["hint_id"]: h for h in d["hints"]}
    out = ["빈 노트북에서 다음 3조각을 다시 만듭니다. 각 조각은 H2 이하여야 합니다(H3, H4는 열리지만 쓰면 통과가 아니라 연습으로 기록).\n"]
    for r in d["rebuild_tasks"]:
        h = [H[i]["text_ko"] for i in r["hint_ids"]]
        out.append(f"**{r['rebuild_id']} {r['title_ko']}**")
        out.append(f"- 과제: {r['task_ko']}")
        c = r["check"]
        out.append(f"- 점검: {c.get('test_ko') or check_ko(c)}" + (f" (대조: {c['reference']})" if c.get("reference") else ""))
        out.append(f"- 힌트: H1 \"{h[0]}\" / H2 \"{h[1]}\" / H3 {h[2]} / H4 {h[3]}\n")
    out.append("정답 대조: 원본 karpathy/micrograd의 `engine.py`, `nn.py`와 기능 비교(결과 숫자 비교). 원본 `nn.py`는 tanh 대신 relu를 쓰고 `Module` 부모 클래스와 `zero_grad()`가 있으니 앱이 그 차이를 알려 줍니다.\n")
    out.append("선택 심화: 영상 설명란의 연습 Colab(research/01 4절 링크). 문항 내용은 아직 열어 보지 않아 앱 반영은 확인 뒤에 합니다.")
    return "\n".join(out)

def render_taster(d):
    H = {h["hint_id"]: h for h in d["hints"]}
    L = d["lecture"]; C = L["completion_rule"]; A = L["artifact"]
    o = ["# 맛보기: 30분 첫 성공 (TASTER)", "",
         "작성: 교사 몽키, 2026-11-16 KST (v1.2, CEO 결정 2026-11-16 20:19 KST로 구현 가능한 수준까지 채움). 이 파일은 `pedagogy/content/taster_source.py`에서 `build_content.py`로 만든 것이며 같은 내용이 `pedagogy/content/taster.json`에 있습니다. 고칠 때는 원본을 고치고 다시 만듭니다. 가치 설명(왜 맛보기인가, 배지와의 관계)은 VALUE_CURRICULUM.md 2절, 3절에 있습니다.", "",
         f"- 환경: Google Colab(개인 Google 계정, 설치 없음). 영상 없음. 총 {L['minutes']}분.",
         f"- 확인: {L['verified_kst']}. `content/test_content.py`가 taster.json의 코드를 그대로 실행해 아래 '출력 예'와 글자 하나까지 같음을 확인했습니다(`!wget` 줄은 미리 받은 파일로 대신함).",
         "- 코드 규칙: 모든 셀은 복사해 실행만 합니다(`kind: copy_run`). 학습자가 새로 치는 코드는 0줄(`new_code_lines: 0`)이고, 셀 줄 수는 `cell_code_lines`에 적습니다. 화면의 코드는 주석 없이 보여 주고, 줄별 풀이는 옆 칸에 둡니다.",
         "- 힌트 사다리(맛보기용): H1 질문, H2 짚어 주기(흔한 원인), H3 처음 상태로 되돌리기(원래 코드 다시 붙여 넣고 위에서부터 실행), H4 예상 출력 전체와 HELP 안내. 맛보기는 익힘 판정이 없어 빈칸 코드 힌트는 쓰지 않습니다. 열리는 조건은 hints.md 2절과 같습니다.", "",
         "## 1. 단계 한눈에", "", "| 단계 | 시간 | 할 일 | 보이는 것 | 깨달음 한 줄 |", "|---|---|---|---|---|"]
    for s in d["steps"]:
        o.append(f"| {s['step_id']} | {s['minutes']}분 | {s['title_ko']} | {s['expected_ko']} | {s['aha_ko']} |")
    o += ["", "## 2. 단계별 상세", ""]
    for s in d["steps"]:
        o.append(f"### {s['step_id']} {s['title_ko']} ({s['minutes']}분)")
        o.append(f"- 종류: {'복사해 실행' if s['kind'] == 'copy_run' else '읽기'}. 새로 치는 코드 0줄" + (f", 셀 {s['cell_code_lines']}줄." if s["cell_code_lines"] else "."))
        o.append(f"- 할 일: {s['input_ko']}")
        if s["code"]:
            o.append("\n" + code_table(s["code"], s["code_line_notes_ko"]) + "\n")
        if s.get("code_alt_local"):
            o.append("- 맥미니 Jupyter 등 Colab이 아닌 곳에서 쓸 대체 셀(`code_alt_local`):\n\n" + code_table(s["code_alt_local"], s["code_alt_local_line_notes_ko"]) + "\n")
        o.append(f"- 보여야 하는 것: {s['expected_ko']}")
        if s["expected_output_example"]:
            o.append("- 출력 예(처음부터 순서대로 실행했을 때, 2026-11-16 재실행):\n\n```\n" + s["expected_output_example"].strip() + "\n```\n")
        if s.get("summary_ko"): o.append(f"- 정리 화면 문구: \"{s['summary_ko']}\"")
        o.append(f"- 깨달음: {s['aha_ko']}")
        h = [H[i]["text_ko"] for i in s["hint_ids"]]
        o.append(f"- 힌트: H1 \"{h[0]}\" / H2 \"{h[1]}\" / H3 \"{h[2]}\" / H4 \"{h[3]}\"")
        for q in d["questions"]:
            if q["after_step"] == s["step_id"]:
                hh = [H[i]["text_ko"] for i in q["hint_ids"]]
                o.append(f"- 확인 질문 {q['question_id']}(객관식, 점수 없음): {q['prompt_ko']} 보기: " + " / ".join(f"({i+1}) {c}" for i, c in enumerate(q["choices"])) + f". 정답 ({q['answer_index']+1}), answer_index {q['answer_index']}. 풀이: {q['answer_ko']} 힌트: H1 \"{hh[0]}\" / H2 \"{hh[1]}\"")
        o.append("")
    o += ["## 3. 완료 조건", "",
          f"- 규칙 id: `{C['rule_id']}`. 필요한 단계: " + ", ".join(C["requires_steps"]) + ".",
          f"- 단계 완료: {C['step_done_when_ko']}",
          f"- 확인 질문: {C['questions_ko']}",
          f"- 결과: {C['result']}",
          f"- 마친 뒤: {C['on_complete_ko']}", "",
          "## 4. 공유 결과물: " + A["name_ko"], "",
          f"- id: `{A['artifact_id']}`, 열리는 때: {A['unlock_after']} 완료 뒤(맛보기 완료 전에도 만들 수 있음).",
          f"- 입력: {A['input_ko']}",
          "- 카드 칸: 제목 \"" + A["card_fields"]["title_ko"] + "\", 이름 목록(" + A["card_fields"]["names"] + "), 손실 줄(" + A["card_fields"]["loss_line_ko"] + "), 출처 \"" + A["card_fields"]["credit_ko"] + "\", 한 줄 \"" + A["card_fields"]["humble_line_ko"] + "\", 안내 \"" + A["card_fields"]["disclaimer_ko"] + "\".",
          "- X에 공유: 미리 채우는 글 \"" + A["x_compose"]["prefill_ko"] + "\". 이미지는 자동으로 붙지 않음(" + A["x_compose"]["note_ko"] + "), 자동 게시 없음.",
          f"- 형식: 이미지 {A['format']['image']}와 글 복사.",
          "- 안전: " + " ".join(A["safety_ko"]),
          f"- 공유: {A['share_ko']}", "",
          "## 5. 연결", "",
          "- 맛보기 T-S04~T-S07은 02편 S01~S16의 압축판입니다(02 학습 목표 2~5). T-S06의 `loss.backward()`와 `W.data += -50 * W.grad`가 01편에서 직접 만드는 역전파와 경사 하강입니다.",
          "- 정리 화면(T-S08)의 다음 길 단추: 진단 5문제, 00 사전 기초, 01 micrograd. 02편은 01편 뒤에 열립니다.",
          "- 미정(디자이너, CTO): Colab 출력은 앱이 읽지 못하므로 완료는 자기 확인이고, 공유 카드는 붙여 넣기로 받습니다. 맛보기 노트북 파일(.ipynb) 제작과 공개 위치는 CTO 담당입니다."]
    return "\n".join(o)

def write_md():
    a, b = l01(), taster()
    open("/tmp/z2h/L01_sec3.md", "w").write(render_l01(a))
    open("/tmp/z2h/L01_sec4.md", "w").write(render_l01_questions(a))
    open("/tmp/z2h/L01_sec5.md", "w").write(render_l01_rebuild(a))
    open(os.path.join(HERE, "..", "taster.md"), "w").write(render_taster(b) + "\n")

if __name__ == "__main__":
    write_md(); print("md written")
