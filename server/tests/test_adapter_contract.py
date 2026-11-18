"""StorageAdapter 공통 테스트 묶음.

`adapter` fixture(conftest.py)로만 저장소에 접근한다. 같은 묶음을 SqliteAdapter와
나중의 PostgresAdapter에 그대로 돌리는 것이 목적이다. 계정은 테스트마다 만든다(user, other_user).
"""

from __future__ import annotations

import inspect
import uuid

import pytest
import sqlalchemy as sa

from helpers import aid, new_user, op, t
from z2h_server.storage.base import StorageAdapter

# ---------- 인터페이스 모양 ----------


def test_every_data_method_takes_user_id_first():
    assert StorageAdapter.USER_DATA_METHODS
    for name in StorageAdapter.USER_DATA_METHODS:
        params = list(inspect.signature(getattr(StorageAdapter, name)).parameters)
        assert params[:2] == ["self", "user_id"], f"{name}: {params}"


def test_adapter_is_a_storage_adapter(adapter):
    assert isinstance(adapter, StorageAdapter)
    assert adapter.ping() is True
    assert adapter.schema_version() == "0002"


# ---------- 계정 ----------


def test_new_database_has_no_users(adapter):
    with adapter.engine.connect() as conn:
        assert conn.execute(sa.text("SELECT COUNT(*) FROM users")).scalar_one() == 0


def test_create_and_update_user_with_path_id(adapter):
    uid = new_user(adapter, "회사원")
    user = adapter.get_user(uid)
    assert user["path_id"] == "full" and user["display_name"] == "회사원"
    assert user["created_at"].endswith("+09:00")
    assert adapter.update_user(uid, path_id="office_worker")["path_id"] == "office_worker"
    with pytest.raises(ValueError):
        adapter.update_user(uid, path_id="ceo")
    with pytest.raises(ValueError):
        adapter.update_user(uid, created_at="2000-01-01T00:00:00+09:00")
    assert adapter.get_user(str(uuid.uuid4())) is None


def test_sessions_and_identities(adapter, user):
    adapter.add_identity(user, "dev_local", user)
    assert [u["user_id"] for u in adapter.list_users("dev_local")] == [user]
    assert adapter.list_users("google") == []
    adapter.create_session(user, "h" * 64, "2999-01-01T00:00:00+09:00")
    assert adapter.find_session("h" * 64) == user
    adapter.create_session(user, "old" + "x" * 61, "2000-01-01T00:00:00+09:00")
    assert adapter.find_session("old" + "x" * 61) is None  # 지난 세션
    adapter.delete_session("h" * 64)
    assert adapter.find_session("h" * 64) is None


def test_foreign_key_violation_is_refused(adapter):
    ghost = str(uuid.uuid4())  # users 에 없는 계정
    res = adapter.apply_ops(ghost, "pc", [op("g1", "user_pref", {"pref_key": "run_place"}, {"value": "colab"}, t("20:00:00"))])
    assert res.applied == [] and len(res.rejected) == 1
    assert "없는 계정" in res.rejected[0]["reason_ko"]
    with pytest.raises(sa.exc.IntegrityError):
        adapter.create_session(ghost, "z" * 64, "2999-01-01T00:00:00+09:00")
    with pytest.raises(sa.exc.IntegrityError):
        adapter.add_identity(ghost, "dev_local", ghost)


def test_deleting_a_user_removes_their_records(adapter, user, other_user):
    """users FK 는 ON DELETE CASCADE(5절)."""
    for uid in (user, other_user):
        adapter.apply_ops(uid, "pc", [op(f"{uid}-1", "step_progress", {"step_id": "L01-S01"}, {"status": "done"}, t("20:00:00"))])
    with adapter.engine.begin() as conn:
        conn.execute(sa.text("DELETE FROM users WHERE user_id = :u"), {"u": user})
    assert adapter.list_rows(user, "step_progress") == []
    assert len(adapter.list_rows(other_user, "step_progress")) == 1


def test_two_accounts_never_see_each_other(adapter, user, other_user):
    key = {"pref_key": "run_place"}
    adapter.apply_ops(user, "pc", [op("a1", "user_pref", key, {"value": "colab"}, t("20:00:00"))])
    adapter.apply_ops(other_user, "pc", [op("b1", "user_pref", key, {"value": "local"}, t("19:00:00"))])
    adapter.apply_ops(other_user, "pc", [op("b2", "step_progress", {"step_id": "L01-S03"}, {"status": "done"}, t("19:00:00"))])
    assert adapter.get_row(user, "user_pref", key)["value"] == "colab"
    assert adapter.get_row(other_user, "user_pref", key)["value"] == "local"
    mine = adapter.get_state(user)
    assert [r["value"] for r in mine["tables"]["user_pref"]] == ["colab"]
    assert mine["tables"]["step_progress"] == []
    assert mine["user"]["user_id"] == user
    exported = adapter.export_all(user)
    assert exported["user_id"] == user
    assert all(r.get("value") != "local" for r in exported["tables"]["user_pref"])
    assert adapter.list_conflicts(user) == [] and adapter.list_conflicts(other_user) == []


def test_op_id_used_by_another_account_is_rejected(adapter, user, other_user):
    adapter.apply_ops(user, "pc", [op("same-op", "user_pref", {"pref_key": "run_place"}, {"value": "colab"}, t("20:00:00"))])
    res = adapter.apply_ops(other_user, "pc", [op("same-op", "user_pref", {"pref_key": "run_place"}, {"value": "x"}, t("20:00:00"))])
    assert res.rejected and "다른 계정" in res.rejected[0]["reason_ko"]
    assert adapter.get_row(other_user, "user_pref", {"pref_key": "run_place"}) is None


# ---------- 기본 저장·조회 ----------


def test_step_progress_insert_and_read_back(adapter, user):
    res = adapter.apply_ops(
        user,
        "phone",
        [
            op(
                "o1",
                "step_progress",
                {"step_id": "L01-S14b"},
                {
                    "status": "in_progress",
                    "started_at": t("20:01:00"),
                    "max_hint_level": 1,
                    "attempts": 2,
                    "active_seconds_auto": 125,
                    "active_seconds_user": 300,
                    "prediction": "기울기가 2.0",
                    "content_version": "ep01-2026-11-16",
                },
                t("20:05:00"),
            )
        ],
    )
    assert res.applied == ["o1"] and res.superseded == [] and res.rejected == []
    assert res.server_time.endswith("+09:00")
    row = adapter.get_row(user, "step_progress", {"step_id": "L01-S14b"})
    assert row["step_id"] == "L01-S14b"
    assert row["path_id"] == "full"
    assert row["status"] == "in_progress"
    assert row["active_seconds_auto"] == 125 and row["active_seconds_user"] == 300
    assert row["prediction"] == "기울기가 2.0"
    assert row["content_version"] == "ep01-2026-11-16"
    assert row["updated_at"] == t("20:05:00")
    assert isinstance(row["server_seq"], int) and row["server_seq"] >= 1
    assert "user_id" not in row and "last_client_id" not in row


def test_new_step_progress_row_gets_defaults(adapter, user):
    adapter.apply_ops(user, "pc", [op("o1", "step_progress", {"step_id": "L01-S01"}, {}, t("20:00:00"))])
    row = adapter.get_row(user, "step_progress", {"step_id": "L01-S01"})
    assert (row["status"], row["max_hint_level"], row["attempts"], row["active_seconds_auto"]) == ("not_started", 0, 0, 0)
    assert row["active_seconds_user"] is None and row["path_id"] == "full"


def test_practice_time_auto_and_user_are_both_kept_and_user_value_can_be_cleared(adapter, user):
    key = {"step_id": "L01-S04"}
    adapter.apply_ops(user, "pc", [op("a", "step_progress", key, {"active_seconds_auto": 600}, t("20:00:00"))])
    adapter.apply_ops(user, "pc", [op("b", "step_progress", key, {"active_seconds_user": 900}, t("20:01:00"))])
    row = adapter.get_row(user, "step_progress", key)
    assert (row["active_seconds_auto"], row["active_seconds_user"]) == (600, 900)
    adapter.apply_ops(user, "pc", [op("c", "step_progress", key, {"active_seconds_user": None}, t("20:02:00"))])
    row = adapter.get_row(user, "step_progress", key)
    assert (row["active_seconds_auto"], row["active_seconds_user"]) == (600, None)


def test_practice_week_pref_saved_and_reverted_to_auto(adapter, user):
    """홈 주간 카드에서 고친 실습 시간: practice_week:{주 시작일} = {edited_seconds, edited_at}. 지우면 자동으로."""
    key = {"pref_key": "practice_week:2026-11-16"}
    adapter.apply_ops(user, "pc", [op("w1", "user_pref", key, {"value": {"edited_seconds": 9000, "edited_at": "2026-11-20T12:00:00Z"}}, t("21:00:00"))])
    assert adapter.get_row(user, "user_pref", key)["value"] == {"edited_seconds": 9000, "edited_at": t("21:00:00")}
    adapter.apply_ops(user, "pc", [op("w2", "user_pref", key, {"value": None}, t("21:05:00"))])
    assert adapter.get_row(user, "user_pref", key)["value"] is None


def test_pref_keys_are_limited_to_the_p1_list(adapter, user):
    ok = adapter.apply_ops(
        user,
        "pc",
        [
            op("k1", "user_pref", {"pref_key": "run_place"}, {"value": "colab"}, t("20:00:00")),
            op("k2", "user_pref", {"pref_key": "resume"}, {"value": {"step_id": "L01-S04", "part": "follow"}}, t("20:00:00")),
        ],
    )
    assert ok.applied == ["k1", "k2"]
    bad = adapter.apply_ops(
        user,
        "pc",
        [
            op("k3", "user_pref", {"pref_key": "practice_time_user:2026-11-16"}, {"value": 1}, t("20:00:00")),
            op("k4", "user_pref", {"pref_key": "practice_week:2026-11-16"}, {"value": {"active_seconds_user": 1}}, t("20:00:00")),
        ],
    )
    assert [r["op_id"] for r in bad.rejected] == ["k3", "k4"]


def test_legacy_progress_archive_pref_is_kept_as_is(adapter, user):
    """옛 1편(1.2판) 진도 보관본(app/src/lib/migrate): user_pref legacy_progress:L01:1.2 에 옛 행을 JSON 그대로 둔다. 다른 꼴의 열쇠는 여전히 거절."""
    key = {"pref_key": "legacy_progress:L01:1.2"}
    archive = {
        "format": 1,
        "lecture_id": "L01",
        "from_version": "1.2",
        "to_version": "claude-1.0",
        "archived_at": t("20:00:00"),
        "applied_at": None,
        "rows": {"step_progress": [{"step_id": "L01-S09b", "status": "done", "content_version": "auto-6256adb2ec11"}], "grade_result": []},
    }
    res = adapter.apply_ops(user, "pc", [op("a1", "user_pref", key, {"value": archive}, t("20:00:00"))])
    assert res.applied == ["a1"]
    assert adapter.get_row(user, "user_pref", key)["value"] == archive
    bad = adapter.apply_ops(
        user,
        "pc",
        [
            op("a2", "user_pref", {"pref_key": "legacy_progress:anything"}, {"value": 1}, t("20:00:00")),
            op("a3", "user_pref", {"pref_key": "legacy_progress:L01:"}, {"value": 1}, t("20:00:00")),
        ],
    )
    assert [r["op_id"] for r in bad.rejected] == ["a2", "a3"]


def test_keys_with_trailing_newline_are_rejected(adapter, user):
    """열쇠 검사는 글 전체가 규칙과 맞아야 한다(정규식 $ 는 끝 줄바꿈 앞에서도 맞으므로 fullmatch). 기존 열쇠는 그대로 받는다."""
    bad = adapter.apply_ops(
        user,
        "pc",
        [
            op("n1", "user_pref", {"pref_key": "resume\n"}, {"value": 1}, t("20:00:00")),
            op("n2", "user_pref", {"pref_key": "legacy_progress:L01:1.2\n"}, {"value": 1}, t("20:00:00")),
            op("n3", "step_progress", {"step_id": "L01-S01\n"}, {"status": "done"}, t("20:00:00")),
        ],
    )
    assert [r["op_id"] for r in bad.rejected] == ["n1", "n2", "n3"]
    ok = adapter.apply_ops(
        user,
        "pc",
        [
            op("o1", "user_pref", {"pref_key": "resume"}, {"value": 1}, t("20:00:00")),
            op("o2", "user_pref", {"pref_key": "practice_week:2026-11-16"}, {"value": None}, t("20:00:00")),
            op("o3", "user_pref", {"pref_key": "legacy_progress:L01:1.2"}, {"value": {}}, t("20:00:00")),
            op("o4", "step_progress", {"step_id": "L01-S01"}, {"status": "done"}, t("20:00:00")),
        ],
    )
    assert ok.applied == ["o1", "o2", "o3", "o4"]


def test_times_are_normalized_to_kst(adapter, user):
    adapter.apply_ops(
        user,
        "pc",
        [op("o1", "step_progress", {"step_id": "L01-S02"}, {"started_at": "2026-11-20T11:00:00Z"}, "2026-11-20T11:00:05Z")],
    )
    row = adapter.get_row(user, "step_progress", {"step_id": "L01-S02"})
    assert row["started_at"] == "2026-11-20T20:00:00+09:00"
    assert row["updated_at"] == "2026-11-20T20:00:05+09:00"


def test_json_columns_by_data_spec_name_or_as_json_text(adapter, user):
    nid = aid()
    res = adapter.apply_ops(
        user,
        "pc",
        [
            op("h1", "help_note", {"note_id": nid}, {"target_id": "L01-S12", "env": {"device": "colab"}, "hints_seen": [1, 2]}, t("20:00:00")),
            op("h2", "review_card", {"card_id": "RC-L01-Q06-1"}, {"history_json": '[{"at": "2026-11-21T08:00:00+09:00", "result": "pass"}]'}, t("20:00:00")),
        ],
    )
    assert res.applied == ["h1", "h2"]
    note = adapter.get_row(user, "help_note", {"note_id": nid})
    assert note["env"] == {"device": "colab"} and note["hints_seen"] == [1, 2]
    assert "env_json" not in note
    card = adapter.get_row(user, "review_card", {"card_id": "RC-L01-Q06-1"})
    assert card["history"] == [{"at": "2026-11-21T08:00:00+09:00", "result": "pass"}]
    bad = adapter.apply_ops(user, "pc", [op("h3", "review_card", {"card_id": "RC-2"}, {"history_json": "[1,"}, t("20:00:00"))])
    assert bad.rejected


# ---------- 쌓이는 기록: attempt_id 열쇠, attempt_no 는 서버가 ----------


def test_two_devices_solve_same_question_offline_both_kept_numbered_by_arrival(adapter, user):
    pc_attempt, phone_attempt = aid(), aid()
    # 두 기기가 오프라인에서 각각 L01-Q06 을 풀었다(둘 다 "첫 시도"라고 생각함). 폰이 먼저 연결됨.
    adapter.apply_ops(
        user, "phone",
        [op("p", "question_attempt", {"question_id": "L01-Q06", "attempt_id": phone_attempt},
            {"answer_text": "폰 답", "attempt_no": 1, "at": t("20:10:00")}, t("20:10:00"))],
    )
    adapter.apply_ops(
        user, "pc",
        [op("c", "question_attempt", {"question_id": "L01-Q06", "attempt_id": pc_attempt},
            {"answer_text": "pc 답", "attempt_no": 1, "at": t("20:05:00")}, t("20:05:00"))],
    )
    rows = {r["attempt_id"]: r for r in adapter.list_rows(user, "question_attempt")}
    assert len(rows) == 2
    assert rows[phone_attempt]["attempt_no"] == 1  # 먼저 도착
    assert rows[pc_attempt]["attempt_no"] == 2  # 기기가 보낸 1 은 무시, 도착 순서로 2
    assert {r["answer_text"] for r in rows.values()} == {"폰 답", "pc 답"}
    assert adapter.list_conflicts(user) == []


def test_attempt_numbers_are_per_question_and_kept_on_update(adapter, user):
    a1, a2, b1 = aid(), aid(), aid()
    adapter.apply_ops(
        user, "pc",
        [
            op("1", "question_attempt", {"question_id": "L01-Q01", "attempt_id": a1}, {"answer_text": "1"}, t("20:00:00")),
            op("2", "question_attempt", {"question_id": "L01-Q02", "attempt_id": b1}, {"answer_text": "x"}, t("20:00:01")),
            op("3", "question_attempt", {"question_id": "L01-Q01", "attempt_id": a2}, {"answer_text": "2"}, t("20:00:02")),
            op("4", "question_attempt", {"question_id": "L01-Q01", "attempt_id": a1}, {"is_correct": True}, t("20:00:03")),
        ],
    )
    no = {r["attempt_id"]: r["attempt_no"] for r in adapter.list_rows(user, "question_attempt")}
    assert (no[a1], no[a2], no[b1]) == (1, 2, 1)


def test_choice_answers_with_dont_know_and_bridge_context(adapter, user):
    a, b, c = aid(), aid(), aid()
    res = adapter.apply_ops(
        user, "phone",
        [
            op("q1", "question_attempt", {"question_id": "F-D1", "attempt_id": a},
               {"choice_index": 1, "is_dont_know": False, "is_correct": True, "raw_points": 1, "max_hint_level": 0,
                "score_ratio": 1.0, "points_awarded": 1.0, "at": t("20:10:00")}, t("20:10:00")),
            op("q2", "question_attempt", {"question_id": "F-D2", "attempt_id": b},
               {"choice_index": 3, "is_dont_know": True, "is_correct": False, "at": t("20:11:00")}, t("20:11:00")),
            op("q3", "question_attempt", {"question_id": "B03-1-Q1", "attempt_id": c},
               {"choice_index": 0, "context": "bridge", "at": t("20:12:00")}, t("20:12:00")),
        ],
    )
    assert res.applied == ["q1", "q2", "q3"]
    ra = adapter.get_row(user, "question_attempt", {"question_id": "F-D1", "attempt_id": a})
    rb = adapter.get_row(user, "question_attempt", {"question_id": "F-D2", "attempt_id": b})
    rc_ = adapter.get_row(user, "question_attempt", {"question_id": "B03-1-Q1", "attempt_id": c})
    assert (ra["choice_index"], ra["is_dont_know"], ra["is_correct"], ra["context"]) == (1, False, True, None)
    assert (rb["choice_index"], rb["is_dont_know"], rb["is_correct"]) == (3, True, False)
    assert rb["env_issue"] is False
    assert rc_["context"] == "bridge"
    bad = adapter.apply_ops(user, "pc", [op("q4", "question_attempt", {"question_id": "X", "attempt_id": aid()}, {"context": "lunch"}, t("20:00:00"))])
    assert bad.rejected


def test_checkpoint_attempt_and_its_questions_are_linked(adapter, user):
    cp = aid()
    q_before, q_after = aid(), aid()
    # 문항 응답이 점검 시도보다 먼저 도착해도
    adapter.apply_ops(user, "pc", [op("qa", "question_attempt", {"question_id": "CP1-Q03", "attempt_id": q_before},
                                      {"answer_text": "기울기를 더한다", "checkpoint_attempt_id": cp, "context": "checkpoint"}, t("21:10:00"))])
    res = adapter.apply_ops(
        user, "pc",
        [op("c1", "checkpoint_attempt", {"checkpoint_id": "CP1", "attempt_id": cp},
            {"covers": ["L01", "L02", "L03"], "score_ratio": 0.82, "passed": True, "max_hint_level_allowed": 2,
             "hand_task_self_check": [True, True, False], "path_id": "office_worker",
             "started_at": t("21:00:00"), "at": t("21:40:00")}, t("21:40:00"))],
    )
    assert res.applied == ["c1"]
    adapter.apply_ops(user, "pc", [op("qb", "question_attempt", {"question_id": "CP1-Q04", "attempt_id": q_after},
                                      {"answer_text": "b", "checkpoint_attempt_id": cp}, t("21:11:00"))])
    row = adapter.get_row(user, "checkpoint_attempt", {"checkpoint_id": "CP1", "attempt_id": cp})
    assert row["attempt_no"] == 1
    assert row["covers"] == ["L01", "L02", "L03"]
    assert row["hand_task_self_check"] == [True, True, False]
    assert row["passed"] is True and row["score_ratio"] == pytest.approx(0.82)
    assert row["max_hint_level_allowed"] == 2 and "max_hint_level" not in row
    assert row["path_id"] == "office_worker"
    for qid, attempt in (("CP1-Q03", q_before), ("CP1-Q04", q_after)):
        q = adapter.get_row(user, "question_attempt", {"question_id": qid, "attempt_id": attempt})
        assert q["checkpoint_attempt_no"] == 1, qid


def test_rebuild_and_diagnostic_attempts_are_numbered_by_server(adapter, user):
    r1, r2, d1, d2 = aid(), aid(), aid(), aid()
    adapter.apply_ops(
        user, "pc",
        [
            op("r1", "rebuild_attempt", {"rebuild_id": "L01-R2", "attempt_id": r1}, {"passed": False, "max_hint_level": 3, "at": t("21:00:00")}, t("21:00:00")),
            op("r2", "rebuild_attempt", {"rebuild_id": "L01-R2", "attempt_id": r2}, {"passed": True, "max_hint_level": 2, "at": t("21:20:00")}, t("21:20:00")),
            op("d1", "diagnostic_result", {"attempt_id": d1}, {"answers": [1, 1, "8", 2, 0], "recommended_units": ["F-P1"]}, t("19:00:00")),
            op("d2", "diagnostic_result", {"attempt_id": d2}, {"answers": [1, 1, "8", 2, 1]}, t("19:30:00")),
        ],
    )
    rb = adapter.list_rows(user, "rebuild_attempt")
    assert [(r["attempt_no"], r["passed"], r["max_hint_level"]) for r in rb] == [(1, False, 3), (2, True, 2)]
    dg = adapter.list_rows(user, "diagnostic_result")
    assert [r["attempt_no"] for r in dg] == [1, 2]
    assert dg[0]["recommended_units"] == ["F-P1"]


def test_help_note_study_session_and_taster(adapter, user):
    n1, n2 = aid(), aid()
    res = adapter.apply_ops(
        user, "pc",
        [
            op("h1", "help_note", {"note_id": n1}, {"target_id": "L01-S12", "goal_ko": "a", "created_at": t("20:00:00")}, t("20:00:00")),
            op("h2", "help_note", {"note_id": n2}, {"target_id": "L01-S12", "goal_ko": "b", "created_at": t("20:00:00")}, t("20:00:00")),
            op("s1", "study_session", {"session_id": aid()}, {"target_id": "L01-S01", "active_seconds": 60, "source": "auto"}, t("20:00:00")),
            op("ts1", "taster_result", {"attempt_no": 1, "step_id": "T-S05"},
               {"self_reported": "similar", "pasted_names_text": "mira\nkaley", "pasted_loss_start": 3.84, "pasted_loss_end": 2.47, "at": t("19:30:00")}, t("19:30:00")),
            op("ts2", "taster_result", {"attempt_no": 1, "step_id": "T-S06"}, {"self_reported": "different"}, t("19:31:00")),
        ],
    )
    assert res.rejected == []
    assert len(adapter.list_rows(user, "help_note")) == 2  # 같은 단계·같은 시각이어도 note_id 가 달라 둘 다
    tasters = adapter.list_rows(user, "taster_result")
    assert [(r["step_id"], r["self_reported"]) for r in tasters] == [("T-S05", "similar"), ("T-S06", "different")]
    assert tasters[0]["pasted_loss_end"] == pytest.approx(2.47)
    bad = adapter.apply_ops(user, "pc", [op("ts3", "taster_result", {"attempt_no": 1, "step_id": "T-S07"}, {"self_reported": "maybe"}, t("19:32:00"))])
    assert bad.rejected


def test_taste_result_is_an_unknown_table_now(adapter, user):
    """0002 에서 지운 표. 다른 모르는 표와 똑같이 그 줄만 rejected, 나머지는 계속 반영."""
    res = adapter.apply_ops(
        user, "pc",
        [
            op("tr", "taste_result", {}, {"done_at": t("19:40:00"), "loss_end": 2.47, "names": ["mira"], "source": "colab"}, t("19:40:00")),
            op("ok", "taster_result", {"attempt_no": 1, "step_id": "T-S08"}, {"self_reported": "similar"}, t("19:41:00")),
        ],
    )
    assert res.applied == ["ok"]
    (rej,) = res.rejected
    assert rej == {"op_id": "tr", "reason_ko": "모르는 표입니다: taste_result"}
    assert adapter.apply_ops(user, "pc", [op("x", "no_such_table", {}, {}, t("19:42:00"))]).rejected[0]["reason_ko"] == "모르는 표입니다: no_such_table"
    assert "taste_result" not in adapter.get_state(user)["tables"]
    assert "taste_result" not in adapter.export_all(user)["tables"]
    with pytest.raises(KeyError):
        adapter.list_rows(user, "taste_result")


# ---------- 같은 op_id는 한 번만 ----------


def test_same_op_id_is_applied_only_once(adapter, user):
    key = {"step_id": "L01-S05"}
    first = adapter.apply_ops(user, "pc", [op("dup", "step_progress", key, {"active_seconds_user": 100}, t("20:00:00"))])
    adapter.apply_ops(user, "pc", [op("next", "step_progress", key, {"active_seconds_user": 200}, t("20:01:00"))])
    again = adapter.apply_ops(user, "pc", [op("dup", "step_progress", key, {"active_seconds_user": 100}, t("20:09:00"))])
    assert first.applied == ["dup"] and again.applied == ["dup"]
    assert adapter.get_row(user, "step_progress", key)["active_seconds_user"] == 200
    assert adapter.list_conflicts(user) == []


def test_duplicate_op_id_inside_one_batch(adapter, user):
    k = {"question_id": "L01-Q01", "attempt_id": aid()}
    res = adapter.apply_ops(
        user, "pc",
        [op("x", "question_attempt", k, {"answer_text": "처음"}, t("20:00:00")),
         op("x", "question_attempt", k, {"answer_text": "두 번째"}, t("20:00:01"))],
    )
    assert res.applied == ["x", "x"]
    assert adapter.get_row(user, "question_attempt", k)["answer_text"] == "처음"


# ---------- 충돌: 늦은 updated_at 승, 진 값은 sync_conflicts ----------


def test_two_devices_later_wins_and_loser_is_kept_when_later_arrives_second(adapter, user):
    key = {"pref_key": "run_place"}
    adapter.apply_ops(user, "phone", [op("p1", "user_pref", key, {"value": "colab"}, t("20:00:00"))])
    res = adapter.apply_ops(user, "pc", [op("c1", "user_pref", key, {"value": "local"}, t("20:05:00"))])
    assert res.applied == ["c1"]
    assert adapter.get_row(user, "user_pref", key)["value"] == "local"
    (c,) = adapter.list_conflicts(user)
    assert c["table_name"] == "user_pref" and c["row_key"] == {"pref_key": "run_place"}
    assert c["losing"]["lost_server_values"] == {"value": "colab"} and c["losing"]["winner"] == "op"
    assert c["at"].endswith("+09:00")


def test_two_devices_older_op_arriving_late_is_superseded(adapter, user):
    key = {"pref_key": "run_place"}
    adapter.apply_ops(user, "pc", [op("c1", "user_pref", key, {"value": "local"}, t("20:05:00"))])
    res = adapter.apply_ops(user, "phone", [op("p1", "user_pref", key, {"value": "colab"}, t("20:00:00"))])
    assert res.superseded == ["p1"] and res.applied == []
    assert adapter.get_row(user, "user_pref", key)["value"] == "local"
    (c,) = adapter.list_conflicts(user)
    assert c["losing"]["lost_op_values"] == {"value": "colab"}
    assert (c["losing"]["op_id"], c["losing"]["client_id"], c["losing"]["winner"]) == ("p1", "phone", "server")


def test_same_device_sequential_updates_are_not_conflicts(adapter, user):
    key = {"pref_key": "run_place"}
    adapter.apply_ops(user, "pc", [op("a", "user_pref", key, {"value": "colab"}, t("20:00:00"))])
    adapter.apply_ops(user, "pc", [op("b", "user_pref", key, {"value": "local"}, t("20:01:00"))])
    assert adapter.get_row(user, "user_pref", key)["value"] == "local"
    assert adapter.list_conflicts(user) == []


def test_other_device_that_saw_latest_version_is_not_a_conflict(adapter, user):
    key = {"pref_key": "run_place"}
    adapter.apply_ops(user, "pc", [op("a", "user_pref", key, {"value": "colab"}, t("20:00:00"))])
    res = adapter.apply_ops(user, "phone", [op("b", "user_pref", key, {"value": "local"}, t("20:01:00"), base_updated_at=t("20:00:00"))])
    assert res.applied == ["b"] and adapter.list_conflicts(user) == []


def test_identical_resend_with_new_op_id_is_not_a_conflict(adapter, user):
    k = {"question_id": "L01-Q02", "attempt_id": aid()}
    adapter.apply_ops(user, "pc", [op("a", "question_attempt", k, {"answer_text": "같음"}, t("20:00:00"))])
    res = adapter.apply_ops(user, "phone", [op("b", "question_attempt", k, {"answer_text": "같음"}, t("20:00:00"))])
    assert res.applied == ["b"] and adapter.list_conflicts(user) == []


def test_same_attempt_id_edited_on_two_devices_is_a_conflict(adapter, user):
    k = {"question_id": "L01-Q07", "attempt_id": aid()}
    adapter.apply_ops(user, "pc", [op("a", "question_attempt", k, {"answer_text": "pc 답"}, t("20:00:00"))])
    res = adapter.apply_ops(user, "phone", [op("b", "question_attempt", k, {"answer_text": "폰 답"}, t("20:00:30"))])
    assert res.applied == ["b"]
    assert adapter.get_row(user, "question_attempt", k)["answer_text"] == "폰 답"
    (c,) = adapter.list_conflicts(user)
    assert c["losing"]["lost_server_values"] == {"answer_text": "pc 답"}


# ---------- step_progress: 진도는 뒤로 가지 않는다 ----------


def test_step_progress_done_is_not_reverted_by_later_in_progress(adapter, user):
    key = {"step_id": "L01-S11b"}
    adapter.apply_ops(user, "pc", [op("a", "step_progress", key,
        {"status": "done", "done_at": t("20:30:00"), "max_hint_level": 3, "active_seconds_auto": 900, "attempts": 3}, t("20:30:00"))])
    res = adapter.apply_ops(user, "phone", [op("b", "step_progress", key,
        {"status": "in_progress", "done_at": None, "max_hint_level": 1, "active_seconds_auto": 200, "attempts": 1,
         "active_seconds_user": 1200}, t("20:40:00"))])
    row = adapter.get_row(user, "step_progress", key)
    assert (row["status"], row["done_at"], row["max_hint_level"], row["active_seconds_auto"], row["attempts"]) == (
        "done", t("20:30:00"), 3, 900, 3)
    assert row["active_seconds_user"] == 1200 and row["updated_at"] == t("20:40:00")
    assert res.superseded == ["b"]
    (c,) = adapter.list_conflicts(user)
    assert c["losing"]["lost_op_values"]["status"] == "in_progress"


def test_step_progress_older_done_still_wins_over_newer_in_progress(adapter, user):
    key = {"step_id": "L01-S12"}
    adapter.apply_ops(user, "pc", [op("a", "step_progress", key, {"status": "in_progress", "max_hint_level": 1}, t("20:40:00"))])
    adapter.apply_ops(user, "phone", [op("b", "step_progress", key, {"status": "done", "done_at": t("20:20:00"), "max_hint_level": 2}, t("20:20:00"))])
    row = adapter.get_row(user, "step_progress", key)
    assert (row["status"], row["done_at"], row["max_hint_level"], row["updated_at"]) == ("done", t("20:20:00"), 2, t("20:40:00"))


def test_step_progress_started_at_keeps_the_earliest(adapter, user):
    key = {"step_id": "L01-S13"}
    adapter.apply_ops(user, "pc", [op("a", "step_progress", key, {"status": "in_progress", "started_at": t("20:10:00")}, t("20:10:00"))])
    adapter.apply_ops(user, "phone", [op("b", "step_progress", key, {"started_at": t("20:00:00")}, t("20:00:00"))])
    assert adapter.get_row(user, "step_progress", key)["started_at"] == t("20:00:00")


def test_review_card_history_is_merged(adapter, user):
    key = {"card_id": "RC-L01-Q06-1"}
    h1 = {"at": t("08:00:00", "2026-11-21"), "result": "pass", "max_hint_level": 0}
    h2 = {"at": t("08:00:00", "2026-11-24"), "result": "shaky", "max_hint_level": 1}
    adapter.apply_ops(user, "pc", [op("a", "review_card", key, {"source_id": "L01-Q06", "kind": "concept", "interval_days": 3, "history": [h1]}, t("08:00:00", "2026-11-21"))])
    adapter.apply_ops(user, "phone", [op("b", "review_card", key, {"interval_days": 3, "history": [h2]}, t("08:00:00", "2026-11-24"))])
    assert adapter.get_row(user, "review_card", key)["history"] == [h1, h2]


# ---------- server_seq 와 since ----------


def test_every_change_gets_a_bigger_server_seq_and_no_change_does_not(adapter, user):
    key = {"pref_key": "run_place"}
    adapter.apply_ops(user, "pc", [op("a", "user_pref", key, {"value": "colab"}, t("20:00:00"))])
    s1 = adapter.get_row(user, "user_pref", key)["server_seq"]
    adapter.apply_ops(user, "pc", [op("b", "user_pref", key, {"value": "colab"}, t("20:01:00"))])  # 같은 값
    assert adapter.get_row(user, "user_pref", key)["server_seq"] == s1
    adapter.apply_ops(user, "pc", [op("c", "user_pref", key, {"value": "local"}, t("20:02:00"))])
    assert adapter.get_row(user, "user_pref", key)["server_seq"] > s1
    assert adapter.get_state(user)["server_seq"] == adapter.get_row(user, "user_pref", key)["server_seq"]


def test_since_uses_server_seq_so_late_uploaded_old_records_are_received(adapter, user):
    adapter.apply_ops(user, "pc", [op("a", "step_progress", {"step_id": "L01-S01"}, {"status": "done"}, t("21:00:00"))])
    seen = adapter.get_state(user)  # 컴퓨터가 21:00 까지 받아 감
    assert seen["since"] is None and len(seen["tables"]["step_progress"]) == 1
    # 오프라인이던 폰이 20:00(더 이른 기기 시각)에 한 기록을 이제야 올림
    qid = aid()
    adapter.apply_ops(user, "phone", [
        op("b", "question_attempt", {"question_id": "L01-Q01", "attempt_id": qid}, {"answer_text": "옛 기록", "at": t("20:00:00")}, t("20:00:00")),
        op("c", "step_progress", {"step_id": "L01-S02"}, {"status": "done", "done_at": t("20:00:00")}, t("20:00:00")),
    ])
    later = adapter.get_state(user, since=seen["server_seq"])
    assert later["since"] == seen["server_seq"]
    assert [r["attempt_id"] for r in later["tables"]["question_attempt"]] == [qid]
    assert [r["step_id"] for r in later["tables"]["step_progress"]] == ["L01-S02"]
    assert later["server_seq"] > seen["server_seq"]
    assert adapter.get_state(user, since=later["server_seq"])["tables"]["step_progress"] == []
    with pytest.raises(ValueError):
        adapter.get_state(user, since="2026-11-20T20:00:00+09:00")


# ---------- 오프라인 대기열을 한꺼번에 ----------


def test_offline_queue_sent_all_at_once(adapter, user):
    ops, n = [], 0
    steps = [f"L01-S{i:02d}" for i in range(1, 9)] + ["L01-S09b", "L01-S14c"]
    for i, step in enumerate(steps, start=1):
        ops.append(op(f"q{n}", "step_progress", {"step_id": step}, {"status": "in_progress", "started_at": t(f"20:{i:02d}:00")}, t(f"20:{i:02d}:00")))
        n += 1
        ops.append(op(f"q{n}", "step_progress", {"step_id": step}, {"status": "done", "done_at": t(f"20:{i:02d}:30"), "active_seconds_auto": 30}, t(f"20:{i:02d}:30")))
        n += 1
    for i in range(1, 6):
        ops.append(op(f"q{n}", "question_attempt", {"question_id": f"L01-Q{i:02d}", "attempt_id": aid()},
                      {"answer_text": f"답 {i}", "is_correct": True, "at": t(f"21:{i:02d}:00")}, t(f"21:{i:02d}:00")))
        n += 1
    ops.append(op(f"q{n}", "study_session", {"session_id": "offline-1"},
                  {"target_id": "L01", "started_at": t("20:00:00"), "ended_at": t("21:30:00"), "active_seconds": 4000, "source": "auto"}, t("21:30:00")))
    n += 1
    res = adapter.apply_ops(user, "phone", ops)
    assert res.rejected == [] and len(res.applied) == n
    rows = adapter.list_rows(user, "step_progress")
    assert len(rows) == len(steps) and all(r["status"] == "done" for r in rows)
    assert len(adapter.list_rows(user, "question_attempt")) == 5
    assert adapter.list_conflicts(user) == []
    again = adapter.apply_ops(user, "phone", ops)  # 재시도로 같은 대기열을 또 보냄
    assert again.applied == res.applied
    assert len(adapter.list_rows(user, "question_attempt")) == 5


def test_offline_queue_out_of_order_ends_with_latest(adapter, user):
    key = {"pref_key": "run_place"}
    res = adapter.apply_ops(user, "phone", [
        op("3", "user_pref", key, {"value": "c"}, t("20:03:00")),
        op("1", "user_pref", key, {"value": "a"}, t("20:01:00")),
        op("2", "user_pref", key, {"value": "b"}, t("20:02:00")),
    ])
    assert adapter.get_row(user, "user_pref", key)["value"] == "c"
    assert res.applied == ["3"] and sorted(res.superseded) == ["1", "2"]


# ---------- 거절 ----------


@pytest.mark.parametrize(
    "bad, reason_part",
    [
        (op("r1", "no_such_table", {"x": 1}, {}, t("20:00:00")), "표"),
        (op("r2", "sync_conflicts", {"conflict_id": 1}, {}, t("20:00:00")), "표"),
        (op("r3", "users", {"user_id": "x"}, {}, t("20:00:00")), "표"),
        (op("r3b", "sessions", {"session_id": "x"}, {}, t("20:00:00")), "표"),
        (op("r3c", "applied_ops", {"op_id": "x"}, {}, t("20:00:00")), "표"),
        (op("r4", "step_progress", {"step": "L01-S01"}, {}, t("20:00:00")), "열쇠"),
        (op("r4b", "question_attempt", {"question_id": "L01-Q01", "attempt_no": 1}, {}, t("20:00:00")), "열쇠"),
        (op("r5", "step_progress", {"step_id": "L01-S01"}, {"no_such_field": 1}, t("20:00:00")), "칸"),
        (op("r6", "step_progress", {"step_id": "L01-S01"}, {"status": "finished"}, t("20:00:00")), "status"),
        (op("r6b", "step_progress", {"step_id": "L01-S01"}, {"path_id": "student"}, t("20:00:00")), "path_id"),
        (op("r7", "step_progress", {"step_id": "L01-S01"}, {}, "2026-11-20T20:00:00"), "시각"),
        (op("r8", "step_progress", {"step_id": "L01-S01"}, {"max_hint_level": "2"}, t("20:00:00")), "max_hint_level"),
        (op("r9", "step_progress", {"step_id": "L01-S01"}, {"user_id": "someone-else"}, t("20:00:00")), "user_id"),
        (op("r10", "question_attempt", {"question_id": "L01-Q01", "attempt_id": "공백 있는 값"}, {}, t("20:00:00")), "attempt_id"),
        (op("r11", "question_attempt", {"question_id": "L01-Q01", "attempt_id": "a1"}, {"is_dont_know": "yes"}, t("20:00:00")), "is_dont_know"),
        (op("r12", "share_card", {"share_id": "abcdefghijklmnop1234"}, {"kind": "lecture", "visibility": "public"}, t("20:00:00")), "공개"),
        (op("r13", "grade_result", {"check_id": "L01-S11b"}, {"source": "notebook"}, t("20:00:00")), "passed"),
        (op("r14", "user_pref", {"pref_key": "theme"}, {"value": "dark"}, t("20:00:00")), "pref_key"),
        ({"table": "step_progress", "key": {"step_id": "L01-S01"}, "data": {}, "updated_at": t("20:00:00")}, "op_id"),
        (op("r15", "step_progress", {"step_id": "L01-S01"}, {"step_id": "L01-S02"}, t("20:00:00")), "열쇠"),
    ],
)
def test_bad_ops_are_rejected_with_korean_reason(adapter, user, bad, reason_part):
    res = adapter.apply_ops(user, "pc", [bad])
    assert res.applied == [] and res.superseded == []
    (r,) = res.rejected
    assert r["op_id"] == bad.get("op_id")
    assert reason_part in r["reason_ko"]


def test_server_owned_fields_in_data_are_ignored(adapter, user):
    """기기가 /api/state 행을 그대로 되돌려 보내도 된다(server_seq·attempt_no·user_id 일치)."""
    k = {"question_id": "L01-Q03", "attempt_id": aid()}
    adapter.apply_ops(user, "pc", [op("a", "question_attempt", k, {"answer_text": "x"}, t("20:00:00"))])
    row = adapter.get_row(user, "question_attempt", k)
    echoed = {**row, "user_id": user, "answer_text": "y", "attempt_no": 99, "server_seq": 1}
    res = adapter.apply_ops(user, "pc", [op("b", "question_attempt", k, echoed, t("20:01:00"))])
    assert res.applied == ["b"]
    after = adapter.get_row(user, "question_attempt", k)
    assert after["answer_text"] == "y" and after["attempt_no"] == 1


def test_rejected_op_does_not_stop_the_rest(adapter, user):
    res = adapter.apply_ops(user, "pc", [
        op("ok1", "user_pref", {"pref_key": "run_place"}, {"value": 1}, t("20:00:00")),
        op("bad", "user_pref", {"pref_key": "resume"}, {"valeu": 1}, t("20:00:00")),
        op("ok2", "user_pref", {"pref_key": "resume"}, {"value": 2}, t("20:00:00")),
    ])
    assert res.applied == ["ok1", "ok2"] and [r["op_id"] for r in res.rejected] == ["bad"]


# ---------- 내보내기 ----------


def test_export_contains_every_table_and_conflicts(adapter, user):
    key = {"pref_key": "run_place"}
    adapter.apply_ops(user, "phone", [op("p1", "user_pref", key, {"value": "colab"}, t("20:00:00"))])
    adapter.apply_ops(user, "pc", [op("c1", "user_pref", key, {"value": "local"}, t("20:05:00"))])
    data = adapter.export_all(user)
    assert data["format"] == "z2h-backup" and data["user"]["user_id"] == user
    assert data["schema_version"] == "0002" and isinstance(data["server_seq"], int)
    assert set(StorageAdapter.SYNC_TABLES) <= set(data["tables"])
    assert len(data["tables"]["sync_conflicts"]) == 1
    assert data["tables"]["user_pref"][0]["value"] == "local"


# ---------- 채점 결과·배지·공유 카드 ----------


def test_record_grade_results_keeps_the_newest(adapter, user):
    out = adapter.record_grade_results(
        user, [{"check_id": "L01-S11b", "passed": True, "message_ko": "맞음"}, {"check_id": "L01-S12", "passed": False}],
        source="result_code", at=t("21:00:00"), op_key="aaaa",
    )
    assert out.applied == ["L01-S11b", "L01-S12"]
    older = adapter.record_grade_results(user, [{"check_id": "L01-S11b", "passed": False}], source="result_code", at=t("20:00:00"), op_key="bbbb")
    assert older.superseded == ["L01-S11b"]
    row = adapter.get_row(user, "grade_result", {"check_id": "L01-S11b"})
    assert row["passed"] is True and row["at"] == t("21:00:00") and row["source"] == "result_code"
    again = adapter.record_grade_results(user, [{"check_id": "L01-S12", "passed": False}], source="result_code", at=t("21:00:00"), op_key="aaaa")
    assert again.applied == ["L01-S12"]


def test_same_result_code_for_two_accounts_is_kept_separately(adapter, user, other_user):
    for uid in (user, other_user):
        out = adapter.record_grade_results(uid, [{"check_id": "L01-S04", "passed": True}], source="result_code", at=t("21:00:00"), op_key="same")
        assert out.applied == ["L01-S04"]
    assert adapter.get_row(other_user, "grade_result", {"check_id": "L01-S04"})["passed"] is True


def test_grant_badge_and_share_card(adapter, user):
    assert adapter.grant_badge(user, "BADGE-S1", earned_at=t("22:00:00"), evidence={"checkpoint_id": "CP1"}) == "applied"
    assert adapter.get_row(user, "user_badge", {"badge_id": "BADGE-S1"})["evidence"] == {"checkpoint_id": "CP1"}
    card = adapter.record_share_card(user, kind="lecture_done", payload={"lecture_id": "L01"})
    assert len(card["share_id"]) >= 16 and card["visibility"] == "private"
    assert adapter.get_row(user, "share_card", {"share_id": card["share_id"]})["payload"] == {"lecture_id": "L01"}
