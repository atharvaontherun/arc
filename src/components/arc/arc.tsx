import type { ReactNode } from "react";
import { ProgressBar } from "./progress";
import { Eyebrow, Panel } from "./ui";

export type ArcSummary = { title: string; description?: string; progress: number; total: number };

export function ArcCard({ arc }: { arc: ArcSummary }) {
  return <Panel className="p-5 sm:p-6"><Eyebrow>Arc</Eyebrow><h3 className="mt-2 text-lg font-semibold">{arc.title}</h3>{arc.description ? <p className="mt-2 text-sm leading-6 text-arc-muted">{arc.description}</p> : null}<div className="mt-5"><ProgressBar label="Progress" value={arc.progress} max={arc.total} /></div></Panel>;
}

export function ArcProgress({ value, total }: { value: number; total: number }) {
  return <ProgressBar label="Arc progress" value={value} max={total} tone="gold" />;
}

export function ArcDetailHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <header className="flex flex-col gap-6 border-b border-arc-line pb-6 sm:flex-row sm:items-end sm:justify-between"><div><Eyebrow>Arc</Eyebrow><h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>{description ? <p className="mt-3 max-w-xl text-sm leading-6 text-arc-muted">{description}</p> : null}</div>{actions ? <div>{actions}</div> : null}</header>;
}
