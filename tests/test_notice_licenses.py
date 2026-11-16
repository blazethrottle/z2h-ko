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
    # 1편에서 실제로 쓴 위치는 저장소에 있는 파일이어야 한다
    assert "tests/reference_impl/micrograd_ref.py" in notice
    assert os.path.exists(os.path.join(ROOT, "tests", "reference_impl", "micrograd_ref.py"))


def test_reference_impl_has_source_header():
    with open(os.path.join(ROOT, "tests", "reference_impl", "micrograd_ref.py"), encoding="utf-8") as fh:
        first = fh.readline()
    assert first.startswith("# 출처:") and "karpathy/micrograd" in first and "MIT" in first
    with open(os.path.join(ROOT, "z2h_check", "graders", "l01.py"), encoding="utf-8") as fh:
        first = fh.readline()
    assert first.startswith("# 출처:") and "nn-zero-to-hero" in first and "MIT" in first
