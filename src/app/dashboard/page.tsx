import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { AppShell } from "@/src/components/arc/app-shell";
import { ButtonLink } from "@/src/components/arc";
import { StatusMessage } from "@/src/components/arc/ui";
import { ensureProfile, getAuthenticatedIdentity } from "@/src/lib/supabase/onboarding";
import { CommitmentChecklist, type TodayCommitment } from "./commitment-checklist";
import type { TodayGameState } from "./actions";
import { FocusLog } from "./focus-log";
import { logSupabaseError } from "@/src/lib/supabase/diagnostics";
import { DashboardOverview } from "./dashboard-overview";

function dateInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) throw new Error("Unable to determine today's date");
  return `${year}-${month}-${day}`;
}

function calendarDaysBetween(start: string, end: string) {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.floor((endTime - startTime) / 86_400_000);
}

function safeDiagnosticValue(value: string | null | undefined) {
  if (!value) return "(none)";
  return value
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[redacted id]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted token]");
}

export default async function DashboardPage() {
  const supabase = await createClient();

  let identity: { id: string; email: string | null } | null;
  try {
    identity = await getAuthenticatedIdentity(supabase);
  } catch (error) {
    logSupabaseError("dashboard session verification", error);
    return (
      <AppShell activeItem="Home">
        <div className="mx-auto max-w-3xl pt-8">
          <StatusMessage kind="error">We could not verify your session. Refresh the page or log in again.</StatusMessage>
        </div>
      </AppShell>
    );
  }
  if (!identity) redirect("/login");
  const userId = identity.id;

  try {
    await ensureProfile(supabase, userId);
  } catch (error) {
    logSupabaseError("dashboard profile upsert", error);
    return (
      <AppShell activeItem="Home">
        <div className="mx-auto max-w-3xl pt-8">
          <StatusMessage kind="error">We could not prepare your profile. Refresh the page to try again.</StatusMessage>
        </div>
      </AppShell>
    );
  }

  const { data: activeArc, error: arcError } = await supabase
    .from("arcs")
    .select("id, starts_on, ends_on")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (arcError) {
    logSupabaseError("dashboard active Arc query", arcError);
    return (
      <AppShell activeItem="Home">
        <div className="mx-auto max-w-3xl pt-8">
          <StatusMessage kind="error">We could not load your Arc. Refresh the page to try again.</StatusMessage>
        </div>
      </AppShell>
    );
  }
  if (!activeArc) {
    const { data: pendingCharacter, error: pendingCharacterError } = await supabase
      .from("characters")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (pendingCharacterError) {
      logSupabaseError("dashboard onboarding character query", pendingCharacterError);
      return (
        <AppShell activeItem="Home">
          <div className="mx-auto max-w-3xl pt-8">
            <StatusMessage kind="error">We could not load your active character. Refresh the page to try again.</StatusMessage>
          </div>
        </AppShell>
      );
    }
    if (pendingCharacter) redirect("/onboarding");

    const { data: lastCharacter, error: lastCharacterError } = await supabase
      .from("characters")
      .select("id, character_type, status, level, xp, current_hp, streak_days")
      .eq("user_id", userId)
      .in("status", ["dead", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastCharacterError) logSupabaseError("dashboard historical character query", lastCharacterError);

    if (lastCharacter) {
      const isDead = lastCharacter.status === "dead";
      return (
        <AppShell activeItem={isDead ? "History" : "Home"}>
          <section className="mx-auto max-w-3xl border-y border-arc-line py-10 sm:py-14">
            <p className="text-xs text-arc-muted">ARC / {isDead ? "GRAVEYARD" : "COMPLETED"}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{isDead ? "Character lost" : "Arc completed"}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-arc-muted">
              {isDead
                ? "This characterâ€™s record remains in the Graveyard. Dead characters cannot be restored or resurrected."
                : "This Arc and its character remain part of your History. They are not restored as active."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/history" variant="secondary">{isDead ? "VIEW GRAVEYARD" : "VIEW HISTORY"}</ButtonLink>
              <ButtonLink href="/onboarding">BEGIN A NEW ARC</ButtonLink>
            </div>
          </section>
        </AppShell>
      );
    }
    redirect("/onboarding");
  }

  const { data: activeCharacter, error: characterError } = await supabase
    .from("characters")
    .select("id, character_type, level, current_hp, xp, streak_days")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (characterError || !activeCharacter) {
    if (characterError) logSupabaseError("dashboard active character query", characterError);
    return (
      <AppShell activeItem="Home">
        <div className="mx-auto max-w-3xl pt-8">
          <StatusMessage kind="error">We could not load your active character. Refresh the page to try again.</StatusMessage>
        </div>
      </AppShell>
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();

  let today: string;
  try {
    if (profileError) throw profileError;
    today = dateInTimezone(profile?.timezone || "UTC");
  } catch (error) {
    logSupabaseError("dashboard profile timezone query", error);
    return (
      <AppShell activeItem="Home">
        <div className="mx-auto max-w-3xl pt-8">
          <StatusMessage kind="error">We could not determine today for your profile timezone. Refresh the page or check your profile settings.</StatusMessage>
        </div>
      </AppShell>
    );
  }

  const [{ data: commitments, error: commitmentsError }, { data: todayProgress, error: progressError }] = await Promise.all([
    supabase
      .from("commitments")
      .select("id, title, xp_reward")
      .eq("arc_id", activeArc.id),
    supabase
      .from("daily_progress")
      .select("id, completion_percentage, hp_change, hp_after, is_off_day, focus_xp_awarded")
      .eq("arc_id", activeArc.id)
      .eq("progress_date", today)
      .maybeSingle(),
  ]);

  if (commitmentsError || progressError) {
    if (commitmentsError) logSupabaseError("dashboard commitments query", commitmentsError);
    if (progressError) logSupabaseError("dashboard daily_progress query", progressError);
    const failedQueries = [
      commitmentsError ? { query: "Commitments", error: commitmentsError } : null,
      progressError ? { query: "daily_progress", error: progressError } : null,
    ].filter((failure): failure is NonNullable<typeof failure> => failure !== null);

    return (
      <AppShell activeItem="Home">
        <div className="mx-auto max-w-3xl pt-8">
          <StatusMessage kind="error">We could not load today&apos;s Commitments. Refresh the page to try again.</StatusMessage>
          {process.env.NODE_ENV === "development" ? (
            <section aria-label="Supabase query diagnostics" className="mt-5 border border-arc-line p-4 text-sm text-arc-ink">
              <h2 className="font-medium">Development query diagnostics</h2>
              <div className="mt-3 space-y-4">
                {failedQueries.map(({ query, error }) => (
                  <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-[6rem_minmax(0,1fr)]" key={query}>
                    <dt className="text-arc-muted">Query</dt><dd>{query}</dd>
                    <dt className="text-arc-muted">Message</dt><dd className="break-words">{safeDiagnosticValue(error.message)}</dd>
                    <dt className="text-arc-muted">Code</dt><dd>{safeDiagnosticValue(error.code)}</dd>
                    <dt className="text-arc-muted">Details</dt><dd className="break-words">{safeDiagnosticValue(error.details)}</dd>
                    <dt className="text-arc-muted">Hint</dt><dd className="break-words">{safeDiagnosticValue(error.hint)}</dd>
                  </dl>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </AppShell>
    );
  }

  const { data: focusData, error: focusError } = await supabase.rpc("get_today_focus_logs");
  if (focusError) {
    logSupabaseError("dashboard get_today_focus_logs RPC", focusError);
    return (
      <AppShell activeItem="Home">
        <div className="mx-auto max-w-3xl pt-8">
          <StatusMessage kind="error">We could not load today&apos;s Focus Log. Refresh the page to try again.</StatusMessage>
        </div>
      </AppShell>
    );
  }

  const focusPayload = focusData as { total_minutes?: unknown; entries?: unknown } | null;
  const focusEntries = Array.isArray(focusPayload?.entries)
    ? focusPayload.entries.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const row = entry as Record<string, unknown>;
        return typeof row.id === "string" && Number.isInteger(Number(row.minutes)) && typeof row.logged_at === "string"
          ? [{ id: row.id, minutes: Number(row.minutes), loggedAt: row.logged_at, commitmentTitle: typeof row.commitment_title === "string" ? row.commitment_title : null, note: typeof row.note === "string" ? row.note : "" }]
          : [];
      })
    : [];
  const focusTotalMinutes = Number(focusPayload?.total_minutes ?? 0);
  if (!Number.isFinite(focusTotalMinutes)) {
    return (
      <AppShell activeItem="Home">
        <div className="mx-auto max-w-3xl pt-8">
          <StatusMessage kind="error">Today&apos;s Focus Log returned an invalid result. Refresh the page to try again.</StatusMessage>
        </div>
      </AppShell>
    );
  }

  const [year, month] = today.split("-").map(Number);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const { data: monthlyOffDays, error: offDaysError } = await supabase
    .from("daily_progress")
    .select("progress_date")
    .eq("user_id", userId)
    .eq("is_off_day", true)
    .gte("progress_date", monthStart)
    .lt("progress_date", nextMonth);

  if (offDaysError) {
    logSupabaseError("dashboard monthly Off-Day query", offDaysError);
    return (
      <AppShell activeItem="Home">
        <div className="mx-auto max-w-3xl pt-8">
          <StatusMessage kind="error">We could not load your Off-Day allowance. Refresh the page to try again.</StatusMessage>
        </div>
      </AppShell>
    );
  }

  const usedOffDayCount = new Set(monthlyOffDays.map((day) => day.progress_date)).size;
  const offDaysRemaining = Math.max(0, 3 - usedOffDayCount);

  let completedCommitmentIds = new Set<string>();
  if (todayProgress) {
    const { data: results, error: resultsError } = await supabase
      .from("daily_results")
      .select("commitment_id, completed")
      .eq("arc_id", activeArc.id)
      .eq("daily_progress_id", todayProgress.id);

    if (resultsError) {
      logSupabaseError("dashboard daily_results query", resultsError);

      return (
        <AppShell activeItem="Home">
          <div className="mx-auto max-w-3xl pt-8">
            <StatusMessage kind="error">We could not load today&apos;s completion state. Refresh the page to try again.</StatusMessage>
          </div>
        </AppShell>
      );
    }

    completedCommitmentIds = new Set(
      results.filter((result) => result.completed).map((result) => result.commitment_id)
    );
  }

  const todayCommitments: TodayCommitment[] = commitments.map((commitment) => ({
    id: commitment.id,
    title: commitment.title,
    xpReward: commitment.xp_reward,
    completed: completedCommitmentIds.has(commitment.id),
  }));

  const totalCommitmentXp = todayCommitments.reduce((total, item) => total + item.xpReward, 0);
  const completedCommitmentXp = todayCommitments.reduce(
    (total, item) => total + (item.completed ? item.xpReward : 0),
    0
  );
  const savedCompletionPercentage = Number(todayProgress?.completion_percentage ?? 0);
  const savedHpChange = Number(todayProgress?.hp_change ?? 0);
  const todayIsOffDay = todayProgress?.is_off_day === true;
  const todayEvaluated = Boolean(todayProgress && (todayIsOffDay || savedCompletionPercentage !== 0 || savedHpChange !== 0));
  const currentCompletionPercentage = todayEvaluated
    ? savedCompletionPercentage
    : totalCommitmentXp > 0
      ? (completedCommitmentXp * 100) / totalCommitmentXp
      : 0;
  const initialGameState: TodayGameState = {
    completionPercentage: currentCompletionPercentage,
    hpChange: todayEvaluated ? savedHpChange : 0,
    hp: todayEvaluated ? Number(todayProgress?.hp_after ?? activeCharacter.current_hp) : activeCharacter.current_hp,
    streak: activeCharacter.streak_days,
    xp: activeCharacter.xp,
    focusXpAwarded: Number(todayProgress?.focus_xp_awarded ?? 0),
    characterStatus: "active",
    arcStatus: "active",
    alreadyEvaluated: todayEvaluated,
    isOffDay: todayIsOffDay,
  };

  const theme = activeCharacter.character_type === "spider_man" ? "spider-man" : "batman";
  const level = Math.max(1, activeCharacter.level ?? 1);
  const arcDuration = Math.max(1, calendarDaysBetween(activeArc.starts_on, activeArc.ends_on) + 1);
  const arcDay = Math.min(arcDuration, Math.max(1, calendarDaysBetween(activeArc.starts_on, today) + 1));
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${today}T00:00:00Z`));

  return (
    <AppShell activeItem="Home">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-5 flex items-center justify-between border-b border-arc-line pb-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-arc-muted">ARC <span className="mx-2 text-arc-line">/</span> Dashboard</p>
          <p className="text-xs tabular-nums text-arc-muted">{todayLabel}</p>
        </header>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-6">
          <DashboardOverview
            arcDay={arcDay}
            arcDuration={arcDuration}
            arcEndDate={activeArc.ends_on}
            hp={activeCharacter.current_hp}
            level={level}
            name={theme === "batman" ? "Batman" : "Spider-Man"}
            streakDays={activeCharacter.streak_days}
            theme={theme}
            xp={activeCharacter.xp}
          />
        </div>

        <section aria-label="Today's plan" className="mt-6 border-t border-arc-line pt-6">
          <CommitmentChecklist
            initialEvaluated={todayEvaluated}
            initialGameState={initialGameState}
            initialOffDaysRemaining={offDaysRemaining}
            items={todayCommitments}
            theme={theme}
          >
            <FocusLog commitments={todayCommitments.map(({ id, title }) => ({ id, title }))} initialEntries={focusEntries} initialTotalMinutes={focusTotalMinutes} dayFinalized={todayEvaluated} />
          </CommitmentChecklist>
        </section>
      </div>
    </AppShell>
  );
}

