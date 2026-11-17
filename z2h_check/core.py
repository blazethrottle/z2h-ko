"""check()와 finish(): 채점하고, 결과를 출력하고, 모듈 안에 기록한다.

- check() 는 어떤 경우에도 예외를 밖으로 내보내지 않는다(Ctrl+C로 멈추는 것만 그대로 둔다).
- 학생 코드가 틀리거나 비어 있으면 "✕ 다시", 채점 프로그램 자체가 고장 나면 "⚠ 채점기 오류"로 따로 보인다.
- 아직 하지 않은 칸(필요한 셀을 아직 실행하지 않음, 빈 셀 그대로)은 "○ 아직"만 보이고 기록하지 않는다(이전 기록 그대로).
- check()와 finish()를 부른 셀은 셀 실행 기록(runs)에 '도구 셀'로 표시한다. 채점 셀은 늘 바로 위 '내 셀'을 본다.
- finish() 는 채점표와 결과코드를 늘 출력하고, 로컬 진도 서버(127.0.0.1)로 보내기를 시도한다.
"""
import contextlib
import inspect
import io
import json
import os
import random
import urllib.error
import urllib.parse
import urllib.request
import warnings

from . import graders, runs
from .graders import _util
from .result_code import encode_result_code, now_kst_iso

DEFAULT_SERVER_URL = "http://127.0.0.1:8787/api/grade"
SEND_TIMEOUT_S = 2.0
_LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}
_PKG_DIR = os.path.dirname(os.path.abspath(__file__))
_GRADER_SEED = 20221116  # 채점 안에서 쓰는 무작위 값을 고정한다(학생의 무작위 상태는 채점 뒤 되돌린다)

MARK = {"pass": "✓ 맞음", "fail": "✕ 다시", "skip": "· 건너뜀", "error": "⚠ 채점기 오류"}
_ROW_MARK = {"pass": "✓", "fail": "✕", "skip": "·", "error": "⚠", "todo": "○"}

_RESULTS = {}  # check_id -> {"check_id", "status", "passed", "message_ko", "at", "attempts"}


def reset():
    """기록을 모두 지운다."""
    _RESULTS.clear()


def results():
    """지금까지의 채점 기록 사본. status: pass | fail | skip | error"""
    return {cid: dict(rec) for cid, rec in _RESULTS.items()}


def _emit(text):
    print(text)


def _say(text):
    try:
        _emit(text)
    except KeyboardInterrupt:
        raise
    except BaseException:
        pass


def _short(x):
    return repr(x) if isinstance(x, str) else _util.type_name(x)


# ---- check ------------------------------------------------------------------

def check(check_id, *args, **kwargs):
    """check("L01-S02", globals()) -> True/False. 맞으면 "✓ 맞음: …", 다르면 "✕ 다시: …"를 출력한다."""
    try:
        runs.mark_tool_cell()
        return _check(check_id, args, kwargs)
    except KeyboardInterrupt:
        raise
    except BaseException as exc:  # 마지막 안전망
        _say(f"{MARK['error']}: 채점 중 예상하지 못한 문제가 생겼습니다({type(exc).__name__}). 내 코드 탓이 아닐 수 있습니다.")
        return False


def _check(check_id, args, kwargs):
    cid = graders.canonical_id(check_id)
    if cid is None:
        _say(f"{MARK['error']}: 채점 번호 {_short(check_id)}를 모릅니다. 노트북의 채점 셀을 확인해 주세요. "
             "(이 칸은 기록하지 않았습니다)")
        return False
    status, message, mark = _run_grader(cid, args, kwargs)
    if status == "notyet":
        _say(f"{mark}: {message} [{cid}]")  # 기록하지 않는다: 결과코드·서버 보내기·시도 횟수에 들어가지 않음
        return False
    prev = _RESULTS.get(cid)
    _RESULTS[cid] = {
        "check_id": cid,
        "status": status,
        "passed": status == "pass",
        "mark": mark,
        "message_ko": message,
        "at": now_kst_iso(),
        "attempts": (prev["attempts"] + 1) if prev else 1,
    }
    _say(f"{mark}: {message} [{cid}]")
    return status == "pass"


@contextlib.contextmanager
def _quiet():
    """채점하는 동안 학생 코드의 print·경고를 숨긴다."""
    with contextlib.ExitStack() as stack:
        stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
        stack.enter_context(contextlib.redirect_stderr(io.StringIO()))
        stack.enter_context(warnings.catch_warnings())
        warnings.simplefilter("ignore")
        yield


def _is_ours(filename):
    return filename.startswith(_PKG_DIR + os.sep) or filename.startswith("<z2h_check")


def _raised_in_package(exc):
    tb = exc.__traceback__
    last = None
    while tb is not None:
        last = tb
        tb = tb.tb_next
    return last is None or _is_ours(last.tb_frame.f_code.co_filename)


def _run_grader(cid, args, kwargs):
    """(status, 메시지, 화면 앞머리). status: pass | fail | skip | error | notyet"""
    fn = graders.get_grader(cid)
    try:
        bound = inspect.signature(fn).bind(*args, **kwargs)
    except TypeError:
        return "fail", f"채점 칸에 넘긴 값의 개수나 이름이 다릅니다. 이렇게 부르세요: {graders.usage_of(cid)}", MARK["fail"]
    state = random.getstate()
    try:
        random.seed(_GRADER_SEED)
        with _quiet():
            result = fn(*bound.args, **bound.kwargs)
        if isinstance(result, _util.Pass):
            return "pass", result.message_ko, result.mark
        return "pass", str(result), MARK["pass"]
    except _util.Fail as exc:
        return "fail", exc.message_ko, MARK["fail"]
    except _util.Skip as exc:
        return "skip", exc.message_ko, MARK["skip"]
    except _util.NotYet as exc:
        return "notyet", exc.message_ko, exc.mark
    except KeyboardInterrupt:
        raise
    except BaseException as exc:
        if _raised_in_package(exc):
            return "error", (f"채점 프로그램 안에서 문제가 생겼습니다({_util.describe_exc(exc)}). "
                             "내 코드 탓이 아닐 수 있으니 이 칸은 넘어가고 알려 주세요."), MARK["error"]
        return "fail", _util.student_error_message("내 코드를 실행", exc), MARK["fail"]
    finally:
        random.setstate(state)


# ---- finish -----------------------------------------------------------------

def finish(lecture_id="L01", send=True, server_url=None, timeout=SEND_TIMEOUT_S, at=None):
    """이 편의 채점표를 출력하고 결과코드를 돌려준다. send=True면 로컬 진도 서버로도 보내 본다."""
    try:
        runs.mark_tool_cell()
        return _finish(lecture_id, send, server_url, timeout, at)
    except KeyboardInterrupt:
        raise
    except BaseException as exc:
        _say(f"{MARK['error']}: 채점표를 만들다 문제가 생겼습니다({type(exc).__name__}).")
        return ""


def _finish(lecture_id, send, server_url, timeout, at):
    lid = graders.canonical_lecture(lecture_id)
    if lid is None:
        _say(f"{MARK['error']}: 편 번호 {_short(lecture_id)}를 모릅니다. finish(\"L01\") 처럼 부르세요.")
        return ""
    items = graders.lecture_checks(lid)
    at = at or now_kst_iso()
    counts = {"pass": 0, "fail": 0, "skip": 0, "error": 0, "todo": 0}
    passed, failed, rows = [], [], []
    width = max(len(cid) for cid, _ in items)
    for cid, title in items:
        rec = _RESULTS.get(cid)
        status = rec["status"] if rec else "todo"
        counts[status] += 1
        if status == "pass":
            passed.append(cid)
        elif status == "fail":
            failed.append(cid)
        tail = {"pass": "",
                "fail": f": {rec['message_ko']}" if rec else "",
                "skip": f": 건너뜀 ({rec['message_ko']})" if rec else "",
                "error": ": 채점기 오류",
                "todo": ": 아직 안 함"}[status]
        rows.append(f"  {_ROW_MARK[status]} {cid.ljust(width)}  {title}{tail}")
    head = (f"{lid} 채점표 (모두 {len(items)}칸): 통과 {counts['pass']} · 다시 {counts['fail']} · "
            f"건너뜀 {counts['skip']} · 아직 안 함 {counts['todo']}")
    if counts["error"]:
        head += f" · 채점기 오류 {counts['error']}"
    _say("\n".join([head] + rows + [graders.mastery_note(lid)]))
    code = encode_result_code(lid, passed, failed, at)
    if send and os.environ.get("Z2H_NO_SEND", "") in ("", "0"):
        _say(_send(lid, items, server_url, timeout, at))
    _say("결과코드 (앱의 '결과코드 붙여넣기' 칸에 넣으세요):")
    _say(code)
    return code


def _send(lid, items, server_url, timeout, at):
    unreachable = "서버에 닿지 못했습니다. 아래 결과코드를 앱에 붙여 넣으세요. (Colab에서는 이것이 정상입니다)"
    url = server_url or os.environ.get("Z2H_SERVER_URL") or DEFAULT_SERVER_URL
    try:
        parts = urllib.parse.urlsplit(url)
        host = parts.hostname
    except ValueError:
        parts, host = None, None
    if parts is None or parts.scheme != "http" or host not in _LOCAL_HOSTS:
        return "진도 서버 주소는 http://127.0.0.1 만 씁니다. 보내지 않았습니다. 아래 결과코드를 앱에 붙여 넣으세요."
    results_body = []
    for cid, _title in items:
        rec = _RESULTS.get(cid)
        if rec and rec["status"] in ("pass", "fail"):
            results_body.append({"check_id": cid, "passed": rec["status"] == "pass",
                                 "message_ko": f"{rec['mark']}: {rec['message_ko']}"})
    body = {"lecture_id": lid, "results": results_body, "at": at}
    try:
        status = _post_json(url, body, timeout)
    except Exception:
        return unreachable
    if 200 <= status < 300:
        return f"진도 서버에 채점 결과 {len(results_body)}칸을 보냈습니다. 앱을 새로 고치면 보입니다."
    return f"서버가 결과를 받지 않았습니다(HTTP {status}). 아래 결과코드를 앱에 붙여 넣으세요."


def _post_json(url, body, timeout):
    """POST JSON. 프록시를 쓰지 않는다(127.0.0.1 전용). 돌려주는 값: HTTP 상태 번호."""
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    parts = urllib.parse.urlsplit(url)
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Origin": f"{parts.scheme}://{parts.netloc}",
        "User-Agent": "z2h-check/0.1",
    }
    req = urllib.request.Request(url, data=data, method="POST", headers=headers)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code
