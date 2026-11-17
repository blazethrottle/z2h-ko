// 빌드가 만드는 화면 데이터의 모양(build.mjs loadSite, basics.mjs loadBasics). 페이지(.astro)가 any 없이 읽게 한 곳에 적는다.
// 화면 부품이 이미 정한 모양(단계·문항·힌트·과제)은 그 부품의 타입을 그대로 쓴다.
import type { DiagQuestionPub, RecommendRules } from '../../components/BasicsParts';
import type { HintRecord } from '../../components/HintLadder';
import type { LectureRebuildPub } from '../../components/LectureApp';
import type { PublicQuestion } from '../../components/QuestionCard';
import type { PublicStep } from '../../components/StepApp';
import type { BasicsRebuildPub } from '../../components/UnitApp';
import type { UnitMasteryRef } from '../basics';
import type { GradableQuestion, RubricItem } from '../grading';

/** answers JSON 한 문항(제출하거나 결과를 볼 때 받는다) */
export interface AnswerRecord {
  answer_ko: string | null;
  auto_grade: GradableQuestion['auto_grade'];
  rubric: RubricItem[];
  answer_index: number | null;
  choices: string[] | null;
  max_points: number;
  type: string;
  answer_code: string | null;
  answer_code_line_notes_ko: string[] | null;
  answer_output: string | null;
  measures_ko: string | null;
}

export interface BasicsUnitData {
  unit_id: string;
  group: string | null;
  title_ko: string;
  status: 'written' | 'planned';
  ready: boolean;
  goal_ko: string;
  analogy_ko: string;
  card_ko: string[];
  needed_by_lectures: string[];
  recommend_first: boolean;
  estimated_minutes: number;
  objectives: string[];
  mastery: UnitMasteryRef;
}

export interface BasicsSite {
  file: string;
  lecture_id: string;
  title_ko: string;
  intro_ko: string[];
  content_version: string;
  unitOrder: string[];
  readyIds: string[];
  groups: { id: string; label_ko: string; unit_ids: string[] }[];
  rule: { steps_complete_ratio: number; question_score_ratio: number; rebuild_max_hint_level: number; note_ko: string };
  recommend: RecommendRules;
  lecturePrereq: Record<string, string[]>;
  units: BasicsUnitData[];
  diagnostic: { rules_ko: string[]; result_if_correct_ko: string; result_if_wrong_ko: string; questions: DiagQuestionPub[] };
  steps: Record<string, (PublicStep & { global_order: number })[]>;
  questions: Record<string, PublicQuestion[]>;
  rebuild: Record<string, BasicsRebuildPub[]>;
  answers: Record<string, AnswerRecord>;
  hints: Record<string, HintRecord[]>;
  counts: { steps: number; questions: number; rebuild: number; hints: number };
}

/** content/lectures.yaml 한 편(docs/CURRICULUM.md 에서 옮긴 값) + 빌드가 붙이는 available */
export interface LectureListItem {
  lecture_id: string;
  title_ko: string;
  youtube_video_id?: string | null;
  video_seconds: number | null;
  video_url?: string | null;
  env_ko?: string | null;
  prereq_lectures?: string[] | null;
  prereq_lectures_note_ko?: string | null;
  objectives?: { objective_id: string; text_ko: string }[] | null;
  plan?: { chapters: number; steps: number; required_steps: number; optional_steps: number; new_code_lines?: number; questions: number; rebuild: number; video_minutes?: number; practice_minutes?: number; total_minutes: number } | null;
  bridge?: { from_lecture: string; jump_ko: string; new_ko: string; bridge_ko: string; card_ids: string[] } | null;
  available: boolean;
}

export interface BridgeCard {
  card_id: string;
  lecture_id: string;
  summary_ko: string;
}

export interface CheckpointItem {
  checkpoint_id: string;
  covers: string[];
  after_lecture: string;
  items_ko: string;
  question_count: number;
}

export interface MasteryRuleData {
  mastery_rule_id: string;
  steps_complete_ratio: number;
  question_score_ratio: number;
  question_min_points?: number | null;
  rebuild_max_hint_level: number;
  extra_checks: string[];
  speak_check?: { prompt_ko: string; rubric?: { criterion_ko: string }[] } | null;
}

export interface LectureDetail {
  lecture: {
    lecture_id: string;
    title_ko: string;
    video_url: string;
    youtube_video_id: string;
    video_seconds: number;
    source_repos?: string[];
    env?: string[];
    objectives: { objective_id: string; text_ko: string }[];
    prereq_units: string[];
    prereq_lectures?: string[];
    content_version: string;
    study_hours_ko?: string | null;
    rewards?: { stamp?: { stamp_id?: string | null } | null } | null;
    notebook: { student: string | null; student_available: boolean };
  };
  mastery_rule: MasteryRuleData;
  steps: PublicStep[];
  questions: PublicQuestion[];
  rebuild: LectureRebuildPub[];
  answers: Record<string, AnswerRecord>;
  hints: Record<string, HintRecord[]>;
  code_lines: Record<string, number>;
}

export interface Site {
  source: string;
  bridgeCards: BridgeCard[];
  checkpoints: CheckpointItem[];
  lectures: LectureListItem[];
  details: Record<string, LectureDetail>;
  stepCounts: Record<string, number>;
}
