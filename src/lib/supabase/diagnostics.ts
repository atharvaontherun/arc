type SupabaseErrorDetails = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

/** Log Supabase failures in development without exposing session or user data. */
export function logSupabaseError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "development" || !error || typeof error !== "object") return;

  const value = error as SupabaseErrorDetails;
  console.error(`[Supabase] ${context}`, {
    code: value.code,
    message: value.message,
    details: value.details,
    hint: value.hint,
  });
}
