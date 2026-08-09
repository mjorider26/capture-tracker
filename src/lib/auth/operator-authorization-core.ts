export function normalizeOperatorEmail(value: string) {
  return value.trim().toLowerCase();
}

export function configuredOperatorEmails(environment: Record<string, string | undefined> = process.env) {
  return new Set((environment.CAPTURE_TRACKER_OPERATOR_EMAILS ?? "").split(",").map(normalizeOperatorEmail).filter(Boolean));
}

export function isConfiguredOperator(email: string, environment: Record<string, string | undefined> = process.env) {
  return configuredOperatorEmails(environment).has(normalizeOperatorEmail(email));
}
