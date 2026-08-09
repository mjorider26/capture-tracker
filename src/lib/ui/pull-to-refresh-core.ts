export const pullThreshold = 72;
export const maxPullDistance = 88;

export function resistedPullDistance(deltaY: number) {
  if (deltaY <= 0) return 0;
  return Math.min(maxPullDistance, deltaY * 0.6);
}

export function pullState(deltaY: number): "idle" | "pulling" | "armed" {
  const distance = resistedPullDistance(deltaY);
  return distance === 0 ? "idle" : distance >= pullThreshold ? "armed" : "pulling";
}

export function shouldStartPull(input: { scrollY: number; startX: number; startY: number; targetIsInteractive: boolean; dialogOpen: boolean; refreshing: boolean }) {
  return input.scrollY <= 1 && input.startY >= 0 && input.startX >= 0 && !input.targetIsInteractive && !input.dialogOpen && !input.refreshing;
}
