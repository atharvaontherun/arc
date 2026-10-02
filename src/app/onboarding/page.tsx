import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/arc/app-shell";
import { Eyebrow, StatusMessage } from "@/src/components/arc/ui";
import { createClient } from "@/src/lib/supabase/server";
import { ensureProfile, getAuthenticatedUserId } from "@/src/lib/supabase/onboarding";
import { OnboardingFlow } from "./onboarding-flow";

type DatabaseCharacterType = "batman" | "spider_man";

function SetupError({ message }: { message: string }) {
  return (
    <AppShell activeItem={null}>
      <div className="mx-auto max-w-3xl pt-8">
        <Eyebrow>ARC / ONBOARDING</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Setup unavailable</h1>
        <div className="mt-6"><StatusMessage kind="error">{message}</StatusMessage></div>
      </div>
    </AppShell>
  );
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  let userId: string | null;

  try {
    userId = await getAuthenticatedUserId(supabase);
  } catch {
    return <SetupError message="We could not verify your session. Refresh the page or log in again." />;
  }

  if (!userId) redirect("/login");

  try {
    await ensureProfile(supabase, userId);
  } catch {
    return <SetupError message="We could not prepare your profile. Refresh the page to try again." />;
  }

  const { data: activeArc, error: arcError } = await supabase
    .from("arcs")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (arcError) {
    return <SetupError message="We could not load your Arc status. Refresh the page to try again." />;
  }
  if (activeArc) redirect("/dashboard");

  const { data: activeCharacter, error: characterError } = await supabase
    .from("characters")
    .select("id, character_type")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (characterError) {
    return <SetupError message="We could not load your character status. Refresh the page to try again." />;
  }

  const characterType = activeCharacter?.character_type as DatabaseCharacterType | undefined;
  const initialCharacter = activeCharacter && (characterType === "batman" || characterType === "spider_man")
    ? { id: activeCharacter.id as string, characterType }
    : null;

  return (
    <AppShell activeItem={null}>
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-12 lg:gap-x-10 2xl:gap-x-20">
        <section className="border-b border-arc-line pb-6 pt-4 lg:col-span-8 lg:col-start-2">
          <Eyebrow>ARC / ONBOARDING</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Start your Arc.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-arc-muted">
            Set up your profile, choose a character, and define the daily Commitments for your Arc.
          </p>
        </section>
        <section className="pb-8 pt-7 lg:col-span-8 lg:col-start-2 lg:pt-8">
          <OnboardingFlow initialCharacter={initialCharacter} />
        </section>
      </div>
    </AppShell>
  );
}
