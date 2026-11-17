"""학습 셀을 몇 번 실행했는지 모델마다 센다 (재구성 L01-R3 자기 확인용).

    from z2h_check import runs
    runs.watch(("n",))       # 노트북의 '재구성 시작' 셀이 부른다. IPython(Jupyter, Colab)이 아니면 False
    runs.runs_of(n)          # 자기 확인 셀이 부른다. 셀 수 없으면 None

세는 방법
- watch() 는 IPython 의 셀 실행 끝 알림(post_run_cell)에 작은 함수 하나를 건다. 셀 하나가 끝날 때마다
  이름 n 에 묶인 모델의 파라미터 값(p.data)을 읽어, 같은 모델의 값이 바뀌었으면 그 모델의 '학습 셀 실행'을 1 늘린다.
- 새 모델(다른 객체)이 n 에 묶이면 0부터 다시 센다. 만들기 셀을 다시 실행하면 새 모델이라 처음부터 센다.
- 학습한 셀의 반복 수(range(20) 등)는 보지 않는다. 학습 셀 1번 = 정본의 steps_per_run 번 반복이라고 보고 센다.
- 세기만 한다. 힌트나 점수로 기록하지 않고, 결과코드에도 넣지 않는다.

준비 셀(묶음)을 다시 실행해도 이미 걸린 함수를 찾아 그대로 쓴다(두 번 걸어 두 번 세는 일이 없다).
IPython 이 아니면(일반 파이썬) 아무것도 걸지 않고 runs_of() 는 None 을 돌려준다. 그때 L01-R3 은 손실만 본다.
"""
import contextlib
import io
import sys
import warnings

EVENT = "post_run_cell"
STATE_VERSION = 1
MAX_MODELS = 20      # 기억하는 모델 수(오래된 것부터 잊음)
MAX_PARAMS = 100000  # 이보다 큰 모델은 세지 않는다(재구성 모델은 41개)


def _shell():
    """지금 IPython 안이면 그 셸, 아니면 None. IPython 을 새로 불러오지는 않는다."""
    ipy = sys.modules.get("IPython")
    if ipy is None:
        return None
    try:
        shell = ipy.get_ipython()
    except Exception:
        return None
    if shell is None or not hasattr(shell, "events") or not isinstance(getattr(shell, "user_ns", None), dict):
        return None
    return shell


@contextlib.contextmanager
def _quiet():
    with contextlib.ExitStack() as stack:
        stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
        stack.enter_context(contextlib.redirect_stderr(io.StringIO()))
        stack.enter_context(warnings.catch_warnings())
        warnings.simplefilter("ignore")
        yield


def fingerprint(model):
    """모델 파라미터 값들의 묶음(바뀌었는지 비교용). 읽을 수 없으면 None. 학생 코드 오류는 밖으로 내지 않는다."""
    try:
        with _quiet():
            params = model.parameters()
            out = []
            for i, p in enumerate(params):
                if i >= MAX_PARAMS:
                    return None
                out.append(float(p.data))
        return tuple(out) if out else None
    except KeyboardInterrupt:
        raise
    except BaseException:
        return None


def _new_state(names):
    return {"version": STATE_VERSION, "names": tuple(names), "models": {}}


def _remember(state, model, fp):
    models = state["models"]
    models[id(model)] = {"obj": model, "fp": fp, "runs": 0}
    while len(models) > MAX_MODELS:
        models.pop(next(iter(models)))


def observe(state, namespace):
    """셀 하나가 끝난 뒤: 지켜보는 이름의 모델 값이 바뀌었으면 그 모델의 실행 수를 1 늘린다."""
    for name in state["names"]:
        model = namespace.get(name)
        if model is None:
            continue
        fp = fingerprint(model)
        if fp is None:
            continue
        rec = state["models"].get(id(model))
        if rec is None or rec["obj"] is not model:
            _remember(state, model, fp)
        elif rec["fp"] != fp:
            rec["fp"] = fp
            rec["runs"] += 1


def _make_hook(shell, names):
    state = _new_state(names)

    def _z2h_runs_hook(*_args, **_kwargs):
        try:
            observe(state, shell.user_ns)
        except KeyboardInterrupt:
            raise
        except BaseException:
            pass

    _z2h_runs_hook.z2h_runs_state = state
    return _z2h_runs_hook


def _find_hook(shell):
    try:
        callbacks = list(shell.events.callbacks.get(EVENT, []))
    except Exception:
        return None
    for cb in callbacks:
        state = getattr(cb, "z2h_runs_state", None)
        if isinstance(state, dict) and state.get("version") == STATE_VERSION:
            return cb
    return None


def watch(names=("n",)):
    """학습 셀 실행 세기를 켠다. 켰으면(또는 이미 켜져 있으면) True, IPython 이 아니라 못 켜면 False."""
    shell = _shell()
    if shell is None:
        return False
    try:
        hook = _find_hook(shell)
        if hook is not None:
            hook.z2h_runs_state["names"] = tuple(names)
            return True
        for cb in list(shell.events.callbacks.get(EVENT, [])):  # 예전 모양의 우리 함수가 남아 있으면 뗀다
            if hasattr(cb, "z2h_runs_state"):
                shell.events.unregister(EVENT, cb)
        hook = _make_hook(shell, names)
        shell.events.register(EVENT, hook)
        observe(hook.z2h_runs_state, shell.user_ns)  # 지금 묶여 있는 모델은 여기서부터 센다
        return True
    except Exception:
        return False


def watching():
    """세기가 켜져 있는지."""
    shell = _shell()
    return shell is not None and _find_hook(shell) is not None


def runs_of(model):
    """이 모델로 학습 셀을 몇 번 실행했는지(1 이상). 셀 수 없거나 처음 보는 모델이면 None.

    지금 셀 안에서 바뀐 값도 바로 센다(학습 줄과 확인 줄을 한 셀에 둔 경우)."""
    shell = _shell()
    hook = _find_hook(shell) if shell is not None else None
    if hook is None:
        return None
    state = hook.z2h_runs_state
    fp = fingerprint(model)
    if fp is None:
        return None
    rec = state["models"].get(id(model))
    if rec is None or rec["obj"] is not model:
        _remember(state, model, fp)  # 처음 보는 모델: 지금부터 센다. 이번에는 몇 번인지 모름
        return None
    if rec["fp"] != fp:
        rec["fp"] = fp
        rec["runs"] += 1
    return max(1, rec["runs"])
