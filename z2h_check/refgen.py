"""정본(inputs/pedagogy/content/L01.json)에서 1편 채점 기준값 파일 z2h_check/reference/l01.json 을 만든다.

    python -m z2h_check.refgen            # 만든 내용을 화면에 출력
    python -m z2h_check.refgen --write    # z2h_check/reference/l01.json 저장
    python -m z2h_check.refgen --check    # 지금 파일이 정본에서 만든 것과 같은지(다르면 종료 코드 1)

저장소에서만 쓰는 도구다(노트북 준비 셀 묶음에는 넣지 않는다). 기준값 파일을 손으로 고치지 않는다.
- 채점 칸: 정본 단계 중 kind == "code" 인 것(정본 순서) + 재구성 조각(rebuild_tasks 순서).
- 단계 칸 기준: 정본 expected_check 그대로(확인 식이 있으면 그 식이 읽는 이름 reads 도). 숫자 허용 오차는 정본 _meta.code_conventions 의 "허용오차" 값.
- 재구성 칸 기준: 정본 check_code(확인 셀)와 통과 기준 pass_ko. pass_ko 가 "끝이 `X`이면 통과" 이면 끝 글자만 보고,
  아니면 check.expected 출력 전체를 본다. reads 는 확인 셀이 읽는 이름, needs 는 정답 코드가 읽는 이름(둘 다 코드에서 셈).
고친 뒤에는 python -m z2h_check.bundle --write, 노트북 build_notebooks.py 를 차례로 다시 실행한다.
"""
import argparse
import builtins
import json
import os
import re
import symtable
import sys
import textwrap

PKG_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(PKG_DIR)
CANON_REL = "inputs/pedagogy/content/L01.json"
CANON_FILE = os.path.join(ROOT, *CANON_REL.split("/"))
OUT_FILE = os.path.join(PKG_DIR, "reference", "l01.json")
STEP_CHECK_TYPES = ("output_match", "value_range", "manual")


class CanonError(Exception):
    """정본을 기준값으로 옮길 수 없을 때(정본 모양이 바뀐 경우). 고치지 말고 보고한다."""


def load_canon(path=CANON_FILE):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def tolerance(canon):
    text = " ".join(canon["_meta"].get("code_conventions") or [])
    found = set(re.findall(r"허용오차 ([0-9.eE-]+)", text))
    if len(found) != 1:
        raise CanonError(f"정본 code_conventions 에서 허용오차 값을 하나로 찾지 못했습니다: {sorted(found)}")
    return float(found.pop())


def pass_rule(task):
    chk = task["check"]
    if chk.get("type") != "output_match":
        raise CanonError(f"{task['rebuild_id']}: 재구성 check.type {chk.get('type')!r} 은 아직 채점하지 않습니다")
    m = re.search(r"끝이 `([^`]+)`이면 통과", task["pass_ko"])
    if m:
        if chk["expected"].split()[-1] != m.group(1):
            raise CanonError(f"{task['rebuild_id']}: pass_ko 의 끝 글자와 check.expected 의 끝이 다릅니다")
        return {"rule": "ends_with", "text": m.group(1)}
    return {"rule": "output_match", "expected": chk["expected"]}


def free_names(code):
    """코드가 읽기만 하는 이름(코드 안에서 만들지 않는 이름, 파이썬 기본 이름 제외)."""
    top = symtable.symtable(textwrap.dedent(code), "<정본 코드>", "exec")
    made = {s.get_name() for s in top.get_symbols() if s.is_assigned() or s.is_imported()}
    read = set()

    def walk(table):
        for sym in table.get_symbols():
            if sym.is_referenced() and (sym.is_global() if table is not top else not sym.is_assigned()):
                read.add(sym.get_name())
        for child in table.get_children():
            walk(child)

    walk(top)
    return sorted(name for name in read - made if not hasattr(builtins, name))


def _sources(canon):
    rows = [f"{s['repo']} ({s['license']}): {s['used']}" for s in canon["_meta"].get("sources_and_licenses") or []]
    return ("정본 _meta.sources_and_licenses. 확인 식과 재구성 확인 셀의 강의 예제 숫자와 코드 동작 기준: "
            + " / ".join(rows) + ". LICENSE 전문은 third_party/licenses/, 표는 NOTICE.md.")


def build(canon):
    steps = []
    for st in sorted(canon["steps"], key=lambda s: s["order"]):
        if st["kind"] != "code":
            continue
        exp = st["expected_check"]
        if exp.get("type") not in STEP_CHECK_TYPES:
            raise CanonError(f"{st['step_id']}: expected_check.type {exp.get('type')!r} 을 모릅니다")
        spec = {"step_id": st["step_id"], "title_ko": st["title_ko"], "expected_check": exp}
        if exp.get("expr"):
            spec["reads"] = free_names(exp["expr"])
        steps.append(spec)
    rebuild = []
    for task in canon["rebuild_tasks"]:
        rebuild.append({
            "rebuild_id": task["rebuild_id"],
            "title_ko": task["title_ko"],
            "check_code": task["check_code"],
            "pass": pass_rule(task),
            "reads": free_names(task["check_code"]),
            "needs": free_names(task["solution_code"]),
            "max_hint_level_for_pass": task["max_hint_level_for_pass"],
        })
    return {
        "lecture_id": canon["lecture"]["lecture_id"],
        "version": 2,
        "_설명": ("1편 채점 기준값. 자동 생성 파일이라 손으로 고치지 않는다: python -m z2h_check.refgen --write "
                f"(정본 {CANON_REL}). steps 는 정본의 코드 단계와 expected_check, rebuild 는 재구성 확인 셀과 통과 기준."),
        "_출처": _sources(canon),
        "canon": {"file": CANON_REL, "version": canon["_meta"].get("version")},
        "tolerance": {"number": tolerance(canon),
                      "_설명": "정본 _meta.code_conventions: output_match 는 contains, 소수는 이 허용오차까지 같으면 맞음"},
        "steps": steps,
        "rebuild": rebuild,
        "mastery_rule": canon["mastery_rule"],
    }


def render(ref):
    return json.dumps(ref, ensure_ascii=False, indent=2) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m z2h_check.refgen", description="정본에서 1편 기준값 파일을 만든다.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--write", action="store_true", help="z2h_check/reference/l01.json 저장")
    group.add_argument("--check", action="store_true", help="지금 파일이 최신인지 확인")
    args = parser.parse_args(argv)
    try:
        text = render(build(load_canon()))
    except CanonError as exc:
        print(f"만들지 못했습니다: {exc}")
        return 2
    if args.write:
        with open(OUT_FILE, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        print("저장했습니다: z2h_check/reference/l01.json")
        return 0
    if args.check:
        try:
            with open(OUT_FILE, encoding="utf-8") as fh:
                current = fh.read()
        except OSError:
            current = None
        if current != text:
            print("z2h_check/reference/l01.json 이 정본과 다릅니다. python -m z2h_check.refgen --write 로 다시 만드세요.")
            return 1
        print("z2h_check/reference/l01.json 이 최신입니다.")
        return 0
    sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
