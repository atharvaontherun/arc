import { isAuthSessionMissingError } from "@supabase/supabase-js";
import type { createClient } from "./server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getAuthenticatedIdentity(
  supabase: SupabaseServerClient
): Promise<{ id: string; email: string | null } | null> {
  const { data, error } = await supabase.auth.getClaims();

  if (error && !isAuthSessionMissingError(error)) {
    throw error;
  }

  const subject = data?.claims.sub;
  if (typeof subject !== "string" || subject.length === 0) return null;

  const email = data?.claims.email;
  return { id: subject, email: typeof email === "string" ? email : null };
}

export async function getAuthenticatedUserId(
  supabase: SupabaseServerClient
): Promise<string | null> {
  const identity = await getAuthenticatedIdentity(supabase);
  return identity?.id ?? null;
}

export async function ensureProfile(
  supabase: SupabaseServerClient,
  userId: string
) {
  const { error } = await supabase.from("profiles").upsert(
    { id: userId },
    { onConflict: "id", ignoreDuplicates: true }
  );

  if (error) {
    throw error;
  }
}
