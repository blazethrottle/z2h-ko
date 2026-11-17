"""정답 구현으로 재구성 L01-R3 이 통과하는 비율을 잰다(시험이 아니라 측정. notebooks/ep01-micrograd/README.md 실측 표).

    .venv/bin/python tests/l01_measure_r3.py 500

정답 노트북 본문(재구성 구역 앞)을 파이썬 안에서 돌린 상태에서, 정본 R3 정답 코드의 random.seed(1337) 를
random.seed(0) ~ random.seed(N-1) 로 바꿔 돌리고, 정본 확인 셀 기준(마지막 손실 < 3.0, 채점기 그대로)으로 통과를 센다.
"""
import contextlib
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.dirname(HERE), HERE]
os.environ.setdefault("MPLBACKEND", "Agg")

import l01_helpers as H  # noqa: E402
from z2h_check import check, reset  # noqa: E402

CANON_SEED = "random.seed(1337)"


def main(count):
    cells = H.solution_cells()
    start = next(i for i, c in enumerate(cells) if "rebuild-start" in H.tags(c))
    with contextlib.redirect_stdout(io.StringIO()):
        body = H.run_notebook_cells(cells[:start], check)
    solution = H.B.rebuild_work_source(H.CANON, "L01-R3")
    if CANON_SEED not in solution:
        raise SystemExit(f"정본 R3 정답 코드에 {CANON_SEED} 가 없습니다")
    passed, losses = [], []
    for seed in range(count):
        ns = {k: v for k, v in body.items() if k != "loss"}
        with contextlib.redirect_stdout(io.StringIO()):
            exec(solution.replace(CANON_SEED, f"random.seed({seed})"), ns)  # 정본 정답 코드, 시드만 바꿈
            reset()
            ok = check("L01-R3", ns)
        passed.append(ok)
        losses.append(ns["loss"].data)
    fails = [(seed, round(loss, 3)) for seed, (ok, loss) in enumerate(zip(passed, losses)) if not ok]
    print(json.dumps({"seeds": count, "passed": sum(passed), "rate": sum(passed) / count,
                      "median_loss": round(sorted(losses)[count // 2], 4), "fails": fails}, ensure_ascii=False))


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 200)
