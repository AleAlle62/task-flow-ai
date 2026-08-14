import { onUnmounted, ref } from "vue";

/**
 * A clock that ticks, so anything showing "how long so far" keeps moving.
 *
 * A phase can think for two minutes without producing a line of output. Without
 * a number that visibly changes, a working pipeline and a hung one look exactly
 * the same, and people start killing runs that were fine.
 */
export function useNow(intervalMs = 1000) {
  const now = ref(Date.now());
  const timer = window.setInterval(() => (now.value = Date.now()), intervalMs);

  onUnmounted(() => window.clearInterval(timer));

  return now;
}

export function humanSeconds(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));

  if (seconds < 60) return `${seconds}s`;

  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}
