"use client";

import { useEffect, useState } from "react";

import { SignInForm } from "@/components/sign-in-form";

export default function SignInPage() {
  const [state, setState] = useState({ production: false, available: false });
  useEffect(() => {
    fetch("/api/invitations/create-account", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((value: unknown) => {
        if (value && typeof value === "object" && "production" in value && "available" in value && typeof value.production === "boolean" && typeof value.available === "boolean") setState(value);
      })
      .catch(() => undefined);
  }, []);
  return <SignInForm initialSetupAvailable={state.available} production={state.production} />;
}
