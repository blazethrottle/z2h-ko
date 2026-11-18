"""정본 JSON(inputs/pedagogy/content/)을 조각에서 다시 만든다. 정본은 손으로 고치지 않는다(조각을 고쳐 다시 만든다).

    .venv/bin/python tools/content/build_canon.py              # 모든 정본 다시 만들기(내용이 같으면 파일을 건드리지 않음)
    .venv/bin/python tools/content/build_canon.py --check      # 정본이 조각과 같은지 확인만(다르거나 없으면 종료 코드 1, 파일을 쓰지 않음)
    .venv/bin/python tools/content/build_canon.py L01          # 정본 하나만(이름: F, L01)
    .venv/bin/python tools/content/build_canon.py --out-dir D  # 정본 폴더 대신 폴더 D 의 같은 파일 이름에 쓰거나(--check 면) 비교

흐름: 조각 폴더 src_<이름>/ → 합치기 build_<이름>.build() → 글자로 serialize() → 후처리 POSTPROCESS(지금은 없음) → 정본 파일.
종료 코드: 0 통과(또는 다 씀), 1 --check 에서 다르거나 없는 정본이 있음, 2 인자 잘못 또는 조각 형식 오류,
3 조각 코드가 에러로 멈춤(NameError 등).
"""
import argparse
import importlib
import os
import sys
import traceback
from typing import Callable, NamedTuple, Optional

from fragments import BuildError

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))


class Canon(NamedTuple):
    name: str
    builder: str  # 이 폴더의 합치기 모듈 이름. build() -> dict, serialize(dict) -> str 이 있어야 한다
    output: str   # 저장소 기준 정본 경로


CANONS = {c.name: c for c in (
    Canon("F", "build_f", "inputs/pedagogy/content/F.json"),
    Canon("L01", "build_l01", "inputs/pedagogy/content/L01.json"),
)}

# 생성 뒤 차례로 적용할 후처리: 함수(정본 이름, 글) -> 글. 해당하지 않는 정본이면 글을 그대로 돌려준다.
# 지금은 없다. 정본을 조각 밖에서 고치는 표(예: P9 의 정본 문구 치환 표)가 생기면 여기에 넣는다(README '후처리 자리').
POSTPROCESS: tuple[Callable[[str, str], str], ...] = ()


def render(canon: Canon, postprocess: Optional[tuple[Callable[[str, str], str], ...]] = None) -> str:
    """정본 하나의 파일 글자. 조각 형식 오류면 BuildError."""
    module = importlib.import_module(canon.builder)
    text = module.serialize(module.build())
    for step in POSTPROCESS if postprocess is None else postprocess:
        text = step(canon.name, text)
    return text


def output_path(canon: Canon, out_dir: Optional[str]) -> str:
    if out_dir:
        return os.path.join(os.path.abspath(out_dir), os.path.basename(canon.output))
    return os.path.join(ROOT, *canon.output.split("/"))


def shown(path: str) -> str:
    rel = os.path.relpath(path, ROOT)
    return path if rel.startswith("..") else rel


def first_diff_line(made: str, current: str) -> int:
    n = next((i for i, (x, y) in enumerate(zip(made, current)) if x != y), min(len(made), len(current)))
    return made.count("\n", 0, n) + 1


def read_bytes(path: str) -> Optional[bytes]:
    try:
        with open(path, "rb") as fh:
            return fh.read()
    except FileNotFoundError:
        return None


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="정본 JSON 을 조각에서 다시 만든다(정본을 손으로 고치지 않는다)")
    ap.add_argument("names", nargs="*", metavar="정본", help="만들 정본 이름(%s). 없으면 전부" % ", ".join(CANONS))
    ap.add_argument("--check", action="store_true", help="쓰지 않고 지금 정본이 조각과 같은지만 확인")
    ap.add_argument("--out-dir", help="정본 폴더 대신 이 폴더의 같은 파일 이름에 쓰거나 비교")
    a = ap.parse_args(argv)
    unknown = [n for n in a.names if n not in CANONS]
    if unknown:
        ap.error("모르는 정본 이름: %s (있는 것: %s)" % (", ".join(unknown), ", ".join(CANONS)))
    stale = 0
    for canon in [CANONS[n] for n in (a.names or CANONS)]:
        path = output_path(canon, a.out_dir)
        try:
            text = render(canon)
        except BuildError as e:
            print("조각 형식 오류 %s: %d건" % (canon.name, len(e.args[0])))
            for msg in e.args[0]:
                print(" -", msg)
            return 2
        except Exception:  # 조각 코드의 에러(NameError 등)를 --check 의 "다름"(1)과 구분한다
            print("조각을 읽다가 멈췄습니다(%s). 아래 에러를 조각에서 고치세요." % canon.name, file=sys.stderr)
            traceback.print_exc()
            return 3
        made = text.encode("utf-8")
        current = read_bytes(path)
        if current == made:
            print("같음: %s" % shown(path))
            continue
        if a.check:
            stale += 1
            if current is None:
                print("없음: %s" % shown(path))
            else:
                print("다름: %s (%d번째 줄부터)" % (shown(path), first_diff_line(text, current.decode("utf-8", "replace"))))
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(made)
        print("새로 씀: %s" % shown(path))
    if stale:
        print("정본이 조각과 다릅니다. 조각을 고쳤다면 --check 없이 다시 만드세요. 정본을 손으로 고쳤다면 그 고침을 조각으로 옮기세요.")
    return 1 if stale else 0


if __name__ == "__main__":
    sys.exit(main())
