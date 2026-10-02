import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, ArcDetailHeader, ArcProgress, CommitmentList, EmptyState, Eyebrow, StatusMessage } from "@/src/components/arc";
import { createClient } from "@/src/lib/supabase/server";
import { getAuthenticatedIdentity } from "@/src/lib/supabase/onboarding";
import { logSupabaseError } from "@/src/lib/supabase/diagnostics";

function dateInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function daysBetween(start: string, end: string) {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

export default async function ArcPage() {
  const supabase = await createClient();
  let identity: Awaited<ReturnType<typeof getAuthenticatedIdentity>>;
  try {
    identity = await getAuthenticatedIdentity(supabase);
  } catch (error) {
    logSupabaseError("Arc session verification", error);
    return <AppShell activeItem="Arc"><StatusMessage kind="error">We could not verify your session. Refresh and try again.</StatusMessage></AppShell>;
  }
  if (!identity) redirect("/login");

  const { data: arc, error: arcError } = await supabase
    .from("arcs")
    .select("id, title, duration_days, starts_on, ends_on, character_id")
    .eq("user_id", identity.id)
    .eq("status", "active")
    .maybeSingle();

  if (arcError) {
    logSupabaseError("Arc active Arc query", arcError);
    return <AppShell activeItem="Arc"><StatusMessage kind="error">We could not load your Arc. Refresh the page to try again.</StatusMessage></AppShell>;
  }
  if (!arc) {
    return (
      <AppShell activeItem="Arc">
        <EmptyState title="No active Arc" description="Create an Arc and daily Commitments to begin." action={<Link className="inline-flex min-h-10 items-center border border-arc-line px-3 text-xs font-medium text-arc-ink" href="/onboarding">BEGIN YOUR ARC</Link>} />
      </AppShell>
    );
  }

  const [{ data: commitments, error: commitmentsError }, { data: character, error: characterError }, { data: profile, error: profileError }, { data: progress, error: progressError }] = await Promise.all([
    supabase.from("commitments").select("id, title, xp_reward").eq("arc_id", arc.id).eq("user_id", identity.id).order("created_at"),
    supabase.from("characters").select("character_type").eq("id", arc.character_id).eq("user_id", identity.id).eq("status", "active").maybeSingle(),
    supabase.from("profiles").select("timezone").eq("id", identity.id).maybeSingle(),
    supabase.from("daily_progress").select("progress_date, completion_percentage, hp_change, is_off_day, focus_xp_awarded").eq("arc_id", arc.id).eq("user_id", identity.id),
  ]);

  if (commitmentsError || characterError || profileError || progressError) {
    if (commitmentsError) logSupabaseError("Arc commitments query", commitmentsError);
    if (characterError) logSupabaseError("Arc character query", characterError);
    if (profileError) logSupabaseError("Arc profile timezone query", profileError);
    if (progressError) logSupabaseError("Arc daily progress query", progressError);
    return <AppShell activeItem="Arc"><StatusMessage kind="error">We could not load your Arc details. Refresh the page to try again.</StatusMessage></AppShell>;
  }

  const today = dateInTimezone(profile?.timezone || "UTC");
  const currentDay = today < arc.starts_on ? 0 : Math.min(arc.duration_days, daysBetween(arc.starts_on, today) + 1);
  const characterLabel = character?.character_type === "spider_man" ? "Spider-Man" : "Batman";
  const finalizedDays = progress.filter((day) => day.is_off_day || Number(day.completion_percentage) !== 0 || Number(day.hp_change) !== 0);
  const evaluatedDays = finalizedDays.filter((day) => !day.is_off_day);
  const averageCompletion = evaluatedDays.length
    ? evaluatedDays.reduce((sum, day) => sum + Number(day.completion_percentage), 0) / evaluatedDays.length
    : 0;
  const usedOffDays = finalizedDays.filter((day) => day.is_off_day).length;
  const focusXpAwarded = finalizedDays.reduce((sum, day) => sum + Number(day.focus_xp_awarded ?? 0), 0);

  return (
    <AppShell activeItem="Arc">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-12 lg:gap-x-10 2xl:gap-x-20">
        <div className="border-b border-arc-line pb-6 pt-4 lg:col-span-8 lg:col-start-2">
          <ArcDetailHeader title={arc.title} description={`${characterLabel} · ${arc.duration_days}-day Arc`} />
        </div>
        <section className="space-y-7 pt-8 lg:col-span-4 lg:col-start-2 lg:row-start-2" aria-label="Arc details">
          <dl className="divide-y divide-arc-line border-y border-arc-line">
            <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-arc-muted">Status</dt><dd>Active</dd></div>
            <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-arc-muted">Starts</dt><dd>{dateLabel(arc.starts_on)}</dd></div>
            <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-arc-muted">Ends</dt><dd>{dateLabel(arc.ends_on)}</dd></div>
            <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-arc-muted">Evaluated days</dt><dd>{evaluatedDays.length}</dd></div>
            <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-arc-muted">Average completion</dt><dd>{averageCompletion.toFixed(1)}%</dd></div>
            <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-arc-muted">Focus bonus XP</dt><dd>{focusXpAwarded}</dd></div>
            <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-arc-muted">Off-Days used</dt><dd>{usedOffDays}</dd></div>
          </dl>
          <ArcProgress value={currentDay} total={arc.duration_days} />
          <p className="text-xs text-arc-muted">Day {currentDay} of {arc.duration_days}</p>
        </section>
        <section className="pt-8 lg:col-span-8 lg:col-start-6 lg:row-start-2" aria-labelledby="arc-commitments-heading">
          <Eyebrow>Locked for this Arc</Eyebrow>
          <h2 className="mt-2 text-xl font-semibold" id="arc-commitments-heading">Daily Commitments</h2>
          <p className="mt-2 text-sm leading-6 text-arc-muted">These Commitments repeat each day and stay fixed for the duration of the Arc.</p>
          <div className="mt-5">
            {commitments.length ? <CommitmentList items={commitments.map((item) => ({ id: item.id, title: item.title, detail: `${item.xp_reward} XP each day` }))} /> : <EmptyState title="No Commitments found" description="This Arc has no daily Commitments." />}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
