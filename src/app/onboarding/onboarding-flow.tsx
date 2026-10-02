"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createArcWithCommitments,
  selectCharacter,
  type OnboardingActionResult,
} from "./actions";
import { characterThemes, type CharacterTheme } from "@/src/components/arc/config";
import { Button, Eyebrow, Panel, StatusMessage } from "@/src/components/arc/ui";

type DatabaseCharacterType = "batman" | "spider_man";
type Step = "character" | "training" | "arc" | "commitments";
type TrainingStyle = "character" | "custom" | "skip";
type CommitmentDraft = { id: number; title: string; xp: string };

const choices: Array<{ theme: CharacterTheme; databaseType: DatabaseCharacterType }> = [
  { theme: "batman", databaseType: "batman" },
  { theme: "spider-man", databaseType: "spider_man" },
];

const durations = [30, 60, 90] as const;

const trainingPresets: Record<DatabaseCharacterType, { name: string; description: string; exercises: string[]; commitmentTitle: string }> = {
  batman: {
    name: "Vigilante Training",
    description: "Strength and conditioning inspired by Batman.",
    exercises: ["Push-ups", "Squats", "Lunges", "Plank", "Burpees", "Pull-ups (optional)"],
    commitmentTitle: "Vigilante Training — push-ups, squats, lunges, plank, burpees; optional pull-ups",
  },
  spider_man: {
    name: "Web Training",
    description: "Agility, core and conditioning inspired by Spider-Man.",
    exercises: ["Push-ups", "Squats", "Mountain Climbers", "Plank", "Jumping Jacks", "Burpees"],
    commitmentTitle: "Web Training — push-ups, squats, mountain climbers, plank, jumping jacks, burpees",
  },
};

function themeForDatabaseType(type: DatabaseCharacterType): CharacterTheme {
  return type === "spider_man" ? "spider-man" : "batman";
}

function getActionError<T>(result: OnboardingActionResult<T>) {
  return result.ok ? "" : result.error;
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  min,
  step,
}: {
  id: string;
  label: string;
  type?: "text" | "number";
  value: string;
  onChange: (value: string) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm text-arc-ink" htmlFor={id}>{label}</label>
      <input
        className="min-h-11 w-full rounded-sm border border-arc-line bg-transparent px-3 text-base text-arc-ink outline-none transition-colors placeholder:text-arc-muted/65 hover:border-white/25 focus:border-arc-muted focus:ring-1 focus:ring-arc-muted/35"
        id={id}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        required
        step={step}
        type={type}
        value={value}
      />
    </div>
  );
}

export function OnboardingFlow({
  initialCharacter,
}: {
  initialCharacter: { id: string; characterType: DatabaseCharacterType } | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialCharacter ? "training" : "character");
  const [characterType, setCharacterType] = useState<CharacterTheme | null>(
    initialCharacter ? themeForDatabaseType(initialCharacter.characterType) : null
  );
  const [duration, setDuration] = useState<number | null>(null);
  const [trainingStyle, setTrainingStyle] = useState<TrainingStyle | null>(null);
  const [appliedTrainingStyle, setAppliedTrainingStyle] = useState<TrainingStyle | null>(null);
  const [trainingCommitmentId, setTrainingCommitmentId] = useState<number | null>(null);
  const [commitments, setCommitments] = useState<CommitmentDraft[]>([
    { id: 1, title: "", xp: "" },
  ]);
  const [nextCommitmentId, setNextCommitmentId] = useState(2);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function saveCharacter() {
    setError("");
    if (!characterType) {
      setError("Choose a character to continue.");
      return;
    }

    const choice = choices.find((item) => item.theme === characterType);
    if (!choice) {
      setError("Choose Batman or Spider-Man to continue.");
      return;
    }

    startTransition(async () => {
      const result = await selectCharacter(choice.databaseType);
      if (!result.ok) {
        setError(getActionError(result));
        return;
      }
      setCharacterType(themeForDatabaseType(result.data.characterType));
      setStep("training");
    });
  }

  function continueFromTraining() {
    setError("");
    if (!characterType || !trainingStyle) {
      setError("Choose a training style or skip to continue.");
      return;
    }

    if (trainingStyle !== appliedTrainingStyle) {
      let updated = trainingCommitmentId === null
        ? commitments
        : commitments.filter((item) => item.id !== trainingCommitmentId);

      if (trainingStyle === "skip") {
        setTrainingCommitmentId(null);
        if (updated.length === 0) {
          const id = trainingCommitmentId ?? nextCommitmentId;
          updated = [{ id, title: "", xp: "" }];
          if (trainingCommitmentId === null) setNextCommitmentId((current) => current + 1);
        }
      } else {
        const title = trainingStyle === "character"
          ? trainingPresets[characterType === "spider-man" ? "spider_man" : "batman"].commitmentTitle
          : "My Workout";
        const emptyDraft = updated.find((item) => !item.title.trim() && !item.xp);
        if (emptyDraft) {
          updated = updated.map((item) => item.id === emptyDraft.id ? { ...item, title, xp: "15" } : item);
          setTrainingCommitmentId(emptyDraft.id);
        } else {
          const id = trainingCommitmentId ?? nextCommitmentId;
          updated = [...updated, { id, title, xp: "15" }];
          setTrainingCommitmentId(id);
          if (trainingCommitmentId === null) setNextCommitmentId((current) => current + 1);
        }
      }

      setCommitments(updated);
      setAppliedTrainingStyle(trainingStyle);
    }
    setStep("arc");
  }

  function continueToCommitments() {
    setError("");
    if (!duration) {
      setError("Choose 30, 60, or 90 days to continue.");
      return;
    }
    setStep("commitments");
  }

  function updateCommitment(id: number, field: "title" | "xp", value: string) {
    setCommitments((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function addCommitment() {
    setCommitments((current) => [...current, { id: nextCommitmentId, title: "", xp: "" }]);
    setNextCommitmentId((id) => id + 1);
  }

  function removeCommitment(id: number) {
    setCommitments((current) => current.filter((item) => item.id !== id));
  }

  function startArc() {
    setError("");
    if (!duration) {
      setError("Choose an Arc duration before continuing.");
      setStep("arc");
      return;
    }
    if (commitments.length === 0) {
      setError("Add at least one daily Commitment to continue.");
      return;
    }

    const normalized = commitments.map((item) => ({
      title: item.title.trim(),
      xpReward: Number(item.xp),
    }));
    if (normalized.some((item) => !item.title)) {
      setError("Give every Commitment a title.");
      return;
    }
    if (normalized.some((item) => !Number.isInteger(item.xpReward) || item.xpReward <= 0)) {
      setError("Every Commitment must have a whole-number XP value greater than 0.");
      return;
    }

    startTransition(async () => {
      const result = await createArcWithCommitments({ durationDays: duration, commitments: normalized });
      if (!result.ok) {
        setError(getActionError(result));
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  }

  const currentStep = step === "character" ? 1 : step === "training" ? 2 : step === "arc" ? 3 : 4;
  const trainingAccentBorder = characterType === "spider-man" ? "border-arc-blue" : "border-arc-gold";

  return (
    <div>
      <ol aria-label="Onboarding steps" className="grid grid-cols-4 border-y border-arc-line">
        {["Character", "Training", "Arc", "Commitments"].map((label, index) => {
          const number = index + 1;
          return (
            <li className={`border-r border-arc-line px-3 py-3 last:border-r-0 sm:px-4 ${number === currentStep ? "text-arc-ink" : "text-arc-muted"}`} key={label}>
              <span className="mr-2 text-xs tabular-nums">0{number}</span>
              <span className="text-xs sm:text-sm">{label}</span>
            </li>
          );
        })}
      </ol>

      {step === "character" ? (
        <section className="pt-8">
          <Eyebrow>Step 1 / 4</Eyebrow>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Choose your character</h2>
          <p className="mt-3 text-sm leading-6 text-arc-muted">Your character is the foundation of this Arc.</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {choices.map(({ theme }) => {
              const character = characterThemes[theme];
              const selected = characterType === theme;
              return (
                <button
                  aria-pressed={selected}
                  className={`min-h-32 border p-5 text-left transition-colors ${selected ? "border-arc-muted bg-white/[0.035]" : "border-arc-line hover:border-arc-muted"}`}
                  key={theme}
                  onClick={() => { setCharacterType(theme); setError(""); }}
                  type="button"
                >
                  <Eyebrow>Character</Eyebrow>
                  <span className={`mt-3 block text-xl font-semibold ${character.accentClass}`}>{character.label}</span>
                  <span className="mt-2 block text-sm text-arc-muted">Select as active character</span>
                </button>
              );
            })}
          </div>

          {error ? <div className="mt-5"><StatusMessage kind="error">{error}</StatusMessage></div> : null}
          <div className="mt-6 flex justify-end">
            <Button disabled={!characterType || isPending} onClick={saveCharacter}>
              {isPending ? "SAVING…" : "CONTINUE"}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "training" ? (
        <section className="pt-8">
          <Eyebrow>Step 2 / 4</Eyebrow>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">TRAINING</h2>
          <p className="mt-3 text-sm leading-6 text-arc-muted">Choose a training style for your Arc.</p>
          {characterType ? (
            <div className="mt-6 grid gap-3 lg:grid-cols-3">
              <button
                aria-pressed={trainingStyle === "character"}
                className={`border p-4 text-left transition-colors sm:p-5 ${trainingStyle === "character" ? `${trainingAccentBorder} bg-white/[0.035]` : "border-arc-line hover:border-arc-muted"}`}
                onClick={() => { setTrainingStyle("character"); setError(""); }}
                type="button"
              >
                <span className="text-[11px] uppercase tracking-[0.14em] text-arc-muted">Option 01</span>
                <span className={`mt-2 block text-lg font-medium ${characterThemes[characterType].accentClass}`}>Character Training</span>
                <span className="mt-2 block text-sm leading-5 text-arc-muted">{trainingPresets[characterType === "spider-man" ? "spider_man" : "batman"].description}</span>
                <span className="mt-4 block border-t border-arc-line pt-3 text-xs leading-5 text-arc-ink">
                  {trainingPresets[characterType === "spider-man" ? "spider_man" : "batman"].exercises.join(" · ")}
                </span>
                <span className="mt-3 block text-[11px] leading-5 text-arc-muted">Keep it manageable. Choose a comfortable pace and amount; no fixed repetitions are set.</span>
              </button>

              <button
                aria-pressed={trainingStyle === "custom"}
                className={`border p-4 text-left transition-colors sm:p-5 ${trainingStyle === "custom" ? `${trainingAccentBorder} bg-white/[0.035]` : "border-arc-line hover:border-arc-muted"}`}
                onClick={() => { setTrainingStyle("custom"); setError(""); }}
                type="button"
              >
                <span className="text-[11px] uppercase tracking-[0.14em] text-arc-muted">Option 02</span>
                <span className="mt-2 block text-lg font-medium text-arc-ink">Build My Own</span>
                <span className="mt-2 block text-sm leading-5 text-arc-muted">Start with an editable Workout Commitment. Set a routine and pace that suit you.</span>
              </button>

              <button
                aria-pressed={trainingStyle === "skip"}
                className={`border p-4 text-left transition-colors sm:p-5 ${trainingStyle === "skip" ? `${trainingAccentBorder} bg-white/[0.035]` : "border-arc-line hover:border-arc-muted"}`}
                onClick={() => { setTrainingStyle("skip"); setError(""); }}
                type="button"
              >
                <span className="text-[11px] uppercase tracking-[0.14em] text-arc-muted">Option 03</span>
                <span className="mt-2 block text-lg font-medium text-arc-ink">Skip</span>
                <span className="mt-2 block text-sm leading-5 text-arc-muted">Continue without adding a workout Commitment. You can still set up other daily Commitments.</span>
              </button>
            </div>
          ) : null}

          {error ? <div className="mt-5"><StatusMessage kind="error">{error}</StatusMessage></div> : null}
          <div className="mt-6 flex justify-end">
            <Button disabled={!trainingStyle} onClick={continueFromTraining}>CONTINUE</Button>
          </div>
        </section>
      ) : null}

      {step === "arc" ? (
        <section className="pt-8">
          <Eyebrow>Step 3 / 4</Eyebrow>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Set your Arc duration</h2>
          <p className="mt-3 text-sm leading-6 text-arc-muted">Choose a fixed duration. Your Arc begins when you confirm your Commitments.</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {durations.map((days) => {
              const selected = duration === days;
              return (
                <button
                  aria-pressed={selected}
                  className={`min-h-24 border px-4 py-5 text-left transition-colors ${selected ? "border-arc-muted bg-white/[0.035] text-arc-ink" : "border-arc-line text-arc-muted hover:border-arc-muted hover:text-arc-ink"}`}
                  key={days}
                  onClick={() => { setDuration(days); setError(""); }}
                  type="button"
                >
                  <span className="block text-2xl font-semibold tabular-nums">{days}</span>
                  <span className="mt-1 block text-sm">days</span>
                </button>
              );
            })}
          </div>

          {error ? <div className="mt-5"><StatusMessage kind="error">{error}</StatusMessage></div> : null}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button onClick={() => { setStep("training"); setError(""); }} variant="secondary">BACK</Button>
            <Button disabled={!duration} onClick={continueToCommitments}>CONTINUE</Button>
          </div>
        </section>
      ) : null}

      {step === "commitments" ? (
        <section className="pt-8">
          <Eyebrow>Step 4 / 4</Eyebrow>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Set your daily Commitments</h2>
          <p className="mt-3 text-sm leading-6 text-arc-muted">
            Add the actions you plan to repeat every day for {duration} days. XP values are set manually and must be greater than 0. Commitments lock when your Arc starts.
          </p>
          {trainingCommitmentId !== null && commitments.find((item) => item.id === trainingCommitmentId) ? (
            <p className="mt-4 border-l-2 border-arc-line py-1 pl-3 text-xs leading-5 text-arc-muted">
              Your {trainingStyle === "character" ? "training preset" : "Workout"} is an ordinary daily Commitment. Edit its title and XP below; it repeats every day for this Arc.
            </p>
          ) : null}

          <Panel className="mt-6 divide-y divide-arc-line px-4 sm:px-5">
            {commitments.map((item, index) => (
              <div className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end" key={item.id}>
                <Field
                  id={`commitment-title-${item.id}`}
                  label={`Commitment ${index + 1}`}
                  onChange={(value) => updateCommitment(item.id, "title", value)}
                  value={item.title}
                />
                <Field
                  id={`commitment-xp-${item.id}`}
                  label="XP"
                  min={1}
                  onChange={(value) => updateCommitment(item.id, "xp", value)}
                  step={1}
                  type="number"
                  value={item.xp}
                />
                <button
                  className="min-h-11 px-2 text-left text-sm text-arc-muted underline decoration-arc-line underline-offset-4 transition-colors hover:text-arc-ink disabled:opacity-40 sm:text-center"
                  disabled={commitments.length === 1}
                  onClick={() => removeCommitment(item.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
            {commitments.length === 0 ? (
              <p className="py-5 text-sm text-arc-muted">No Commitments added yet.</p>
            ) : null}
          </Panel>

          <button className="mt-4 min-h-10 text-sm text-arc-ink underline decoration-arc-line underline-offset-4 transition-colors hover:text-white" onClick={addCommitment} type="button">
            + Add Commitment
          </button>

          {error ? <div className="mt-5"><StatusMessage kind="error">{error}</StatusMessage></div> : null}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button onClick={() => { setStep("arc"); setError(""); }} variant="secondary">BACK</Button>
            <Button disabled={isPending || commitments.length === 0} onClick={startArc}>
              {isPending ? "CREATING ARC…" : "CREATE ARC"}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
