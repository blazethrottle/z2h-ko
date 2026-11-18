"""L01 편 정보와 _meta."""
from common import CH

LECTURE = {
    "lecture_id": "L01",
    "title_ko": "micrograd: 숫자 상자로 신경망과 역전파를 직접 만들기",
    "video_url": "https://www.youtube.com/watch?v=VMj-3S1tku0",
    "youtube_video_id": "VMj-3S1tku0",
    "video_seconds": 8752,
    "video_minutes": 146,
    "source_repos": ["karpathy/micrograd", "karpathy/nn-zero-to-hero"],
    "env": ["cpu"],
    "objectives": [
        {"objective_id": "L01-O1", "text_ko": "입력을 조금 움직여 기울기를 숫자로 재고, 부호와 크기의 뜻을 말할 수 있다."},
        {"objective_id": "L01-O2", "text_ko": "Value 상자로 계산 그래프(어떤 값이 어떤 계산으로 만들어졌는지의 지도)를 만들고 그림으로 볼 수 있다."},
        {"objective_id": "L01-O3", "text_ko": "연쇄법칙으로 기울기를 손으로 끝에서 앞으로 전달할 수 있다."},
        {"objective_id": "L01-O4", "text_ko": "연산마다 _backward를 쓰고, 위상 정렬(앞 계산이 먼저 오게 줄 세우기)로 backward()를 자동으로 돌리고, += 누적이 필요한 이유를 설명할 수 있다."},
        {"objective_id": "L01-O5", "text_ko": "Neuron, Layer, MLP를 만들고, 손실을 줄이는 학습 반복(앞으로 계산, 기울기 비우기, 뒤로 계산, 조금 고치기)을 돌릴 수 있다."},
        {"objective_id": "L01-O6", "text_ko": "같은 계산을 PyTorch로 해서 기울기가 같은지 대조할 수 있다."},
    ],
    "prereq_units": ["F-P1", "F-P2", "F-P3", "F-P4", "F-P6", "F-P8", "F-M1", "F-M2", "F-M3"],
    "prereq_lectures": [],
    "mastery_rule_id": "default",
    "research_status": "merged",
}

DEFAULT_MASTERY = {
    "mastery_rule_id": "default",
    "steps_complete_ratio": 1.0,
    "question_score_ratio": 0.8,
    "rebuild_max_hint_level": 2,
    "extra_checks": [],
}

CHAPTER_TITLES = {
    1: "intro", 2: "micrograd 개요", 3: "입력 1개 함수의 미분", 4: "입력 여러 개 함수의 미분",
    5: "Value 객체 시작, 시각화(draw_dot)", 6: "손으로 역전파 예제 1: 간단한 식", 7: "최적화 한 단계 미리보기",
    8: "손으로 역전파 예제 2: 뉴런", 9: "연산별 _backward 구현", 10: "그래프 전체 backward() 구현",
    11: "노드를 여러 번 쓸 때의 버그 수정", 12: "tanh 쪼개기, 연산 더 추가", 13: "PyTorch로 같은 일 하기",
    14: "MLP 라이브러리 만들기", 15: "작은 데이터셋, 손실 함수", 16: "파라미터 모으기",
    17: "경사하강법으로 직접 학습", 18: "배운 것 요약, 현대 신경망으로 가는 길", 19: "GitHub의 micrograd 전체 코드 둘러보기",
    20: "PyTorch의 tanh backward 찾아보기", 21: "결론", 22: "NG 장면(outtakes)",
}


def chapter_cover(steps):
    rows = []
    for c in sorted(CH):
        st, en = CH[c]
        ids = [s["step_id"] for s in steps
               if any(g["start_s"] == st and g["end_s"] == en for g in s["video_segments"])]
        rows.append({"chapter": c, "start_s": st, "end_s": en, "title": CHAPTER_TITLES[c], "steps": ids})
    return rows


def meta(steps, questions, rebuilds, hints):
    from meta_text import META_TEXT
    m = dict(META_TEXT)
    m["counts"] = {
        "steps": len(steps),
        "steps_by_kind": {k: sum(1 for s in steps if s["kind"] == k) for k in ("code", "read", "reflect", "optional")},
        "new_code_lines_total": sum(s["new_code_lines"] for s in steps),
        "long_steps": sum(1 for s in steps if s["long_step"]),
        "questions": len(questions),
        "rebuild_tasks": len(rebuilds),
        "hints": len(hints),
    }
    m["chapter_cover"] = chapter_cover(steps)
    # 설계서 3-4 공식(추정, 실측 아님)
    code_steps = sum(1 for s in steps if s["kind"] == "code")
    reads = sum(1 for s in steps if s["kind"] == "read")
    reflects = sum(1 for s in steps if s["kind"] == "reflect")
    video = round(LECTURE["video_minutes"] * 1.2)
    practice = code_steps * 4 + m["counts"]["new_code_lines_total"] + reads * 5 + reflects * 8 + len(questions) * 4 + len(rebuilds) * 25
    m["time_estimate_min"] = {
        "video": video, "practice": practice, "total": video + practice,
        "formula_ko": "영상 146분 x 1.2 + 코드 단계 x 4분 + 새 코드 줄 x 1분 + 읽기 x 5분 + 정리 x 8분 + 문제 x 4분 + 재구성 x 25분(설계서 3-4, 추정)",
    }
    return m
