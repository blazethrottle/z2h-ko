"""third_party/licenses/ 의 MIT 원문 5개와 NOTICE.md 표 검사 (PUBLIC_RELEASE_CHECKLIST 2절)."""
import hashlib
import os

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIC = os.path.join(ROOT, "third_party", "licenses")

# 2026-11-16 GitHub API(repos/karpathy/<repo>/contents/LICENSE)의 git blob sha. 원문을 한 글자라도 고치면 달라진다.
EXPECTED = {
    "micrograd": ("3d89960112452062baf36bb13d43a92028fc0f0e", "Copyright (c) 2020 Andrej Karpathy"),
    "makemore": ("329db5e33310fd5d98343e2bca690bfb07317526", "Copyright (c) 2022 Andrej Karpathy"),
    "nn-zero-to-hero": ("329db5e33310fd5d98343e2bca690bfb07317526", "Copyright (c) 2022 Andrej Karpathy"),
    "nanoGPT": ("329db5e33310fd5d98343e2bca690bfb07317526", "Copyright (c) 2022 Andrej Karpathy"),
    "minbpe": ("f9d8555cce21590a0db7eb4999d9eb72428a8ae3", "Copyright (c) 2024 Andrej"),
}


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


@pytest.mark.parametrize("repo", sorted(EXPECTED))
def test_license_text_is_byte_identical(repo):
    path = os.path.join(LIC, f"{repo}-LICENSE.txt")
    with open(path, "rb") as fh:
        data = fh.read()
    sha, copyright_line = EXPECTED[repo]
    assert git_blob_sha(data) == sha
    text = data.decode("utf-8")
    assert "MIT License" in text and copyright_line in text


def test_notice_table():
    with open(os.path.join(ROOT, "NOTICE.md"), encoding="utf-8") as fh:
        notice = fh.read()
    for repo, (_sha, copyright_line) in EXPECTED.items():
        assert f"karpathy/{repo}" in notice
        assert f"third_party/licenses/{repo}-LICENSE.txt" in notice
        assert copyright_line.replace("Copyright (c) ", "") in notice
    assert "build-nanogpt" in notice and "링크만" in notice
    assert "Pretendard" in notice and "JetBrains Mono" in notice
    assert chr(0x2014) not in notice
    # 1편에서 실제로 쓴 위치는 저장소에 있는 파일이어야 하고, 지운 교사 파일은 가리키지 않는다
    for path in ("notebooks/ep01-micrograd/", "z2h_check/reference/l01.json", "z2h_check/_bundle.py",
                 "inputs/pedagogy/content/L01.json"):
        assert path in notice, path
        assert os.path.exists(os.path.join(ROOT, *path.strip("/").split("/"))), path
    for gone in ("tests/reference_impl", "l01_source.py", "l01_extra.py", "build_content.py", "test_content.py"):
        assert gone not in notice, gone


def _first_line(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as fh:
        return fh.readline()


def test_source_lines_where_lecture_code_or_numbers_are_used():
    first = _first_line("z2h_check", "graders", "l01.py")
    assert first.startswith("# 출처:") and "nn-zero-to-hero" in first and "micrograd" in first and "MIT" in first
    head = "".join(open(os.path.join(ROOT, "z2h_check", "_bundle.py"), encoding="utf-8").readlines()[:6])
    assert "출처" in head and "nn-zero-to-hero" in head and "micrograd" in head and "MIT" in head
    import json
    ref = json.load(open(os.path.join(ROOT, "z2h_check", "reference", "l01.json"), encoding="utf-8"))
    assert "nn-zero-to-hero" in ref["_출처"] and "micrograd" in ref["_출처"] and "MIT" in ref["_출처"]
    for name in ("ep01_solution.ipynb", "ep01_student.ipynb"):
        nb = json.load(open(os.path.join(ROOT, "notebooks", "ep01-micrograd", name), encoding="utf-8"))
        intro = "".join(nb["cells"][0]["source"])
        assert "출처" in intro and "karpathy/micrograd" in intro and "karpathy/nn-zero-to-hero" in intro and "MIT" in intro
