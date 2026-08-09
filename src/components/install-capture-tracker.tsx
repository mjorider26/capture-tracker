"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function InstallCaptureTracker({ compact = false }: { compact?: boolean }) {
  const [installed, setInstalled] = useState(false);
  useEffect(() => { const media = window.matchMedia("(display-mode: standalone)"); const update = () => setInstalled(media.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  if (installed) return <p className="text-sm font-semibold text-brand-teal">Capture Tracker is installed ✓</p>;
  return <Link href="/install" className={compact ? "text-sm font-bold text-brand-teal underline" : "ui-button ui-button-secondary min-h-11 px-4"}>Install Capture Tracker</Link>;
}
