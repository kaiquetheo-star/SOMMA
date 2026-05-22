export type WorkoutPillarLog = 'iron' | 'combat' | 'flow' | 'spirit';

export interface IronSetLog {
  set_index: number;
  weight_kg: number;
  reps: number;
  target_reps: number;
  rest_seconds_used: number;
  logged_at: string;
}

export interface IronSessionLog {
  block_id: string;
  exercise_name: string;
  exercise_id: string;
  sets: IronSetLog[];
  completed_at: string;
}

export interface CombatRoundLog {
  round: number;
  combo_name: string;
  work_seconds: number;
  rest_seconds: number;
}

export interface CombatSessionLog {
  block_id: string;
  rounds: CombatRoundLog[];
  rpe_score: number | null;
  completed_at: string;
}

export interface SpiritSessionLog {
  block_id: string;
  tempo_id: string;
  tempo_name: string;
  cycles_completed: number;
  total_seconds: number;
  completed_at: string;
}

export interface PerformanceLogEntry {
  id: string;
  pillar: WorkoutPillarLog;
  block_id: string;
  iron?: IronSessionLog;
  combat?: CombatSessionLog;
  spirit?: SpiritSessionLog;
  timestamp: string;
}

export interface WorkoutCompletionInput {
  block_id: string;
  pillar: WorkoutPillarLog;
  rpe_score?: number | null;
  volume?: number | null;
  exercise_id?: string | null;
  weight_used?: number | null;
  reps_completed?: number | null;
  actual_rest_seconds?: number | null;
}

export interface PerformanceQueueItem {
  id: string;
  input: WorkoutCompletionInput;
  session: PerformanceLogEntry | null;
  created_at: string;
}
