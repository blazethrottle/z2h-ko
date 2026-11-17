// 자동 브라우저 테스트가 읽는 빌드 요약(/data/manifest.json, src/pages/data/manifest.json.ts)과 정본 JSON·lectures.yaml 의 쓰는 부분 모양.
// 새로 쓰는 spec 은 any 대신 이 타입으로 읽는다.
import type { Page } from '@playwright/test';
import { manifest } from './fixtures';

export interface ManifestStep {
  step_id: string;
  slug: string;
  order: number;
  kind: string;
  question_ids: string[];
  check: 'text' | 'number' | 'self';
  run_plan: string[];
  place_before: string | null;
  has_edits: boolean;
  edit_actions: string[];
}
export interface ManifestQuestion {
  question_id: string;
  type: 'predict' | 'choice' | 'explain' | 'fix_bug' | 'apply';
  hint_levels: number[];
}
export interface ManifestLecture {
  lecture_id: string;
  steps: ManifestStep[];
  questions: ManifestQuestion[];
  rebuild_ids: string[];
  stamp_id: string;
}
export interface ManifestDiagQuestion {
  question_id: string;
  type: 'choice' | 'predict';
  dont_know_index: number | null;
  allow_dont_know: boolean;
}
export interface Manifest {
  lectures: ManifestLecture[];
  lecture_list: { lecture_id: string; available: boolean }[];
  basics: { lecture_id: string; ready_ids: string[]; steps: Record<string, ManifestStep[]>; diagnostic: ManifestDiagQuestion[] };
}

export const readManifest = (page: Page): Promise<Manifest> => manifest(page);

/** answers.json 한 문항에서 쓰는 칸 */
export interface AnswerKey {
  answer_index: number | null;
}
export const readAnswers = async (page: Page, lectureId: string): Promise<Record<string, AnswerKey>> => (await page.request.get(`/data/${lectureId}/answers.json`)).json();

/** 정본 L01.json 에서 쓰는 칸 */
export interface L01Json {
  lecture: { env: string[] };
  steps: { step_id: string; prepared_code: string | null; prepared_code_source_ko: string | null }[];
  rebuild_tasks: { rebuild_id: string; title_ko: string; task_ko: string; check_code: string; check_code_line_notes_ko: string[]; pass_ko: string; check: { expected: string }; solution_code: string; solution_source_ko: string }[];
}
/** 정본 F.json 에서 쓰는 칸 */
export interface FJson {
  lecture: { lecture_prereq_units: Record<string, string[]> };
}
/** content/lectures.yaml */
export interface LectureList {
  lectures: {
    lecture_id: string;
    title_ko: string;
    objectives: { objective_id: string; text_ko: string }[];
    plan: { steps: number; total_minutes: number };
    bridge?: { bridge_ko: string; card_ids: string[] };
  }[];
  bridge_cards: { card_id: string; summary_ko: string }[];
  checkpoints: { checkpoint_id: string; covers: string[]; after_lecture: string; items_ko: string; question_count: number }[];
}
