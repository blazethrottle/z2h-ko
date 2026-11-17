"""재구성(빈 셀에서 다시 만들기) 구역의 셀 도우미.

    import z2h_check.rebuild as _z2h_rebuild
    _z2h_rebuild.start(globals())             # '재구성 시작' 셀: 이 노트북을 빈 노트북처럼
    _z2h_rebuild.resume(globals(), "L01-R3")  # 'R3 시작' 셀: 본문 상태로 되돌리기

정본 rebuild_tasks: R1 은 빈 노트북에서 Value 를 다시 만들고, R2 는 R1 셀에 backward()를 덧붙이고,
R3 은 '이 편의 노트북에서 Value, Neuron, Layer, MLP, 데이터 셀까지 실행된 상태로' 시작한다.
- start(): 본문에서 만든 이름(밑줄로 시작하지 않는 것)을 따로 보관하고 지운다. 채점 도구와 채점 기록은 그대로.
  두 번 눌러도 처음 보관한 본문을 지키고 지우기만 한다.
- resume(): 보관한 본문 이름을 되돌리고, 그 조각의 확인 셀이 읽는 이름(기준값 파일 reads, R3 은 loss)을 지운다.
  그래서 확인은 이 조각의 새 셀이 만든 값만 본다. 보관한 것이 없으면(다른 날 새 커널) 무엇을 먼저 실행할지 알려 준다.
"""
from . import runs
from ._resources import load_json

SAVED = "_z2h_lecture_names"
KEEP = frozenset({"check", "finish", "In", "Out", "get_ipython", "exit", "quit"})


def _kept_names():
    keep = set(KEEP)
    shell = runs._shell()
    if shell is not None:
        keep |= set(getattr(shell, "user_ns_hidden", {}) or {})  # IPython 이 스스로 넣어 둔 이름
    return keep


def _clearable(ns):
    keep = _kept_names()
    return sorted(name for name in ns if not name.startswith("_") and name not in keep)


def _spec(rebuild_id):
    for spec in load_json("reference/l01.json")["rebuild"]:
        if spec["rebuild_id"] == rebuild_id:
            return spec
    raise KeyError(rebuild_id)


def _names(names, limit=6):
    return ", ".join(names[:limit]) + (" 등" if len(names) > limit else "")


def start(ns):
    """'재구성 시작' 셀: 본문 이름을 보관하고 지워 빈 노트북처럼 만든다."""
    runs.mark_tool_cell()
    gone = _clearable(ns)
    if SAVED not in ns:
        ns[SAVED] = {name: ns[name] for name in gone}
    for name in gone:
        del ns[name]
    if gone:
        print(f"재구성 시작: 위에서 만든 이름 {len(gone)}개({_names(gone)})를 따로 보관하고 지워 빈 노트북처럼 만들었습니다. "
              "채점 기록은 그대로입니다.")
    else:
        print("재구성 시작: 지울 이름이 없습니다(빈 노트북 상태). 채점 기록은 그대로입니다.")
    print("이제 아래 조각의 빈 셀에 처음부터 다시 만들어 보세요. 위 본문 셀은 다시 실행하지 않습니다.")


def resume(ns, rebuild_id):
    """'R3 시작' 같은 셀: 보관한 본문 이름을 되돌리고, 확인 셀이 읽는 이름은 지운다."""
    runs.mark_tool_cell()
    spec = _spec(rebuild_id)
    saved = ns.get(SAVED) or {}
    if saved:
        for name in _clearable(ns):
            del ns[name]
        ns.update(saved)
    dropped = [name for name in spec["reads"] if ns.pop(name, None) is not None]
    if saved:
        print(f"{rebuild_id} 시작: 보관해 둔 본문 이름 {len(saved)}개를 되돌렸습니다(재구성 시작 셀 전 상태).")
    missing = [name for name in spec["needs"] if name not in ns]
    if missing:
        print(f"{rebuild_id} 시작: 본문 이름 {_names(missing)}이(가) 없습니다. 위 본문의 그 셀들을 먼저 실행한 뒤 "
              "이 셀을 다시 실행하세요(다른 날이면 맨 위 준비 셀부터).")
    if dropped:
        print(f"확인 셀이 보는 {_names(dropped)}은(는) 지웠습니다. 아래 새 셀이 만든 값만 확인합니다.")
