CREATE OR REPLACE FUNCTION public.set_today_commitment_completion(
  p_commitment_id uuid,
  p_completed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_arc_id uuid;
  v_character_hp integer;
  v_starts_on date;
  v_ends_on date;
  v_timezone text;
  v_today date;
  v_progress_id uuid;
  v_progress_percent numeric;
  v_progress_hp_change integer;
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_commitment_id IS NULL OR p_completed IS NULL THEN
    RAISE EXCEPTION 'A commitment and completion state are required' USING ERRCODE = '22023';
  END IF;

  SELECT a.id, c.current_hp, a.starts_on, a.ends_on,
         COALESCE(NULLIF(p.timezone, ''), 'UTC')
    INTO v_arc_id, v_character_hp, v_starts_on, v_ends_on, v_timezone
  FROM public.arcs AS a
  JOIN public.characters AS c
    ON c.id = a.character_id
   AND c.user_id = v_user_id
   AND c.status = 'active'
  LEFT JOIN public.profiles AS p
    ON p.id = v_user_id
  WHERE a.user_id = v_user_id
    AND a.status = 'active'
  FOR UPDATE OF a, c;

  IF v_arc_id IS NULL THEN
    RAISE EXCEPTION 'No active Arc and character found' USING ERRCODE = '42501';
  END IF;

  v_today := pg_catalog.timezone(v_timezone, v_now)::date;

  IF v_today < v_starts_on OR v_today > v_ends_on THEN
    RAISE EXCEPTION 'Today is outside the active Arc dates' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.commitments AS cm
    WHERE cm.id = p_commitment_id
      AND cm.arc_id = v_arc_id
      AND cm.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Commitment does not belong to the active Arc' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.daily_progress (
    user_id, arc_id, progress_date, completion_percentage,
    hp_change, hp_after, created_at, updated_at
  )
  VALUES (v_user_id, v_arc_id, v_today, 0, 0, v_character_hp, v_now, v_now)
  ON CONFLICT (arc_id, progress_date) DO NOTHING;

  SELECT dp.id, dp.completion_percentage, dp.hp_change
    INTO v_progress_id, v_progress_percent, v_progress_hp_change
  FROM public.daily_progress AS dp
  WHERE dp.user_id = v_user_id
    AND dp.arc_id = v_arc_id
    AND dp.progress_date = v_today
  FOR UPDATE;

  IF v_progress_percent <> 0 OR v_progress_hp_change <> 0 THEN
    RAISE EXCEPTION 'Today has already been evaluated' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.daily_results (
    user_id, arc_id, daily_progress_id, commitment_id, completed,
    xp_awarded, hp_change, hp_after, completed_at, created_at, updated_at
  )
  VALUES (
    v_user_id, v_arc_id, v_progress_id, p_commitment_id, p_completed,
    0, 0, v_character_hp, CASE WHEN p_completed THEN v_now ELSE NULL END, v_now, v_now
  )
  ON CONFLICT (daily_progress_id, commitment_id)
  DO UPDATE SET
    completed = EXCLUDED.completed,
    xp_awarded = 0,
    hp_change = 0,
    hp_after = v_character_hp,
    completed_at = CASE WHEN EXCLUDED.completed THEN v_now ELSE NULL END,
    updated_at = v_now;
END;
$function$;

CREATE OR REPLACE FUNCTION public.evaluate_today_arc()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_today date;
  v_now timestamptz := pg_catalog.now();
  v_arc_id uuid;
  v_character_id uuid;
  v_starts_on date;
  v_ends_on date;
  v_current_hp integer;
  v_character_xp integer;
  v_streak_days integer;
  v_character_status text;
  v_arc_status text;
  v_progress_id uuid;
  v_completion_percentage numeric;
  v_hp_change integer;
  v_hp_after integer;
  v_total_xp bigint;
  v_completed_xp bigint;
  v_new_streak integer;
  v_successful boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT COALESCE(NULLIF(p.timezone, ''), 'UTC')
    INTO v_timezone
  FROM public.profiles AS p
  WHERE p.id = v_user_id;
  v_timezone := COALESCE(v_timezone, 'UTC');
  v_today := pg_catalog.timezone(v_timezone, v_now)::date;

  SELECT a.id, a.character_id, a.starts_on, a.ends_on,
         c.current_hp, c.xp, c.streak_days,
         c.status::text, a.status::text
    INTO v_arc_id, v_character_id, v_starts_on, v_ends_on,
         v_current_hp, v_character_xp, v_streak_days,
         v_character_status, v_arc_status
  FROM public.arcs AS a
  JOIN public.characters AS c
    ON c.id = a.character_id
   AND c.user_id = v_user_id
   AND c.status = 'active'
  WHERE a.user_id = v_user_id
    AND a.status = 'active'
  FOR UPDATE OF a, c;

  IF v_arc_id IS NULL THEN
    SELECT dp.arc_id, dp.completion_percentage, dp.hp_change, dp.hp_after,
           c.xp, c.streak_days, c.status::text, a.status::text
      INTO v_arc_id, v_completion_percentage, v_hp_change, v_hp_after,
           v_character_xp, v_streak_days, v_character_status, v_arc_status
    FROM public.daily_progress AS dp
    JOIN public.arcs AS a ON a.id = dp.arc_id AND a.user_id = v_user_id
    JOIN public.characters AS c ON c.id = a.character_id AND c.user_id = v_user_id
    WHERE dp.user_id = v_user_id
      AND dp.progress_date = v_today
      AND (dp.completion_percentage <> 0 OR dp.hp_change <> 0)
    ORDER BY dp.created_at DESC
    LIMIT 1;

    IF v_arc_id IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'already_evaluated', true,
        'completion_percentage', v_completion_percentage,
        'hp_change', v_hp_change,
        'hp_after', v_hp_after,
        'streak_days', v_streak_days,
        'xp', v_character_xp,
        'character_status', v_character_status,
        'arc_status', v_arc_status
      );
    END IF;

    RAISE EXCEPTION 'No active Arc and character found' USING ERRCODE = '42501';
  END IF;

  IF v_today < v_starts_on OR v_today > v_ends_on THEN
    RAISE EXCEPTION 'Today is outside the active Arc dates' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.daily_progress (
    user_id, arc_id, progress_date, completion_percentage,
    hp_change, hp_after, created_at, updated_at
  )
  VALUES (v_user_id, v_arc_id, v_today, 0, 0, v_current_hp, v_now, v_now)
  ON CONFLICT (arc_id, progress_date) DO NOTHING;

  SELECT dp.id, dp.completion_percentage, dp.hp_change, dp.hp_after
    INTO v_progress_id, v_completion_percentage, v_hp_change, v_hp_after
  FROM public.daily_progress AS dp
  WHERE dp.user_id = v_user_id
    AND dp.arc_id = v_arc_id
    AND dp.progress_date = v_today
  FOR UPDATE;

  IF v_completion_percentage <> 0 OR v_hp_change <> 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'already_evaluated', true,
      'completion_percentage', v_completion_percentage,
      'hp_change', v_hp_change,
      'hp_after', v_hp_after,
      'streak_days', v_streak_days,
      'xp', v_character_xp,
      'character_status', v_character_status,
      'arc_status', v_arc_status
    );
  END IF;

  SELECT COALESCE(pg_catalog.sum(cm.xp_reward), 0),
         COALESCE(pg_catalog.sum(cm.xp_reward) FILTER (WHERE dr.completed), 0)
    INTO v_total_xp, v_completed_xp
  FROM public.commitments AS cm
  LEFT JOIN public.daily_results AS dr
    ON dr.commitment_id = cm.id
   AND dr.daily_progress_id = v_progress_id
  WHERE cm.user_id = v_user_id
    AND cm.arc_id = v_arc_id;

  IF v_total_xp <= 0 THEN
    RAISE EXCEPTION 'The active Arc has no XP-valued Commitments' USING ERRCODE = '22023';
  END IF;

  v_completion_percentage := v_completed_xp::numeric * 100 / v_total_xp;
  v_hp_change := CASE
    WHEN v_completion_percentage = 100 THEN 5
    WHEN v_completion_percentage >= 90 THEN 3
    WHEN v_completion_percentage >= 75 THEN 0
    WHEN v_completion_percentage >= 60 THEN -5
    WHEN v_completion_percentage >= 40 THEN -10
    WHEN v_completion_percentage > 0 THEN -15
    ELSE -20
  END;
  v_hp_after := LEAST(100, GREATEST(0, v_current_hp + v_hp_change));
  v_successful := v_completion_percentage >= 75;
  v_new_streak := CASE WHEN v_successful THEN v_streak_days + 1 ELSE 0 END;
  v_character_xp := v_character_xp + v_completed_xp;

  IF v_hp_after = 0 THEN
    UPDATE public.arcs SET status = 'failed' WHERE id = v_arc_id;

    UPDATE public.characters
    SET current_hp = v_hp_after,
        xp = v_character_xp,
        streak_days = v_new_streak,
        status = 'dead'
    WHERE id = v_character_id;

    v_character_status := 'dead';
    v_arc_status := 'failed';
  ELSIF v_today = v_ends_on THEN
    UPDATE public.arcs SET status = 'completed' WHERE id = v_arc_id;

    UPDATE public.characters
    SET current_hp = v_hp_after,
        xp = v_character_xp,
        streak_days = v_new_streak,
        status = 'completed'
    WHERE id = v_character_id;

    v_character_status := 'completed';
    v_arc_status := 'completed';
  ELSE
    UPDATE public.characters
    SET current_hp = v_hp_after,
        xp = v_character_xp,
        streak_days = v_new_streak
    WHERE id = v_character_id;
  END IF;

  UPDATE public.daily_progress
  SET completion_percentage = pg_catalog.round(v_completion_percentage, 2),
      hp_change = v_hp_change,
      hp_after = v_hp_after,
      updated_at = v_now
  WHERE id = v_progress_id;

  INSERT INTO public.daily_results AS current_result (
    user_id, arc_id, daily_progress_id, commitment_id, completed,
    xp_awarded, hp_change, hp_after, completed_at, created_at, updated_at
  )
  SELECT v_user_id, v_arc_id, v_progress_id, cm.id,
         COALESCE(prior.completed, false),
         CASE WHEN COALESCE(prior.completed, false) THEN cm.xp_reward ELSE 0 END,
         0,
         v_hp_after,
         CASE
           WHEN COALESCE(prior.completed, false) THEN COALESCE(prior.completed_at, v_now)
           ELSE NULL
         END,
         v_now,
         v_now
  FROM public.commitments AS cm
  LEFT JOIN public.daily_results AS prior
    ON prior.daily_progress_id = v_progress_id
   AND prior.commitment_id = cm.id
  WHERE cm.user_id = v_user_id
    AND cm.arc_id = v_arc_id
  ON CONFLICT (daily_progress_id, commitment_id)
  DO UPDATE SET
    completed = EXCLUDED.completed,
    xp_awarded = EXCLUDED.xp_awarded,
    hp_change = 0,
    hp_after = v_hp_after,
    completed_at = CASE
      WHEN EXCLUDED.completed THEN COALESCE(current_result.completed_at, v_now)
      ELSE NULL
    END,
    updated_at = v_now;

  RETURN pg_catalog.jsonb_build_object(
    'already_evaluated', false,
    'completion_percentage', pg_catalog.round(v_completion_percentage, 2),
    'hp_change', v_hp_change,
    'hp_after', v_hp_after,
    'streak_days', v_new_streak,
    'xp', v_character_xp,
    'character_status', v_character_status,
    'arc_status', v_arc_status,
    'successful_day', v_successful
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.evaluate_today_arc() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.evaluate_today_arc() FROM anon;
GRANT EXECUTE ON FUNCTION public.evaluate_today_arc() TO authenticated;
