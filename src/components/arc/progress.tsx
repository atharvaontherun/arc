import { characterThemes, type CharacterTheme } from "./config";
import { getCharacterEvolution } from "./config";
import { CharacterPortrait } from "./character-portrait";
import { Eyebrow, Panel } from "./ui";

type ProgressTone = "neutral" | "blue" | "gold" | "danger";

export function StatBar({ label, value, max, tone = "neutral" }: { label: string; value: number; max: number; tone?: ProgressTone }) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = { neutral: "bg-arc-muted", blue: "bg-arc-blue", gold: "bg-arc-gold", danger: "bg-arc-danger" }[tone];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-arc-muted">{label}</span>
        <span className="tabular-nums text-arc-ink">{value}<span className="text-arc-muted"> / {max}</span></span>
      </div>
      <div aria-label={`${label}: ${value} of ${max}`} aria-valuemax={max} aria-valuemin={0} aria-valuenow={Math.min(value, max)} className="h-1 overflow-hidden bg-arc-panel-raised" role="progressbar">
        <div className={`h-full ${fill} transition-[width] duration-300`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function ProgressBar({ label, value, max, tone = "neutral" }: { label: string; value: number; max: number; tone?: ProgressTone }) {
  return <StatBar label={label} value={value} max={max} tone={tone} />;
}

export function HPIndicator({ hp, maxHp }: { hp: number; maxHp: number }) {
  const danger = maxHp > 0 && hp / maxHp <= 0.25;
  return <StatBar label="HP" value={hp} max={maxHp} tone={danger ? "danger" : "neutral"} />;
}

export function XPProgress({ xp, nextLevelXp, tone = "gold", label = "XP" }: { xp: number; nextLevelXp: number; tone?: "blue" | "gold"; label?: string }) {
  return <StatBar label={label} value={xp} max={nextLevelXp} tone={tone} />;
}

export function LevelBadge({ level }: { level: number }) {
  return <span className="inline-flex min-h-7 items-center border border-arc-line px-2 text-[11px] font-medium tabular-nums text-arc-muted">LEVEL {level}</span>;
}

export function StreakBadge({ days }: { days: number }) {
  return <span className="inline-flex items-center gap-2 text-sm"><span className="font-medium tabular-nums text-arc-ink">{days}</span><span className="text-arc-muted">day streak</span></span>;
}

export function CharacterCard({ theme, name, level, hp, maxHp, xp, nextLevelXp, streakDays }: { theme: CharacterTheme; name: string; level: number; hp: number; maxHp: number; xp: number; nextLevelXp: number; streakDays: number }) {
  const style = characterThemes[theme];
  const evolution = getCharacterEvolution(theme, level);
  const levelStartXp = 50 * (level - 1) * level;
  const levelProgressXp = Math.max(0, xp - levelStartXp);
  const xpToNextLevel = Math.max(0, nextLevelXp - levelProgressXp);
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-arc-line p-4 sm:p-5">
        <Eyebrow>Active character</Eyebrow>
        <CharacterPortrait className="mt-4 aspect-[5/3]" level={level} theme={theme} />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div><h2 className={`text-xl font-semibold tracking-tight ${style.accentClass}`}>{name}</h2><p className="mt-1 text-sm text-arc-muted">{evolution.title}</p></div>
          <LevelBadge level={level} />
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <div className="mb-5 flex items-baseline justify-between border-b border-arc-line pb-4">
          <Eyebrow>Lifetime XP</Eyebrow>
          <span className="text-lg font-semibold tabular-nums text-arc-ink">{xp.toLocaleString()}</span>
        </div>
        <div className="space-y-5">
          <HPIndicator hp={hp} maxHp={maxHp} />
          <div>
            <XPProgress label="Progress to next level" xp={levelProgressXp} nextLevelXp={nextLevelXp} tone={style.accent} />
            <p className="mt-2 text-right text-xs tabular-nums text-arc-muted">{xpToNextLevel} XP to Level {level + 1}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-arc-line pt-4">
          <Eyebrow>Consistency</Eyebrow>
          <StreakBadge days={streakDays} />
        </div>
      </div>
    </Panel>
  );
}
