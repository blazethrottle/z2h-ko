"""check_format.py 와 run_code.py 가 함께 쓰는 부분.

근거 문서: inputs/pedagogy/data-spec.md (칸 이름과 형식만). data-spec 이 정하지 않은 부분은 주석에 '추측'이라고 적었다.
"""
import difflib
import json
import re

# ---------------------------------------------------------------- ID 규칙 (data-spec 1절)
LECTURE_RE = re.compile(r"^L(0[1-9]|10)$")
UNIT_RE = re.compile(r"^F-(P[1-9]|M[1-6])$")
DIAG_RE = re.compile(r"^F-D\d+$")
DIAG_UNIT = "F-DIAG"  # data-spec 2절 객관식 예의 unit_id

SPLIT_SUFFIX = "[b-z]?"  # 쪼갠 단계: 기존 step_id 뒤에 b, c


def step_id_re(owner):
    return re.compile(r"^%s-S\d{2}%s$" % (re.escape(owner), SPLIT_SUFFIX))


def unit_step_re(owner):
    # 기초 단위의 단계 id 는 data-spec 에 없다. 강의 규칙(S 두 자리)과 F-P3-S1 같은 한 자리 모두 받는다(추측).
    return re.compile(r"^%s-S\d+%s$" % (re.escape(owner), SPLIT_SUFFIX))


def lecture_question_re(owner):
    return re.compile(r"^%s-Q\d{2}$" % re.escape(owner))


def unit_question_re(owner):
    return re.compile(r"^%s-Q\d+$" % re.escape(owner))


def rebuild_re(owner):
    return re.compile(r"^%s-R\d+$" % re.escape(owner))


def objective_re(owner):
    # data-spec 2절 lecture 예(L01-O1)에서 나온 모양. 1절 표에는 없어 경고만.
    return re.compile(r"^%s-O\d+$" % re.escape(owner))


HINT_SUFFIX_RE = re.compile(r"-H(\d+)$")

# ---------------------------------------------------------------- 허용값 (data-spec 2절 주석)
STEP_KINDS = {"code", "read", "reflect", "optional", "copy_run"}
STEP_CHECK_TYPES = {"manual", "output_match", "value_range"}
# data-spec step 목록 밖이지만 run_code 가 대조할 수 있는 유형(경고로만 허용)
STEP_CHECK_EXTRA = {"exact", "numeric_range", "error"}
QUESTION_TYPES = {"predict", "explain", "fix_bug", "apply", "choice"}
GRADE_TYPES = {"exact", "numeric_range", "keywords", "manual", "choice"}
ENV_VALUES = {"cpu", "mps", "colab_gpu"}
RESEARCH_STATUS = {"pending", "merged"}
EDIT_ACTIONS = {"insert", "replace"}
DONT_KNOW = "모르겠어요"
EM_DASH = chr(0x2014)  # 긴 줄표. 이 파일 자체에 그 글자를 넣지 않으려고 번호로 적음

# 결과 비교에 쓰는 칸 이름(data-spec 미정. run_code 가 받아들이는 이름)
OUTPUT_FIELDS = ("expected", "value", "output", "expected_output", "text", "contains")
EXPR_FIELDS = ("expr", "expression", "variable", "name")


def is_int(x):
    return isinstance(x, int) and not isinstance(x, bool)


def is_num(x):
    return (isinstance(x, (int, float))) and not isinstance(x, bool)


def split_lines(code):
    """셀 코드를 줄 목록으로. 끝의 줄바꿈 하나는 줄로 세지 않는다. None 과 빈 글은 0줄."""
    if not isinstance(code, str) or code == "":
        return []
    lines = code.split("\n")
    if lines and lines[-1] == "":
        lines = lines[:-1]
    return lines


# ---------------------------------------------------------------- JSON 읽기
class DupKeyRecorder:
    """json.loads 의 object_pairs_hook. 한 객체 안에 같은 칸이 두 번 나오면 기록한다."""

    def __init__(self):
        self.dups = []
        self.dup_owner = []

    def hook(self, pairs):
        seen = {}
        for k, v in pairs:
            if k in seen:
                self.dups.append(k)
                self.dup_owner.append(next((str(pv) for pk, pv in pairs if pk in ID_KEYS), "?"))
            seen[k] = v
        return seen


ID_KEYS = ("step_id", "question_id", "hint_id", "rebuild_id", "objective_id", "unit_id", "lecture_id", "mastery_rule_id")


def load_json(path):
    """(data, problems). problems 는 (code, message) 목록. 읽기 실패면 data=None."""
    problems = []
    rec = DupKeyRecorder()

    def bad_const(name):
        problems.append(("JSON-NAN", "JSON 에 %s 값이 있습니다. 표준 JSON 숫자만 씁니다" % name))
        return None

    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except UnicodeDecodeError as e:
        return None, [("JSON-PARSE", "UTF-8 로 읽을 수 없습니다: %s" % e)]
    try:
        data = json.loads(text, object_pairs_hook=rec.hook, parse_constant=bad_const)
    except json.JSONDecodeError as e:
        return None, [("JSON-PARSE", "JSON 읽기 실패: %s (줄 %d, 칸 %d)" % (e.msg, e.lineno, e.colno))]
    for k, owner in zip(rec.dups, rec.dup_owner):
        problems.append(("JSON-DUPKEY", "%s 객체 안에 '%s' 칸이 두 번 있습니다(뒤의 값만 남음)" % (owner, k)))
    return data, problems


# ---------------------------------------------------------------- 파일 종류
def detect_kind(data):
    if not isinstance(data, dict):
        return None
    lec = data.get("lecture")
    if isinstance(lec, dict) and isinstance(lec.get("lecture_id"), str) and lec["lecture_id"].startswith("L"):
        return "lecture"
    if "units" in data or "diagnostic" in data:
        return "foundation"
    for _, obj, _ in walk(data):
        uid = obj.get("unit_id")
        qid = obj.get("question_id")
        if (isinstance(uid, str) and uid.startswith("F-")) or (isinstance(qid, str) and qid.startswith("F-")):
            return "foundation"
    return None


# ---------------------------------------------------------------- 객체 찾기
def classify(obj):
    if "step_id" in obj:
        return "step"
    if "question_id" in obj:
        return "question"
    if "hint_id" in obj:
        return "hint"
    if "rebuild_id" in obj:
        return "rebuild"
    if "objective_id" in obj:
        return "objective"
    if "mastery_rule_id" in obj and "lecture_id" not in obj and (
        "steps_complete_ratio" in obj or "question_score_ratio" in obj or "rebuild_max_hint_level" in obj
    ):
        return "mastery_rule"
    if "unit_id" in obj and "lecture_id" not in obj:
        return "unit"
    if "lecture_id" in obj and "title_ko" in obj and ("youtube_video_id" in obj or "objectives" in obj):
        return "lecture"
    return None


def walk(node, path="$", unit=None, skip_meta=True):
    """모든 dict 를 (경로, 객체, 감싼 단위 id) 로 돌려준다. _meta 안은 보지 않는다."""
    if isinstance(node, dict):
        cls = classify(node)
        if cls == "unit" and isinstance(node.get("unit_id"), str):
            unit = node["unit_id"]
        yield path, node, unit
        for k, v in node.items():
            if skip_meta and path == "$" and k == "_meta":
                continue
            yield from walk(v, "%s.%s" % (path, k), unit, skip_meta)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk(v, "%s[%d]" % (path, i), unit, skip_meta)


def collect(data):
    """종류별 (경로, 객체, 감싼 단위) 목록."""
    out = {k: [] for k in ("step", "question", "hint", "rebuild", "objective", "mastery_rule", "unit", "lecture")}
    for path, obj, unit in walk(data):
        cls = classify(obj)
        if cls:
            out[cls].append((path, obj, unit))
    return out


def owner_of(obj, ctx_unit, kind_of_file, lecture_id=None):
    """객체가 속한 편/단위 id."""
    if kind_of_file == "lecture":
        return lecture_id
    uid = obj.get("unit_id")
    if isinstance(uid, str):
        return uid
    if ctx_unit:
        return ctx_unit
    qid = obj.get("question_id")
    if isinstance(qid, str) and DIAG_RE.match(qid):
        return DIAG_UNIT
    lid = obj.get("lecture_id")
    if isinstance(lid, str):
        return lid
    return None


def sort_steps(steps):
    """steps: (경로, 객체, ...) 목록. order 정수 순, 같으면 원래 순서."""
    def key(item):
        idx, (path, obj) = item
        o = obj.get("order")
        return (o if is_int(o) else 10 ** 9, idx)
    return [x[1] for x in sorted(enumerate(steps), key=key)]


# ---------------------------------------------------------------- edits 흉내 (data-spec 2절 v1.2)
def _find_anchor(cell, anchor):
    a = anchor.strip()
    return [i for i, line in enumerate(cell) if line.strip() == a]


def _similar(a_lines, b_lines):
    a = "\n".join(x.strip() for x in a_lines)
    b = "\n".join(x.strip() for x in b_lines)
    return difflib.SequenceMatcher(None, a, b).ratio()


def simulate_cells(ordered_steps):
    """순서대로 셀 내용을 흉내 낸다.

    ordered_steps: (경로, 객체) 목록(이미 order 순).
    돌려줌: (plans, problems, 마지막 셀 상태)
      plans[step_id] = {
        "edits": [(target_step, 바뀐 셀 줄 목록 사본, 설명)],
        "own_cell": 이 단계 새 셀 줄 목록(없으면 []),
        "edited": [이 단계가 고친 셀의 단계 id, 처음 고친 순서],
        "rerun": [rerun_first 에 적힌 단계 id, 적힌 순서],
        "edit_failed": bool,
      }
      problems: (severity, code, step_id, message) 목록
    edits 해석:
      - code 앞쪽 줄들이 edits 순서대로 넣을 줄, 나머지는 새 셀(data-spec 2절).
      - insert: anchor_line 과 같은 줄(앞뒤 공백 무시) 바로 아래, null 이면 셀 맨 아래.
      - replace: data-spec 이 어느 줄을 바꾸는지 정하지 않아, anchor_line 자체부터 line_count 줄(해석 B)과
        anchor_line 바로 아래부터 line_count 줄(해석 A) 중 새 줄과 더 닮은 쪽을 바꾼다(추측).
    """
    cells = {}
    plans = {}
    problems = []
    known_ids = {obj.get("step_id") for _, obj in ordered_steps}
    for path, step in ordered_steps:
        sid = step.get("step_id")
        lines = split_lines(step.get("code"))
        edits = step.get("edits") or []
        plan = {"edits": [], "own_cell": [], "edited": [], "rerun": [], "edit_failed": False, "notes": []}
        k = 0
        if not isinstance(edits, list):
            problems.append(("error", "EDITS", sid, "edits 는 목록이어야 합니다"))
            edits = []
            plan["edit_failed"] = True
        for i, e in enumerate(edits):
            where = "edits[%d]" % i
            if not isinstance(e, dict):
                problems.append(("error", "EDITS", sid, "%s 가 객체가 아닙니다" % where))
                plan["edit_failed"] = True
                continue
            tgt = e.get("target_step")
            act = e.get("action")
            anchor = e.get("anchor_line")
            n = e.get("line_count")
            if not is_int(n) or n < 1:
                problems.append(("error", "EDITS", sid, "%s.line_count 는 1 이상의 정수여야 합니다(값 %r)" % (where, n)))
                plan["edit_failed"] = True
                continue
            new = lines[k:k + n]
            k += n
            if len(new) < n:
                problems.append(("error", "EDITS", sid, "edits 의 line_count 합이 code 줄 수(%d)보다 큽니다" % len(lines)))
                plan["edit_failed"] = True
                continue
            if act not in EDIT_ACTIONS:
                problems.append(("error", "EDITS", sid, "%s.action 은 insert 또는 replace 여야 합니다(값 %r)" % (where, act)))
                plan["edit_failed"] = True
                continue
            if not isinstance(tgt, str) or tgt not in known_ids:
                # 존재 여부 자체는 check_format 이 REF-STEP 으로도 잡는다. 여기서는 실행 불가로만 표시.
                problems.append(("error", "EDITS", sid, "%s.target_step %r 단계를 찾을 수 없습니다" % (where, tgt)))
                plan["edit_failed"] = True
                continue
            if tgt not in cells:
                problems.append(("error", "EDITS", sid,
                                 "%s.target_step %s 의 셀이 아직 없습니다(뒤 단계이거나 새 셀이 없는 단계)" % (where, tgt)))
                plan["edit_failed"] = True
                continue
            cell = cells[tgt]
            if anchor is not None and not isinstance(anchor, str):
                problems.append(("error", "EDITS", sid, "%s.anchor_line 은 글자 또는 null 이어야 합니다" % where))
                plan["edit_failed"] = True
                continue
            if anchor is None:
                if act == "insert":
                    cell = cell + new
                    desc = "%s 맨 아래에 %d줄 넣음" % (tgt, n)
                else:
                    problems.append(("warning", "EDITS", sid,
                                     "%s: replace 인데 anchor_line 이 null 이라 %s 맨 아래 %d줄을 바꾼다고 보았습니다(추측)" % (where, tgt, n)))
                    cell = cell[:max(0, len(cell) - n)] + new
                    desc = "%s 맨 아래 %d줄 바꿈" % (tgt, n)
            else:
                idxs = _find_anchor(cell, anchor)
                if not idxs:
                    problems.append(("error", "EDITS", sid,
                                     "%s.anchor_line %r 줄이 %s 셀에 없습니다" % (where, anchor, tgt)))
                    plan["edit_failed"] = True
                    continue
                if len(idxs) > 1:
                    problems.append(("warning", "EDITS", sid,
                                     "%s.anchor_line %r 이 %s 셀에 %d번 나와 첫 번째로 보았습니다. 한 번만 나오는 줄을 고르세요"
                                     % (where, anchor, tgt, len(idxs))))
                j = idxs[0]
                if act == "insert":
                    cell = cell[:j + 1] + new + cell[j + 1:]
                    desc = "%s 의 %r 아래에 %d줄 넣음" % (tgt, anchor.strip(), n)
                else:
                    cand_b = cell[j:j + n]
                    cand_a = cell[j + 1:j + 1 + n]
                    sb = _similar(cand_b, new)
                    sa = _similar(cand_a, new) if cand_a else -1.0
                    if sb >= sa:
                        cell = cell[:j] + new + cell[j + n:]
                        desc = "%s 의 %r 줄부터 %d줄을 바꿈(해석 B)" % (tgt, anchor.strip(), n)
                    else:
                        cell = cell[:j + 1] + new + cell[j + 1 + n:]
                        desc = "%s 의 %r 아래 %d줄을 바꿈(해석 A)" % (tgt, anchor.strip(), n)
                    if abs(sb - sa) < 0.15:
                        problems.append(("warning", "EDITS", sid,
                                         "%s: replace 가 바꿀 줄이 모호합니다(anchor 줄 자체 닮음 %.2f, 아래 줄 닮음 %.2f). %s"
                                         % (where, sb, max(sa, 0), desc)))
            cells[tgt] = cell
            plan["edits"].append((tgt, list(cell), desc))
        own = lines[k:]
        if own:
            cells[sid] = own
        plan["own_cell"] = own
        rr = step.get("rerun_first") or []
        edited = []
        for tgt, _, _ in plan["edits"]:
            if tgt not in edited:
                edited.append(tgt)
        plan["edited"] = edited
        plan["rerun"] = [r for r in rr if isinstance(r, str)] if isinstance(rr, list) else []
        plans[sid] = plan
    return plans, problems, cells
