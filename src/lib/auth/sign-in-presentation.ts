export type DeploymentKind = "staging" | "production";
export type BootstrapAvailability = "available" | "initialized" | "unknown";

type EnvironmentInput = Record<string, string | undefined>;

export function deploymentKind(input: EnvironmentInput = process.env): DeploymentKind {
  return input.CAPTURE_TRACKER_ENVIRONMENT === "production" && input.CAPTURE_TRACKER_DEPLOYMENT_PROFILE === "production-cloudflare-neon" ? "production" : "staging";
}

export function signInPresentation(kind: DeploymentKind, availability: BootstrapAvailability) {
  if (kind === "staging") return { production: false, showCreateAccount: false, notice: "Use the fictional staging account provided for this environment.", setupNotice: null };
  return {
    production: true,
    showCreateAccount: availability === "available",
    notice: "Sign in to your private Capture Tracker workspace.",
    setupNotice: availability === "available" ? "Setting up this workspace for the first time?" : availability === "unknown" ? "Account setup status is temporarily unavailable. Try again shortly." : null,
  };
}
