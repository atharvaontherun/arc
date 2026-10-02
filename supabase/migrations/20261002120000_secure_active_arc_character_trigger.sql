BEGIN;

ALTER FUNCTION public.enforce_active_arc_character()
  SECURITY DEFINER
  SET search_path = '';

COMMIT;
