import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { LocalStore } from '../../src/lib/sync/store';
import { ensureStepRow, markStepDone, patchStep } from '../../src/lib/progress';

let n = 0;
describe('단계 행 쓰기 순서', () => {
  it('화면을 열자마자 마치기를 눌러도 done이 in_progress로 덮이지 않는다', async () => {
    const s = await LocalStore.open(`z2h-step-${++n}`);
    await Promise.all([ensureStepRow(s, 'L01-S01', 'v1'), markStepDone(s, 'L01-S01', 'v1'), ensureStepRow(s, 'L01-S01', 'v1')]);
    expect((await s.get('step_progress', { step_id: 'L01-S01' }))?.status).toBe('done');
    const ops = await s.pendingOps(10);
    expect(ops).toHaveLength(1);
    expect(ops[0].data.status).toBe('done');
  });

  it('동시에 시도 수를 올려도 하나도 잃지 않는다', async () => {
    const s = await LocalStore.open(`z2h-step-${++n}`);
    await Promise.all(Array.from({ length: 5 }, () => patchStep(s, 'L01-S02', 'v1', (cur) => ({ attempts: Number(cur.attempts ?? 0) + 1 }))));
    expect((await s.get('step_progress', { step_id: 'L01-S02' }))?.attempts).toBe(5);
  });
});
