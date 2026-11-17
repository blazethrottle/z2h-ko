"""셀 실행 기록: 셀이 끝날 때마다 그 셀이 화면에 보인 것(출력 글, 마지막 줄 값, 오류)을 기억한다.

    from z2h_check import runs
    runs.watch()        # z2h_check 를 불러올 때 한 번 부른다(IPython 이 아니면 아무것도 걸지 않음)
    runs.last_cell()    # 채점 셀이 부른다: 바로 앞에 실행한 '내 셀'의 기록, 없으면 None

정본 expected_check 의 output_match(출력 글 대조), 식이 없는 value_range(출력의 마지막 숫자), manual(셀이 오류 없이
돌았는지)는 '바로 위 셀이 보인 것'으로 채점한다. 그래서 IPython(Jupyter, Colab)의 셀 실행 앞뒤 알림
(pre_run_cell, post_run_cell)에 작은 함수를 건다.
- 셀 앞: sys.stdout 을 '받아 적으며 그대로 내보내는' 것으로 잠깐 바꾼다. 화면에 보이는 것은 그대로다.
- 셀 뒤: sys.stdout 을 되돌리고 (셀 소스, 출력 글, 마지막 줄 값의 글, 오류, 빈 셀인지)를 기록한다.
- 채점 도구를 부른 셀(check, finish, 준비 셀, 재구성 시작 셀)은 mark_tool_cell() 로 표시해 기록하지 않는다.
  그래서 채점 셀을 두 번 눌러도 늘 바로 위 '내 셀'을 본다.
- 주석과 빈 줄뿐인 셀(학생 노트북의 '# 여기에 작성')은 blank=True 로 기록한다.
준비 셀(묶음)을 다시 실행해도 이미 걸린 함수를 찾아 그대로 쓴다(두 번 걸지 않는다).
IPython 이 아니면 record_cell() 로 넣은 기록만 본다(시험과 일반 파이썬용).
"""
import sys

EVENTS = ("pre_run_cell", "post_run_cell")
STATE_VERSION = 2
MAX_TEXT = 100000  # 셀 출력은 앞뒤 절반씩만 기억한다


class _Tee:
    """sys.stdout 대신 잠깐 두는 것: 받은 글을 적어 두고 원래 출력으로 그대로 보낸다."""

    def __init__(self, target):
        self._z2h_target = target
        self._z2h_parts = []

    def write(self, text):
        if isinstance(text, str):
            self._z2h_parts.append(text)
        return self._z2h_target.write(text)

    def text(self):
        return "".join(self._z2h_parts)

    def __getattr__(self, name):
        if name.startswith("_z2h_"):
            raise AttributeError(name)
        return getattr(self._z2h_target, name)


def _new_state():
    return {"version": STATE_VERSION, "last": None, "stack": [], "tool": False}


_FALLBACK = _new_state()


def _shell():
    """지금 IPython 안이면 그 셸, 아니면 None. IPython 을 새로 불러오지는 않는다."""
    ipy = sys.modules.get("IPython")
    if ipy is None:
        return None
    try:
        shell = ipy.get_ipython()
    except Exception:
        return None
    if shell is None or not hasattr(shell, "events"):
        return None
    return shell


def _find_hooks(shell):
    """이 셸에 걸린 우리 함수 (앞, 뒤). 버전이 같은 것만."""
    found = []
    for event in EVENTS:
        try:
            callbacks = list(shell.events.callbacks.get(event, []))
        except Exception:
            return None
        hook = next((cb for cb in callbacks if getattr(cb, "z2h_runs_state", {}).get("version") == STATE_VERSION), None)
        if hook is None:
            return None
        found.append(hook)
    return tuple(found)


def _state():
    shell = _shell()
    hooks = _find_hooks(shell) if shell is not None else None
    return hooks[0].z2h_runs_state if hooks else _FALLBACK


def _cap(text):
    if len(text) <= MAX_TEXT:
        return text
    half = MAX_TEXT // 2
    return text[:half] + "\n...\n" + text[-half:]


def is_blank(source):
    return all(not line.strip() or line.strip().startswith("#") for line in (source or "").splitlines())


def _store(state, source, stdout, shown, error):
    state["last"] = {"source": source or "", "stdout": _cap(stdout or ""), "shown": shown,
                     "error": error, "blank": is_blank(source)}


def record_cell(source, stdout="", shown=None, error=None):
    """셀 하나의 기록을 넣는다(IPython 알림이 부르는 것과 같은 길. 시험과 일반 파이썬에서도 쓴다)."""
    _store(_state(), source, stdout, None if shown is None else _cap(str(shown)), error)


def mark_tool_cell():
    """지금 셀은 채점 도구 셀이다: 이 셀이 끝나도 '바로 위 내 셀' 기록을 바꾸지 않는다."""
    _state()["tool"] = True


def last_cell():
    """바로 앞에 실행한 '내 셀'의 기록 {"source", "stdout", "shown", "error", "blank"} 또는 None."""
    rec = _state()["last"]
    return dict(rec) if rec else None


def forget():
    """기록을 지운다(시험용)."""
    state = _state()
    state["last"] = None
    state["tool"] = False


def watching():
    shell = _shell()
    return shell is not None and _find_hooks(shell) is not None


def _plain_text(shell, value):
    if value is None:
        return None
    try:
        data, _meta = shell.display_formatter.format(value, include=["text/plain"])
        text = data.get("text/plain")
    except Exception:
        text = None
    return None if text is None else _cap(str(text))


def _make_hooks(shell):
    state = _new_state()

    def _z2h_before_cell(info=None, *_args, **_kwargs):
        try:
            tee = _Tee(sys.stdout)
            state["stack"].append((sys.stdout, tee, getattr(info, "raw_cell", "") or ""))
            state["tool"] = False
            sys.stdout = tee
        except Exception:
            pass

    def _z2h_after_cell(result=None, *_args, **_kwargs):
        try:
            if not state["stack"]:
                return  # 우리 함수를 건 바로 그 셀: 셀 앞 알림을 받지 못했다
            target, tee, source = state["stack"].pop()
            if sys.stdout is tee:
                sys.stdout = target
            if state["tool"]:
                state["tool"] = False
                return
            error = getattr(result, "error_in_exec", None) or getattr(result, "error_before_exec", None)
            _store(state, source, tee.text(), _plain_text(shell, getattr(result, "result", None)), error)
        except Exception:
            pass

    for hook in (_z2h_before_cell, _z2h_after_cell):
        hook.z2h_runs_state = state
    return _z2h_before_cell, _z2h_after_cell


def watch():
    """셀 실행 기록을 켠다. 켰으면(또는 이미 켜져 있으면) True, IPython 이 아니라 못 켜면 False.
    부른 셀은 도구 셀로 표시한다(준비 셀 자신을 '내 셀'로 기록하지 않게)."""
    shell = _shell()
    if shell is None:
        return False
    try:
        if _find_hooks(shell) is None:
            for event in EVENTS:  # 예전 모양의 우리 함수가 남아 있으면 뗀다
                for cb in list(shell.events.callbacks.get(event, [])):
                    if hasattr(cb, "z2h_runs_state"):
                        shell.events.unregister(event, cb)
            before, after = _make_hooks(shell)
            shell.events.register("pre_run_cell", before)
            shell.events.register("post_run_cell", after)
        mark_tool_cell()
        return True
    except Exception:
        return False
