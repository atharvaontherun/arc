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
  LIMIT 1;

  IF v_arc_id IS NULL THEN
    RAISE EXCEPTION 'No active Arc and character found' USING ERRCODE = '42501';
  END IF;

  v_today := pg_catalog.timezone(v_timezone, pg_catalog.now())::date;

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
    user_id,
    arc_id,
    progress_date,
    completion_percentage,
    completed_xp,
    hp_after,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_arc_id,
    v_today,
    0,
    0,
    v_character_hp,
    pg_catalog.now(),
    pg_catalog.now()
  )
  ON CONFLICT (arc_id, progress_date) DO NOTHING;

  SELECT dp.id
    INTO v_progress_id
  FROM public.daily_progress AS dp
  WHERE dp.arc_id = v_arc_id
    AND dp.progress_date = v_today;

  INSERT INTO public.daily_results (user_id, arc_id, progress_id, commitment_id, completed)
  VALUES (v_user_id, v_arc_id, v_progress_id, p_commitment_id, p_completed)
  ON CONFLICT (progress_id, commitment_id)
  DO UPDATE SET completed = EXCLUDED.completed;
END;
$function$;
