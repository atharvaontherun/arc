import { AppShell } from "@/src/components/arc";

export default function ProfileLoading() {
  return <AppShell activeItem="Profile"><div aria-label="Loading Profile" className="mx-auto max-w-3xl space-y-4 pt-8" role="status"><div className="h-3 w-24 bg-arc-panel-raised" /><div className="h-8 w-64 bg-arc-panel-raised" /><div className="h-px w-full bg-arc-line" /><span className="sr-only">Loading Profile</span></div></AppShell>;
}
