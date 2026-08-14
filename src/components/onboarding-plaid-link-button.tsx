"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

import { createOnboardingPlaidLinkToken, exchangeOnboardingPlaidPublicToken } from "@/app/app/onboarding/actions";

const tokenKey = "capture-tracker:onboarding-plaid-link-token";

export function OnboardingPlaidLinkButton() {
  const router = useRouter();
  const oauthResume = () => {
    if (typeof window === "undefined" || !window.location.search.includes("oauth_state_id=")) return null;
    const saved = sessionStorage.getItem(tokenKey);
    return saved ? { token: saved, uri: window.location.href } : null;
  };
  const [resume] = useState(oauthResume);
  const [token, setToken] = useState<string | null>(resume?.token ?? null);
  const [opening, setOpening] = useState(Boolean(resume));
  const [message, setMessage] = useState<string | null>(null);
  const { open, ready } = usePlaidLink({
    token,
    receivedRedirectUri: resume?.uri,
    onSuccess: async (publicToken) => {
      const result = publicToken ? await exchangeOnboardingPlaidPublicToken(publicToken) : { ok: false as const, message: "Plaid did not return a connection token." };
      sessionStorage.removeItem(tokenKey); setOpening(false); setToken(null);
      setMessage(result.ok ? "Institution connected. Capture Tracker imported account identity only; choose and map the business account before continuing." : result.message);
      router.refresh();
    },
    onExit: (error) => { setOpening(false); if (error) setMessage("Plaid Link closed before the connection finished. Retry or choose manual transaction import."); },
  });
  useEffect(() => { if (opening && ready) open(); }, [open, opening, ready]);
  async function begin() {
    setMessage(null); setOpening(true);
    const result = await createOnboardingPlaidLinkToken();
    if (!result.ok) { setOpening(false); setMessage(result.message); return; }
    sessionStorage.setItem(tokenKey, result.linkToken); setToken(result.linkToken);
  }
  return <div><button type="button" onClick={() => void begin()} disabled={opening} className="ui-button ui-button-primary min-h-12 w-full px-5 font-bold disabled:opacity-60 sm:w-auto">{opening ? "Opening secure connection…" : "Connect automatically"}</button>{message && <p role="status" className="mt-3 max-w-xl text-sm leading-6 text-text-muted">{message}</p>}</div>;
}
