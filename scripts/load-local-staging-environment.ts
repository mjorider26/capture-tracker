import { config } from "dotenv";

// Cloud staging commands deliberately load only this ignored file. That keeps
// a developer's local DATABASE_URL from being inherited by mistake and avoids
// putting any connection details in command arguments or shell history.
const documentScanningApproved = process.env.CAPTURE_TRACKER_DOCUMENT_SCANNING_APPROVED === "true";
const result = config({
  path: ".env.staging.local",
  // The scanner release supplies only explicit, non-secret staging approval
  // flags. Keep those flags while still loading all private connection values
  // exclusively from the ignored staging file.
  override: !documentScanningApproved,
  quiet: true,
});

if (result.error) {
  throw new Error("Secure local staging environment configuration is unavailable.");
}
