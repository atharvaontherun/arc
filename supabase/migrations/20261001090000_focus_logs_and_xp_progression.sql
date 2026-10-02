ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1;

UPDATE public.characters
SET level = pg_catalog.floor((1 + pg_catalog.sqrt(1 + 0.08 * xp)) / 2)::integer
WHERE level IS DISTINCT FROM pg_catalog.floor((1 + pg_catalog.sqrt(1 + 0.08 * xp)) / 2)::integer;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.focus_logs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._focus_log_payload(p_today_only boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_timezone text := 'UTC';
  v_today date;
  v_active_arc_id uuid;
  v_total_minutes bigint;
  v_entries jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT COALESCE(NULLIF(p.timezone, ''), 'UTC')
    INTO v_timezone
  FROM public.profiles AS p
  WHERE p.id = v_user_id;
  v_timezone := COALESCE(v_timezone, 'UTC');
  v_today := pg_catalog.timezone(v_timezone, pg_catalog.now())::date;

  IF p_today_only THEN
    SELECT a.id INTO v_active_arc_id
    FROM public.arcs AS a
    JOIN public.characters AS c
      ON c.id = a.character_id
     AND c.user_id = v_user_id
     AND c.status = 'active'
    WHERE a.user_id = v_user_id
      AND a.status = 'active';
  END IF;

  SELECT COALESCE(pg_catalog.sum(fl.focus_minutes), 0),
         COALESCE(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'id', fl.id,
               'minutes', fl.focus_minutes,
               'commitment_id', fl.commitment_id,
               'commitment_title', cm.title,
               'logged_at', fl.logged_at,
               'note', COALESCE(fl.note, '')
             ) ORDER BY fl.logged_at, fl.id
           ),
           '[]'::jsonb
         )
    INTO v_total_minutes, v_entries
  FROM public.focus_logs AS fl
  LEFT JOIN public.commitments AS cm
    ON cm.id = fl.commitment_id
   AND cm.user_id = v_user_id
   AND cm.arc_id = fl.arc_id
  WHERE fl.user_id = v_user_id
    AND (NOT p_today_only OR (
      v_active_arc_id IS NOT NULL
      AND fl.arc_id = v_active_arc_id
      AND (fl.logged_at AT TIME ZONE v_timezone)::date = v_today
    ));

  RETURN pg_catalog.jsonb_build_object(
    'total_minutes', v_total_minutes,
    'entries', v_entries
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_today_focus_logs()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT public._focus_log_payload(true);
$function$;

CREATE OR REPLACE FUNCTION public.get_focus_history()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT public._focus_log_payload(false);
$function$;

DROP FUNCTION IF EXISTS public.log_focus_session(integer, uuid);

CREATE OR REPLACE FUNCTION public.log_focus_session(
  p_focus_minutes integer,
  p_commitment_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_character_id uuid;
  v_arc_id uuid;
  v_starts_on date;
  v_ends_on date;
  v_timezone text;
  v_today date;
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_focus_minutes IS NULL OR p_focus_minutes < 1 THEN
    RAISE EXCEPTION 'Focus minutes must be a positive whole number' USING ERRCODE = '22023';
  END IF;

  SELECT c.id, a.id, a.starts_on, a.ends_on, COALESCE(NULLIF(p.timezone, ''), 'UTC')
    INTO v_character_id, v_arc_id, v_starts_on, v_ends_on, v_timezone
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

  v_today := pg_catalog.timezone(COALESCE(v_timezone, 'UTC'), pg_catalog.now())::date;
  IF v_today < v_starts_on OR v_today > v_ends_on THEN
    RAISE EXCEPTION 'Today is outside the active Arc dates' USING ERRCODE = '22023';
  END IF;
  IF p_commitment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.commitments AS cm
    WHERE cm.id = p_commitment_id
      AND cm.user_id = v_user_id
      AND cm.arc_id = v_arc_id
  ) THEN
    RAISE EXCEPTION 'Commitment does not belong to the active Arc' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.focus_logs (
    id, user_id, character_id, arc_id, commitment_id,
    logged_at, focus_minutes, note, created_at
  ) VALUES (
    pg_catalog.gen_random_uuid(), v_user_id, v_character_id, v_arc_id, p_commitment_id,
    v_now, p_focus_minutes, COALESCE(p_note, ''), v_now
  );
  RETURN public._focus_log_payload(true);
END;
$function$;

REVOKE ALL ON FUNCTION public._focus_log_payload(boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_today_focus_logs() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_focus_history() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_focus_session(integer, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_today_focus_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_focus_history() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_focus_session(integer, uuid, text) TO authenticated;


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
  v_character_level integer;
  v_remaining_xp bigint;
  v_normalized_xp bigint;
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
  v_is_off_day boolean;
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
         c.current_hp, c.xp, c.level, c.streak_days,
         c.status::text, a.status::text
    INTO v_arc_id, v_character_id, v_starts_on, v_ends_on,
         v_current_hp, v_character_xp, v_character_level, v_streak_days,
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
           dp.is_off_day, c.xp, c.level, c.streak_days, c.status::text, a.status::text
      INTO v_arc_id, v_completion_percentage, v_hp_change, v_hp_after,
           v_is_off_day, v_character_xp, v_character_level, v_streak_days, v_character_status, v_arc_status
    FROM public.daily_progress AS dp
    JOIN public.arcs AS a ON a.id = dp.arc_id AND a.user_id = v_user_id
    JOIN public.characters AS c ON c.id = a.character_id AND c.user_id = v_user_id
    WHERE dp.user_id = v_user_id
      AND dp.progress_date = v_today
      AND (dp.is_off_day OR dp.completion_percentage <> 0 OR dp.hp_change <> 0)
    ORDER BY dp.created_at DESC
    LIMIT 1;

    IF v_arc_id IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'already_evaluated', true,
        'is_off_day', v_is_off_day,
        'completion_percentage', v_completion_percentage,
        'hp_change', v_hp_change,
        'hp_after', v_hp_after,
        'streak_days', v_streak_days,
        'xp', v_character_xp,
        'level', v_character_level,
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
    hp_change, hp_after, is_off_day, created_at, updated_at
  )
  VALUES (v_user_id, v_arc_id, v_today, 0, 0, v_current_hp, false, v_now, v_now)
  ON CONFLICT (arc_id, progress_date) DO NOTHING;

  SELECT dp.id, dp.completion_percentage, dp.hp_change, dp.hp_after, dp.is_off_day
    INTO v_progress_id, v_completion_percentage, v_hp_change, v_hp_after, v_is_off_day
  FROM public.daily_progress AS dp
  WHERE dp.user_id = v_user_id
    AND dp.arc_id = v_arc_id
    AND dp.progress_date = v_today
  FOR UPDATE;

  IF v_is_off_day THEN
    RETURN pg_catalog.jsonb_build_object(
      'already_evaluated', true,
      'is_off_day', true,
      'completion_percentage', 0,
      'hp_change', 0,
      'hp_after', v_current_hp,
      'streak_days', v_streak_days,
      'xp', v_character_xp,
      'level', v_character_level,
      'character_status', v_character_status,
      'arc_status', v_arc_status
    );
  END IF;

  IF v_completion_percentage <> 0 OR v_hp_change <> 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'already_evaluated', true,
      'is_off_day', false,
      'completion_percentage', v_completion_percentage,
      'hp_change', v_hp_change,
      'hp_after', v_hp_after,
      'streak_days', v_streak_days,
      'xp', v_character_xp,
      'level', v_character_level,
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
  v_normalized_xp := pg_catalog.round(v_completed_xp::numeric * 100 / v_total_xp)::bigint;
  v_character_xp := v_character_xp + v_normalized_xp;
  v_character_level := 1;
  v_remaining_xp := v_character_xp;
  WHILE v_remaining_xp >= (100::bigint * v_character_level) LOOP
    v_remaining_xp := v_remaining_xp - (100::bigint * v_character_level);
    v_character_level := v_character_level + 1;
  END LOOP;

  IF v_hp_after = 0 THEN
    UPDATE public.arcs SET status = 'failed' WHERE id = v_arc_id;

    UPDATE public.characters
    SET current_hp = v_hp_after,
        xp = v_character_xp,
        level = v_character_level,
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
        level = v_character_level,
        streak_days = v_new_streak,
        status = 'completed'
    WHERE id = v_character_id;

    v_character_status := 'completed';
    v_arc_status := 'completed';
  ELSE
    UPDATE public.characters
    SET current_hp = v_hp_after,
        xp = v_character_xp,
        level = v_character_level,
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
         0,
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

  IF v_completed_xp > 0 AND v_normalized_xp > 0 THEN
    WITH raw_shares AS (
      SELECT dr.id,
             dr.commitment_id,
             pg_catalog.floor(v_normalized_xp::numeric * cm.xp_reward / v_completed_xp)::bigint AS base_xp,
             pg_catalog.mod(v_normalized_xp::numeric * cm.xp_reward, v_completed_xp::numeric) AS fractional_remainder
      FROM public.daily_results AS dr
      JOIN public.commitments AS cm
        ON cm.id = dr.commitment_id
       AND cm.user_id = v_user_id
       AND cm.arc_id = v_arc_id
      WHERE dr.daily_progress_id = v_progress_id
        AND dr.completed
    ), ranked_shares AS (
      SELECT raw_shares.*,
             pg_catalog.row_number() OVER (ORDER BY fractional_remainder DESC, commitment_id) AS share_rank,
             v_normalized_xp - pg_catalog.sum(base_xp) OVER () AS leftover_xp
      FROM raw_shares
    )
    UPDATE public.daily_results AS dr
    SET xp_awarded = (ranked_shares.base_xp + CASE WHEN ranked_shares.share_rank <= ranked_shares.leftover_xp THEN 1 ELSE 0 END)::integer,
        updated_at = v_now
    FROM ranked_shares
    WHERE dr.id = ranked_shares.id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'already_evaluated', false,
    'is_off_day', false,
    'completion_percentage', pg_catalog.round(v_completion_percentage, 2),
    'hp_change', v_hp_change,
    'hp_after', v_hp_after,
    'streak_days', v_new_streak,
    'xp', v_character_xp,
    'level', v_character_level,
    'character_status', v_character_status,
    'arc_status', v_arc_status,
    'successful_day', v_successful
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.evaluate_today_arc() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_today_arc() TO authenticated;
