"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { completePlaidReconnectAction, createPlaidLinkTokenAction, exchangePlaidPublicTokenAction } from "@/app/app/money/bank/actions";

const oauthTokenKey = "capture-tracker:plaid-link-token";
const oauthConnectionKey = "capture-tracker:plaid-connection-id";

export function PlaidLinkButton({ connectionId }: { connectionId?: string }) {
  const router = useRouter();
  const oauthResume = () => {
    if (typeof window === "undefined" || !window.location.search.includes("oauth_state_id=")) return null;
    const savedToken = sessionStorage.getItem(oauthTokenKey), savedConnection = sessionStorage.getItem(oauthConnectionKey) || undefined;
    return savedToken && savedConnection === connectionId ? { token: savedToken, uri: window.location.href } : null;
  };
  const [resume] = useState(oauthResume);
  const [token, setToken] = useState<string | null>(resume?.token ?? null);
  const [receivedRedirectUri] = useState<string | undefined>(resume?.uri);
  const [opening, setOpening] = useState(Boolean(resume));
  const [message, setMessage] = useState<string | null>(null);

  const { open, ready } = usePlaidLink({
    token,
    receivedRedirectUri,
    onSuccess: async (publicToken) => {
      const result = connectionId ? await completePlaidReconnectAction(connectionId) : publicToken ? await exchangePlaidPublicTokenAction(publicToken) : { ok: false as const, message: "Plaid did not return a connection token." };
      sessionStorage.removeItem(oauthTokenKey); sessionStorage.removeItem(oauthConnectionKey);
      setOpening(false); setToken(null); setMessage(result.ok ? connectionId ? "Bank access restored and sync requested." : "Institution connected. Map the business accounts below." : result.message);
      router.replace("/app/money/bank"); router.refresh();
    },
    onExit: (error) => { setOpening(false); if (error) setMessage("Plaid Link closed before the connection finished. You can retry or use CSV import."); },
  });

  useEffect(() => { if (opening && ready) open(); }, [open, opening, ready]);

  async function begin() {
    setMessage(null); setOpening(true);
    const result = await createPlaidLinkTokenAction(connectionId);
    if (!result.ok) { setOpening(false); setMessage(result.message); return; }
    sessionStorage.setItem(oauthTokenKey, result.linkToken);
    if (connectionId) sessionStorage.setItem(oauthConnectionKey, connectionId); else sessionStorage.removeItem(oauthConnectionKey);
    setToken(result.linkToken);
  }

  return <div className="min-w-0"><button type="button" onClick={() => void begin()} disabled={opening} className="ui-button ui-button-primary min-h-11 w-full bg-brand-navy px-4 text-sm font-bold text-white disabled:opacity-60 sm:w-auto">{opening ? "Opening Plaid…" : connectionId ? "Reconnect with Plaid" : "Connect securely with Plaid"}</button>{message && <p role="status" className="mt-2 max-w-md text-xs leading-5 text-text-muted">{message}</p>}</div>;
}
