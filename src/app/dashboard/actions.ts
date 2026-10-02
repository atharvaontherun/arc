"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/src/lib/supabase/server";
import { getAuthenticatedUserId } from "@/src/lib/supabase/onboarding";

export type CommitmentCompletionResult =
  | { ok: true }
  | { ok: false; error: string };

export type TodayGameState = {
  completionPercentage: number;
  hpChange: number;
  hp: number;
  streak: number;
  xp: number;
  focusXpAwarded: number;
  characterStatus: string;
  arcStatus: string;
  alreadyEvaluated: boolean;
  isOffDay: boolean;
};

export type TodayEvaluationResult =
  | { ok: true; data: TodayGameState }
  | { ok: false; error: string };

export type UseOffDayResult =
  | { ok: true; data: TodayGameState; remaining: number }
  | { ok: false; error: string };

export type FocusEntry = { id: string; minutes: number; commitmentTitle: string | null; loggedAt: string; note: string };
export type FocusLogResult =
  | { ok: true; totalMinutes: number; entries: FocusEntry[] }
  | { ok: false; error: string };

function logCompletionError(stage: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") return;

  if (error && typeof error === "object") {
    const value = error as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      status?: unknown;
    };
    console.error(`[dashboard completion] ${stage}`, {
      name: value.name,
      message: value.message,
      code: value.code,
      details: value.details,
      hint: value.hint,
      status: value.status,
    });
    return;
  }

  console.error(`[dashboard completion] ${stage}`, error);
}

export async function setTodayCommitmentCompletion(
  commitmentId: string,
  completed: boolean
): Promise<CommitmentCompletionResult> {
  if (
    typeof commitmentId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commitmentId) ||
    typeof completed !== "boolean"
  ) {
    return { ok: false, error: "That Commitment could not be updated. Refresh and try again." };
  }

  let stage = "create server client";
  try {
    const supabase = await createClient();
    stage = "verify authenticated session";
    const userId = await getAuthenticatedUserId(supabase);
    if (!userId) {
      if (process.env.NODE_ENV === "development") {
        console.error("[dashboard completion] no authenticated user in server action");
      }
      return { ok: false, error: "Your session has expired. Please log in again." };
    }

    stage = "call set_today_commitment_completion RPC";
    const { error } = await supabase.rpc("set_today_commitment_completion", {
      p_commitment_id: commitmentId,
      p_completed: completed,
    });

    if (error) {
      logCompletionError(stage, error);
      return { ok: false, error: "We could not update that Commitment. Refresh and try again." };
    }

    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    logCompletionError(stage, error);
    return { ok: false, error: "We could not verify your session. Please refresh and try again." };
  }
}

export async function evaluateTodayArc(): Promise<TodayEvaluationResult> {
  let stage = "create server client";
  try {
    const supabase = await createClient();
    stage = "verify authenticated session";
    const userId = await getAuthenticatedUserId(supabase);
    if (!userId) {
      return { ok: false, error: "Your session has expired. Please log in again." };
    }

    stage = "call evaluate_today_arc RPC";
    const { data, error } = await supabase.rpc("evaluate_today_arc");
    if (error) {
      logCompletionError(stage, error);
      return { ok: false, error: "We could not evaluate today. Refresh and try again." };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "The evaluation returned an invalid result. Refresh and try again." };
    }

    const result = data as Record<string, unknown>;
    const completionPercentage = Number(result.completion_percentage);
    const hpChange = Number(result.hp_change);
    const hp = Number(result.hp_after);
    const streak = Number(result.streak_days);
    const xp = Number(result.xp);
    const focusXpAwarded = Number(result.focus_xp_awarded ?? 0);
    const characterStatus = result.character_status;
    const arcStatus = result.arc_status;

    if (
      ![completionPercentage, hpChange, hp, streak, xp, focusXpAwarded].every(Number.isFinite) ||
      typeof characterStatus !== "string" ||
      typeof arcStatus !== "string"
    ) {
      return { ok: false, error: "The evaluation returned an invalid result. Refresh and try again." };
    }

    revalidatePath("/dashboard");

    return {
      ok: true,
      data: {
        completionPercentage,
        hpChange,
        hp,
        streak,
        xp,
        focusXpAwarded,
        characterStatus,
        arcStatus,
        alreadyEvaluated: result.already_evaluated === true,
        isOffDay: result.is_off_day === true,
      },
    };
  } catch (error) {
    logCompletionError(stage, error);
    return { ok: false, error: "We could not evaluate today. Refresh and try again." };
  }
}

export async function useTodayOffDay(): Promise<UseOffDayResult> {
  let stage = "create server client";
  try {
    const supabase = await createClient();
    stage = "verify authenticated session";
    const userId = await getAuthenticatedUserId(supabase);
    if (!userId) {
      return { ok: false, error: "Your session has expired. Please log in again." };
    }

    stage = "call use_today_off_day RPC";
    const { data, error } = await supabase.rpc("use_today_off_day");
    if (error) {
      logCompletionError(stage, error);
      return { ok: false, error: "We could not use an Off-Day. Refresh and try again." };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "The Off-Day action returned an invalid result. Refresh and try again." };
    }

    const result = data as Record<string, unknown>;
    const completionPercentage = Number(result.completion_percentage);
    const hpChange = Number(result.hp_change);
    const hp = Number(result.hp_after);
    const streak = Number(result.streak_days);
    const xp = Number(result.xp);
    const remaining = Number(result.off_days_remaining);
    const characterStatus = result.character_status;
    const arcStatus = result.arc_status;

    if (
      ![completionPercentage, hpChange, hp, streak, xp, remaining].every(Number.isFinite) ||
      typeof characterStatus !== "string" ||
      typeof arcStatus !== "string"
    ) {
      return { ok: false, error: "The Off-Day action returned an invalid result. Refresh and try again." };
    }

    revalidatePath("/dashboard");
    return {
      ok: true,
      remaining,
      data: {
        completionPercentage,
        hpChange,
        hp,
        streak,
        xp,
        focusXpAwarded: 0,
        characterStatus,
        arcStatus,
        alreadyEvaluated: result.already_evaluated === true,
        isOffDay: result.is_off_day === true,
      },
    };
  } catch (error) {
    logCompletionError(stage, error);
    return { ok: false, error: "We could not use an Off-Day. Refresh and try again." };
  }
}

function parseFocusPayload(payload: unknown): { totalMinutes: number; entries: FocusEntry[] } | null {
  if (!payload || typeof payload !== "object") return null;
  const result = payload as Record<string, unknown>;
  const totalMinutes = Number(result.total_minutes);
  if (!Number.isFinite(totalMinutes) || !Array.isArray(result.entries)) return null;
  const entries: FocusEntry[] = [];
  for (const entry of result.entries) {
    if (!entry || typeof entry !== "object") return null;
    const value = entry as Record<string, unknown>;
    const minutes = Number(value.minutes);
    if (
      typeof value.id !== "string" ||
      !Number.isInteger(minutes) ||
      typeof value.logged_at !== "string" ||
      (value.commitment_title !== null && typeof value.commitment_title !== "string") ||
      typeof value.note !== "string"
    ) return null;
    entries.push({ id: value.id, minutes, loggedAt: value.logged_at, commitmentTitle: value.commitment_title, note: value.note });
  }
  return { totalMinutes, entries };
}

export async function getTodayFocusLogs(): Promise<FocusLogResult> {
  let stage = "create server client";
  try {
    const supabase = await createClient();
    stage = "verify authenticated session";
    if (!(await getAuthenticatedUserId(supabase))) {
      return { ok: false, error: "Your session has expired. Please log in again." };
    }
    stage = "call get_today_focus_logs RPC";
    const { data, error } = await supabase.rpc("get_today_focus_logs");
    if (error) {
      logCompletionError(stage, error);
      return { ok: false, error: "We could not load today’s Focus Log. Refresh and try again." };
    }
    const parsed = parseFocusPayload(data);
    return parsed
      ? { ok: true, ...parsed }
      : { ok: false, error: "Today’s Focus Log returned an invalid result. Refresh and try again." };
  } catch (error) {
    logCompletionError(stage, error);
    return { ok: false, error: "We could not load today’s Focus Log. Refresh and try again." };
  }
}

export async function logFocusMinutes(focusMinutes: number, commitmentId: string | null, note: string): Promise<FocusLogResult> {
  if (
    !Number.isInteger(focusMinutes) ||
    focusMinutes < 1 ||
    focusMinutes > 2_147_483_647 ||
    (commitmentId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commitmentId))
  ) {
    return { ok: false, error: "Enter a positive whole number of Focus minutes." };
  }

  let stage = "create server client";
  try {
    const supabase = await createClient();
    stage = "verify authenticated session";
    if (!(await getAuthenticatedUserId(supabase))) {
      return { ok: false, error: "Your session has expired. Please log in again." };
    }
    stage = "call log_focus_session RPC";
    const { data, error } = await supabase.rpc("log_focus_session", {
      p_focus_minutes: focusMinutes,
      p_commitment_id: commitmentId,
      p_note: note.trim(),
    });
    if (error) {
      logCompletionError(stage, error);
      return { ok: false, error: "We could not save that Focus Log. Refresh and try again." };
    }
    const parsed = parseFocusPayload(data);
    if (!parsed) return { ok: false, error: "The Focus Log returned an invalid result. Refresh and try again." };
    revalidatePath("/dashboard");
    return { ok: true, ...parsed };
  } catch (error) {
    logCompletionError(stage, error);
    return { ok: false, error: "We could not save that Focus Log. Refresh and try again." };
  }
}
