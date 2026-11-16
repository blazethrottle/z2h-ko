# 출처: 노트북의 코드와 이름 데이터 방식은 Andrej Karpathy의 karpathy/makemore(MIT 라이선스)를 따른다. LICENSE 전문: third_party/licenses/makemore-LICENSE.txt
"""맛보기(첫 30분) Colab 노트북을 교사 정본에서 만든다. 노트북을 손으로 고치지 않는다.

    .venv/bin/python notebooks/taster/build_notebook.py           # taster.ipynb 다시 만들기
    .venv/bin/python notebooks/taster/build_notebook.py --check   # 지금 파일이 최신인지 확인(다르면 종료 코드 1)

입력(읽기만 함)
- 교사 정본 inputs/pedagogy/content/taster.json: 단계 순서·id·제목·안내 글·코드·줄별 풀이. 문구와 코드는 고쳐 쓰지 않고 그대로 옮긴다.

만드는 것: notebooks/taster/taster.ipynb (Colab 용 한 개, 실행 출력 없이 저장)
- 맛보기는 준비된 코드를 복사해 실행만 하는 체험이다. 점수가 없으므로 채점 셀과 z2h_check 를 넣지 않는다
  (완료는 앱에서 학습자가 "직접 확인했어요"로 표시).
- 코드가 있는 단계: 안내 마크다운 + 정본 code 그대로인 코드 셀.
- 정본에 code_alt_local(Colab 밖 대체 셀)이 있는 단계(T-S03): 정본 셀 바로 아래에 "Colab 이 아닌 곳에서는 이 셀을 대신 실행"
  안내와 대체 셀을 둔다. 두 셀을 모두 실행해도 같은 이름 파일을 한 번 더 받을 뿐이다.
- 셀 tags: [단계 id, 종류]. 종류는 intro, guide, step-code, alt-local-guide, alt-local.
"""
import argparse
import json
import os
import sys

import nbformat

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CANON_FILE = os.path.join(ROOT, "inputs", "pedagogy", "content", "taster.json")
NOTEBOOK_FILE = os.path.join(HERE, "taster.ipynb")

SOURCE_LINE = ("출처: 이름 데이터와 방식은 Andrej Karpathy의 makemore(MIT 라이선스)를 따릅니다. "
               "https://github.com/karpathy/makemore")
UNOFFICIAL_LINE = "이 노트북은 비공식 학습 가이드입니다."
SHARE_LINE = ("T-S07 출력(이름 10줄)을 복사해 앱의 맛보기 끝 화면에 붙여 넣으면 이름 카드를 만들 수 있습니다.")


class BuildError(Exception):
    """정본을 노트북으로 옮길 수 없을 때(정본 모양이 바뀐 경우). 정본을 고치지 말고 보고한다."""


# ---- 정본 읽기 -------------------------------------------------------------------

def load_canon(path=CANON_FILE):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def ordered_steps(canon):
    return sorted(canon["steps"], key=lambda s: s["order"])


# ---- 마크다운 만들기 --------------------------------------------------------------

def _inline_code(text):
    tick = "``" if "`" in text else "`"
    pad = " " if "`" in text else ""
    return f"{tick}{pad}{text}{pad}{tick}"


def code_table(code, notes, step_id):
    """줄별 풀이 표. 교사 build_content.py 의 code_table 과 같은 모양(앞 공백은 · 로 보이게)."""
    lines = code.split("\n")
    if len(lines) != len(notes or []):
        raise BuildError(f"{step_id}: 코드 줄 수({len(lines)})와 줄별 풀이 개수({len(notes or [])})가 다릅니다")
    rows = ["| 줄 | 코드 | 풀이 |", "|---|---|---|"]
    for i, (line, note) in enumerate(zip(lines, notes), 1):
        escaped = line.replace("|", "\\|")
        lead = len(escaped) - len(escaped.lstrip(" "))
        rows.append(f"| {i} | {_inline_code('·' * lead + escaped.lstrip(' '))} | {note} |")
    return "\n".join(rows)


def intro_markdown(canon):
    return "\n".join([
        f"# {canon['lecture']['title_ko']}",
        "",
        "위에서부터 코드 셀을 한 칸씩 실행하세요(셀을 누르고 Shift+Enter). 준비된 코드를 그대로 실행만 하면 되고, 새로 칠 코드는 없습니다.",
        "",
        SOURCE_LINE,
        "",
        UNOFFICIAL_LINE,
        "",
        "- 이름 데이터 names.txt는 이 노트북에 들어 있지 않고, T-S03 셀을 실행할 때 makemore 저장소에서 내려받습니다.",
        "- Colab에서 런타임(실행 환경)을 다시 시작했다면 T-S03 셀부터 차례로 다시 실행합니다.",
    ])


def guide_markdown(st, is_last):
    sid = st["step_id"]
    out = [f"## {sid} {st['title_ko']}", "", f"**할 일**: {st['input_ko']}"]
    if st.get("code"):
        out += ["", "**줄별 풀이**", "", code_table(st["code"], st.get("code_line_notes_ko"), sid)]
    if st.get("summary_ko"):
        out += ["", f"**정리**: {st['summary_ko']}"]
    out += ["", f"**보여야 하는 것**: {st['expected_ko']}"]
    if st.get("aha_ko"):
        out += ["", f"**깨달음**: {st['aha_ko']}"]
    if st.get("meaning_ko") and st.get("meaning_ko") != st.get("aha_ko"):
        out += ["", f"**뜻**: {st['meaning_ko']}"]
    if is_last:
        out += ["", f"**이름 카드 만들기**: {SHARE_LINE}"]
    return "\n".join(out)


def alt_local_markdown(st):
    sid = st["step_id"]
    return "\n".join([
        f"### {sid} Colab이 아닌 곳에서는 이 셀을 대신 실행",
        "",
        "내 컴퓨터의 Jupyter처럼 Colab이 아닌 곳에서는 위 셀의 `!wget`(파일 내려받기 명령)이 없어서 "
        "`FileNotFoundError`가 날 수 있습니다. 그때는 아래 셀을 대신 실행하세요. 파이썬만으로 같은 이름 파일을 내려받습니다.",
        "",
        "Colab에서 위 셀이 잘 됐다면 건너뛰어도 됩니다. 두 셀을 모두 실행해도 같은 파일을 한 번 더 받을 뿐이라 괜찮습니다.",
        "",
        "**줄별 풀이**",
        "",
        code_table(st["code_alt_local"], st.get("code_alt_local_line_notes_ko"), f"{sid} 대체 셀"),
    ])


# ---- 노트북 만들기 --------------------------------------------------------------

def _cell_id(index, step_id, kind):
    return f"c{index:03d}-{(step_id or 'top').lower()}-{kind}"[:64]


class _Builder:
    def __init__(self):
        self.cells = []

    def _add(self, cell, step_id, kind):
        cell.metadata["tags"] = [t for t in (step_id, kind) if t]
        self.cells.append(cell)

    def md(self, step_id, kind, text):
        self._add(nbformat.v4.new_markdown_cell(text, id=_cell_id(len(self.cells), step_id, kind)), step_id, kind)

    def code(self, step_id, kind, source):
        self._add(nbformat.v4.new_code_cell(source, id=_cell_id(len(self.cells), step_id, kind)), step_id, kind)


def _metadata(canon):
    return {
        "kernelspec": {"display_name": "Python 3 (ipykernel)", "language": "python", "name": "python3"},
        "language_info": {"name": "python"},
        "z2h": {
            "lecture_id": canon["lecture"]["lecture_id"],
            "notebook": "taster",
            "canon": "inputs/pedagogy/content/taster.json",
            "canon_version": canon.get("_meta", {}).get("version"),
            "generated_by": "notebooks/taster/build_notebook.py",
        },
    }


def build(canon=None):
    canon = canon or load_canon()
    steps = ordered_steps(canon)
    if not steps:
        raise BuildError("정본에 단계가 없습니다")
    b = _Builder()
    b.md(None, "intro", intro_markdown(canon))
    for i, st in enumerate(steps):
        sid = st["step_id"]
        b.md(sid, "guide", guide_markdown(st, is_last=(i == len(steps) - 1)))
        if st.get("code"):
            b.code(sid, "step-code", st["code"])
        if st.get("code_alt_local"):
            if not st.get("code"):
                raise BuildError(f"{sid}: 대체 셀(code_alt_local)만 있고 정본 셀(code)이 없습니다")
            b.md(sid, "alt-local-guide", alt_local_markdown(st))
            b.code(sid, "alt-local", st["code_alt_local"])
    nb = nbformat.v4.new_notebook(cells=b.cells, metadata=_metadata(canon))
    nbformat.validate(nb)
    return nb


def serialize(nb):
    return nbformat.writes(nb) + "\n"


def outputs():
    return {NOTEBOOK_FILE: serialize(build())}


def main(argv=None):
    parser = argparse.ArgumentParser(description="맛보기 Colab 노트북을 교사 정본에서 만든다.")
    parser.add_argument("--check", action="store_true", help="지금 노트북 파일이 최신인지 확인")
    args = parser.parse_args(argv)
    try:
        files = outputs()
    except BuildError as exc:
        print(f"만들지 못했습니다: {exc}")
        return 2
    if args.check:
        stale = []
        for path, text in files.items():
            try:
                with open(path, encoding="utf-8") as fh:
                    current = fh.read()
            except OSError:
                current = None
            if current != text:
                stale.append(os.path.basename(path))
        if stale:
            print("최신이 아닙니다: " + ", ".join(stale) + ". build_notebook.py 를 다시 실행하세요.")
            return 1
        print("맛보기 노트북이 최신입니다.")
        return 0
    for path, text in files.items():
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        print(f"저장했습니다: {os.path.relpath(path, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
