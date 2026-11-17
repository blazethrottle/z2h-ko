"""Z2H 노트북 채점 패키지.

    from z2h_check import check, finish
    check("L01-S11b", Value)     # ✓ 맞음: … / ✕ 다시: …
    finish("L01")                # 채점표 + 결과코드 (+ 로컬 진도 서버로 보내기 시도)

런타임 의존은 파이썬 표준 라이브러리뿐이다. torch는 있을 때만 쓴다.
호출 규약은 z2h_check/README.md 를 본다.
"""
__version__ = "0.1.0"

from .core import DEFAULT_SERVER_URL, check, finish, reset, results
from .result_code import ResultCodeError, decode_result_code, encode_result_code

__all__ = [
    "check", "finish", "results", "reset",
    "encode_result_code", "decode_result_code", "ResultCodeError",
    "DEFAULT_SERVER_URL", "__version__",
]
