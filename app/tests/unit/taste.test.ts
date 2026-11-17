// 맛보기 화면 계산: 이름 정리(10줄·20글자), 출력 접기, 손실 숫자, 손실 그림 데이터(교사 실행 출력과 같음), 진도 판정.
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { REPO_ROOT } from '../../src/lib/content/load.mjs';
import { LocalStore } from '../../src/lib/sync/store';
import {
  attemptOf,
  cleanNames,
  codeFold,
  foldOutput,
  hasDecimal,
  lossChart,
  parseLoss,
  parseLossLines,
  parseNameLines,
  saveNames,
  saveSelfReport,
  splitSummary,
  tasteStatus,
} from '../../src/lib/taste';

const OUTPUTS = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inputs/pedagogy/content/taster_outputs.json'), 'utf8'));

describe('이름 붙여 넣기 정리 (최대 10줄, a~z 밖 줄·20글자 넘는 줄은 저장·카드에서 뺌)', () => {
  it('교사 출력 10줄은 그대로', () => {
    const r = cleanNames(OUTPUTS['T-S07']);
    expect(r.names).toEqual(OUTPUTS['T-S07'].trim().split('\n'));
    expect(r.flagged).toEqual([]);
    expect(r.text).toBe(OUTPUTS['T-S07'].trim());
  });
  it('빈 줄·앞뒤 공백은 빼고, 10줄을 넘으면 앞 10줄만, 20글자를 넘는 줄은 자르지 않고 뺀다', () => {
    const lines = ['  gsli  ', '', 'abcdefghijklmnopqrstu', ...Array.from({ length: 12 }, (_, i) => `n${'a'.repeat(i + 1)}`)];
    const r = cleanNames(lines.join('\r\n'));
    expect(r.names).toHaveLength(config.taste.maxNames);
    expect(r.names[0]).toBe('gsli');
    expect(r.names[1]).toBe('na');
    expect(r.names.some((n) => n.length > config.taste.maxNameChars)).toBe(false);
    expect(r.flagged).toEqual([2]);
    expect(r.dropped).toBe(lines.filter((l) => l.trim()).length - 1 - config.taste.maxNames);
    expect(r.text.split('\n')).toEqual(r.names);
    // 딱 20글자는 넣는다
    expect(cleanNames('abcdefghijklmnopqrst').names).toEqual(['abcdefghijklmnopqrst']);
  });
  it('a~z 밖 글자나 20글자 넘는 줄은 표시(모델 출력만 넣어 주세요)하고 저장·카드에서 뺀다 (개인 정보 대비)', () => {
    const r = cleanNames('gsli\n홍길동\n010-1234\nKenah\nabcdefghijklmnopqrstu\nme@mail.com\ndi');
    expect(r.flagged).toEqual([2, 3, 4, 5, 6]);
    expect(r.names).toEqual(['gsli', 'di']);
    expect(r.text).not.toMatch(/홍길동|010|@|Kenah/);
  });
  it('금칙어에 걸린 이름은 뺀다 (목록은 설정이 아니라 교사 정본, 빌드 때 만든 필터를 넘긴다. 자세한 검사는 nameFilter.test.ts)', () => {
    expect('blockedNames' in config.taste).toBe(false);
    const filter = { version: 't', exact: ['badword'], substring: [], allow: [], message: '뺐어요' };
    const r = cleanNames('gsli\nbadword\ndi', { filter });
    expect(r.names).toEqual(['gsli', 'di']);
    expect(r.blocked).toBe(1);
    // 필터를 주지 않으면 금칙어 검사를 하지 않는다
    expect(cleanNames('gsli\nbadword').blocked).toBe(0);
  });
  it('남은 이름이 없으면 0개 (저장·카드 불가)', () => {
    expect(cleanNames('  \n \n').names).toEqual([]);
    expect(cleanNames('홍길동\n010-1234-5678').names).toEqual([]);
    expect(cleanNames('badword', { filter: { version: 't', exact: ['badword'], substring: [], allow: [], message: '' } }).names).toEqual([]);
  });
});

describe('손실 숫자 칸 (선택)', () => {
  it('비우면 null, 숫자면 값, 아니면 오류', () => {
    expect(parseLoss('')).toEqual({ ok: true, value: null });
    expect(parseLoss(' 3.84 ')).toEqual({ ok: true, value: 3.84 });
    expect(parseLoss('2')).toEqual({ ok: true, value: 2 });
    expect(parseLoss('3,84').ok).toBe(false);
    expect(parseLoss('약 3.8').ok).toBe(false);
    expect(parseLoss('-1').ok).toBe(false);
  });
});

describe('출력·코드 접기', () => {
  it('길면 앞 3줄 + … + 끝 2줄', () => {
    const r = foldOutput(OUTPUTS['T-S06']);
    expect(r.folded).toBe(true);
    expect(r.total).toBe(11);
    expect(r.lines).toEqual(['0 3.839', '10 2.659', '20 2.555', '…', '90 2.474', '99 2.472']);
  });
  it('짧으면 그대로', () => {
    expect(foldOutput('안녕하세요\n')).toEqual({ lines: ['안녕하세요'], folded: false, total: 1 });
    const six = 'a\nb\nc\nd\ne\nf\n';
    expect(foldOutput(six).folded).toBe(false);
  });
  it('긴 셀만 앞부분을 접는다', () => {
    expect(codeFold(18)).toBe(config.taste.foldHeadLines);
    expect(codeFold(11)).toBe(0);
    expect(codeFold(config.taste.longCellLines)).toBe(0);
  });
  it('소수 숫자가 있는 출력만 "소수 셋째 자리" 안내', () => {
    expect(hasDecimal(OUTPUTS['T-S06'])).toBe(true);
    expect(hasDecimal(OUTPUTS['T-S04'])).toBe(true);
    expect(hasDecimal(OUTPUTS['T-S05'])).toBe(false);
    expect(hasDecimal(OUTPUTS['T-S03'])).toBe(false);
  });
});

describe('미리 계산한 결과: 교사 실행 출력에서만', () => {
  it('손실 줄과 그림 데이터가 taster_outputs.json 과 같다', () => {
    const pts = parseLossLines(OUTPUTS['T-S06']);
    const raw = OUTPUTS['T-S06'].trim().split('\n').map((l: string) => l.split(' ').map(Number));
    expect(pts).toEqual(raw.map(([step, loss]: number[]) => ({ step, loss })));
    const c = lossChart(pts, { width: 600, height: 240, pad: 40 });
    expect(c.dots.map((d) => [d.step, d.loss])).toEqual(raw);
    expect(c.dots).toHaveLength(pts.length);
    // 손실이 줄면 그림의 y(아래로 갈수록 큼)는 커진다
    for (let i = 1; i < c.dots.length; i++) expect(c.dots[i].y).toBeGreaterThanOrEqual(c.dots[i - 1].y);
    expect(c.dots[0].x).toBeLessThan(c.dots[c.dots.length - 1].x);
    expect(c.points.split(' ')).toHaveLength(pts.length);
  });
  it('이름 두 묶음은 출력 그대로', () => {
    expect(parseNameLines(OUTPUTS['T-S05'])).toEqual(OUTPUTS['T-S05'].trim().split('\n'));
    expect(parseNameLines(OUTPUTS['T-S07'])).toHaveLength(10);
  });
});

describe('정리 문구와 진도', () => {
  it('정리 문구: 마지막 문장은 다음 길, 앞은 오늘 한 일', () => {
    const s = splitSummary("오늘 A를 했습니다. B가 '학습'입니다. 왜 그런지는 C에서 다시 만듭니다.");
    expect(s.today).toBe("오늘 A를 했습니다. B가 '학습'입니다.");
    expect(s.next).toBe('왜 그런지는 C에서 다시 만듭니다.');
    expect(splitSummary('한 문장입니다.')).toEqual({ today: '한 문장입니다.', next: '' });
  });
  it('시도 번호는 기록 중 가장 큰 값, 없으면 1', () => {
    expect(attemptOf([])).toBe(1);
    expect(attemptOf([{ attempt_no: 1 }, { attempt_no: 3 }, { attempt_no: '2' }])).toBe(3);
  });
  it('완료 = 필요한 단계 모두 similar (같은 시도 번호)', () => {
    const ids = ['T-S01', 'T-S02'];
    const rows = [
      { attempt_no: 1, step_id: 'T-S01', self_reported: 'similar' },
      { attempt_no: 1, step_id: 'T-S02', self_reported: 'different' },
      { attempt_no: 2, step_id: 'T-S02', self_reported: 'similar' },
    ];
    const s1 = tasteStatus(rows, 1, ids);
    expect([...s1.confirmed]).toEqual(['T-S01']);
    expect([...s1.different]).toEqual(['T-S02']);
    expect(s1.complete).toBe(false);
    expect(s1.missing).toEqual(['T-S02']);
    const rows2 = [
      { attempt_no: 1, step_id: 'T-S01', self_reported: 'similar' },
      { attempt_no: 1, step_id: 'T-S02', self_reported: 'similar' },
    ];
    expect(tasteStatus(rows2, 1, ids).complete).toBe(true);
    expect(tasteStatus(rows2, 1, ids).missing).toEqual([]);
  });
});

describe('저장은 taster_result 한 줄 (열쇠 attempt_no + step_id)', () => {
  const fake = () => {
    const calls: any[] = [];
    return { calls, store: { patch: async (table: string, key: any, changes: any) => (calls.push({ table, key, changes }), { ...key, ...changes }) } };
  };
  it('자기 확인', async () => {
    const f = fake();
    await saveSelfReport(f.store, { attemptNo: 1, stepId: 'T-S03', value: 'similar', contentVersion: 'v1', at: '2026-11-16T23:00:00+09:00' });
    expect(f.calls).toEqual([
      { table: 'taster_result', key: { attempt_no: 1, step_id: 'T-S03' }, changes: { self_reported: 'similar', at: '2026-11-16T23:00:00+09:00', content_version: 'v1' } },
    ]);
  });
  it('붙여 넣은 값(검증 안 됨)', async () => {
    const f = fake();
    await saveNames(f.store, { attemptNo: 1, stepId: 'T-S07', namesText: 'gsli\ndi', lossStart: 3.839, lossEnd: null, contentVersion: 'v1' });
    expect(f.calls[0]).toEqual({
      table: 'taster_result',
      key: { attempt_no: 1, step_id: 'T-S07' },
      changes: { pasted_names_text: 'gsli\ndi', pasted_loss_start: 3.839, pasted_loss_end: null, content_version: 'v1' },
    });
  });
});

describe('이 기기 대기열 (P1 동기화 그대로)', () => {
  it('taster_result: 열쇠는 attempt_no + step_id, data 에는 열쇠·서버 칸이 없고, 붙여 넣은 값과 자기 확인이 한 줄에 합쳐진다', async () => {
    const s = await LocalStore.open('z2h-taste-test-1', '9c1d0000-0000-4000-8000-00000000abcd');
    await saveSelfReport(s, { attemptNo: 1, stepId: 'T-S07', value: 'similar', contentVersion: 'v1', at: '2026-11-16T23:00:00+09:00' });
    await saveNames(s, { attemptNo: 1, stepId: 'T-S07', namesText: 'gsli\ndi', lossStart: 3.839, lossEnd: 2.472, contentVersion: 'v1' });
    const ops = await s.pendingOps(10);
    expect(ops).toHaveLength(1);
    expect(ops[0].table).toBe('taster_result');
    expect(ops[0].key).toEqual({ attempt_no: 1, step_id: 'T-S07' });
    expect(ops[0].data).toMatchObject({ self_reported: 'similar', pasted_names_text: 'gsli\ndi', pasted_loss_start: 3.839, pasted_loss_end: 2.472 });
    expect(Object.keys(ops[0].data)).not.toContain('attempt_no');
    expect(Object.keys(ops[0].data)).not.toContain('user_id');
  });
  it('계정이 아직 없으면 계정 없는 사본에 먼저 쌓였다가 계정이 생기면 옮긴다', async () => {
    const pending = await LocalStore.open('z2h-taste-pending', null);
    await saveSelfReport(pending, { attemptNo: 1, stepId: 'T-S01', value: 'similar', contentVersion: 'v1', at: '2026-11-16T23:00:00+09:00' });
    const mine = await LocalStore.open('z2h-taste-test-2', 'u-1');
    await mine.importFrom(pending);
    expect((await mine.list('taster_result')).map((r) => [r.step_id, r.user_id])).toEqual([['T-S01', 'u-1']]);
    expect(await pending.queueSize()).toBe(0);
  });
});
