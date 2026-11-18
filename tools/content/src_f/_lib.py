# 기초 탭 조각 파일이 함께 쓰는 작은 도우미. build_f.py가 이 꼴을 data-spec 형식으로 바꾼다.


def h1(text):
    return {"level": 1, "text_ko": text}


def h2(text, unit=None, card=None, step=None):
    d = {"level": 2, "text_ko": text}
    pt = {}
    if unit:
        pt["unit_id"] = unit
    if card:
        pt["card_line"] = card
    if step:
        pt["step_id"] = step
    if pt:
        d["points_to"] = pt
    return d


def h3(text, code=None, blanks=None, out=None):
    return {
        "level": 3,
        "text_ko": text,
        "code_with_blanks": code,
        "blank_answers": blanks or [],
        "blank_filled_output": out,
    }


def h4(text):
    return {"level": 4, "text_ko": text, "show_solution": True}
