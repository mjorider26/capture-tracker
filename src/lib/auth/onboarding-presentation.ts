type EnvironmentInput = Record<string, string | undefined>;

export type LandingOnboardingPresentation = {
  accountCreationAvailable: boolean;
  accountCreationLabel?: "Create practice account" | "Create account";
  accountCreationAriaLabel?: string;
  notice: string;
};

/**
 * Public landing-page wording deliberately derives its environment identity
 * from the deployment boundary and onboarding state. Data mode describes the
 * kind of records permitted in an environment; it must never identify a
 * production deployment as staging.
 */
export function landingOnboardingPresentation(
  input: EnvironmentInput = process.env,
): LandingOnboardingPresentation {
  const environment = input.CAPTURE_TRACKER_ENVIRONMENT?.trim();
  const profile = input.CAPTURE_TRACKER_DEPLOYMENT_PROFILE?.trim();
  const onboardingEnabled = input.CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED?.trim() === "true";

  if (
    environment === "staging" &&
    profile === "free-preview-cloudflare-neon"
  ) {
    return {
      accountCreationAvailable: true,
      accountCreationLabel: "Create practice account",
      accountCreationAriaLabel: "Create a fictional Capture Tracker practice account",
      notice: "This is a fictional staging environment. Do not enter real financial, customer, payroll, tax, or document data.",
    };
  }

  if (environment === "production" && profile === "production-cloudflare-neon") {
    if (onboardingEnabled) {
      return {
        accountCreationAvailable: true,
        accountCreationLabel: "Create account",
        accountCreationAriaLabel: "Create a Capture Tracker account with an invitation",
        notice: "Capture Tracker is a private production pilot. An invitation from the account owner is required to create an account.",
      };
    }

    return {
      accountCreationAvailable: false,
      notice: "Capture Tracker is a private production pilot. New account onboarding is currently closed; use an existing account to sign in.",
    };
  }

  return {
    accountCreationAvailable: false,
    notice: "Capture Tracker is not accepting new accounts in this environment. Use an existing account to sign in.",
  };
}
