/** Public support metadata only. Never place credentials or deployment configuration here. */
export function appBuildId(environment: Record<string, string | undefined> = process.env) {
  const value = environment.CAPTURE_TRACKER_RELEASE_SHA ?? environment.NEXT_PUBLIC_CAPTURE_TRACKER_BUILD_SHA;
  return value?.trim().slice(0, 12) || "release build";
}

export const appVersionLabel = "Capture Tracker V2";
