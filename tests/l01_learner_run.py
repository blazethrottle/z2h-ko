"""학생 노트북을 학생처럼 실행한다(nbclient, 진짜 Jupyter 커널 하나).

    python tests/l01_learner_run.py 입력.ipynb 행동.json 출력.ipynb 작업폴더

행동.json: [["run", 셀 번호] | ["set", 셀 번호, 새 소스], ...] (l01_helpers.learner_actions 가 정본에서 만든다).
셀 소스를 바꾸고(빈 셀 채우기, 앞 셀 고치기), 같은 커널에서 셀을 고른 순서대로 실행한다(다시 실행 포함).
셀에서 오류가 나면 바로 멈추고 종료 코드 1.
"""
import json
import sys

import nbformat
from nbclient import NotebookClient
from nbclient.exceptions import CellExecutionError


def main(nb_in, actions_file, nb_out, workdir):
    nb = nbformat.read(nb_in, as_version=4)
    with open(actions_file, encoding="utf-8") as fh:
        actions = json.load(fh)
    client = NotebookClient(nb, kernel_name="python3", timeout=600, allow_errors=False,
                            resources={"metadata": {"path": workdir}})
    code = 0
    with client.setup_kernel():
        try:
            for act in actions:
                if act[0] == "set":
                    nb.cells[act[1]].source = act[2]
                else:
                    client.execute_cell(nb.cells[act[1]], act[1])
        except CellExecutionError as exc:
            print(str(exc)[-3000:], file=sys.stderr)
            code = 1
    nbformat.write(nb, nb_out)
    return code


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:5]))
