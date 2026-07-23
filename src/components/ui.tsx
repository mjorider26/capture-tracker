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
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <p className="text-sm font-bold tracking-wide text-brand-teal">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-text-primary sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-muted sm:text-base">
          {description}
        </p>
      </div>
      {action}
    </header>
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
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-bold ${styles[tone]}`}
    >
      {children}
    </span>
  );
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
      className={`rounded-[var(--radius-md)] border p-4 text-sm ${styles[tone]}`}
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
    <div className="ui-card p-7 text-center">
      <p className="text-lg font-bold text-text-primary">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
        {children}
      </p>
    </div>
  );
}
