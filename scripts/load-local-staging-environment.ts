import { config } from "dotenv";

// Cloud staging commands deliberately load only this ignored file. That keeps
// a developer's local DATABASE_URL from being inherited by mistake and avoids
// putting any connection details in command arguments or shell history.
const result = config({
  path: ".env.staging.local",
  override: true,
  quiet: true,
});

if (result.error) {
  throw new Error("Secure local staging environment configuration is unavailable.");
}
