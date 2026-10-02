import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, EmptyState, Eyebrow, ProgressSummary, SettingsSection, StatusMessage } from "@/src/components/arc";
import { createClient } from "@/src/lib/supabase/server";
import { getAuthenticatedIdentity } from "@/src/lib/supabase/onboarding";
import { logSupabaseError } from "@/src/lib/supabase/diagnostics";

export default async function ProfilePage() {
  const supabase = await createClient();
  let identity: Awaited<ReturnType<typeof getAuthenticatedIdentity>>;
  try {
    identity = await getAuthenticatedIdentity(supabase);
  } catch (error) {
    logSupabaseError("Profile session verification", error);
    return <AppShell activeItem="Profile"><StatusMessage kind="error">We could not verify your session. Refresh and try again.</StatusMessage></AppShell>;
  }
  if (!identity) redirect("/login");

  const [{ data: profile, error: profileError }, { data: character, error: characterError }, { data: arc, error: arcError }] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", identity.id).maybeSingle(),
    supabase.from("characters").select("character_type, level, current_hp, xp, streak_days").eq("user_id", identity.id).eq("status", "active").maybeSingle(),
    supabase.from("arcs").select("id, title, duration_days").eq("user_id", identity.id).eq("status", "active").maybeSingle(),
  ]);

  if (profileError || characterError || arcError) {
    if (profileError) logSupabaseError("Profile profile query", profileError);
    if (characterError) logSupabaseError("Profile active character query", characterError);
    if (arcError) logSupabaseError("Profile active Arc query", arcError);
    return <AppShell activeItem="Profile"><StatusMessage kind="error">We could not load your Profile. Refresh the page to try again.</StatusMessage></AppShell>;
  }

  const theme = character?.character_type === "spider_man" ? "spider-man" : "batman";
  const level = Math.max(1, character?.level ?? 1);

  return (
    <AppShell activeItem="Profile">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-12 lg:gap-x-10 2xl:gap-x-20">
        <header className="border-b border-arc-line pb-6 pt-4 lg:col-span-8 lg:col-start-2">
          <Eyebrow>ARC / PROFILE</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-arc-muted">Your account and current character record.</p>
        </header>

        <section className="pt-8 lg:col-span-4 lg:col-start-2 lg:row-start-2" aria-label="Current character">
          {character ? (
            <ProgressSummary name={theme === "spider-man" ? "Spider-Man" : "Batman"} theme={theme} level={level} hp={character.current_hp} maxHp={100} xp={character.xp} nextLevelXp={100 * level} streakDays={character.streak_days} />
          ) : (
            <EmptyState title="No active character" description="Completed and dead characters remain in History and the Graveyard." action={<Link className="inline-flex min-h-10 items-center border border-arc-line px-3 text-xs font-medium text-arc-ink" href="/history">VIEW HISTORY</Link>} />
          )}
        </section>

        <section className="space-y-8 pt-8 lg:col-span-8 lg:col-start-6 lg:row-start-2">
          <SettingsSection>
            <dl>
            <div className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]"><dt className="text-sm text-arc-muted">Email</dt><dd className="break-words text-sm text-arc-ink">{identity.email ?? "Unavailable"}</dd></div>
            <div className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]"><dt className="text-sm text-arc-muted">Timezone</dt><dd className="text-sm text-arc-ink">{profile?.timezone || "UTC"}</dd></div>
            <div className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]"><dt className="text-sm text-arc-muted">Character</dt><dd className="text-sm text-arc-ink">{character ? `${theme === "spider-man" ? "Spider-Man" : "Batman"} · Level ${level}` : "No active character"}</dd></div>
            </dl>
          </SettingsSection>

          <section className="border-t border-arc-line pt-6" aria-labelledby="profile-arc-heading">
            <Eyebrow>Current Arc</Eyebrow>
            <h2 className="mt-2 text-xl font-semibold" id="profile-arc-heading">{arc?.title ?? "No active Arc"}</h2>
            {arc ? <p className="mt-2 text-sm text-arc-muted">{arc.duration_days}-day Arc</p> : <p className="mt-2 text-sm text-arc-muted">Start an Arc to begin tracking daily Commitments.</p>}
            <Link className="mt-4 inline-flex min-h-10 items-center border border-arc-line px-3 text-xs font-medium text-arc-ink transition-colors hover:border-arc-muted" href={arc ? "/arc" : "/onboarding"}>{arc ? "VIEW ARC DETAILS" : "BEGIN AN ARC"}</Link>
          </section>
        </section>
      </div>
    </AppShell>
  );
}
