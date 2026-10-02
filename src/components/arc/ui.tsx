import Link from "next/link";
import type { ChangeEvent, ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-arc-muted">{children}</p>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`border border-arc-line bg-arc-panel ${className}`}>{children}</section>;
}

export function Button({
  children,
  type = "button",
  variant = "primary",
  disabled = false,
  className = "",
  onClick,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  variant?: "primary" | "secondary";
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return <button className={`${buttonClass(variant)} disabled:cursor-not-allowed disabled:opacity-45 ${className}`} disabled={disabled} onClick={onClick} type={type}>{children}</button>;
}

function buttonClass(variant: "primary" | "secondary") {
  const base = "inline-flex min-h-11 items-center justify-center gap-2 border px-4 text-sm font-medium transition-colors";
  const variantClass = variant === "primary"
    ? "border-arc-ink bg-arc-ink text-arc-bg hover:bg-white"
    : "border-arc-line bg-transparent text-arc-ink hover:border-arc-muted hover:bg-white/[0.035]";
  return `${base} ${variantClass}`;
}

export function ButtonLink({ href, children, variant = "primary", className = "" }: { href: string; children: ReactNode; variant?: "primary" | "secondary"; className?: string }) {
  return <Link className={`${buttonClass(variant)} ${className}`} href={href}>{children}</Link>;
}

export function TextInput({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required = false,
}: {
  id: string;
  label: string;
  type: "email" | "password" | "text";
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm text-arc-ink" htmlFor={id}>{label}</label>
      <input
        autoComplete={autoComplete}
        className="min-h-11 w-full rounded-sm border border-arc-line bg-transparent px-3 text-base text-arc-ink outline-none transition-colors placeholder:text-arc-muted/65 hover:border-white/25 focus:border-arc-muted focus:ring-1 focus:ring-arc-muted/35"
        id={id}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </div>
  );
}

export function StatusMessage({ children, kind }: { children: ReactNode; kind: "error" | "success" }) {
  const isError = kind === "error";
  return (
    <p aria-live="polite" className={`border-l-2 py-1 pl-3 text-sm leading-6 ${isError ? "border-arc-danger text-arc-danger" : "border-arc-line text-arc-muted"}`} role={isError ? "alert" : "status"}>
      {children}
    </p>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-40 flex-col justify-center py-8">
      <h2 className="text-base font-medium text-arc-ink">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-arc-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="mx-auto grid min-h-svh w-full max-w-[1600px] grid-cols-1 px-6 sm:px-10 xl:grid-cols-12 xl:gap-x-10 xl:px-16 2xl:gap-x-20 2xl:px-20">
      <aside className="flex items-center justify-between border-b border-arc-line py-6 xl:col-span-4 xl:col-start-2 xl:min-h-svh xl:flex-col xl:items-start xl:justify-center xl:border-b-0 xl:border-r xl:py-0 xl:pr-12">
        <Link aria-label="ARC home" className="text-sm font-semibold tracking-[0.2em] text-arc-ink" href="/">ARC</Link>
        <span className="text-xs text-arc-muted xl:hidden">Your life. Your character.</span>
        <div className="hidden pt-8 xl:block">
          <p className="text-2xl font-medium tracking-tight text-arc-ink">Your life.<br />Your character.</p>
          <p className="mt-6 max-w-52 text-sm leading-6 text-arc-muted">A real-life RPG, shaped one Commitment at a time.</p>
        </div>
      </aside>

      <section className="flex items-start py-12 xl:col-span-5 xl:col-start-7 xl:items-center xl:py-20">
        <div className="w-full max-w-[26rem] xl:my-auto">
          <p className="text-xs font-medium text-arc-muted">ARC / ACCOUNT</p>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.035em] text-arc-ink sm:text-[2rem]">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-arc-muted">{description}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 border-t border-arc-line pt-6 text-sm text-arc-muted">{footer}</div>
        </div>
      </section>
    </main>
  );
}

export function Icon({ name, className = "" }: { name: "home" | "arc" | "history" | "profile"; className?: string }) {
  const shared = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" {...shared}>
      {name === "home" ? <><path d="m3.5 10 8.5-7 8.5 7" /><path d="M5.5 9v11h13V9M9.5 20v-6h5v6" /></> : null}
      {name === "arc" ? <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></> : null}
      {name === "history" ? <><path d="M4 7v5h5" /><path d="M5.2 12a7 7 0 1 0 2-4.9L4 12" /><path d="M12 8v4l2.5 1.5" /></> : null}
      {name === "profile" ? <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></> : null}
    </svg>
  );
}
