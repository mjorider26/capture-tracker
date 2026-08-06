import "server-only";

import { readProductionBootstrapAvailability } from "./production-owner-bootstrap";
import { deploymentKind, type BootstrapAvailability, type DeploymentKind } from "./sign-in-presentation";

export type PublicBootstrapState = {
  deploymentKind: DeploymentKind;
  bootstrapAvailability: BootstrapAvailability;
};

/**
 * Resolves the public onboarding state once, on the server. Deployment
 * identity is configuration-only; the database lookup is presentation
 * guidance and must fail closed without changing the identity to staging.
 */
export async function readPublicBootstrapState(): Promise<PublicBootstrapState> {
  const kind = deploymentKind();
  return {
    deploymentKind: kind,
    bootstrapAvailability: kind === "production"
      ? await readProductionBootstrapAvailability()
      : "initialized",
  };
}
