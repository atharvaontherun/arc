import type { ReactNode } from "react";
import type { CharacterTheme } from "./config";
import { characterThemes } from "./config";
import { CharacterCard } from "./progress";
import { CharacterPortrait } from "./character-portrait";
import { getCharacterEvolution } from "./config";
import { Eyebrow, Panel } from "./ui";

export function ProfileHeader({ name, subtitle }: { name: string; subtitle?: string }) {
  return <header><Eyebrow>Profile</Eyebrow><h1 className="mt-2 text-3xl font-semibold tracking-tight">{name}</h1>{subtitle ? <p className="mt-2 text-sm text-arc-muted">{subtitle}</p> : null}</header>;
}

export function CharacterIdentity({ theme, level = 1 }: { theme: CharacterTheme; level?: number }) {
  const character = characterThemes[theme];
  const evolution = getCharacterEvolution(theme, level);
  return <Panel className="p-5 sm:p-6"><CharacterPortrait className="mb-5" level={level} theme={theme} /><Eyebrow>Character identity</Eyebrow><p className={`mt-2 text-xl font-semibold ${character.accentClass}`}>{character.label}</p><p className="mt-1 text-sm text-arc-muted">{evolution.title} · Level {level}</p></Panel>;
}

export function ProgressSummary(props: { theme: CharacterTheme; name: string; level: number; hp: number; maxHp: number; xp: number; nextLevelXp: number; streakDays: number }) {
  return <CharacterCard {...props} />;
}

export function SettingsSection({ children }: { children: ReactNode }) {
  return <section className="space-y-4"><Eyebrow>Settings</Eyebrow><div className="divide-y divide-arc-line border-y border-arc-line">{children}</div></section>;
}
