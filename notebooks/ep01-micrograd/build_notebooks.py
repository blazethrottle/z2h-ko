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

맨 끝(마무리 셀 앞)에는 "재구성(자기 확인)" 구역을 둔다(교사 결정 2026-11-17: 재구성 채점 노트북을 따로 만들지 않음).
- 정본 rebuild_tasks 순서대로 조각마다 과제 문구(정본 그대로), 빈 작업 셀, 자기 확인 셀.
- 학생용 작업 셀은 비어 있다. 정답용 작업 셀은 교사 힌트 H4 가 가리키는 정본 단계 코드를 합친 것이다(REBUILD_PARTS).
- L01-R3 학습 셀은 다시 실행하는 셀이다. 정답 노트북만 "손실이 아직 기준 위일 때만 학습 셀을 한 번 더" 셀을 둔다
  (정본 check.max_reruns - 1 개). 기준 숫자는 정본에서 읽는다.
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

# 재구성(자기 확인) 구역. 조각 id·순서·문구는 정본 rebuild_tasks 에서 읽고, 여기에는 부르는 모양과 정답 조합만 둔다.
REBUILD_CHECK_CALLS = {
    "L01-R1": ['check("L01-R1", Value)'],
    "L01-R2": ['check("L01-R2", Value)'],
    "L01-R3": ['check("L01-R3", n, loss, runs=_z2h_runs(n))   # runs: 학습 셀을 몇 번째 실행했는지(셀 실행을 세어 넣습니다)'],
}
CLASS_STEP = "L01-S04"  # Value 클래스 셀
# 조각 -> {작업 셀 이름: 합칠 정본 코드}. 교사 힌트 H4("정답은 … 코드")가 가리키는 단계와 같다(tests 가 확인).
# ("class", X): L01-S04 셀을 X 단계까지 고친 모습(None 이면 모든 고침이 들어간 끝난 모습), ("own", X): X 단계 셀 코드 그대로.
REBUILD_PARTS = {
    "L01-R1": {"work": [("class", "L01-S10b")]},
    "L01-R2": {"work": [("class", "L01-S11b")]},
    "L01-R3": {"model": [("class", None), ("own", "L01-S14"), ("own", "L01-S14b"), ("own", "L01-S14c"), ("own", "L01-S15")],
               "train": [("own", "L01-S15b")]},
}
REBUILD_TRAIN = {"L01-R3": "train"}  # 다시 실행하는 학습 셀(정본 check.max_reruns, check.steps_per_run)
REBUILD_NAMES = {"L01-R1": "`Value`", "L01-R2": "`Value`",
                 "L01-R3": "`n`(다시 만들어 학습한 MLP(3, [4, 4, 1]) 모델), `loss`(학습 셀이 마지막으로 계산한 손실)"}

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


class _Z2HNotStarted(Exception):
    """재구성 구역의 '재구성 시작' 셀을 아직 실행하지 않았을 때."""


_Z2H_KEEP = {"check", "finish", "In", "Out", "get_ipython", "exit", "quit"}


def _z2h_rebuild_start():
    """재구성 시작 셀: 위 본문에서 만든 이름(밑줄로 시작하지 않는 것)을 지워 빈 노트북처럼 만들고, 학습 셀 실행 세기를 켭니다.
    채점 도구(check, finish)와 채점 기록은 그대로 둡니다."""
    ns = globals()
    keep = set(_Z2H_KEEP)
    try:
        keep |= set(get_ipython().user_ns_hidden)  # IPython 이 스스로 넣어 둔 이름은 지우지 않는다
    except Exception:
        pass
    gone = sorted(name for name in list(ns) if not name.startswith("_") and name not in keep)
    for name in gone:
        ns.pop(name, None)
    try:
        from z2h_check import runs as _z2h_runs_mod
        counting = _z2h_runs_mod.watch(("n",))
    except Exception:
        counting = False
    ns["_z2h_rebuild_on"] = True
    if gone:
        shown = ", ".join(gone[:6]) + (" 등" if len(gone) > 6 else "")
        print(f"재구성 시작: 위에서 만든 이름 {len(gone)}개({shown})를 지워 빈 노트북처럼 만들었습니다. 채점 기록은 그대로입니다.")
    else:
        print("재구성 시작: 지울 이름이 없습니다(빈 노트북 상태). 채점 기록은 그대로입니다.")
    if counting:
        print("학습 셀 실행 세기를 켰습니다. L01-R3 자기 확인 셀이 학습 셀을 몇 번째 실행했는지 알려 줍니다.")
    else:
        print("이곳에서는 셀 실행을 셀 수 없어 L01-R3 자기 확인은 손실만 봅니다.")
    print("이제 아래 조각의 빈 셀에 처음부터 다시 만들어 보세요. 위 본문 셀은 다시 실행하지 않습니다.")


def _z2h_rebuild_ready(check_id):
    """재구성 자기 확인 셀 첫 줄: '재구성 시작' 셀을 실행했는지 봅니다(위 본문에서 만든 것을 그대로 채점하지 않도록)."""
    if not globals().get("_z2h_rebuild_on"):
        raise _Z2HNotStarted(check_id)


def _z2h_runs(model):
    """이 모델로 학습 셀을 몇 번째 실행했는지(재구성 시작 셀이 켠 세기). 셀 수 없는 곳이면 None(그때는 손실만 봄)."""
    try:
        from z2h_check import runs as _z2h_runs_mod
        return _z2h_runs_mod.runs_of(model)
    except Exception:
        return None


def _z2h_not_yet(check_id, err):
    """채점 셀에서 check(...)에 넘길 값이 아직 없거나 만들다 오류가 나면, 예외 대신 "○ 아직" 한 줄만 보여 줍니다.
    이때는 채점 기록을 남기지 않으므로 finish("L01") 채점표에는 "아직 안 함"으로 나옵니다."""
    try:
        if isinstance(err, _Z2HNotShown):
            print(f"○ 아직: 바로 위 단계 셀을 먼저 실행한 뒤 이 채점 셀을 다시 실행하세요. [{check_id}]")
        elif isinstance(err, _Z2HNotStarted):
            print(f"○ 아직: 먼저 위의 '재구성 시작' 셀을 실행한 뒤, 이 조각의 빈 셀과 이 자기 확인 셀을 차례로 다시 실행하세요. "
                  f"[{check_id}]")
        elif isinstance(err, NameError):
            name = getattr(err, "name", None)
            what = f"이름 {name}" if name else "이름"
            if "-R" in check_id:  # 재구성 조각: 이 조각의 빈 셀에 다시 만든 뒤
                print(f"○ 아직: 이 칸에 필요한 {what}이(가) 아직 없어요. 위 빈 셀에 처음부터 다시 만들어 실행한 뒤 "
                      f"이 자기 확인 셀을 다시 실행하세요. [{check_id}]")
            else:
                print(f"○ 아직: 이 칸에 필요한 {what}이(가) 아직 없어요. 위 단계 셀을 먼저 실행한 뒤 "
                      f"이 채점 셀을 다시 실행하세요. [{check_id}]")
        else:
            text = " ".join(str(err).split())[:120]
            print(f"○ 아직: 채점에 넘길 값을 만들다 오류가 났어요({type(err).__name__}: {text}). "
                  f"위 셀이 오류 없이 실행됐는지 보고 이 셀을 다시 실행하세요. [{check_id}]")
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


# ---- 재구성(자기 확인) 구역: 정본에서 읽기와 정답 조합 ------------------------------

def rebuild_tasks(canon):
    return list(canon.get("rebuild_tasks") or [])


def rebuild_parts(rid):
    """조각의 작업 셀 이름 순서(예: ['model', 'train'])."""
    return list(REBUILD_PARTS[rid])


def class_state(canon, until):
    """L01-S04 셀(Value 클래스)을 until 단계까지 고친 모습(줄 목록). until 이 None 이면 끝난 모습."""
    state = None
    for plan in plan_steps(canon):
        sid = plan["step"]["step_id"]
        if sid == CLASS_STEP:
            state = list(plan["own"])
        for target, lines in plan["edited"]:
            if target == CLASS_STEP:
                state = list(lines)
        if until is not None and sid == until:
            return state
    if until is not None or state is None:
        raise BuildError(f"재구성 정답: {CLASS_STEP} 셀을 {until} 단계까지 고친 모습을 정본에서 찾지 못했습니다")
    return state


def _step_code(canon, sid):
    for st in canon["steps"]:
        if st["step_id"] == sid:
            return st.get("code") or ""
    raise BuildError(f"재구성 정답: 정본에 {sid} 단계가 없습니다")


def _import_lines(canon):
    """정본 첫 단계 셀의 import 줄과 그 줄이 만드는 이름. 빈 노트북에서 다시 만들 때 필요한 줄만 골라 앞에 붙인다."""
    out = []
    for line in _lines(ordered_steps(canon)[0].get("code") or ""):
        try:
            tree = ast.parse(line)
        except SyntaxError:
            continue
        if len(tree.body) == 1 and isinstance(tree.body[0], (ast.Import, ast.ImportFrom)):
            out.append((line, [a.asname or a.name.split(".")[0] for a in tree.body[0].names]))
    return out


def _needed_imports(canon, code):
    used = {node.id for node in ast.walk(ast.parse(code)) if isinstance(node, ast.Name)}
    return [line for line, names in _import_lines(canon) if any(name in used for name in names)]


def rebuild_part_source(canon, rid, part):
    """정답 작업 셀: 첫 줄 설명 주석 + 필요한 import 줄(정본 첫 단계) + 정본 코드를 합친 것."""
    pieces, labels, owns = [], [], []
    for kind, sid in REBUILD_PARTS[rid][part]:
        if kind == "class":
            pieces.append("\n".join(class_state(canon, sid)))
            labels.append(f"{CLASS_STEP} 셀을 {sid}까지 고친 Value 클래스" if sid
                          else f"{CLASS_STEP} 셀의 끝난 모습인 Value 클래스")
        elif kind == "own":
            pieces.append(_step_code(canon, sid))
            owns.append(sid)
        else:
            raise BuildError(f"{rid}: 모르는 정답 조합 {kind!r}")
    if owns:
        labels.append(" · ".join(owns) + " 셀")
    body = "\n".join(pieces)
    header = f"# {rid} 정답: 교사 정본 코드를 합친 것({', '.join(labels)})"
    if REBUILD_TRAIN.get(rid) == part:
        steps = _rebuild_check(canon, rid)["steps_per_run"]
        header += f". 학습 셀입니다(1번 실행 = {steps}번 반복)"
    return "\n".join([header] + _needed_imports(canon, body) + [body])


def _rebuild_check(canon, rid):
    for task in rebuild_tasks(canon):
        if task["rebuild_id"] == rid:
            return task["check"]
    raise BuildError(f"정본 rebuild_tasks 에 {rid} 가 없습니다")


def rebuild_rerun_source(canon, rid, k):
    """정답 노트북만: 학습 셀 다시 실행(k번째). 손실이 아직 기준 위일 때만 학습 셀과 같은 코드를 한 번 더 돌린다."""
    chk = _rebuild_check(canon, rid)
    limit = chk["max"]
    train = "\n".join(_step_code(canon, sid) for _kind, sid in REBUILD_PARTS[rid][REBUILD_TRAIN[rid]])
    lines = [f"# 정답 노트북만: 학습 셀 다시 실행({k}번째). 손실이 아직 {limit} 위일 때만 위 학습 셀과 같은 코드를 한 번 더 돌립니다.",
             "# 학생 노트북에서는 위 학습 셀을 다시 실행한 뒤 자기 확인 셀도 다시 실행합니다.",
             f"if loss.data >= {limit!r}:"]
    lines += [("    " + line) if line else line for line in _lines(train)]
    src = "\n".join(lines)
    ast.parse(src)
    return src


def rebuild_answers(canon=None):
    """학생 노트북 재구성 빈 셀마다 넣을 정답 {(조각 id, 작업 셀 이름): 소스}. 정답 노트북 작업 셀과 같다. 시험용."""
    canon = canon or load_canon()
    return {(task["rebuild_id"], part): rebuild_part_source(canon, task["rebuild_id"], part)
            for task in rebuild_tasks(canon) for part in rebuild_parts(task["rebuild_id"])}


def rebuild_check_source(rid):
    body = "\n".join("    " + line for line in REBUILD_CHECK_CALLS[rid])
    return ("# 자기 확인 셀: 고치지 말고 실행만 하세요.\n"
            "try:\n"
            f"    _z2h_rebuild_ready(\"{rid}\")\n"
            f"{body}\n"
            "except Exception as _err:\n"
            f"    _z2h_not_yet(\"{rid}\", _err)")


def rebuild_placeholder(canon, rid, part):
    if part == "model":
        return PLACEHOLDER + ": 만들기 셀(Value 연산, Neuron, Layer, MLP, 데이터 xs·ys, 모델 n)"
    if REBUILD_TRAIN.get(rid) == part:
        chk = _rebuild_check(canon, rid)
        return (PLACEHOLDER + f": 학습 셀({chk['steps_per_run']}번 반복). 손실이 {chk['max']} 아래가 될 때까지 "
                f"이 셀과 아래 자기 확인 셀을 다시 실행합니다(최대 {chk['max_reruns']}번).")
    return PLACEHOLDER


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
        "- 맨 끝 \"재구성(자기 확인)\" 구역은 본문을 마친 뒤(다른 날도 됩니다) 위 코드를 보지 않고 처음부터 다시 만들어 보는 연습입니다.",
    ])


PREP_GUIDE = ("## 준비 셀: 채점 도구\n\n"
              "맨 처음 한 번 실행하세요. 채점 도구(z2h_check)를 셀 하나에 담은 것이라 길고, 내용은 고치지 않습니다. "
              "실행하면 `z2h_check 준비 완료` 한 줄이 보입니다. Colab에서 런타임을 다시 시작했다면 이 셀부터 다시 실행합니다.")

FINISH_GUIDE = ("## 마무리: 채점표와 결과코드\n\n"
                "아래 셀을 실행하면 채점표와 결과코드가 나옵니다. 맨 아래 줄의 결과코드를 앱의 '결과코드 붙여넣기' 칸에 붙여 넣으세요. "
                "로컬 Jupyter에서 진도 서버가 켜져 있으면 결과를 서버로도 보내 보고, Colab에서는 \"서버에 닿지 못했습니다\"가 정상입니다.\n\n"
                "위 \"재구성(자기 확인)\" 구역의 결과(L01-R1~R3)도 같은 결과코드에 들어갑니다. 재구성을 아직 하지 않았다면 "
                "그 칸은 \"아직 안 함\"으로 보이고, 그대로 붙여 넣어도 됩니다. 재구성을 다른 날 했다면 그날의 결과코드를 한 번 더 붙여 넣습니다.")


def rebuild_intro_markdown(canon):
    tasks = rebuild_tasks(canon)
    ids = ", ".join(t["rebuild_id"] for t in tasks)
    levels = sorted({t.get("max_hint_level_for_pass") for t in tasks if t.get("max_hint_level_for_pass") is not None})
    hint = (f"- 힌트는 앱의 조각 화면에서 봅니다. 힌트 H{levels[0]}까지 보고 완성하면 통과로 칩니다(그보다 높은 힌트를 쓰면 앱이 연습으로 기록). "
            "노트북은 힌트를 세지 않습니다." if len(levels) == 1 else
            "- 힌트는 앱의 조각 화면에서 봅니다. 노트북은 힌트를 세지 않습니다.")
    return "\n".join([
        "## 재구성(자기 확인)",
        "",
        f"본문을 마친 뒤(다른 날도 됩니다) 위 코드를 보지 않고 처음부터 다시 만들어 보는 연습입니다. 조각은 {len(tasks)}개({ids})이고, "
        "따로 채점 노트북 없이 조각마다 이 노트북의 자기 확인 셀이 바로 알려 줍니다.",
        "",
        "- 순서: 아래 \"재구성 시작\" 셀 → 조각마다 빈 셀에 작성하고 실행 → 그 아래 자기 확인 셀.",
        "- \"재구성 시작\" 셀은 위 본문에서 만든 이름(Value, n 같은 것과 math 같은 불러온 도구까지)을 지워 빈 노트북처럼 만듭니다. "
        "채점 도구와 채점 기록은 그대로 남습니다. 그래서 `import math` 같은 줄도 다시 씁니다. "
        "이 셀을 실행한 뒤에는 위 본문 셀을 다시 실행하지 않습니다(지운 이름이 다시 생겨 본문 코드를 채점하게 됩니다).",
        "- 다른 날 이어서 할 때: 맨 위 준비 셀 → \"재구성 시작\" 셀 → 조각 순서대로 → 마무리 셀.",
        hint,
        "- 자기 확인 결과도 마무리 셀의 결과코드에 들어갑니다.",
    ])


REBUILD_START_GUIDE = ("### 재구성 시작\n\n"
                       "아래 셀을 실행하면 위에서 만든 이름을 지워 빈 노트북처럼 만들고, L01-R3에서 학습 셀을 몇 번째 실행했는지 세기 시작합니다. "
                       "자기 확인 셀은 이 셀을 실행한 뒤에만 채점합니다.")

REBUILD_START_SOURCE = ("# 재구성 시작 셀: 고치지 말고 실행만 하세요. 위 본문에서 만든 이름을 지워 빈 노트북처럼 만들고, 학습 셀 실행 세기를 켭니다.\n"
                        "_z2h_rebuild_start()")


def rebuild_guide_markdown(canon, task):
    rid, chk = task["rebuild_id"], task["check"]
    out = [f"## {rid} {task['title_ko']}", "", f"**과제**: {task['task_ko']}", ""]
    if chk.get("type") == "value_range":
        steps, max_runs = chk.get("steps_per_run"), chk.get("max_reruns")
        line = f"**점검**: {chk.get('target', '값')} {chk['min']} ~ {chk['max']}."
        if steps and max_runs:
            line += (f" 학습 셀 1번 실행 = {steps}번 반복이고, {max_runs}번(합계 {steps * max_runs}번 반복) 안에 {chk['max']} 아래가 되면 "
                     "통과입니다. 다시 실행한 횟수는 힌트로 세지 않습니다.")
        out.append(line)
    else:
        ref_text = f" (대조: {chk['reference']})" if chk.get("reference") else ""
        out.append(f"**점검**: {chk.get('test_ko', '')}{ref_text}")
    out += ["", f"**자기 확인 셀이 보는 이름**: {REBUILD_NAMES[rid]}", ""]
    parts = rebuild_parts(rid)
    train = REBUILD_TRAIN.get(rid)
    if train:
        steps, max_runs, limit = chk["steps_per_run"], chk["max_reruns"], chk["max"]
        out += ["**실행 순서**: 만들기 셀 → 학습 셀 → 자기 확인 셀. 손실이 아직 "
                f"{limit} 위면 학습 셀만 다시 실행하고 자기 확인 셀도 다시 실행합니다. "
                "만들기 셀을 다시 실행하면 새 모델이라 1번째부터 다시 셉니다.",
                "",
                f"**몇 번째인지 세는 법**: \"재구성 시작\" 셀이 켠 세기가 셀을 실행할 때마다 `n`의 값이 바뀌었는지 보고 학습 셀 실행을 "
                f"셉니다(학습 셀 하나에 {steps}번 반복을 넣습니다). {max_runs}번을 넘기면 통과로 치지 않으니 만들기 셀부터 처음부터 다시 "
                "만들어 보세요. 셀 실행을 셀 수 없는 곳에서는 손실만 봅니다."]
    else:
        out.append("**실행 순서**: 아래 빈 셀" + " → 빈 셀" * (len(parts) - 1) + " → 자기 확인 셀")
    if rid == "L01-R2":
        out += ["", "**작성 방법**: L01-R1 셀의 Value 클래스에 backward()를 넣고 그 셀을 다시 실행해도 되고, "
                "아래 빈 셀에 backward()가 들어간 Value 클래스 전체를 다시 써도 됩니다."]
    return "\n".join(out)


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
    rids = [t["rebuild_id"] for t in rebuild_tasks(canon)]
    if set(rids) != set(REBUILD_CHECK_CALLS) or set(rids) != set(REBUILD_PARTS):
        raise BuildError(f"정본 재구성 조각 {rids} 와 이 프로그램의 자기 확인 목록 {sorted(REBUILD_CHECK_CALLS)} 이 다릅니다")
    for rid, part in REBUILD_TRAIN.items():
        chk = _rebuild_check(canon, rid)
        if not (chk.get("max_reruns") and chk.get("steps_per_run")):
            raise BuildError(f"{rid}: 정본 check 에 max_reruns, steps_per_run 이 없습니다(학습 셀 다시 실행 규칙)")
        if part not in REBUILD_PARTS[rid]:
            raise BuildError(f"{rid}: 학습 셀 {part!r} 이 작업 셀 목록에 없습니다")


def _rebuild_section(b, canon, solution):
    """마무리 셀 앞의 재구성(자기 확인) 구역."""
    b.md("rebuild", "rebuild-intro", rebuild_intro_markdown(canon))
    b.md("rebuild", "rebuild-start-guide", REBUILD_START_GUIDE)
    b.code("rebuild", "rebuild-start", REBUILD_START_SOURCE)
    for task in rebuild_tasks(canon):
        rid = task["rebuild_id"]
        b.md(rid, "rebuild-guide", rebuild_guide_markdown(canon, task))
        for part in rebuild_parts(rid):
            src = rebuild_part_source(canon, rid, part) if solution else rebuild_placeholder(canon, rid, part)
            b.code(rid, "rebuild-code", src, [f"part-{part}"])
            if solution and REBUILD_TRAIN.get(rid) == part:
                for k in range(2, _rebuild_check(canon, rid)["max_reruns"] + 1):
                    b.code(rid, "rebuild-rerun", rebuild_rerun_source(canon, rid, k), [f"rerun-{k}"])
        b.code(rid, "self-check", rebuild_check_source(rid))


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


def inject_answers(student_nb, answers=None, rebuild=None):
    """학생 노트북 사본의 빈 셀(step-code)에 정답(끝난 모습)을, 재구성 빈 셀(rebuild-code)에 재구성 정답을 넣는다. 시험용."""
    answers = answers if answers is not None else student_answers()
    rebuild = rebuild if rebuild is not None else rebuild_answers()
    nb = copy.deepcopy(student_nb)
    for cell in nb.cells:
        tags = cell.metadata.get("tags", [])
        if cell.cell_type == "code" and "step-code" in tags:
            cell.source = answers[tags[0]]
        elif cell.cell_type == "code" and "rebuild-code" in tags:
            part = next(t for t in tags if t.startswith("part-"))[len("part-"):]
            cell.source = rebuild[(tags[0], part)]
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
