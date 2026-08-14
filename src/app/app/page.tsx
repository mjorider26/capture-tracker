import { notFound, redirect } from "next/navigation";

import {
  isAccessControlError,
  requireBusinessContext,
  requireOnboardingContext,
} from "@/lib/security/business-context";

export default async function ApplicationHomePage() {
  try {
    await requireBusinessContext();
  } catch (error) {
    if (isAccessControlError(error)) {
      if (error.status === 401) redirect("/sign-in");
      let setupIncomplete = false;
      try { setupIncomplete = (await requireOnboardingContext()).business.onboarding?.status === "IN_PROGRESS"; }
      catch { /* preserve the normal denied boundary */ }
      if (setupIncomplete) redirect("/app/onboarding");
      notFound();
    }
    throw error;
  }

  redirect("/app/today");
}
