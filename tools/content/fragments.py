"""조각 폴더(src_<정본>/)의 파이썬 파일을 읽는 도우미.

조각끼리 `from common import S`처럼 같은 폴더의 파일을 부르므로, 읽는 동안만 그 폴더를 sys.path 맨 앞에 둔다.
끝나면 그 폴더에서 읽은 모듈을 sys.modules 에서 지워, 다른 정본의 같은 이름 조각과 섞이지 않게 한다.
"""
import contextlib
import importlib.util
import os
import sys


class BuildError(Exception):
    """조각이 형식 규칙을 어겨 정본을 만들 수 없음. args[0] 은 오류 글 목록."""


@contextlib.contextmanager
def folder_on_path(folder):
    folder = os.path.abspath(folder)
    sys.path.insert(0, folder)
    try:
        yield
    finally:
        sys.path.remove(folder)
        for name, mod in list(sys.modules.items()):
            path = getattr(mod, "__file__", None)
            if path and os.path.dirname(os.path.abspath(path)) == folder:
                del sys.modules[name]


def load_file(path):
    """파일 하나를 모듈로 읽는다(sys.modules 에 올리지 않음). 같은 폴더의 다른 조각을 부르는 파일이면 folder_on_path 안에서 부른다."""
    name = os.path.splitext(os.path.basename(path))[0].replace("-", "_")
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod
