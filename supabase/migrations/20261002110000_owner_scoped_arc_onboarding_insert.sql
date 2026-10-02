BEGIN;

ALTER TABLE public.arcs ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON TABLE public.arcs TO authenticated;

DROP POLICY IF EXISTS arcs_insert_authenticated_owner_active_character
  ON public.arcs;

CREATE POLICY arcs_insert_authenticated_owner_active_character
  ON public.arcs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.characters AS c
      WHERE c.id = arcs.character_id
        AND c.user_id = (SELECT auth.uid())
        AND c.status = 'active'
    )
  );

COMMIT;
