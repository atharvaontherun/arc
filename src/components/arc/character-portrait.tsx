"use client";

import { useState } from "react";
import { getCharacterEvolution, characterThemes, type CharacterTheme } from "./config";

export function CharacterPortrait({ theme, level, className = "" }: { theme: CharacterTheme; level: number; className?: string }) {
  const [missingAsset, setMissingAsset] = useState(false);
  const evolution = getCharacterEvolution(theme, level);
  const label = characterThemes[theme].label;

  return (
    <div aria-label={`${label}, ${evolution.title}, Level ${level}`} className={`relative grid aspect-[4/3] w-full place-items-center overflow-hidden border border-arc-line bg-arc-panel ${className}`} role="img">
      {!missingAsset ? (
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setMissingAsset(true)}
          src={evolution.asset}
        />
      ) : (
        <div className="flex h-full w-full flex-col justify-end border-t border-arc-line/70 bg-arc-bg/20 p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-arc-muted">Character artwork</p>
          <p className={`mt-3 font-serif text-3xl font-medium uppercase tracking-[0.08em] sm:text-4xl ${characterThemes[theme].accentClass}`}>{label}</p>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-arc-line pt-3">
            <p className="text-sm text-arc-muted">{evolution.title}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-arc-muted">Stage {evolution.stage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
