"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CharacterTheme } from "@/src/components/arc/config";
import { evaluateTodayArc, setTodayCommitmentCompletion, useTodayOffDay, type TodayGameState } from "./actions";

export type TodayCommitment = {
  id: string;
  title: string;
  xpReward: number;
  completed: boolean;
};

export function CommitmentChecklist({
  items,
  initialGameState,
  initialEvaluated,
  initialOffDaysRemaining,
  theme,
  children,
}: {
  items: TodayCommitment[];
  initialGameState: TodayGameState;
  initialEvaluated: boolean;
  initialOffDaysRemaining: number;
  theme: CharacterTheme;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [completionById, setCompletionById] = useState(
    () => new Map(items.map((item) => [item.id, item.completed]))
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [evaluationPending, setEvaluationPending] = useState(false);
  const [gameState, setGameState] = useState(initialGameState);
  const [evaluated, setEvaluated] = useState(initialEvaluated);
  const [offDaysRemaining, setOffDaysRemaining] = useState(initialOffDaysRemaining);
  const [error, setError] = useState<string | null>(null);

  const completedCount = items.filter((item) => completionById.get(item.id) ?? item.completed).length;
  const totalCommitmentXp = items.reduce((total, item) => total + item.xpReward, 0);
  const completedCommitmentXp = items.reduce(
    (total, item) => total + ((completionById.get(item.id) ?? item.completed) ? item.xpReward : 0),
    0
  );
  const completionPercentage = evaluated
    ? gameState.completionPercentage
    : totalCommitmentXp > 0
      ? (completedCommitmentXp * 100) / totalCommitmentXp
      : 0;
  const offDaysUsed = 3 - offDaysRemaining;

  async function toggle(item: TodayCommitment) {
    if (pendingId || evaluationPending || evaluated) return;

    const completed = !(completionById.get(item.id) ?? item.completed);
    setPendingId(item.id);
    setError(null);

    try {
      const result = await setTodayCommitmentCompletion(item.id, completed);
      if (result.ok) {
        setCompletionById((current) => new Map(current).set(item.id, completed));
      } else {
        setError(result.error);
      }
    } catch {
      setError("We could not update that Commitment. Refresh and try again.");
    } finally {
      setPendingId(null);
    }
  }

  async function evaluateToday() {
    if (evaluationPending || pendingId || evaluated || items.length === 0) return;
    setEvaluationPending(true);
    setError(null);

    try {
      const result = await evaluateTodayArc();
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setGameState(result.data);
      setEvaluated(true);
      router.refresh();
    } catch {
      setError("We could not evaluate today. Refresh and try again.");
    } finally {
      setEvaluationPending(false);
    }
  }

  async function useOffDay() {
    if (evaluationPending || pendingId || evaluated || offDaysRemaining <= 0) return;
    if (!window.confirm("Use an Off-Day for today? Today's Commitments will be marked incomplete.")) return;

    setEvaluationPending(true);
    setError(null);

    try {
      const result = await useTodayOffDay();
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCompletionById(new Map(items.map((item) => [item.id, false])));
      setGameState(result.data);
      setOffDaysRemaining(result.remaining);
      setEvaluated(true);
      router.refresh();
    } catch {
      setError("We could not use an Off-Day. Refresh and try again.");
    } finally {
      setEvaluationPending(false);
    }
  }

  const accentButton = theme === "batman"
    ? "border-arc-gold bg-arc-gold text-arc-bg hover:bg-arc-ink"
    : "border-arc-blue bg-arc-blue text-arc-bg hover:bg-arc-ink";

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-6 xl:grid-cols-12 xl:gap-x-8">
      {error ? <p aria-live="assertive" className="border-l-2 border-arc-danger py-1 pl-3 text-sm text-arc-danger xl:col-span-12" role="alert">{error}</p> : null}

      <section aria-label="Today's Commitments" className="xl:col-span-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-arc-line pb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-arc-muted">Today&apos;s Commitments</p>
            <h2 className="mt-2 font-serif text-2xl tracking-[0.03em] text-arc-ink">Daily plan</h2>
          </div>
          <div className="flex items-baseline gap-4 text-right">
            <p className="text-sm tabular-nums text-arc-ink"><span className="font-semibold">{completedCount}</span><span className="text-arc-muted"> / {items.length} complete</span></p>
            <p className="border-l border-arc-line pl-4 text-sm tabular-nums text-arc-ink">{completionPercentage.toFixed(0)}<span className="text-arc-muted">%</span></p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="border border-arc-line bg-arc-panel px-4 py-8 sm:px-5">
            <p className="font-serif text-lg text-arc-ink">No daily Commitments</p>
            <p className="mt-2 text-sm leading-6 text-arc-muted">This Arc has no Commitments to track today.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => {
              const completed = completionById.get(item.id) ?? item.completed;

              return (
                <li className={`flex min-h-[4.75rem] items-center gap-3 border border-arc-line px-3 py-3 transition-colors sm:gap-4 sm:px-4 ${completed ? "bg-arc-panel/70" : "bg-arc-panel/30 hover:bg-arc-panel/70"}`} key={item.id}>
                  <span aria-hidden="true" className="hidden w-6 shrink-0 text-[10px] tabular-nums text-arc-muted sm:block">{String(index + 1).padStart(2, "0")}</span>
                  <button
                    aria-label={`${completed ? "Mark incomplete" : "Mark complete"}: ${item.title}`}
                    aria-pressed={completed}
                    className={`grid h-7 w-7 shrink-0 place-items-center border transition-colors disabled:cursor-wait disabled:opacity-50 ${completed ? `${accentButton} text-arc-bg` : "border-arc-line text-transparent hover:border-arc-muted"}`}
                    disabled={pendingId !== null || evaluationPending || evaluated}
                    onClick={() => void toggle(item)}
                    type="button"
                  >
                    {completed ? <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m3 8 3.2 3.2L13 4.5" /></svg> : null}
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${completed ? "text-arc-muted" : "text-arc-ink"}`}>{item.title}</span>
                    <span className="mt-1 block text-[11px] text-arc-muted">{completed ? "Completed today" : "Daily Commitment"}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-medium tabular-nums text-arc-ink">+{item.xpReward} XP</span>
                    {completed ? <span className="mt-1 block text-[10px] uppercase tracking-[0.1em] text-arc-muted">Done</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {totalCommitmentXp > 0 ? <p className="mt-3 text-right text-[11px] text-arc-muted">{totalCommitmentXp} configured Commitment XP</p> : null}
      </section>

      <aside aria-label="Focus and monthly allowance" className="space-y-4 xl:col-span-4">
        {children}
        <section aria-labelledby="monthly-allowance-heading" className="border border-arc-line bg-arc-panel p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-base tracking-[0.06em] text-arc-ink" id="monthly-allowance-heading">This month</h2>
            <span className="text-[11px] uppercase tracking-[0.12em] text-arc-muted">Off-Days</span>
          </div>
          <div className="mt-4 grid grid-cols-2 divide-x divide-arc-line border-y border-arc-line py-3">
            <div className="pr-4"><p className="font-serif text-2xl tabular-nums text-arc-ink">{offDaysUsed} / 3</p><p className="mt-1 text-xs text-arc-muted">used</p></div>
            <div className="pl-4"><p className="font-serif text-2xl tabular-nums text-arc-ink">{offDaysRemaining}</p><p className="mt-1 text-xs text-arc-muted">remaining</p></div>
          </div>
        </section>
      </aside>

      <section aria-label="End of day" className="border border-arc-line bg-arc-panel p-4 sm:p-5 xl:col-span-12 xl:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-arc-muted">Daily close</p>
            {evaluated ? (
              <div className="mt-2" role="status">
                <p className="font-serif text-xl text-arc-ink">{gameState.isOffDay ? "Off-Day recorded" : "Day evaluated"}</p>
                <p className="mt-1 text-sm leading-6 text-arc-muted">
                  {gameState.isOffDay
                    ? "HP, XP, and streak preserved."
                    : `${gameState.completionPercentage.toFixed(0)}% complete · ${gameState.hpChange >= 0 ? "+" : ""}${gameState.hpChange} HP · ${gameState.focusXpAwarded} Focus XP awarded.`}
                </p>
              </div>
            ) : (
              <>
                <h2 className="mt-2 font-serif text-xl tracking-[0.04em] text-arc-ink">Evaluate today</h2>
                <p className="mt-1 text-sm leading-6 text-arc-muted">{completedCount} of {items.length} Commitments complete. Review the day and record its result.</p>
              </>
            )}
          </div>

          {!evaluated ? (
            <div className="flex flex-col gap-3 sm:min-w-[19rem] sm:items-end">
              <button
                className={`inline-flex min-h-12 w-full items-center justify-center border px-5 text-sm font-semibold tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-45 sm:min-w-[19rem] ${accentButton}`}
                disabled={evaluationPending || pendingId !== null || items.length === 0}
                onClick={() => void evaluateToday()}
                type="button"
              >
                {evaluationPending ? "EVALUATING..." : "EVALUATE TODAY"}
              </button>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:justify-end">
                <button
                  className="min-h-10 border border-arc-line bg-transparent px-3 text-xs font-medium text-arc-ink transition-colors hover:border-arc-muted hover:bg-white/[0.035] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={evaluationPending || pendingId !== null || offDaysRemaining === 0}
                  onClick={() => void useOffDay()}
                  type="button"
                >
                  USE OFF-DAY
                </button>
                <span className="text-xs text-arc-muted">{offDaysRemaining} remaining this month</span>
              </div>
            </div>
          ) : (
            <div className="flex min-h-12 w-full items-center justify-center border border-arc-line px-5 text-sm text-arc-muted sm:w-auto sm:min-w-[19rem]">
              DAY COMPLETE
            </div>
          )}
        </div>

        {evaluated && gameState.arcStatus !== "active" ? (
          <div className="mt-5 border-t border-arc-line pt-4" role="status">
            <p className="text-sm font-medium text-arc-ink">
              {gameState.arcStatus === "failed" ? "Character lost. This Arc has failed." : "Arc completed."}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-arc-muted">
              {gameState.arcStatus === "failed"
                ? "This character remains permanently in the Graveyard and cannot be restored or resurrected."
                : "This Arc remains in History and is not restored as active."}
            </p>
            <Link className="mt-4 inline-flex min-h-10 items-center border border-arc-line px-3 text-xs font-medium text-arc-ink transition-colors hover:border-arc-muted" href="/history">
              {gameState.arcStatus === "failed" ? "VIEW GRAVEYARD" : "VIEW HISTORY"}
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
