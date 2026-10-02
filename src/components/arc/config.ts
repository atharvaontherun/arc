export type CharacterTheme = "batman" | "spider-man";

export type CharacterEvolution = {
  level: number;
  stage: 1 | 2 | 3;
  title: string;
  asset: string;
};

export const characterThemes = {
  batman: {
    label: "Batman",
    accent: "gold" as const,
    accentClass: "text-arc-gold",
  },
  "spider-man": {
    label: "Spider-Man",
    accent: "blue" as const,
    accentClass: "text-arc-blue",
  },
} satisfies Record<CharacterTheme, object>;

export const characterEvolution: Record<CharacterTheme, readonly CharacterEvolution[]> = {
  batman: [
    { level: 1, stage: 1, title: "The Vigilante", asset: "/characters/batman-1.png" },
    { level: 5, stage: 2, title: "The Dark Knight", asset: "/characters/batman-2.png" },
    { level: 10, stage: 3, title: "The Legend", asset: "/characters/batman-3.png" },
  ],
  "spider-man": [
    { level: 1, stage: 1, title: "Web-Slinger", asset: "/characters/spiderman-1.png" },
    { level: 5, stage: 2, title: "City Protector", asset: "/characters/spiderman-2.png" },
    { level: 10, stage: 3, title: "The Amazing Spider-Man", asset: "/characters/spiderman-3.png" },
  ],
};

export function getCharacterEvolution(theme: CharacterTheme, level: number): CharacterEvolution {
  const stages = characterEvolution[theme];
  return [...stages].reverse().find((stage) => level >= stage.level) ?? stages[0];
}

export type NavigationItem = {
  label: "Home" | "Arc" | "History" | "Profile";
  href: string;
  icon: "home" | "arc" | "history" | "profile";
  available: boolean;
};

export const navigationItems: NavigationItem[] = [
  { label: "Home", href: "/dashboard", icon: "home", available: true },
  { label: "Arc", href: "/arc", icon: "arc", available: true },
  { label: "History", href: "/history", icon: "history", available: true },
  { label: "Profile", href: "/profile", icon: "profile", available: true },
];
