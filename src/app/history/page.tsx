import { redirect } from "next/navigation";
import { AppShell, EmptyState, Eyebrow, GraveyardArchive, HistoryTimeline, type HistoryRecord } from "@/src/components/arc";
import { createClient } from "@/src/lib/supabase/server";
import { getAuthenticatedIdentity } from "@/src/lib/supabase/onboarding";
import { logSupabaseError } from "@/src/lib/supabase/diagnostics";

type CharacterRow = {
  id: string;
  character_type: "batman" | "spider_man";
  status: "completed" | "dead";
  xp: number;
  current_hp: number;
  created_at: string;
};

type ArcRow = {
  id: string;
  character_id: string;
  status: "completed" | "failed";
  starts_on: string;
  ends_on: string;
};

type DailyProgressRow = {
  id: string;
  arc_id: string;
  progress_date: string;
  completion_percentage: number;
  hp_change: number;
  hp_after: number;
  is_off_day: boolean;
  focus_xp_awarded: number;
};

function characterName(type: CharacterRow["character_type"]) {
  return type === "spider_man" ? "Spider-Man" : "Batman";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export default async function HistoryPage() {
  const supabase = await createClient();
  let identity: Awaited<ReturnType<typeof getAuthenticatedIdentity>>;
  try {
    identity = await getAuthenticatedIdentity(supabase);
  } catch (error) {
    logSupabaseError("history session verification", error);
    return (
      <AppShell activeItem="History">
        <p className="border-l-2 border-arc-danger py-1 pl-3 text-sm text-arc-danger" role="alert">
          We could not verify your session. Refresh the page or log in again.
        </p>
      </AppShell>
    );
  }
  if (!identity) redirect("/login");

  const [
    { data: characters, error: charactersError },
    { data: arcs, error: arcsError },
    { data: dailyProgress, error: progressError },
    { data: focusPayload, error: focusError },
  ] = await Promise.all([
    supabase
      .from("characters")
      .select("id, character_type, status, xp, current_hp, created_at")
      .eq("user_id", identity.id)
      .in("status", ["completed", "dead"]),
    supabase
      .from("arcs")
      .select("id, character_id, status, starts_on, ends_on")
      .eq("user_id", identity.id)
      .in("status", ["completed", "failed"]),
    supabase
      .from("daily_progress")
      .select("id, arc_id, progress_date, completion_percentage, hp_change, hp_after, is_off_day, focus_xp_awarded")
      .eq("user_id", identity.id)
      .order("progress_date", { ascending: false }),
    supabase.rpc("get_focus_history"),
  ]);

  let queryFailed = Boolean(charactersError || arcsError || progressError || focusError);
  if (charactersError) logSupabaseError("history characters query", charactersError);
  if (arcsError) logSupabaseError("history Arcs query", arcsError);
  if (progressError) logSupabaseError("history daily_progress query", progressError);
  if (focusError) logSupabaseError("history get_focus_history RPC", focusError);
  const characterRows = (characters ?? []) as CharacterRow[];
  const arcRows = (arcs ?? []) as ArcRow[];
  const progressRows = (dailyProgress ?? []) as DailyProgressRow[];
  const characterById = new Map(characterRows.map((character) => [character.id, character]));

  const dailyResults = progressRows.length
    ? await supabase
        .from("daily_results")
        .select("daily_progress_id, completed")
        .eq("user_id", identity.id)
        .in("daily_progress_id", progressRows.map((progress) => progress.id))
    : { data: [], error: null };
  if (dailyResults.error) {
    queryFailed = true;
    logSupabaseError("history daily_results query", dailyResults.error);
  }
  const resultCounts = new Map<string, { completed: number; total: number }>();
  for (const result of dailyResults.data ?? []) {
    const counts = resultCounts.get(result.daily_progress_id) ?? { completed: 0, total: 0 };
    counts.total += 1;
    if (result.completed) counts.completed += 1;
    resultCounts.set(result.daily_progress_id, counts);
  }

  const dailyRecords: HistoryRecord[] = progressRows
    .filter((progress) => progress.is_off_day || Number(progress.completion_percentage) !== 0 || Number(progress.hp_change) !== 0)
    .map((progress) => {
    const counts = resultCounts.get(progress.id) ?? { completed: 0, total: 0 };
    const description = progress.is_off_day
      ? "Off-Day. HP, XP, and streak preserved."
      : `${counts.completed} of ${counts.total} Commitments completed · ${Number(progress.completion_percentage).toFixed(2)}% · HP ${progress.hp_change > 0 ? "+" : ""}${progress.hp_change}`;
    return {
      id: progress.id,
      kind: "day",
      title: progress.is_off_day ? "Protected Off-Day" : "Day evaluated",
      date: formatDate(progress.progress_date),
      description: progress.is_off_day ? description : `${description} · ${Number(progress.focus_xp_awarded) || 0} Focus XP`,
    };
  });

  const completedArcs: HistoryRecord[] = arcRows
    .filter((arc) => arc.status === "completed")
    .map((arc) => {
      const character = characterById.get(arc.character_id);
      return {
        id: arc.id,
        kind: "arc",
        title: `${character ? characterName(character.character_type) : "Character"} Arc`,
        date: formatDate(arc.ends_on),
        description: `Completed ${formatDate(arc.starts_on)} – ${formatDate(arc.ends_on)}.`,
      };
    });

  const failedArcs: HistoryRecord[] = arcRows
    .filter((arc) => arc.status === "failed")
    .map((arc) => {
      const character = characterById.get(arc.character_id);
      return {
        id: arc.id,
        kind: "failed-arc",
        title: `${character ? characterName(character.character_type) : "Character"} Arc`,
        date: formatDate(arc.ends_on),
        description: `Failed ${formatDate(arc.starts_on)} – ${formatDate(arc.ends_on)}. The character record remains permanently in the Graveyard.`,
      };
    });

  const deadCharacters: HistoryRecord[] = characterRows
    .filter((character) => character.status === "dead")
    .map((character) => {
      const characterArcs = arcRows.filter((arc) => arc.character_id === character.id);
      const finalArc = characterArcs.sort((a, b) => b.ends_on.localeCompare(a.ends_on))[0];
      return {
        id: character.id,
        kind: "graveyard",
        title: characterName(character.character_type),
        date: formatDate(finalArc?.ends_on ?? character.created_at),
        description: `Arc failed. Final HP ${character.current_hp}; ${character.xp} XP earned. This character remains archived.`,
      };
    });

  const focusRecords: HistoryRecord[] = (() => {
    if (!focusPayload || typeof focusPayload !== "object") return [];
    const entries = (focusPayload as Record<string, unknown>).entries;
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      if (typeof row.id !== "string" || typeof row.logged_at !== "string") return [];
      return [{
        id: row.id,
        kind: "focus" as const,
        title: `${Number(row.minutes) || 0} Focus minutes`,
        date: formatDate(row.logged_at),
        description: [typeof row.commitment_title === "string" ? `Commitment: ${row.commitment_title}` : "General Focus", typeof row.note === "string" && row.note ? row.note : null].filter(Boolean).join(" · "),
      }];
    });
  })();

  return (
    <AppShell activeItem="History">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-12 lg:gap-x-10 2xl:gap-x-20">
        <header className="border-b border-arc-line pb-6 pt-4 lg:col-span-8 lg:col-start-2">
          <Eyebrow>ARC / HISTORY</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">History</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-arc-muted">Completed Arcs and character records, kept as part of your history.</p>
        </header>

        <div className="space-y-12 pt-8 lg:col-span-8 lg:col-start-2">
          {queryFailed ? (
            <p className="border-l-2 border-arc-danger py-1 pl-3 text-sm text-arc-danger" role="alert">We could not load your History. Refresh the page to try again.</p>
          ) : null}

          <section aria-labelledby="completed-arcs-heading">
            <Eyebrow>Completed Arcs</Eyebrow>
            <h2 className="sr-only" id="completed-arcs-heading">Completed Arcs</h2>
            {completedArcs.length ? <HistoryTimeline records={completedArcs} /> : <EmptyState title="No completed Arcs yet" description="Completed Arcs will remain available here as a historical record." />}
          </section>

          <section aria-labelledby="daily-history-heading">
            <Eyebrow>Daily Records</Eyebrow>
            <h2 className="sr-only" id="daily-history-heading">Daily Records</h2>
            {dailyRecords.length ? <HistoryTimeline records={dailyRecords} /> : <EmptyState title="No evaluated days yet" description="Daily results and protected Off-Days will be recorded here." />}
          </section>

          <section aria-labelledby="failed-arcs-heading">
            <Eyebrow>Failed Arcs</Eyebrow>
            <h2 className="sr-only" id="failed-arcs-heading">Failed Arcs</h2>
            {failedArcs.length ? <HistoryTimeline records={failedArcs} /> : <EmptyState title="No failed Arcs" description="If an Arc fails, its record remains here and its dead character remains in the Graveyard." />}
          </section>

          <section aria-labelledby="focus-history-heading">
            <Eyebrow>Focus</Eyebrow>
            <h2 className="sr-only" id="focus-history-heading">Focus Logs</h2>
            {focusRecords.length ? <HistoryTimeline records={focusRecords} /> : <EmptyState title="No Focus Logs yet" description="Manually logged Focus minutes will appear here." />}
          </section>

          <GraveyardArchive>
            {deadCharacters.length ? <HistoryTimeline records={deadCharacters} /> : <EmptyState title="The Graveyard is empty" description="If a character dies, their record will remain here permanently. Characters cannot be restored or resurrected." />}
          </GraveyardArchive>
        </div>
      </div>
    </AppShell>
  );
}
