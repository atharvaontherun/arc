import { CharacterPortrait } from "@/src/components/arc/character-portrait";
import { HPIndicator, StreakBadge, XPProgress } from "@/src/components/arc/progress";
import { characterThemes, getCharacterEvolution, type CharacterTheme } from "@/src/components/arc/config";
import { Eyebrow } from "@/src/components/arc/ui";

export function DashboardOverview({
  theme,
  name,
  level,
  hp,
  xp,
  streakDays,
  arcDay,
  arcDuration,
  arcEndDate,
}: {
  theme: CharacterTheme;
  name: string;
  level: number;
  hp: number;
  xp: number;
  streakDays: number;
  arcDay: number;
  arcDuration: number;
  arcEndDate: string;
}) {
  const themeConfig = characterThemes[theme];
  const evolution = getCharacterEvolution(theme, level);
  const levelStartXp = 50 * (level - 1) * level;
  const levelProgressXp = Math.max(0, xp - levelStartXp);
  const xpForNextLevel = 100 * level;
  const xpToNextLevel = Math.max(0, xpForNextLevel - levelProgressXp);
  const daysRemaining = Math.max(0, arcDuration - arcDay);
  const circumference = 2 * Math.PI * 44;
  const arcProgress = Math.min(1, Math.max(0, arcDay / arcDuration));
  const formattedEndDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${arcEndDate}T00:00:00Z`));

  return (
    <>
      <section aria-label="Current character" className="overflow-hidden border border-arc-line bg-arc-panel xl:col-span-7">
        <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="min-h-56 border-b border-arc-line md:min-h-[21rem] md:border-b-0 md:border-r">
            <CharacterPortrait className="h-full min-h-56 border-0 md:min-h-[21rem] md:aspect-auto" level={level} theme={theme} />
          </div>
          <div className="flex flex-col justify-between p-5 sm:p-6 lg:p-7">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Eyebrow>Current character</Eyebrow>
                  <h1 className={`mt-3 font-serif text-3xl font-medium uppercase tracking-[0.06em] sm:text-4xl ${themeConfig.accentClass}`}>{name}</h1>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-arc-muted">{evolution.title}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Eyebrow>Arc day</Eyebrow>
                  <p className="mt-2 font-serif text-2xl tabular-nums text-arc-ink">{arcDay}<span className="text-base text-arc-muted"> / {arcDuration}</span></p>
                </div>
              </div>

              <div className="mt-6 border-t border-arc-line pt-5">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <span className="font-serif text-lg tracking-[0.12em] text-arc-ink">LEVEL {level}</span>
                  <span className="text-xs tabular-nums text-arc-muted">{levelProgressXp} / {xpForNextLevel} XP</span>
                </div>
                <XPProgress label="Level progress" xp={levelProgressXp} nextLevelXp={xpForNextLevel} tone={themeConfig.accent} />
                <p className="mt-2 text-right text-xs tabular-nums text-arc-muted">{xpToNextLevel} XP to Level {level + 1} <span className="mx-1">/</span> {xp.toLocaleString()} total XP</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="border border-arc-line p-3 sm:p-4">
                <HPIndicator hp={hp} maxHp={100} />
              </div>
              <div className="flex flex-col justify-between border border-arc-line p-3 sm:p-4">
                <Eyebrow>Streak</Eyebrow>
                <div className="mt-3 flex items-baseline justify-between gap-3"><StreakBadge days={streakDays} /><span className="text-xs text-arc-muted">consecutive days</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="arc-progress-heading" className="border border-arc-line bg-arc-panel p-5 sm:p-6 xl:col-span-5 xl:p-7">
        <h2 className="font-serif text-lg tracking-[0.08em] text-arc-ink" id="arc-progress-heading">Arc Progress</h2>
        <div className="mt-5 flex items-center gap-5 sm:gap-7">
          <div aria-label={`Arc day ${arcDay} of ${arcDuration}`} className="relative h-32 w-32 shrink-0" role="img">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="5" className="text-arc-line" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - arcProgress)} className={themeConfig.accent === "gold" ? "text-arc-gold" : "text-arc-blue"} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-serif text-3xl tabular-nums text-arc-ink">{arcDay}</span>
              <span className="mt-0.5 text-xs text-arc-muted">/ {arcDuration} days</span>
            </div>
          </div>
          <dl className="min-w-0 flex-1 divide-y divide-arc-line">
            <div className="flex items-center justify-between gap-3 py-3 first:pt-0"><dt className="text-xs text-arc-muted">Days remaining</dt><dd className="text-sm tabular-nums text-arc-ink">{daysRemaining}</dd></div>
            <div className="flex items-center justify-between gap-3 py-3 last:pb-0"><dt className="text-xs text-arc-muted">Arc ends</dt><dd className="text-sm text-arc-ink">{formattedEndDate}</dd></div>
          </dl>
        </div>
        <div className="mt-6 border-t border-arc-line pt-5">
          <Eyebrow>Current cycle</Eyebrow>
          <p className="mt-2 text-sm leading-6 text-arc-muted">{arcDuration}-day Arc <span className="mx-2 text-arc-line">/</span> Day {arcDay}</p>
        </div>
      </section>
    </>
  );
}

