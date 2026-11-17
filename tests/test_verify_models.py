"""tests/verify_models.py 단위 테스트 (작은 가짜 세션 기록으로)."""
import json
import os

import pytest

import verify_models as vm


def _line(kind="assistant", model="claude-fable-5-2", mid="m1", ts="2026-11-16T11:00:00.000Z",
          sidechain=False, effort="medium", content=None):
    if kind == "assistant":
        return {"type": "assistant", "isSidechain": sidechain, "timestamp": ts, "effort": effort,
                "message": {"id": mid, "role": "assistant", "model": model,
                            "content": content if content is not None else [{"type": "text", "text": "비밀 대화 내용"}]}}
    return {"type": kind, "timestamp": ts, "message": {"role": "user", "content": content or "사용자 글"}}


def _write(path, rows, bad_line=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
        if bad_line:
            fh.write("{깨진 줄\n")


@pytest.fixture
def proj(tmp_path):
    d = tmp_path / "-Users-someone-repo"
    _write(d / "s1.jsonl", [
        _line("user"),
        _line(mid="m1"), _line(mid="m1"),  # 같은 응답이 줄 2개로 나뉜 경우
        _line(mid="m2", content=[{"type": "tool_use", "id": "t1", "name": "advisor", "input": {}}]),
        _line(model="<synthetic>", mid="m3"),
        _line("user", content=[{"type": "tool_result", "tool_use_id": "t1", "content": "조언"}]),
    ], bad_line=True)
    _write(d / "s1" / "subagents" / "agent-a1.jsonl", [
        _line(model="claude-opus-5-5", mid="s1", sidechain=True, effort="xhigh"),
        _line(model="claude-opus-5-5", mid="s2", sidechain=True, effort="xhigh"),
    ])
    (d / "s1" / "subagents" / "agent-a1.meta.json").write_text(json.dumps({"agentType": "z2h-builder"}), encoding="utf-8")
    (d / "s1" / "tool-results").mkdir()
    (d / "s1" / "tool-results" / "x.txt").write_text("무시", encoding="utf-8")
    return d


def test_project_dir_name_rule():
    # 실제 폴더 이름에서 확인한 규칙: 영문·숫자 밖의 글자는 모두 '-'
    assert vm.project_dir_name("/Users/a/MonkeyHub/repos/z2h-ko") == "-Users-a-MonkeyHub-repos-z2h-ko"
    assert vm.project_dir_name("/Users/a/.claude/x_y~z") == "-Users-a--claude-x-y-z"


def test_counts_and_pass(proj):
    rep = vm.collect(proj)
    assert rep["files"] == {"main": 1, "sub": 1}
    main, sub = rep["groups"]["main"], rep["groups"]["sub"]
    assert main["models"]["claude-fable-5-2"] == {"lines": 3, "messages": 2}
    assert main["non_model"] == {"<synthetic>": 1}
    assert sub["models"]["claude-opus-5-5"] == {"lines": 2, "messages": 2}
    assert sub["by_agent"] == {"z2h-builder": {"claude-opus-5-5": 2}}
    assert main["effort"] == {"medium": 4} and sub["effort"] == {"xhigh": 2}
    assert rep["advisor"] == {"calls": 1, "results": 1}
    assert rep["bad_lines"] == 1
    v, reasons = vm.verdict(rep)
    assert v == "합격", reasons


def test_wrong_model_fails(proj):
    _write(proj / "s1" / "subagents" / "agent-b2.jsonl", [_line(model="claude-sonnet-5-5", mid="z", sidechain=True)])
    _write(proj / "s2.jsonl", [_line(model="claude-opus-5-5", mid="q")])
    rep = vm.collect(proj)
    v, reasons = vm.verdict(rep)
    assert v == "불합격"
    text = " ".join(reasons)
    assert "claude-sonnet-5-5" in text and "claude-opus-5-5" in text


def test_sidechain_lines_in_main_file_count_as_sub(proj):
    _write(proj / "s3.jsonl", [_line(model="claude-opus-5-5", mid="k", sidechain=True)])
    rep = vm.collect(proj)
    assert rep["groups"]["sub"]["models"]["claude-opus-5-5"]["lines"] == 3
    assert vm.verdict(rep)[0] == "합격"


def test_since_filters_by_kst_date(proj):
    _write(proj / "old.jsonl", [_line(model="claude-sonnet-5-5", mid="o", ts="2026-11-14T14:59:59.000Z")])
    # 2026-11-14T14:59:59Z = 11/14 23:59:59 KST -> --since 2026-11-15 이면 빠짐
    rep = vm.collect(proj, since="2026-11-15")
    assert vm.verdict(rep)[0] == "합격"
    rep = vm.collect(proj, since="2026-11-14")
    assert vm.verdict(rep)[0] == "불합격"
    _write(proj / "nots.jsonl", [{"type": "assistant", "message": {"id": "n", "model": "claude-fable-5-2"}}])
    rep = vm.collect(proj, since="2026-11-15")
    assert rep["skipped_no_time"] == 1


def test_empty_or_missing_dir(tmp_path):
    rep = vm.collect(tmp_path / "없음")
    assert vm.verdict(rep)[0] == "판정 불가"


def test_render_has_no_private_text(proj, monkeypatch):
    monkeypatch.setattr(vm, "HOME", "/Users/someone")
    rep = vm.collect(proj)
    text = vm.render(rep, projects_dir=proj, since=None)
    assert "비밀 대화 내용" not in text and "사용자 글" not in text and "조언" not in text
    assert "someone" not in text
    assert "| 메인 |" in text and "claude-fable-5-2" in text and "합격" in text
    assert chr(0x2014) not in text


def test_cli_is_read_only_and_writes_only_where_asked(proj, tmp_path, capsys):
    before = sorted((str(p), p.stat().st_mtime_ns) for p in proj.rglob("*"))
    out_file = tmp_path / "audit" / "20261116.md"
    code = vm.main(["--projects-dir", str(proj), "--write", str(out_file)])
    assert code == 0
    after = sorted((str(p), p.stat().st_mtime_ns) for p in proj.rglob("*"))
    assert before == after
    assert out_file.exists() and "claude-opus-5-5" in out_file.read_text(encoding="utf-8")
    assert "합격" in capsys.readouterr().out
    # 기록 폴더 안에는 쓰지 않는다
    assert vm.main(["--projects-dir", str(proj), "--write", str(proj / "x.md")]) == 2
    assert not (proj / "x.md").exists()


def test_cli_exit_codes(proj, tmp_path):
    assert vm.main(["--projects-dir", str(proj)]) == 0
    _write(proj / "bad.jsonl", [_line(model="claude-haiku-5-5", mid="h")])
    assert vm.main(["--projects-dir", str(proj)]) == 1
    assert vm.main(["--projects-dir", str(tmp_path / "없음")]) == 2
    assert vm.main(["--projects-dir", str(proj), "--since", "2026/11/16"]) == 2
