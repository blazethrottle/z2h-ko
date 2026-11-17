#!/usr/bin/env python3
"""Claude Code 세션 기록에서 메인·서브 에이전트가 실제로 쓴 모델을 세어 합격·불합격을 낸다 (DESIGN.md 7절).

읽는 곳 (2026-11-16 이 맥의 실제 폴더와 파일 앞부분으로 확인한 구조):
  ~/.claude/projects/<저장소 절대 경로에서 영문·숫자가 아닌 글자를 모두 '-'로 바꾼 이름>/
    <세션ID>.jsonl                        메인 세션 기록
    <세션ID>/subagents/agent-*.jsonl       서브 에이전트 기록 (옆 agent-*.meta.json 의 agentType 이 서브 이름)
    <세션ID>/tool-results/                 읽지 않음
  한 줄이 JSON 하나다. type == "assistant" 인 줄의 message.model 이 모델 ID, message.id 가 응답 ID다.
  응답 하나가 여러 줄로 나뉘어 저장되므로 '기록 줄'과 '응답 수'를 따로 센다. timestamp 는 UTC ISO 시각이다.
  메인 파일 안에 isSidechain: true 인 assistant 줄이 있으면 서브로 센다(예전 저장 방식 대비).
합격: 메인은 claude-fable-5-2 만, 서브는 claude-opus-5-5 만. '<synthetic>' 처럼 꺾쇠로 싼 값과 빈 값은
'모델 아님'으로 따로 세고 판정에 넣지 않는다.
advisor: 도구 이름에 advisor 가 들어간 호출(tool_use, server_tool_use)과 그 결과(tool_result)를 따로 센다(불합격 아님).
읽기만 한다. --write 는 집계 숫자만 쓴다(대화 내용·세션 ID·사용자 이름 없음, 홈 경로는 ~).

    python tests/verify_models.py [--since YYYY-MM-DD] [--write docs/model_audit/YYYYMMDD.md]

--since 날짜는 서울 시각 0시부터. 종료 코드: 0 합격, 1 불합격, 2 판정 불가(기록 없음, 인자 오류, 쓰기 거부).
"""
import argparse
import collections
import datetime
import getpass
import json
import os
import re
import sys
from pathlib import Path

EXPECTED = {"main": "claude-fable-5-2", "sub": "claude-opus-5-5"}
GROUP_KO = {"main": "메인", "sub": "서브"}
KST = datetime.timezone(datetime.timedelta(hours=9))
UTC = datetime.timezone.utc
HOME = os.path.expanduser("~")
REPO = Path(__file__).resolve().parent.parent
_AGENT_RE = re.compile(r"[A-Za-z0-9_.:-]{1,64}")


def project_dir_name(path):
    """Claude Code가 프로젝트 기록 폴더 이름을 만드는 규칙: 영문·숫자가 아닌 글자는 '-'."""
    return re.sub(r"[^A-Za-z0-9]", "-", os.path.abspath(path))


def default_projects_dir(repo=REPO):
    return Path(HOME) / ".claude" / "projects" / project_dir_name(os.path.realpath(repo))


def _parse_since(text):
    if text is None:
        return None
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        raise ValueError(text)
    d = datetime.date.fromisoformat(text)
    return datetime.datetime(d.year, d.month, d.day, tzinfo=KST)


def _parse_ts(value):
    if not isinstance(value, str):
        return None
    try:
        ts = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return ts if ts.tzinfo else ts.replace(tzinfo=UTC)


def _is_model(value):
    return isinstance(value, str) and value.strip() != "" and not (value.startswith("<") and value.endswith(">"))


def _non_model_label(value):
    if isinstance(value, str) and value.strip():
        return value[:40]
    return "(빈 값)"


def _new_group():
    return {"models": {}, "non_model": collections.Counter(), "effort": collections.Counter(),
            "by_agent": {}, "_ids": collections.defaultdict(set)}


def _agent_type(jsonl_path):
    meta = jsonl_path.with_name(jsonl_path.name[: -len(".jsonl")] + ".meta.json")
    try:
        with open(meta, encoding="utf-8") as fh:
            value = json.load(fh).get("agentType")
    except (OSError, ValueError, AttributeError):
        return "(이름 없음)"
    return value if isinstance(value, str) and _AGENT_RE.fullmatch(value) else "(이름 없음)"


def _count_advisor(content, rep, advisor_ids):
    for block in content:
        if not isinstance(block, dict):
            continue
        btype = str(block.get("type", ""))
        name = str(block.get("name", ""))
        if btype in ("tool_use", "server_tool_use") and "advisor" in name.lower():
            rep["advisor"]["calls"] += 1
            if isinstance(block.get("id"), str):
                advisor_ids.add(block["id"])
        elif btype.endswith("tool_result") and block.get("tool_use_id") in advisor_ids:
            rep["advisor"]["results"] += 1
        elif "advisor" in btype.lower():
            rep["advisor"]["results" if "result" in btype.lower() else "calls"] += 1


def _read_file(path, group, agent, rep, since_dt):
    rep["files"][group] += 1
    advisor_ids = set()
    with open(path, encoding="utf-8", errors="replace") as fh:
        for lineno, line in enumerate(fh):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except ValueError:
                rep["bad_lines"] += 1
                continue
            if not isinstance(obj, dict):
                rep["bad_lines"] += 1
                continue
            if since_dt is not None:
                ts = _parse_ts(obj.get("timestamp"))
                if ts is None:
                    if obj.get("type") == "assistant":
                        rep["skipped_no_time"] += 1
                    continue
                if ts < since_dt:
                    continue
            msg = obj.get("message") if isinstance(obj.get("message"), dict) else {}
            content = msg.get("content") if isinstance(msg.get("content"), list) else []
            _count_advisor(content, rep, advisor_ids)
            if obj.get("type") != "assistant":
                continue
            g = "sub" if group == "sub" or obj.get("isSidechain") is True else "main"
            G = rep["groups"][g]
            effort = obj.get("effort")
            G["effort"][effort if isinstance(effort, str) and effort else "(없음)"] += 1
            model = msg.get("model")
            if not _is_model(model):
                G["non_model"][_non_model_label(model)] += 1
                continue
            entry = G["models"].setdefault(model, {"lines": 0, "messages": 0})
            entry["lines"] += 1
            mid = msg.get("id")
            G["_ids"][model].add(mid if isinstance(mid, str) else f"{path}:{lineno}")
            if g == "sub":
                key = agent if group == "sub" else "(메인 기록 안 서브)"
                G["by_agent"].setdefault(key, collections.Counter())[model] += 1


def collect(projects_dir, since=None):
    """projects_dir 아래 기록을 읽어 집계한다. since: 'YYYY-MM-DD'(서울 0시부터) 또는 datetime 또는 None."""
    projects_dir = Path(projects_dir)
    since_dt = _parse_since(since) if isinstance(since, str) else since
    rep = {"exists": projects_dir.is_dir(), "files": {"main": 0, "sub": 0},
           "groups": {"main": _new_group(), "sub": _new_group()},
           "advisor": {"calls": 0, "results": 0}, "bad_lines": 0, "skipped_no_time": 0}
    if rep["exists"]:
        for path in sorted(p for p in projects_dir.glob("*.jsonl") if p.is_file()):
            _read_file(path, "main", None, rep, since_dt)
        for path in sorted(p for p in projects_dir.glob("*/subagents/**/*.jsonl") if p.is_file()):
            _read_file(path, "sub", _agent_type(path), rep, since_dt)
    for G in rep["groups"].values():
        for model, entry in G["models"].items():
            entry["messages"] = len(G["_ids"][model])
        del G["_ids"]
        G["non_model"] = dict(G["non_model"])
        G["effort"] = dict(G["effort"])
        G["by_agent"] = {k: dict(v) for k, v in sorted(G["by_agent"].items())}
    return rep


def verdict(rep):
    """("합격" | "불합격" | "판정 불가", [이유])"""
    if not rep["exists"]:
        return "판정 불가", ["세션 기록 폴더가 없습니다."]
    if not rep["groups"]["main"]["models"]:
        return "판정 불가", ["메인 모델 기록이 없습니다."]
    reasons = []
    for g in ("main", "sub"):
        for model, entry in sorted(rep["groups"][g]["models"].items()):
            if model != EXPECTED[g]:
                reasons.append(f"{GROUP_KO[g]}에 {model} {entry['lines']}줄 (기대: {EXPECTED[g]})")
    return ("불합격" if reasons else "합격"), reasons


def _private_words():
    words = {os.path.basename(HOME.rstrip("/"))}
    try:
        words.add(getpass.getuser())
    except Exception:
        pass
    return sorted((w for w in words if w and len(w) >= 3), key=len, reverse=True)


def display_path(path):
    """홈은 ~ 로, 기록 폴더 이름 속 홈 경로는 <홈> 으로, 사용자 이름은 <사용자> 로 바꿔 보여 준다."""
    text = str(path)
    home = HOME.rstrip("/")
    if text == home or text.startswith(home + os.sep):
        text = "~" + text[len(home):]
    text = text.replace(project_dir_name(home), "<홈>")
    for word in _private_words():
        text = text.replace(word, "<사용자>")
    return text


def render(rep, projects_dir, since=None):
    v, reasons = verdict(rep)
    now = datetime.datetime.now(KST).strftime("%Y-%m-%d %H:%M")
    lines = [
        f"# 모델 검증 결과 ({now} KST)",
        "",
        f"- 기록 폴더: {display_path(projects_dir)}",
        f"- 범위: {'전체' if not since else f'{since} 0시(KST) 이후'}",
        f"- 읽은 파일: 메인 {rep['files']['main']}개, 서브 {rep['files']['sub']}개 · 깨진 줄 {rep['bad_lines']}"
        + (f" · 시각이 없어 뺀 응답 줄 {rep['skipped_no_time']}" if since else ""),
        f"- 판정: **{v}** (기준: 메인 = {EXPECTED['main']} 만, 서브 = {EXPECTED['sub']} 만)",
        "",
        "| 구분 | 모델 | 기록 줄 | 응답 수 | 기대 | 판정 |",
        "|---|---|---|---|---|---|",
    ]
    for g in ("main", "sub"):
        models = rep["groups"][g]["models"]
        if not models:
            lines.append(f"| {GROUP_KO[g]} | (기록 없음) | 0 | 0 | {EXPECTED[g]} | - |")
        for model, entry in sorted(models.items()):
            ok = "합격" if model == EXPECTED[g] else "불합격"
            lines.append(f"| {GROUP_KO[g]} | {model} | {entry['lines']} | {entry['messages']} | {EXPECTED[g]} | {ok} |")
    lines.append("")
    for g in ("main", "sub"):
        nm = rep["groups"][g]["non_model"]
        text = ", ".join(f"{k} {n}줄" for k, n in sorted(nm.items())) if nm else "없음"
        lines.append(f"- 모델 아님({GROUP_KO[g]}, 판정에 넣지 않음): {text}")
    for g in ("main", "sub"):
        eff = rep["groups"][g]["effort"]
        text = ", ".join(f"{k} {n}줄" for k, n in sorted(eff.items())) if eff else "없음"
        lines.append(f"- effort 참고({GROUP_KO[g]}): {text}")
    adv = rep["advisor"]
    lines.append(f"- advisor 도구: 호출 {adv['calls']}건, 결과 {adv['results']}건"
                 + (" (보이면 끄기 설정이 듣지 않았다는 신호. 불합격 아님, CTO 보고)" if adv["calls"] or adv["results"] else ""))
    by_agent = rep["groups"]["sub"]["by_agent"]
    if by_agent:
        lines += ["", "| 서브 이름(agentType) | 모델 | 기록 줄 |", "|---|---|---|"]
        for agent, counts in by_agent.items():
            for model, n in sorted(counts.items()):
                lines.append(f"| {agent} | {model} | {n} |")
    if reasons:
        lines += ["", "불합격·판정 불가 이유:"] + [f"- {r}" for r in reasons]
    return "\n".join(lines) + "\n"


def _inside(path, folder):
    try:
        path.relative_to(folder)
        return True
    except ValueError:
        return False


def main(argv=None):
    ap = argparse.ArgumentParser(description="세션 기록의 메인·서브 모델을 세어 합격·불합격을 낸다 (읽기만 함).")
    ap.add_argument("--since", help="YYYY-MM-DD, 이 날 서울 0시 이후 기록만")
    ap.add_argument("--write", help="결과를 이 파일에 저장(저장소 기준 상대 경로 가능, 예: docs/model_audit/20261116.md)")
    ap.add_argument("--projects-dir", help="기록 폴더를 직접 지정(기본: 이 저장소의 기록 폴더)")
    ap.add_argument("--repo", default=str(REPO), help=argparse.SUPPRESS)
    args = ap.parse_args(argv)
    try:
        since_dt = _parse_since(args.since)
    except ValueError:
        print("--since 는 YYYY-MM-DD 모양이어야 합니다 (예: 2026-11-16).")
        return 2
    pdir = Path(args.projects_dir) if args.projects_dir else default_projects_dir(args.repo)
    rep = collect(pdir, since_dt)
    text = render(rep, pdir, args.since)
    print(text, end="")
    if args.write:
        out = Path(args.write)
        if not out.is_absolute():
            out = Path(args.repo) / out
        out = out.resolve()
        forbidden = [pdir.resolve(), (Path(HOME) / ".claude").resolve()]
        if any(_inside(out, f) for f in forbidden):
            print("세션 기록 폴더(~/.claude) 안에는 쓰지 않습니다. 저장하지 않았습니다.")
            return 2
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print(f"저장했습니다: {display_path(out)}")
    v, _ = verdict(rep)
    return {"합격": 0, "불합격": 1}.get(v, 2)


if __name__ == "__main__":
    sys.exit(main())
