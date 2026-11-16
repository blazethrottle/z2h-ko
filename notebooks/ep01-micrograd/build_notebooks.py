"""1편(micrograd) 학생용·정답용 노트북을 교사 정본에서 만든다. 노트북을 손으로 고치지 않는다.

    .venv/bin/python notebooks/ep01-micrograd/build_notebooks.py           # 두 노트북 다시 만들기
    .venv/bin/python notebooks/ep01-micrograd/build_notebooks.py --check   # 지금 파일이 최신인지 확인(다르면 종료 코드 1)

입력(읽기만 함)
- 교사 정본 inputs/pedagogy/content/L01.json: 단계 순서·id·제목·안내 글·코드. 문구는 고쳐 쓰지 않고 그대로 옮긴다.
- 채점 묶음 z2h_check/_bundle.py: 준비 셀에 내용 그대로 넣는다.

출처: 노트북의 코드는 교사 정본 그대로이며, 그 코드는 Andrej Karpathy의 karpathy/micrograd,
karpathy/nn-zero-to-hero(둘 다 MIT 라이선스)를 따라 만든 것이다. LICENSE 전문은 third_party/licenses/.

앞 셀을 고치는 단계(edits)는 교사 test_content.py 와 같은 순서로 합친다.
- 고칠 셀이 클래스 셀이면: 고친 셀 → 준비 코드 → rerun_first 칸 → 새 셀 (클래스를 고친 뒤 옛 Value 상자를 새로 만든다)
- 고칠 셀이 클래스가 아닌 셀이면(L01-S16 의 S15b 셀): rerun_first 칸 → 고친 셀 → 새 셀
정답 노트북은 그 순서대로 "고친 뒤의 셀 전체"와 다시 실행할 칸을 그 단계 자리에 다시 둔다.
학생 노트북은 같은 틀에 안내 글, 빈 셀, 채점 셀만 두고, 앞 셀은 학생이 그 자리에서 고친다.
"""
import argparse
import ast
import copy
import json
import os
import re
import sys

import nbformat

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CANON_FILE = os.path.join(ROOT, "inputs", "pedagogy", "content", "L01.json")
BUNDLE_FILE = os.path.join(ROOT, "z2h_check", "_bundle.py")
SOLUTION_FILE = os.path.join(HERE, "ep01_solution.ipynb")
STUDENT_FILE = os.path.join(HERE, "ep01_student.ipynb")

LECTURE_ID = "L01"
PLACEHOLDER = "# 여기에 작성"
SOURCE_LINE = ("출처: 코드는 Andrej Karpathy의 micrograd, nn-zero-to-hero(MIT 라이선스)를 따라 만든 것입니다. "
               "https://github.com/karpathy/micrograd · https://github.com/karpathy/nn-zero-to-hero")
VIDEO_PARAMS = "cc_load_policy=1&cc_lang_pref=ko&hl=ko"

# 채점 셀에서 부르는 모양. z2h_check/README.md "1편 호출 규약" 표 그대로이고, 정본 코드가 이름을 만들지 않는 칸만 바꿨다.
# - L01-S02: 정본 셀은 숫자 기울기를 이름 없이 마지막 줄로 보여 준다. 그래서 그 보여 준 값(IPython 의 Out 최근 값)을 넘긴다.
# - L01-S03: 정본 셀은 기울기를 print 로만 보여 준다. 그래서 셀이 만든 d1, d2, h 로 같은 식을 다시 계산해 넘긴다.
# - L01-S16: 눈으로 비교하는 단계(seen=True). 빈 노트북에서 "맞음"이 나오지 않게, 학습 셀이 만든 n, loss 가 있을 때만 부른다.
CHECK_CALLS = {
    "L01-S01": ['check("L01-S01", f)'],
    "L01-S02": ['check("L01-S02", _z2h_shown())   # 바로 위 셀의 마지막 줄이 보여 준 값(숫자 기울기)'],
    "L01-S03": ['check("L01-S03", (d2 - d1) / h)   # 위 셀이 만든 d1, d2, h 로 a에 대한 기울기를 다시 계산해 넘깁니다'],
    "L01-S04": ['check("L01-S04", Value)'],
    "L01-S05": ['check("L01-S05", Value)'],
    "L01-S06": ['check("L01-S06", draw_dot(d))   # graphviz를 못 쓰는 곳이면 이 줄을 check("L01-S06", seen=True) 로 바꿉니다'],
    "L01-S07": ['check("L01-S07", a=a, b=b, c=c, d=d, e=e, f=f, L=L)'],
    "L01-S08": ['check("L01-S08", L)'],
    "L01-S09": ['check("L01-S09", n, x1=x1, x2=x2, w1=w1, w2=w2, b=b)'],
    "L01-S09b": ['check("L01-S09b", Value, o=o)'],
    "L01-S10": ['check("L01-S10", Value)'],
    "L01-S10b": ['check("L01-S10b", Value)'],
    "L01-S11": ['check("L01-S11", topo, o)'],
    "L01-S11b": ['check("L01-S11b", Value)'],
    "L01-S12": ['check("L01-S12", Value)'],
    "L01-S13": ['check("L01-S13", Value)'],
    "L01-S13b": ['check("L01-S13b", Value)'],
    "L01-S13c": ['check("L01-S13c", Value)'],
    "L01-S13d": ['check("L01-S13d", Value)'],
    "L01-S13e": ['check("L01-S13e", x1=x1, x2=x2, w1=w1, w2=w2, b=b, o=o)   # torch가 없으면 "건너뜀"으로 나옵니다'],
    "L01-S14": ['check("L01-S14", Neuron)'],
    "L01-S14b": ['check("L01-S14b", Layer)'],
    "L01-S14c": ['check("L01-S14c", MLP)'],
    "L01-S15": ['check("L01-S15", n, loss)   # 학습(S15b) 전에 채점합니다'],
    "L01-S15b": ['check("L01-S15b", n, loss)'],
    "L01-S16": ['n, loss   # 학습 셀(L01-S15, L01-S15b)이 만든 n과 loss가 있을 때만 아래 표시를 합니다',
                'check("L01-S16", seen=True)   # 눈으로 비교하는 단계라 "봤어요" 표시'],
}

# 채점 셀이 절대 예외를 내지 않게 하는 도우미. 준비 셀의 z2h_check 묶음 바로 뒤에 붙인다.
PREP_TRAILER = '''

# ---- 여기부터는 이 노트북의 채점 셀 도우미입니다(z2h_check 묶음 밖, build_notebooks.py 가 붙임) ----
___ = None  # 빈칸(___)을 쓰는 노트북을 위한 자리(z2h_check/README.md)


class _Z2HNotShown(NameError):
    """바로 위 셀이 아직 값을 보여 주지 않았을 때."""


def _z2h_shown():
    """바로 앞에서 셀의 마지막 줄이 화면에 보여 준 값(IPython 의 Out 기록 중 가장 최근 것)을 돌려줍니다.
    위의 ___ = None 때문에 IPython 이 _ 를 더 이상 바꾸지 않으므로 _ 대신 Out 을 씁니다."""
    shown = globals().get("Out")
    if not shown:
        raise _Z2HNotShown("바로 위 셀이 보여 준 값이 아직 없습니다")
    return shown[max(shown)]


def _z2h_not_yet(check_id, err):
    """채점 셀에서 check(...)에 넘길 값이 아직 없거나 만들다 오류가 나면, 예외 대신 "○ 아직" 한 줄만 보여 줍니다.
    이때는 채점 기록을 남기지 않으므로 finish("L01") 채점표에는 "아직 안 함"으로 나옵니다."""
    try:
        if isinstance(err, _Z2HNotShown):
            print(f"○ 아직: 바로 위 단계 셀을 먼저 실행한 뒤 이 채점 셀을 다시 실행하세요. [{check_id}]")
        elif isinstance(err, NameError):
            name = getattr(err, "name", None)
            what = f"이름 {name}" if name else "이름"
            print(f"○ 아직: 이 칸에 필요한 {what}이(가) 아직 없어요. 위 단계 셀을 먼저 실행한 뒤 "
                  f"이 채점 셀을 다시 실행하세요. [{check_id}]")
        else:
            text = " ".join(str(err).split())[:120]
            print(f"○ 아직: 채점에 넘길 값을 만들다 오류가 났어요({type(err).__name__}: {text}). "
                  f"위 단계 셀이 오류 없이 실행됐는지 보고 이 채점 셀을 다시 실행하세요. [{check_id}]")
    except Exception:
        print(f"○ 아직: 위 단계 셀을 먼저 실행하세요. [{check_id}]")
'''


class BuildError(Exception):
    """정본을 노트북으로 합칠 수 없을 때(정본·채점 규약이 바뀐 경우). 고치지 말고 보고한다."""


# ---- 정본 읽기와 셀 합치기 ------------------------------------------------------

def load_canon(path=CANON_FILE):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def ordered_steps(canon):
    return sorted(canon["steps"], key=lambda s: s["order"])


def bundle_source(path=BUNDLE_FILE):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def prep_source():
    """준비 셀: z2h_check 묶음 내용 그대로 + 채점 셀 도우미."""
    return bundle_source() + PREP_TRAILER


def _lines(code):
    return code.split("\n") if code else []


def _class_end(cell):
    """셀 안 마지막 최상위 class 정의가 끝나는 줄 다음 위치. class 가 없으면 셀 끝."""
    tree = ast.parse("\n".join(cell))
    classes = [node for node in tree.body if isinstance(node, ast.ClassDef)]
    return classes[-1].end_lineno if classes else len(cell)


def has_class(cell):
    try:
        tree = ast.parse("\n".join(cell))
    except SyntaxError:
        return False
    return any(isinstance(node, ast.ClassDef) for node in tree.body)


def _uncomment(line):
    """'    #     p.grad = 0.0' -> '        p.grad = 0.0' (줄 앞 # 를 떼어 막기 전 줄을 찾는다)."""
    return re.sub(r"^(\s*)# ?", r"\1", line, count=1)


def apply_edit(cell, edit, new_lines, step_id):
    """앞 셀(cell, 줄 목록)에 정본 edits 한 칸을 적용한 새 줄 목록."""
    action, anchor = edit.get("action"), edit.get("anchor_line")
    if action == "insert":
        if anchor is None:
            at = _class_end(cell)  # "셀 맨 아래" = 클래스 몸통의 끝(셀 끝의 확인 줄 Value(2.0) 앞)
        else:
            hits = [i for i, line in enumerate(cell) if line.strip() == anchor.strip()]
            if len(hits) != 1:
                raise BuildError(f"{step_id}: 기준 줄 {anchor!r} 이 {edit.get('target_step')} 셀에 {len(hits)}번 있습니다(1번이어야 함)")
            at = hits[0] + 1
        out = cell[:at] + list(new_lines) + cell[at:]
    elif action == "replace" and anchor is None:
        # 정본에서 바꾸는 줄은 '# 로 막은 줄'뿐이다(L01-S16). # 를 뗀 줄과 같은 연속 줄을 찾아 바꾼다.
        before = [_uncomment(line) for line in new_lines]
        hits = [i for i in range(len(cell) - len(before) + 1) if cell[i:i + len(before)] == before]
        if before == list(new_lines) or len(hits) != 1:
            raise BuildError(f"{step_id}: 바꿀 줄을 {edit.get('target_step')} 셀에서 하나로 찾지 못했습니다({len(hits)}곳)")
        out = cell[:hits[0]] + list(new_lines) + cell[hits[0] + len(before):]
    else:
        raise BuildError(f"{step_id}: 지원하지 않는 edits 모양 action={action!r}, anchor_line={anchor!r}")
    try:
        ast.parse("\n".join(out))
    except SyntaxError as exc:
        raise BuildError(f"{step_id}: {edit.get('target_step')} 셀을 고친 결과가 파이썬 문법에 맞지 않습니다({exc})") from None
    return out


def plan_steps(canon):
    """단계마다 {step, edited:[(대상 id, 고친 뒤 줄)], class_edit, reruns:[(id, 줄)], own:[새 셀 줄]}."""
    state = {}  # 단계 id -> 그 단계 셀의 지금 줄(앞 단계가 고친 것 반영)
    plans = []
    for st in ordered_steps(canon):
        sid = st["step_id"]
        lines = _lines(st.get("code") or "")
        pos, touched = 0, []
        for edit in st.get("edits") or []:
            count = edit["line_count"]
            chunk = lines[pos:pos + count]
            pos += count
            if len(chunk) != count:
                raise BuildError(f"{sid}: edits 줄 수({count})가 code 줄 수보다 많습니다")
            target = edit["target_step"]
            if target not in state:
                raise BuildError(f"{sid}: 고칠 셀 {target} 이 이 단계보다 앞에 없습니다")
            state[target] = apply_edit(state[target], edit, chunk, sid)
            if target not in touched:
                touched.append(target)
        own = lines[pos:]
        if own:
            state[sid] = list(own)
        reruns = []
        for rid in st.get("rerun_first") or []:
            if rid not in state:
                raise BuildError(f"{sid}: 다시 실행할 칸 {rid} 의 셀이 없습니다")
            reruns.append((rid, list(state[rid])))
        plans.append({
            "step": st,
            "edited": [(t, list(state[t])) for t in touched],
            "class_edit": bool(touched) and all(has_class(state[t]) for t in touched),
            "reruns": reruns,
            "own": list(own),
        })
    return plans


def student_answers(canon=None):
    """학생 노트북 빈 셀(step-code)마다 넣을 '정본대로 끝낸 모습'의 코드 {단계 id: 소스}.

    학생은 앞 셀을 그 자리에서 고치므로, 끝난 뒤의 L01-S04 셀은 모든 고침이 들어간 Value 클래스 셀이다.
    L01-S16 의 # 막기는 정본 안내("비교한 뒤 #을 지워 되돌립니다")대로 되돌린 상태로 둔다."""
    canon = canon or load_canon()
    state, owners = {}, []
    for st in ordered_steps(canon):
        sid = st["step_id"]
        lines = _lines(st.get("code") or "")
        pos = 0
        for edit in st.get("edits") or []:
            count = edit["line_count"]
            chunk = lines[pos:pos + count]
            pos += count
            if edit["action"] == "replace":
                if "되돌" not in st["input_ko"]:
                    raise BuildError(f"{sid}: 바꾸기(replace)를 되돌린다는 안내가 없어 끝난 모습을 정할 수 없습니다")
                continue
            state[edit["target_step"]] = apply_edit(state[edit["target_step"]], edit, chunk, sid)
        own = lines[pos:]
        if own:
            state[sid] = list(own)
            owners.append(sid)
    return {sid: "\n".join(state[sid]) for sid in owners}


# ---- 노트북 셀 만들기 -----------------------------------------------------------

def _cell_id(index, step_id, kind):
    return f"c{index:03d}-{(step_id or 'top').lower()}-{kind}"[:64]


class _Builder:
    def __init__(self):
        self.cells = []

    def md(self, step_id, kind, text):
        tags = [t for t in (step_id, kind) if t]
        cell = nbformat.v4.new_markdown_cell(text, id=_cell_id(len(self.cells), step_id, kind))
        cell.metadata["tags"] = tags
        self.cells.append(cell)

    def code(self, step_id, kind, source, extra_tags=()):
        tags = [t for t in (step_id, kind) if t] + list(extra_tags)
        cell = nbformat.v4.new_code_cell(source, id=_cell_id(len(self.cells), step_id, kind))
        cell.metadata["tags"] = tags
        self.cells.append(cell)


def check_cell_source(step_id):
    calls = CHECK_CALLS[step_id]
    body = "\n".join("    " + line for line in calls)
    return ("# 채점 셀: 고치지 말고 실행만 하세요.\n"
            "try:\n"
            f"{body}\n"
            "except Exception as _err:\n"
            f"    _z2h_not_yet(\"{step_id}\", _err)")


FINISH_SOURCE = ("# 마지막 칸: 채점표와 결과코드를 보여 줍니다. 맨 아래 줄(Z2H1. 로 시작)을 앱의 '결과코드 붙여넣기' 칸에 넣으세요.\n"
                 f"result_code = finish(\"{LECTURE_ID}\")")


def _fmt_time(seconds):
    return f"{seconds // 3600}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


def _video_line(canon, st):
    vid = canon["lecture"]["youtube_video_id"]
    links = []
    for seg in st.get("video_segments") or []:
        url = f"https://www.youtube-nocookie.com/embed/{vid}?start={seg['start_s']}&end={seg['end_s']}&{VIDEO_PARAMS}"
        links.append(f"[{_fmt_time(seg['start_s'])}부터 보기]({url})")
    if not links:
        return "영상: 이 단계에는 영상 구간이 없습니다."
    return f"영상: {st.get('video_chapter_ko') or ''} ({' · '.join(links)})"


def _order_line(plan):
    st = plan["step"]
    parts = []
    edited = [f"고친 {t} 셀" for t, _ in plan["edited"]]
    reruns = [f"{rid} 셀" for rid, _ in plan["reruns"]]
    if plan["class_edit"]:
        parts += edited + (["준비 코드 셀"] if st.get("prepared_code") else []) + reruns
    else:
        parts += (["준비 코드 셀"] if st.get("prepared_code") else []) + reruns + edited
    if not parts:
        return None
    if plan["own"]:
        parts.append("아래 빈 셀")
    parts.append("채점 셀")
    return "**실행 순서**: " + " → ".join(parts)


def guide_markdown(canon, plan, solution):
    st = plan["step"]
    sid = st["step_id"]
    out = [f"## {sid} {st['title_ko']}", "", _video_line(canon, st), "", f"**입력할 것**: {st['input_ko']}"]
    edits = st.get("edits") or []
    if edits:
        out += ["", "**앞 셀 고치기** (넣을 줄은 앱의 '따라 하기' 화면에 있습니다)"]
        for edit in edits:
            verb = "바꾸기" if edit["action"] == "replace" else "넣기"
            item = f"- 고칠 셀: {edit['target_step']} 칸에 쓴 셀 · 넣을 곳: {edit['where_ko']}"
            if edit.get("anchor_line"):
                item += f" · 기준 줄: `{edit['anchor_line']}`"
            item += f" · {edit['line_count']}줄 {verb}"
            out.append(item)
    if st.get("rerun_first"):
        out += ["", "**먼저 다시 실행할 칸**: " + ", ".join(f"{rid} 칸의 셀" for rid in st["rerun_first"])]
    if st.get("prepared_code"):
        out += ["", f"**준비 코드**(직접 치지 않고 아래 준비 코드 셀을 실행만 합니다): {st.get('prepared_code_source_ko') or ''}"]
    order = _order_line(plan)
    if order:
        out += ["", order]
    out += ["", f"**보여야 하는 것**: {st['expected_ko']}"]
    if solution and (plan["edited"] or plan["reruns"]):
        out += ["", "정답 노트북에는 위 실행 순서대로 고친 뒤의 셀 전체와 다시 실행할 칸을 이 자리에 다시 두었습니다."]
    return "\n".join(out)


def _intro(canon, solution):
    title = canon["lecture"]["title_ko"]
    kind = "정답용" if solution else "학생용"
    lead = ("단계마다 정본 코드가 들어 있습니다. 위에서부터 차례로 실행하면 모든 채점 셀이 \"✓ 맞음\"이 됩니다."
            if solution else
            "앱의 단계 화면을 옆에 두고, 단계마다 빈 셀에 코드를 입력해 실행한 뒤 바로 아래 채점 셀을 실행하세요.")
    return "\n".join([
        f"# 1편 {title} ({kind})",
        "",
        lead,
        "",
        SOURCE_LINE,
        "",
        "- 그림 도구 graphviz: Colab에 기본으로 깔려 있는지는 미확인입니다. L01-S06 준비 코드 셀에서 "
        "`No module named 'graphviz'`가 나오면 새 셀에 `!pip install graphviz`를 직접 입력해 실행한 뒤 준비 코드 셀을 다시 실행하세요. "
        "그래도 그림이 안 나오면 L01-S06 채점 셀의 안내대로 `check(\"L01-S06\", seen=True)`를 씁니다.",
        "- PyTorch(torch): L01-S13e에서 씁니다. Colab에 깔려 있는지는 이 노트북을 만들 때 확인하지 않았습니다(미확인). "
        "없으면 L01-S13e 채점은 \"건너뜀\"으로 나옵니다.",
        "- 채점 셀이 \"○ 아직\"이라고 하면 그 위 단계 셀을 아직 실행하지 않은 것입니다. 오류 대신 안내만 나옵니다.",
    ])


PREP_GUIDE = ("## 준비 셀: 채점 도구\n\n"
              "맨 처음 한 번 실행하세요. 채점 도구(z2h_check)를 셀 하나에 담은 것이라 길고, 내용은 고치지 않습니다. "
              "실행하면 `z2h_check 준비 완료` 한 줄이 보입니다. Colab에서 런타임을 다시 시작했다면 이 셀부터 다시 실행합니다.")

FINISH_GUIDE = ("## 마무리: 채점표와 결과코드\n\n"
                "아래 셀을 실행하면 채점표와 결과코드가 나옵니다. 맨 아래 줄의 결과코드를 앱의 '결과코드 붙여넣기' 칸에 붙여 넣으세요. "
                "로컬 Jupyter에서 진도 서버가 켜져 있으면 결과를 서버로도 보내 보고, Colab에서는 \"서버에 닿지 못했습니다\"가 정상입니다.\n\n"
                "채점표의 L01-R1~R3(재구성 과제)는 이 노트북에서 채점하지 않으므로 \"아직 안 함\"으로 보입니다.")


def _metadata(canon, kind):
    return {
        "kernelspec": {"display_name": "Python 3 (ipykernel)", "language": "python", "name": "python3"},
        "language_info": {"name": "python"},
        "z2h": {
            "lecture_id": LECTURE_ID,
            "notebook": kind,
            "canon": "inputs/pedagogy/content/L01.json",
            "canon_version": canon.get("_meta", {}).get("version"),
            "generated_by": "notebooks/ep01-micrograd/build_notebooks.py",
        },
    }


def _check_registry(canon):
    ids = [st["step_id"] for st in ordered_steps(canon)]
    if set(ids) != set(CHECK_CALLS):
        missing = [i for i in ids if i not in CHECK_CALLS]
        extra = [i for i in CHECK_CALLS if i not in ids]
        raise BuildError(f"정본 단계와 채점 셀 목록이 다릅니다. 채점 셀 없음: {missing}, 정본에 없음: {extra}")


def _build(canon, solution):
    _check_registry(canon)
    b = _Builder()
    b.md(None, "intro", _intro(canon, solution))
    b.md(None, "prep-guide", PREP_GUIDE)
    b.code(None, "prep", prep_source(), ["z2h-bundle"])
    for plan in plan_steps(canon):
        st = plan["step"]
        sid = st["step_id"]
        b.md(sid, "guide", guide_markdown(canon, plan, solution))
        prepared = st.get("prepared_code")
        if solution:
            edited = [(f"# {sid}: {t} 셀을 이 단계에서 고친 뒤의 전체\n" + "\n".join(lines), t)
                      for t, lines in plan["edited"]]
            reruns = [(f"# 다시 실행: {rid} 셀과 같은 코드\n" + "\n".join(lines), rid) for rid, lines in plan["reruns"]]
            if plan["class_edit"]:
                for src, t in edited:
                    b.code(sid, "step-code", src, ["edited", f"target-{t}"])
                if prepared:
                    b.code(sid, "prep", prepared, ["prepared-code"])
                for src, rid in reruns:
                    b.code(sid, "rerun", src, [f"rerun-of-{rid}"])
            else:
                if prepared:
                    b.code(sid, "prep", prepared, ["prepared-code"])
                for src, rid in reruns:
                    b.code(sid, "rerun", src, [f"rerun-of-{rid}"])
                for src, t in edited:
                    b.code(sid, "step-code", src, ["edited", f"target-{t}"])
            if plan["own"]:
                b.code(sid, "step-code", "\n".join(plan["own"]))
        else:
            if prepared:
                b.code(sid, "prep", prepared, ["prepared-code"])
            if plan["own"]:
                b.code(sid, "step-code", PLACEHOLDER)
        b.code(sid, "check", check_cell_source(sid))
    b.md(LECTURE_ID, "finish-guide", FINISH_GUIDE)
    b.code(LECTURE_ID, "finish", FINISH_SOURCE)
    nb = nbformat.v4.new_notebook(cells=b.cells, metadata=_metadata(canon, "solution" if solution else "student"))
    nbformat.validate(nb)
    return nb


def build_solution(canon=None):
    return _build(canon or load_canon(), solution=True)


def build_student(canon=None):
    return _build(canon or load_canon(), solution=False)


def inject_answers(student_nb, answers=None):
    """학생 노트북 사본의 빈 셀(step-code)에 정답(끝난 모습)을 넣는다. 시험용."""
    answers = answers if answers is not None else student_answers()
    nb = copy.deepcopy(student_nb)
    for cell in nb.cells:
        tags = cell.metadata.get("tags", [])
        if cell.cell_type == "code" and "step-code" in tags:
            cell.source = answers[tags[0]]
    return nb


def serialize(nb):
    return nbformat.writes(nb) + "\n"


def outputs():
    return {SOLUTION_FILE: serialize(build_solution()), STUDENT_FILE: serialize(build_student())}


def main(argv=None):
    parser = argparse.ArgumentParser(description="1편 학생용·정답용 노트북을 교사 정본에서 만든다.")
    parser.add_argument("--check", action="store_true", help="지금 노트북 파일이 최신인지 확인")
    args = parser.parse_args(argv)
    try:
        files = outputs()
    except BuildError as exc:
        print(f"만들지 못했습니다: {exc}")
        return 2
    if args.check:
        stale = []
        for path, text in files.items():
            try:
                with open(path, encoding="utf-8") as fh:
                    current = fh.read()
            except OSError:
                current = None
            if current != text:
                stale.append(os.path.basename(path))
        if stale:
            print("최신이 아닙니다: " + ", ".join(stale) + ". build_notebooks.py 를 다시 실행하세요.")
            return 1
        print("두 노트북이 최신입니다.")
        return 0
    for path, text in files.items():
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        print(f"저장했습니다: {os.path.relpath(path, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
