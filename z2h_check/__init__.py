"""Z2H 노트북 채점 패키지.

    from z2h_check import check, finish
    check("L01-S02", globals())  # ✓ 맞음: … / ✕ 다시: … / ○ 아직: …
    finish("L01")                # 채점표 + 결과코드 (+ 로컬 진도 서버로 보내기 시도)

런타임 의존은 파이썬 표준 라이브러리뿐이다. IPython(Jupyter, Colab) 안에서 불러오면 셀 실행 기록(runs)을 켠다.
호출 규약은 z2h_check/README.md 를 본다.
"""
__version__ = "0.2.0"

from . import runs
from .core import DEFAULT_SERVER_URL, check, finish, reset, results
from .result_code import ResultCodeError, decode_result_code, encode_result_code

runs.watch()  # 채점 셀이 '바로 위 셀이 보인 것'을 읽을 수 있게(IPython 이 아니면 아무것도 하지 않음)

__all__ = [
    "check", "finish", "results", "reset",
    "encode_result_code", "decode_result_code", "ResultCodeError",
    "DEFAULT_SERVER_URL", "__version__",
]
