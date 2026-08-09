import { SignInForm } from "@/components/sign-in-form";
import { readPublicBootstrapState } from "@/lib/auth/public-bootstrap-state";
import { signInPresentation } from "@/lib/auth/sign-in-presentation";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const state = await readPublicBootstrapState();
  const invite = (await searchParams).invite;
  const callbackUrl = invite && /^[a-f0-9]{64}$/i.test(invite) ? `/invite/${invite}` : "/app/today";
  return <SignInForm {...signInPresentation(state.deploymentKind, state.bootstrapAvailability)} callbackUrl={callbackUrl} />;
}
