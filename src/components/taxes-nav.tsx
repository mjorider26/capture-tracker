"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TaxesNav({ basePath }: { basePath: "/app" | "/demo" }) {
  const pathname = usePathname();
  const items = [
    ["Overview", ""],
    ["Estimates", "/estimates"],
    ["Payroll", "/payroll"],
    ["Owner money", "/owner-money"],
    ["Mileage", "/mileage"],
    ["Owner compensation", "/owner-compensation"],
    ["Fixed assets", "/fixed-assets"],
    ["Month-end close", "/close"],
    ["Year-end", "/year-end"],
  ] as const;
  const availableItems = basePath === "/app"
    ? items
    : items.filter(([, suffix]) => !["/mileage", "/fixed-assets", "/close"].includes(suffix));

  return (
    <nav aria-label="Taxes sections" className="mb-6 overflow-x-auto pb-1">
      <div className="flex min-w-max gap-2">
        {availableItems.map(([label, suffix]) => {
          const href = `${basePath}/taxes${suffix}`;
          const active = suffix
            ? pathname === href || pathname.startsWith(`${href}/`)
            : pathname === href;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`min-h-11 shrink-0 rounded-[var(--radius-sm)] px-4 py-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal ${active ? "bg-[var(--brand-teal-soft)] text-brand-teal" : "bg-surface-secondary text-text-muted hover:text-text-primary"}`}
              href={href}
              key={label}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
