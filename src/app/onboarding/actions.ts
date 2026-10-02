"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/src/lib/supabase/server";
import { ensureProfile, getAuthenticatedUserId } from "@/src/lib/supabase/onboarding";

type DatabaseCharacterType = "batman" | "spider_man";

export type OnboardingActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function failed(error: string): OnboardingActionResult<never> {
  return { ok: false, error };
}

function databaseFailure(error: { code?: string } | null, fallback: string) {
  if (error?.code === "23505") {
    return "An active character or Arc already exists. Refresh onboarding to continue.";
  }
  if (error?.code === "42501") {
    return "Your session could not save this information. Please refresh and try again.";
  }
  return fallback;
}

async function getUserIdOrError(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const userId = await getAuthenticatedUserId(supabase);
    return userId
      ? { userId, error: null }
      : { userId: null, error: "Your session has expired. Please log in again." };
  } catch {
    return { userId: null, error: "We could not verify your session. Please try again." };
  }
}

export async function selectCharacter(
  characterType: DatabaseCharacterType
): Promise<OnboardingActionResult<{ id: string; characterType: DatabaseCharacterType }>> {
  if (characterType !== "batman" && characterType !== "spider_man") {
    return failed("Choose Batman or Spider-Man to continue.");
  }

  const supabase = await createClient();
  const auth = await getUserIdOrError(supabase);
  if (!auth.userId) return failed(auth.error ?? "Please log in to continue.");

  try {
    await ensureProfile(supabase, auth.userId);

    const { data: existing, error: existingError } = await supabase
      .from("characters")
      .select("id, character_type")
      .eq("user_id", auth.userId)
      .eq("status", "active")
      .maybeSingle();

    if (existingError) {
      return failed(databaseFailure(existingError, "We could not load your active character. Please try again."));
    }

    if (existing) {
      if (existing.character_type !== characterType) {
        return failed("You already have an active character. Refresh onboarding to continue with that character.");
      }
      return { ok: true, data: { id: existing.id, characterType: existing.character_type } };
    }

    const { data: character, error } = await supabase
      .from("characters")
      .insert({ user_id: auth.userId, character_type: characterType })
      .select("id, character_type")
      .single();

    if (error || !character) {
      return failed(databaseFailure(error, "We could not save your character. Please try again."));
    }

    revalidatePath("/onboarding");
    return { ok: true, data: { id: character.id, characterType: character.character_type } };
  } catch {
    return failed("We could not save your character. Please try again.");
  }
}

export async function createArcWithCommitments(input: {
  durationDays: number;
  commitments: Array<{ title: string; xpReward: number }>;
}): Promise<OnboardingActionResult<{ arcId: string }>> {
  const allowedDurations = [30, 60, 90];
  if (!input || !allowedDurations.includes(input.durationDays)) {
    return failed("Choose an Arc duration of 30, 60, or 90 days.");
  }

  if (!Array.isArray(input.commitments) || input.commitments.length === 0) {
    return failed("Add at least one daily Commitment to continue.");
  }

  const commitments: Array<{ title: string; xp_reward: number }> = [];
  for (const commitment of input.commitments) {
    const title = typeof commitment?.title === "string" ? commitment.title.trim() : "";
    const xpReward = commitment?.xpReward;

    if (!title) {
      return failed("Give every Commitment a title.");
    }
    if (!Number.isInteger(xpReward) || xpReward <= 0 || xpReward > 2_147_483_647) {
      return failed("Every Commitment must have a whole-number XP value greater than 0.");
    }

    commitments.push({ title, xp_reward: xpReward });
  }

  const supabase = await createClient();
  const auth = await getUserIdOrError(supabase);
  if (!auth.userId) return failed(auth.error ?? "Please log in to continue.");

  let arcId: string | null = null;

  try {
    await ensureProfile(supabase, auth.userId);

    const { data: activeCharacter, error: characterError } = await supabase
      .from("characters")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("status", "active")
      .maybeSingle();

    if (characterError) {
      return failed(databaseFailure(characterError, "We could not load your active character. Please try again."));
    }
    if (!activeCharacter) {
      return failed("Select an active character before creating your Arc.");
    }

    const { data: existingArc, error: arcLookupError } = await supabase
      .from("arcs")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("status", "active")
      .maybeSingle();

    if (arcLookupError) {
      return failed(databaseFailure(arcLookupError, "We could not check your active Arc. Please try again."));
    }
    if (existingArc) {
      return { ok: true, data: { arcId: existingArc.id } };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", auth.userId)
      .single();

    if (profileError) {
      return failed(databaseFailure(profileError, "We could not load your profile. Please try again."));
    }

    const timeZone = profile?.timezone || "UTC";
    let startsOn: string;
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const part = (type: string) => parts.find((item) => item.type === type)?.value;
      const year = part("year");
      const month = part("month");
      const day = part("day");
      if (!year || !month || !day) throw new Error("Date unavailable");
      startsOn = `${year}-${month}-${day}`;
    } catch {
      return failed("Your profile timezone is invalid. Update it before starting an Arc.");
    }

    const endDate = new Date(`${startsOn}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + input.durationDays - 1);
    const endsOn = endDate.toISOString().slice(0, 10);

    const { data: arc, error: createArcError } = await supabase
      .from("arcs")
      .insert({
        user_id: auth.userId,
        character_id: activeCharacter.id,
        title: `${input.durationDays}-Day Arc`,
        duration_days: input.durationDays,
        status: "active",
        starts_on: startsOn,
        ends_on: endsOn,
      })
      .select("id")
      .single();

    if (createArcError || !arc) {
      return failed(databaseFailure(createArcError, "We could not create your Arc. Please try again."));
    }
    arcId = arc.id;

    const { error: commitmentError } = await supabase.from("commitments").insert(
      commitments.map((commitment) => ({
        ...commitment,
        user_id: auth.userId,
        arc_id: arc.id,
      }))
    );

    if (commitmentError) {
      const { error: rollbackError } = await supabase
        .from("arcs")
        .delete()
        .eq("id", arc.id)
        .eq("user_id", auth.userId);

      if (rollbackError) {
        return failed("Commitments could not be saved and the Arc could not be rolled back. Refresh before retrying.");
      }

      arcId = null;
      return failed(databaseFailure(commitmentError, "We could not save your Commitments. No Arc was started; please try again."));
    }

    revalidatePath("/onboarding");
    revalidatePath("/dashboard");
    return { ok: true, data: { arcId: arc.id } };
  } catch {
    if (arcId) {
      const { error: rollbackError } = await supabase
        .from("arcs")
        .delete()
        .eq("id", arcId)
        .eq("user_id", auth.userId);
      if (rollbackError) {
        return failed("Setup stopped unexpectedly and the Arc could not be rolled back. Refresh before retrying.");
      }
    }
    return failed("We could not finish setup. Please try again.");
  }
}
