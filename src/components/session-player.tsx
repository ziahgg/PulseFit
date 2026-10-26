'use client';

import { Check, Minus, Pause, Play, Plus, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';

import { discardWorkout, finishWorkout, saveSet, setPaused } from '@/app/actions/session';
import { displayWeight, toKg, weightLabel } from '@/lib/domain/units';
import { currentExerciseIndex, elapsedSeconds, exerciseDone, exerciseProgress, formatClock } from '@/lib/domain/workouts';
import type { SessionDetail } from '@/lib/services/data';
import type { ExerciseSetRow, Units } from '@/types/database';
import { imageSrc } from './cards';
import { ConfirmDialog } from './overlays';
import { useToast } from './toast';
import { Button, Tag, cx } from './ui';

type Phase = { kind: 'work' } | { kind: 'rest'; total: number; endsAt: number };

/** Short beep through Web Audio when a hold or rest ends (respects the mute toggle). */
function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
    o.onended = () => void ctx.close();
  } catch {
    // Audio unavailable (autoplay policy or unsupported) — silent fallback.
  }
}

/**
 * Active workout (Figma 04 / 04b / 04c / 04d / 04e).
 * - Elapsed time is derived from server timestamps (started_at, paused_seconds, paused_at), corrected
 *   for clock skew, so it stays right across reloads, navigation and backgrounding.
 * - Each completed set is saved immediately; if a save fails the set is rolled back and a toast explains.
 * - Hold and rest countdowns are local (they only pace the user; recorded values are what gets saved).
 */
/** The open set of an exercise (or its last set when all are done). */
function currentSet(list: SessionDetail['exercises'], i: number): ExerciseSetRow | undefined {
  const e = list[i];
  if (!e) return undefined;
  const k = e.sets.findIndex((s) => !s.completed);
  return e.sets[k === -1 ? e.sets.length - 1 : k];
}

export function SessionPlayer({ session, units, serverNow }: { session: SessionDetail; units: Units; serverNow: number }) {
  const router = useRouter();
  const toast = useToast();
  const [skew] = useState(() => serverNow - Date.now());
  const clock = useCallback(() => Date.now() + skew, [skew]);
  const [now, setNow] = useState(() => Date.now() + skew);
  const [exercises, setExercises] = useState(session.exercises);
  const [pausedAt, setPausedAt] = useState<string | null>(session.paused_at);
  const [pausedSeconds, setPausedSeconds] = useState(session.paused_seconds);
  const [index, setIndex] = useState(() => currentExerciseIndex(session.exercises));
  const [phase, setPhase] = useState<Phase>({ kind: 'work' });
  const [muted, setMuted] = useState(false);
  const [confirm, setConfirm] = useState<'end' | 'discard' | null>(null);
  const [busy, start] = useTransition();
  const repsId = useId();
  const weightId = useId();

  const repsFor = (s: ExerciseSetRow | undefined) => (s?.target_reps ? String(s.target_reps) : '');
  const weightFor = (s: ExerciseSetRow | undefined) => (s?.weight_kg !== null && s?.weight_kg !== undefined ? String(displayWeight(Number(s.weight_kg), units)) : '');
  const initialSet = currentSet(session.exercises, currentExerciseIndex(session.exercises));
  // Hold countdown for time-based sets: running since `start` (null = stopped) plus banked `offset` seconds.
  const [hold, setHold] = useState<{ start: number | null; offset: number }>(() => ({ start: session.paused_at ? null : Date.now() + skew, offset: 0 }));
  const [reps, setReps] = useState(() => repsFor(initialSet));
  const [weight, setWeight] = useState(() => weightFor(initialSet));

  const ex = exercises[index];
  const set = currentSet(exercises, index);
  const progress = exerciseProgress(exercises);
  const allDone = exercises.every((e) => exerciseDone(e.sets));
  const isLast = index === exercises.length - 1;
  const paused = !!pausedAt;
  const resting = phase.kind === 'rest' && now < phase.endsAt;
  const elapsed = elapsedSeconds({ started_at: session.started_at, ended_at: null, paused_at: pausedAt, paused_seconds: pausedSeconds, duration_seconds: null }, new Date(now));
  const target = set?.target_duration_seconds ?? 0;
  const holdElapsed = hold.start === null ? hold.offset : hold.offset + Math.max(0, Math.floor((now - hold.start) / 1000));
  const holdLeft = Math.max(0, target - holdElapsed);
  const timed = ex?.measurement_type === 'time';

  /** Moves to an exercise (from an event handler) and resets the inputs and hold timer for its open set. */
  const goTo = (list: typeof exercises, i: number, holdFrom: number) => {
    const s = currentSet(list, i);
    setIndex(i);
    setReps(repsFor(s));
    setWeight(weightFor(s));
    setHold({ start: paused ? null : holdFrom, offset: 0 });
  };

  const completeSet = (values: Partial<Pick<ExerciseSetRow, 'reps' | 'weight_kg' | 'duration_seconds' | 'distance_meters'>>) => {
    if (!ex || !set) return;
    const before = exercises;
    const beforeIndex = index;
    const updated = { ...set, ...values, completed: true, completed_at: new Date().toISOString() };
    const next = exercises.map((e) => (e.id === ex.id ? { ...e, sets: e.sets.map((s) => (s.id === set.id ? updated : s)) } : e));
    setExercises(next);
    const lastOverall = next.every((e) => exerciseDone(e.sets));
    const restMs = !lastOverall && ex.rest_seconds > 0 ? ex.rest_seconds * 1000 : 0;
    if (restMs) setPhase({ kind: 'rest', total: ex.rest_seconds, endsAt: clock() + restMs });
    goTo(next, exerciseDone(next[index].sets) && index < next.length - 1 ? index + 1 : index, clock() + restMs);
    start(async () => {
      const r = await saveSet(session.id, {
        setId: set.id,
        reps: updated.reps ?? null,
        weightKg: updated.weight_kg !== null && updated.weight_kg !== undefined ? Number(updated.weight_kg) : null,
        durationSeconds: updated.duration_seconds ?? null,
        distanceMeters: updated.distance_meters !== null && updated.distance_meters !== undefined ? Number(updated.distance_meters) : null,
        completed: true,
      });
      if (!r.ok) {
        setExercises(before);
        setPhase({ kind: 'work' });
        goTo(before, beforeIndex, clock());
        toast({ kind: 'error', title: 'Set not saved', message: r.error });
      }
    });
  };

  // Timer side effects run from the interval callback (not during render): end-of-rest beep and
  // auto-completing a hold when its countdown reaches zero. The ref always holds the latest closure.
  const onTick = useRef<(n: number) => void>(() => undefined);
  const autoDone = useRef<string | null>(null);
  const beeped = useRef<number | null>(null);
  useEffect(() => {
    onTick.current = (n: number) => {
      if (phase.kind === 'rest' && n >= phase.endsAt && beeped.current !== phase.endsAt) {
        beeped.current = phase.endsAt;
        if (!muted) beep();
      }
      const restingNow = phase.kind === 'rest' && n < phase.endsAt;
      if (!timed || !set || set.completed || paused || restingNow || hold.start === null || target <= 0) return;
      const held = hold.offset + Math.floor((n - hold.start) / 1000);
      if (held >= target && autoDone.current !== set.id) {
        autoDone.current = set.id;
        if (!muted) beep();
        completeSet({ duration_seconds: target });
      }
    };
  });
  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now() + skew;
      setNow(n);
      onTick.current(n);
    }, 250);
    return () => clearInterval(t);
  }, [skew]);

  const togglePause = () => {
    const nextPaused = !paused;
    const nowMs = clock();
    if (nextPaused) {
      setPausedAt(new Date(nowMs).toISOString());
      setHold({ start: null, offset: holdElapsed });
    } else {
      if (pausedAt) setPausedSeconds((s) => s + Math.max(0, Math.floor((nowMs - Date.parse(pausedAt)) / 1000)));
      setPausedAt(null);
      setHold((h) => ({ start: nowMs, offset: h.offset }));
    }
    start(async () => {
      const r = await setPaused(session.id, nextPaused);
      if (!r.ok) {
        toast({ kind: 'error', title: 'Couldn’t update the timer', message: r.error });
        router.refresh();
      }
    });
  };

  const shiftRest = (ms: number) => {
    if (phase.kind !== 'rest') return;
    const endsAt = Math.max(now, phase.endsAt + ms);
    const delta = endsAt - phase.endsAt;
    setPhase({ kind: 'rest', total: Math.max(1, phase.total + Math.round(delta / 1000)), endsAt });
    setHold((h) => ({ ...h, start: h.start === null ? null : h.start + delta }));
  };
  const skipRest = () => {
    setPhase({ kind: 'work' });
    setHold({ start: paused ? null : clock(), offset: 0 });
  };

  const finish = (status: 'completed' | 'ended_early') =>
    start(async () => {
      const r = await finishWorkout({ workoutId: session.id, status, effort: null });
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t save the workout', message: r.error });
      router.replace(`/session/${session.id}/complete`);
    });

  const discard = () =>
    start(async () => {
      const r = await discardWorkout(session.id);
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t discard', message: r.error });
      toast({ title: 'Workout discarded', message: session.name });
      router.replace('/home');
    });

  const nextUp = useMemo(() => {
    if (!ex) return null;
    const remainingInThis = ex.sets.filter((s) => !s.completed).length;
    if (resting && remainingInThis > 0) return { ex, label: `${ex.exercise_name_snapshot} · set ${ex.sets.length - remainingInThis + 1} of ${ex.sets.length}`, n: index };
    const n = exercises.findIndex((e, i) => i > index && !exerciseDone(e.sets));
    return n === -1 ? null : { ex: exercises[n], label: exercises[n].exercise_name_snapshot, n };
  }, [ex, exercises, index, resting]);

  const setLine = (e: SessionDetail['exercises'][number] | undefined, s: ExerciseSetRow | undefined) => {
    if (!s || !e) return '';
    const of = `Set ${s.set_number} of ${e.sets.length}`;
    if (e.measurement_type === 'time') return `${of} · ${s.target_duration_seconds ?? 0} sec hold`;
    if (e.measurement_type === 'distance') return `${of} · ${((Number(s.target_distance_meters) || 0) / 1000).toFixed(1)} km`;
    return `${of} · ${s.target_reps ?? ''} reps${s.target_weight_kg ? ` · ${displayWeight(Number(s.target_weight_kg), units)} ${weightLabel(units)}` : ''}`;
  };
  const target2 = (s: SessionDetail['exercises'][number]) => {
    const f = s.sets[0];
    if (!f) return '';
    return s.measurement_type === 'time' ? `${s.sets.length} × ${f.target_duration_seconds} s` : `${s.sets.length} × ${f.target_reps ?? ''}`;
  };

  if (!ex) return null;

  const segments = (
    <div className="flex gap-1.5" role="progressbar" aria-label="Workout progress" aria-valuemin={0} aria-valuemax={exercises.length} aria-valuenow={progress.done}>
      {exercises.map((e) => {
        const frac = e.sets.length ? e.sets.filter((s) => s.completed).length / e.sets.length : 0;
        return (
          <span key={e.id} className={cx('h-1.5 flex-1 overflow-hidden rounded-full', resting ? 'bg-ink-soft' : 'bg-divider')}>
            <span className="block h-full rounded-full bg-brand" style={{ width: `${frac * 100}%` }} />
          </span>
        );
      })}
    </div>
  );

  const endDialog = (
    <>
      <ConfirmDialog
        open={confirm === 'end'}
        title="End workout?"
        message={
          <>
            <p>
              You’ve done {progress.done} of {progress.total} exercises. Your progress so far will be saved to history as a partial session.
            </p>
            <button type="button" className="mt-3 t-body-m text-error underline underline-offset-4" onClick={() => setConfirm('discard')}>
              Discard without saving
            </button>
          </>
        }
        cancelLabel="Keep going"
        confirmLabel="End workout"
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => finish(progress.done === progress.total ? 'completed' : 'ended_early')}
      />
      <ConfirmDialog
        open={confirm === 'discard'}
        title="Discard this workout?"
        message="Nothing from this session will be saved. This can’t be undone."
        cancelLabel="Keep it"
        confirmLabel="Discard"
        danger
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={discard}
      />
    </>
  );

  /* ───────── Rest screen (04c) ───────── */
  if (phase.kind === 'rest' && resting) {
    const left = Math.max(0, Math.ceil((phase.endsAt - now) / 1000));
    const size = 280;
    const r = (size - 16) / 2;
    const c = 2 * Math.PI * r;
    return (
      <main className="fixed inset-0 flex flex-col overflow-y-auto bg-ink px-5 pt-[max(20px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] text-on-ink">
        <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col">
          <header className="flex h-12 items-center justify-between">
            <button type="button" aria-label="End workout" onClick={() => setConfirm('end')} className="grid size-11 place-items-center rounded-full hover:bg-ink-soft">
              <X size={22} aria-hidden />
            </button>
            <span className="t-body text-white/70">
              {session.name.split(' ').slice(0, 2).join(' ')} · {index + 1} of {exercises.length}
            </span>
            <button type="button" aria-label={muted ? 'Unmute sounds' : 'Mute sounds'} aria-pressed={muted} onClick={() => setMuted(!muted)} className="grid size-11 place-items-center rounded-full hover:bg-ink-soft">
              {muted ? <VolumeX size={22} aria-hidden /> : <Volume2 size={22} aria-hidden />}
            </button>
          </header>
          <div className="mt-4">{segments}</div>
          <div className="mt-10 flex flex-col items-center gap-6">
            <Tag tone="brand">Rest</Tag>
            <div className="relative" style={{ width: size, height: size }} role="timer" aria-label={`${left} seconds of rest left`}>
              <svg width={size} height={size} className="-rotate-90" aria-hidden>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-soft)" strokeWidth={16} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--brand)" strokeWidth={16} strokeDasharray={`${(left / phase.total) * c} ${c}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="t-metric-xl num">{formatClock(left)}</span>
                <span className="t-body text-white/60">of {formatClock(phase.total)} rest</span>
              </div>
            </div>
            <p className="t-body text-white/80">{ex.cue || 'Breathe and get ready for the next set.'}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => shiftRest(-10_000)} className="h-11 rounded-full bg-white px-5 t-button-s text-ink">
                −10 s
              </button>
              <button type="button" onClick={() => shiftRest(10_000)} className="h-11 rounded-full bg-white px-5 t-button-s text-ink">
                +10 s
              </button>
            </div>
          </div>
          {nextUp ? (
            <div className="mt-8 flex items-center gap-4 rounded-[24px] bg-ink-soft p-3">
              <span className="relative size-20 shrink-0 overflow-hidden rounded-[16px]">
                <Image src={imageSrc(nextUp.ex.image_key, session.category)} alt="" fill sizes="80px" className="photo object-cover" />
              </span>
              <span>
                <span className="t-body block text-white/60">Up next</span>
                <span className="t-card-title block">{nextUp.label}</span>
                <span className="t-body block text-white/60">{setLine(nextUp.ex, nextUp.ex.sets.find((s) => !s.completed))}</span>
              </span>
            </div>
          ) : null}
          <Button variant="brand" full icon={SkipForward} className="mt-auto" onClick={skipRest}>
            Skip rest
          </Button>
        </div>
        {endDialog}
      </main>
    );
  }

  /* ───────── Work screen (04 / 04b / 04e) ───────── */
  const repsN = Number(reps);
  const weightN = Number(weight);
  const canComplete = ex.measurement_type === 'reps' ? Number.isInteger(repsN) && repsN > 0 : ex.measurement_type === 'weight_reps' ? Number.isInteger(repsN) && repsN > 0 && weight !== '' && weightN >= 0 : true;

  return (
    <main className="min-h-dvh bg-bg">
      <div className="relative mx-auto h-[44dvh] min-h-[300px] max-w-[760px] overflow-hidden lg:mt-6 lg:rounded-[32px]">
        <Image src={imageSrc(ex.image_key, session.category)} alt="" fill priority sizes="(min-width: 1024px) 760px, 100vw" className="photo object-cover" />
        <div className="absolute inset-x-5 top-[max(20px,env(safe-area-inset-top))] flex items-center justify-between">
          <button type="button" aria-label="End workout" onClick={() => setConfirm('end')} className="grid size-14 place-items-center rounded-full bg-white/85 backdrop-blur">
            <X size={22} aria-hidden />
          </button>
          <span className="rounded-full bg-white/85 px-5 py-3 t-section backdrop-blur num">
            {index + 1} / {exercises.length}
          </span>
          <button type="button" aria-label={muted ? 'Unmute sounds' : 'Mute sounds'} aria-pressed={muted} onClick={() => setMuted(!muted)} className="grid size-14 place-items-center rounded-full bg-white/85 backdrop-blur">
            {muted ? <VolumeX size={22} aria-hidden /> : <Volume2 size={22} aria-hidden />}
          </button>
        </div>
      </div>
      <section className="relative mx-auto -mt-8 flex max-w-[760px] flex-col gap-5 rounded-t-[32px] bg-bg px-5 pt-6 pb-10 lg:mt-0">
        {segments}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="t-title-l">{ex.exercise_name_snapshot}</h1>
            <p className="t-body text-text-secondary">{exerciseDone(ex.sets) ? 'All sets done' : setLine(ex, set)}</p>
          </div>
          <Tag tone={paused ? 'warning' : 'brand'}>{paused ? 'Paused' : 'In progress'}</Tag>
        </div>

        {exerciseDone(ex.sets) ? (
          <p className="rounded-[20px] bg-success-soft p-4 t-body">Every set of this exercise is recorded.</p>
        ) : timed ? (
          <div className="flex flex-col items-center" role="timer" aria-live="off">
            <span className="t-metric-xl num">{formatClock(holdLeft)}</span>
            <span className="t-label text-text-muted">
              remaining · {formatClock(elapsed)} elapsed
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-center gap-4">
              {ex.measurement_type !== 'distance' ? (
                <div className="flex flex-col items-center gap-1">
                  <label htmlFor={repsId} className="t-label text-text-muted">
                    Reps
                  </label>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Fewer reps" onClick={() => setReps(String(Math.max(0, (repsN || 0) - 1)))} className="grid size-11 place-items-center rounded-full bg-surface-muted">
                      <Minus size={18} aria-hidden />
                    </button>
                    <input id={repsId} inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value.replace(/\D/g, '').slice(0, 3))} className="w-20 bg-transparent text-center t-metric-l num outline-none" />
                    <button type="button" aria-label="More reps" onClick={() => setReps(String(Math.min(500, (repsN || 0) + 1)))} className="grid size-11 place-items-center rounded-full bg-ink text-on-ink">
                      <Plus size={18} aria-hidden />
                    </button>
                  </div>
                </div>
              ) : null}
              {ex.measurement_type === 'weight_reps' ? (
                <div className="flex flex-col items-center gap-1">
                  <label htmlFor={weightId} className="t-label text-text-muted">
                    Weight ({weightLabel(units)})
                  </label>
                  <input id={weightId} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, '').slice(0, 6))} className="h-11 w-24 rounded-[14px] bg-surface text-center t-metric-m num outline-none" />
                </div>
              ) : null}
            </div>
            <p className="text-center t-label text-text-muted">{formatClock(elapsed)} elapsed</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-8">
          <button type="button" aria-label="Previous exercise" disabled={index === 0} onClick={() => goTo(exercises, index - 1, clock())} className="grid size-16 place-items-center rounded-full bg-surface-muted disabled:opacity-40">
            <SkipBack size={22} aria-hidden />
          </button>
          {timed && !exerciseDone(ex.sets) ? (
            <button type="button" aria-label={paused ? 'Resume' : 'Pause'} onClick={togglePause} className={cx('grid size-20 place-items-center rounded-full text-on-ink', paused ? 'bg-brand' : 'bg-ink')}>
              {paused ? <Play size={30} aria-hidden /> : <Pause size={30} aria-hidden />}
            </button>
          ) : !exerciseDone(ex.sets) ? (
            <button
              type="button"
              aria-label="Complete set"
              disabled={!canComplete || paused}
              onClick={() =>
                completeSet(
                  ex.measurement_type === 'distance'
                    ? { distance_meters: set?.target_distance_meters ?? null }
                    : { reps: repsN, weight_kg: ex.measurement_type === 'weight_reps' ? toKg(weightN, units) : null },
                )
              }
              className="grid size-20 place-items-center rounded-full bg-ink text-on-ink disabled:bg-disabled"
            >
              <Check size={30} aria-hidden />
            </button>
          ) : (
            <span className="grid size-20 place-items-center rounded-full bg-success-soft text-success" aria-hidden>
              <Check size={30} />
            </span>
          )}
          <button type="button" aria-label="Next exercise" disabled={isLast} onClick={() => goTo(exercises, index + 1, clock())} className="grid size-16 place-items-center rounded-full bg-surface-muted disabled:opacity-40">
            <SkipForward size={22} aria-hidden />
          </button>
        </div>
        {timed && !exerciseDone(ex.sets) ? (
          <button type="button" onClick={() => completeSet({ duration_seconds: Math.max(1, Math.min(target, holdElapsed || target)) })} className="self-center t-body-m text-text-secondary underline underline-offset-4">
            Mark set done now
          </button>
        ) : null}
        {paused && !timed ? (
          <Button variant="brand" icon={Play} onClick={togglePause} className="self-center">
            Resume
          </Button>
        ) : null}

        {allDone || (isLast && exerciseDone(ex.sets)) ? (
          <Button full loading={busy} onClick={() => finish(allDone ? 'completed' : 'ended_early')}>
            Finish workout
          </Button>
        ) : nextUp ? (
          <div className="flex items-center gap-4 rounded-[24px] bg-surface-muted p-3 pr-5">
            <span className="relative size-16 shrink-0 overflow-hidden rounded-[14px]">
              <Image src={imageSrc(nextUp.ex.image_key, session.category)} alt="" fill sizes="64px" className="photo object-cover" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="t-label block text-text-muted num">
                Next · {String(nextUp.n + 1).padStart(2, '0')}/{String(exercises.length).padStart(2, '0')}
              </span>
              <span className="t-card-title block truncate">{nextUp.ex.exercise_name_snapshot}</span>
            </span>
            <span className="t-body text-text-secondary num">{target2(nextUp.ex)}</span>
          </div>
        ) : null}

        {paused || !timed ? (
          <button type="button" onClick={() => setConfirm('end')} className="mx-auto inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-5 t-body-m">
            <X size={16} aria-hidden /> End workout
          </button>
        ) : null}
      </section>
      {endDialog}
    </main>
  );
}
