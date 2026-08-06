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
  initialSetupAvailable = false,
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
    if (onboardingEnabled && initialSetupAvailable) {
      return {
        accountCreationAvailable: true,
        accountCreationLabel: "Create account",
        accountCreationAriaLabel: "Create the first Capture Tracker owner account",
        notice: "Create the first owner account to finish setting up this private Capture Tracker workspace.",
      };
    }

    return {
      accountCreationAvailable: false,
      notice: "This private workspace has already been set up. Sign in to continue.",
    };
  }

  return {
    accountCreationAvailable: false,
    notice: "Capture Tracker is not accepting new accounts in this environment. Use an existing account to sign in.",
  };
}
