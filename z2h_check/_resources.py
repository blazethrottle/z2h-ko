"""패키지 안 자료 파일(기준값 JSON) 읽기.

묶음(_bundle.py)으로 실행될 때는 파일이 없으므로, 묶음이 _EMBEDDED 에 넣어 둔 글을 쓴다.
"""
import json
import os

_EMBEDDED = {}  # 묶음이 채운다: {"reference/l01.json": "..."}
_CACHE = {}


def read_text(relpath):
    if relpath in _EMBEDDED:
        return _EMBEDDED[relpath]
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), *relpath.split("/"))
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def load_json(relpath):
    if relpath not in _CACHE:
        _CACHE[relpath] = json.loads(read_text(relpath))
    return _CACHE[relpath]
