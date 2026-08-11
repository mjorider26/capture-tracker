"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  findWorkspaceEntries,
  isWorkspaceEntryAvailable,
  quickAddEntries,
  workspaceHref,
  type WorkspaceRole,
} from "@/lib/navigation/owner-intent-navigation";

export function WorkspaceTools({ basePath, role }: { basePath: "/app" | "/demo"; role: WorkspaceRole }) {
  const [panel, setPanel] = useState<"new" | "find" | null>(null);
  const [query, setQuery] = useState("");
  const findInput = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const findButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const results = useMemo(() => findWorkspaceEntries(query, role).filter((entry) => isWorkspaceEntryAvailable(basePath, entry)), [basePath, query, role]);
  const actions = quickAddEntries(role).filter((entry) => isWorkspaceEntryAvailable(basePath, entry));

  useEffect(() => {
    if (!panel) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => panel === "find" ? findInput.current?.focus() : closeButton.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
      if (event.key === "Tab") {
        const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])') ?? [])];
        const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPanel("find");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [panel]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPanel("find");
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  const close = () => {
    const previousPanel = panel;
    setPanel(null);
    window.requestAnimationFrame(() => (previousPanel === "new" ? newButton : findButton).current?.focus());
  };

  return (
    <>
      <div className="workspace-tools flex items-center gap-2">
        <button ref={findButton} type="button" className="workspace-tool-button" onClick={() => setPanel("find")} aria-haspopup="dialog">
          <span aria-hidden="true">⌕</span><span>Find</span><kbd className="hidden lg:inline">⌘K</kbd>
        </button>
        {role === "OWNER" ? <button ref={newButton} type="button" className="workspace-new-button" onClick={() => setPanel("new")} aria-haspopup="dialog"><span aria-hidden="true">+</span> New</button> : null}
      </div>
      {panel && typeof document !== "undefined" ? createPortal(<div className="workspace-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
        <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="workspace-dialog-title" className="workspace-dialog-panel">
          <div className="flex items-start justify-between gap-4 border-b border-border-subtle p-5">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">{panel === "new" ? "Owner actions" : "Product finder"}</p><h2 id="workspace-dialog-title" className="mt-1 text-xl font-bold text-brand-navy">{panel === "new" ? "What do you want to do?" : "Find a workflow"}</h2></div>
            <button ref={closeButton} type="button" className="ui-icon-button" onClick={close} aria-label="Close"><span aria-hidden="true">×</span></button>
          </div>
          {panel === "find" ? <div className="p-5"><label className="block text-sm font-bold text-text-muted">Search actions and destinations<input ref={findInput} className="ui-input mt-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try invoice, mileage, CPA, or reconcile" /></label><p className="mt-2 text-xs text-text-muted">Navigation only. Capture Tracker does not search customer financial data here.</p></div> : null}
          <nav aria-label={panel === "new" ? "New owner actions" : "Finder results"} className="workspace-dialog-results">
            {(panel === "new" ? actions : results).map((entry) => <Link key={entry.id} href={workspaceHref(basePath, entry)} onClick={close} className="workspace-dialog-result"><span><strong>{entry.label}</strong><small>{entry.description}</small></span><span aria-hidden="true">→</span></Link>)}
            {panel === "find" && results.length === 0 ? <p className="p-6 text-center text-sm text-text-muted">No matching workflow. Try a business task such as invoice, bill, receipt, mileage, CPA, or reconciliation.</p> : null}
          </nav>
        </section>
      </div>, document.body) : null}
    </>
  );
}
