import { SignInForm } from "@/components/sign-in-form";
import { readPublicBootstrapState } from "@/lib/auth/public-bootstrap-state";
import { signInPresentation } from "@/lib/auth/sign-in-presentation";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const state = await readPublicBootstrapState();
  return <SignInForm {...signInPresentation(state.deploymentKind, state.bootstrapAvailability)} />;
}
