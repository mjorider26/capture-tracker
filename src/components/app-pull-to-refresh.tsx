"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type TouchEvent } from "react";
import { pullState, resistedPullDistance, shouldStartPull } from "@/lib/ui/pull-to-refresh-core";

type Phase = "idle" | "pulling" | "armed" | "refreshing" | "complete" | "error";
const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
const interactive = "input, textarea, select, button, a, [contenteditable=true], [data-pull-to-refresh-exempt]";

export function AppPullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const start = useRef<{ x: number; y: number } | null>(null); const tracking = useRef(false); const refreshing = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle"); const [distance, setDistance] = useState(0);
  const reset = () => { start.current = null; tracking.current = false; setDistance(0); setPhase("idle"); };
  const onStart = (event: TouchEvent<HTMLDivElement>) => { const touch = event.touches[0]; const element = event.target instanceof Element ? event.target : null; const targetIsInteractive = Boolean(element?.closest(interactive)); const dialogOpen = Boolean(document.querySelector('[role="dialog"][aria-modal="true"], [aria-modal="true"]'));
    if (!touch || event.touches.length !== 1 || !shouldStartPull({ scrollY: window.scrollY, startX: touch.clientX, startY: touch.clientY, targetIsInteractive, dialogOpen, refreshing: refreshing.current })) return; start.current = { x: touch.clientX, y: touch.clientY }; tracking.current = true; };
  const onMove = (event: TouchEvent<HTMLDivElement>) => { const touch = event.touches[0]; if (!touch || !tracking.current || !start.current) return; const deltaX = touch.clientX - start.current.x; const deltaY = touch.clientY - start.current.y; if (Math.abs(deltaX) > Math.abs(deltaY)) { reset(); return; } if (deltaY <= 0) { reset(); return; } const next = resistedPullDistance(deltaY); setDistance(next); setPhase(pullState(deltaY)); if (next > 0) event.preventDefault(); };
  const refresh = async () => { if (refreshing.current) return; refreshing.current = true; setPhase("refreshing"); try { router.refresh(); await wait(350); setPhase("complete"); await wait(350); reset(); } catch { setPhase("error"); await wait(1600); reset(); } finally { refreshing.current = false; } };
  const onEnd = () => { const armed = phase === "armed"; start.current = null; tracking.current = false; setDistance(0); if (armed) void refresh(); else if (phase !== "refreshing") setPhase("idle"); };
  const label = phase === "armed" ? "Release to refresh" : phase === "refreshing" ? "Refreshing…" : phase === "complete" ? "Updated" : phase === "error" ? "Couldn’t refresh. Pull down to try again." : "Pull down to refresh";
  return <div className="app-pull-root" onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}><div className={`app-pull-indicator is-${phase}`} style={{ transform: `translate(-50%, ${Math.max(-54, distance - 54)}px)` }} role="status" aria-live="polite" aria-hidden={phase === "idle"}><span aria-hidden="true" className="app-pull-mark">{phase === "complete" ? "✓" : "↻"}</span><span>{label}</span></div>{children}</div>;
}
