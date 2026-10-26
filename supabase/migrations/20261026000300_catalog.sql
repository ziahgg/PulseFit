-- System exercise catalog and workout templates (owner_id IS NULL → shared, read-only).
-- Content is written for PulseFit (sample programming, not medical advice). IDs are deterministic
-- (md5 of a slug) so later migrations can reference rows safely.

create function pg_temp.sid(kind text, slug text) returns uuid language sql immutable as $$
  select md5(kind || ':' || slug)::uuid
$$;

insert into public.exercises (id, name, description, category, muscle_group, equipment, difficulty, measurement_type, instructions, image_key) values
  -- Yoga / mobility / stretching (time-based)
  (pg_temp.sid('ex','warm-up'), 'Warm-up', 'Gentle full-body movement to raise your temperature and loosen joints.', 'yoga', 'full_body', 'mat', 'beginner', 'time', array['Stand tall and roll your shoulders back.', 'Circle hips, knees and ankles slowly.', 'Finish with a few easy reaches overhead.'], 'mobility'),
  (pg_temp.sid('ex','box-breathing'), 'Breathing', 'Box breathing: in, hold, out, hold — four counts each.', 'breathing', 'full_body', 'none', 'beginner', 'time', array['Sit comfortably with a long spine.', 'Inhale for 4, hold for 4.', 'Exhale for 4, hold for 4. Repeat.'], 'breathing'),
  (pg_temp.sid('ex','cat-cow'), 'Cat–Cow', 'Alternate rounding and arching the spine with the breath.', 'yoga', 'back', 'mat', 'beginner', 'reps', array['Start on hands and knees, wrists under shoulders.', 'Inhale, drop the belly and lift the gaze (cow).', 'Exhale, round the spine and tuck the chin (cat).'], 'stretch'),
  (pg_temp.sid('ex','downward-dog'), 'Downward Dog', 'An inverted V that lengthens hamstrings, calves and the back.', 'yoga', 'full_body', 'mat', 'beginner', 'time', array['From hands and knees, tuck toes and lift hips.', 'Press the floor away; keep a soft bend in the knees.', 'Let the head hang between the arms.'], 'yoga'),
  (pg_temp.sid('ex','low-lunge'), 'Low Lunge', 'Opens the hip flexors and front of the thigh.', 'yoga', 'hips', 'mat', 'beginner', 'time', array['Step one foot forward between the hands.', 'Lower the back knee to the mat.', 'Sink the hips forward, then switch sides.'], 'lunge'),
  (pg_temp.sid('ex','childs-pose'), 'Child’s Pose', 'A resting pose that releases the lower back.', 'yoga', 'back', 'mat', 'beginner', 'time', array['Kneel and bring big toes together.', 'Sit back toward the heels.', 'Reach the arms forward and rest the forehead down.'], 'mobility'),
  (pg_temp.sid('ex','bridge'), 'Bridge', 'Strengthens glutes and the back of the legs.', 'yoga', 'lower_body', 'mat', 'beginner', 'reps', array['Lie on your back, knees bent, feet hip-width.', 'Press through the heels and lift the hips.', 'Lower slowly, one vertebra at a time.'], 'core'),
  (pg_temp.sid('ex','savasana'), 'Savasana', 'Quiet rest to finish the practice.', 'yoga', 'full_body', 'mat', 'beginner', 'time', array['Lie on your back with arms by your sides.', 'Let the feet fall open and close the eyes.', 'Breathe naturally.'], 'breathing'),
  (pg_temp.sid('ex','neck-rolls'), 'Neck Rolls', 'Slow half-circles to ease tension in the neck.', 'mobility', 'shoulders', 'none', 'beginner', 'time', array['Drop the chin to the chest.', 'Roll gently ear to shoulder, side to side.', 'Avoid rolling the head backwards.'], 'mobility'),
  (pg_temp.sid('ex','hip-circles'), 'Hip Circles', 'Large controlled circles to mobilise the hips.', 'mobility', 'hips', 'none', 'beginner', 'reps', array['Stand with hands on hips.', 'Draw big circles with the hips.', 'Switch direction halfway.'], 'mobility'),
  (pg_temp.sid('ex','thread-the-needle'), 'Thread the Needle', 'A gentle upper-back twist from hands and knees.', 'mobility', 'back', 'mat', 'beginner', 'reps', array['Start on hands and knees.', 'Slide one arm under the other, shoulder to the mat.', 'Return and repeat on the other side.'], 'stretch'),
  (pg_temp.sid('ex','worlds-greatest-stretch'), 'World’s Greatest Stretch', 'Lunge with a rotation for hips, hamstrings and thoracic spine.', 'mobility', 'full_body', 'none', 'intermediate', 'reps', array['Step into a long lunge.', 'Place the inside hand down and rotate the other arm up.', 'Return and switch sides.'], 'lunge'),
  (pg_temp.sid('ex','seated-twist'), 'Seated Twist', 'Rotates the spine and stretches the outer hip.', 'stretching', 'back', 'mat', 'beginner', 'time', array['Sit tall with legs crossed.', 'Place one hand behind you and twist gently.', 'Hold, breathe, then switch sides.'], 'mobility'),
  (pg_temp.sid('ex','hamstring-stretch'), 'Hamstring Stretch', 'Lengthens the back of the legs.', 'stretching', 'legs', 'mat', 'beginner', 'time', array['Sit with one leg extended.', 'Hinge forward from the hips with a long spine.', 'Hold, then switch legs.'], 'stretch'),
  (pg_temp.sid('ex','pigeon-pose'), 'Pigeon Pose', 'A deep hip opener.', 'stretching', 'hips', 'mat', 'intermediate', 'time', array['From hands and knees, bring one knee forward.', 'Extend the back leg behind you.', 'Fold forward if comfortable, then switch.'], 'stretch'),
  (pg_temp.sid('ex','chest-opener'), 'Chest Opener', 'Clasp hands behind the back to open the chest.', 'stretching', 'chest', 'none', 'beginner', 'time', array['Interlace fingers behind your back.', 'Straighten the arms and lift the chest.', 'Keep the shoulders away from the ears.'], 'lunge'),
  -- Core
  (pg_temp.sid('ex','plank'), 'Plank', 'Hold a straight line from head to heels.', 'core', 'core', 'mat', 'beginner', 'time', array['Forearms under shoulders.', 'Squeeze glutes and brace the belly.', 'Keep hips level with the shoulders.'], 'plank'),
  (pg_temp.sid('ex','dead-bug'), 'Dead Bug', 'Opposite arm and leg lowers with a flat back.', 'core', 'core', 'mat', 'beginner', 'reps', array['Lie on your back, arms up, knees at 90°.', 'Lower opposite arm and leg without arching.', 'Return and alternate.'], 'core'),
  (pg_temp.sid('ex','bird-dog'), 'Bird Dog', 'Reach opposite arm and leg while staying steady.', 'core', 'core', 'mat', 'beginner', 'reps', array['Start on hands and knees.', 'Extend one arm and the opposite leg.', 'Pause, return and switch.'], 'core'),
  (pg_temp.sid('ex','side-plank'), 'Side Plank', 'Builds the obliques and shoulder stability.', 'core', 'core', 'mat', 'intermediate', 'time', array['Lie on one side, forearm under shoulder.', 'Lift the hips into a straight line.', 'Hold, then switch sides.'], 'plank'),
  (pg_temp.sid('ex','crunch'), 'Crunch', 'Short controlled curl of the upper body.', 'core', 'core', 'mat', 'beginner', 'reps', array['Lie on your back, knees bent.', 'Curl the shoulders off the mat.', 'Lower slowly.'], 'core'),
  -- Strength
  (pg_temp.sid('ex','goblet-squat'), 'Goblet Squat', 'Squat holding a dumbbell at the chest.', 'strength', 'legs', 'dumbbells', 'intermediate', 'weight_reps', array['Hold one dumbbell vertically at the chest.', 'Sit down between the heels, chest up.', 'Drive up through the whole foot.'], 'strength'),
  (pg_temp.sid('ex','dumbbell-row'), 'Dumbbell Row', 'One-arm row for the upper back.', 'strength', 'back', 'dumbbells', 'intermediate', 'weight_reps', array['Hinge forward with a flat back.', 'Pull the dumbbell to the hip.', 'Lower with control; switch sides each set.'], 'strength'),
  (pg_temp.sid('ex','shoulder-press'), 'Shoulder Press', 'Press dumbbells overhead.', 'strength', 'shoulders', 'dumbbells', 'intermediate', 'weight_reps', array['Hold dumbbells at shoulder height.', 'Press up until the arms are straight.', 'Lower slowly.'], 'full-body'),
  (pg_temp.sid('ex','romanian-deadlift'), 'Romanian Deadlift', 'Hip hinge for hamstrings and glutes.', 'strength', 'legs', 'dumbbells', 'intermediate', 'weight_reps', array['Hold dumbbells in front of the thighs.', 'Push the hips back with soft knees.', 'Stand up by squeezing the glutes.'], 'strength'),
  (pg_temp.sid('ex','push-up'), 'Push-up', 'Bodyweight press for chest, shoulders and arms.', 'strength', 'chest', 'none', 'beginner', 'reps', array['Hands slightly wider than shoulders.', 'Lower the chest with elbows at 45°.', 'Press back up. Use knees for an easier option.'], 'full-body'),
  (pg_temp.sid('ex','reverse-lunge'), 'Reverse Lunge', 'Step back into a lunge, alternating legs.', 'strength', 'legs', 'dumbbells', 'intermediate', 'weight_reps', array['Hold dumbbells at your sides.', 'Step back and lower the back knee.', 'Return and switch legs.'], 'strength'),
  (pg_temp.sid('ex','biceps-curl'), 'Biceps Curl', 'Curl dumbbells with still elbows.', 'strength', 'arms', 'dumbbells', 'beginner', 'weight_reps', array['Stand with dumbbells at your sides.', 'Curl up without swinging.', 'Lower slowly.'], 'full-body'),
  -- Cardio
  (pg_temp.sid('ex','marching'), 'Marching in Place', 'Low-impact warm-up march.', 'cardio', 'cardio', 'none', 'beginner', 'time', array['March in place, lifting knees to hip height.', 'Swing the arms naturally.'], 'cardio'),
  (pg_temp.sid('ex','step-jacks'), 'Step Jacks', 'A no-jump version of jumping jacks.', 'cardio', 'cardio', 'none', 'beginner', 'time', array['Step one foot out while raising the arms.', 'Return and switch sides.'], 'cardio'),
  (pg_temp.sid('ex','squat-to-reach'), 'Squat to Reach', 'Squat down, then rise into a full overhead reach.', 'cardio', 'full_body', 'none', 'beginner', 'time', array['Sit into a squat.', 'Stand and reach up onto the toes.'], 'cardio'),
  (pg_temp.sid('ex','skaters'), 'Low-Impact Skaters', 'Side-to-side steps with a reach.', 'cardio', 'legs', 'none', 'beginner', 'time', array['Step wide to one side and sweep the back leg behind.', 'Alternate sides at a steady pace.'], 'cardio'),
  (pg_temp.sid('ex','mountain-climber'), 'Slow Mountain Climbers', 'Alternate knees toward the chest from a plank.', 'cardio', 'core', 'mat', 'intermediate', 'time', array['Start in a high plank.', 'Bring one knee forward, then switch.'], 'plank'),
  (pg_temp.sid('ex','brisk-walk'), 'Brisk Walk', 'Outdoor or treadmill walk at a pace that raises the breath.', 'cardio', 'cardio', 'none', 'beginner', 'distance', array['Walk tall at a pace where talking is possible but harder.'], 'cardio'),
  (pg_temp.sid('ex','easy-run'), 'Easy Run', 'Conversational-pace run.', 'cardio', 'cardio', 'none', 'intermediate', 'distance', array['Keep the pace easy enough to speak in sentences.'], 'cardio');

insert into public.workout_templates (id, name, description, category, difficulty, equipment, estimated_minutes, focus, image_key, is_popular) values
  (pg_temp.sid('tpl','yoga-flow'), 'Yoga Flow for Beginners', 'A calm, beginner-friendly flow that warms up your joints, builds core control and finishes with a slow cool-down. Move at your own pace — every pose has an easier option.', 'yoga', 'beginner', 'mat', 25, array['Flexibility','Core','Breathing'], 'yoga', false),
  (pg_temp.sid('tpl','full-body-strength'), 'Full Body Strength', 'Seven dumbbell and bodyweight moves that work every major muscle group. Rest between sets and keep the form clean.', 'strength', 'intermediate', 'dumbbells', 35, array['Strength','Legs','Upper body'], 'full-body', true),
  (pg_temp.sid('tpl','morning-mobility'), 'Morning Mobility', 'Fifteen minutes to wake up stiff joints before the day starts.', 'mobility', 'beginner', 'none', 15, array['Mobility','Posture'], 'mobility', false),
  (pg_temp.sid('tpl','core-stability'), 'Core Stability', 'Planks and slow, controlled moves for a steadier trunk.', 'core', 'intermediate', 'mat', 20, array['Core','Balance'], 'core', false),
  (pg_temp.sid('tpl','evening-stretch'), 'Evening Stretch', 'Unwind tight hips, hamstrings and back before bed.', 'stretching', 'beginner', 'mat', 12, array['Flexibility','Recovery'], 'stretch', false),
  (pg_temp.sid('tpl','low-impact-cardio'), 'Low-Impact Cardio', 'Raise your heart rate without jumping — friendly to knees and neighbours.', 'cardio', 'beginner', 'none', 26, array['Cardio','Endurance'], 'cardio', false),
  (pg_temp.sid('tpl','stress-relief'), 'Stress Relief Breathing', 'Slow breathing and gentle stretches to calm the nervous system.', 'breathing', 'beginner', 'mat', 10, array['Breathing','Recovery'], 'breathing', false),
  (pg_temp.sid('tpl','strength-starter'), 'Bodyweight Strength Starter', 'No equipment needed: push, squat and hinge basics.', 'strength', 'beginner', 'none', 20, array['Strength','Core'], 'strength', false);

-- (template, exercise, order, sets, reps, duration, weight, rest, cue)
insert into public.workout_template_exercises (template_id, exercise_id, sort_order, sets, reps, duration_seconds, weight_kg, rest_seconds, cue)
select pg_temp.sid('tpl', t), pg_temp.sid('ex', e), o, s, r, d, w, rest, cue
from (values
  ('yoga-flow','warm-up',0,1,null,120,null,15,'Move slowly and breathe.'),
  ('yoga-flow','box-breathing',1,4,null,60,null,10,'Four counts in, hold, out, hold.'),
  ('yoga-flow','cat-cow',2,1,10,null,null,20,'Ten slow reps with the breath.'),
  ('yoga-flow','downward-dog',3,3,null,30,null,30,'Breathe out and shake out your wrists.'),
  ('yoga-flow','low-lunge',4,2,null,45,null,20,'Switch legs each set.'),
  ('yoga-flow','childs-pose',5,1,null,60,null,15,'Let the forehead rest.'),
  ('yoga-flow','bridge',6,2,10,null,null,30,'Lift through the heels.'),
  ('yoga-flow','savasana',7,1,null,180,null,0,'Stay still and breathe.'),
  ('full-body-strength','marching',0,1,null,180,null,30,'Warm up the legs.'),
  ('full-body-strength','goblet-squat',1,3,10,null,12,60,'Chest up, sit between the heels.'),
  ('full-body-strength','dumbbell-row',2,3,10,null,10,60,'Pull to the hip.'),
  ('full-body-strength','shoulder-press',3,3,8,null,8,60,'Ribs down as you press.'),
  ('full-body-strength','romanian-deadlift',4,3,10,null,12,60,'Hips back, flat back.'),
  ('full-body-strength','push-up',5,3,8,null,null,45,'Knees down is fine.'),
  ('full-body-strength','plank',6,2,null,40,null,30,'Brace and breathe.'),
  ('morning-mobility','neck-rolls',0,1,null,60,null,10,'Slow half-circles.'),
  ('morning-mobility','hip-circles',1,2,10,null,null,15,'Big circles each way.'),
  ('morning-mobility','cat-cow',2,1,10,null,null,15,'Move with the breath.'),
  ('morning-mobility','thread-the-needle',3,2,6,null,null,15,'Six per side.'),
  ('morning-mobility','worlds-greatest-stretch',4,2,5,null,null,20,'Five per side.'),
  ('morning-mobility','downward-dog',5,2,null,30,null,15,'Pedal the heels.'),
  ('core-stability','dead-bug',0,3,10,null,null,30,'Back stays flat.'),
  ('core-stability','bird-dog',1,3,10,null,null,30,'Reach long, stay level.'),
  ('core-stability','plank',2,3,null,30,null,30,'Squeeze glutes.'),
  ('core-stability','side-plank',3,2,null,25,null,30,'Each side.'),
  ('core-stability','bridge',4,2,12,null,null,30,'Pause at the top.'),
  ('core-stability','crunch',5,2,12,null,null,30,'Small and slow.'),
  ('evening-stretch','seated-twist',0,2,null,30,null,10,'One side per set.'),
  ('evening-stretch','hamstring-stretch',1,2,null,40,null,10,'One leg per set.'),
  ('evening-stretch','pigeon-pose',2,2,null,45,null,10,'One side per set.'),
  ('evening-stretch','chest-opener',3,1,null,40,null,10,'Lift the chest.'),
  ('evening-stretch','childs-pose',4,1,null,60,null,10,'Long exhales.'),
  ('evening-stretch','savasana',5,1,null,120,null,0,'Let everything go.'),
  ('low-impact-cardio','marching',0,1,null,120,null,20,'Easy start.'),
  ('low-impact-cardio','step-jacks',1,3,null,45,null,20,'Steady rhythm.'),
  ('low-impact-cardio','squat-to-reach',2,3,null,40,null,20,'Reach all the way up.'),
  ('low-impact-cardio','skaters',3,3,null,40,null,20,'Soft knees.'),
  ('low-impact-cardio','mountain-climber',4,2,null,30,null,30,'Slow and controlled.'),
  ('low-impact-cardio','hip-circles',5,1,10,null,null,15,'Recover the breath.'),
  ('low-impact-cardio','hamstring-stretch',6,2,null,30,null,10,'One leg per set.'),
  ('low-impact-cardio','box-breathing',7,1,null,90,null,0,'Bring the heart rate down.'),
  ('stress-relief','box-breathing',0,3,null,60,null,10,'Four counts each side of the box.'),
  ('stress-relief','neck-rolls',1,1,null,60,null,10,'Slow and soft.'),
  ('stress-relief','childs-pose',2,1,null,90,null,10,'Breathe into the back.'),
  ('stress-relief','savasana',3,1,null,180,null,0,'Rest.'),
  ('strength-starter','marching',0,1,null,120,null,20,'Warm up.'),
  ('strength-starter','push-up',1,3,8,null,null,45,'Knees down is fine.'),
  ('strength-starter','bridge',2,3,12,null,null,30,'Squeeze at the top.'),
  ('strength-starter','bird-dog',3,2,10,null,null,30,'Stay level.'),
  ('strength-starter','plank',4,2,null,30,null,30,'Brace.')
) as v(t, e, o, s, r, d, w, rest, cue);
