export function supportLinks(environment: Record<string, string | undefined> = process.env) {
  return {
    privacy: environment.CAPTURE_TRACKER_PRIVACY_URL?.trim() || null,
    security: environment.CAPTURE_TRACKER_SECURITY_URL?.trim() || null,
    support: environment.CAPTURE_TRACKER_SUPPORT_CONTACT?.trim() || null,
  };
}
