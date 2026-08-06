import { SignInForm } from "@/components/sign-in-form";
import { isProductionOwnerBootstrapAvailable } from "@/lib/auth/production-owner-bootstrap";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  return <SignInForm initialSetupAvailable={await isProductionOwnerBootstrapAvailable()} production={process.env.CAPTURE_TRACKER_ENVIRONMENT === "production"} />;
}
