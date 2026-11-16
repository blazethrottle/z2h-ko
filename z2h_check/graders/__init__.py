"""편별 채점 함수 모음. 지금은 1편(L01)만 있다."""
from . import l01

_LECTURES = {"L01": l01}


def canonical_lecture(lecture_id):
    """'l01', ' L01 ' -> 'L01'. 모르는 편이면 None."""
    if not isinstance(lecture_id, str):
        return None
    key = lecture_id.strip().upper()
    return key if key in _LECTURES else None


def lecture_checks(lecture_id):
    """[(check_id, 제목)] 교사 자료 순서. 모르는 편이면 []."""
    lid = canonical_lecture(lecture_id)
    return list(_LECTURES[lid].CHECKS) if lid else []


def canonical_id(check_id):
    """대소문자를 봐주고 정식 check_id 를 돌려준다 ('l01-s11b' -> 'L01-S11b'). 모르면 None."""
    if not isinstance(check_id, str):
        return None
    key = check_id.strip().lower()
    for mod in _LECTURES.values():
        for cid, _title in mod.CHECKS:
            if cid.lower() == key:
                return cid
    return None


def _module_of(check_id):
    return _LECTURES[check_id.split("-", 1)[0]]


def get_grader(check_id):
    return _module_of(check_id).GRADERS[check_id]


def usage_of(check_id):
    return _module_of(check_id).USAGE[check_id]


def title_of(check_id):
    return dict(_module_of(check_id).CHECKS)[check_id]
