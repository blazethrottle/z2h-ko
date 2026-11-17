# 출처: 채점 기준(정본 expected_check, 재구성 check_code)의 강의 예제 숫자는 karpathy/nn-zero-to-hero (lectures/micrograd), Value 동작 기준은 karpathy/micrograd (engine.py), 둘 다 MIT License. 채점 코드는 새로 씀.
"""1편 micrograd 채점: 기준값 파일(reference/l01.json, 정본 L01.json 에서 z2h_check.refgen 이 만든 것)을 그대로 채점 칸으로 쓴다.

채점 칸 = 정본의 코드 단계(정본 순서) + 재구성 조각. 모두 check("<칸 id>", globals()) 로 부른다.
단계 칸은 정본 expected_check 의 모양대로 본다.
- value_range + expr: 식을 학생 이름 공간(사본)에서 계산해 min~max 안인지. 식이 읽는 이름(기준값 reads)이 아직 없으면 "○ 아직".
- output_match: 바로 위 '내 셀'이 보인 글(print 출력 + 마지막 줄 값)에 기대 출력이 들어 있는지(소수는 허용 오차).
- value_range(식 없음): 바로 위 셀 출력의 마지막 숫자가 min~max 안인지.
- manual: 바로 위 셀이 오류 없이 돌았는지만 본다. 통과로 기록하되 화면에는 "✓ 실행됨"으로 보이고,
  그림의 숫자는 학습자가 '스스로 확인할 것' 목록으로 확인한다.
재구성 칸은 정본 확인 셀(check_code)을 학생 이름 공간의 사본에서 실행하고, 그 출력을 통과 기준(pass_ko)대로 본다.
"""
import builtins
import contextlib
import io

from . import _util as U
from .. import runs
from .._resources import load_json

LECTURE_ID = "L01"
MANUAL_MARK = "✓ 실행됨"  # 그림 단계: 통과(p)로 기록하지만 내용은 학습자가 스스로 확인하므로 '맞음'이라 하지 않는다


def ref():
    return load_json("reference/l01.json")


def tol():
    return ref()["tolerance"]["number"]


def usage(check_id):
    return f'check("{check_id}", globals())'


F = U.fmt


# ---- 이름 공간 다루기 -----------------------------------------------------------

def _need_ns(ns, check_id):
    if not isinstance(ns, dict):
        raise U.Fail(f"채점 셀을 고치지 말고 그대로 실행하세요: {usage(check_id)}")
    return ns


def _missing(names, ns):
    return sorted(name for name in names if name not in ns and not hasattr(builtins, name))


def _not_yet_names(missing, where):
    shown = ", ".join(missing[:4])
    return U.NotYet(f"{where}에 필요한 이름 {shown}이(가) 아직 없어요. 위 셀을 먼저 실행한 뒤 이 채점 셀을 다시 실행하세요.")


def _eval_number(expr, reads, ns):
    missing = _missing(reads, ns)
    if missing:
        raise _not_yet_names(missing, f"확인 식 {expr}")
    code = compile(expr, "<확인 식>", "eval")
    value = U.student(f"확인 식 {expr} 계산", eval, code, dict(ns))  # 정본 확인 식을 학생 이름 공간의 사본에서 계산
    return U.as_number(value, f"확인 식 {expr}")


# ---- 바로 위 셀 -------------------------------------------------------------------

def _last_cell():
    cell = runs.last_cell()
    if cell is None:
        if runs.watching():
            raise U.NotYet("바로 위 단계 셀을 먼저 실행한 뒤 이 채점 셀을 다시 실행하세요.")
        raise U.Skip("이 실행 환경에서는 셀 출력을 읽지 못해, 출력으로 보는 칸은 건너뜁니다.")
    if cell["blank"]:
        raise U.NotYet("위 빈 셀에 코드를 입력해 실행한 뒤 이 채점 셀을 다시 실행하세요.")
    if cell["error"] is not None:
        raise U.Fail(U.student_error_message("바로 위 셀 실행", cell["error"]))
    return cell


def _shown_text(cell):
    return "\n".join(part for part in (cell["stdout"], cell["shown"]) if part)


def _range_text(exp):
    lo, hi = exp["min"], exp["max"]
    return F(lo) if lo == hi else f"{F(lo)}~{F(hi)}"


def _value_text(value, exp):
    """정본 범위가 정수(개수)이면 내 값도 정수로 보여 준다."""
    if isinstance(exp["min"], int) and isinstance(exp["max"], int) and value.is_integer():
        return str(int(value))
    return F(value)


def _in_range(value, exp, label):
    shown = _value_text(value, exp)
    if exp["min"] <= value <= exp["max"]:
        return f"{label} = {shown} (기준 {_range_text(exp)})."
    raise U.Fail(f"{label} = {shown}. 기준은 {_range_text(exp)} 입니다. 앱의 '보여야 하는 것'과 비교해 보세요.")


# ---- 단계 칸 -------------------------------------------------------------------

def _grade_step(spec, ns):
    exp = spec["expected_check"]
    kind = exp["type"]
    if kind == "value_range" and exp.get("expr"):
        value = _eval_number(exp["expr"], spec["reads"], _need_ns(ns, spec["step_id"]))
        return _in_range(value, exp, f"확인 식 {exp['expr']}")
    cell = _last_cell()
    text = _shown_text(cell)
    if kind == "output_match":
        want = exp["expected"]
        if U.output_has(text, want, tol()):
            return f"출력에 {U.preview(want)} 이(가) 보입니다."
        got = U.preview(text) or "(출력 없음)"
        raise U.Fail(f"출력에서 {U.preview(want)} 을(를) 찾지 못했습니다(소수는 {tol():g}까지 같으면 맞음). "
                     f"내 출력: {got}. 앱의 '보여야 하는 것'과 비교해 보세요.")
    if kind == "value_range":
        value = U.last_number(text)
        if value is None:
            raise U.Fail(f"바로 위 셀 출력에 숫자가 없습니다. {_range_text(exp)} 사이 숫자가 찍혀야 합니다.")
        return _in_range(value, exp, "출력의 마지막 숫자")
    if kind == "manual":
        return U.Pass("셀이 오류 없이 돌았습니다. 그림의 숫자는 위 '보여야 하는 것'의 '스스로 확인할 것'으로 직접 확인하세요.",
                      mark=MANUAL_MARK)
    raise ValueError(f"모르는 expected_check.type: {kind}")


def _step_grader(spec):
    def grade(ns=None):
        return _grade_step(spec, ns)
    return grade


# ---- 재구성 칸 -----------------------------------------------------------------

def _run_check_code(rebuild_id, code, ns):
    """정본 확인 셀을 학생 이름 공간의 사본에서 실행하고 찍힌 글을 돌려준다(학생 이름은 바꾸지 않는다)."""
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        U.student("확인 셀 실행", exec, compile(code, f"<{rebuild_id} 확인 셀>", "exec"), dict(ns))
    return out.getvalue()


def _grade_rebuild(spec, ns):
    rid = spec["rebuild_id"]
    ns = _need_ns(ns, rid)
    missing = _missing(spec["reads"], ns)
    if missing:
        raise _not_yet_names(missing, "확인 셀")
    text = _run_check_code(rid, spec["check_code"], ns)
    got = U.preview(text) or "(출력 없음)"
    rule = spec["pass"]
    if rule["rule"] == "output_match":
        if U.output_has(text, rule["expected"], tol()):
            return f"확인 셀 출력 {got} 이(가) 통과 기준과 같습니다."
        raise U.Fail(f"확인 셀 출력이 {got} 입니다. {U.preview(rule['expected'])} 이(가) 나와야 통과입니다.")
    if rule["rule"] == "ends_with":
        if text.split() and text.split()[-1] == rule["text"]:
            return f"확인 셀 출력 {got} 의 끝이 {rule['text']} 입니다."
        raise U.Fail(f"확인 셀 출력이 {got} 입니다. 끝이 {rule['text']} 여야 통과입니다.")
    raise ValueError(f"모르는 통과 기준: {rule['rule']}")


def _rebuild_grader(spec):
    def grade(ns=None):
        return _grade_rebuild(spec, ns)
    return grade


# ---- 등록 ----------------------------------------------------------------------

def _register():
    checks, graders, usages = [], {}, {}
    for spec in ref()["steps"]:
        cid = spec["step_id"]
        checks.append((cid, spec["title_ko"]))
        graders[cid] = _step_grader(spec)
        usages[cid] = usage(cid)
    for spec in ref()["rebuild"]:
        rid = spec["rebuild_id"]
        checks.append((rid, spec["title_ko"]))
        graders[rid] = _rebuild_grader(spec)
        usages[rid] = usage(rid)
    return checks, graders, usages


CHECKS, GRADERS, USAGE = _register()  # CHECKS: [(check_id, 제목)] 기준값 파일 순서(= 정본 순서)


def mastery_note():
    """finish() 채점표 끝에 붙이는 익힘 기준 한 줄(정본 mastery_rule)."""
    rule = ref()["mastery_rule"]
    return (f"익힘 기준(앱이 판정): 단계 완료 {rule['steps_complete_ratio']:.0%}(선택 단계 제외) · "
            f"확인 문제 {rule['question_score_ratio']:.0%} 이상 · 재구성은 힌트 H{rule['rebuild_max_hint_level']} 이하로 통과.")
