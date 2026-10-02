import { Button, Eyebrow } from "./ui";

export type CommitmentItem = { id: string; title: string; detail?: string; completed?: boolean };

export function CommitmentCard({ item }: { item: CommitmentItem }) {
  return (
    <article className="flex items-start gap-4 border-b border-arc-line py-4 first:border-t">
      <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center border ${item.completed ? "border-arc-muted text-arc-ink" : "border-arc-line text-transparent"}`}>
        {item.completed ? <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 8 3.2 3.2L13 4.5" /></svg> : null}
      </span>
      <div className="min-w-0"><h3 className={`text-sm font-medium ${item.completed ? "text-arc-muted line-through" : "text-arc-ink"}`}>{item.title}</h3>{item.detail ? <p className="mt-1 text-sm leading-5 text-arc-muted">{item.detail}</p> : null}</div>
    </article>
  );
}

export function CommitmentList({ items }: { items: CommitmentItem[] }) {
  return <div>{items.map((item) => <CommitmentCard key={item.id} item={item} />)}</div>;
}

export function QuickAddCommitment({ onAdd }: { onAdd?: () => void }) {
  return <Button disabled={!onAdd} onClick={onAdd} variant="secondary"><span aria-hidden="true">+</span>Add Commitment</Button>;
}

export function CommitmentSection({ items }: { items: CommitmentItem[] }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4"><div><Eyebrow>Today</Eyebrow><h2 className="mt-2 text-xl font-semibold">Commitments</h2></div><QuickAddCommitment /></div>
      {items.length ? <CommitmentList items={items} /> : <div className="border-y border-arc-line py-6 text-sm text-arc-muted">No Commitments yet.</div>}
    </section>
  );
}
