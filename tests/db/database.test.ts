import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

import { asUser, createDb, createUser, sid } from './harness';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

let db: PGlite;
let yoga: string;
let plank: string;

beforeAll(async () => {
  db = await createDb();
  await createUser(db, ALICE, 'Alice');
  await createUser(db, BOB, 'Bob');
  yoga = await sid(db, 'tpl', 'yoga-flow');
  plank = await sid(db, 'ex', 'plank');
}, 60_000);

const one = async <T>(p: Promise<{ rows: T[] }>) => (await p).rows[0];

describe('migrations and catalog', () => {
  it('creates a profile for every new auth user', async () => {
    const p = await asUser(db, ALICE, (tx) => one(tx.query<{ display_name: string }>('select display_name from public.profiles')));
    expect(p.display_name).toBe('Alice');
  });

  it('ships a readable system catalog', async () => {
    const counts = await asUser(db, ALICE, (tx) =>
      one(tx.query<{ ex: number; tpl: number; items: number }>(
        `select (select count(*)::int from exercises) ex, (select count(*)::int from workout_templates) tpl, (select count(*)::int from workout_template_exercises) items`,
      )),
    );
    expect(counts.ex).toBeGreaterThanOrEqual(30);
    expect(counts.tpl).toBe(8);
    const yogaItems = await asUser(db, ALICE, (tx) => one(tx.query<{ n: number }>('select count(*)::int n from workout_template_exercises where template_id = $1', [yoga])));
    expect(yogaItems.n).toBe(8);
  });

  it('gives anonymous visitors no data', async () => {
    await expect(asUser(db, null, (tx) => tx.query('select * from exercises'))).rejects.toThrow(/permission denied/);
  });
});

describe('workout sessions', () => {
  it('starts a session from a template with exercises and per-set targets', async () => {
    const res = await asUser(db, ALICE, async (tx) => {
      const id = (await one(tx.query<{ id: string }>('select start_workout($1) id', [yoga]))).id;
      const ex = await tx.query<{ name: string; sets: number }>(
        `select we.exercise_name_snapshot name, count(s.*)::int sets from workout_exercises we join exercise_sets s on s.workout_exercise_id = we.id where we.workout_id = $1 group by we.id order by we.sort_order`,
        [id],
      );
      return { id, ex: ex.rows };
    });
    expect(res.ex).toHaveLength(8);
    expect(res.ex[3]).toEqual({ name: 'Downward Dog', sets: 3 });
  });

  it('allows only one session in progress per user (no duplicate starts)', async () => {
    await expect(asUser(db, ALICE, (tx) => tx.query('select start_workout($1)', [yoga]))).rejects.toThrow(/duplicate key|workouts_one_active_key/);
  });

  it('records sets and finishes with server-computed duration; repeat finish is idempotent', async () => {
    const out = await asUser(db, ALICE, async (tx) => {
      const w = await one(tx.query<{ id: string }>(`select id from workouts where status = 'in_progress'`));
      await tx.query(`update workouts set started_at = now() - interval '10 minutes' where id = $1`, [w.id]);
      await tx.query(
        `update exercise_sets set completed = true, completed_at = now(), duration_seconds = target_duration_seconds, reps = target_reps
         where workout_exercise_id in (select id from workout_exercises where workout_id = $1)`,
        [w.id],
      );
      const first = await one(tx.query<{ s: number }>(`select finish_workout($1, 'completed', 'just_right') s`, [w.id]));
      const again = await one(tx.query<{ s: number }>(`select finish_workout($1, 'completed') s`, [w.id]));
      const row = await one(tx.query<{ status: string; effort: string }>('select status, effort from workouts where id = $1', [w.id]));
      return { first: first.s, again: again.s, row };
    });
    expect(out.first).toBeGreaterThanOrEqual(599);
    expect(out.first).toBeLessThanOrEqual(601);
    expect(out.again).toBe(out.first);
    expect(out.row).toEqual({ status: 'completed', effort: 'just_right' });
  });

  it('subtracts paused time from the duration', async () => {
    const secs = await asUser(db, ALICE, async (tx) => {
      const id = (await one(tx.query<{ id: string }>('select start_workout($1) id', [yoga]))).id;
      await tx.query(`update workouts set started_at = now() - interval '20 minutes', paused_at = now() - interval '5 minutes' where id = $1`, [id]);
      await tx.query('select set_workout_paused($1, false)', [id]);
      return (await one(tx.query<{ s: number }>(`select finish_workout($1, 'ended_early') s`, [id]))).s;
    });
    expect(secs).toBeGreaterThanOrEqual(899);
    expect(secs).toBeLessThanOrEqual(901);
  });

  it('rejects invalid set values', async () => {
    await expect(
      asUser(db, ALICE, (tx) => tx.query(`update exercise_sets set reps = -1 where id = (select s.id from exercise_sets s limit 1)`)),
    ).rejects.toThrow(/check constraint/);
  });
});

describe('custom templates', () => {
  it('saves a template with ordered exercises atomically and rejects empty ones', async () => {
    const n = await asUser(db, BOB, async (tx) => {
      const id = (await one(tx.query<{ id: string }>(
        `select save_workout_template(null, 'Plank ladder', '', 'core', 'beginner', 'mat', 10, $1::jsonb) id`,
        [JSON.stringify([{ exercise_id: plank, sets: 3, duration_seconds: 30 }])],
      ))).id;
      return (await one(tx.query<{ n: number }>('select count(*)::int n from workout_template_exercises where template_id = $1', [id]))).n;
    });
    expect(n).toBe(1);
    await expect(
      asUser(db, BOB, (tx) => tx.query(`select save_workout_template(null, 'Empty', '', 'core', 'beginner', 'mat', 10, '[]'::jsonb)`)),
    ).rejects.toThrow(/at least one exercise/);
  });
});

describe('row level security across users', () => {
  it('hides another user’s workouts, sets, goals, measurements and templates', async () => {
    await asUser(db, ALICE, async (tx) => {
      await tx.query(`insert into fitness_goals (user_id, goal_type, title, target_value, unit) values ($1, 'workout_frequency', 'Weekly workouts', 4, 'sessions_per_week')`, [ALICE]);
      await tx.query(`insert into body_measurements (user_id, measurement_type, value, unit) values ($1, 'weight', 70.5, 'kg')`, [ALICE]);
    });
    const seen = await asUser(db, BOB, (tx) =>
      one(tx.query<{ w: number; s: number; g: number; m: number; t: number }>(
        `select (select count(*)::int from workouts) w, (select count(*)::int from exercise_sets) s,
                (select count(*)::int from fitness_goals) g, (select count(*)::int from body_measurements) m,
                (select count(*)::int from workout_templates where owner_id is not null) t`,
      )),
    );
    expect(seen).toEqual({ w: 0, s: 0, g: 0, m: 0, t: 1 }); // Bob only sees his own custom template
    const aliceTemplates = await asUser(db, ALICE, (tx) => one(tx.query<{ n: number }>('select count(*)::int n from workout_templates where owner_id is not null')));
    expect(aliceTemplates.n).toBe(0);
  });

  it('blocks writing rows for another user or into another user’s workout', async () => {
    await expect(
      asUser(db, BOB, (tx) => tx.query(`insert into body_measurements (user_id, measurement_type, value, unit) values ($1, 'weight', 80, 'kg')`, [ALICE])),
    ).rejects.toThrow(/row-level security/);
    const aliceExercise = await asUser(db, ALICE, (tx) => one(tx.query<{ id: string }>('select id from workout_exercises limit 1')));
    await expect(
      asUser(db, BOB, (tx) => tx.query(`insert into exercise_sets (workout_exercise_id, set_number) values ($1, 9)`, [aliceExercise.id])),
    ).rejects.toThrow(/row-level security/);
  });

  it('turns another user’s updates, deletes and RPC calls into no-ops or errors', async () => {
    const aliceWorkout = await asUser(db, ALICE, (tx) => one(tx.query<{ id: string }>('select id from workouts limit 1')));
    const changed = await asUser(db, BOB, async (tx) => {
      const u = await tx.query(`update workouts set name = 'hacked' where id = $1`, [aliceWorkout.id]);
      const d = await tx.query(`delete from workouts where id = $1`, [aliceWorkout.id]);
      return (u.affectedRows ?? 0) + (d.affectedRows ?? 0);
    });
    expect(changed).toBe(0);
    await expect(asUser(db, BOB, (tx) => tx.query(`select finish_workout($1, 'completed')`, [aliceWorkout.id]))).rejects.toThrow(/workout not found/);
    await expect(asUser(db, BOB, (tx) => tx.query(`select set_workout_paused($1, true)`, [aliceWorkout.id]))).rejects.toThrow(/active workout not found/);
  });

  it('keeps the system catalog read-only for users', async () => {
    const res = await asUser(db, BOB, async (tx) => {
      const u = await tx.query(`update exercises set name = 'x' where owner_id is null`);
      const d = await tx.query(`delete from workout_templates where owner_id is null`);
      return (u.affectedRows ?? 0) + (d.affectedRows ?? 0);
    });
    expect(res).toBe(0);
    await expect(
      asUser(db, BOB, (tx) => tx.query(`insert into workout_template_exercises (template_id, exercise_id, sort_order) values ($1, $2, 99)`, [yoga, plank])),
    ).rejects.toThrow(/row-level security/);
  });

  it('prevents a user from changing someone else’s profile', async () => {
    const n = await asUser(db, BOB, async (tx) => (await tx.query(`update profiles set display_name = 'x' where id = $1`, [ALICE])).affectedRows ?? 0);
    expect(n).toBe(0);
  });
});

describe('goal and measurement constraints', () => {
  it('rejects mismatched goal units and out-of-range measurements', async () => {
    await expect(
      asUser(db, ALICE, (tx) => tx.query(`insert into fitness_goals (user_id, goal_type, title, target_value, unit) values ($1, 'active_minutes', 'x', 150, 'kg')`, [ALICE])),
    ).rejects.toThrow(/check constraint/);
    await expect(
      asUser(db, ALICE, (tx) => tx.query(`insert into body_measurements (user_id, measurement_type, value, unit) values ($1, 'weight', 5, 'kg')`, [ALICE])),
    ).rejects.toThrow(/check constraint/);
  });

  it('allows one active weekly frequency goal at a time', async () => {
    await expect(
      asUser(db, ALICE, (tx) => tx.query(`insert into fitness_goals (user_id, goal_type, title, target_value, unit) values ($1, 'workout_frequency', 'Again', 3, 'sessions_per_week')`, [ALICE])),
    ).rejects.toThrow(/duplicate key/);
  });
});
