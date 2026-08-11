import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`ui-card ${className}`}>{children}</section>;
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`ui-panel ${className}`}>{children}</section>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="ui-page-header flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <p className="ui-page-eyebrow font-bold uppercase">
          {eyebrow}
        </p>
        <h1 className="ui-page-title mt-2 text-3xl font-bold tracking-[-0.055em] text-text-primary sm:text-[2.65rem]">
          {title}
        </h1>
        <p className="ui-page-description mt-3 text-sm leading-6 text-text-muted sm:text-base">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="ui-section-mark text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">
          {eyebrow}
        </p>
        <h2 className="mt-1.5 text-xl font-bold tracking-[-0.035em] text-text-primary sm:text-2xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "info" | "locked";
}) {
  const styles = {
    neutral: "bg-surface-secondary text-text-muted",
    success: "bg-[var(--success-soft)] text-[var(--success)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
    info: "bg-[var(--info-soft)] text-[var(--info)]",
    locked: "bg-[var(--locked-soft)] text-[var(--locked)]",
  };
  return <span className={`ui-status-badge ${styles[tone]}`}>{children}</span>;
}

export function InlineAlert({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: ReactNode;
  tone?: "info" | "success" | "warning" | "locked";
}) {
  const styles = {
    info: "border-[var(--info)] bg-[var(--info-soft)] text-[var(--info)]",
    success:
      "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]",
    warning:
      "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
    locked:
      "border-[var(--locked)] bg-[var(--locked-soft)] text-[var(--locked)]",
  };
  return (
    <section
      role="status"
      className={`ui-alert rounded-[var(--radius-md)] border p-4 text-sm ${styles[tone]}`}
    >
      <p className="font-bold">{title}</p>
      <div className="mt-1 leading-6">{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="ui-panel ui-empty-state border border-dashed border-border-subtle p-7 text-center">
      <p className="text-lg font-bold text-text-primary">{title}</p>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
        {children}
      </div>
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  tone = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  tone?: "primary" | "secondary" | "quiet";
  className?: string;
}) {
  const styles = {
    primary:
      "ui-button ui-button-primary bg-brand-navy text-white shadow-sm hover:bg-[var(--brand-navy-strong)]",
    secondary:
      "ui-button ui-button-secondary border border-border-subtle bg-surface text-text-primary hover:bg-surface-secondary",
    quiet: "ui-button ui-button-quiet bg-transparent text-brand-teal hover:bg-brand-teal-soft",
  };
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] px-4 text-sm font-bold transition-colors ${styles[tone]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-text-muted">
        <span>{label}</span>
        <span className="money-value text-text-primary">{clamped}%</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-tertiary"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
      >
        <div
          className="h-full rounded-full bg-brand-teal transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`ui-skeleton rounded-[var(--radius-sm)] ${className}`}
    />
  );
}

export function SafeErrorState({
  title = "This view is temporarily unavailable",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section
      role="alert"
      className="ui-panel border border-[color:var(--danger)]/20 p-6"
    >
      <p className="text-sm font-bold text-[var(--danger)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">{children}</p>
    </section>
  );
}
