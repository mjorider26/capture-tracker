"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export async function requestSignOut(fetcher: typeof fetch = fetch) {
  const response = await fetcher("/api/auth/sign-out", { method: "POST" });
  return response.ok;
}

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      if (await requestSignOut()) {
        router.replace("/sign-in");
        router.refresh();
      }
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <button
      className="min-h-11 rounded-[var(--radius-sm)] border border-border-strong bg-surface-primary px-3 text-sm font-bold text-text-primary transition hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:opacity-60"
      disabled={signingOut}
      onClick={signOut}
      type="button"
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
