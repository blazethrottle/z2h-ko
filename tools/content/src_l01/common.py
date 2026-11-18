"""L01 조각 파일이 함께 쓰는 도우미. 조각은 S(...) 로 단계를, Q(...) 로 문제를 적는다.

코드 줄과 풀이를 (줄, 풀이) 쌍으로 적어서 줄 수와 풀이 수가 늘 같게 한다.
"""

LID = "L01"

# research/01_micrograd.md 2절 챕터 시각(초). 끝은 다음 챕터 시작, 마지막은 영상 길이 8752.
CH = {
    1: (0, 25), 2: (25, 488), 3: (488, 852), 4: (852, 1149), 5: (1149, 1930),
    6: (1930, 3070), 7: (3070, 3172), 8: (3172, 4142), 9: (4142, 4652), 10: (4652, 4948),
    11: (4948, 5225), 12: (5225, 5971), 13: (5971, 6235), 14: (6235, 6664), 15: (6664, 7076),
    16: (7076, 7272), 17: (7272, 8043), 18: (8043, 8206), 19: (8206, 8470), 20: (8470, 8679),
    21: (8679, 8720), 22: (8720, 8752),
}

# 힌트가 열리는 때(설계서 3-2)
UNLOCK = {
    1: {"after_attempts": 0, "after_minutes": None},
    2: {"after_attempts": 1, "after_minutes": None},
    3: {"after_attempts": 2, "after_minutes": 5},
    4: {"after_attempts": 3, "after_minutes": 10},
}


def sid(n, suffix=""):
    return "%s-S%02d%s" % (LID, n, suffix)


def qid(n):
    return "%s-Q%02d" % (LID, n)


def segs(*chapters):
    return [{"start_s": CH[c][0], "end_s": CH[c][1]} for c in chapters]


def ins(target, where, anchor, n):
    """target 셀의 anchor 줄 바로 아래에 n줄 넣기(anchor None 이면 셀 맨 아래)."""
    return {"target_step": sid(target), "where_ko": where, "action": "insert", "anchor_line": anchor, "line_count": n}


def rep(target, where, anchor, n=1):
    """target 셀의 anchor 줄(자체)부터 n줄을 같은 수의 새 줄로 바꾸기."""
    return {"target_step": sid(target), "where_ko": where, "action": "replace", "anchor_line": anchor, "line_count": n}


def S(n, title, segments, kind, input_ko, code=(), expected="", check=None, meaning="", obj=(),
      edits=(), rerun=(), prepared=None, prepared_source=None, moved=0, hints=(), verify=None):
    """단계 하나. hints 는 (H1 글, H2 글, (H3 글, 빈칸), H4 글) 처럼 차례로. 빈칸은 code 안 글자 목록 또는 완성 문자열."""
    return {
        "n": n, "title": title, "segments": segments, "kind": kind, "input_ko": input_ko,
        "code": list(code), "expected": expected, "check": check or {"type": "manual"},
        "meaning": meaning, "obj": list(obj), "edits": list(edits), "rerun": [sid(x) for x in rerun],
        "prepared": prepared, "prepared_source": prepared_source, "moved": moved,
        "hints": list(hints), "verify": verify,
    }


def Q(n, qtype, after, prompt, answer, grade, rubric, obj, hints, code=None, choices=None, answer_index=None,
      must_pass=False, verify=None):
    return {
        "n": n, "type": qtype, "after": sid(after) if isinstance(after, int) else after, "prompt": prompt,
        "answer": answer, "grade": grade, "rubric": rubric, "obj": list(obj), "hints": list(hints),
        "code": code, "choices": choices, "answer_index": answer_index, "must_pass": must_pass, "verify": verify,
    }


def vr(lo, hi, expr=None):
    d = {"type": "value_range", "min": lo, "max": hi}
    if expr:
        d["expr"] = expr
    return d


def om(text, match=None):
    d = {"type": "output_match", "expected": text}
    if match:
        d["match"] = match
    return d
