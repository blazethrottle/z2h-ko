"""1편(micrograd) 학생용·정답용 노트북을 정본에서 만든다. 노트북을 손으로 고치지 않는다.

    .venv/bin/python notebooks/ep01-micrograd/build_notebooks.py           # 두 노트북 다시 만들기
    .venv/bin/python notebooks/ep01-micrograd/build_notebooks.py --check   # 지금 파일이 최신인지 확인(다르면 종료 코드 1)

입력(읽기만 함)
- 정본 inputs/pedagogy/content/L01.json: 단계 순서·id·제목·안내 글·코드·준비 코드·edits·rerun_first, 재구성 과제.
  글과 코드는 고쳐 쓰지 않고 그대로 옮긴다.
- 채점 묶음 z2h_check/_bundle.py: 준비 셀에 그대로 넣는다.
  만드는 순서: 정본 → python -m z2h_check.refgen --write → python -m z2h_check.bundle --write → 이 프로그램.

출처: 노트북의 코드는 정본 그대로이며, 그 코드는 Andrej Karpathy의 karpathy/micrograd, karpathy/nn-zero-to-hero
(둘 다 MIT 라이선스)를 따라 만든 것이다. LICENSE 전문은 third_party/licenses/, 표는 NOTICE.md.

노트북 모양(설계서 docs/CURRICULUM.md 3-0)
- 맨 앞: 안내 → 환경 확인 셀(정본 L01-S02 준비 코드: 실행 장소, 기기 cuda/mps/cpu 자동 선택, graphviz 유무) → 채점 도구 준비 셀.
- 단계마다(정본 순서): 글칸(step_id, 제목, 영상 구간, 입력할 것, 앞 셀 고치기, 다시 실행할 셀, 보여야 하는 것)
  → 준비 코드 셀(있으면) → [정답용만] 다시 실행할 셀(이 단계에서 고친 셀은 고친 뒤의 전체) → 그 단계의 새 셀 → 채점 셀(코드 단계만).
  학생용 새 셀은 '# 여기에 작성' 한 줄이다. 앞 셀은 학생이 그 자리에서 고치고 rerun_first 셀을 차례로 다시 실행한다.
- 재구성: '재구성 시작' 셀(빈 노트북처럼) → 조각마다 글칸, 빈 셀, 확인 셀(정본 check_code), 채점 셀.
  R2 는 정본대로 R1 셀 맨 아래에 덧붙인다(학생용에는 새 빈 셀이 없다). R3 은 본문 상태로 되돌리는 셀부터 한다.
- 마무리: finish("L01") 셀.
edits 규칙(정본 _meta.code_conventions): code 줄을 edits 순서대로 line_count 줄씩 쓰고, 남은 줄이 그 단계의 새 셀이다.
insert 는 anchor_line 바로 아래(null 이면 셀 맨 아래)에 넣고, replace 는 anchor_line 그 줄을 새 줄 하나로 바꾼다.
"""
import argparse
import ast
import json
import os
import re
import sys

import nbformat

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CANON_REL = "inputs/pedagogy/content/L01.json"
CANON_FILE = os.path.join(ROOT, *CANON_REL.split("/"))
BUNDLE_FILE = os.path.join(ROOT, "z2h_check", "_bundle.py")
SOLUTION_FILE = os.path.join(HERE, "ep01_solution.ipynb")
STUDENT_FILE = os.path.join(HERE, "ep01_student.ipynb")

LECTURE_ID = "L01"
PLACEHOLDER = "# 여기에 작성"
DEVICE_STEP = "L01-S02"         # 이 단계의 준비 코드가 편 맨 앞 '환경 확인'(기기 고르기) 셀이다(정본 S02 input_ko)
INSTALL_HINT = "L01-S14-H2"     # 안내 글에 그대로 옮기는 정본 힌트(설치 줄은 'Colab만')
SOURCE_LINE = ("출처: 코드는 Andrej Karpathy의 karpathy/micrograd, karpathy/nn-zero-to-hero(둘 다 MIT 라이선스)를 따라 만든 "
               "정본(inputs/pedagogy/content/L01.json) 그대로입니다. https://github.com/karpathy/micrograd · "
               "https://github.com/karpathy/nn-zero-to-hero")
VIDEO_PARAMS = "cc_load_policy=1&cc_lang_pref=ko&hl=ko"
# 재구성 조각이 어디서 시작하는지(정본 task_ko): 빈 노트북 / 앞 조각 셀에 덧붙이기 / 이 편의 노트북 상태에서
REBUILD_FLOW = {"L01-R1": "blank", "L01-R2": "continue", "L01-R3": "lecture"}


class BuildError(Exception):
    """정본을 노트북으로 합칠 수 없을 때(정본 모양이 바뀐 경우). 고치지 말고 보고한다."""


# ---- 정본 읽기와 셀 합치기 ------------------------------------------------------

def load_canon(path=CANON_FILE):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def ordered_steps(canon):
    return sorted(canon["steps"], key=lambda s: s["order"])


def bundle_source(path=BUNDLE_FILE):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def _lines(code):
    return code.split("\n") if code else []


def _step(canon, sid):
    for st in canon["steps"]:
        if st["step_id"] == sid:
            return st
    raise BuildError(f"정본에 {sid} 단계가 없습니다")


def cell_names(canon):
    """정본 code_conventions 의 '셀 이름: Value 셀 S07, …' 을 {L01-S07: 'Value 셀'} 로."""
    text = next((c for c in canon["_meta"].get("code_conventions") or [] if c.startswith("셀 이름:")), "")
    pairs = re.findall(r"([^,:]+? 셀) (S\d+)", text)
    return {f"{LECTURE_ID}-{sid}": name.strip() for name, sid in pairs}


def _label(names, sid):
    return f"{sid}({names[sid]})" if sid in names else sid


def _anchor_index(cell, anchor, sid, edit):
    hits = [i for i, line in enumerate(cell) if line.rstrip() == anchor.rstrip()]
    if len(hits) != 1:
        raise BuildError(f"{sid}: 기준 줄 {anchor!r} 이 {edit['target_step']} 셀에 {len(hits)}번 있습니다(1번이어야 함)")
    return hits[0]


def apply_edit(cell, edit, chunk, sid):
    """앞 셀(cell, 줄 목록)에 정본 edits 한 칸을 적용한 새 줄 목록."""
    action, anchor = edit.get("action"), edit.get("anchor_line")
    if action == "insert":
        at = len(cell) if anchor is None else _anchor_index(cell, anchor, sid, edit) + 1
        out = cell[:at] + list(chunk) + cell[at:]
    elif action == "replace" and anchor is not None and len(chunk) == 1:
        at = _anchor_index(cell, anchor, sid, edit)
        out = cell[:at] + list(chunk) + cell[at + 1:]
    else:
        raise BuildError(f"{sid}: 지원하지 않는 edits 모양 action={action!r}, anchor_line={anchor!r}, 줄 {len(chunk)}개")
    try:
        ast.parse("\n".join(out))
    except SyntaxError as exc:
        raise BuildError(f"{sid}: {edit['target_step']} 셀을 고친 결과가 파이썬 문법에 맞지 않습니다({exc})") from None
    return out


def plan_steps(canon):
    """단계마다 {step, edited: {대상 id: 고친 뒤 줄}, reruns: [(id, 그때의 줄)], own: [새 셀 줄]} (정본 순서)."""
    state, plans = {}, []
    for st in ordered_steps(canon):
        sid = st["step_id"]
        lines = _lines(st.get("code"))
        rerun_first = st.get("rerun_first") or []
        pos, edited = 0, {}
        for edit in st.get("edits") or []:
            count = edit["line_count"]
            chunk = lines[pos:pos + count]
            pos += count
            target = edit["target_step"]
            if len(chunk) != count:
                raise BuildError(f"{sid}: edits 줄 수({count})가 code 줄 수보다 많습니다")
            if target not in state:
                raise BuildError(f"{sid}: 고칠 셀 {target} 이 이 단계보다 앞에 없습니다")
            if target not in rerun_first:
                raise BuildError(f"{sid}: 고친 셀 {target} 이 rerun_first 에 없습니다(정본 규칙: 고친 셀은 다시 실행)")
            state[target] = apply_edit(state[target], edit, chunk, sid)
            edited[target] = list(state[target])
        own = lines[pos:]
        if own:
            state[sid] = list(own)
        reruns = []
        for rid in rerun_first:
            if rid not in state:
                raise BuildError(f"{sid}: 다시 실행할 셀 {rid} 이 없습니다")
            reruns.append((rid, list(state[rid])))
        plans.append({"step": st, "edited": edited, "reruns": reruns, "own": list(own)})
    return plans


def check_source(check_id):
    return f'check("{check_id}", globals())'


# ---- 재구성 -------------------------------------------------------------------

def rebuild_tasks(canon):
    return list(canon.get("rebuild_tasks") or [])


def _task(canon, rid):
    for task in rebuild_tasks(canon):
        if task["rebuild_id"] == rid:
            return task
    raise BuildError(f"정본 rebuild_tasks 에 {rid} 가 없습니다")


def _previous(canon, rid):
    ids = [t["rebuild_id"] for t in rebuild_tasks(canon)]
    at = ids.index(rid)
    if at == 0:
        raise BuildError(f"{rid}: 덧붙일 앞 조각이 없습니다")
    return ids[at - 1]


def rebuild_work_owner(canon, rid):
    """그 조각의 코드를 쓰는 셀의 주인 조각 id. 덧붙이는 조각(R2)은 앞 조각(R1)의 셀에 쓴다."""
    return rebuild_work_owner(canon, _previous(canon, rid)) if REBUILD_FLOW[rid] == "continue" else rid


def rebuild_work_source(canon, rid):
    """조각을 끝낸 셀의 모습: 정본 solution_code. 덧붙이는 조각은 앞 조각 셀 맨 아래에 붙인 전체."""
    code = _task(canon, rid)["solution_code"]
    if REBUILD_FLOW[rid] == "continue":
        code = rebuild_work_source(canon, _previous(canon, rid)) + "\n" + code
    try:
        ast.parse(code)
    except SyntaxError as exc:
        raise BuildError(f"{rid}: 정답 셀이 파이썬 문법에 맞지 않습니다({exc})") from None
    return code


REBUILD_START_SOURCE = ("# 재구성 시작 셀: 고치지 말고 실행만 하세요. 위 본문에서 만든 이름을 따로 보관하고 지워 빈 노트북처럼 만듭니다.\n"
                        "import z2h_check.rebuild as _z2h_rebuild\n"
                        "_z2h_rebuild.start(globals())")


def rebuild_resume_source(rid):
    return (f"# {rid} 시작 셀: 고치지 말고 실행만 하세요. 재구성 시작 셀이 보관한 본문 이름을 되돌립니다.\n"
            "import z2h_check.rebuild as _z2h_rebuild\n"
            f'_z2h_rebuild.resume(globals(), "{rid}")')


# ---- 글칸 ---------------------------------------------------------------------

def _fmt_time(seconds):
    return f"{seconds // 3600}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


def _chapter_title(canon, seg):
    for ch in canon["_meta"].get("chapter_cover") or []:
        if ch["start_s"] == seg["start_s"] and ch["end_s"] == seg["end_s"]:
            return f"챕터 {ch['chapter']} 「{ch['title']}」 "
    return ""


def _video_line(canon, st):
    vid = canon["lecture"]["youtube_video_id"]
    links = []
    for seg in st.get("video_segments") or []:
        url = f"https://www.youtube-nocookie.com/embed/{vid}?start={seg['start_s']}&end={seg['end_s']}&{VIDEO_PARAMS}"
        links.append(f"{_chapter_title(canon, seg)}[{_fmt_time(seg['start_s'])}부터 {_fmt_time(seg['end_s'])}까지 보기]({url})")
    return "영상: " + " · ".join(links) if links else "영상: 이 단계에는 영상 구간이 없습니다."


def guide_markdown(canon, plan, names, solution):
    st = plan["step"]
    out = [f"## {st['step_id']} {st['title_ko']}", "", _video_line(canon, st), "", f"**입력할 것**: {st['input_ko']}"]
    if st.get("edits"):
        out += ["", "**앞 셀 고치기** (넣을 줄은 앱의 '따라 하기' 화면에 있습니다. 그 셀을 그 자리에서 고칩니다)"]
        for edit in st["edits"]:
            verb = "바꾸기" if edit["action"] == "replace" else "넣기"
            out.append(f"- {_label(names, edit['target_step'])}: {edit['where_ko']} · {edit['line_count']}줄 {verb}")
    if st.get("rerun_first"):
        out += ["", "**다시 실행할 셀(차례로)**: " + " → ".join(_label(names, rid) for rid in st["rerun_first"])]
    out += ["", f"**보여야 하는 것**: {st['expected_ko']}"]
    if st["kind"] != "code":
        out += ["", "이 단계는 노트북에서 칠 코드가 없습니다. 앱 화면에서 진행합니다."]
    if solution and plan["reruns"]:
        out += ["", "정답 노트북에는 다시 실행할 셀을 이 자리에 다시 두었습니다(이 단계에서 고친 셀은 고친 뒤의 전체)."]
    return "\n".join(out)


def _hint_text(canon, hint_id):
    for hint in canon.get("hints") or []:
        if hint["hint_id"] == hint_id:
            return hint["text_ko"]
    raise BuildError(f"정본 hints 에 {hint_id} 가 없습니다")


def _intro(canon, solution):
    kind = "정답용" if solution else "학생용"
    lead = ("단계마다 정본 코드가 들어 있습니다. 위에서부터 차례로 실행하면 모든 채점 셀이 \"✓ 맞음\"이 됩니다. "
            "앞 셀을 고치는 단계에는 고친 뒤의 셀 전체와 다시 실행할 셀을 그 단계 자리에 다시 두었습니다."
            if solution else
            "앱의 단계 화면(따라 하기)을 옆에 두고, 단계마다 `# 여기에 작성` 셀에 코드를 입력해 실행한 뒤 바로 아래 채점 셀을 실행하세요.")
    return "\n".join([
        f"# 1편 {canon['lecture']['title_ko']} ({kind})",
        "",
        lead,
        "",
        SOURCE_LINE,
        "",
        "- 같은 노트북을 Colab과 맥미니 Jupyter 어느 쪽에서든 씁니다. 맨 위 환경 확인 셀이 실행 장소, 기기(cuda, mps, cpu 순으로 "
        "자동 선택), 그림 프로그램 graphviz(dot) 유무를 알려 줍니다. 1편 계산은 모두 cpu로 합니다.",
        f"- 설치가 필요할 때(정본 힌트 {INSTALL_HINT} 그대로): {_hint_text(canon, INSTALL_HINT)}",
        "- 채점 셀은 바로 위 셀이 보인 것(출력)이나 위에서 만든 이름을 봅니다. \"○ 아직\"이면 위 셀을 먼저 실행하세요. "
        "그림 단계는 셀이 오류 없이 돌았는지만 보고, 그림은 '스스로 확인할 것' 목록으로 직접 확인합니다.",
        "- 앞 셀을 고치는 단계는 그 셀을 그 자리에서 고친 뒤 '다시 실행할 셀'을 차례로 실행합니다. 그래서 다 끝낸 노트북을 "
        "처음부터 모두 실행하면, 고치기 전 모습을 보는 단계의 채점은 다르게 나올 수 있습니다. 결과코드는 단계를 해 나가며 받아 두세요.",
        "- 맨 끝 \"재구성\" 구역은 본문을 마친 뒤(다른 날도 됩니다) 앞 단계를 보지 않고 다시 만들어 보는 연습입니다.",
    ])


def _device_guide(canon):
    st = _step(canon, DEVICE_STEP)
    return "\n".join(["## 준비 1: 환경 확인", "",
                      f"맨 처음 실행하세요({DEVICE_STEP} 준비 코드). {st['prepared_code_source_ko']}", "",
                      f"**보여야 하는 것**: {st['expected_ko']}"])


BUNDLE_GUIDE = ("## 준비 2: 채점 도구\n\n"
                "환경 확인 셀 다음에 한 번 실행하세요. 채점 도구(z2h_check)를 셀 하나에 담은 것이라 길고, 내용은 고치지 않습니다. "
                "실행하면 `z2h_check 준비 완료` 한 줄이 보입니다. Colab에서 런타임을 다시 시작했다면 맨 위부터 다시 실행합니다.")

FINISH_GUIDE = ("## 마무리: 채점표와 결과코드\n\n"
                "아래 셀을 실행하면 채점표와 결과코드가 나옵니다. 맨 아래 줄의 결과코드를 앱의 '결과코드 붙여넣기' 칸에 붙여 넣으세요. "
                "로컬 Jupyter에서 진도 서버가 켜져 있으면 결과를 서버로도 보내 보고, Colab에서는 \"서버에 닿지 못했습니다\"가 정상입니다.\n\n"
                "재구성 조각(L01-R1~R3)의 결과도 같은 결과코드에 들어갑니다. 아직 하지 않았다면 그 칸은 \"아직 안 함\"으로 보이고, "
                "그대로 붙여 넣어도 됩니다.")

FINISH_SOURCE = ("# 마지막 칸: 채점표와 결과코드를 보여 줍니다. 맨 아래 줄(Z2H1. 로 시작)을 앱의 '결과코드 붙여넣기' 칸에 넣으세요.\n"
                 f"result_code = finish(\"{LECTURE_ID}\")")


def rebuild_intro_markdown(canon):
    tasks = rebuild_tasks(canon)
    ids = ", ".join(t["rebuild_id"] for t in tasks)
    levels = sorted({t["max_hint_level_for_pass"] for t in tasks})
    hint = (f"- 힌트는 앱의 조각 화면에서 봅니다. 힌트 H{levels[0]}까지 보고 완성하면 통과로 칩니다. 노트북은 힌트를 세지 않습니다."
            if len(levels) == 1 else "- 힌트는 앱의 조각 화면에서 봅니다. 노트북은 힌트를 세지 않습니다.")
    return "\n".join([
        "## 재구성(빈 셀에서 다시 만들기)",
        "",
        f"본문을 마친 뒤(다른 날도 됩니다) 앞 단계를 보지 않고 다시 만들어 보는 연습입니다. 조각은 {len(tasks)}개({ids})입니다.",
        "",
        "- 정본 과제는 빈 노트북에서 시작합니다. 이 노트북에서는 아래 '재구성 시작' 셀이 빈 노트북을 대신합니다. "
        "위 본문에서 만든 이름(Value 같은 것과 math 같은 불러온 도구까지)을 따로 보관하고 지웁니다. 채점 도구와 채점 기록은 그대로입니다. "
        "그래서 `import math` 같은 줄도 다시 씁니다. 이 셀을 실행한 뒤에는 위 본문 셀을 다시 실행하지 않습니다.",
        "- 조각마다 확인 셀(정본 check_code)이 미리 들어 있습니다. 내 셀을 실행한 뒤 확인 셀로 출력을 보고, 채점 셀로 기록합니다.",
        hint,
        "- 다른 날 이어서 할 때: 맨 위 준비 셀 두 개 → '재구성 시작' 셀 → 조각 순서대로 → 마무리 셀.",
        "- 재구성 결과도 마무리 셀의 결과코드에 들어갑니다.",
    ])


REBUILD_START_GUIDE = ("### 재구성 시작\n\n"
                       "아래 셀을 실행하면 위에서 만든 이름을 따로 보관하고 지워 빈 노트북처럼 만듭니다. "
                       "보관한 이름은 이 편의 노트북 상태에서 시작하는 조각이 되돌려 씁니다.")


def rebuild_guide_markdown(canon, task, solution):
    rid = task["rebuild_id"]
    flow = REBUILD_FLOW[rid]
    out = [f"## {rid} {task['title_ko']}", "", f"**과제**: {task['task_ko']}", "", f"**통과 기준**: {task['pass_ko']}", ""]
    if flow == "blank":
        out.append("**실행 순서**: 아래 빈 셀에 작성하고 실행 → 확인 셀 → 채점 셀.")
    elif flow == "continue":
        owner = rebuild_work_owner(canon, rid)
        out.append(f"**실행 순서**: 위 {owner} 셀 맨 아래에 덧붙이고 그 셀을 다시 실행 → 아래 확인 셀 → 채점 셀. "
                   "새 빈 셀은 없습니다.")
        if solution:
            out += ["", f"정답 노트북에는 덧붙인 뒤의 {owner} 셀 전체를 이 자리에 다시 두었습니다."]
    else:
        out.append(f"**실행 순서**: 아래 '{rid} 시작' 셀(재구성 시작 셀이 보관한 본문 이름을 되돌림) → 빈 셀에 작성하고 실행 → "
                   "확인 셀 → 채점 셀. 다른 날 새로 열었다면 '시작' 셀이 먼저 실행할 본문 셀을 알려 줍니다.")
    return "\n".join(out)


# ---- 노트북 셀 만들기 -----------------------------------------------------------

def _cell_id(index, owner, kind):
    return f"c{index:03d}-{owner.lower()}-{kind}"[:64]


class _Builder:
    def __init__(self):
        self.cells = []

    def md(self, owner, kind, text):
        cell = nbformat.v4.new_markdown_cell(text, id=_cell_id(len(self.cells), owner, kind))
        cell.metadata["tags"] = [owner, kind]
        self.cells.append(cell)

    def code(self, owner, kind, source, extra_tags=()):
        cell = nbformat.v4.new_code_cell(source, id=_cell_id(len(self.cells), owner, kind))
        cell.metadata["tags"] = [owner, kind] + list(extra_tags)
        self.cells.append(cell)


def _rerun_header(names, sid, rid, edited):
    if edited:
        return f"# {sid}: {_label(names, rid)}을(를) 이 단계에서 고친 뒤의 전체(다시 실행)"
    return f"# {sid}: 다시 실행할 {_label(names, rid)}과(와) 같은 코드"


def _check_canon(canon):
    if not _step(canon, DEVICE_STEP).get("prepared_code"):
        raise BuildError(f"{DEVICE_STEP} 에 환경 확인 준비 코드가 없습니다")
    rids = [t["rebuild_id"] for t in rebuild_tasks(canon)]
    if set(rids) != set(REBUILD_FLOW):
        raise BuildError(f"정본 재구성 조각 {rids} 와 REBUILD_FLOW {sorted(REBUILD_FLOW)} 이 다릅니다")
    if rids and REBUILD_FLOW[rids[0]] == "continue":
        raise BuildError(f"{rids[0]}: 첫 조각은 앞 조각에 덧붙일 수 없습니다")


def _rebuild_section(b, canon, solution):
    b.md("rebuild", "rebuild-intro", rebuild_intro_markdown(canon))
    b.md("rebuild", "rebuild-start-guide", REBUILD_START_GUIDE)
    b.code("rebuild", "rebuild-start", REBUILD_START_SOURCE)
    for task in rebuild_tasks(canon):
        rid = task["rebuild_id"]
        flow = REBUILD_FLOW[rid]
        b.md(rid, "rebuild-guide", rebuild_guide_markdown(canon, task, solution))
        if flow == "lecture":
            b.code(rid, "rebuild-resume", rebuild_resume_source(rid))
        if flow != "continue":
            b.code(rid, "rebuild-code", rebuild_work_source(canon, rid) if solution else PLACEHOLDER)
        elif solution:
            owner = rebuild_work_owner(canon, rid)
            b.code(rid, "rebuild-code", rebuild_work_source(canon, rid), ["edited", f"of-{owner}"])
        b.code(rid, "rebuild-check-code", task["check_code"])
        b.code(rid, "check", check_source(rid))


def _metadata(canon, kind):
    return {
        "kernelspec": {"display_name": "Python 3 (ipykernel)", "language": "python", "name": "python3"},
        "language_info": {"name": "python"},
        "z2h": {
            "lecture_id": LECTURE_ID,
            "notebook": kind,
            "canon": CANON_REL,
            "canon_version": canon["_meta"].get("version"),
            "generated_by": "notebooks/ep01-micrograd/build_notebooks.py",
        },
    }


def _build(canon, solution):
    _check_canon(canon)
    names = cell_names(canon)
    b = _Builder()
    b.md("setup", "intro", _intro(canon, solution))
    b.md("setup", "device-guide", _device_guide(canon))
    b.code("setup", "prepared-code", _step(canon, DEVICE_STEP)["prepared_code"], ["device", f"prepared-of-{DEVICE_STEP}"])
    b.md("setup", "bundle-guide", BUNDLE_GUIDE)
    b.code("setup", "z2h-bundle", bundle_source())
    for plan in plan_steps(canon):
        st = plan["step"]
        sid = st["step_id"]
        b.md(sid, "guide", guide_markdown(canon, plan, names, solution))
        if st.get("prepared_code") and sid != DEVICE_STEP:
            b.code(sid, "prepared-code", st["prepared_code"])
        if solution:
            for rid, lines in plan["reruns"]:
                edited = rid in plan["edited"]
                source = "\n".join([_rerun_header(names, sid, rid, edited)] + lines)
                b.code(sid, "rerun", source, [f"of-{rid}"] + (["edited"] if edited else []))
        if plan["own"]:
            b.code(sid, "step-code", "\n".join(plan["own"]) if solution else PLACEHOLDER)
        if st["kind"] == "code":
            b.code(sid, "check", check_source(sid))
    _rebuild_section(b, canon, solution)
    b.md(LECTURE_ID, "finish-guide", FINISH_GUIDE)
    b.code(LECTURE_ID, "finish", FINISH_SOURCE)
    nb = nbformat.v4.new_notebook(cells=b.cells, metadata=_metadata(canon, "solution" if solution else "student"))
    nbformat.validate(nb)
    return nb


def build_solution(canon=None):
    return _build(canon or load_canon(), solution=True)


def build_student(canon=None):
    return _build(canon or load_canon(), solution=False)


def serialize(nb):
    return nbformat.writes(nb) + "\n"


def outputs():
    canon = load_canon()
    return {SOLUTION_FILE: serialize(build_solution(canon)), STUDENT_FILE: serialize(build_student(canon))}


def main(argv=None):
    parser = argparse.ArgumentParser(description="1편 학생용·정답용 노트북을 정본에서 만든다.")
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
