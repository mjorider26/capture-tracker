"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "./auth-client";

type SignOutClient = Pick<typeof authClient, "signOut">;

export async function signOutWithAuthClient(
  client: SignOutClient,
  onSuccess: () => void,
) {
  const result = await client.signOut({
    fetchOptions: { onSuccess },
  });

  return !result.error;
}

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState(false);

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);
    setError(false);
    try {
      const signedOut = await signOutWithAuthClient(authClient, () => {
        // Better Auth invalidates its browser session state after a successful
        // sign-out. Refresh the App Router view after navigating away.
        router.replace("/sign-in");
        router.refresh();
      });
      if (!signedOut) setError(true);
    } catch {
      setError(true);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="min-h-11 rounded-[var(--radius-sm)] border border-border-strong bg-surface-primary px-3 text-sm font-bold text-text-primary transition hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:opacity-60"
        disabled={signingOut}
        onClick={signOut}
        type="button"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
      {error && <p className="text-xs text-text-muted" role="alert">Sign-out failed. Please try again.</p>}
    </div>
  );
}
