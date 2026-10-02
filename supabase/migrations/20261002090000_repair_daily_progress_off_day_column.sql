ALTER TABLE public.daily_progress
  ADD COLUMN IF NOT EXISTS is_off_day boolean;

-- Historical rows are ordinary daily records unless explicitly marked as Off-Days.
UPDATE public.daily_progress
SET is_off_day = false
WHERE is_off_day IS NULL;

ALTER TABLE public.daily_progress
  ALTER COLUMN is_off_day SET DEFAULT false,
  ALTER COLUMN is_off_day SET NOT NULL;
