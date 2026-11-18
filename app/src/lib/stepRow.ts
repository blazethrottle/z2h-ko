// 단계 행(step_progress) 새로 만들기. 단계 화면이 처음 열 때(progress.ts)와 옛 1편 진도 옮기기(migrate/)가 같은 모양을 쓴다.
import type { Row } from './sync/store';

export function newStepRow(stepId: string, contentVersion: string, now: string): Row {
  return {
    step_id: stepId,
    status: 'in_progress',
    max_hint_level: 0,
    attempts: 0,
    started_at: now,
    done_at: null,
    active_seconds_auto: 0,
    active_seconds_user: null,
    prediction: null,
    content_version: contentVersion,
  };
}
