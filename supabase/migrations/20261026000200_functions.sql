-- Atomic workout operations. All run as SECURITY INVOKER, so every read/write still passes RLS
-- for the calling user; the functions only add atomicity and server-side timing.

create function public.local_today(p_user uuid) returns date
language plpgsql stable set search_path = '' as $$
declare
  tz text;
begin
  select timezone into tz from public.profiles where id = p_user;
  return (now() at time zone coalesce(tz, 'UTC'))::date;
exception when invalid_parameter_value then
  return (now() at time zone 'UTC')::date;
end $$;

-- Starts a session from a template, copying its exercises and per-set targets.
-- Fails with unique_violation if the user already has a session in progress.
create function public.start_workout(p_template_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  t public.workout_templates;
  w_id uuid;
  item record;
  we_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into t from public.workout_templates where id = p_template_id;
  if not found then
    raise exception 'workout not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.workout_template_exercises where template_id = t.id) then
    raise exception 'workout has no exercises' using errcode = '22023';
  end if;

  insert into public.workouts (user_id, template_id, name, category, image_key, workout_date)
  values (uid, t.id, t.name, t.category, t.image_key, public.local_today(uid))
  returning id into w_id;

  for item in
    select wte.*, e.name as exercise_name, e.measurement_type, e.image_key as exercise_image
    from public.workout_template_exercises wte
    join public.exercises e on e.id = wte.exercise_id
    where wte.template_id = t.id
    order by wte.sort_order
  loop
    insert into public.workout_exercises (workout_id, exercise_id, exercise_name_snapshot, measurement_type, image_key, cue, rest_seconds, sort_order)
    values (w_id, item.exercise_id, item.exercise_name, item.measurement_type, item.exercise_image, item.cue, item.rest_seconds, item.sort_order)
    returning id into we_id;

    insert into public.exercise_sets (workout_exercise_id, set_number, target_reps, target_duration_seconds, target_distance_meters, target_weight_kg, weight_kg)
    select we_id, n, item.reps, item.duration_seconds, item.distance_meters, item.weight_kg, item.weight_kg
    from generate_series(1, item.sets) as n;
  end loop;

  return w_id;
end $$;

-- Pause / resume using server time, so the elapsed clock survives reloads and backgrounding.
create function public.set_workout_paused(p_workout_id uuid, p_paused boolean) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.workouts
  set paused_seconds = case
        when not p_paused and paused_at is not null then paused_seconds + greatest(0, floor(extract(epoch from now() - paused_at)))::int
        else paused_seconds end,
      paused_at = case when p_paused then coalesce(paused_at, now()) else null end
  where id = p_workout_id and user_id = auth.uid() and status = 'in_progress';
  if not found then
    raise exception 'active workout not found' using errcode = 'P0002';
  end if;
end $$;

-- Ends a session. Duration is computed from server timestamps minus paused time.
-- 'completed' requires at least one completed set; otherwise use 'ended_early' (partial session).
create function public.finish_workout(p_workout_id uuid, p_status text, p_effort text default null) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  w public.workouts;
  secs integer;
begin
  if p_status not in ('completed', 'ended_early') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  select * into w from public.workouts where id = p_workout_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'workout not found' using errcode = 'P0002';
  end if;
  if w.status <> 'in_progress' then
    -- Idempotent: a repeated "Finish" returns the stored duration instead of failing.
    return w.duration_seconds;
  end if;
  secs := greatest(0, floor(extract(epoch from now() - w.started_at))::int - w.paused_seconds
                     - case when w.paused_at is null then 0 else floor(extract(epoch from now() - w.paused_at))::int end);
  update public.workouts
  set status = p_status, ended_at = now(), paused_at = null, duration_seconds = least(secs, 86400), effort = coalesce(p_effort, effort)
  where id = w.id;
  return least(secs, 86400);
end $$;

-- Creates or replaces a user's custom template and its exercise list in one transaction.
-- p_items: [{exercise_id, sets, reps?, duration_seconds?, distance_meters?, weight_kg?, rest_seconds?}]
create function public.save_workout_template(
  p_id uuid, p_name text, p_description text, p_category text, p_difficulty text,
  p_equipment text, p_estimated_minutes integer, p_items jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  t_id uuid := p_id;
  item jsonb;
  i integer := 0;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'add at least one exercise' using errcode = '22023';
  end if;

  if t_id is null then
    insert into public.workout_templates (owner_id, name, description, category, difficulty, equipment, estimated_minutes, image_key)
    values (uid, p_name, coalesce(p_description, ''), p_category, p_difficulty, p_equipment, p_estimated_minutes, null)
    returning id into t_id;
  else
    update public.workout_templates
    set name = p_name, description = coalesce(p_description, ''), category = p_category, difficulty = p_difficulty,
        equipment = p_equipment, estimated_minutes = p_estimated_minutes
    where id = t_id and owner_id = uid;
    if not found then
      raise exception 'workout not found' using errcode = 'P0002';
    end if;
    delete from public.workout_template_exercises where template_id = t_id;
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.workout_template_exercises (template_id, exercise_id, sort_order, sets, reps, duration_seconds, distance_meters, weight_kg, rest_seconds)
    values (
      t_id, (item ->> 'exercise_id')::uuid, i,
      coalesce((item ->> 'sets')::int, 1),
      (item ->> 'reps')::int, (item ->> 'duration_seconds')::int,
      (item ->> 'distance_meters')::numeric, (item ->> 'weight_kg')::numeric,
      coalesce((item ->> 'rest_seconds')::int, 30)
    );
    i := i + 1;
  end loop;
  return t_id;
end $$;

revoke execute on function public.start_workout(uuid), public.set_workout_paused(uuid, boolean),
  public.finish_workout(uuid, text, text), public.save_workout_template(uuid, text, text, text, text, text, integer, jsonb),
  public.local_today(uuid)
  from public, anon;
grant execute on function public.start_workout(uuid), public.set_workout_paused(uuid, boolean),
  public.finish_workout(uuid, text, text), public.save_workout_template(uuid, text, text, text, text, text, integer, jsonb),
  public.local_today(uuid)
  to authenticated;
