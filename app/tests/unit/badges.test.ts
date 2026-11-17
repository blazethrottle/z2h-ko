// 배지 규칙(src/badge-rules.ts)과 계산(src/lib/badges.ts): 01 익힘 → 도장 1개·한 번만, 맛보기 완료 표시,
// 단계 배지는 누적 점검 없이는 받지 못함(앱은 쓰지 않음, D47), 스트릭·누적 점검 단독 배지 없음.
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAGE_BADGES, STAMP_RULE, TASTE_MARK } from '../../src/badge-rules';
import { awardBadges, dueAwards, earnedDateKo, lectureRefs, stageBadgeViews, stageStatusKo } from '../../src/lib/badges';
import YAML from 'yaml';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import { LocalStore } from '../../src/lib/sync/store';
import { TABLE_KEYS } from '../../src/lib/sync/tables';

const L01 = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/L01.json'), 'utf8'));
const TASTER = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/taster.json'), 'utf8'));
// 누적 점검이 덮는 편: content/lectures.yaml checkpoints(docs/CURRICULUM.md 5-3절에서 옮김)
const CHECKPOINTS: { checkpoint_id: string; covers: string[] }[] = YAML.parse(fs.readFileSync(path.join(REPO_ROOT, 'content/lectures.yaml'), 'utf8')).checkpoints;
const REQ: string[] = TASTER.lecture.completion_rule.requires_steps;
const NOW = '2026-11-17T10:00:00.000+09:00';

// 편 목록은 콘텐츠처럼 만든다(01만 내용 있음)
const LECTURES = lectureRefs(
  Array.from({ length: 10 }, (_, i) => `L${String(i + 1).padStart(2, '0')}`).map((id) => ({
    lecture_id: id,
    available: id === 'L01',
    stamp_id: id === 'L01' ? (L01.lecture.rewards?.stamp?.stamp_id ?? null) : null,
    content_version: id === 'L01' ? 'v-l01' : null,
  })),
);
const tasteCtx = { required_steps: REQ, content_version: 'v-taste' };
const allSimilar = (n = 1) => REQ.map((s, i) => ({ attempt_no: n, step_id: s, self_reported: 'similar', at: `2026-11-17T09:0${i}:00.000+09:00` }));

let dbn = 0;
const freshStore = () => LocalStore.open(`badges-test-${++dbn}`, 'u-1');

describe('배지 규칙 한 곳 (badge-rules.ts)', () => {
  it('단계 배지 4장: 0 첫 셀 완주, 1~3 = CP1~CP3 통과 (D47). 이름은 VALUE 2절', () => {
    expect(STAGE_BADGES.map((b) => [b.no, b.name_ko])).toEqual([
      [0, '첫 셀 완주'],
      [1, '언어 모델 견습'],
      [2, '신경망 정비사'],
      [3, 'GPT 제작자 (수료)'],
    ]);
    expect(STAGE_BADGES.slice(1).map((b) => b.condition)).toEqual([
      { type: 'checkpoint_passed', checkpoint_id: 'CP1' },
      { type: 'checkpoint_passed', checkpoint_id: 'CP2' },
      { type: 'checkpoint_passed', checkpoint_id: 'CP3' },
    ]);
    expect(STAGE_BADGES[0].condition).toEqual({ type: 'foundations_passed' });
    // 단계 배지는 앱이 쓰지 않는다
    expect(STAGE_BADGES.some((b) => b.awarder === 'app')).toBe(false);
  });
  it('도장 id: 정본에 rewards.stamp 가 없으면(클로드 버전 L01) 같은 모양 STAMP-L01. 단계 배지 1~3 이 덮는 편 = 설계서 누적 점검 CP1~CP3', () => {
    expect(STAMP_RULE.idOf('L01', L01.lecture.rewards?.stamp?.stamp_id ?? null)).toBe('STAMP-L01');
    for (const b of STAGE_BADGES.slice(1)) {
      const cp = b.condition.type === 'checkpoint_passed' ? b.condition.checkpoint_id : null;
      expect(b.covers, b.badge_id).toEqual(CHECKPOINTS.find((c) => c.checkpoint_id === cp)?.covers);
    }
    expect(TASTE_MARK.badge_id).toBe(TASTER.lecture.completion_rule.rule_id);
    expect(TASTE_MARK.note_ko).toBe('배지가 아닌 완료 표시');
  });
  it('연속 기록(스트릭) 배지와 누적 점검 단독 배지가 없다', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'app/src/badge-rules.ts'), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*\*[\s\S]*?\*\//g, '');
    expect(src).not.toMatch(/streak|스트릭|연속|days_in_row/i);
    const ids = [...STAGE_BADGES.map((b) => b.badge_id), TASTE_MARK.badge_id];
    expect(ids.some((id) => /^CP\d/.test(id) || /CHECKPOINT/i.test(id))).toBe(false);
  });
  it('user_badge·share_card 는 동기화 표다 (열쇠: badge_id, share_id)', () => {
    expect(TABLE_KEYS.user_badge).toEqual(['badge_id']);
    expect(TABLE_KEYS.share_card).toEqual(['share_id']);
  });
});

describe('도장·맛보기 완료 판정 (dueAwards)', () => {
  it('01편 mastery_state mastered → 도장 STAMP-L01 하나, 근거(id·시각)와 content_version', () => {
    const due = dueAwards({ stamps: LECTURES }, { mastery_state: [{ target_id: 'L01', state: 'mastered', mastered_at: '2026-11-17T09:30:00+09:00' }] }, NOW);
    expect(due).toEqual([
      {
        badge_id: 'STAMP-L01',
        earned_at: NOW,
        evidence: { source: 'mastery_state', target_id: 'L01', state: 'mastered', at: '2026-11-17T09:30:00+09:00' },
        content_version: 'v-l01',
      },
    ]);
  });
  it('익힘 전(거의 익힘·진행 중)은 도장 없음', () => {
    for (const state of ['in_progress', 'almost', 'open', 'revisit'])
      expect(dueAwards({ stamps: LECTURES }, { mastery_state: [{ target_id: 'L01', state }] }, NOW), state).toEqual([]);
  });
  it('이미 user_badge 행이 있으면 다시 주지 않는다', () => {
    const t = { mastery_state: [{ target_id: 'L01', state: 'mastered' }], user_badge: [{ badge_id: 'STAMP-L01', earned_at: NOW }] };
    expect(dueAwards({ stamps: LECTURES }, t, NOW)).toEqual([]);
  });
  it('맛보기: 필요한 단계를 모두 "직접 확인했어요"로 누르면 완료 표시(TASTER-DONE), 하나라도 빠지면 없음', () => {
    const due = dueAwards({ taste: tasteCtx }, { taster_result: allSimilar() }, NOW);
    expect(due.map((d) => d.badge_id)).toEqual(['TASTER-DONE']);
    expect(due[0].evidence).toMatchObject({ source: 'taster_result', rule_id: 'TASTER-DONE', attempt_no: 1, steps: REQ.length });
    expect(due[0].evidence.at).toBe(allSimilar().pop()!.at);
    expect(due[0].content_version).toBe('v-taste');
    const missing = allSimilar().slice(1);
    expect(dueAwards({ taste: tasteCtx }, { taster_result: missing }, NOW)).toEqual([]);
    const different = allSimilar().map((r, i) => (i === 0 ? { ...r, self_reported: 'different' } : r));
    expect(dueAwards({ taste: tasteCtx }, { taster_result: different }, NOW)).toEqual([]);
  });
  it('단계 배지는 누적 점검 없이는 받지 못한다: 10편을 모두 익혀도 앱은 BADGE-S* 를 쓰지 않는다', () => {
    const allMastered = LECTURES.map((l) => ({ target_id: l.lecture_id, state: 'mastered' }));
    const everything = LECTURES.map((l) => ({ ...l, available: true }));
    const due = dueAwards({ stamps: everything, taste: tasteCtx }, { mastery_state: allMastered, taster_result: allSimilar() }, NOW);
    expect(due.map((d) => d.badge_id).sort()).toEqual([...LECTURES.map((l) => l.stamp_id), 'TASTER-DONE'].sort());
    expect(due.some((d) => d.badge_id.startsWith('BADGE-'))).toBe(false);
  });
});

describe('저장 (awardBadges): 같은 배지는 한 번만', () => {
  it('01 mastered → user_badge 1행이 대기열로, 두 번 불러도·동시에 불러도 1행', async () => {
    const s = await freshStore();
    await s.put('mastery_state', { target_id: 'L01', state: 'mastered', mastered_at: '2026-11-17T09:30:00+09:00' });
    const ctx = { stamps: LECTURES };
    const [a, b] = await Promise.all([awardBadges(s, ctx, () => NOW), awardBadges(s, ctx, () => NOW)]);
    expect([...a, ...b].map((x) => x.badge_id)).toEqual(['STAMP-L01']);
    expect(await awardBadges(s, ctx, () => '2026-11-18T10:00:00+09:00')).toEqual([]);
    const rows = await s.list('user_badge');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ badge_id: 'STAMP-L01', earned_at: NOW, user_id: 'u-1', content_version: 'v-l01' });
    const ops = (await s.pendingOps(50)).filter((o) => o.table === 'user_badge');
    expect(ops).toHaveLength(1);
    expect(ops[0].key).toEqual({ badge_id: 'STAMP-L01' });
    expect(Object.keys(ops[0].data).sort()).toEqual(['content_version', 'earned_at', 'evidence']);
  });
  it('조건이 없으면 아무것도 쓰지 않는다', async () => {
    const s = await freshStore();
    expect(await awardBadges(s, { stamps: LECTURES, taste: tasteCtx }, () => NOW)).toEqual([]);
    expect(await s.list('user_badge')).toEqual([]);
  });
});

describe('화면 글: 남은 것을 사실로만', () => {
  it('단계 배지 아직: 편 상태를 모아 적는다 (지어낸 진행률 없음)', () => {
    expect(stageStatusKo(STAGE_BADGES[1], LECTURES, [{ target_id: 'L01', state: 'in_progress' }])).toBe('아직 · 01편 진행 중, 02·03편 준비 중');
    expect(stageStatusKo(STAGE_BADGES[1], LECTURES, [{ target_id: 'L01', state: 'mastered' }])).toBe('아직 · 01편 익힘, 02·03편 준비 중');
    expect(stageStatusKo(STAGE_BADGES[1], LECTURES, [])).toBe('아직 · 01편 시작 전, 02·03편 준비 중');
    expect(stageStatusKo(STAGE_BADGES[2], LECTURES, [])).toBe('아직 · 04·05·06편 준비 중');
    expect(stageStatusKo(STAGE_BADGES[0], LECTURES, [])).toBe('아직 · 기초 모듈 화면 준비 중');
    for (const b of STAGE_BADGES) expect(stageStatusKo(b, LECTURES, [])).not.toMatch(/%|\d+\s*\/\s*\d+/);
  });
  it('받은 단계 배지(서버가 쓴 행)는 "11월 16일 받음"', () => {
    const v = stageBadgeViews([{ badge_id: 'BADGE-S1', earned_at: '2026-11-16T21:00:00+09:00' }], LECTURES, []);
    expect(v.map((x) => [x.rule.badge_id, x.earned])).toEqual([
      ['BADGE-S0', false],
      ['BADGE-S1', true],
      ['BADGE-S2', false],
      ['BADGE-S3', false],
    ]);
    expect(v[1].status).toBe('11월 16일 받음');
    expect(earnedDateKo('2026-11-16T23:30:00.000+09:00')).toBe('11월 16일 받음');
  });
});
