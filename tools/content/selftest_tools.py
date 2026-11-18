"""check_format.py, run_code.py 자체 확인. fixtures/ 의 예시로 통과와 실패를 제대로 가르는지 본다.

실행: .venv/bin/python tools/content/selftest_tools.py   (종료 코드 0 = 모두 기대대로)
"""
import json
import os
import subprocess
import sys
import tempfile

import cc_common as C
import run_code as RC

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures")
PY = sys.executable

failures = []


def run(tool, *args):
    cmd = [PY, os.path.join(HERE, tool), *args]
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    return p.returncode, p.stdout, p.stderr


def expect(cond, label):
    print(("  통과 " if cond else "  실패 ") + label)
    if not cond:
        failures.append(label)


def fmt_json(path, *extra):
    code, out, err = run("check_format.py", "--json", path, *extra)
    try:
        rep = json.loads(out)
    except Exception:
        print(out, err)
        rep = {"findings": [], "errors": -1, "warnings": -1}
    return code, rep, err


def codes_of(rep, severity="error"):
    return {f["code"] for f in rep["findings"] if f["severity"] == severity}


# ---------------------------------------------------------------- check_format
print("[check_format] ok.json")
code, rep, err = fmt_json(os.path.join(FIX, "ok.json"))
expect(code == 0, "ok.json 종료 코드 0 (실제 %s)" % code)
expect(rep["errors"] == 0, "ok.json 오류 0개 (실제 %s: %s)" % (rep["errors"], sorted(codes_of(rep))))
expect(rep.get("kind") == "lecture", "ok.json 을 강의 파일로 판별")

print("[check_format] bad.json")
code, rep, err = fmt_json(os.path.join(FIX, "bad.json"))
expect(code == 1, "bad.json 종료 코드 1 (실제 %s)" % code)
want = {
    "TOP-MISSING", "JSON-DUPKEY", "FIELD-ENUM", "ID-FORMAT", "LINES-NOTES", "LINES-LIMIT",
    "LINES-LONG", "VIDEO-SEG", "VIDEO-END", "ORDER-DUP", "DASH", "REF-OBJ", "REF-HINT",
    "ID-OWNER", "FIELD-MISSING", "LINES-NEW", "LINES-PREP", "EDITS", "CHOICE", "GRADE",
    "RUBRIC", "ANSWER", "REF-STEP", "ALT", "HINT-LEVEL", "HINT-TARGET", "HINT-BLANKS",
    "REF-MASTERY", "RATIO", "REF-UNIT",
}
got = codes_of(rep)
for c in sorted(want):
    expect(c in got, "bad.json 에서 %s 오류를 잡음" % c)

print("[check_format] ok_F.json")
code, rep, err = fmt_json(os.path.join(FIX, "ok_F.json"))
expect(code == 0, "ok_F.json 종료 코드 0 (실제 %s)" % code)
expect(rep["errors"] == 0, "ok_F.json 오류 0개 (실제 %s: %s)" % (rep["errors"], sorted(codes_of(rep))))
expect(rep.get("kind") == "foundation", "ok_F.json 을 기초 파일로 판별")

print("[check_format] ok.json + --foundation ok_F.json (prereq_units 교차 확인)")
code, rep, err = fmt_json(os.path.join(FIX, "ok.json"), "--foundation", os.path.join(FIX, "ok_F.json"))
expect(code == 0 and rep["errors"] == 0, "F-P1 이 기초 파일에 있어 통과")
code, rep, err = fmt_json(os.path.join(FIX, "ok.json"), "--foundation", os.path.join(FIX, "bad_F.json"))
expect(code == 0, "bad_F 의 단위 목록에도 F-P1 이 있어 통과")

print("[check_format] bad_F.json")
code, rep, err = fmt_json(os.path.join(FIX, "bad_F.json"))
expect(code == 1, "bad_F.json 종료 코드 1 (실제 %s)" % code)
want_f = {"ID-FORMAT", "ID-DUP", "DIAG", "REF-UNIT", "LINES-NOTES", "DASH", "RUBRIC"}
got = codes_of(rep)
for c in sorted(want_f):
    expect(c in got, "bad_F.json 에서 %s 오류를 잡음" % c)
diag_msgs = [f["message"] for f in rep["findings"] if f["code"] == "DIAG" and f["severity"] == "error"]
expect(any("5" in m for m in diag_msgs), "진단 문항 수(5개 아님) 메시지")
expect(any("힌트" in m for m in diag_msgs), "진단 문항 힌트 메시지")
expect(any("모르겠어요" in m for m in diag_msgs), "정답이 모르겠어요인 메시지")

print("[check_format] 깨진 JSON, 없는 파일")
with tempfile.TemporaryDirectory() as td:
    broken = os.path.join(td, "broken.json")
    with open(broken, "w", encoding="utf-8") as f:
        f.write('{"lecture": {"lecture_id": "L01",}')
    code, rep, err = fmt_json(broken)
    expect(code == 1 and "JSON-PARSE" in codes_of(rep), "깨진 JSON 은 JSON-PARSE 와 종료 1")
code, out, err = run("check_format.py", os.path.join(FIX, "nope.json"))
expect(code == 2, "없는 파일은 종료 2 (실제 %s)" % code)

print("[check_format] 사람용 출력")
code, out, err = run("check_format.py", os.path.join(FIX, "bad.json"))
expect(code == 1 and "오류" in out and "LINES-NOTES" in out, "표 출력에 오류 코드가 보임")


# ---------------------------------------------------------------- run_code
def run_json(path, *extra):
    code, out, err = run("run_code.py", "--json", path, *extra)
    try:
        rep = json.loads(out)
    except Exception:
        print(out[-2000:], err[-2000:])
        rep = {"steps": [], "questions": []}
    return code, rep, err


def status_map(rep, key="steps"):
    return {r["id"]: r["status"] for r in rep.get(key, [])}


print("[run_code] ok.json")
code, rep, err = run_json(os.path.join(FIX, "ok.json"))
st = status_map(rep)
expect(code == 0, "ok.json 종료 코드 0 (실제 %s)" % code)
expect(not any(s in ("mismatch", "error") for s in st.values()), "ok.json 불일치·예외 없음 (%s)" % st)
for sid, want_s in {
    "L01-S01": "skip", "L01-S02": "pass", "L01-S03": "pass", "L01-S04": "pass",
    "L01-S05": "pass", "L01-S06": "pass", "L01-S07": "pass", "L01-S08": "ran",
    "L01-S09": "ran", "L01-S10": "pass", "L01-S11": "pass", "L01-S12": "pass",
}.items():
    expect(st.get(sid) == want_s, "ok.json %s = %s (실제 %s)" % (sid, want_s, st.get(sid)))
s12 = next(r for r in rep["steps"] if r["id"] == "L01-S12")
expect(s12["output"].strip() == "23", "고친 학습 셀이 rerun_first 뒤에 돌고, 대조 출력에 rerun 출력(20)이 섞이지 않음 (실제 %r)" % s12["output"])
s04 = next(r for r in rep["steps"] if r["id"] == "L01-S04")
expect(any("먼저 다시 실행" in n for n in s04["notes"]), "rerun_first 에 없는 고친 클래스 셀은 rerun_first 보다 먼저 실행")

print("[run_code] ok.json --questions")
code, rep, err = run_json(os.path.join(FIX, "ok.json"), "--questions")
qs = status_map(rep, "questions")
expect(code == 0, "--questions 종료 코드 0 (실제 %s)" % code)
expect(qs.get("L01-Q02") == "pass", "L01-Q02 예측 문제 답이 실제 출력과 같음 (실제 %s)" % qs.get("L01-Q02"))

print("[run_code] bad.json")
code, rep, err = run_json(os.path.join(FIX, "bad.json"))
st = status_map(rep)
expect(code == 1, "bad.json 종료 코드 1 (실제 %s)" % code)
for sid, want_s in {
    "L01-S01": "mismatch",   # 출력 6, 기대 7
    "L01-S05": "error",      # 예상 밖 NameError
    "L01-S07": "mismatch",   # value_range 밖
    "L01-S08": "error",      # anchor_line 못 찾아 edits 실패
    "L01-S09": "mismatch",   # 기대한 에러가 안 남
    "L01-S10": "mismatch",   # 다른 종류의 에러
    "L01-S11": "mismatch",   # 기대 5 가 15, 0.5, 5.0 의 일부로 맞으면 안 됨
    "L01-S2": "ran",
}.items():
    expect(st.get(sid) == want_s, "bad.json %s = %s (실제 %s)" % (sid, want_s, st.get(sid)))

print("[run_code] ok_F.json")
code, rep, err = run_json(os.path.join(FIX, "ok_F.json"), "--questions")
st = status_map(rep)
expect(code == 0, "ok_F.json 종료 코드 0 (실제 %s)" % code)
expect(st.get("F-M1-S01") == "pass", "단위마다 새 이름공간(F-M1 에서 apples 없음 = NameError 기대 일치)")
expect(st.get("F-P1-S02") == "pass", "같은 단위 안에서는 이름공간 이어짐")
expect(st.get("F-P1-S3") == "pass", "restart_first: 이름공간을 비워 NameError(메시지에 apples) 기대 일치")
qs = status_map(rep, "questions")
expect(qs.get("F-P1-Q1") == "pass", "F-P1-Q1 예측 답 확인 (실제 %s)" % qs.get("F-P1-Q1"))

print("[run_code] bad_F.json")
code, rep, err = run_json(os.path.join(FIX, "bad_F.json"))
st = status_map(rep)
expect(code == 1, "bad_F.json 종료 코드 1 (실제 %s)" % code)
expect(st.get("F-P1-S01") == "mismatch", "F-P1-S01 출력 불일치")
expect(st.get("F-P1-S02") == "error", "F-P1-S02 예상 밖 에러")

print("[run_code] 사람용 출력")
code, out, err = run("run_code.py", os.path.join(FIX, "bad.json"))
expect(code == 1 and "불일치" in out and "L01-S07" in out, "표와 불일치 목록이 보임")

print("[함수] 출력 대조와 edits 해석")
tm = RC.text_match
expect(tm("5\n", "5", "contains", 1e-6), "contains: 5 = 5")
expect(tm("x = 5", "5", "contains", 1e-6), "contains: 'x = 5' 안의 5")
expect(not tm("15", "5", "contains", 1e-6), "contains: 15 는 5 가 아님")
expect(not tm("0.5", "5", "contains", 1e-6), "contains: 0.5 는 5 가 아님")
expect(not tm("5.0", "5", "contains", 1e-6), "contains: 5.0 은 5 가 아님")
expect(tm("Value(data=3.0)", "Value(data=3.0)", "contains", 1e-6), "contains: 괄호 있는 글")
expect(tm("a\nb\nc", "b\nc", "contains", 1e-6), "contains: 여러 줄 묶음")
expect(tm("0.30000000000000004", "0.3", "exact", 1e-6), "exact: 소수 끝자리 차이는 허용오차로 일치")
expect(not tm("0.31", "0.3", "exact", 1e-6), "exact: 0.31 은 0.3 이 아님")
expect(tm("loss 0.1234567", "loss 0.12345", "exact", 1e-3), "exact: tolerance 를 주면 넓게")

cell_steps = [
    ("$", {"step_id": "L01-S01", "order": 1, "code": "def f():\n    return 1\nprint(f())"}),
    ("$", {"step_id": "L01-S02", "order": 2, "code": "    return 2",
           "edits": [{"target_step": "L01-S01", "action": "replace", "anchor_line": "def f():", "line_count": 1}]}),
    ("$", {"step_id": "L01-S03", "order": 3, "code": "    return 3",
           "edits": [{"target_step": "L01-S01", "action": "replace", "anchor_line": "    return 2", "line_count": 1}]}),
]
plans, probs, cells = C.simulate_cells(cell_steps)
expect(plans["L01-S02"]["edits"][0][1] == ["def f():", "    return 2", "print(f())"],
       "replace 해석 A: anchor 가 바로 윗줄이면 그 아래 줄을 바꿈")
expect(cells["L01-S01"] == ["def f():", "    return 3", "print(f())"],
       "replace 해석 B: anchor 가 바꿀 줄 자체면 그 줄을 바꿈")
expect(not [p for p in probs if p[0] == "error"], "edits 흉내에 오류 없음")

print()
if failures:
    print("자체 확인 실패 %d건" % len(failures))
    for f in failures:
        print(" -", f)
    sys.exit(1)
print("자체 확인 모두 통과")
