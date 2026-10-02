import Link from "next/link";
import { ButtonLink, Eyebrow } from "@/src/components/arc/ui";

const principles = [
  { title: "Commitment", description: "The actions you choose to keep." },
  { title: "Arc", description: "The direction your character is growing toward." },
  { title: "History", description: "A record of what happened, kept as it was." },
];

export default function HomePage() {
  return (
    <main className="min-h-svh px-6 sm:px-10 xl:px-16 2xl:px-20">
      <header className="mx-auto flex w-full max-w-[1600px] items-center justify-between border-b border-arc-line py-6 sm:py-8">
        <Link aria-label="ARC home" className="text-sm font-semibold tracking-[0.2em] text-arc-ink" href="/">ARC</Link>
        <Link className="text-sm text-arc-muted transition-colors hover:text-arc-ink" href="/login">Log in</Link>
      </header>

      <section className="mx-auto grid min-h-[calc(100svh-7rem)] w-full max-w-[1600px] grid-cols-1 items-center gap-y-16 py-16 lg:grid-cols-12 lg:gap-x-10 lg:py-20 2xl:gap-x-20">
        <div className="lg:col-span-7">
          <Eyebrow>A real-life RPG</Eyebrow>
          <h1 className="mt-6 max-w-4xl text-[clamp(3.25rem,8vw,7rem)] font-semibold leading-[0.96] tracking-[-0.065em] text-arc-ink">
            YOUR LIFE.<br />YOUR CHARACTER.
          </h1>
          <p className="mt-8 max-w-lg text-base leading-7 text-arc-muted sm:text-lg sm:leading-8">
            Bring the focus of a role-playing game to real life. Keep meaningful Commitments, build your Arc, and shape the person you become.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/signup">BEGIN YOUR ARC</ButtonLink>
            <ButtonLink href="/login" variant="secondary">LOGIN</ButtonLink>
          </div>
        </div>

        <div className="lg:col-span-4 lg:col-start-9">
          <Eyebrow>The shape of your story</Eyebrow>
          <dl className="mt-5 border-t border-arc-line">
            {principles.map((item) => (
              <div className="grid gap-1 border-b border-arc-line py-5 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-5" key={item.title}>
                <dt className="text-sm font-medium text-arc-ink">{item.title}</dt>
                <dd className="text-sm leading-6 text-arc-muted">{item.description}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 max-w-sm text-xs leading-5 text-arc-muted">The Graveyard is permanent history. Nothing there is restored or resurrected.</p>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[1600px] justify-between border-t border-arc-line py-5 text-xs text-arc-muted">
        <span>ARC</span>
        <span>Your life. Your character.</span>
      </footer>
    </main>
  );
}
