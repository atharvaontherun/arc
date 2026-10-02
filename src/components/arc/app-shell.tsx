import Link from "next/link";
import type { ReactNode } from "react";
import { navigationItems, type NavigationItem } from "./config";
import { Icon } from "./ui";

function NavigationLink({ item, active }: { item: NavigationItem; active: boolean }) {
  const className = `flex min-h-10 items-center gap-3 border-l px-3 text-sm transition-colors ${active ? "border-arc-ink text-arc-ink" : "border-transparent text-arc-muted hover:text-arc-ink"} ${item.available ? "" : "cursor-default opacity-40"}`;
  const content = <><Icon name={item.icon} className="h-[18px] w-[18px]" /><span>{item.label}</span>{!item.available ? <span className="ml-auto text-[10px] text-arc-muted">Soon</span> : null}</>;
  if (!item.available) return <span aria-disabled="true" className={className}>{content}</span>;
  return <Link aria-current={active ? "page" : undefined} className={className} href={item.href}>{content}</Link>;
}

export function DesktopSidebar({ activeItem = "Home" }: { activeItem?: NavigationItem["label"] | null }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-arc-line bg-arc-bg px-5 py-7 lg:flex">
      <Link aria-label="ARC home" className="px-3 text-sm font-semibold tracking-[0.2em] text-arc-ink" href="/">ARC</Link>
      <p className="mb-3 mt-12 px-3 text-[11px] text-arc-muted">Workspace</p>
      <nav aria-label="Main navigation" className="space-y-1">
        {navigationItems.map((item) => <NavigationLink key={item.label} active={item.label === activeItem} item={item} />)}
      </nav>
    </aside>
  );
}

export function MobileNavigation({ activeItem = "Home" }: { activeItem?: NavigationItem["label"] | null }) {
  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-arc-line bg-arc-bg px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 lg:hidden">
      {navigationItems.map((item) => {
        const active = item.label === activeItem;
        const content = <><Icon name={item.icon} className="h-[18px] w-[18px]" /><span>{item.label}</span></>;
        const className = `flex min-h-12 flex-col items-center justify-center gap-1 border-t text-[10px] transition-colors ${active ? "border-arc-ink text-arc-ink" : "border-transparent text-arc-muted"} ${item.available ? "" : "opacity-40"}`;
        return <div className="px-1" key={item.label}>{item.available ? <Link aria-current={active ? "page" : undefined} className={className} href={item.href}>{content}</Link> : <span aria-disabled="true" className={className}>{content}</span>}</div>;
      })}
    </nav>
  );
}

export function PageHeader({ title, description, trailing }: { title: string; description?: string; trailing?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-arc-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs text-arc-muted">ARC / Home</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>{description ? <p className="mt-3 max-w-xl text-sm leading-6 text-arc-muted">{description}</p> : null}</div>
      {trailing}
    </header>
  );
}

export function AppShell({ children, activeItem = "Home" }: { children: ReactNode; activeItem?: NavigationItem["label"] | null }) {
  return (
    <div className="min-h-svh">
      <DesktopSidebar activeItem={activeItem} />
      <div className="min-h-svh lg:pl-60">
        <main className="mx-auto min-h-svh w-full max-w-[1600px] px-6 pb-24 pt-8 sm:px-10 lg:px-12 lg:pb-12 2xl:px-20">{children}</main>
      </div>
      <MobileNavigation activeItem={activeItem} />
    </div>
  );
}
