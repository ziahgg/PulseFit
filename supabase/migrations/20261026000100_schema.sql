-- PulseFit schema: tables, constraints, indexes, RLS.
-- Conventions
--   * Every user-owned row carries user_id (or reaches it through its parent) and is protected by RLS.
--   * Rows with owner_id IS NULL are the shared system catalog (read-only for users).
--   * Measured quantities use NUMERIC; durations are whole seconds.
--   * Derived metrics (active minutes, streaks, goal progress) are never stored; they are computed
--     from workouts / sets / measurements in the application's domain layer.

-- ───────────── Profiles ─────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url text,
  date_of_birth date check (date_of_birth > date '1900-01-01'),
  height_cm numeric(5,1) check (height_cm between 50 and 272),
  preferred_units text not null default 'metric' check (preferred_units in ('metric', 'imperial')),
  experience_level text not null default 'beginner' check (experience_level in ('beginner', 'intermediate', 'advanced')),
  focus_areas text[] not null default '{}' check (cardinality(focus_areas) <= 3),
  timezone text not null default 'UTC',
  reminders_enabled boolean not null default true,
  reminder_time time not null default '18:30',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── Exercise catalog ─────────────

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade, -- null = system exercise
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  category text not null check (category in ('yoga', 'strength', 'mobility', 'cardio', 'core', 'stretching', 'breathing')),
  muscle_group text not null default 'full_body'
    check (muscle_group in ('full_body', 'upper_body', 'lower_body', 'core', 'back', 'chest', 'shoulders', 'arms', 'legs', 'hips', 'cardio')),
  equipment text not null default 'none' check (equipment in ('none', 'mat', 'dumbbells', 'kettlebell', 'resistance_band', 'bench')),
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  -- How a set is recorded: hold/duration, reps, reps with load, or distance.
  measurement_type text not null check (measurement_type in ('time', 'reps', 'weight_reps', 'distance')),
  instructions text[] not null default '{}',
  image_key text,
  created_at timestamptz not null default now()
);
create index exercises_owner_idx on public.exercises (owner_id);
create index exercises_category_idx on public.exercises (category);
create unique index exercises_system_name_key on public.exercises (lower(name)) where owner_id is null;
create unique index exercises_owner_name_key on public.exercises (owner_id, lower(name)) where owner_id is not null;

-- ───────────── Workout templates (browsable plans) ─────────────

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade, -- null = system template
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 600),
  category text not null check (category in ('yoga', 'strength', 'mobility', 'cardio', 'core', 'stretching', 'breathing')),
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  equipment text not null default 'none' check (equipment in ('none', 'mat', 'dumbbells', 'kettlebell', 'resistance_band', 'bench')),
  estimated_minutes integer not null check (estimated_minutes between 1 and 240),
  focus text[] not null default '{}',
  image_key text,
  is_popular boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_templates_owner_idx on public.workout_templates (owner_id);

create table public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  sort_order integer not null check (sort_order >= 0),
  sets integer not null default 1 check (sets between 1 and 20),
  reps integer check (reps between 1 and 500),
  duration_seconds integer check (duration_seconds between 1 and 7200),
  distance_meters numeric(9,2) check (distance_meters > 0),
  weight_kg numeric(6,2) check (weight_kg >= 0),
  rest_seconds integer not null default 30 check (rest_seconds between 0 and 600),
  cue text not null default '' check (char_length(cue) <= 160),
  unique (template_id, sort_order) deferrable initially deferred
);
create index workout_template_exercises_exercise_idx on public.workout_template_exercises (exercise_id);

-- ───────────── Saved & planned ─────────────

create table public.saved_workouts (
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, template_id)
);
create index saved_workouts_template_idx on public.saved_workouts (template_id);

create table public.planned_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  planned_date date not null,
  planned_time time,
  created_at timestamptz not null default now(),
  unique (user_id, planned_date)
);
create index planned_workouts_template_idx on public.planned_workouts (template_id);

-- ───────────── Workout sessions (instances) ─────────────

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid references public.workout_templates (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  category text not null check (category in ('yoga', 'strength', 'mobility', 'cardio', 'core', 'stretching', 'breathing')),
  image_key text,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'ended_early')),
  -- Authoritative timing lives on the server: elapsed = (ended_at or now) - started_at - paused time.
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  paused_at timestamptz,
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  duration_seconds integer check (duration_seconds between 0 and 86400),
  workout_date date not null, -- local calendar day in the user's timezone
  effort text check (effort in ('easy', 'just_right', 'hard')),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'in_progress') = (ended_at is null)),
  check (status = 'in_progress' or duration_seconds is not null),
  check (ended_at is null or ended_at >= started_at)
);
create index workouts_user_date_idx on public.workouts (user_id, workout_date desc);
create index workouts_template_idx on public.workouts (template_id);
-- One active session per user: also stops double-tapping "Start workout" from creating two.
create unique index workouts_one_active_key on public.workouts (user_id) where status = 'in_progress';

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name_snapshot text not null, -- keeps history readable if a custom exercise is deleted
  measurement_type text not null check (measurement_type in ('time', 'reps', 'weight_reps', 'distance')),
  image_key text,
  cue text not null default '',
  rest_seconds integer not null default 30 check (rest_seconds between 0 and 600),
  sort_order integer not null check (sort_order >= 0),
  notes text not null default '' check (char_length(notes) <= 300),
  unique (workout_id, sort_order) deferrable initially deferred
);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_number integer not null check (set_number between 1 and 20),
  -- Targets copied from the template; actual values are what the user did.
  target_reps integer check (target_reps between 1 and 500),
  target_duration_seconds integer check (target_duration_seconds between 1 and 7200),
  target_distance_meters numeric(9,2) check (target_distance_meters > 0),
  target_weight_kg numeric(6,2) check (target_weight_kg >= 0),
  reps integer check (reps between 0 and 500),
  weight_kg numeric(6,2) check (weight_kg between 0 and 1000),
  duration_seconds integer check (duration_seconds between 0 and 7200),
  distance_meters numeric(9,2) check (distance_meters between 0 and 1000000),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workout_exercise_id, set_number),
  check (completed = (completed_at is not null))
);

-- ───────────── Goals & measurements ─────────────

create table public.fitness_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_type text not null check (goal_type in ('workout_frequency', 'active_minutes', 'habit', 'milestone', 'body_weight')),
  title text not null check (char_length(title) between 1 and 80),
  target_value numeric(8,2) not null check (target_value > 0),
  unit text not null check (unit in ('sessions_per_week', 'minutes_per_week', 'seconds', 'reps', 'kg')),
  -- habit: which workout categories count; milestone: which exercise.
  habit_categories text[] not null default '{}',
  exercise_id uuid references public.exercises (id) on delete set null,
  preferred_days smallint[] not null default '{}', -- ISO weekday 1 = Monday … 7 = Sunday
  reminder_enabled boolean not null default false,
  start_date date not null default current_date,
  target_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_date is null or target_date >= start_date),
  check (preferred_days <@ array[1,2,3,4,5,6,7]::smallint[]),
  check (goal_type <> 'habit' or cardinality(habit_categories) > 0),
  check (goal_type <> 'milestone' or exercise_id is not null),
  check (
    (goal_type = 'workout_frequency' and unit = 'sessions_per_week') or
    (goal_type = 'active_minutes' and unit = 'minutes_per_week') or
    (goal_type = 'habit' and unit = 'sessions_per_week') or
    (goal_type = 'milestone' and unit in ('seconds', 'reps', 'kg')) or
    (goal_type = 'body_weight' and unit = 'kg')
  )
);
create index fitness_goals_user_idx on public.fitness_goals (user_id, status);
create index fitness_goals_exercise_idx on public.fitness_goals (exercise_id);
-- One active weekly goal of each kind keeps "this week" unambiguous.
create unique index fitness_goals_one_weekly_key on public.fitness_goals (user_id, goal_type)
  where status = 'active' and goal_type in ('workout_frequency', 'active_minutes');

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measurement_type text not null check (measurement_type in ('weight', 'body_fat', 'waist', 'chest', 'hips')),
  value numeric(6,2) not null check (value > 0),
  -- Stored in canonical units: kg for weight, cm for lengths, % for body fat.
  unit text not null check (unit in ('kg', 'cm', 'percent')),
  measured_at timestamptz not null default now(),
  notes text not null default '' check (char_length(notes) <= 200),
  created_at timestamptz not null default now(),
  check (
    (measurement_type = 'weight' and unit = 'kg' and value between 20 and 400) or
    (measurement_type = 'body_fat' and unit = 'percent' and value between 2 and 75) or
    (measurement_type in ('waist', 'chest', 'hips') and unit = 'cm' and value between 30 and 250)
  )
);
create index body_measurements_user_idx on public.body_measurements (user_id, measurement_type, measured_at desc);

-- ───────────── Notifications ─────────────

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('reminder', 'streak', 'habit', 'personal_best', 'summary', 'goal')),
  title text not null check (char_length(title) <= 80),
  body text not null default '' check (char_length(body) <= 200),
  link text check (link is null or link like '/%'),
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ───────────── updated_at ─────────────

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger workout_templates_touch before update on public.workout_templates for each row execute function public.touch_updated_at();
create trigger workouts_touch before update on public.workouts for each row execute function public.touch_updated_at();
create trigger fitness_goals_touch before update on public.fitness_goals for each row execute function public.touch_updated_at();

-- ───────────── Profile bootstrap ─────────────

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'display_name', 60), ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── Row Level Security ─────────────

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.saved_workouts enable row level security;
alter table public.planned_workouts enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.fitness_goals enable row level security;
alter table public.body_measurements enable row level security;
alter table public.notifications enable row level security;

-- Profiles: own row only. Rows are created by the auth trigger, never deleted by users directly.
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Catalog: system rows readable by any signed-in user; custom rows only by their owner.
create policy exercises_select on public.exercises for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy exercises_insert on public.exercises for insert to authenticated with check (owner_id = (select auth.uid()));
create policy exercises_update on public.exercises for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy exercises_delete on public.exercises for delete to authenticated using (owner_id = (select auth.uid()));

create policy templates_select on public.workout_templates for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy templates_insert on public.workout_templates for insert to authenticated with check (owner_id = (select auth.uid()));
create policy templates_update on public.workout_templates for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy templates_delete on public.workout_templates for delete to authenticated using (owner_id = (select auth.uid()));

-- Template items follow their template's ownership; the referenced exercise must be visible too.
create policy template_items_select on public.workout_template_exercises for select to authenticated
  using (exists (select 1 from public.workout_templates t where t.id = template_id and (t.owner_id is null or t.owner_id = (select auth.uid()))));
create policy template_items_write on public.workout_template_exercises for all to authenticated
  using (exists (select 1 from public.workout_templates t where t.id = template_id and t.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.workout_templates t where t.id = template_id and t.owner_id = (select auth.uid()))
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid())))
  );

create policy saved_all on public.saved_workouts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.workout_templates t where t.id = template_id and (t.owner_id is null or t.owner_id = (select auth.uid()))));

create policy planned_all on public.planned_workouts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.workout_templates t where t.id = template_id and (t.owner_id is null or t.owner_id = (select auth.uid()))));

create policy workouts_all on public.workouts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (template_id is null or exists (select 1 from public.workout_templates t where t.id = template_id and (t.owner_id is null or t.owner_id = (select auth.uid())))));

-- Nested session data: ownership is checked through the parent workout, never a client-supplied user id.
create policy workout_exercises_all on public.workout_exercises for all to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
    and (exercise_id is null or exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid()))))
  );

create policy exercise_sets_all on public.exercise_sets for all to authenticated
  using (exists (select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id where we.id = workout_exercise_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id where we.id = workout_exercise_id and w.user_id = (select auth.uid())));

create policy goals_all on public.fitness_goals for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (exercise_id is null or exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid())))));

create policy measurements_all on public.body_measurements for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Notifications are created by the app for the signed-in user; users can read, mark read and delete their own.
create policy notifications_all on public.notifications for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Anonymous visitors get nothing: no policies target the anon role.
revoke all on all tables in schema public from anon;
