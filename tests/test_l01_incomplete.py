"""미완성·엉뚱한 입력에도 check()가 예외 없이 False와 "✕ 다시"만 내는지 (빈칸 그대로 노트북 전체 실행)."""
import inspect

import pytest

import z2h_check
from z2h_check import check, finish, graders

ALL_IDS = [cid for cid, _ in graders.lecture_checks("L01")]


class Boom(RuntimeError):
    pass


class Bomb:
    """무엇을 해도 오류를 내는 객체."""
    def __getattr__(self, name):
        raise Boom("펑")

    def __call__(self, *a, **k):
        raise Boom("펑")

    def __iter__(self):
        raise Boom("펑")

    def __len__(self):
        raise Boom("펑")

    def __float__(self):
        raise Boom("펑")

    def __bool__(self):
        raise Boom("펑")

    def __repr__(self):
        raise Boom("펑")

    __str__ = __repr__

    def _op(self, *a):
        raise Boom("펑")

    __add__ = __radd__ = __mul__ = __rmul__ = __sub__ = __rsub__ = __truediv__ = __pow__ = __neg__ = _op
    __lt__ = __gt__ = __le__ = __ge__ = _op


class NotYet:
    """클래스 자리에 넘겼지만 아직 안 채운 것."""
    def __init__(self, *a, **k):
        raise NotImplementedError("아직 안 씀")


class Blank:
    """빈칸(___)이 남은 클래스."""
    def __init__(self, data=0.0, _children=(), _op=""):
        self.data = ___  # noqa: F821  (일부러 비워 둔 빈칸)


def _raises(*a, **k):
    raise ValueError("학생 함수 안 오류")


BAD = [None, Ellipsis, Bomb(), NotYet, Blank, object(), 42, "abc", [], _raises, float("nan")]
BAD_IDS = ["None", "Ellipsis", "Bomb", "NotYet", "Blank", "object", "42", "abc", "empty_list", "raises", "nan"]


def _assert_plain_fail(cid, ok, capsys):
    out = capsys.readouterr().out
    rec = z2h_check.results().get(cid)
    assert ok is False, out
    assert rec is not None and rec["status"] == "fail", (cid, rec, out)
    assert "✕ 다시" in out and "채점기 오류" not in out and "Traceback" not in out, out


@pytest.mark.parametrize("bad", BAD, ids=BAD_IDS)
@pytest.mark.parametrize("cid", ALL_IDS)
def test_bad_first_argument(cid, bad, capsys):
    _assert_plain_fail(cid, check(cid, bad), capsys)


@pytest.mark.parametrize("cid", ALL_IDS)
def test_no_arguments(cid, capsys):
    _assert_plain_fail(cid, check(cid), capsys)


@pytest.mark.parametrize("bad", [None, Bomb(), "x"], ids=["None", "Bomb", "str"])
@pytest.mark.parametrize("cid", ALL_IDS)
def test_every_parameter_filled_with_junk(cid, bad, capsys):
    params = inspect.signature(graders.get_grader(cid)).parameters
    kwargs = {name: bad for name, p in params.items()
              if p.kind in (p.POSITIONAL_OR_KEYWORD, p.KEYWORD_ONLY) and name != "seen"}
    _assert_plain_fail(cid, check(cid, **kwargs), capsys)


@pytest.mark.parametrize("cid", ALL_IDS)
def test_unknown_keyword(cid, capsys):
    _assert_plain_fail(cid, check(cid, 없는이름=1), capsys)


def test_whole_blank_notebook_then_finish(capsys):
    for cid in ALL_IDS:
        check(cid, None)
    code = finish("L01", send=False)
    out = capsys.readouterr().out
    assert code.startswith("Z2H1.") and f"다시 {len(ALL_IDS)}" in out
