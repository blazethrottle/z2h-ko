"""z2h_check 패키지 전체를 Colab 노트북 준비 셀에 넣을 파이썬 소스 하나로 묶는다.

    python -m z2h_check.bundle            # 묶은 소스를 화면에 출력 (준비 셀에 그대로 붙여 넣음)
    python -m z2h_check.bundle --write    # z2h_check/_bundle.py 로 저장
    python -m z2h_check.bundle --check    # _bundle.py 가 지금 패키지와 같은지 확인 (다르면 종료 코드 1)

묶음을 실행하면 z2h_check 가 import 된 것과 똑같이 동작한다(모듈 소스를 그대로 담고, 가짜 파일 위치에서
import 하게 한다). 패키지나 reference/*.json 을 고치면 --write 로 다시 만든다(tests/test_bundle.py 가 확인).
"""
import argparse
import hashlib
import os
import sys

from . import __version__

PKG_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_FILE = os.path.join(PKG_DIR, "_bundle.py")
_SKIP_TOP = {"bundle.py", "_bundle.py", "__main__.py"}


def _module_files():
    """[(모듈 이름, 패키지 안 경로, 패키지인지)] 이름순."""
    mods = []
    for dirpath, dirnames, filenames in os.walk(PKG_DIR):
        dirnames[:] = sorted(d for d in dirnames if d != "__pycache__" and not d.startswith("."))
        rel_dir = os.path.relpath(dirpath, PKG_DIR)
        for name in sorted(filenames):
            if not name.endswith(".py") or (rel_dir == "." and name in _SKIP_TOP):
                continue
            rel = name if rel_dir == "." else os.path.join(rel_dir, name)
            parts = rel[:-3].split(os.sep)
            is_pkg = parts[-1] == "__init__"
            if is_pkg:
                parts = parts[:-1]
            mods.append((".".join(["z2h_check"] + parts), rel.replace(os.sep, "/"), is_pkg))
    return sorted(mods)


def _data_files():
    ref_dir = os.path.join(PKG_DIR, "reference")
    return ["reference/" + n for n in sorted(os.listdir(ref_dir)) if n.endswith(".json")]


def _read(rel):
    with open(os.path.join(PKG_DIR, *rel.split("/")), encoding="utf-8") as fh:
        return fh.read()


def _literal(text, indent):
    lines = text.splitlines(keepends=True)
    if not lines:
        return '""'
    body = "\n".join(indent + repr(line) for line in lines)
    return "(\n" + body + "\n" + indent[:-4] + ")"


def build_bundle():
    mods = _module_files()
    data = _data_files()
    sources = {name: _read(rel) for name, rel, _ in mods}
    datas = {rel: _read(rel) for rel in data}
    digest = hashlib.sha256()
    for key in sorted(sources):
        digest.update(key.encode() + b"\0" + sources[key].encode("utf-8") + b"\0")
    for key in sorted(datas):
        digest.update(key.encode() + b"\0" + datas[key].encode("utf-8") + b"\0")
    ind = " " * 12
    src_items = "\n".join(f"        {name!r}: {_literal(sources[name], ind)}," for name, _, _ in mods)
    data_items = "\n".join(f"        {rel!r}: {_literal(datas[rel], ind)}," for rel in data)
    packages = sorted(name for name, _, is_pkg in mods if is_pkg)
    return _TEMPLATE.format(
        version=__version__,
        digest=digest.hexdigest(),
        sources=src_items,
        data=data_items,
        packages=("{" + ", ".join(repr(p) for p in packages) + "}") if packages else "set()",
    )


_TEMPLATE = '''# z2h_check 묶음 {version}: Z2H 노트북 채점 도구를 셀 하나에 담은 것입니다.
# 이 셀을 그대로 실행하면 check(...)와 finish("L01")를 쓸 수 있습니다. 내용은 고치지 마세요.
# 자동 생성 파일: 저장소에서 python -m z2h_check.bundle --write 로 다시 만듭니다 (원본: z2h_check/ 폴더).
# 원본 해시 sha256:{digest}
# 출처 표기: 채점 기준의 강의 예제 숫자·데이터는 karpathy/nn-zero-to-hero, 비교 방식은 karpathy/micrograd (MIT).


def _z2h_install():
    import importlib.abc
    import importlib.util
    import sys

    sources = {{
{sources}
    }}
    packages = {packages}
    data = {{
{data}
    }}

    class _Z2HBundleFinder(importlib.abc.MetaPathFinder, importlib.abc.Loader):
        z2h_bundle = True

        def find_spec(self, fullname, path=None, target=None):
            if fullname in sources:
                return importlib.util.spec_from_loader(fullname, self, origin="<z2h_check 묶음>",
                                                       is_package=fullname in packages)
            return None

        def create_module(self, spec):
            return None

        def exec_module(self, module):
            name = module.__name__
            tail = "/__init__.py" if name in packages else ".py"
            filename = "<z2h_check 묶음>/" + name.replace(".", "/") + tail
            module.__file__ = filename
            if name == "z2h_check":
                module.__z2h_bundled__ = True
            exec(compile(sources[name], filename, "exec"), module.__dict__)
            if name == "z2h_check._resources":
                module._EMBEDDED.update(data)

    for finder in list(sys.meta_path):
        if getattr(finder, "z2h_bundle", False):
            sys.meta_path.remove(finder)
    for name in list(sys.modules):
        if name == "z2h_check" or name.startswith("z2h_check."):
            del sys.modules[name]
    sys.meta_path.insert(0, _Z2HBundleFinder())
    import z2h_check
    return z2h_check


if __name__ != "z2h_check._bundle":
    _z2h = _z2h_install()
    check, finish = _z2h.check, _z2h.finish
    print("z2h_check 준비 완료 (묶음 {version}): check(...)로 채점하고, 마지막에 finish(\\"L01\\")를 실행하세요.")
    del _z2h
'''


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m z2h_check.bundle", description="z2h_check 를 파일 하나로 묶는다.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--write", action="store_true", help="z2h_check/_bundle.py 로 저장")
    group.add_argument("--check", action="store_true", help="_bundle.py 가 최신인지 확인")
    args = parser.parse_args(argv)
    src = build_bundle()
    if args.write:
        with open(OUT_FILE, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(src)
        print(f"저장했습니다: z2h_check/_bundle.py ({len(src.encode('utf-8'))} 바이트)")
        return 0
    if args.check:
        try:
            with open(OUT_FILE, encoding="utf-8") as fh:
                current = fh.read()
        except OSError:
            current = None
        if current != src:
            print("z2h_check/_bundle.py 가 패키지와 다릅니다. python -m z2h_check.bundle --write 로 다시 만드세요.")
            return 1
        print("z2h_check/_bundle.py 가 최신입니다.")
        return 0
    sys.stdout.buffer.write(src.encode("utf-8"))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
