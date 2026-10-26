/**
 * Database types for the Supabase client, written to match supabase/migrations.
 * Regenerate with `npx supabase gen types typescript --local > src/types/database.ts`
 * once a Supabase project is linked; the shape below follows the generator's format.
 */

export type Category = 'yoga' | 'strength' | 'mobility' | 'cardio' | 'core' | 'stretching' | 'breathing';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type Equipment = 'none' | 'mat' | 'dumbbells' | 'kettlebell' | 'resistance_band' | 'bench';
export type MuscleGroup = 'full_body' | 'upper_body' | 'lower_body' | 'core' | 'back' | 'chest' | 'shoulders' | 'arms' | 'legs' | 'hips' | 'cardio';
export type MeasurementType = 'time' | 'reps' | 'weight_reps' | 'distance';
export type WorkoutStatus = 'in_progress' | 'completed' | 'ended_early';
export type Effort = 'easy' | 'just_right' | 'hard';
export type GoalType = 'workout_frequency' | 'active_minutes' | 'habit' | 'milestone' | 'body_weight';
export type GoalUnit = 'sessions_per_week' | 'minutes_per_week' | 'seconds' | 'reps' | 'kg';
export type GoalStatus = 'active' | 'completed' | 'archived';
export type BodyMetric = 'weight' | 'body_fat' | 'waist' | 'chest' | 'hips';
export type BodyUnit = 'kg' | 'cm' | 'percent';
export type Units = 'metric' | 'imperial';
export type NotificationKind = 'reminder' | 'streak' | 'habit' | 'personal_best' | 'summary' | 'goal';

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  date_of_birth: string | null;
  height_cm: number | null;
  preferred_units: Units;
  experience_level: Difficulty;
  focus_areas: string[];
  timezone: string;
  reminders_enabled: boolean;
  reminder_time: string;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExerciseRow = {
  id: string;
  owner_id: string | null;
  name: string;
  description: string;
  category: Category;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  difficulty: Difficulty;
  measurement_type: MeasurementType;
  instructions: string[];
  image_key: string | null;
  created_at: string;
};

export type TemplateRow = {
  id: string;
  owner_id: string | null;
  name: string;
  description: string;
  category: Category;
  difficulty: Difficulty;
  equipment: Equipment;
  estimated_minutes: number;
  focus: string[];
  image_key: string | null;
  is_popular: boolean;
  created_at: string;
  updated_at: string;
};

export type TemplateExerciseRow = {
  id: string;
  template_id: string;
  exercise_id: string;
  sort_order: number;
  sets: number;
  reps: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  weight_kg: number | null;
  rest_seconds: number;
  cue: string;
};

export type SavedWorkoutRow = {
  user_id: string;
  template_id: string;
  created_at: string;
};

export type PlannedWorkoutRow = {
  id: string;
  user_id: string;
  template_id: string;
  planned_date: string;
  planned_time: string | null;
  created_at: string;
};

export type WorkoutRow = {
  id: string;
  user_id: string;
  template_id: string | null;
  name: string;
  category: Category;
  image_key: string | null;
  status: WorkoutStatus;
  started_at: string;
  ended_at: string | null;
  paused_at: string | null;
  paused_seconds: number;
  duration_seconds: number | null;
  workout_date: string;
  effort: Effort | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type WorkoutExerciseRow = {
  id: string;
  workout_id: string;
  exercise_id: string | null;
  exercise_name_snapshot: string;
  measurement_type: MeasurementType;
  image_key: string | null;
  cue: string;
  rest_seconds: number;
  sort_order: number;
  notes: string;
};

export type ExerciseSetRow = {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  target_reps: number | null;
  target_duration_seconds: number | null;
  target_distance_meters: number | null;
  target_weight_kg: number | null;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

export type GoalRow = {
  id: string;
  user_id: string;
  goal_type: GoalType;
  title: string;
  target_value: number;
  unit: GoalUnit;
  habit_categories: Category[];
  exercise_id: string | null;
  preferred_days: number[];
  reminder_enabled: boolean;
  start_date: string;
  target_date: string | null;
  status: GoalStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MeasurementRow = {
  id: string;
  user_id: string;
  measurement_type: BodyMetric;
  value: number;
  unit: BodyUnit;
  measured_at: string;
  notes: string;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
};

/** Insert shape: required columns stay required, columns with defaults become optional. */
type Insertable<R, Required extends keyof R> = Pick<R, Required> & Partial<Omit<R, Required>>;

type Table<R, Required extends keyof R> = {
  Row: R;
  Insert: Insertable<R, Required>;
  Update: Partial<R>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, 'id'>;
      exercises: Table<ExerciseRow, 'name' | 'category' | 'measurement_type'>;
      workout_templates: Table<TemplateRow, 'name' | 'category' | 'estimated_minutes'>;
      workout_template_exercises: Table<TemplateExerciseRow, 'template_id' | 'exercise_id' | 'sort_order'>;
      saved_workouts: Table<SavedWorkoutRow, 'user_id' | 'template_id'>;
      planned_workouts: Table<PlannedWorkoutRow, 'user_id' | 'template_id' | 'planned_date'>;
      workouts: Table<WorkoutRow, 'user_id' | 'name' | 'category' | 'workout_date'>;
      workout_exercises: Table<WorkoutExerciseRow, 'workout_id' | 'exercise_name_snapshot' | 'measurement_type' | 'sort_order'>;
      exercise_sets: Table<ExerciseSetRow, 'workout_exercise_id' | 'set_number'>;
      fitness_goals: Table<GoalRow, 'user_id' | 'goal_type' | 'title' | 'target_value' | 'unit'>;
      body_measurements: Table<MeasurementRow, 'user_id' | 'measurement_type' | 'value' | 'unit'>;
      notifications: Table<NotificationRow, 'user_id' | 'kind' | 'title' | 'dedupe_key'>;
    };
    Views: Record<string, never>;
    Functions: {
      start_workout: { Args: { p_template_id: string }; Returns: string };
      set_workout_paused: { Args: { p_workout_id: string; p_paused: boolean }; Returns: undefined };
      finish_workout: { Args: { p_workout_id: string; p_status: 'completed' | 'ended_early'; p_effort?: Effort | null }; Returns: number };
      save_workout_template: {
        Args: {
          p_id: string | null;
          p_name: string;
          p_description: string;
          p_category: Category;
          p_difficulty: Difficulty;
          p_equipment: Equipment;
          p_estimated_minutes: number;
          p_items: TemplateItemInput[];
        };
        Returns: string;
      };
      local_today: { Args: { p_user: string }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TemplateItemInput = {
  exercise_id: string;
  sets: number;
  reps?: number | null;
  duration_seconds?: number | null;
  distance_meters?: number | null;
  weight_kg?: number | null;
  rest_seconds?: number;
};
