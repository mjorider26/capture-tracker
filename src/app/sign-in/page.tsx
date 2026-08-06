import { SignInForm } from "@/components/sign-in-form";
import { readProductionBootstrapAvailability } from "@/lib/auth/production-owner-bootstrap";
import { deploymentKind, signInPresentation } from "@/lib/auth/sign-in-presentation";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const kind = deploymentKind();
  const availability = kind === "production" ? await readProductionBootstrapAvailability() : "initialized";
  return <SignInForm {...signInPresentation(kind, availability)} />;
}
