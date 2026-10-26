-- DEVELOPMENT SEED ONLY — applied by `supabase db reset` on a local stack, never in production.
-- Creates a demo account with ~7 weeks of sample history relative to today, so every screen
-- has data to show. Sign in with:  demo@pulsefit.test  /  pulsefit-demo
-- (The exercise catalog and workout templates live in migrations, not here.)

do $$
declare
  uid constant uuid := 'd0d0d0d0-0000-4000-8000-000000000001';
  today date := (now() at time zone 'UTC')::date;
  wk date := today - ((extract(isodow from today)::int) - 1); -- Monday of this week
  s record;
  w_id uuid;
  item record;
  we_id uuid;
  ex_idx int;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'demo@pulsefit.test',
          extensions.crypt('pulsefit-demo', extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{"display_name":"Ziah Makmur"}', now() - interval '8 months', now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', 'demo@pulsefit.test', 'email_verified', true), 'email', now(), now(), now());

  update public.profiles
  set display_name = 'Ziah Makmur', focus_areas = '{flexibility,mobility,core}', experience_level = 'beginner',
      timezone = 'UTC', onboarded_at = now() - interval '8 months', height_cm = 172, created_at = now() - interval '8 months'
  where id = uid;

  -- Sessions: (template slug, day offset from this Monday, seconds, status, exercises done)
  for s in
    select * from (values
      ('full-body-strength', -42, 35*60, 'completed', 7), ('morning-mobility', -40, 15*60, 'completed', 6), ('yoga-flow', -38, 26*60, 'completed', 8), ('evening-stretch', -36, 12*60, 'completed', 6),
      ('core-stability', -35, 20*60, 'completed', 6), ('yoga-flow', -33, 25*60, 'completed', 8), ('low-impact-cardio', -31, 26*60, 'completed', 8), ('morning-mobility', -29, 15*60, 'completed', 6),
      ('full-body-strength', -28, 36*60, 'completed', 7), ('yoga-flow', -26, 25*60, 'completed', 8), ('evening-stretch', -24, 12*60, 'completed', 6), ('core-stability', -23, 20*60, 'completed', 6),
      ('morning-mobility', -21, 15*60, 'completed', 6), ('yoga-flow', -19, 27*60, 'completed', 8), ('full-body-strength', -17, 34*60, 'completed', 7), ('evening-stretch', -15, 12*60, 'completed', 6),
      ('full-body-strength', -14, 31*60, 'completed', 7), ('core-stability', -12, 14*60, 'ended_early', 4), ('low-impact-cardio', -10, 26*60, 'completed', 8), ('evening-stretch', -8, 12*60, 'completed', 6),
      ('full-body-strength', -7, 36*60, 'completed', 7), ('morning-mobility', -6, 15*60, 'completed', 6), ('yoga-flow', -4, 26*60, 'completed', 8), ('evening-stretch', -2, 12*60, 'completed', 6)
    ) as v(slug, day_offset, secs, status, done)
    where wk + v.day_offset <= today
  loop
    insert into public.workouts (user_id, template_id, name, category, image_key, status, started_at, ended_at, duration_seconds, workout_date, effort)
    select uid, t.id, t.name, t.category, t.image_key, s.status,
           (wk + s.day_offset) + time '18:34', (wk + s.day_offset) + time '18:34' + make_interval(secs => s.secs), s.secs, wk + s.day_offset, 'just_right'
    from public.workout_templates t where t.id = md5('tpl:' || s.slug)::uuid
    returning id into w_id;

    ex_idx := 0;
    for item in
      select wte.*, e.name as exercise_name, e.measurement_type, e.image_key as exercise_image
      from public.workout_template_exercises wte join public.exercises e on e.id = wte.exercise_id
      where wte.template_id = md5('tpl:' || s.slug)::uuid order by wte.sort_order
    loop
      insert into public.workout_exercises (workout_id, exercise_id, exercise_name_snapshot, measurement_type, image_key, cue, rest_seconds, sort_order)
      values (w_id, item.exercise_id, item.exercise_name, item.measurement_type, item.exercise_image, item.cue, item.rest_seconds, item.sort_order)
      returning id into we_id;
      insert into public.exercise_sets (workout_exercise_id, set_number, target_reps, target_duration_seconds, target_weight_kg,
                                        reps, weight_kg, duration_seconds, completed, completed_at)
      select we_id, n, item.reps, item.duration_seconds, item.weight_kg,
             case when ex_idx < s.done then item.reps end, item.weight_kg,
             -- plank holds creep up over the weeks so the milestone goal has history
             case when ex_idx < s.done then case when item.exercise_id = md5('ex:plank')::uuid then least(45, 25 + (s.day_offset + 42) / 3) else item.duration_seconds end end,
             ex_idx < s.done, case when ex_idx < s.done then (wk + s.day_offset) + time '18:40' end
      from generate_series(1, item.sets) n;
      ex_idx := ex_idx + 1;
    end loop;
  end loop;

  insert into public.fitness_goals (user_id, goal_type, title, target_value, unit, preferred_days, reminder_enabled, start_date) values
    (uid, 'workout_frequency', 'Weekly workouts', 4, 'sessions_per_week', '{1,2,4,6,7}', true, today - 60),
    (uid, 'active_minutes', 'Active minutes', 150, 'minutes_per_week', '{}', false, today - 60);
  insert into public.fitness_goals (user_id, goal_type, title, target_value, unit, habit_categories, start_date) values
    (uid, 'habit', 'Mobility habit', 2, 'sessions_per_week', '{mobility,stretching}', today - 30);
  insert into public.fitness_goals (user_id, goal_type, title, target_value, unit, exercise_id, start_date) values
    (uid, 'milestone', 'Hold a 60-sec plank', 60, 'seconds', md5('ex:plank')::uuid, today - 45);

  insert into public.body_measurements (user_id, measurement_type, value, unit, measured_at)
  select uid, 'weight', round((72.4 - g * 0.15)::numeric, 1), 'kg', ((today - (49 - g * 7)) + time '07:30')::timestamptz
  from generate_series(0, 7) g;

  insert into public.saved_workouts (user_id, template_id, created_at) values
    (uid, md5('tpl:yoga-flow')::uuid, now()), (uid, md5('tpl:morning-mobility')::uuid, now() - interval '3 days'),
    (uid, md5('tpl:core-stability')::uuid, now() - interval '9 days'), (uid, md5('tpl:evening-stretch')::uuid, now() - interval '12 days');

  insert into public.planned_workouts (user_id, template_id, planned_date, planned_time)
  values (uid, md5('tpl:yoga-flow')::uuid, today, '18:30');

  insert into public.notifications (user_id, kind, title, body, link, dedupe_key, created_at) values
    (uid, 'reminder', 'Yoga Flow at 6:30 PM', 'Your planned 25-min session is later today.', '/workouts/' || md5('tpl:yoga-flow')::uuid, 'seed:reminder', now() - interval '1 hour'),
    (uid, 'summary', 'Weekly summary', 'Last week’s workouts and active minutes are ready in Activity.', '/activity?period=last_week', 'seed:summary', now() - interval '2 days');
end $$;
