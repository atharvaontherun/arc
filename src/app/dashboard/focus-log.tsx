"use client";

import { useState } from "react";
import { logFocusMinutes, type FocusEntry } from "./actions";

export function FocusLog({
  commitments,
  initialEntries,
  initialTotalMinutes,
  dayFinalized,
}: {
  commitments: Array<{ id: string; title: string }>;
  initialEntries: FocusEntry[];
  initialTotalMinutes: number;
  dayFinalized: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [totalMinutes, setTotalMinutes] = useState(initialTotalMinutes);
  const [minutes, setMinutes] = useState(25);
  const [commitmentId, setCommitmentId] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await logFocusMinutes(minutes, commitmentId || null, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEntries(result.entries);
      setTotalMinutes(result.totalMinutes);
      setNote("");
      setSuccess(true);
    } catch {
      setError("We could not save that Focus Log. Refresh and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="focus-log-heading" className="border border-arc-line bg-arc-panel/20 px-4 py-5 sm:px-5 sm:py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-arc-muted">TODAY</p>
          <h2 className="mt-2 font-serif text-xl tracking-[0.04em]" id="focus-log-heading">Focus</h2>
        </div>
        <p className="border border-arc-line px-3 py-2 text-sm tabular-nums text-arc-ink"><span className="font-medium">{totalMinutes}</span><span className="ml-1 text-arc-muted">min today</span></p>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-arc-muted">Each focused minute adds one bonus XP at daily evaluation. Focus does not count toward Commitment completion, and an Off-Day awards no Focus XP.</p>
      {dayFinalized ? <p className="mt-2 text-xs text-arc-muted">Today&apos;s result is final. New Focus Logs cannot earn XP for this day.</p> : null}

      <form className="mt-6 grid gap-4 border-y border-arc-line py-5 sm:grid-cols-2 sm:items-end" onSubmit={(event) => void submit(event)}>
        <label className="space-y-2 text-sm text-arc-ink">
          <span className="block">Minutes</span>
          <input
            className="min-h-11 w-full border border-arc-line bg-transparent px-3 text-base text-arc-ink outline-none focus:border-arc-muted focus:ring-1 focus:ring-arc-muted/35"
            min={1}
            disabled={pending || dayFinalized}
            onChange={(event) => setMinutes(Number(event.currentTarget.value))}
            required
            step={1}
            type="number"
            value={minutes}
          />
        </label>
        <label className="space-y-2 text-sm text-arc-ink">
          <span className="block">Commitment <span className="text-arc-muted">(optional)</span></span>
          <select
            className="min-h-11 w-full border border-arc-line bg-arc-bg px-3 text-base text-arc-ink outline-none focus:border-arc-muted focus:ring-1 focus:ring-arc-muted/35"
            disabled={pending || dayFinalized}
            onChange={(event) => setCommitmentId(event.currentTarget.value)}
            value={commitmentId}
          >
            <option value="">General Focus</option>
            {commitments.map((commitment) => <option key={commitment.id} value={commitment.id}>{commitment.title}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm text-arc-ink sm:col-span-2">
          <span className="block">Note <span className="text-arc-muted">(optional)</span></span>
          <input
            className="min-h-11 w-full border border-arc-line bg-transparent px-3 text-base text-arc-ink outline-none focus:border-arc-muted focus:ring-1 focus:ring-arc-muted/35"
            disabled={pending || dayFinalized}
            maxLength={1000}
            onChange={(event) => setNote(event.currentTarget.value)}
            value={note}
          />
        </label>
        <button className="min-h-11 border border-arc-line px-4 text-sm font-medium text-arc-ink transition-colors hover:border-arc-muted hover:bg-white/[0.035] disabled:cursor-not-allowed disabled:opacity-45 sm:col-span-2" disabled={pending || dayFinalized || minutes < 1 || minutes > 2_147_483_647} type="submit">
          {pending ? "SAVING…" : "LOG FOCUS"}
        </button>
      </form>

      {error ? <p aria-live="assertive" className="mt-4 border-l-2 border-arc-danger py-1 pl-3 text-sm text-arc-danger" role="alert">{error}</p> : null}
      {success ? <p aria-live="polite" className="mt-4 text-sm text-arc-muted" role="status">Focus minutes recorded.</p> : null}

      {entries.length ? (
        <ul className="mt-5 border-t border-arc-line">
          {entries.map((entry) => (
            <li className="flex justify-between gap-4 border-b border-arc-line py-3 text-sm" key={entry.id}>
              <span className="text-arc-ink">{entry.commitmentTitle ?? "General Focus"}{entry.note ? <span className="block text-xs text-arc-muted">{entry.note}</span> : null}</span>
              <span className="shrink-0 tabular-nums text-arc-muted">{entry.minutes} min</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 border border-dashed border-arc-line px-4 py-4">
          <p className="text-sm text-arc-ink">No Focus logged today</p>
          <p className="mt-1 text-xs text-arc-muted">Record a focused session when you finish one.</p>
        </div>
      )}
    </section>
  );
}
