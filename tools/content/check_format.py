"""콘텐츠 JSON 형식 검사. 근거는 data-spec(inputs/pedagogy/data-spec.md)의 칸 이름과 형식뿐이다(만들 때 본 판은 README '형식 검사의 근거').

쓰는 법(저장소 루트에서):
  .venv/bin/python tools/content/check_format.py inputs/pedagogy/content/L01.json --foundation inputs/pedagogy/content/F.json
  .venv/bin/python tools/content/check_format.py inputs/pedagogy/content/F.json
  .venv/bin/python tools/content/check_format.py inputs/pedagogy/content/F.json --json
종료 코드: 0 통과, 1 오류 있음(--strict 면 경고도), 2 파일 없음·인자 잘못, 3 도구 내부 오류.
data-spec 이 정하지 않은 부분은 오류가 아니라 경고로만 낸다.
"""
import argparse
import json
import os
import re
import sys

import cc_common as C

# ---------------------------------------------------------------- 근거 표기
B_ID = "data-spec 1절"
B_LEC = "data-spec 2절 lecture"
B_STEP = "data-spec 2절 step"
B_V12 = "data-spec 2절 step v1.2"
B_Q = "data-spec 2절 question"
B_CHOICE = "data-spec 2절 객관식, 4절 8"
B_DIAG = "data-spec 2절 객관식(진단), PM 보충 앱 화면 구조"
B_HINT = "data-spec 2절 hint"
B_RB = "data-spec 2절 rebuild_task"
B_MR = "data-spec 2절 mastery_rule"
B_TOP = "PM 지시(최상위 칸 목록)"
B_GUESS = "data-spec 미정(경고만)"
R1 = "data-spec 4절 1"
R2 = "data-spec 4절 2"
R3 = "data-spec 4절 3"
R4 = "data-spec 4절 4"
R7 = "data-spec 4절 7"
R9 = "data-spec 4절 9"
R11 = "data-spec 4절 11"

TOP_LECTURE = [
    ("_meta", dict), ("lecture", dict), ("steps", list), ("questions", list),
    ("rebuild_tasks", list), ("mastery_rule", dict), ("hints", list),
]

LECTURE_FIELDS = {
    "lecture_id": str, "title_ko": str, "video_url": str, "youtube_video_id": str,
    "video_seconds": int, "video_minutes": int, "source_repos": list, "env": list,
    "objectives": list, "prereq_units": list, "prereq_lectures": list,
    "mastery_rule_id": str, "research_status": str,
}
LECTURE_OPTIONAL = {"rewards": dict}

STEP_BASE = {
    "step_id": str, "lecture_id": str, "order": int, "title_ko": str, "video_segments": list,
    "long_step": bool, "new_code_lines": int, "prepared_code": (str, type(None)), "kind": str,
    "input_ko": str, "code": (str, type(None)), "code_line_notes_ko": list, "expected_ko": str,
    "expected_check": dict, "meaning_ko": str, "objective_ids": list, "hint_ids": list,
}
STEP_V12 = {
    "prepared_code_line_notes_ko": list, "prepared_code_source_ko": (str, type(None)), "edits": list,
    "rerun_first": list, "moved_code_lines": int, "cell_code_lines": int,
    "code_alt_local": (str, type(None)), "code_alt_local_line_notes_ko": list,
    "expected_output_example": (str, type(None)), "aha_ko": (str, type(None)),
    "summary_ko": (str, type(None)), "minutes": (int, float), "question_ids": list,
}
RUN_EXTRA = {"expected_error", "expects_error", "restart_first"}  # data-spec 밖, run_code 가 읽는 칸

QUESTION_FIELDS = {
    "question_id": str, "lecture_id": str, "unit_id": str, "type": str, "prompt_ko": str,
    "code": (str, type(None)), "answer_ko": str, "auto_grade": dict, "rubric": list,
    "max_points": (int, float), "must_pass": bool, "alternate_of": (str, type(None)),
    "objective_ids": list, "hint_ids": list, "choices": list, "answer_index": int,
    "recommend_units_if_wrong": list, "after_step": (str, type(None)), "scored": bool,
}
HINT_FIELDS = {
    "hint_id": str, "target_id": str, "level": int, "text_ko": str,
    "code_with_blanks": (str, type(None)), "unlock": dict, "show_solution": bool,
    "taster_role_ko": (str, type(None)),
}
REBUILD_FIELDS = {"rebuild_id": str, "lecture_id": str, "title_ko": str, "check": dict, "max_hint_level_for_pass": int}
MASTERY_FIELDS = {
    "mastery_rule_id": str, "steps_complete_ratio": (int, float), "question_score_ratio": (int, float),
    "rebuild_max_hint_level": int, "extra_checks": list,
}
SEGMENT_FIELDS = {"start_s", "end_s"}
EDIT_FIELDS = {"target_step", "where_ko", "action", "anchor_line", "line_count"}
RUBRIC_FIELDS = {"point", "criterion_ko"}
UNLOCK_FIELDS = {"after_attempts", "after_minutes"}
CHECK_KNOWN_KEYS = {"type", "reference", "match", "tolerance", "min", "max", "low", "high", "range", "pattern", "regex",
                    "error", "error_type"} | set(C.OUTPUT_FIELDS) | set(C.EXPR_FIELDS)
YT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


class Report:
    def __init__(self):
        self.findings = []

    def add(self, severity, code, where, message, basis):
        self.findings.append({"severity": severity, "code": code, "where": where, "message": message, "basis": basis})

    def err(self, code, where, message, basis):
        self.add("error", code, where, message, basis)

    def warn(self, code, where, message, basis):
        self.add("warning", code, where, message, basis)

    def count(self, sev):
        return sum(1 for f in self.findings if f["severity"] == sev)


def type_name(t):
    names = {str: "글자", int: "정수", float: "숫자", bool: "참/거짓", list: "목록", dict: "객체", type(None): "null"}
    if isinstance(t, tuple):
        return " 또는 ".join(names.get(x, x.__name__) for x in t)
    return names.get(t, t.__name__)


def type_ok(v, t):
    ts = t if isinstance(t, tuple) else (t,)
    for x in ts:
        if x is int and C.is_int(v):
            return True
        if x is float and C.is_num(v):
            return True
        if x is bool and isinstance(v, bool):
            return True
        if x not in (int, float, bool) and isinstance(v, x):
            return True
    return False


def check_fields(r, where, obj, spec, required, missing_sev, basis, extra_known=()):
    """필수 칸, 타입, 모르는 칸."""
    for name in required:
        if name not in obj:
            r.add(missing_sev, "FIELD-MISSING", where, "필수 칸이 없습니다: '%s'" % name, basis)
    for name, v in obj.items():
        if name in spec:
            if not type_ok(v, spec[name]):
                r.err("FIELD-TYPE", where, "'%s' 는 %s 이어야 합니다(지금 %s)" % (name, type_name(spec[name]), type(v).__name__), basis)
        elif name in extra_known:
            continue
        elif name in RUN_EXTRA:
            r.warn("UNKNOWN-FIELD", where, "'%s' 는 data-spec 에 없는 칸입니다(run_code 가 읽음)" % name, B_GUESS)
        else:
            r.warn("UNKNOWN-FIELD", where, "'%s' 는 data-spec 에 없는 칸입니다" % name, B_GUESS)


def check_str_list(r, where, obj, name, basis):
    v = obj.get(name)
    if v is None:
        return []
    if not isinstance(v, list) or not all(isinstance(x, str) for x in v):
        r.err("FIELD-TYPE", where, "'%s' 는 글자 목록이어야 합니다" % name, basis)
        return [x for x in v if isinstance(x, str)] if isinstance(v, list) else []
    return v


def nonempty_text(r, where, obj, name, basis, sev="warning"):
    v = obj.get(name)
    if isinstance(v, str) and not v.strip():
        r.add(sev, "FIELD-EMPTY", where, "'%s' 가 비어 있습니다" % name, basis)


# ---------------------------------------------------------------- 긴 줄표
def scan_dash(r, node, path="$"):
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(k, str) and C.EM_DASH in k:
                r.err("DASH", path, "칸 이름 %r 에 긴 줄표(U+2014)가 있습니다" % k, R3)
            scan_dash(r, v, "%s.%s" % (path, k))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            scan_dash(r, v, "%s[%d]" % (path, i))
    elif isinstance(node, str) and C.EM_DASH in node:
        i = node.index(C.EM_DASH)
        around = node[max(0, i - 12): i + 13].replace("\n", " ")
        r.err("DASH", path, "긴 줄표(U+2014) %d개: ...%s..." % (node.count(C.EM_DASH), around), R3)


# ---------------------------------------------------------------- 강의 객체
def check_lecture(r, path, lec, foundation_units):
    lid = lec.get("lecture_id")
    where = "%s %s" % (path, lid)
    check_fields(r, where, lec, {**LECTURE_FIELDS, **LECTURE_OPTIONAL}, list(LECTURE_FIELDS), "error", B_LEC)
    if isinstance(lid, str) and not C.LECTURE_RE.match(lid):
        r.err("ID-FORMAT", where, "lecture_id %r 는 L01 ~ L10 이어야 합니다" % lid, B_ID)
    vid = lec.get("youtube_video_id")
    if isinstance(vid, str):
        if not YT_ID_RE.match(vid):
            r.warn("VIDEO-ID", where, "youtube_video_id %r 가 유튜브 영상 id 모양(11자)이 아닙니다" % vid, B_GUESS)
        url = lec.get("video_url")
        if isinstance(url, str):
            if vid not in url:
                r.warn("VIDEO-ID", where, "video_url 에 youtube_video_id 가 들어 있지 않습니다", B_LEC)
            if not url.startswith("https://www.youtube.com/watch?v="):
                r.warn("VIDEO-ID", where, "video_url 이 https://www.youtube.com/watch?v= 로 시작하지 않습니다", B_LEC)
    vs = lec.get("video_seconds")
    vm = lec.get("video_minutes")
    if C.is_int(vs) and vs <= 0:
        r.err("FIELD-TYPE", where, "video_seconds 는 0보다 커야 합니다", B_LEC)
    if C.is_int(vs) and C.is_int(vm) and abs(round(vs / 60) - vm) > 1:
        r.warn("VIDEO-LEN", where, "video_minutes %d 가 video_seconds %d(약 %d분)와 맞지 않습니다" % (vm, vs, round(vs / 60)), B_LEC)
    for repo in check_str_list(r, where, lec, "source_repos", B_LEC):
        if not re.match(r"^[\w.-]+/[\w.-]+$", repo):
            r.warn("FIELD-FORMAT", where, "source_repos 의 %r 가 '소유자/저장소' 모양이 아닙니다" % repo, B_LEC)
    envs = check_str_list(r, where, lec, "env", B_LEC)
    for e in envs:
        if e not in C.ENV_VALUES:
            r.err("FIELD-ENUM", where, "env 값 %r 는 cpu | mps | colab_gpu 중 하나여야 합니다" % e, B_LEC)
    if isinstance(lec.get("env"), list) and not envs:
        r.warn("FIELD-EMPTY", where, "env 가 비어 있습니다", B_LEC)
    rs = lec.get("research_status")
    if isinstance(rs, str) and rs not in C.RESEARCH_STATUS:
        r.err("FIELD-ENUM", where, "research_status %r 는 pending | merged 여야 합니다" % rs, B_LEC)
    for u in check_str_list(r, where, lec, "prereq_units", B_LEC):
        if not C.UNIT_RE.match(u):
            r.err("REF-UNIT", where, "prereq_units 의 %r 는 F-P1~F-P9, F-M1~F-M6 모양이어야 합니다" % u, B_ID)
        elif foundation_units is not None and u not in foundation_units:
            r.err("REF-UNIT", where, "prereq_units 의 %s 가 기초 파일에 없습니다" % u, B_LEC)
    for p in check_str_list(r, where, lec, "prereq_lectures", B_LEC):
        if not C.LECTURE_RE.match(p):
            r.err("ID-FORMAT", where, "prereq_lectures 의 %r 는 L01 ~ L10 이어야 합니다" % p, B_ID)
        elif p == lid:
            r.warn("REF-LECTURE", where, "prereq_lectures 에 자기 편 %s 이 들어 있습니다" % p, B_LEC)
    if isinstance(lec.get("objectives"), list):
        for i, o in enumerate(lec["objectives"]):
            if not isinstance(o, dict):
                r.err("FIELD-TYPE", "%s.objectives[%d]" % (path, i), "objectives 항목은 객체여야 합니다", B_LEC)


def check_objective(r, path, o, owner):
    oid = o.get("objective_id")
    where = "%s %s" % (path, oid)
    check_fields(r, where, o, {"objective_id": str, "text_ko": str}, ["objective_id", "text_ko"], "error", B_LEC)
    nonempty_text(r, where, o, "text_ko", B_LEC, "error")
    if isinstance(oid, str) and owner and not C.objective_re(owner).match(oid):
        r.warn("ID-FORMAT", where, "objective_id %r 가 %s-O{번호} 모양이 아닙니다" % (oid, owner), B_GUESS)


# ---------------------------------------------------------------- 단계
def check_step(r, path, s, owner, is_lec, video_seconds):
    sid = s.get("step_id")
    where = "%s %s" % (path, sid)
    miss = "error" if is_lec else "warning"
    required = [k for k in STEP_BASE if is_lec or k != "lecture_id"]
    extra = () if is_lec else ("unit_id",)
    check_fields(r, where, s, {**STEP_BASE, **STEP_V12}, required, miss, B_STEP, extra_known=extra)

    # ID 와 소속
    if isinstance(sid, str):
        if is_lec:
            if owner and not C.step_id_re(owner).match(sid):
                r.err("ID-FORMAT", where, "step_id %r 는 %s-S{두 자리}(쪼갠 단계는 뒤에 b, c) 모양이어야 합니다" % (sid, owner), B_ID)
        else:
            if owner is None:
                r.warn("ID-OWNER", where, "이 단계가 어느 기초 단위에 속하는지 알 수 없습니다(unit_id 없음)", B_GUESS)
            elif not C.unit_step_re(owner).match(sid):
                r.warn("ID-FORMAT", where, "기초 단계 id %r 가 %s-S{번호} 모양이 아닙니다" % (sid, owner), B_GUESS)
    if is_lec:
        lid = s.get("lecture_id")
        if isinstance(lid, str) and owner and lid != owner:
            r.err("ID-OWNER", where, "lecture_id %r 가 이 파일의 편 %s 과 다릅니다" % (lid, owner), B_STEP)
    if C.is_int(s.get("order")) and s["order"] < 1:
        r.warn("ORDER", where, "order 가 1보다 작습니다", B_GUESS)
    nonempty_text(r, where, s, "title_ko", B_STEP, "error")

    # 영상 구간
    segs = s.get("video_segments")
    if isinstance(segs, list):
        prev_end = None
        for i, g in enumerate(segs):
            gw = "%s video_segments[%d]" % (where, i)
            if not isinstance(g, dict):
                r.err("VIDEO-SEG", gw, "구간은 {start_s, end_s} 객체여야 합니다", B_STEP)
                continue
            st, en = g.get("start_s"), g.get("end_s")
            if not C.is_int(st) or not C.is_int(en):
                r.err("VIDEO-SEG", gw, "start_s, end_s 는 둘 다 정수(초)여야 합니다(null 금지). 지금 %r, %r" % (st, en), R4)
                continue
            if st < 0:
                r.err("VIDEO-SEG", gw, "start_s 가 0보다 작습니다", B_STEP)
            if st >= en:
                r.err("VIDEO-SEG", gw, "start_s(%d) 가 end_s(%d) 보다 작아야 합니다" % (st, en), B_STEP)
            if C.is_int(video_seconds) and en > video_seconds:
                r.err("VIDEO-END", gw, "end_s(%d) 가 영상 길이 video_seconds(%d)를 넘습니다" % (en, video_seconds), R4)
            for k in g:
                if k not in SEGMENT_FIELDS:
                    r.warn("UNKNOWN-FIELD", gw, "'%s' 는 data-spec 에 없는 칸입니다" % k, B_GUESS)
            if prev_end is not None and st < prev_end:
                r.warn("VIDEO-SEG", gw, "앞 구간과 겹치거나 순서가 거꾸로입니다", B_GUESS)
            prev_end = en

    kind = s.get("kind")
    if isinstance(kind, str) and kind not in C.STEP_KINDS:
        r.err("FIELD-ENUM", where, "kind %r 는 code | read | reflect | optional | copy_run 중 하나여야 합니다" % kind, B_STEP)

    # 코드 줄 수와 줄별 풀이
    code = s.get("code")
    lines = C.split_lines(code)
    notes = s.get("code_line_notes_ko")
    if isinstance(notes, list):
        if not all(isinstance(x, str) for x in notes):
            r.err("FIELD-TYPE", where, "code_line_notes_ko 는 글자 목록이어야 합니다", B_STEP)
        if len(notes) != len(lines):
            r.err("LINES-NOTES", where, "code 는 %d줄인데 code_line_notes_ko 는 %d개입니다" % (len(lines), len(notes)), R1)
        for i, n in enumerate(notes):
            if isinstance(n, str) and not n.strip():
                r.warn("FIELD-EMPTY", where, "code_line_notes_ko[%d] 가 비어 있습니다" % i, R1)
    if kind == "code" and not lines:
        r.warn("CODE-EMPTY", where, "kind 가 code 인데 code 가 비어 있습니다", B_GUESS)

    prep = s.get("prepared_code")
    prep_notes = s.get("prepared_code_line_notes_ko")
    prep_lines = C.split_lines(prep)
    if prep_lines:
        if not isinstance(prep_notes, list):
            r.err("LINES-PREP", where, "prepared_code(%d줄)가 있는데 prepared_code_line_notes_ko 가 없습니다" % len(prep_lines), B_V12)
        elif len(prep_notes) != len(prep_lines):
            r.err("LINES-PREP", where, "prepared_code 는 %d줄인데 prepared_code_line_notes_ko 는 %d개입니다" % (len(prep_lines), len(prep_notes)), B_V12)
    elif isinstance(prep_notes, list) and prep_notes:
        r.warn("LINES-PREP", where, "prepared_code 가 없는데 prepared_code_line_notes_ko 가 있습니다", B_V12)

    alt = s.get("code_alt_local")
    alt_lines = C.split_lines(alt)
    alt_notes = s.get("code_alt_local_line_notes_ko")
    if alt_lines:
        if not isinstance(alt_notes, list) or len(alt_notes) != len(alt_lines):
            r.err("LINES-NOTES", where, "code_alt_local 은 %d줄인데 code_alt_local_line_notes_ko 가 %s개입니다"
                  % (len(alt_lines), len(alt_notes) if isinstance(alt_notes, list) else "없음/0"), B_V12)

    # 새 코드 줄 수
    new = s.get("new_code_lines")
    moved = s.get("moved_code_lines", 0)
    edits = s.get("edits") if isinstance(s.get("edits"), list) else []
    repl = sum(e.get("line_count", 0) for e in edits
               if isinstance(e, dict) and e.get("action") == "replace" and C.is_int(e.get("line_count")))
    if not C.is_int(moved):
        moved = 0
    if C.is_int(new) and new < 0:
        r.err("FIELD-TYPE", where, "new_code_lines 는 0 이상이어야 합니다", B_STEP)
    if kind == "copy_run":
        if C.is_int(new) and new != 0:
            r.err("COPYRUN", where, "kind copy_run 은 new_code_lines 가 0 이어야 합니다(지금 %d)" % new, B_V12)
        ccl = s.get("cell_code_lines")
        if ccl is None:
            r.warn("COPYRUN", where, "kind copy_run 인데 cell_code_lines 가 없습니다", B_V12)
        elif C.is_int(ccl) and ccl != len(lines):
            r.err("COPYRUN", where, "cell_code_lines %d 가 code 줄 수 %d 와 다릅니다" % (ccl, len(lines)), B_V12)
    elif C.is_int(new):
        want = new + moved + repl
        nonblank = sum(1 for x in lines if x.strip())
        if len(lines) != want and nonblank != want:
            r.err("LINES-NEW", where,
                  "code 줄 수 %d 가 new_code_lines %d + moved_code_lines %d + replace 줄 %d = %d 와 다릅니다"
                  % (len(lines), new, moved, repl, want), B_V12)
        if new > 10:
            r.err("LINES-LIMIT", where, "new_code_lines %d 가 한도 10줄을 넘습니다. 단계를 쪼개세요" % new, R7)
        else:
            ls = s.get("long_step")
            should = 6 <= new <= 10
            if isinstance(ls, bool) and ls != should:
                r.err("LINES-LONG", where, "new_code_lines %d 이면 long_step 은 %s 여야 합니다(지금 %s)"
                      % (new, str(should).lower(), str(ls).lower()), R7)
        title = s.get("title_ko") if isinstance(s.get("title_ko"), str) else ""
        if s.get("long_step") is True and "(긴 단계)" not in title:
            r.err("LINES-LONG", where, "long_step 이 true 인데 제목에 '(긴 단계)' 가 없습니다", B_STEP)
        if s.get("long_step") is False and "(긴 단계)" in title:
            r.warn("LINES-LONG", where, "long_step 이 false 인데 제목에 '(긴 단계)' 가 있습니다", B_STEP)

    # 확인 방법
    ec = s.get("expected_check")
    if isinstance(ec, dict):
        t = ec.get("type")
        if not isinstance(t, str):
            r.err("FIELD-MISSING", where, "expected_check.type 이 없습니다", B_STEP)
        elif t in C.STEP_CHECK_TYPES:
            pass
        elif t in C.STEP_CHECK_EXTRA:
            r.warn("CHECK-TYPE", where, "expected_check.type %r 는 step 허용값(manual | output_match | value_range) 밖입니다(run_code 는 대조함)" % t, B_STEP)
        else:
            r.err("FIELD-ENUM", where, "expected_check.type %r 는 manual | output_match | value_range 중 하나여야 합니다" % t, B_STEP)
        if t == "output_match" and not any(k in ec for k in C.OUTPUT_FIELDS + ("pattern", "regex")):
            r.warn("CHECK-VALUE", where, "output_match 에 대조할 기준 출력 칸(expected 등)이 없어 run_code 가 대조하지 못합니다", B_GUESS)
        if t in ("value_range", "numeric_range") and not any(k in ec for k in ("min", "max", "low", "high", "range")):
            r.warn("CHECK-VALUE", where, "value_range 에 min/max 가 없어 run_code 가 대조하지 못합니다", B_GUESS)
        m = ec.get("match")
        if m is not None and m not in ("contains", "exact", "regex"):
            r.warn("CHECK-VALUE", where, "expected_check.match %r 는 run_code 가 모르는 값입니다(contains | exact | regex)" % m, B_GUESS)
        for k in ec:
            if k not in CHECK_KNOWN_KEYS:
                r.warn("UNKNOWN-FIELD", where, "expected_check.%s 는 data-spec 과 run_code 가 모르는 칸입니다" % k, B_GUESS)

    # edits 칸 모양
    for i, e in enumerate(edits):
        ew = "%s edits[%d]" % (where, i)
        if not isinstance(e, dict):
            continue
        for k in ("target_step", "action", "line_count"):
            if k not in e:
                r.err("EDITS", ew, "edits 항목에 '%s' 가 없습니다" % k, B_V12)
        if "anchor_line" not in e:
            r.warn("EDITS", ew, "edits 항목에 anchor_line 이 없습니다(null 이면 셀 맨 아래)", B_V12)
        if "where_ko" not in e:
            r.warn("EDITS", ew, "edits 항목에 where_ko(넣을 곳 설명)가 없습니다", B_V12)
        for k in e:
            if k not in EDIT_FIELDS:
                r.warn("UNKNOWN-FIELD", ew, "'%s' 는 data-spec 에 없는 칸입니다" % k, B_GUESS)
    rr = s.get("rerun_first") if isinstance(s.get("rerun_first"), list) else []
    seen_t = []
    for e in edits:
        t = e.get("target_step") if isinstance(e, dict) else None
        if isinstance(t, str) and t not in seen_t:
            seen_t.append(t)
            if t not in rr:
                r.warn("EDITS-RERUN", where,
                       "고친 셀 %s 가 rerun_first 에 없습니다. 다시 실행 순서를 적어 두세요"
                       "(run_code 는 class/def 셀이면 rerun_first 앞에, 아니면 이 단계 실행으로 뒤에 돌림)" % t, B_V12)

    for name in ("objective_ids", "hint_ids", "rerun_first", "question_ids"):
        check_str_list(r, where, s, name, B_STEP)


# ---------------------------------------------------------------- 문제
def check_question(r, path, q, owner, is_lec, is_diag):
    qid = q.get("question_id")
    where = "%s %s" % (path, qid)
    if is_diag:
        required, miss = ["question_id", "type", "prompt_ko", "auto_grade", "max_points"], "error"
    elif is_lec:
        required, miss = ["question_id", "lecture_id", "type", "prompt_ko", "auto_grade", "max_points",
                          "objective_ids", "hint_ids"], "error"
    else:
        required, miss = ["question_id", "type", "prompt_ko", "auto_grade", "max_points"], "error"
    check_fields(r, where, q, QUESTION_FIELDS, required, miss, B_Q)
    if not is_lec and not is_diag:
        for k in ("objective_ids", "hint_ids"):
            if k not in q:
                r.warn("FIELD-MISSING", where, "'%s' 가 없습니다" % k, B_Q)
    if is_diag and "hint_ids" not in q:
        r.warn("FIELD-MISSING", where, "진단 문항에 hint_ids: [] 가 없습니다", B_DIAG)

    alt = q.get("alternate_of")
    if isinstance(qid, str):
        base = qid[:-4] if qid.endswith("-ALT") else qid
        if qid.endswith("-ALT") and not alt:
            r.err("ID-FORMAT", where, "-ALT 로 끝나는 문항인데 alternate_of 가 없습니다", R11)
        if is_diag:
            if not C.DIAG_RE.match(qid):
                r.err("ID-FORMAT", where, "진단 문항 id %r 는 F-D{번호} 모양이어야 합니다" % qid, B_ID)
        elif is_lec:
            if C.DIAG_RE.match(qid):
                r.err("ID-FORMAT", where, "강의 파일에 진단 문항 id %r 가 있습니다" % qid, B_ID)
            elif owner and not C.lecture_question_re(owner).match(base):
                r.err("ID-FORMAT", where, "question_id %r 는 %s-Q{두 자리} 모양이어야 합니다" % (qid, owner), B_ID)
        else:
            if owner is None:
                r.warn("ID-OWNER", where, "이 문제가 어느 기초 단위에 속하는지 알 수 없습니다", B_GUESS)
            elif not C.unit_question_re(owner).match(base):
                r.err("ID-FORMAT", where, "기초 단위 문제 id %r 는 %s-Q{번호} 모양이어야 합니다" % (qid, owner), B_ID)
    if is_lec:
        lid = q.get("lecture_id")
        if isinstance(lid, str) and owner and lid != owner:
            r.err("ID-OWNER", where, "lecture_id %r 가 이 파일의 편 %s 과 다릅니다" % (lid, owner), B_Q)
        if "unit_id" in q:
            r.warn("FIELD-UNEXPECTED", where, "강의 문제에 unit_id 가 있습니다", B_Q)
    if is_diag:
        uid = q.get("unit_id")
        if uid != C.DIAG_UNIT:
            r.warn("DIAG", where, "진단 문항의 unit_id 가 %r 입니다(data-spec 예는 F-DIAG)" % uid, B_DIAG)

    qt = q.get("type")
    if isinstance(qt, str) and qt not in C.QUESTION_TYPES:
        r.err("FIELD-ENUM", where, "type %r 는 predict | explain | fix_bug | apply | choice 중 하나여야 합니다" % qt, B_Q)
    nonempty_text(r, where, q, "prompt_ko", B_Q, "error")

    # 풀이와 채점 기준(4절 2). 진단 문항은 data-spec 예에 없어 경고.
    sev = "warning" if is_diag else "error"
    if "answer_ko" not in q:
        r.add(sev, "ANSWER", where, "answer_ko(풀이)가 없습니다", R2)
    else:
        nonempty_text(r, where, q, "answer_ko", R2, sev)
    rub = q.get("rubric")
    if "rubric" not in q:
        r.add(sev, "RUBRIC", where, "rubric(채점 기준)이 없습니다", R2)
    elif isinstance(rub, list):
        total = 0.0
        ok_shape = True
        for i, it in enumerate(rub):
            if not isinstance(it, dict) or not C.is_num(it.get("point")) or not isinstance(it.get("criterion_ko"), str):
                r.err("RUBRIC", where, "rubric[%d] 는 {point: 숫자, criterion_ko: 글자} 여야 합니다" % i, B_Q)
                ok_shape = False
                continue
            if it["point"] < 0:
                r.err("RUBRIC", where, "rubric[%d].point 가 음수입니다" % i, B_Q)
            total += it["point"]
            for k in it:
                if k not in RUBRIC_FIELDS:
                    r.warn("UNKNOWN-FIELD", where, "rubric[%d].%s 는 data-spec 에 없는 칸입니다" % (i, k), B_GUESS)
        if not rub:
            r.add(sev, "RUBRIC", where, "rubric 이 비어 있습니다", R2)
        mp = q.get("max_points")
        if ok_shape and rub and C.is_num(mp) and abs(total - mp) > 1e-9:
            r.warn("RUBRIC", where, "rubric 점수 합 %g 가 max_points %g 와 다릅니다" % (total, mp), B_GUESS)

    mp = q.get("max_points")
    if C.is_num(mp) and mp <= 0:
        r.err("FIELD-TYPE", where, "max_points 는 0보다 커야 합니다", B_Q)

    # 채점
    ag = q.get("auto_grade")
    if isinstance(ag, dict):
        gt = ag.get("type")
        if gt not in C.GRADE_TYPES:
            r.err("GRADE", where, "auto_grade.type %r 는 exact | numeric_range | keywords | manual | choice 중 하나여야 합니다" % gt, B_Q)
        if qt == "choice" and gt != "choice":
            r.err("GRADE", where, "객관식(choice) 문제는 auto_grade.type 이 choice 여야 합니다(지금 %r)" % gt, B_CHOICE)
        if gt == "choice" and qt != "choice":
            r.err("GRADE", where, "auto_grade.type choice 는 type choice 문제에만 씁니다", B_CHOICE)
        if gt == "exact":
            if "value" not in ag:
                r.err("GRADE", where, "auto_grade exact 에 value 가 없습니다", B_Q)
            elif not isinstance(ag["value"], str):
                r.warn("GRADE", where, "auto_grade.value 는 data-spec 예처럼 글자로 적는 것을 권합니다", B_Q)
        if gt == "numeric_range" and not any(k in ag for k in ("min", "max", "low", "high", "range")):
            r.warn("GRADE", where, "auto_grade numeric_range 에 범위 칸(min, max)이 없습니다", B_GUESS)
        if gt == "keywords" and not isinstance(ag.get("keywords"), list):
            r.warn("GRADE", where, "auto_grade keywords 에 keywords 목록이 없습니다", B_GUESS)

    # 객관식(4절 8)
    ch = q.get("choices")
    ai = q.get("answer_index")
    if qt == "choice":
        if not isinstance(ch, list):
            r.err("CHOICE", where, "객관식인데 choices 가 없습니다", B_CHOICE)
        else:
            if len(ch) < 2:
                r.err("CHOICE", where, "choices 는 2개 이상이어야 합니다(지금 %d개)" % len(ch), B_CHOICE)
            if not all(isinstance(x, str) and x.strip() for x in ch):
                r.err("CHOICE", where, "choices 는 빈칸 없는 글자 목록이어야 합니다", B_CHOICE)
            elif len(set(ch)) != len(ch):
                r.warn("CHOICE", where, "choices 에 같은 보기가 두 번 있습니다", B_GUESS)
        if not C.is_int(ai):
            r.err("CHOICE", where, "객관식인데 answer_index(0부터 세는 정수)가 없습니다", B_CHOICE)
        elif isinstance(ch, list) and not (0 <= ai < len(ch)):
            r.err("CHOICE", where, "answer_index %d 가 보기 범위 0 ~ %d 밖입니다" % (ai, len(ch) - 1), B_CHOICE)
        if is_diag and isinstance(ch, list):
            if C.DONT_KNOW not in ch:
                r.warn("DIAG", where, "진단 객관식 보기에 '모르겠어요' 가 없습니다", B_DIAG)
            elif C.is_int(ai) and 0 <= ai < len(ch) and ch[ai] == C.DONT_KNOW:
                r.err("DIAG", where, "정답(answer_index)이 '모르겠어요' 보기를 가리킵니다", B_DIAG)
    elif ch is not None or ai is not None:
        r.warn("CHOICE", where, "객관식이 아닌데 choices 또는 answer_index 가 있습니다", B_CHOICE)

    if qt == "fix_bug" and not C.split_lines(q.get("code")):
        r.warn("CODE-EMPTY", where, "버그 고치기 문제인데 code 가 비어 있습니다", B_GUESS)

    if is_diag:
        hids = q.get("hint_ids")
        if isinstance(hids, list) and hids:
            r.err("DIAG", where, "진단 문항에는 힌트가 없어야 합니다(hint_ids 가 비어 있지 않음)", B_DIAG)
        if "recommend_units_if_wrong" not in q:
            r.warn("DIAG", where, "진단 문항에 recommend_units_if_wrong 이 없습니다(추천할 단위)", B_DIAG)
    for name in ("objective_ids", "hint_ids", "recommend_units_if_wrong"):
        check_str_list(r, where, q, name, B_Q)


# ---------------------------------------------------------------- 힌트
def check_hint(r, path, h):
    hid = h.get("hint_id")
    where = "%s %s" % (path, hid)
    check_fields(r, where, h, HINT_FIELDS, ["hint_id", "target_id", "level", "text_ko"], "error", B_HINT)
    nonempty_text(r, where, h, "text_ko", B_HINT, "error")
    tgt = h.get("target_id")
    lv = h.get("level")
    if isinstance(hid, str) and isinstance(tgt, str):
        if not re.match(r"^%s-H\d+$" % re.escape(tgt), hid):
            r.err("ID-FORMAT", where, "hint_id %r 는 {target_id}-H{단계} 모양(%s-H1 등)이어야 합니다" % (hid, tgt), "data-spec 2절 step·question·hint 예")
        else:
            m = C.HINT_SUFFIX_RE.search(hid)
            if m and C.is_int(lv) and int(m.group(1)) != lv:
                r.warn("ID-FORMAT", where, "hint_id 끝 번호 H%s 와 level %d 가 다릅니다" % (m.group(1), lv), B_GUESS)
    if "level" in h:
        if not C.is_int(lv):
            r.err("HINT-LEVEL", where, "level 은 정수 1~4 여야 합니다", B_HINT)
        elif lv == 5:
            r.warn("HINT-LEVEL", where, "level 5(HELP)는 data-spec 에 있으나 힌트 사다리는 4단계입니다", B_HINT)
        elif not 1 <= lv <= 4:
            r.err("HINT-LEVEL", where, "level %d 는 1~4 밖입니다" % lv, B_HINT)
    cwb = h.get("code_with_blanks")
    if cwb is not None and C.is_int(lv) and lv != 3:
        r.err("HINT-BLANKS", where, "code_with_blanks 는 level 3 에서만 씁니다(지금 level %d)" % lv, B_HINT)
    if lv == 3 and not cwb:
        r.warn("HINT-BLANKS", where, "level 3 힌트에 code_with_blanks(빈칸 있는 코드)가 없습니다", B_HINT)
    if h.get("show_solution") is True and lv != 4:
        r.warn("HINT-LEVEL", where, "show_solution 은 H4 에서 쓰는 칸인데 level 이 %r 입니다" % lv, B_HINT)
    ul = h.get("unlock")
    if "unlock" not in h:
        r.warn("FIELD-MISSING", where, "unlock 이 없습니다", B_HINT)
    elif isinstance(ul, dict):
        a, m = ul.get("after_attempts"), ul.get("after_minutes")
        if a is not None and not (C.is_int(a) and a >= 0):
            r.err("FIELD-TYPE", where, "unlock.after_attempts 는 0 이상 정수 또는 null 이어야 합니다", B_HINT)
        if m is not None and not (C.is_num(m) and m >= 0):
            r.err("FIELD-TYPE", where, "unlock.after_minutes 는 0 이상 숫자 또는 null 이어야 합니다", B_HINT)
        for k in ul:
            if k not in UNLOCK_FIELDS:
                r.warn("UNKNOWN-FIELD", where, "unlock.%s 는 data-spec 에 없는 칸입니다" % k, B_GUESS)


# ---------------------------------------------------------------- 재구성, 익힘 규칙
def check_rebuild(r, path, b, owner, is_lec):
    bid = b.get("rebuild_id")
    where = "%s %s" % (path, bid)
    check_fields(r, where, b, REBUILD_FIELDS, list(REBUILD_FIELDS) if is_lec else ["rebuild_id", "title_ko", "check"],
                 "error", B_RB)
    if isinstance(bid, str) and owner:
        if not C.rebuild_re(owner).match(bid):
            (r.err if is_lec else r.warn)("ID-FORMAT", where, "rebuild_id %r 는 %s-R{번호} 모양이어야 합니다" % (bid, owner), B_ID)
    if is_lec and isinstance(b.get("lecture_id"), str) and owner and b["lecture_id"] != owner:
        r.err("ID-OWNER", where, "lecture_id %r 가 이 파일의 편 %s 과 다릅니다" % (b["lecture_id"], owner), B_RB)
    chk = b.get("check")
    if isinstance(chk, dict):
        t = chk.get("type")
        if not isinstance(t, str):
            r.err("FIELD-MISSING", where, "check.type 이 없습니다", B_RB)
        elif t not in C.STEP_CHECK_TYPES:
            r.warn("CHECK-TYPE", where, "check.type %r 는 data-spec 예(output_match)와 step 허용값 밖입니다" % t, B_RB)
    mh = b.get("max_hint_level_for_pass")
    if C.is_int(mh) and not 0 <= mh <= 4:
        r.err("FIELD-RANGE", where, "max_hint_level_for_pass %d 는 0~4 여야 합니다" % mh, B_RB)
    nonempty_text(r, where, b, "title_ko", B_RB, "error")


def check_mastery(r, path, m):
    mid = m.get("mastery_rule_id")
    where = "%s %s" % (path, mid)
    check_fields(r, where, m, MASTERY_FIELDS, list(MASTERY_FIELDS), "error", B_MR)
    for k in ("steps_complete_ratio", "question_score_ratio"):
        v = m.get(k)
        if C.is_num(v) and not 0 <= v <= 1:
            r.err("RATIO", where, "%s %g 는 0~1 사이여야 합니다" % (k, v), B_MR)
    v = m.get("rebuild_max_hint_level")
    if C.is_int(v) and not 0 <= v <= 4:
        r.err("FIELD-RANGE", where, "rebuild_max_hint_level %d 는 0~4 여야 합니다" % v, B_MR)
    check_str_list(r, where, m, "extra_checks", B_MR)


# ---------------------------------------------------------------- 전체
def run_checks(data, load_problems, kind_override=None, foundation_units=None):
    r = Report()
    for code, msg in load_problems:
        r.err(code, "$", msg, "JSON 형식")
    if data is None:
        return r, None, None
    kind = kind_override or C.detect_kind(data)
    if kind is None:
        r.err("KIND-UNKNOWN", "$", "강의 파일(lecture.lecture_id 가 L..)인지 기초 파일(units, F-...)인지 알 수 없습니다. --kind 로 정하세요", B_TOP)
        return r, None, None
    is_lec = kind == "lecture"
    scan_dash(r, data)
    objs = C.collect(data)

    lecture_id = None
    video_seconds = None
    if is_lec:
        if not isinstance(data, dict):
            r.err("TOP-TYPE", "$", "최상위는 객체여야 합니다", B_TOP)
            return r, kind, None
        for name, t in TOP_LECTURE:
            if name not in data:
                r.err("TOP-MISSING", "$", "최상위 칸 '%s' 가 없습니다" % name, B_TOP)
            elif not isinstance(data[name], t):
                if name == "mastery_rule" and isinstance(data[name], list):
                    r.warn("TOP-TYPE", "$.mastery_rule", "mastery_rule 이 목록입니다(data-spec 예는 객체 하나)", B_MR)
                else:
                    r.err("TOP-TYPE", "$.%s" % name, "'%s' 는 %s 이어야 합니다" % (name, type_name(t)), B_TOP)
        for k in data:
            if k not in dict(TOP_LECTURE):
                r.warn("UNKNOWN-FIELD", "$", "최상위 칸 '%s' 는 정해진 목록 밖입니다" % k, B_TOP)
        if isinstance(data.get("steps"), list) and not data["steps"]:
            r.err("TOP-EMPTY", "$.steps", "단계가 하나도 없습니다", B_TOP)
        lec = data.get("lecture")
        if isinstance(lec, dict):
            lecture_id = lec.get("lecture_id") if isinstance(lec.get("lecture_id"), str) else None
            video_seconds = lec.get("video_seconds")
            check_lecture(r, "$.lecture", lec, foundation_units)
        expected_loc = {"step": "$.steps[", "question": "$.questions[", "hint": "$.hints[",
                        "rebuild": "$.rebuild_tasks[", "objective": "$.lecture.objectives[", "mastery_rule": "$.mastery_rule"}
        for kname, prefix in expected_loc.items():
            for path, obj, _ in objs[kname]:
                if not path.startswith(prefix):
                    r.warn("LOCATION", path, "%s 객체가 예상 밖 위치에 있습니다(기대: %s...)" % (kname, prefix.rstrip("[")), B_TOP)
    else:
        if isinstance(data, dict) and "_meta" not in data:
            r.warn("TOP-MISSING", "$", "최상위 칸 '_meta' 가 없습니다", B_GUESS)

    # 단위 (기초 파일)
    unit_ids = set()
    if not is_lec:
        real_units = [(p, o, u) for p, o, u in objs["unit"] if o.get("unit_id") != C.DIAG_UNIT]
        if not real_units:
            r.err("UNIT", "$", "기초 단위(unit_id 가 F-P#, F-M# 인 객체)가 하나도 없습니다", B_ID)
        orders = {}
        for p, o, _ in real_units:
            uid = o.get("unit_id")
            where = "%s %s" % (p, uid)
            if not isinstance(uid, str) or not C.UNIT_RE.match(uid):
                r.err("ID-FORMAT", where, "unit_id %r 는 F-P1~F-P9, F-M1~F-M6 이어야 합니다" % (uid,), B_ID)
            if isinstance(uid, str):
                unit_ids.add(uid)
            if "title_ko" not in o:
                r.warn("FIELD-MISSING", where, "단위에 title_ko 가 없습니다", B_GUESS)
            od = o.get("order")
            if C.is_int(od):
                orders.setdefault(od, []).append(uid)
        for od, ids in orders.items():
            if len(ids) > 1:
                r.err("ORDER-DUP", "$", "단위 order %d 가 겹칩니다: %s" % (od, ", ".join(map(str, ids))), "order 중복")

    # 목표
    objective_ids = {}
    for p, o, u in objs["objective"]:
        oid = o.get("objective_id")
        owner = lecture_id if is_lec else u
        check_objective(r, p, o, owner)
        if isinstance(oid, str):
            objective_ids.setdefault(oid, p)

    # 단계
    steps_by_id = {}
    step_owner = {}
    for p, s, u in objs["step"]:
        owner = C.owner_of(s, u, kind, lecture_id)
        if not is_lec and isinstance(s.get("unit_id"), str) and u and s["unit_id"] != u:
            r.err("ID-OWNER", "%s %s" % (p, s.get("step_id")), "unit_id %r 가 감싼 단위 %s 와 다릅니다" % (s["unit_id"], u), B_ID)
        check_step(r, p, s, owner, is_lec, video_seconds if is_lec else None)
        sid = s.get("step_id")
        if isinstance(sid, str):
            steps_by_id.setdefault(sid, (p, s))
            step_owner.setdefault(sid, owner)

    # 문제
    q_by_id = {}
    q_owner = {}
    diag = []
    for p, q, u in objs["question"]:
        qid = q.get("question_id")
        is_diag = (not is_lec) and isinstance(qid, str) and (qid.startswith("F-D") or q.get("unit_id") == C.DIAG_UNIT or u == C.DIAG_UNIT)
        owner = C.DIAG_UNIT if is_diag else C.owner_of(q, u if u != C.DIAG_UNIT else None, kind, lecture_id)
        if not is_lec and not is_diag and isinstance(q.get("unit_id"), str) and u and q["unit_id"] != u:
            r.err("ID-OWNER", "%s %s" % (p, qid), "unit_id %r 가 감싼 단위 %s 와 다릅니다" % (q["unit_id"], u), B_ID)
        check_question(r, p, q, owner, is_lec, is_diag)
        if isinstance(qid, str):
            q_by_id.setdefault(qid, (p, q))
            q_owner.setdefault(qid, owner)
        if is_diag:
            diag.append((p, q))

    # 힌트
    hints_by_id = {}
    for p, h, _ in objs["hint"]:
        check_hint(r, p, h)
        hid = h.get("hint_id")
        if isinstance(hid, str):
            hints_by_id.setdefault(hid, (p, h))

    # 재구성
    rb_by_id = {}
    for p, b, u in objs["rebuild"]:
        owner = lecture_id if is_lec else u
        check_rebuild(r, p, b, owner, is_lec)
        if isinstance(b.get("rebuild_id"), str):
            rb_by_id.setdefault(b["rebuild_id"], (p, b))

    # 익힘 규칙
    mastery_ids = set()
    for p, m, _ in objs["mastery_rule"]:
        check_mastery(r, p, m)
        if isinstance(m.get("mastery_rule_id"), str):
            mastery_ids.add(m["mastery_rule_id"])
    if is_lec and isinstance(data.get("lecture"), dict):
        mrid = data["lecture"].get("mastery_rule_id")
        if isinstance(mrid, str) and mrid not in mastery_ids:
            r.err("REF-MASTERY", "$.lecture", "mastery_rule_id %r 에 맞는 mastery_rule 이 없습니다(있는 것: %s)"
                  % (mrid, ", ".join(sorted(mastery_ids)) or "없음"), B_LEC)

    # 중복 ID
    seen = {}
    groups = [("step", [(p, o.get("step_id")) for p, o, _ in objs["step"]]),
              ("question", [(p, o.get("question_id")) for p, o, _ in objs["question"]]),
              ("hint", [(p, o.get("hint_id")) for p, o, _ in objs["hint"]]),
              ("rebuild", [(p, o.get("rebuild_id")) for p, o, _ in objs["rebuild"]]),
              ("objective", [(p, o.get("objective_id")) for p, o, _ in objs["objective"]]),
              ("unit", [(p, o.get("unit_id")) for p, o, _ in objs["unit"] if o.get("unit_id") != C.DIAG_UNIT])]
    for kname, items in groups:
        for p, i in items:
            if not isinstance(i, str):
                continue
            if i in seen:
                r.err("ID-DUP", p, "id %s 가 겹칩니다(먼저 나온 곳: %s)" % (i, seen[i]), B_ID)
            else:
                seen[i] = p

    # order 중복과 순서 (강의: 편 전체, 기초: 단위별)
    by_owner = {}
    for p, s, u in objs["step"]:
        by_owner.setdefault(C.owner_of(s, u, kind, lecture_id), []).append((p, s))
    for owner, items in by_owner.items():
        orders = {}
        for p, s in items:
            o = s.get("order")
            if C.is_int(o):
                orders.setdefault(o, []).append(s.get("step_id"))
        for o, ids in orders.items():
            if len(ids) > 1:
                r.err("ORDER-DUP", "%s" % owner, "order %d 가 겹칩니다: %s" % (o, ", ".join(map(str, ids))), "order 중복")
        int_orders = [s.get("order") for _, s in items if C.is_int(s.get("order"))]
        if int_orders != sorted(int_orders):
            r.warn("ORDER", str(owner), "steps 목록이 order 순서대로 놓여 있지 않습니다", B_GUESS)
        ordered = C.sort_steps(items)
        nums = []
        for _, s in ordered:
            sid_txt = s.get("step_id") if isinstance(s.get("step_id"), str) else ""
            m = re.search(r"-S(\d{2})([b-z]?)$", sid_txt)
            if m:
                nums.append((int(m.group(1)), m.group(2)))
        if nums != sorted(nums):
            r.warn("ORDER", str(owner), "order 순서로 놓으면 step_id 번호가 오름차순이 아닙니다", B_GUESS)
        # edits 흉내
        plans, probs, _ = C.simulate_cells(ordered)
        for sev, code, sid, msg in probs:
            if "찾을 수 없습니다" in msg:
                continue  # REF-STEP 이 따로 잡는다
            r.add(sev, code, "%s %s" % (steps_by_id.get(sid, ("?",))[0], sid), msg, B_V12)

    # 참조 무결성
    target_ids = set(steps_by_id) | set(q_by_id) | set(rb_by_id)
    used_obj = set()
    owners_of_hints = {}
    for kname, table, owners in (("step", steps_by_id, step_owner), ("question", q_by_id, q_owner)):
        for oid, (p, o) in table.items():
            where = "%s %s" % (p, oid)
            for ob in o.get("objective_ids") or []:
                if not isinstance(ob, str):
                    continue
                used_obj.add(ob)
                if ob not in objective_ids:
                    r.err("REF-OBJ", where, "objective_ids 의 %s 가 정의된 목표에 없습니다" % ob, B_STEP if kname == "step" else B_Q)
            for hid in o.get("hint_ids") or []:
                if not isinstance(hid, str):
                    continue
                owners_of_hints.setdefault(hid, set()).add(oid)
                if hid not in hints_by_id:
                    r.err("REF-HINT", where, "hint_ids 의 %s 힌트가 없습니다" % hid, B_HINT)
                else:
                    tgt = hints_by_id[hid][1].get("target_id")
                    if tgt != oid:
                        r.err("REF-HINT", where, "hint_ids 의 %s 는 target_id 가 %r 입니다(이 %s 가 아님)" % (hid, tgt, oid), B_HINT)
    for oid, p in objective_ids.items():
        if oid not in used_obj:
            r.warn("REF-OBJ", p, "목표 %s 를 쓰는 단계나 문제가 없습니다" % oid, B_GUESS)

    diag_ids = {q.get("question_id") for _, q in diag}
    for hid, (p, h) in hints_by_id.items():
        tgt = h.get("target_id")
        where = "%s %s" % (p, hid)
        if isinstance(tgt, str):
            if tgt not in target_ids:
                r.err("HINT-TARGET", where, "target_id %s 인 단계, 문제, 재구성 과제가 없습니다" % tgt, B_HINT)
            elif tgt in diag_ids:
                r.err("DIAG", where, "진단 문항 %s 에 힌트가 붙어 있습니다. 진단 문항에는 힌트가 없습니다" % tgt, B_DIAG)
            elif tgt not in rb_by_id and hid not in owners_of_hints:
                r.warn("REF-HINT", where, "%s 의 hint_ids 에 이 힌트가 없습니다" % tgt, B_HINT)
    levels = {}
    for hid, (p, h) in hints_by_id.items():
        if C.is_int(h.get("level")) and isinstance(h.get("target_id"), str):
            levels.setdefault((h["target_id"], h["level"]), []).append(hid)
    for (tgt, lv), ids in levels.items():
        if len(ids) > 1:
            r.warn("HINT-LEVEL", tgt, "같은 대상 %s 에 level %d 힌트가 여러 개입니다: %s" % (tgt, lv, ", ".join(ids)), B_GUESS)

    # 4절 9: rerun_first, edits[].target_step, question_ids, after_step
    for sid, (p, s) in steps_by_id.items():
        where = "%s %s" % (p, sid)
        own = step_owner.get(sid)
        my_order = s.get("order")
        refs = [("rerun_first", x) for x in (s.get("rerun_first") or []) if isinstance(x, str)]
        refs += [("edits.target_step", e.get("target_step")) for e in (s.get("edits") or [])
                 if isinstance(e, dict) and isinstance(e.get("target_step"), str)]
        for name, ref in refs:
            if ref not in steps_by_id:
                r.err("REF-STEP", where, "%s 의 %s 단계가 없습니다" % (name, ref), R9)
            elif step_owner.get(ref) != own:
                (r.err if is_lec else r.warn)("REF-STEP", where, "%s 의 %s 가 같은 편/단위에 있지 않습니다" % (name, ref), R9)
            else:
                ro = steps_by_id[ref][1].get("order")
                if C.is_int(ro) and C.is_int(my_order) and ro >= my_order:
                    r.warn("REF-STEP", where, "%s 의 %s 가 이 단계보다 뒤(order %d)에 있습니다" % (name, ref, ro), R9)
        for ref in s.get("question_ids") or []:
            if isinstance(ref, str) and ref not in q_by_id:
                r.err("REF-QUESTION", where, "question_ids 의 %s 문제가 없습니다" % ref, R9)
    for qid, (p, q) in q_by_id.items():
        where = "%s %s" % (p, qid)
        a = q.get("after_step")
        if isinstance(a, str):
            if a not in steps_by_id:
                r.err("REF-STEP", where, "after_step 의 %s 단계가 없습니다" % a, R9)
            elif step_owner.get(a) != q_owner.get(qid):
                (r.err if is_lec else r.warn)("REF-STEP", where, "after_step 의 %s 가 같은 편/단위에 있지 않습니다" % a, R9)

    # 4절 11: alternate_of
    alts = {}
    for qid, (p, q) in q_by_id.items():
        orig = q.get("alternate_of")
        if not isinstance(orig, str):
            continue
        where = "%s %s" % (p, qid)
        alts.setdefault(orig, []).append(qid)
        if orig not in q_by_id:
            r.err("ALT", where, "alternate_of 의 원 문항 %s 가 없습니다" % orig, R11)
            continue
        oq = q_by_id[orig][1]
        if oq.get("alternate_of"):
            r.err("ALT", where, "원 문항 %s 도 대체 문항입니다(원 문항은 alternate_of 가 null)" % orig, R11)
        if q.get("type") != oq.get("type"):
            r.err("ALT", where, "대체 문항 type %r 가 원 문항 %s 의 type %r 와 다릅니다" % (q.get("type"), orig, oq.get("type")), R11)
        if q.get("max_points") != oq.get("max_points"):
            r.err("ALT", where, "대체 문항 max_points %r 가 원 문항 %s 의 %r 와 다릅니다" % (q.get("max_points"), orig, oq.get("max_points")), R11)
        if qid != orig + "-ALT":
            r.warn("ALT", where, "대체 문항 id 는 data-spec 예처럼 %s-ALT 모양을 권합니다" % orig, R11)
    for orig, ids in alts.items():
        if len(ids) > 1:
            r.err("ALT", orig, "원 문항 %s 의 대체 문항이 %d개입니다(정확히 하나): %s" % (orig, len(ids), ", ".join(ids)), R11)

    # 단위 참조 (기초)
    if not is_lec:
        for qid, (p, q) in q_by_id.items():
            where = "%s %s" % (p, qid)
            uid = q.get("unit_id")
            if isinstance(uid, str) and uid != C.DIAG_UNIT and uid not in unit_ids:
                r.err("REF-UNIT", where, "unit_id %s 단위가 이 파일에 없습니다" % uid, B_ID)
            for ru in q.get("recommend_units_if_wrong") or []:
                if not isinstance(ru, str):
                    continue
                if not C.UNIT_RE.match(ru):
                    r.err("REF-UNIT", where, "recommend_units_if_wrong 의 %r 는 F-P#, F-M# 모양이어야 합니다" % ru, B_ID)
                elif ru not in unit_ids:
                    r.err("REF-UNIT", where, "recommend_units_if_wrong 의 %s 단위가 이 파일에 없습니다" % ru, B_DIAG)
        for sid, (p, s) in steps_by_id.items():
            uid = s.get("unit_id")
            if isinstance(uid, str) and uid not in unit_ids:
                r.err("REF-UNIT", "%s %s" % (p, sid), "unit_id %s 단위가 이 파일에 없습니다" % uid, B_ID)
        # 진단 5문항
        want = ["F-D%d" % i for i in range(1, 6)]
        got = sorted({q.get("question_id") for _, q in diag if isinstance(q.get("question_id"), str)})
        if got != want:
            r.err("DIAG", "$", "진단 문항은 F-D1 ~ F-D5 다섯 개여야 합니다(지금 %d개: %s)" % (len(got), ", ".join(got) or "없음"), B_DIAG)
        layout = {"F-D1": "choice", "F-D2": "choice", "F-D3": "predict", "F-D4": "choice", "F-D5": "choice"}
        for _, q in diag:
            qid = q.get("question_id")
            if qid in layout and q.get("type") != layout[qid]:
                r.warn("DIAG", qid, "data-spec 의 진단 구조는 %s 가 %s 입니다(지금 %r)" % (qid, layout[qid], q.get("type")), B_DIAG)
        q3 = q_by_id.get("F-D3")
        if q3 and isinstance(q3[1].get("auto_grade"), dict) and q3[1]["auto_grade"].get("type") != "exact":
            r.warn("DIAG", "F-D3", "data-spec 의 진단 구조는 F-D3 이 단답(auto_grade exact)입니다", B_DIAG)
    return r, kind, lecture_id


def load_foundation_units(path):
    data, probs = C.load_json(path)
    if data is None:
        return None, probs
    units = {o.get("unit_id") for _, o, _ in C.collect(data)["unit"] if isinstance(o.get("unit_id"), str)}
    return units, probs


def print_human(path, r, kind, lecture_id, quiet):
    ne, nw = r.count("error"), r.count("warning")
    label = {"lecture": "강의 편(%s)" % lecture_id, "foundation": "사전 기초"}.get(kind, "알 수 없음")
    print("검사 파일: %s" % path)
    print("파일 종류: %s" % label)
    print("오류 %d개, 경고 %d개" % (ne, nw))
    for sev, title in (("error", "오류"), ("warning", "경고")):
        items = [f for f in r.findings if f["severity"] == sev]
        if not items or (sev == "warning" and quiet):
            continue
        print()
        print("%s 목록" % title)
        for f in items:
            print("  [%s] %s: %s (근거: %s)" % (f["code"], f["where"], f["message"], f["basis"]))


def main(argv=None):
    ap = argparse.ArgumentParser(description="콘텐츠 JSON 형식 검사(data-spec 기준)")
    ap.add_argument("path", help="검사할 JSON 파일")
    ap.add_argument("--kind", choices=["lecture", "foundation"], help="파일 종류를 직접 정함(기본: 자동 판별)")
    ap.add_argument("--foundation", help="기초 파일 경로. 강의의 prereq_units 가 그 파일에 있는지 확인")
    ap.add_argument("--json", action="store_true", help="결과를 JSON 으로 출력")
    ap.add_argument("--strict", action="store_true", help="경고도 실패로 봄")
    ap.add_argument("--quiet", action="store_true", help="경고 목록은 숨기고 개수만")
    a = ap.parse_args(argv)
    if not os.path.isfile(a.path):
        print("파일이 없습니다: %s" % a.path, file=sys.stderr)
        return 2
    funits = None
    extra = []
    if a.foundation:
        if not os.path.isfile(a.foundation):
            print("기초 파일이 없습니다: %s" % a.foundation, file=sys.stderr)
            return 2
        funits, fprobs = load_foundation_units(a.foundation)
        if funits is None:
            extra.append(("warning", "FOUNDATION", "--foundation 파일을 읽지 못해 prereq_units 교차 확인을 건너뜁니다"))
    data, probs = C.load_json(a.path)
    try:
        r, kind, lid = run_checks(data, probs, a.kind, funits)
    except Exception:  # noqa: BLE001 - 도구 자체 버그는 콘텐츠 오류와 구분해 종료 3
        import traceback
        print("검사 도구 내부 오류입니다(콘텐츠 탓이 아닐 수 있음). 도구 담당에게 아래를 전달하세요.", file=sys.stderr)
        traceback.print_exc()
        return 3
    for sev, code, msg in extra:
        r.add(sev, code, "--foundation", msg, B_LEC)
    ne, nw = r.count("error"), r.count("warning")
    failed = ne > 0 or (a.strict and nw > 0)
    if a.json:
        print(json.dumps({"file": a.path, "kind": kind, "lecture_id": lid, "errors": ne, "warnings": nw,
                          "passed": not failed, "findings": r.findings}, ensure_ascii=False, indent=2))
    else:
        print_human(a.path, r, kind, lid, a.quiet)
        print()
        print("결과: %s" % ("실패" if failed else "통과"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
