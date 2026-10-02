import type { ReactNode } from "react";
import { Eyebrow } from "./ui";

export type HistoryRecord = { id: string; title: string; date: string; description?: string; kind: "commitment" | "day" | "focus" | "arc" | "failed-arc" | "graveyard" };

export function HistoryEntry({ record }: { record: HistoryRecord }) {
  const labels = { commitment: "Commitment", day: "Daily result", focus: "Focus Log", arc: "Completed Arc", "failed-arc": "Failed Arc", graveyard: "Graveyard" };
  return (
    <article className="grid gap-2 border-b border-arc-line py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-8">
      <div><Eyebrow>{labels[record.kind]}</Eyebrow><h3 className="mt-2 text-sm font-medium text-arc-ink">{record.title}</h3>{record.description ? <p className="mt-1 text-sm leading-5 text-arc-muted">{record.description}</p> : null}</div>
      <time className="text-xs text-arc-muted sm:pt-1">{record.date}</time>
    </article>
  );
}

export function HistoryTimeline({ records }: { records: HistoryRecord[] }) {
  return <ol className="border-t border-arc-line">{records.map((record) => <li key={record.id}><HistoryEntry record={record} /></li>)}</ol>;
}

export function CompletedArcRecord({ record }: { record: Omit<HistoryRecord, "kind"> }) {
  return <HistoryEntry record={{ ...record, kind: "arc" }} />;
}

export function GraveyardArchive({ children, description = "The Graveyard is a permanent historical archive. Dead characters are not restored or resurrected." }: { children: ReactNode; description?: string }) {
  return <section className="space-y-4"><div className="border-b border-arc-line pb-4"><Eyebrow>History</Eyebrow><h2 className="mt-2 text-xl font-semibold">Graveyard</h2><p className="mt-2 max-w-xl text-sm leading-6 text-arc-muted">{description}</p></div>{children}</section>;
}
